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
(production settings gated, native layer self-contained, `validate-build` passing), then **publish** it to
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
      — the agent can't see the Console; the production-settings gate (Step 2) reads `Editor.log`.

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

### Step 2: Production-settings gate — assert `runWithoutLauncher = false` from the build log
A shipped build must authenticate against the Ludeo cloud (the platform is the launcher), so
`LudeoSettings.runWithoutLauncher` **must be `false`**. Left `true` (a local-testing flag), the build
ignores the cloud's launcher auth and **fails to authenticate** — invisibly, since it still runs fine
locally. **The project `.asset` value is only an inference of what got baked; read the value the build
actually used, from Unity's build log.**

The agent cannot see the Editor Console — read `Editor.log` per `READING-UNITY-LOGS.md`. For the value to
be *in* the log, a build-time hook must emit it. Ensure one exists (add it once if not — editor-only, ships
nothing):

```csharp
// Assets/<game>/Editor/LudeoBuildSettingsCheck.cs   — runs when the user builds, logs + hard-gates
using UnityEditor; using UnityEditor.Build; using UnityEditor.Build.Reporting; using UnityEngine; using LudeoSDK;
class LudeoBuildSettingsCheck : IPreprocessBuildWithReport {
    public int callbackOrder => 0;
    public void OnPreprocessBuild(BuildReport report) {
        var s = Resources.Load<LudeoSettings>("LudeoSettings");   // the same asset Unity is about to bake
        Debug.Log($"[Ludeo] build settings: runWithoutLauncher={s.runWithoutLauncher} " +
                  $"apiKeySet={!string.IsNullOrEmpty(s.apiKey)} autoStartInLudeo={s.autoStartInLudeo}");
        if (s.runWithoutLauncher)   // hard-fail so a mis-flagged artifact is never produced
            throw new BuildFailedException("[Ludeo] runWithoutLauncher must be FALSE for a shipped/cloud build.");
    }
}
```

After the user builds, grep the **latest** `Editor.log` for the `[Ludeo] build settings:` line and assert:
- **`runWithoutLauncher=False`** — if `True`, **stop**: have the user uncheck *Run Without Launcher* in
  **Ludeo → Setup and Show LudeoSettings**, rebuild, re-check. Do not validate or upload a `True` build.
- `apiKeySet=True` and `autoStartInLudeo=False` (autostart is a dev-only replay shortcut).

> The hook reads the asset the build is baking, so the logged value **is** the shipped value. The hard-fail
> makes a bad artifact impossible. The project-`.asset` grep (`runWithoutLauncher: 0`) is a fine *earlier*
> sanity check but is an inference — it misses build-time overrides + binary serialization, so it does not
> replace this.

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
- The build-time `LudeoBuildSettingsCheck` editor hook present (if it wasn't already).
- `run.bat` at the build root (used as the relative `--exec-path`).

## 7. ✅ Success Criteria

**Guideline phase-6 criteria:**
- [ ] **Pass all verification tests** — `runWithoutLauncher=False` asserted from the latest `Editor.log`
      (build-time hook, not inferred from the `.asset`); `apiKeySet=True`, `autoStartInLudeo=False`; build
      self-contained (native plugins shipped, deps resolved durably).
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
| **No `[Ludeo] build settings:` line** | The build-time hook isn't present (add the Step 2 script) or the log is stale; confirm it's the latest build's log. |
| **Validation FAIL** | Don't upload; fix per Step 3 (durable plugin/dep placement) and re-validate. |
| **`exec-path` not found** | Must be relative to `--local-directory` and the `run.bat` must exist there; re-run `validate-build` to (re)create it. |
| **Status stuck `pending` past timeout** | Report it (don't claim success); processing is slow/stuck. Re-poll later or check the studio. `failed`/`rejected` won't ready by waiting — surface the payload. |

## Related / Next

- Self-contained build prep + the **`validate-build`** skill (Step 3/Step 4); phase 0 installed the package.
- Phase 5 (`6-actions-orchestrator.md`) — the last integration content before verification.
- **Next:** phase 7 (polish & fix bugs). Otherwise **done** — the build is live on the Ludeo platform.
