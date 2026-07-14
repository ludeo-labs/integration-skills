# Phase 0 — Install SDK + Compile Baseline + Intake (Unity)

## 1. Goal / Purpose

Install the Ludeo Unity plugin, configure `LudeoSettings` (+ optional defines), confirm the project
compiles and plays **both before** the package (baseline) **and after** it (SDK-enabled), prove the
native layer loads, and **run the intake questionnaire**. There is no build script — the "build" is
the Unity Editor + an installed package. Deliverable: an installed, resolving SDK on a dedicated
branch; a verified baseline; and a recorded `INTAKE.md` (incl. game-level save-system classification).

## 2. Inputs (Input Contract)

Required artifacts / pre-flight:

- [ ] **Fresh agent session.** If you see prior tool calls, game analysis, or `CODE_MAP` references in
      this conversation, **STOP** and tell the user: *"This chat has prior context. For best results,
      start a fresh agent session and continue with phase 0 there."*
- [ ] **This is a Unity project** — `Assets/`, `ProjectSettings/`, `Packages/manifest.json`. If not,
      stop and point the user at the engine-appropriate skill.
- [ ] **Ludeo Unity plugin** obtained. **Default: download the latest release** from
      `https://github.com/ludeo-labs/unity-plugin-releases/releases/latest` — a public repo whose
      latest release is a single `.zip` containing the UPM package `com.ludeosdk.unity` (see Step 0b).
      Use a different source **only** if Ludeo explicitly hands you a specific build (a pinned tag, a
      private tarball, or a `.unitypackage`).
- [ ] **`apiKey`** obtained from the user (required for `LudeoSettings`).
- [ ] Context files read (§5).

## 3. Steps

> Map/plan sub-steps then implement. Every code change goes through a **compile & fix cycle** — see
> `phase 5` for the loop + the `error CS` table.

### Step 0a — Create an integration branch ⭐ FIRST
**Tell the user explicitly, before running the command, that you are about to create a new git branch
for the integration** — name the branch you'll create and note that all integration work will happen
there. Then create it:
```bash
git checkout -b feature/ludeo-integration-#1   # increment #N if it exists
```
All subsequent work happens here so the attempt can be discarded by deleting the branch.

### Step 0b — Download the plugin (latest release) ⭐
The plugin is published at **https://github.com/ludeo-labs/unity-plugin-releases** (public repo).
Unless the user pinned a version, **download the latest release**:
```bash
# Public repo — no auth. Downloads the latest release's .zip into the current folder.
gh release download --repo ludeo-labs/unity-plugin-releases --pattern "*.zip"
```
No `gh`? Open `https://github.com/ludeo-labs/unity-plugin-releases/releases/latest` and download the
`.zip` (or resolve `…/releases/latest` via the GitHub API → `assets[].browser_download_url`).

The asset is `Release_LudeoSDK_Unity_Plugin_v<version>.zip` (~250 MB). **Extract it** → it unpacks to
`Release/com.ludeo.sdk@<version>/` (a `Release/` parent + a version-suffixed folder, e.g.
`Release/com.ludeo.sdk@4.2.2/`), and **that folder is the UPM package** — its `package.json` has
`name: com.ludeosdk.unity`. The release ships **one** UPM package (no `.unitypackage` asset, no git-URL
install); it supports **Unity 2019.4+** and this skill is validated for **2021.3 LTS+**.
- `Glob("**/ProjectSettings/ProjectVersion.txt")` to record the project's Unity version; report it and
  confirm with the user. If Ludeo handed you a `.unitypackage` instead, use the *Import Package* path in Step 1.

### Step 0c — Baseline (the "without SDK" compile)
Before touching anything: confirm the project compiles in the Editor and the game plays **as-is**.
This is the guideline's *"compiles without the SDK enabled"* criterion — for Unity that means the
**pre-install** state (the package is auto-referenced and disable-is-runtime; there is no compile
toggle). Note the baseline so later failures are attributable to the integration.

### Step 1 — Install the package (the "with SDK" compile)
Install the **extracted** package (from Step 0b) one of two ways — put the extracted folder somewhere
stable first (alongside the project, not a temp dir, so the `file:` path keeps resolving):
- **Local UPM package (recommended):** point `Packages/manifest.json` at the extracted package folder
  (the one containing `package.json`):
  `"com.ludeosdk.unity": "file:<path-to-extracted>/Release/com.ludeo.sdk@<version>"` — or Package
  Manager → **+** → *Add package from disk* → pick that folder's `package.json`.
