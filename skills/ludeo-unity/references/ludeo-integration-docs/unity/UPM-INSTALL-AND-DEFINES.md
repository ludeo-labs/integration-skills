# UPM Install, LudeoSettings & (optional) Defines

How the Ludeo Unity plugin is added to a project and configured. Phase 1 uses this. Signatures and
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
| `betaVersion` | Steam beta branch name | **Explicit auth only** (`runWithoutLauncher = true`). In implicit mode the SDK reads the branch from the live Steam client; this field is not read. |
| `runWithoutLauncher` | **The implicit/explicit auth toggle** (see below) | **`false` (implicit) in production** |
| `launcherUserId` | Explicit-auth (`runWithoutLauncher = true`) user id | Set only in explicit mode |
| `autoStartInLudeo` + `ludeoToAutoStart` | Dev: force a Ludeo to replay on init | Dev/testing only |

### Auth is one toggle — `runWithoutLauncher` (implicit vs. explicit)

`runWithoutLauncher` is the **only** auth switch. The Unity plugin builds and marshals the auth
struct for you from this flag — there is **no per-call `authDetails` argument** like the C++ SDK, so
the C++ struct-lifetime pitfalls do not apply here. Auth is resolved **at `Activate` time**, not at
init.

- **`false` (default) = implicit auth — the production Steam path.** You supply **no** id; leave
  `launcherUserId` empty. The SDK auto-detects the loaded Steamworks DLL and pulls the user identity
  itself. **The SDK does *not* initialize Steamworks** — your game must have Steam **already
  initialized and running before `Activate`**, or activation completes with
  `LudeoResult.InvalidAuth`. This is a **code-ordering** requirement, not just a setting: Steam often
  initializes **late/async** (a login scene, via a Steam wrapper) while the SDK bootstraps early, so
  **don't call `Activate` inline — gate it on a game-owned "auth ready" signal** with a bounded
  fallback (see [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md) → "Implicit auth: gate
  Activate on Steam-ready" and [`../05-LIFECYCLE-MANAGEMENT.md`](../05-LIFECYCLE-MANAGEMENT.md)
  "Startup sequence"). In implicit mode, `betaVersion` in `LudeoSettings` is not read — the SDK picks
  up the active beta branch from the live Steam client automatically.
- **`true` = explicit auth — testing / CI / no-Steam.** You supply `launcherUserId` (a Steam user
  id) and the SDK authenticates as that user **without Steam running**. Optionally set `betaVersion`
  to match your Studio Lab environment.

**Don't confuse the two:** enabling `runWithoutLauncher` for a Steam build switches it *out* of
implicit mode and makes it send a supplied-id auth struct — leave it **off** (and `launcherUserId`
empty) for implicit Steam auth.

