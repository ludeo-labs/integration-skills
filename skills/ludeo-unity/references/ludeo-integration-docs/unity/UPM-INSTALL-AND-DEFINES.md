# UPM Install, LudeoSettings & (optional) Defines

How the Ludeo Unity plugin is added to a project and configured. Phase 0 uses this. Signatures and
types referenced are in [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md).

---

## 1. Choose the install method (by Unity version)

Ludeo ships the plugin two ways — both are common Unity delivery methods. Pick by the project's
Unity version (`ProjectSettings/ProjectVersion.txt`). This skill supports **Unity 2021.3 LTS+**.

| Method | Best for | How |
| --- | --- | --- |
| **UPM package** `com.ludeosdk.unity` | **Unity 6+** (the current package manifest is gated `unity: 6000.3`) | Package Manager → **+** → add by **git URL**, **tarball**, or **local path** (Ludeo provides the source). |
| **`.unitypackage`** | Unity 2021.3 → pre-6, or teams that prefer asset import; universal fallback | *Assets → Import Package → Custom Package* → select `LudeoSDK_Unity_v<version>.unitypackage`. |

> If the project's Unity is older than the package's `unity:` floor, use the `.unitypackage` (or an
> older package version that supports that Unity). Don't force a newer package onto an older editor.

### UPM via `manifest.json`
A UPM dependency is a line in `Packages/manifest.json`. The sample references a local path:
```json
{ "dependencies": { "com.ludeosdk.unity": "file:../path/to/com.ludeo.sdk", "...": "..." } }
```
For a real project use the **git URL** or **tarball/local path** Ludeo provides, e.g.
`"com.ludeosdk.unity": "https://…/com.ludeo.sdk.git#<tag>"`.

---

## 2. What the package brings (so you don't recreate it)

- **Runtime assembly** (`LudeoUnityAssembly.asmdef`) — `autoReferenced: true`, **no
  `defineConstraints`**. ⇒ once installed, `using LudeoSDK;` compiles **anywhere**, with **no asmdef
  reference and no scripting define** required.
- **Editor assembly** (`LudeoUnityEditorAssembly`) + `LudeoPostProcess` — an `AssetPostprocessor`
  that **auto-runs `SetupLudeoAssets()` when the SDK dll is imported** (creates the StreamingAssets
  it needs). Importing the package is enough; you don't hand-place runtime assets.
- **Native plugins** under `Plugins/` (`DotNET`, `x86`, `x86_64`). Ludeo capture targets **Windows
  desktop**; confirm platform support for any non-Windows target before promising it.
- **`Resources/LudeoUnityManager.prefab`** — the MonoBehaviour the SDK instantiates to **drive its
  own Tick** (CR-005). Do not recreate or tick manually.
- **`link.xml`** — protects SDK types from IL2CPP code stripping. Keep it; see §5.

---

## 3. Configure `LudeoSettings`

Settings live in a `LudeoSettings` ScriptableObject at
`Assets/LudeoSDK/Resources/LudeoSettings.asset`. Open/seed it via the editor menu:

> **Ludeo → Setup and Show LudeoSettings**

Fields (`LudeoSDK.UnityScripts.LudeoSettings`):

| Field | Purpose | Production |
| --- | --- | --- |
| `apiKey` | **Your game's Ludeo API key** | **Required** |
| `gameName`, `gameVersion` | Identify the game | Set both |
| `platformUrl` | Ludeo backend | Default `https://services.ludeo.com` |
| `ludeoLogLevel`, `ludeoLogCategory` | SDK logging | `Error` / `All` is a sane default |
| `coreDllReference` | `Release` or `Development` core dll | `Release` for shipping |
| `betaVersion` | Steam beta branch name | Match your Steam branch if used |
| `runWithoutLauncher` | **Dev only** — skip the launcher/Steam auth | **`false` in production** |
| `launcherUserId` | Dev no-launcher: your Steam id | Dev/testing only |
| `autoStartInLudeo` + `ludeoToAutoStart` | Dev: force a Ludeo to replay on init | Dev/testing only |