- **Embedded package:** copy the extracted `Release/com.ludeo.sdk@<version>` folder into the project's `Packages/` directory.
- **`.unitypackage` (only if Ludeo gave you one):** *Assets → Import Package → Custom Package* → select the file.
- The package is **auto-referenced** — after install, `using LudeoSDK;` must compile in a project
  script with **no** asmdef reference and **no** scripting define. `LudeoPostProcess` auto-creates
  the SDK's StreamingAssets on import.

### Step 2 — Configure `LudeoSettings`
- Open via **Ludeo → Setup and Show LudeoSettings** (creates/pings `LudeoSettings.asset` under
  `Assets/LudeoSDK/Resources/`).
- Set `apiKey` (required), `gameName`, `gameVersion`.
- **`runWithoutLauncher` is the implicit/explicit auth toggle** (the only auth switch — the plugin
  marshals the auth struct from it; no per-call `authDetails` like C++):
  - **Production (Steam) → `false` (implicit).** Supply **no** id (leave `launcherUserId` empty); the
    SDK auto-detects Steam but **does not init it** — Steam must be up before `Activate` or it returns
    `InvalidAuth`. Set the real Steam **app id** (not `0`). **Dev flags off.** Implicit auth is a
    code-ordering concern (gate `Activate`) and can't be validated from a cloud build — detail in
    `unity/UPM-INSTALL-AND-DEFINES.md §3-4`.
  - **Testing / CI without Steam → `true` (explicit).** Set `launcherUserId` (a Steam id); no Steam
    needed. Optionally `autoStartInLudeo` + `ludeoToAutoStart` to force the replay flow on launch.
- **⚠️ A shipped/cloud build MUST have `runWithoutLauncher = false`.** Left `true`, the build still
  runs locally but **fails to authenticate on the Ludeo cloud** (the platform is the launcher) — an
  invisible ship-blocker. The flag is baked into `resources.assets` at build time, so the project
  value is only an *inference* of what ships; `phase 13` asserts the **actual baked value from the
  build log** before upload. Full field reference: `unity/UPM-INSTALL-AND-DEFINES.md §3`.
- **QA/dev builds that must change `runWithoutLauncher` / `launcherUserId` / `ludeoToAutoStart` without
  rebuilding:** the baked `.asset` can't do this. Set up the `LUDEO_DEV`-gated dev-override shim
  (`unity/UPM-INSTALL-AND-DEFINES.md` → *Dev/QA runtime overrides*): a `ludeo-dev.ini` next to the build +
  a loader applied before `InitLudeoSession`. **Gather the real QA values from the user and seed the file
  with them** — don't leave placeholders. Production builds (no `LUDEO_DEV`) ignore it, so phase 13's baked
  `runWithoutLauncher` gate stays authoritative.

### Step 3 — Verify with the package installed
The project still **compiles** and the game still **plays** (package present, unused). Confirms the
package didn't break the baseline.

### Step 3.5 — Run the intake questionnaire ⭐
Fill `ludeo-integration-plan/INTAKE.md` (template in §6) with the user. Answer with `file:line`
evidence where it comes from code; mark unknowns `?`; **ask** the human-only items (§4). Three parts:

1. **Game + Ludeo profile** — identity, genre (→ a `game-patterns/*.md` match), engine/render
   pipeline/scripting backend, target platform, auth, and the **Ludeo concept** (what a good highlight
   moment is; what the player should experience when launching a Ludeo; typical length; the player
   actions that matter most).
2. **Launch model ⭐** — a **product choice** (not inferable from code alone) that selects the startup
   flow the integration builds. Two **independent** axes — ask both; a game can be boot-straight for
   creation but gallery-based for replay, or vice-versa:
   - **Creator launch** — does a normal (capture) session start through a **main menu / level-select**,
     or does the game **boot straight into gameplay** (first scene auto-starts a run, no menu between)?
   - **Player (Ludeo) launch** — does a player enter a replay via an **in-game gallery**
     (`LudeoSelected` mid-app), or is the app **launched preselected** and boots straight into the
     replay (`isLudeoSelected` at `Activate`; the `autoStartInLudeo` dev flag in Step 2 is the test
     harness for this), or **both**?

   > If either axis is "boot-straight" / "launched preselected" — **or** the creator launch is
   > menu-gated but the menu is fast/skippable — the integration needs the **SDK-readiness gate**
   > (`unity/LAUNCH-AND-READINESS.md`): the menu can no longer be relied on to absorb the async
   > Activate + consent latency before the first creator `OpenRoom`. Record the answer; phase 1
   > cross-checks it against the code (`CODE_MAP.launch_model`), and phases 2–4 build the gate.
