# Phase 6 — Verification & Cloud (Unity)

> **Single sequential phase — not orchestrated.** Verification and upload are one coupled, outward-facing,
> human-gated procedure: a build that fails any gate must **never** be uploaded, so gating + validation +
> upload belong together in one flow. The user makes the build; the agent verifies and (only on explicit
> confirmation) uploads.
>
> **Legend:** `[SDK]` = Ludeo package API · `[Layer]` = prescribed façade · `[Unity]` = engine API.

> 🛑 **NEVER UPLOAD WITHOUT EXPLICIT USER CONFIRMATION — no exceptions.** Uploading publishes to Ludeo's
> cloud; it is outward-facing and not trivially reversible. The agent does **not** run the real upload on
> its own. After a successful `--dry-run`, **present the exact final upload command and STOP** — either the
> user types an explicit go-ahead and you run it, or the user copies the command and runs it in their own
> terminal. A successful dry-run, a green validation, or prior approval of an *earlier* step is **not**
> upload approval. If in doubt, do not upload.

## 1. Goal / Purpose

Take the **release player build** (the user triggers it in the Editor), **verify** it is upload-ready
(release settings gated — no Development/Debug build, no debug flags or cheats reachable; production auth
gated; native layer self-contained; `validate-build` passing), then **publish** it to
the Ludeo platform with the `ludeo` CLI and **poll** the build status to `ready`/`success`. This is the
final phase — when it passes, the build is live on the platform.

## 2. Inputs (Input Contract)

- [ ] **Phase 5 complete** — the integration is done (lifecycle, tracking & restore proven, actions wired)
      and compiles.
- [ ] A **release player build folder** exists — **the user triggers the build in the Unity Editor**
      (current platform; Ludeo capture is Windows-desktop). The agent does **not** drive the Editor build.
- [ ] The **`validate-build`** user-level skill (the self-contained gate; also writes `run.bat`).
- [ ] The **`ludeo` CLI** reachable — verify with `ludeo --help`. If not installed/located, **ask the user**
      to install it or for the path to the binary; do **not** invent a download source.
- [ ] A Ludeo **access token** and the game's **Game Version ID** (from the Ludeo studio/platform). Ask if
      not provided.
- [ ] [`ludeo-integration-docs/unity/READING-UNITY-LOGS.md`](ludeo-integration-docs/unity/READING-UNITY-LOGS.md)
      — the agent can't see the Console; the release-build gate (Step 2) reads `Editor.log`.

**Inputs to gather (ask if missing):**

| Input | Used for | Notes |
| --- | --- | --- |
| **Build folder path** | `validate-build` + `--local-directory` | Absolute path to the release build folder. |
| **Game Version ID** | `--game-id` | The API path ID from Ludeo studio — **not** a build "id". |
| **Game version** | `--game-version` | e.g. `1.2.3`. Default to `LudeoSettings.gameVersion` if set. |
| **SDK version** | `--sdk-version` | **Confirm with the user — do NOT trust the package manifest.** Builds often use a swapped/overridden SDK, so the manifest can lie. Not needed for `sdkFree` builds. |
| **Access token** | `auth set-token` / `--access-token` | Only if not already authenticated. |
| **Changes description** | `--changes-description` | **Default to a non-empty value** — infer from context (Step 7). If you can't, ask; leave empty only if the user chooses to. |

## 3. Steps

### Step 1: Have the user make the release build
**Prompt the user to make the release build themselves** in the Unity Editor (*File → Build Settings →
Build*, or their usual pipeline) and tell them you'll take it from there. (Don't drive the Editor build
yourself.) With the Step 2 hard-fail hook in place, even "Build And Run" aborts before producing an
artifact when `runWithoutLauncher = true` — that's the gate firing, not a separate problem.