> **⚠️ Implicit-auth precheck — the App-ID-0 landmine.** Cloud builds never touch Steam, so the Steam
> **app id** is easily left at the placeholder **`0`** in *both* `steam_appid.txt` (next to the
> executable) **and** the Steam wrapper's settings asset (e.g. Steamworks.NET's settings asset). With
> app id `0`, `SteamAPI_Init` fails **even with the Steam client running**, and implicit `Activate`
> then returns `InvalidAuth`. Before testing implicit auth: set the **real** app id in **both** places,
> and **restart the Editor** after editing `steam_appid.txt` (it's read once at startup).

**Production vs. testing:**
- **Production (Steam):** set `apiKey` (+ `gameName`/`gameVersion`); leave `runWithoutLauncher =
  false` (implicit). Ensure Steam is initialized before `Activate`.
- **Local testing / CI without Steam:** `runWithoutLauncher = true` with a Steam id + beta branch —
  supplied by the dev build's `LudeoConfig.ini` (below), **not** baked into the asset. Use `autoStartInLudeo`/`ludeoToAutoStart` to force the play/restore flow on launch for
  iterating on restoration. **Never ship these on.** Headless/CI builds have no Steam client, so
  default them to explicit (or skip Ludeo activation) — otherwise they all fail with `InvalidAuth`.
- **Ludeo Cloud:** the cloud infrastructure handles environment selection and authentication — you
  do **not** configure Steam or auth settings for cloud instances. The implicit-auth Steam-init
  requirement above is for Steam builds on the player's machine.

### `LudeoConfig.ini` — the dev build's Ludeo config, next to the executable (DEFAULT, every integration)

`LudeoSettings.asset` is baked into `resources.assets` at build time, so a built player can't change it.
But a local dev/QA build has to sign in **as a tester** (`runWithoutLauncher = true` + a Steam id + a
beta branch), while the asset the cloud build ships must stay in launcher posture with **no** Steam id
baked in (phase 7). Without a file the built game reads, the only way to give a dev build an identity is
to bake a Steam id into the asset — which then leaks into every build — or to rebuild per tester.

So **every Unity integration ships a `LudeoConfig.ini` reader. This is a default step, not an option:**
phase 1 creates the loader and seeds the file, phase 3 calls it, phase 7 keeps it out of the upload. It
matches the sibling C++ skill's `ludeo.ini` and is the same file name across every Ludeo Unity game, so
a tester can move between games without relearning it.

**Production safety comes from the build type, not a custom define:** the reader applies the file only
in a **Development Build** (`Debug.isDebugBuild`). Phase 7 already refuses to upload a Development
Build, so the shipped cloud build can never be re-pointed by a stray ini; it logs an error instead and
runs on its baked settings. The dev/QA build therefore **must be a Development Build** — that is what
turns the reader on.

1. **Create the loader** `LudeoConfigFile.cs` in the integration folder (always compiled — no `#if`
   around the file or its call):
   ```csharp
   // LudeoConfigFile.cs — reads LudeoConfig.ini next to the .exe and applies it to the in-memory LudeoSettings.
   using System; using System.IO; using UnityEngine; using LudeoSDK.UnityScripts;
   public static class LudeoConfigFile {
       public const string FileName = "LudeoConfig.ini";
       // Call as the FIRST thing your bootstrap does, BEFORE LudeoManager.Initialize().
       public static void Apply() {
   #if UNITY_EDITOR
           return;                                  // the Editor plays against the asset; never a stray ini
   #else
           var path = Path.GetFullPath(Path.Combine(Application.dataPath, "..", FileName)); // next to the .exe
           if (!File.Exists(path)) { Debug.Log($"[Ludeo] config: no {FileName}; using the built-in settings"); return; }
           if (!Debug.isDebugBuild) {               // the release (upload) build: never re-pointed by a file
               Debug.LogError($"[Ludeo] config: {FileName} found in a RELEASE build and IGNORED; remove it from the upload folder");
               return;
           }
           var s = LudeoSDK.LudeoUnityHelpers.GetLudeoSettings();  // the SAME instance Initialize() copies
           if (s == null) { Debug.LogError($"[Ludeo] config: no LudeoSettings in Resources; {FileName} ignored"); return; }
           bool runWithoutLauncher = s.runWithoutLauncher; string steamUser = null, betaBranch = null;
           foreach (var raw in File.ReadAllLines(path)) {
               var line = raw; var h = line.IndexOf('#'); if (h >= 0) line = line.Substring(0, h);
               var eq = line.IndexOf('='); if (eq < 0) continue;
               var key = line.Substring(0, eq).Trim(); var val = line.Substring(eq + 1).Trim();
               switch (key) {
                   case "runWithoutLauncher": runWithoutLauncher = val.Equals("true", StringComparison.OrdinalIgnoreCase) || val == "1"; break;
                   case "steamUser":   case "launcherUserId": steamUser  = val; break;  // REQUIRED with betaBranch
                   case "betaBranch":  case "betaVersion":    betaBranch = val; break;  // REQUIRED with steamUser
                   case "platformUrl": s.platformUrl = val; break;
                   case "apiKey":      s.apiKey      = val; break;
                   case "gameVersion": s.gameVersion = val; break;
                   case "ludeoToAutoStart": s.ludeoToAutoStart = val; s.autoStartInLudeo = val.Length > 0; break;
                   default: Debug.LogWarning($"[Ludeo] config: unknown key '{key}' ignored"); break;
               }
           }
           s.runWithoutLauncher = runWithoutLauncher;
           if (runWithoutLauncher) {                // launcher-free sign-in = Steam user + beta branch
               if (steamUser  != null) s.launcherUserId = steamUser;
               if (betaBranch != null) s.betaVersion    = betaBranch;
           }
           Debug.Log($"[Ludeo] config: applied {path}: runWithoutLauncher={s.runWithoutLauncher} " +
                     $"steamUser={s.launcherUserId} betaBranch={s.betaVersion} platformUrl={s.platformUrl}");
           if (s.runWithoutLauncher && (string.IsNullOrEmpty(s.launcherUserId) || string.IsNullOrEmpty(s.betaVersion)))
               Debug.LogError("[Ludeo] config: runWithoutLauncher=true needs BOTH steamUser and betaBranch; sign-in will be refused");
   #endif
       }
   }
   ```
   If the integration has its own logger (e.g. a `LudeoTrace`), use it instead of `Debug.Log*` — keep the
   `config:` lines greppable. If the project already marks its cloud build with its own define, you may
   gate on that as well, but keep the `Debug.isDebugBuild` gate: it is what phase 7 enforces.
2. **Wire the single call site** — the first line of your bootstrap, before `LudeoManager.Initialize()`
   (no `#if`):
   ```csharp
   LudeoConfigFile.Apply();            // before Initialize: the SDK copies LudeoSettings ONCE, there
   LudeoManager.Initialize();
   LudeoManager.SessionManager.CreateSession(out var session);
   ```
3. **Leave the asset in cloud posture.** With the reader in place, `LudeoSettings.asset` keeps
   `launcherUserId` **empty** in the project; the tester identity lives only in the dev build's ini.
4. **Seed `LudeoConfig.ini` with the *actual* values — never placeholders.** Ask the user for the tester's
   Steam id (17 digits) and the beta branch / beta code of their Studio Lab environment, and write them:
   ```ini
   # Ludeo configuration for this build. Read once at launch, before the SDK starts.
   # 'key = value', '#' starts a comment. Delete the file to use the built-in values.
   # Applied only in a Development Build; a release (upload) build ignores it.

   # true: no launcher - sign in as the steamUser/betaBranch below. Local testing only.
   runWithoutLauncher = true

   # Both are REQUIRED when runWithoutLauncher = true; the sign-in is refused if either is missing.
   steamUser  = 7656119XXXXXXXXXX
   betaBranch = <beta code from Studio Lab>

   # Optional: platformUrl, apiKey, gameVersion, ludeoToAutoStart (a Ludeo id to replay on launch).
   ```
   (The two `X`/`<…>` values above are the slots the user fills — the file you write has their real values.)
5. **Put it in every dev build folder, durably.** Unity does not delete unknown files on a rebuild, so a
   file placed once survives — but a fresh output folder starts without it. Either keep a copy as
   `LudeoConfig.dev.ini` at the project root (git-ignored if it holds a personal Steam id) and copy it to
   `<build folder>/LudeoConfig.ini` from an `IPostprocessBuildWithReport` **only when
   `report.summary.options` has `BuildOptions.Development`**, or write it once by hand after the first dev
   build and tell the user where it is. **Never copy it into a release build.**

**Ordering caveat:** the package copies `LudeoSettings` into its internal config **once**, inside
`LudeoManager.Initialize()` — everything (`runWithoutLauncher`, `launcherUserId`, `betaVersion`,
`platformUrl`, `apiKey`, `autoStartInLudeo`/`ludeoToAutoStart`) is read there, and a change made after it
is silently ignored. Call `Apply()` first. If your SDK init runs from a `MonoBehaviour.Awake` that can
precede your bootstrap, call `Apply()` from a `[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]` (or
`BeforeSplashScreen`) hook instead.

**Verify:** make the Development build, put the ini next to the exe, launch from the build folder, and
confirm in `Player.log` (see `unity/READING-UNITY-LOGS.md`) the `[Ludeo] config: applied …` line with the
tester's Steam id, followed by `Initialize`/`CreateSession` success and **`Activate` succeeding** (that is
the sign-in). In the release build, the same ini must produce the `IGNORED` error line and no `applied`
line.

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