3. **Save-system classification (game level)** — run the greps and assign the group:
   - `Grep("PlayerPrefs\\.")`, `Grep("JsonUtility|JsonConvert|\\[Serializable\\]|\\[SerializeField\\]")`,
     `Grep("ScriptableObject")`, `Grep("BinaryFormatter|BinaryWriter|MemoryStream|byte\\[\\]")`,
     `Grep("Save|Load|Serialize|Deserialize|Checkpoint|Persist")` (exclude tests),
     `Grep("Addressables|AssetBundle")`.
   - **Mechanism** (PlayerPrefs / JsonUtility / Json.NET / ScriptableObject / BinaryFormatter /
     custom / none), **format** (named-fields / opaque-blob / mixed / none), **group**:
     **1** full gameplay-state save · **2** checkpoint/partial · **3** none (settings/scores only).
   - ⚠️ **A strong save ≠ reconciliation.** Group is about *coverage*; reconciliation is about
     *format*. A Group-1 game that saves via `BinaryFormatter`/packed bytes is still **manual** per
     entity. **Transition/streaming caches** (`CacheScene`/`Persist*`, interior↔exterior, Addressables
     hand-off) hold partial deltas — they are **not** the canonical save; find the real Save/Load path.
   - **The per-entity reconciliation-vs-manual matrix is NOT built here** — it needs
     `CODE_MAP.object_model` (phase 1). It is produced in the object-mapping phase (`phase 8`). Record
     only the game-level classification + save-entry-points now.

### Step 4 — Smoke-test the native layer
Add a throwaway bootstrap call and confirm it reaches its callback.

> **⚠️ `InitLudeoSession` is NOT an inert probe — do not auto-fire it in the Editor.** It instantiates
> `LudeoUnityManager` (`DontDestroyOnLoad`) and brings up Ludeo's overlay / native layer (cohtml),
> which **hooks the OS cursor/input**. The Editor does **not** tear that native layer down when you stop
> play mode, so initializing it in the Editor can leave the **cursor hidden/hooked across the entire
> Editor** after a single play-stop (worse when the game also hides its own cursor — many do). The
> symptom only shows *after* you stop play, so it reads as "did the integration break my Editor?". This
> is a preview of **CR-007** (`00-CRITICAL-REQUIREMENTS.md`): the native/overlay layer is not released
> on stop, which is exactly why phase 4 must route **every** gameplay exit through clean
> `End`/`Abort` + SDK teardown.

The smoke test has two legs — the **Editor** and a **player build** (IL2CPP + native plugins differ
from the Editor). **Never use a bare auto-firing init** (`[RuntimeInitializeOnLoadMethod]` with no
guard) — it re-inits the overlay every play and can hook the Editor cursor. Use the **player-only gated
snippet** as the canonical shape:

```csharp
// Throwaway smoke test — DELETE once both legs pass. Player-build only; never inits Ludeo in the Editor.
[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
private static void LudeoSmokeTest()
{
    if (Application.isEditor) return;                                   // [Unity] don't hook the Editor cursor/input
    LudeoManager.InitLudeoSession(data =>                              // [SDK]
        Debug.Log($"[Ludeo] init result: {data.resultCode}"));         // [Unity] Debug.Log
}
```

- **Editor leg — fire it once, manually, then stop.** Trigger a single init from a `[MenuItem]` button
  (or one hand-invoked call), read the log, confirm a `resultCode`, then **stop play immediately**. Do
  **not** leave an init auto-firing in the Editor. As soon as this leg returns a `resultCode`, **delete
  the Editor trigger.**
- **Player-build leg — often deferred** (first IL2CPP builds run ~30–60 min). The gated snippet above
  auto-fires **only in the built player**, so it's safe to leave in for that one build without ever
  touching the Editor cursor. Run the build, confirm the `resultCode` in `Player.log`.