### Step 2: Release-build gate — assert production + release settings from the build log
**Layer the defense — no single check is sufficient.** A shipped/cloud build must (a) authenticate against
the Ludeo cloud (so `LudeoSettings.runWithoutLauncher` **must be `false`** — left `true` it silently fails
auth on the cloud while running fine locally) and (b) be a genuine **release** build — not Development mode,
not a Debug C++ config, no debug/profiler hooks. **Never trust the Build Settings checkboxes** (*Development
Build* is the #1 forgotten toggle). Read the *actual, baked* build options in a build-time hook and
**hard-fail** — a thrown `BuildFailedException` aborts the build **before an artifact exists**, so a
mis-flagged build can't even be produced.

The agent cannot see the Editor Console — read `Editor.log` per `READING-UNITY-LOGS.md`. The hook both
**logs** the baked values (so you can assert from the log) and **throws** on any non-release setting. Ensure
one exists (add/extend once — editor-only, ships nothing):

```csharp
// Assets/<game>/Editor/LudeoBuildSettingsCheck.cs — runs when the user builds; logs baked values + hard-gates.
using System.Linq;
using UnityEditor; using UnityEditor.Build; using UnityEditor.Build.Reporting; using UnityEngine; using LudeoSDK;
class LudeoBuildSettingsCheck : IPreprocessBuildWithReport {
    public int callbackOrder => 0;
    public void OnPreprocessBuild(BuildReport report) {
        var opts    = report.summary.options;                                    // the ACTUAL baked options
        var group   = BuildPipeline.GetBuildTargetGroup(report.summary.platform);
        bool dev       = (opts & BuildOptions.Development)         != 0;
        bool profiler  = (opts & BuildOptions.ConnectWithProfiler) != 0;
        bool scriptDbg = (opts & BuildOptions.AllowDebugging)      != 0;          // "Script Debugging"
        var  backend   = PlayerSettings.GetScriptingBackend(group);
        var  cppConfig = PlayerSettings.GetIl2CppCompilerConfiguration(group);    // Debug | Release | Master
        var  s         = Resources.Load<LudeoSettings>("LudeoSettings");          // the same asset Unity is baking

        // One log line per fact → assert these from Editor.log (READING-UNITY-LOGS.md).
        Debug.Log($"[Ludeo] build gate: developmentBuild={dev} connectProfiler={profiler} scriptDebugging={scriptDbg} " +
                  $"waitForManagedDebugger={EditorUserBuildSettings.waitForManagedDebugger} backend={backend} " +
                  $"il2cppConfig={cppConfig} runWithoutLauncher={s.runWithoutLauncher} " +
                  $"apiKeySet={!string.IsNullOrEmpty(s.apiKey)} autoStartInLudeo={s.autoStartInLudeo} " +
                  $"version={PlayerSettings.bundleVersion}");

        // Hard-fails — abort before an artifact exists. (Switch the cppConfig target to Master if that's your ship config.)
        if (dev)       throw new BuildFailedException("[Ludeo] Development Build must be OFF for a shipped build.");
        if (profiler)  throw new BuildFailedException("[Ludeo] Autoconnect Profiler must be OFF for a shipped build.");
        if (scriptDbg) throw new BuildFailedException("[Ludeo] Script Debugging must be OFF for a shipped build.");
        if (EditorUserBuildSettings.waitForManagedDebugger)
                       throw new BuildFailedException("[Ludeo] 'Wait For Managed Debugger' must be OFF for a shipped build.");
        if (backend == ScriptingImplementation.IL2CPP && cppConfig == Il2CppCompilerConfiguration.Debug)
                       throw new BuildFailedException("[Ludeo] IL2CPP C++ config must be Release/Master, not Debug.");
        if (s.runWithoutLauncher)
                       throw new BuildFailedException("[Ludeo] runWithoutLauncher must be FALSE for a shipped/cloud build.");

        // Layer 3 — data-driven debug flags: ASSERT off, never auto-fix (auto-fix hides the mistake + dirties assets).
        // Allowlist legitimate non-default config so you don't clobber intentional values. Confirm names with the user.
        // var cfg = Resources.Load<GameDebugConfig>("GameDebugConfig");
        // if (cfg != null && (cfg.cheatsEnabled || cfg.debugMenu || cfg.verboseLogging || cfg.autoLaunchShortcut))
        //     throw new BuildFailedException($"[Ludeo] Debug flags on in {cfg.name}: turn them off for a Release build.");
    }
}
```

> **Unity 6+ API note:** the `BuildTargetGroup` overloads of `GetScriptingBackend` /
> `GetIl2CppCompilerConfiguration` are deprecated in favour of the `NamedBuildTarget` ones
> (`NamedBuildTarget.FromBuildTargetGroup(group)`) — swap them if you hit a deprecation warning; behaviour
> is identical. Verify any API here against the project's actual Unity version.

After the user builds, grep the **latest** `Editor.log` for `[Ludeo] build gate:` and assert the release
posture: `developmentBuild=False`, `connectProfiler=False`, `scriptDebugging=False`,
`waitForManagedDebugger=False`, `il2cppConfig=Release` (or `Master`), `runWithoutLauncher=False`,
`apiKeySet=True`, `autoStartInLudeo=False`. Any deviation ⇒ **stop**, have the user fix the setting
(*Development Build* / *Run Without Launcher* live in Build Settings / **Ludeo → Setup and Show
LudeoSettings**), **rebuild**, re-read the log — do not validate or upload.

> **Verify the baked value, not the source (Layer 4).** The hook reads what the build is actually baking, so
> the logged value **is** the shipped value. A project-`.asset` grep (`runWithoutLauncher: 0`) is a fine
> *earlier* sanity check but only an inference — it misses build-time overrides + binary serialization, so it
> does **not** replace the log assertion.

### Step 2.5: Make debug features release-safe by default (cheats, debug menus, verbose logging)
The Step 2 hook is the **backstop**. The **most robust** layer is to gate debug behavior on the build
**type**, not on a hand-toggled data flag — so a release build *cannot* run debug features even if a setting
is forgotten. A cloud build is played by **end users (Ludeo viewers), not developers**; anything still
reachable is **live on the public machine** — it corrupts captures (a cheated session yields an invalid
Ludeo), exposes internal UI, and is an abuse surface. The game owns these features, so the agent **audits
and confirms** — it does not delete the game's systems.

1. **Discover the dev affordances.** `Grep("cheat|godmode|noclip|debugmenu|devconsole|spawnitem|giveall|levelskip|freecam", -i)`
   (exclude tests), `Grep("Debug\\.isDebugBuild|DEVELOPMENT_BUILD")`, plus in-game consoles / `OnGUI` debug
   panels / debug-only keybinds. Ask the user what cheats/debug menus exist and how they're gated.
2. **Gate them on the build type at the read site (strongest).** Wrap cheats, debug menus, and verbose
   logging in `if (Debug.isDebugBuild) { … }` or `#if DEVELOPMENT_BUILD … #endif`. `Debug.isDebugBuild` is
   true **iff** Development Build, so a release build literally can't run them — release-safe becomes the
   default. The cost is touching each read site; it's worth it. A runtime `if (cheatsOn)` flag still **ships
   the code** and can be reached — not sufficient on its own.
3. **For flags that genuinely live in data** (ScriptableObject / PlayerPrefs defaults), the Step 2 hook
   **asserts** them off for a Release build and **throws** — it does **not** auto-fix. Auto-fixing hides the
   mistake and dirties source assets. **Allowlist** legitimate non-default config so the assertion doesn't
   clobber intentional values (e.g. a deliberate starting state set for a purpose); confirm the flag/field
   names with the user before wiring the assert.
4. **CI is the real guarantee (Layer 7).** A developer's manual *Build Settings* click should never be able
   to produce a shipping artifact. Where the project has (or can add) CI, ship only from a headless
   `-batchmode -executeMethod <BuildMethod>` build that sets `BuildPlayerOptions` explicitly (GUI checkbox
   state irrelevant) and runs these gates. Flag this to the user as the durable fix; the build hook protects
   manual builds in the meantime.

**Anti-patterns to flag if you see them:** relying on checkbox memory; one ScriptableObject mixing real
config with debug flags, hand-edited each release; blanket "reset to defaults" release profiles that clobber
legitimate non-default config; trusting the source asset value over the baked one; auto-fixing instead of
failing loud.

### Step 3: Verify the build is self-contained (upload-readiness)
> Moved here from phase 0 §5. The thing you upload is the **player build
> folder**, so the native layer must travel *with it* — not merely resolve on your dev machine. A
> `resultCode` smoke test can pass on your box yet fail on a clean machine if a transitive dep is missing.

1. **Confirm Ludeo's own natives shipped.** Check `<Game>_Data/Plugins/` (e.g. `x86_64/`) in the build
   output contains the native plugin(s) Unity copied from the package. If absent, the package's plugins
   lack correct platform `.meta` import settings — **reimport the package; never hand-copy the dll** (a raw
   copy has no `.meta`, so Unity won't place it and it breaks on the next build).
2. **Resolve 3rd-party deps *on demand* — only what this build needs:**
   - **Config-driven:** Steam (`steam_api64.dll`, plus `steam_appid.txt` for dev) is required only if
     `runWithoutLauncher = false` (production auth) **or** the game already integrates Steamworks. With
     `runWithoutLauncher = true` it is not needed (but a shipped build must have it `false` — Step 2).
   - **Dependency-driven (if a walker is available):** list the actual imports of the Ludeo native dll —
     `dumpbin /dependents <dll>`, `Dependencies.exe`, or `llvm-readobj --needed-libs`. Ignore known
     OS/system DLLs; flag the rest.
   - **No walker installed:** fall back to the config checklist + the `validate-build` run below.
3. **Fix durably, don't one-off copy.** Place any genuinely missing artefact via a **durable build step**
   — import it as a Unity plugin with correct platform `.meta`, or a post-build copy the project owns. A
   manual copy into the build folder is discarded on the next rebuild.
4. **Scan the output folder for debug artifacts (Layer 6 — post-build signals).** Independent of the build
   hook, the folder itself betrays a dev build — flag and **stop** (rebuild as release) on any of:
   - `<Game>_Data/boot.config` containing `player-connection-debug` or `wait-for-managed-debugger`
     ⇒ a Development Build slipped through.
   - `*_BurstDebugInformation_DoNotShip` / `*_BackUpThisFolder_ButDontShipItWithYourGame` folders, or loose
     `.pdb` files ⇒ debug artifacts that must not ship — remove + rebuild release.
   - dev-only native dll variants present ⇒ wrong C++/config.
   This is a static scan of what's in the folder; `validate-build` (Step 4) complements it by launching the exe.

### Step 4: `validate-build` hard gate
Run the **`validate-build`** skill on the build folder. It detects the engine, checks the expected Unity
files, **launches the build from inside its own folder** to prove it's self-contained (no missing-DLL/asset
crash), and **ensures a `run.bat` exists** (creating one when you approve).
- **If validation FAILs, stop** — fix the build (re-export / durable plugin placement per Step 3), then
  re-validate. Never upload a build that didn't pass.
- **Ensure `run.bat` is present at the build root** — the entry point Ludeo launches (the `.bat`-not-`.exe`
  rule, §5). If `validate-build` only `WARN`ed it's missing, create it now.

### Step 5: Locate the CLI and authenticate
1. `ludeo --help` — confirm the CLI is reachable and learn the current command set (the CLI evolves;
   **trust `--help` over any commands quoted here**). If not found, ask the user to install it / give the path.
2. `ludeo auth status` — if not authenticated, `ludeo auth set-token` (ask the user for the token) or pass
   `--access-token` on each call. Tokens are stored in `~/.ludeo/config.json`.

### Step 6: Decide build type — minor by default, major only on the first build
A **major** build stands alone; a **minor** build is a variant attached to an existing major
(`--major-build-id`).
```bash
ludeo builds list --game-id <GAME_VERSION_ID> --sort-by createdAt --sort-order desc
```
- **No builds returned ⇒ first build ⇒ `--build-type major`** (no `--major-build-id`).
- **Builds already exist ⇒ default to `--build-type minor`**, with `--major-build-id <id>` = the major it
  attaches to (normally the latest major in the list). Confirm with the user if ambiguous.

### Step 7: Dry-run the upload (preview, no changes)
Provide **all** required flags so the command is **non-interactive** (an interactive prompt hangs the
tool). Point `--exec-path` at the **`run.bat`, as a path relative to `--local-directory`** (§5), and
**default `--runtime-environment` to `proton`** — Ludeo's cloud runs the Windows build under Proton (Linux).
Use another value only if the user confirms a different target.

**Always pass a non-empty `--changes-description`.** Infer a short, concrete summary from context — the
phase-4 reconstruction summary, the git log since the last build/tag, or what this build changed (e.g.
`"Initial Ludeo integration: capture + restore"` for a first build, `"Fix restore freeze on replay"` for a
minor). If nothing can be inferred, ask the user; leave empty only if they explicitly choose to. Include
it in **both** the dry-run and the real command.

```bash
# First build (major):
ludeo builds upload --dry-run \
  --game-id <GAME_VERSION_ID> \
  --game-version <X.Y.Z> \
  --sdk-version <SDK_X.Y.Z> \
  --build-type major \
  --changes-description "<what this build is — inferred or user-provided>" \
  --local-directory "<BUILD_FOLDER>" \
  --exec-path "run.bat" \
  --runtime-environment proton

# Subsequent build (minor) — add the major it attaches to:
ludeo builds upload --dry-run \
  --game-id <GAME_VERSION_ID> \
  --game-version <X.Y.Z> \
  --sdk-version <SDK_X.Y.Z> \
  --build-type minor --major-build-id <MAJOR_BUILD_ID> \
  --changes-description "<what changed>" \
  --local-directory "<BUILD_FOLDER>" \
  --exec-path "run.bat" \
  --runtime-environment proton
```
`--dry-run` validates the parameters + directory structure and lists every file (and total size) that would
upload, **without** creating metadata or uploading. Review the file list + resolved flags **with the user**.

### Step 8: Present the upload command and WAIT for explicit confirmation 🛑
The real upload is the **same command as Step 7 without `--dry-run`**. Do **not** run it autonomously.
Once the dry-run is clean:
1. **Display the exact, fully-resolved command** (all flags filled in, no placeholders) in a code block
   **in the same message that asks for approval**. If you ask again later, re-display the command.
2. **STOP and wait.** Either the user confirms explicitly (an unambiguous go-ahead) → you run that exact
   command; or they run it themselves → you resume at Step 9 once they say it's uploaded.

A clean dry-run / passing validation / approval of an earlier step is **not** upload approval (top banner).
The upload finishing means the **files landed**; the platform then processes the build, so its status starts
at **`pending`**. Grab the **new build id** from the upload output (or `builds list`, top entry).

### Step 9: Poll the build status until it flips `pending` → `success`
A finished upload is not a finished build. Poll `builds get` until status leaves `pending` — **don't report
success on the upload alone.**
```powershell
# Windows / PowerShell — one self-contained command (polls internally; do not hand-loop with sleeps)
$ludeo  = "ludeo"                      # or the full path to ludeo.exe if not on PATH
$gameId = "<GAME_VERSION_ID>"; $buildId = "<NEW_BUILD_ID>"
$deadline = (Get-Date).AddMinutes(7)   # platform processing cap (see "Open task" below — builds can get stuck)
do {
    $out = & $ludeo builds get --game-id $gameId --build-id $buildId | Out-String
    # Read the Status FIELD, not the whole blob — avoids false-positives on incidental words.
    $status = if ($out -match '(?im)^\s*Status:\s*(\S+)') { $matches[1] } else { '?' }
    if     ($status -match '(?i)^(success|ready)$')         { Write-Host "✅ Build DONE (status=$status)"; break }
    elseif ($status -match '(?i)^(failed|error|rejected)$') { Write-Host "❌ Build FAILED:`n$out"; break }
    else   { Write-Host "… status=$status; re-checking in 15s"; Start-Sleep -Seconds 15 }
} while ((Get-Date) -lt $deadline)
```
- **Confirm the status token on the first poll.** The observed terminal done-token is **`success`** (the
  line reads `Status: success`); `ready` is matched too for tolerance, but a current CLI does **not** emit
  `ready` — matching only `ready` makes the loop never detect completion. Eyeball the first output and adjust
  the `^\s*Status:\s*(\S+)` extraction if the field/value differs (`Status:` vs JSON `"status"`).
- **Terminal states:** `success` (or `ready`) ⇒ done (playable). `failed`/`rejected` ⇒ stop + report the
  payload (won't ready by waiting). Still `pending` at the deadline ⇒ report that, don't claim success.
- **Poll, don't busy-wait:** a fixed interval (~15s) inside one command with an overall timeout.

> **🚧 OPEN TASK — split this single `pending → ready` poll into the two real post-upload phases**
> (verification then distribution), each polled separately with **its own timeout** (a build can stall in
> either). For now it's a single poll with a 7-minute cap as a stopgap. Confirm the per-phase status
> tokens/fields against a real `ludeo builds get` before wiring this.

### Step 10: Verify the final build metadata
Once `success`, confirm it's the build you intended:
```bash
ludeo builds list --game-id <GAME_VERSION_ID> --sort-by createdAt --sort-order desc   # new build at top
ludeo builds get  --game-id <GAME_VERSION_ID> --build-id <NEW_BUILD_ID>                # status + metadata
```
Confirm status **`success`** and that `game-version`, `sdk-version`, build type, and `exec-path` (the
`run.bat`) are what you intended.

> **⚠️ Known gap — "ludeo runs in cloud" is not yet verified here.** The guideline lists *ludeo run in
> cloud* as a phase-6 criterion. This skill currently treats **status `success`/`ready`** (the platform
> processed the build and can run Ludeos from it) as the bar — there is **no discrete step that actually
> runs/plays a Ludeo in the cloud** to confirm it. Leave this as an explicit gap to fill later (a CLI
> command or platform action), per the team decision (2026-06-17). Do not fabricate a cloud-run step.

## 4. Questions to ask the human

- **Build folder path**, **Game Version ID**, **game version**, **access token** — if not provided.
- **SDK version** — always **confirm with the user**; the package manifest can lie (builds use swapped SDKs).
- **Changes description** — if it can't be inferred from context.
- **Which major** a minor build attaches to — if ambiguous.
- **Developer features** (Step 2.5) — does the game have cheats / a debug console / debug menus, how are
  they gated, and which build setting or scripting define disables them for the release build?

## 5. Patterns to apply

- 🛑 **Never upload without explicit user confirmation** (top banner) — present the final command after a
  clean dry-run, then wait; run only on an explicit go-ahead, or let the user run it.
- **The user makes the build; the agent doesn't drive the Editor build** — prompt them, then take over.
- **Run path is the `run.bat`, not the `.exe` — always.** Register the `.bat` as `--exec-path`; it does
  `cd /d "%~dp0"` then starts the exe, so the build runs from its own folder regardless of the launcher's
  working directory (the property `validate-build` proves). A raw `.exe` exec-path can break path-relative assets.
- **`--exec-path` is local and relative to `--local-directory`** — a path *inside* the build folder
  (`run.bat`, or `sub\dir\run.bat` if nested), **not** absolute.
- **Runtime environment defaults to `proton`** — Ludeo's cloud runs the Windows build under Proton (Linux);
  the runtime-environment describes how Ludeo runs it. Override only if the user confirms a different target.
- **Verify commands against `ludeo --help` / `ludeo builds upload --help`** — the CLI changes; the flags
  here are a snapshot, not the authority.
- **Modification builds are not supported from the CLI** (Studio Labs only). The CLI does `new` (default) and
  `sdkFree` builds; use `--build-creation-type sdkFree` (no `--sdk-version`) only for no-SDK perf builds.

## 6. Output Contract

- A **published build** on the Ludeo platform at status **`success`**, with the intended `game-version`,
  `sdk-version`, build type, and `run.bat` exec-path.
- The build-time `LudeoBuildSettingsCheck` editor hook present (if it wasn't already), hard-gating the
  release posture: *Development Build*, Autoconnect Profiler, Script Debugging, Wait-For-Managed-Debugger,
  IL2CPP Debug C++ config, `runWithoutLauncher`, and any data-driven debug flags (allowlisted).
- **Debug features release-safe by default** — cheats / debug menus / verbose logging gated on
  `Debug.isDebugBuild` or `#if DEVELOPMENT_BUILD` (not a runtime flag), so a release build can't run them;
  what was audited/disabled recorded in the verification notes. CI-headless build flagged as the durable fix.