**Production vs. testing:**
- **Production:** set `apiKey` (+ `gameName`/`gameVersion`); leave `runWithoutLauncher = false` so
  the game authenticates through Steam/the launcher.
- **Local testing without Steam:** `runWithoutLauncher = true` and set `launcherUserId` to your
  Steam id. Use `autoStartInLudeo`/`ludeoToAutoStart` to force the play/restore flow on launch for
  iterating on restoration. **Never ship these on.**

### Dev/QA runtime overrides — change these without rebuilding

`LudeoSettings.asset` is baked into `resources.assets` at build time, so a shipped player can't change
it. QA teams iterating on a built (non-Editor) game need to flip the **dev triad** —
`runWithoutLauncher`, `launcherUserId`, `ludeoToAutoStart` — **per tester, without a rebuild each time.**

The sibling C++/proprietary skill solves this with a `ludeo.ini` next to the executable (its canonical
config source). Unity's model differs — the baked `.asset` stays the production source of truth (phase 13
asserts the baked `runWithoutLauncher` from the build log) — so the override is a **dev-only escape hatch,
gated so it can never affect a production build:**

1. **Add a `LUDEO_DEV` scripting define to your Development/QA build configs only** (Player Settings →
   Scripting Define Symbols). Production configs must **not** define it.
2. **Create the loader** `LudeoDevConfig.cs`, entirely inside `#if LUDEO_DEV` so it compiles out of
   production. It reads an external `ludeo-dev.ini` (key=value + `#` comments, same shape as the sibling's
   `ludeo.ini`) sitting **next to the player executable** and mutates the in-memory `LudeoSettings`
   instance **before** the package reads it:
   ```csharp
   // LudeoDevConfig.cs — DEV/QA ONLY. Compiles out entirely in production (no LUDEO_DEV define).
   #if LUDEO_DEV
   using System.IO; using UnityEngine; using LudeoSDK.UnityScripts;
   public static class LudeoDevConfig {
       // Call as the FIRST line of your bootstrap, BEFORE LudeoManager.InitLudeoSession.
       public static void ApplyOverrides() {
           var path = Path.Combine(Application.dataPath, "..", "ludeo-dev.ini"); // next to the .exe / SDK DLLs
           if (!File.Exists(path)) { Debug.Log($"[Ludeo][dev] no {path}; using LudeoSettings.asset as-is"); return; }
           var s = Resources.Load<LudeoSettings>("LudeoSettings");   // the SAME shared instance the package reads
           foreach (var raw in File.ReadAllLines(path)) {
               var line = raw; var h = line.IndexOf('#'); if (h >= 0) line = line.Substring(0, h);
               var eq = line.IndexOf('='); if (eq < 0) continue;
               var key = line.Substring(0, eq).Trim(); var val = line.Substring(eq + 1).Trim();
               switch (key) {
                   case "runWithoutLauncher": s.runWithoutLauncher = val.ToLower() == "true"; break;
                   case "launcherUserId":     s.launcherUserId     = val; break;
                   case "ludeoToAutoStart":   s.ludeoToAutoStart   = val; s.autoStartInLudeo = !string.IsNullOrEmpty(val); break;
                   default: continue;
               }
               Debug.Log($"[Ludeo][dev] override {key}={val}");
           }
       }
   }
   #endif
   ```
3. **Wire the single call site** — the first line of your bootstrap, before `InitLudeoSession`:
   ```csharp
   #if LUDEO_DEV
   LudeoDevConfig.ApplyOverrides();   // dev/QA only; the whole call compiles out of production
   #endif
   LudeoManager.InitLudeoSession(/* … */);
   ```