- **Read the result from Unity's log** — the agent can't see the Editor Console. Follow
  `ludeo-integration-docs/unity/READING-UNITY-LOGS.md` (read `Editor.log` / `Player.log`, or run
  headless with `-logFile`) and grep for `[Ludeo]` / `WrapperDllNotFound`.
- Any `resultCode` proves the native plugin loaded. **`WrapperDllNotFound`** means it did not — a
  platform/plugin/build problem; fix before continuing (`04-BUILD-INTEGRATION.md`).
- **Delete the throwaway entirely once both legs pass** — the real init lives in the layer (phase 4).

### Step 5 — (moved to phase 6) Verify the player build is self-contained
> **Moved to guideline phase 6 (verification & cloud)** — `references/13-upload-build.md` Step 3–4. The
> self-contained check (native plugins shipped, 3rd-party deps resolved durably) + the `validate-build`
> gate run at upload time, not at install. Phase 0's job ends at a **clean Editor + player-build smoke test**
> (Step 4 above): an `InitLudeoSession` callback with a `resultCode` (not `WrapperDllNotFound`). Upload
> readiness is phase 6's concern.

## 4. Questions to ask the human

Only what can't be inferred from code:
- **Plugin version** — default is the **latest** release from
  `github.com/ludeo-labs/unity-plugin-releases`; ask only whether they need a specific pinned version
  or were given a custom build (private tarball / `.unitypackage`).
- **`apiKey`**, `gameName`, `gameVersion`.
- **Auth mode** — implicit Steam (`runWithoutLauncher = false`, production; needs Steam initialized
  before `Activate`) vs explicit no-Steam (`runWithoutLauncher = true` + `launcherUserId`, testing/CI).
  Steam appId if applicable.
- **Ludeo concept** (intake §) — what makes a good highlight moment in this game; what the player
  should experience when launching a Ludeo; typical Ludeo length; which player actions matter most.
- **Launch model** (intake §) — menu-gated vs. boot-straight-to-gameplay for a capture session; and
  whether a Ludeo is entered via an in-game gallery or launched preselected. A product choice — ask;
  don't infer it solely from the current first scene.
- Anything the save-system greps leave ambiguous (does the game persist *gameplay* state or only
  settings/scores; full snapshot vs checkpoint).

## 5. Patterns to apply

- **Auto-referenced package** — no asmdef wiring; `using LudeoSDK;` resolves with no define.
- **Disable is runtime, not a macro (CR-001)** — do not add a `LUDEO_SDK` scripting define unless you
  must ship a build that excludes the package (`unity/UPM-INSTALL-AND-DEFINES.md §4`).
- **Don't recreate or tick `LudeoUnityManager` (CR-005)** — the package ships it and ticks the SDK.
- **Current platform only** (Ludeo capture is Windows-desktop); Debug/Editor first, then a player build.

Context files (read first; relative to this workflow file):
- `ludeo-integration-docs/04-BUILD-INTEGRATION.md` — the Unity build model + verification.
- `ludeo-integration-docs/unity/UPM-INSTALL-AND-DEFINES.md` — install methods, `LudeoSettings`, defines.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (disable is runtime), CR-005.
- `ludeo-integration-docs/unity/READING-UNITY-LOGS.md` — reading Unity's logs (Step 4 smoke test).

## 6. Output Contract

| Artifact | Purpose |
| --- | --- |
| `feature/ludeo-integration-#N` branch | Isolates the attempt; discard by deleting the branch |
| Installed package; `using LudeoSDK;` compiles | SDK resolves with no extra wiring |
| `LudeoSettings.asset` with real `apiKey` | SDK config; dev flags appropriate for the build |
| `ludeo-integration-plan/INTAKE.md` | Recorded intake (below) |
| `CODE_MAP.json → save_system` (game-level block) | Mechanism/format/group + entry points; per-entity matrix deferred to `phase 8` |