### A second, separate axis — the game's Steam wrapper (not the Ludeo package)

Distinct from the package define above: a game that ships **both** a player-facing **Steam** build and a
**Ludeo Cloud** build typically compiles its **Steam wrapper** out of the cloud build (e.g. a project
define like `STEAMWORKS_OFF`, alongside a `LUDEO_BUILD`). Keep this axis separate from the
package-present axis above — it's about *Steam*, not about the *Ludeo SDK*. It directly shapes auth:

- **Real Steam build** → implicit auth → **gate `Activate` on Steam-ready**
  ([`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md) → "Implicit auth: gate Activate on
  Steam-ready"). The Steam-gated call site sits behind `#if STEAMWORKS_NET && !STEAMWORKS_OFF`.
- **Cloud build (Steam compiled out)** → the cloud supplies the token → the `#else` branch calls
  `Activate` **immediately** (no Steam to wait for) and must not reference the Steam wrapper.

So there are **three auth modes** — implicit/Steam, explicit/`launcherUserId`, cloud-token — and they
interact with this define. **Consequence: you cannot validate implicit auth from the cloud build or the
cloud flow** — implicit auth is only ever exercised by building the real Steam config. (Define names
are illustrative; use your project's.)

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
- [ ] A trivial `LudeoManager.Initialize()` call returns a `LudeoResult` (even a failure code proves
      the native layer loaded — `WrapperDllNotFound` means it didn't).

→ Next: `1-build-game-with-sdk.md` (phase 1) drives this end-to-end and confirms baseline + SDK builds.