- `run.bat` at the build root (used as the relative `--exec-path`).

## 7. ✅ Success Criteria

**Guideline phase-6 criteria:**
- [ ] **Pass all verification tests** — the `[Ludeo] build gate:` line in the latest `Editor.log` (build-time
      hook, not inferred from the `.asset`) shows `developmentBuild=False`, `connectProfiler=False`,
      `scriptDebugging=False`, `waitForManagedDebugger=False`, `il2cppConfig=Release`/`Master`,
      `runWithoutLauncher=False`, `apiKeySet=True`, `autoStartInLudeo=False`; build self-contained (native
      plugins shipped, deps resolved durably) with no debug artifacts in the output folder (Step 3 Layer-6 scan).
- [ ] **Debug features release-safe by default** (Step 2.5) — cheats / debug menus / verbose logging gated on
      `Debug.isDebugBuild` or `#if DEVELOPMENT_BUILD`, and any data-driven debug flags asserted off (allowlisted,
      not auto-fixed), so none are reachable on the cloud; audited + confirmed.
- [ ] **`validate-build` PASS** on the release build folder (self-contained; launches from its own folder).
- [ ] **Build uploaded via the `ludeo` CLI** — after a reviewed dry-run and **explicit user confirmation**.
- [ ] **Platform status polled to `ready`** — i.e. `success` (the observed terminal token; `ready` tolerated);
      `failed`/timeout surfaced if it never completes.