`INTAKE.md` template:
```markdown
# Ludeo Integration — Intake (<GameName>)

## Game + Ludeo profile
- Name / studio:
- Genre / sub-genre:                 (→ game-patterns/<match>.md)
- Single-player / multiplayer:
- Core loop (1–2 sentences):
- Unity version / render pipeline / scripting backend (Mono | IL2CPP):
- Target platform (Ludeo capture = Windows desktop):
- Auth: apiKey set? · gameName/gameVersion · Steam appId? · runWithoutLauncher: false=implicit/Steam (prod) | true+launcherUserId=explicit (testing/CI)
- Ludeo concept:
  - What is a good highlight moment in this game?
  - What should the player experience when launching a Ludeo (the restored moment)?
  - Typical Ludeo length (seconds):
  - Which player actions matter most (early action candidates)?

## Launch model
- Creator launch: menu-gated | boot-straight-to-gameplay
- Player (Ludeo) launch: in-game gallery | launched preselected (autoStartInLudeo) | both
- SDK-readiness gate required? yes (boot-straight / preselected / fast-skippable menu) | no (slow click-through menu)
- Notes: <existing splash/loading screen the gate's "ready" cover can reuse; any forced auto-start at boot>

## Save-system classification (game level)
- Mechanism: PlayerPrefs | JsonUtility | Json.NET | ScriptableObject | BinaryFormatter | custom | none
- Format:    named-fields | opaque-blob | mixed | none
- Group:     1 (full gameplay-state) | 2 (checkpoint/partial) | 3 (none — settings/scores only)
- Save/load entry points (file:line):
- Notes (transition/streaming caches found, ambiguities):
- ⚠ Per-entity reconciliation-vs-manual matrix → built in phase 8 (needs the object model).
```

`save_system` block added to `CODE_MAP.json` (created here; `per_entity` filled in `phase 8`):
```json
"save_system": {
  "mechanism": "PlayerPrefs | JsonUtility | Json.NET | ScriptableObject | BinaryFormatter | custom | none",
  "format": "named-fields | opaque-blob | mixed | none",
  "group": 1,
  "save_entry_points": [{ "file": "...", "class_method": "...", "line": "..." }],
  "per_entity": []
}
```

## 7. ✅ Success Criteria

The gate — satisfy all before advancing to phase 1.

**Guideline phase-0 criteria:**
- [ ] SDK references resolve — `using LudeoSDK;` compiles with no asmdef/define.
- [ ] Project compiles **with** the SDK (package installed; baseline intact).
- [ ] Project compiles **without** the SDK (the pre-install baseline — Step 0c).
- [ ] Intake questionnaire answered and recorded (`INTAKE.md` + `CODE_MAP.json` `save_system` block),
      **incl. the launch model** (creator + player axes; whether the SDK-readiness gate is required).

**Skill-specific additions:**
- [ ] Integration branch created (`feature/ludeo-integration-#N`).
- [ ] Unity version detected; install method chosen + confirmed.
- [ ] `LudeoSettings.asset` present with a real `apiKey`; dev flags appropriate for the build.
- [ ] `InitLudeoSession` reaches its callback with a `resultCode` (not `WrapperDllNotFound`), in the
      **Editor and a player build**.
- [ ] _(Self-contained build + `validate-build` — **moved to phase 6**, `13-upload-build.md` Step 3–4.)_

## 8. Common Mistakes

- **Adding a `LUDEO_SDK` define** "to be safe" — disable is runtime; the package is auto-referenced.
- **Recreating or ticking `LudeoUnityManager`** — the package ships and ticks it (CR-005).
- **Hand-copying the native dll** into the build — no `.meta`, breaks on the next build; reimport.
- **Leaving `runWithoutLauncher = true`** for a shipped/cloud build — auth silently fails on the cloud.
- **Misclassifying a strong-but-opaque save as reconciliation** — `BinaryFormatter`/packed bytes is
  **manual** per entity regardless of how complete the save is.
- **Treating a transition/streaming cache as the canonical save** — it holds partial deltas only.
- **Building the per-entity restore matrix now** — defer to `phase 8`; the object model doesn't exist yet.
- **Leaving an auto-running `InitLudeoSession` smoke test active in the Editor** — a bare
  `[RuntimeInitializeOnLoadMethod]` re-inits the Ludeo overlay every play and can leave the OS cursor
  hooked across the Editor after you stop. Gate it player-only (`if (Application.isEditor) return;`) or
  remove it once the smoke test passes.

## Related / Next

- Guides: `ludeo-integration-docs/04-BUILD-INTEGRATION.md`, `unity/UPM-INSTALL-AND-DEFINES.md`.
- **Next:** `phase 1` (map the Unity project → `CODE_MAP.json`).
