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
- [ ] **Ludeo Unity plugin source** is known — a UPM package (`com.ludeosdk.unity`) **or** a
      `.unitypackage`, delivered by Ludeo as a git URL / tarball / local path / file. If the user
      hasn't said where it is, **ask** (§4). Do not invent a download location.
- [ ] **`apiKey`** obtained from the user (required for `LudeoSettings`).
- [ ] Context files read (§5).

## 3. Steps

> Map/plan sub-steps then implement. Every code change goes through a **compile & fix cycle** — see
> `phase 5` for the loop + the `error CS` table.

### Step 0a — Create an integration branch ⭐ FIRST
```bash
git checkout -b feature/ludeo-integration-#1   # increment #N if it exists
```
All subsequent work happens here so the attempt can be discarded by deleting the branch.

### Step 0b — Detect Unity version → choose install method
- `Glob("**/ProjectSettings/ProjectVersion.txt")` for the version (skill floor: **2021.3 LTS**).
- **Unity 6+** → UPM package `com.ludeosdk.unity` (manifest gated `unity: 6000.3`).
- **2021.3 → pre-6** → `.unitypackage` (or an older package version that supports that editor).
- Report the version and chosen method; confirm with the user.

### Step 0c — Baseline (the "without SDK" compile)
Before touching anything: confirm the project compiles in the Editor and the game plays **as-is**.
This is the guideline's *"compiles without the SDK enabled"* criterion — for Unity that means the
**pre-install** state (the package is auto-referenced and disable-is-runtime; there is no compile
toggle). Note the baseline so later failures are attributable to the integration.

### Step 1 — Install the package (the "with SDK" compile)
- **UPM:** add the dependency to `Packages/manifest.json` (Package Manager → **+** → git URL /
  tarball / local path), e.g. `"com.ludeosdk.unity": "<url-or-path>"`.
- **`.unitypackage`:** *Assets → Import Package → Custom Package* → select the file.
- The package is **auto-referenced** — after install, `using LudeoSDK;` must compile in a project
  script with **no** asmdef reference and **no** scripting define. `LudeoPostProcess` auto-creates
  the SDK's StreamingAssets on import.

### Step 2 — Configure `LudeoSettings`
- Open via **Ludeo → Setup and Show LudeoSettings** (creates/pings `LudeoSettings.asset` under
  `Assets/LudeoSDK/Resources/`).
- Set `apiKey` (required), `gameName`, `gameVersion`.
- **Testing without Steam** → `runWithoutLauncher = true`, set `launcherUserId` (their Steam id);
  optionally `autoStartInLudeo` + `ludeoToAutoStart` to force the replay flow on launch.
- **Production** → `runWithoutLauncher = false` (auth via Steam/launcher); **dev flags off**.
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
evidence where it comes from code; mark unknowns `?`; **ask** the human-only items (§4). Two parts:

1. **Game + Ludeo profile** — identity, genre (→ a `game-patterns/*.md` match), engine/render
   pipeline/scripting backend, target platform, auth, and the **Ludeo concept** (what a good highlight
   moment is; what the player should experience when launching a Ludeo; typical length; the player
   actions that matter most).
2. **Save-system classification (game level)** — run the greps and assign the group:
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
Add a throwaway bootstrap call and confirm it reaches its callback:
```csharp
LudeoManager.InitLudeoSession(data =>                                   // [SDK]
    Debug.Log($"[Ludeo] init result: {data.resultCode}"));             // [Unity] Debug.Log
```
- **Read the result from Unity's log** — the agent can't see the Editor Console. Follow
  `ludeo-integration-docs/unity/READING-UNITY-LOGS.md` (read `Editor.log`, or run headless with
  `-logFile`) and grep for `[Ludeo]` / `WrapperDllNotFound`.
- Any `resultCode` proves the native plugin loaded. **`WrapperDllNotFound`** means it did not — a
  platform/plugin/build problem; fix before continuing (`04-BUILD-INTEGRATION.md`).
- Verify in the **Editor** *and* a **player build** (IL2CPP + native plugins differ from the Editor).
- Remove the throwaway call before moving on (the real init lives in the layer, phase 4).

### Step 5 — (moved to phase 6) Verify the player build is self-contained
> **Moved to guideline phase 6 (verification & cloud)** — `references/13-upload-build.md` Step 3–4. The
> self-contained check (native plugins shipped, 3rd-party deps resolved durably) + the `validate-build`
> gate run at upload time, not at install. Phase 0's job ends at a **clean Editor + player-build smoke test**
> (Step 4 above): an `InitLudeoSession` callback with a `resultCode` (not `WrapperDllNotFound`). Upload
> readiness is phase 6's concern.

## 4. Questions to ask the human

Only what can't be inferred from code:
- **Package source** — git URL / tarball / local path / `.unitypackage` file.
- **`apiKey`**, `gameName`, `gameVersion`.
- **Auth mode** — local testing without Steam (`runWithoutLauncher = true`) vs production
  (Steam/launcher). Steam appId if applicable.
- **Ludeo concept** (intake §) — what makes a good highlight moment in this game; what the player
  should experience when launching a Ludeo; typical Ludeo length; which player actions matter most.
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
- Auth: apiKey set? · gameName/gameVersion · Steam appId? · runWithoutLauncher (dev) | launcher (prod)
- Ludeo concept:
  - What is a good highlight moment in this game?
  - What should the player experience when launching a Ludeo (the restored moment)?
  - Typical Ludeo length (seconds):
  - Which player actions matter most (early action candidates)?

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
- [ ] Intake questionnaire answered and recorded (`INTAKE.md` + `CODE_MAP.json` `save_system` block).

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

## Related / Next

- Guides: `ludeo-integration-docs/04-BUILD-INTEGRATION.md`, `unity/UPM-INSTALL-AND-DEFINES.md`.
- **Next:** `phase 1` (map the Unity project → `CODE_MAP.json`).