4. **Author `ludeo-dev.ini` with the *actual* QA values — do not ship placeholders.** Ask the user for
   the tester Steam id, whether to skip the launcher, and any Ludeo id to auto-replay, and write them in:
   ```ini
   # Ludeo DEV/QA overrides — applied ONLY in LUDEO_DEV builds, never production. key = value; '#' = comment.
   runWithoutLauncher = true          # true = skip Steam/launcher auth for local QA
   launcherUserId     = QA_TESTER_1   # Steam id/username to run as in no-launcher mode
   ludeoToAutoStart   =               # a Ludeo id to auto-replay on launch; blank = normal capture
   ```
5. **Ship `ludeo-dev.ini` to the build output** (a build post-process / copy step, same as any sidecar
   file). It only matters for `LUDEO_DEV` builds; a production build never reads it.

**Ordering caveat:** `runWithoutLauncher` + `launcherUserId` are consumed at `Activate()`, which your
integration layer owns, so overriding before `InitLudeoSession` is safe. `ludeoToAutoStart` /
`autoStartInLudeo` are read by the package's own `LudeoUnityManager`, which may initialize *before* your
bootstrap — if the auto-replay doesn't pick up the override, run `ApplyOverrides()` from a
`[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]` (earliest hook) or disable
the package's auto-start and trigger the replay yourself.

**Verify:** make a Development build with `LUDEO_DEV` defined, edit `ludeo-dev.ini`, launch, and confirm
the `[Ludeo][dev] override …` lines in `Player.log` (see `unity/READING-UNITY-LOGS.md`) *and* that the SDK
behaved per the file (e.g. authenticated as the overridden user). A production build (no `LUDEO_DEV`) must
show none of those lines.

---

## 4. Conditional compilation — only if you ship a build *without* the package

Because the runtime assembly is auto-referenced and unconstrained, **the default integration needs
no scripting define** — the SDK is simply present, and Ludeo is disabled at **runtime** via consent +
the dummy/disabled implementations (CR-001, CR-012).

Add a define **only** to support a build configuration that **excludes the SDK package entirely**
(e.g. an unsupported platform). Then:

1. Player Settings → **Scripting Define Symbols** (per build target), add e.g. `LUDEO_SDK` for
   configs that include the package; or use an `.asmdef` `versionDefines` keyed on
   `com.ludeosdk.unity` to auto-define it when the package is present.
2. Guard the SDK-typed code:
   ```csharp
   #if LUDEO_SDK
       ILudeoGameplaySessionManager mgr = new LudeoGameplaySessionManager(data);
   #else
       ILudeoGameplaySessionManager mgr = new DummyLudeoGameplaySessionManager(); // fallback type you own
   #endif
   ```
   The `#else` must reference only your own fallback types, never `LudeoSDK`.

> `versionDefines` is the clean way to do this: Unity sets the symbol automatically based on whether
> the package is in the project, so the same code compiles with or without it.

---

## 5. IL2CPP / platform notes

- **IL2CPP builds:** keep the package's `link.xml` (it prevents stripping of SDK types reached via
  native callbacks). If you maintain a project-level `link.xml`, don't remove Ludeo's entries.
- **Scripting backend:** Mono and IL2CPP both work; IL2CPP is typical for shipping. Verify a player
  build, not just the Editor.
- **Architecture:** native plugins ship for `x86`/`x86_64` — match your **Windows** build
  architecture. A missing/incompatible native dll surfaces at runtime as
  `LudeoResult.WrapperDllNotFound`.

---

## 6. Verify the install

- [ ] Package visible in **Package Manager** (or `Assets/LudeoSDK/` present for `.unitypackage`).
- [ ] `using LudeoSDK;` compiles in a project script with **no** added asmdef reference/define.
- [ ] `Resources/LudeoUnityManager.prefab` exists (the SDK tick driver).
- [ ] `LudeoSettings.asset` exists under `Assets/LudeoSDK/Resources/` with your `apiKey` set.
- [ ] A trivial `LudeoManager.InitLudeoSession(cb)` call reaches its callback with a `resultCode`
      (even a failure code proves the native layer loaded — `WrapperDllNotFound` means it didn't).

→ Next: `0-build-game-with-sdk.md` (phase 0) drives this end-to-end and confirms baseline + SDK builds.