- [ ] **Ludeo run in cloud** — ⚠️ **GAP** (Step 10): treated as satisfied by status `success` for now; no
      discrete cloud-run verification exists yet. To be filled later.

**Skill-specific additions:**
- [ ] `run.bat` present at the build root and used as the relative `--exec-path`.
- [ ] `ludeo` CLI reachable (`--help`) and authenticated (`auth status`).
- [ ] Build type correct: **major on the first build**, **minor otherwise** (with `--major-build-id`).
- [ ] **Release build made by the user** in the Editor; the agent took over after.
- [ ] `--sdk-version` **confirmed with the user** (not trusted from the manifest).
- [ ] `--changes-description` non-empty (inferred or user-supplied) — empty only if the user chose so.
- [ ] `--dry-run` reviewed (file list + resolved flags) and confirmed with the user.
- [ ] **Final upload ran ONLY after explicit user confirmation** (or the user ran it themselves) — never autonomously.
- [ ] Final `builds get` confirms status `success` + correct `game-version`/`sdk-version`/build type/`exec-path`.

## 8. Common Mistakes

- **Uploading without explicit confirmation** — the cardinal sin (top banner). A clean dry-run is not approval.
- **Trusting the manifest for `--sdk-version`** — builds use swapped SDKs; confirm with the user.
- **Reporting success on upload completion** — the upload only lands files; poll `builds get` to `success`.
- **Inferring `runWithoutLauncher` from the project `.asset`** — read the baked value from the build log.
- **Trusting the Build Settings checkbox** — *Development Build* is the #1 forgotten toggle; read the baked
  `report.summary.options` in the hook and hard-fail (Step 2), don't rely on memory or the GUI state.
