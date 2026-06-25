# UPM Install, LudeoSettings & (optional) Defines

How the Ludeo Unity plugin is added to a project and configured. Phase 0 uses this. Signatures and
types referenced are in [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md).

---

## 1. Get the plugin & install it

### Download the latest release (default source)
The plugin is published as GitHub releases at **https://github.com/ludeo-labs/unity-plugin-releases**
(public repo). Unless the user pinned a version, **download the latest release**:
```bash
# Public repo — no auth. Downloads the latest release's .zip into the current folder.
gh release download --repo ludeo-labs/unity-plugin-releases --pattern "*.zip"
```
No `gh`? Open `https://github.com/ludeo-labs/unity-plugin-releases/releases/latest` and download the
`.zip`, or resolve `…/releases/latest` via the GitHub API and fetch `assets[].browser_download_url`.

The asset is `Release_LudeoSDK_Unity_Plugin_v<version>.zip` (~250 MB). **Extract it** → it unpacks to
`Release/com.ludeo.sdk@<version>/` (a `Release/` parent + a version-suffixed folder, e.g.
`Release/com.ludeo.sdk@4.2.2/`), which **is** the UPM package: `package.json` → `name: com.ludeosdk.unity`,
`unity: 2019.4`. The release ships **one** UPM package supporting **Unity 2019.4+** (this skill is validated
for **2021.3 LTS+**); there is no `.unitypackage` asset and no git-URL install in the release.

### Choose the install method
Install the extracted package one of these ways:

| Method | Best for | Mutable? | How |
| --- | --- | --- | --- |
| **Local UPM package** — `file:` to the extracted **folder** (recommended) | Any supported Unity (2021.3 LTS+) | ✅ referenced **in place** | Add a `file:` line to `Packages/manifest.json`, or Package Manager → **+** → *Add package from disk* → the extracted folder's `package.json`. |
| **Embedded package** | Vendoring the package into the repo | ✅ | Copy the extracted `com.ludeo.sdk` folder into the project's `Packages/` directory. |
| **`.unitypackage`** | Only if Ludeo handed you one directly | ✅ (imports into `Assets/`) | *Assets → Import Package → Custom Package* → select the file. |

> **⚠️ Install the package *mutable*.** The plugin's editor setup writes back into its **own package
> files** (rewrites a constant in its source + edits the native DLL `.meta` importer settings), so a
> read-only install makes those writes **fail silently** and can misconfigure the core DLL. Unity's
> mutability is **not** uniform across install forms:
>
> | Install form | Mutable? |
> | --- | --- |
> | `file:` → a **folder** (the recommended path) | ✅ mutable, referenced in place |
> | Embedded folder under `Packages/` | ✅ mutable |
> | `file:` → a **`.tgz`** tarball | ❌ copied to read-only `Library/PackageCache` |
> | Git URL / registry | ❌ read-only `PackageCache` |
>
> Point `file:` at the **extracted folder**, never a tarball; avoid git-URL/registry installs.

### UPM via `manifest.json`
A local UPM dependency is a line in `Packages/manifest.json` pointing at the extracted package folder
(the one with `package.json` — i.e. `…/Release/com.ludeo.sdk@<version>`):
```json
{ "dependencies": { "com.ludeosdk.unity": "file:../path/to/Release/com.ludeo.sdk@<version>", "...": "..." } }
```
Keep the extracted folder somewhere stable (a temp dir breaks resolution later), and point `file:` at
the **folder**, not a `.tgz` — a tarball lands in the read-only `PackageCache` (see the mutability note
above). A pinned git URL (`"com.ludeosdk.unity": "https://…/com.ludeo.sdk.git#<tag>"`) resolves **if**
Ludeo grants repo access, but it is **immutable** (PackageCache); the release `.zip` extracted to a
folder is the supported default.

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
| `betaVersion` | Steam beta branch name — **required with `launcherUserId` when `runWithoutLauncher = true`** | Match your Steam branch if used |
| `runWithoutLauncher` | **Dev only** — skip the launcher/Steam auth | **`false` in production** |
| `launcherUserId` | Dev no-launcher: your Steam id — **must be paired with `betaVersion`** | Dev/testing only |
| `autoStartInLudeo` + `ludeoToAutoStart` | Dev: force a Ludeo to replay on init | Dev/testing only |

**Production vs. testing:**
- **Production:** set `apiKey` (+ `gameName`/`gameVersion`); leave `runWithoutLauncher = false` so
  the game authenticates through Steam/the launcher.
- **Local testing without Steam:** `runWithoutLauncher = true` and set **both** `launcherUserId` (your
  Steam id) **and** `betaVersion` (your Steam beta branch name) — no-launcher auth needs the pair, and
  `Activate` rejects if either is missing. Use `autoStartInLudeo`/`ludeoToAutoStart` to force the
  play/restore flow on launch for iterating on restoration. **Never ship these on.**

### Dev/QA runtime overrides — change these without rebuilding

`LudeoSettings.asset` is baked into `resources.assets` at build time, so a shipped player can't change
it. QA teams iterating on a built (non-Editor) game need to flip the **dev triad** —
`runWithoutLauncher`, `launcherUserId`, `ludeoToAutoStart` (plus `betaVersion`, required alongside
`launcherUserId` for no-launcher auth) — **per tester, without a rebuild each time.**

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
                   case "launcherUserId":     s.launcherUserId     = val; break;   // required with betaVersion in no-launcher mode
                   case "betaVersion":        s.betaVersion        = val; break;   // required with launcherUserId in no-launcher mode
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
   the tester Steam id, the Steam beta branch name (`betaVersion` — required alongside the Steam id in
   no-launcher mode), whether to skip the launcher, and any Ludeo id to auto-replay, and write them in:
   ```ini
   # Ludeo DEV/QA overrides — applied ONLY in LUDEO_DEV builds, never production. key = value; '#' = comment.
   runWithoutLauncher = true          # true = skip Steam/launcher auth for local QA
   launcherUserId     = QA_TESTER_1   # Steam id to run as in no-launcher mode — REQUIRED with betaVersion
   betaVersion        = public        # Steam beta branch name — REQUIRED with launcherUserId; auth rejects if either is missing
   ludeoToAutoStart   =               # a Ludeo id to auto-replay on launch; blank = normal capture
   ```
5. **Ship `ludeo-dev.ini` to the build output** (a build post-process / copy step, same as any sidecar
   file). It only matters for `LUDEO_DEV` builds; a production build never reads it.

**Ordering caveat:** `runWithoutLauncher` + `launcherUserId` + `betaVersion` are consumed at `Activate()`,
which your integration layer owns, so overriding before `InitLudeoSession` is safe. `ludeoToAutoStart` /
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