- **Shipping cheats / a debug console reachable on the cloud** — gate them on `Debug.isDebugBuild` /
  `#if DEVELOPMENT_BUILD` at the read site (Step 2.5); a runtime hide-flag still ships the code.
- **Shipping a Development/Debug build** — Development Build, Autoconnect Profiler, Script Debugging, or an
  IL2CPP Debug C++ config on the cloud machine; the Step 2 hook hard-fails each.
- **Auto-fixing debug config instead of failing loud** — mutating the asset hides the mistake and dirties
  source; assert + throw, and allowlist legitimate non-default values so you don't clobber them.
- **Uploading a build that failed `validate-build`** — fix + re-validate first; never upload a failed gate.
- **Registering the `.exe` as `--exec-path`** instead of the relative `run.bat`.
- **Driving the Editor build yourself** — the user makes the build; you verify + upload.
- **Hand-copying a missing dll into the build folder** — it's discarded next rebuild; fix durably (Step 3).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **CLI not found** | Ask the user to install the Ludeo CLI or provide its path; don't guess a source. |
| **Auth / 401** | `ludeo auth status`; re-`set-token` (token expired or wrong env). |
| **Command hangs on input** | A required flag is missing → interactive mode. Supply all required flags (incl. `--game-version`/`--sdk-version`/`--build-type`) or add `--no-interactive`. |
| **Minor rejected for missing major** | `--build-type=minor` needs `--major-build-id`; get it from `builds list`. |
| **`runWithoutLauncher=True` in build log** | Won't authenticate on cloud (runs locally, so invisible). Uncheck *Run Without Launcher*, **rebuild**, re-read the log. Don't edit the build folder — the value is baked in `resources.assets`. |
| **`developmentBuild=True` / `connectProfiler=True` / `scriptDebugging=True` / `il2cppConfig=Debug`** | A debug/dev build slipped through. Fix the offending Build/Player setting, **rebuild**, re-read the `[Ludeo] build gate:` line (Step 2). |
| **Cheats / debug console reachable on the cloud** | Gate them on `Debug.isDebugBuild` / `#if DEVELOPMENT_BUILD` at the read site (Step 2.5); for data-driven flags, assert off in the hook (allowlisted). Rebuild + re-verify. |
| **`boot.config` has `player-connection-debug` / `*_DoNotShip` folders / loose `.pdb`** | Debug artifacts in the output (Step 3 Layer-6 scan). Rebuild as release / remove them; never upload. |
| **No `[Ludeo] build gate:` line** | The build-time hook isn't present (add the Step 2 script) or the log is stale; confirm it's the latest build's log. |
| **Validation FAIL** | Don't upload; fix per Step 3 (durable plugin/dep placement) and re-validate. |
| **`exec-path` not found** | Must be relative to `--local-directory` and the `run.bat` must exist there; re-run `validate-build` to (re)create it. |
| **Status stuck `pending` past timeout** | Report it (don't claim success); processing is slow/stuck. Re-poll later or check the studio. `failed`/`rejected` won't ready by waiting — surface the payload. |

## Related / Next

- Self-contained build prep + the **`validate-build`** skill (Step 3/Step 4); phase 0 installed the package.
- Phase 5 (`6-actions-orchestrator.md`) — the last integration content before verification.
- **Next:** phase 7 (polish & fix bugs). Otherwise **done** — the build is live on the Ludeo platform.
