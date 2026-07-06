# Phase 1 — Mapping (Unity Project → CODE_MAP)

## 1. Goal / Purpose

Analyze the Unity project and produce a structural map, `ludeo-integration-plan/CODE_MAP.json`, that
later phases plan against: scenes & build flow, entry/bootstrap, MonoBehaviour lifecycle hooks, core
managers/controllers, session boundaries (every gameplay exit path), the trackable object model,
event systems, input/AI, threading, and any pre-existing Ludeo wiring. Every entry is backed by real
`file:line` evidence — **no guessed symbol names**.

## 2. Inputs (Input Contract)

Required artifacts / pre-flight:

- [ ] **Fresh agent session.** If you see prior tool calls, game analysis, or `CODE_MAP` references in
      this conversation, **STOP** and tell the user: *"This chat has prior context. For best results,
      start a fresh agent session and continue with phase 1 there."*
- [ ] **Phase 0 complete** — integration branch (`feature/ludeo-integration-#N`) exists, the Ludeo
      package is installed (`using LudeoSDK;` resolves), and `ludeo-integration-plan/INTAKE.md` is
      recorded (incl. the game-level save-system classification).
- [ ] **Read the Unity structural model (§5) before searching** — it tells you what to look for and
      what does not exist in a Unity project.

## 3. Steps

> Read **§5 Patterns** first. Plan sub-steps (settle serialization, run the Analysis Checklist) →
> implement sub-step (write `CODE_MAP.json`). All findings carry `file:line`; verify every symbol
> against the codebase — do not guess names.

### Step 1 — Settle asset serialization (one-time; gates everything that reads a scene/prefab)

Much of a Unity game's state lives **not in code but in the Editor** (which components sit on which
GameObjects, prefab makeup, inspector-set values). When assets are **binary-serialized**, none of
that is readable from disk. Switching to **Force Text** (YAML) makes scenes/prefabs greppable, which
directly accelerates the discovery phases — especially **phase 8 (map game objects)**, where a large
share of entity state is configured on the prefab/scene rather than in code. Pure `.cs` work
(lifecycle wiring, `SendAction`, `SetAttribute`, restoration) is unaffected — this is a
discovery-phase convenience, not a functional requirement.

1. **Detect (don't blind-prompt).** Read `ProjectSettings/EditorSettings.asset` →
   `m_SerializationMode`: `0` = Mixed, `1` = ForceBinary, `2` = ForceText.
   - **`2` (ForceText)** → already done; record it in the CODE_MAP and skip to Step 2. No prompt.
   - **`0` or `1`** → ask the user (the decision itself is **§4**).
2. **If they agree to switch:**
   1. **Commit a clean baseline first** — so the re-serialization is an isolated, revertible point.
   2. **Ask the user to toggle it in the Editor:** *Project Settings → Editor → Asset Serialization →
      Force Text.* ⚠️ **You cannot do this with a file edit.** Editing `m_SerializationMode` flips the
      *setting* but does **not** re-serialize existing assets — they stay binary until reimported.
      Only the Editor toggle (or *Assets → Reserialize Assets* /
      `AssetDatabase.ForceReserializeAssets()`) converts the repo.
   3. **Verify before committing** — let Unity finish the reimport, confirm **no new import/console
      errors** and the **game still plays** (a mass rewrite; the baseline commit is the revert point).
   4. **Commit the re-serialization as its own isolated commit** (e.g.
      `chore: switch asset serialization to Force Text`) so later Ludeo changes diff cleanly on top.
3. **If they decline:** record the choice in the CODE_MAP (`serialization` note) and proceed in binary
   mode — you'll **round-trip scene/prefab inspector lookups through the user** in this and later
   phases. **Do not re-prompt** in phases 8/10; at most a one-line reminder of the prior choice.

### Step 2 — Run the Analysis Checklist

Execute these searches systematically before writing the CODE_MAP. Skip sections that return no
results. All patterns are **Unity-native** — adapt based on what the project reveals.

**1. Project identity & layout**
- `Glob("**/ProjectSettings/ProjectVersion.txt")` — Unity version (gates UPM vs `.unitypackage`).
- `Glob("**/Packages/manifest.json")` — installed packages (is the Ludeo package already present?).
- `Glob("**/*.asmdef")` — assembly definitions / module boundaries (where defines & references go).
- List `Assets/` top-level folders; identify the game's script roots.

**2. Scenes & build flow**
- `Glob("**/*.unity")` — all scenes.
- Read `ProjectSettings/EditorBuildSettings.asset` — the scene list and load order (first = bootstrap).

**3. Entry / bootstrap**
- `Grep("RuntimeInitializeOnLoadMethod")` — static bootstrap hooks.
- Identify the `MonoBehaviour`s in the first scene that run `Awake`/`Start` to wire app init.

**4. Lifecycle hooks (MonoBehaviour callbacks)**
- `Grep("void (Awake|OnEnable|Start|Update|FixedUpdate|LateUpdate|OnDisable|OnDestroy|OnApplicationQuit)\b")`
- Note which classes own per-frame `Update` (candidate `UpdateStateObjects` sampling sites) and which
  own teardown (candidate exit paths).

**5. Managers / singletons**
- `Grep("class .*Manager|class .*Controller|class .*GameMode|class .*System")`
- `Grep(": MonoBehaviour|: ScriptableObject")` — component vs data-asset classes.
- `Grep("static .* Instance")` — singleton/global access patterns.

**6. Session / level boundaries** — apply the classification gate in **§5** first, then:
- **Keyword probe** (scene/level-centric games):
  - Start: `Grep("SceneManager\.Load|LoadSceneAsync|StartGame|NewGame|BeginMatch|StartLevel")`
  - End: `Grep("GameOver|EndGame|LevelComplete|RestartLevel|ReturnToMainMenu|QuitToMenu|Application\.Quit")`
- **State-machine probe** (run if keyword probe is empty or there are no per-level scenes):
  `Grep("enum .*State|ChangeState|CurrentState|GameState|StateMachine|TransitionTo")`. Walk the state
  graph for the states that **bracket gameplay** — those are the boundaries.
- **Procedural-assembly probe** (run for every game; positive → set `assembly = "procedural"`):
  `Grep("Random\.|new System\.Random|Seed|RandomChunk|RandomEncounter|LevelPool|ChunkPool|SelectionPool|GetLevelChoices|Instantiate.*[Pp]refab.*\[")`.
  Positive signal is content **selected/built at load**. A scene that always loads the same authored
  content is **not** procedural even if it uses `Random` for cosmetics.
- **List every distinct way gameplay is left** — each is a required `End`/`Abort` site later (CR-007).

**6b. Non-ludeoable areas (mid-gameplay segments)** — segments *inside* live play that should never
become a Ludeo: shops, NPC dialogue, tutorials, safe zones, in-game inventory/map screens, cutscenes.
These are **distinct** from whole-screen menus (which sit outside any gameplay session — nothing to do)
and from a true sim-freeze pause. Tracking **keeps running** through them; phase 2 plans boundary
actions (`StartNoneLudeable`/`StopNoneLudeable`) at their enter/exit and the backend excludes the
window. Probe for the **enter/exit sites**:
- `Grep("Shop|Store|Vendor|Dialogue|Dialog|Conversation|Tutorial|SafeZone|SafeRoom|Cutscene|Cinematic|InventoryScreen|MapScreen")`
- For each hit, record the **enter** and **exit** site (`file:line` + the trigger/method). A segment
  with no clear exit is a flag for phase 2 (a dangling non-ludeoable would never re-enable capture).

**7. Object model (spawn / despawn)**
- `Grep("Instantiate\(|Destroy\(|DestroyImmediate\(")`
- `Grep("ObjectPool|PrefabPool|Spawn|Pool")` — centralized spawn paths.
- `Glob("**/*.prefab")` (sample; do not enumerate exhaustively) — prefab-driven entity types.

**8. Event systems**
- `Grep("event |Action<|Func<|UnityEvent|delegate |SendMessage")`
- Identify the pattern: C# events/`Action`, `UnityEvent`, or a custom bus.

> **Save/serialization is not classified here.** A `SaveManager`-style class surfaces under
> `core_classes` (§5 of the checklist) — enough for the structural map. The save system's **game-level**
> mechanism/format/group is classified in **phase 0 intake** (`INTAKE.md`); the **per-entity
> reconciliation-vs-manual matrix** is built in **phase 8** once the object model exists. Don't
> (re-)classify it here.

**9. Input / AI / bots (controllability for restoration)**
- `Grep("Input\.|InputAction|PlayerInput")` — input model.
- `Grep("class .*AI|class .*Bot|class .*Enemy|NavMesh|NavMeshAgent")` — AI presence, spawn, control.

**10. Existing Ludeo wiring (idempotency)**
- `Grep("using LudeoSDK|LudeoManager|LudeoController|LudeoStateObject|com\.ludeosdk")` — detect any
  prior/partial integration so you don't duplicate it.

### Step 3 — Write the CODE_MAP

Record file paths, class/method names, scene names, and line numbers for all findings, into the
artifact defined in **§6**.

## 4. Questions to ask the human

Only what can't be inferred from code:
- **Asset serialization (Step 1).** If the project is Mixed/ForceBinary, **recommend** switching to
  Force Text — explain the discovery benefit (esp. the phase-8 win) and that it serves their own goal
  of fully tracking the game's state. It has VCS implications (a one-time mass re-serialization), so
  it's the integrator's call — recommend, don't mandate. (Procedure is in §3 Step 1.)
- **In binary mode:** which components/values sit on a given scene object or prefab, when a grep can't
  reach them (inspector round-trip).
- **Ambiguous session boundaries:** which scenes are gameplay vs menu/transition; whether an exit path
  you found actually ends a live run.

## 5. Patterns to apply

### How a Unity game is structured (read before searching)

Do **not** look for a `main()`, a game-authored frame loop, or a build script — Unity has none. The
model you are mapping:

- **No entry point you control.** The first scene in Build Settings loads automatically; objects in it
  with `MonoBehaviour` components wake up. Bootstrap is a dedicated init scene and/or a
  `[RuntimeInitializeOnLoadMethod]` static hook.
- **Lifecycle = MonoBehaviour callbacks** Unity invokes for you: `Awake → OnEnable → Start` (init),
  `Update`/`FixedUpdate`/`LateUpdate` (per-frame), `OnDisable`/`OnDestroy`/`OnApplicationQuit`
  (teardown — these are **gameplay exit paths**).
- **Scenes (`.unity`) are the level / session model.** Transitions via
  `SceneManager.LoadScene`/`LoadSceneAsync`. Level start/end = scene load/unload + the gameplay state
  machine.
- **Entities = GameObject + MonoBehaviour components + prefabs.** Spawned with `Instantiate(prefab)`,
  removed with `Destroy`/`OnDestroy`. Hook the **spawn/despawn site**, not a constructor. Spawning is
  often centralized (object pools, spawners, factories).
- **Identity is not stable across runs** (`GetInstanceID`, references). Restoration matches by object
  *type* + your own key attributes, not by engine ids.
- **Main thread by default**; worker threads only with coroutines/async/Jobs.
- **The "build" is the Unity Editor + an installed package** (no build script). The SDK is
  auto-referenced once present; disabling Ludeo is primarily a runtime concern.

### 🛑 Session classification gate (apply at checklist §6)

Decide **three orthogonal things** about how this game models a session:

0. **Launch model** — does a capture session start through a **main menu / level-select**, or does the
   game **boot straight into gameplay** (the first `EditorBuildSettings` scene is itself a gameplay
   scene that auto-starts a run)? And is a Ludeo entered via an **in-game gallery** or **launched
   preselected**? **Intake (phase 0) is authoritative** — this is a product choice; here you only
   **cross-check it against the code** (first-scene-is-gameplay? is there a menu scene? a forced
   auto-start at boot?) and record `launch_model` in §6. If either axis is boot-straight / preselected
   — or the menu is fast/skippable — **read
   [`ludeo-integration-docs/unity/LAUNCH-AND-READINESS.md`](ludeo-integration-docs/unity/LAUNCH-AND-READINESS.md)**:
   the SDK-readiness gate replaces the menu's implicit wait for Activate + consent. Flag any mismatch
   (intake says boot-straight but the code boots to a menu, or vice-versa) — the integration may need
   to **add** a boot/gate path the game doesn't have yet.
1. **Boundaries** — scene/level-driven, or a **single streaming world** (open-world / sandbox / MMO)
   whose boundaries live in a **state machine or event dispatcher**, not in scene loads. If the latter
   (no per-level gameplay scenes), **stop and read
   [`ludeo-integration-docs/game-patterns/open-world.md`](ludeo-integration-docs/game-patterns/open-world.md)
   before writing `session_boundaries`** and emit the sub-structure in §6 instead of flat start/end sites.
2. **Assembly** — is each gameplay scene a fixed authored level, or a **container whose content is
   assembled at load from data + RNG** (a run/level *builder* or *pool* picks chunks/rooms; `Random`/a
   seed drives layout/encounters)? If the latter (roguelike / procedural dungeon / wave-survival),
   **read [`ludeo-integration-docs/game-patterns/procedural-world.md`](ludeo-integration-docs/game-patterns/procedural-world.md)**
   and set `session_boundaries.assembly = "procedural"` — capturing "which scene" won't relocate the
   moment (reload yields an empty container and re-rolls content), so phases 8/10 must capture the
   **generation inputs**.

These axes are independent: a game can be procedural *and* level-based, procedural *and* streaming, or
neither — and any of those can be boot-straight or menu-gated.

## 6. Output Contract

1. **Create folder:** `ludeo-integration-plan/` in the Unity project root.
2. **Save:** `ludeo-integration-plan/CODE_MAP.json` containing:
   - `project_summary` — Unity version, render pipeline if detectable, key `Assets/` folders, asmdefs
   - `serialization` — `m_SerializationMode` found (Mixed / ForceBinary / ForceText) and the user's
     decision (switched to Force Text / declined / already Force Text)
   - `packages` — relevant entries from `Packages/manifest.json`; whether the Ludeo package is present
   - `scenes` — scene list + load order; which is bootstrap, which are gameplay
   - `entry_points` — bootstrap MonoBehaviours / `RuntimeInitializeOnLoadMethod` hooks (file, line)
   - `launch_model` — the §5 axis-0 classification (intake-authoritative, code cross-checked):
     ```json
     "launch_model": {
       "creator": "menu-gated | boot-straight",
       "player": "gallery | preselected | both",
       "first_scene_is_gameplay": true,
       "menu_scene": "<scene or null>",
       "readiness_gate_required": true,
       "source": "intake authoritative; code cross-check — flag if they disagree (integration must ADD a boot/gate path)"
     }
     ```
   - `core_classes` — key managers/controllers/MonoBehaviours (file, base class, key methods)
   - `lifecycle_hooks` — MonoBehaviour callbacks per class relevant to init / per-frame / teardown
   - `session_boundaries` — gameplay start sites **and every distinct exit path** (file, line). Always
     include `assembly` — `"authored"` (fixed levels) or `"procedural"` (scene is a container; content
     assembled at load from data + RNG). When `"procedural"`, also record `builder` (the level/run
     builder or pool class + file:line) and `generation_inputs` (selection/seed, sub-roll,
     progress-cursor, scaling-counter fields phases 8/10 will capture — see
     `ludeo-integration-docs/game-patterns/procedural-world.md §3`). **When the project has no
     per-level scenes** (open-world / streaming / sandbox / state-machine-driven), use this
     sub-structure (see `ludeo-integration-docs/game-patterns/open-world.md`):
     - `model` — one-line classification (e.g. `"state-machine + event-dispatch; single streaming world"`)
     - `start_sites[]` — each `{ trigger, file, line, meaning }` for events that begin a live run
     - `exit_sites[]` — each `{ trigger | state, file, line, ludeo: "End" | "Abort" | "End/Abort" }`
     - `pause_overlay[]` — the game's pause primitive(s) to wire to `AddNotifyPauseGame`/`AddNotifyResumeGame`
       ([CR-011](ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md))
   - `non_ludeoable_candidates` — mid-gameplay non-ludeoable segments (shops/dialogue/tutorials/safe
     zones/cutscenes), each `{ kind, enter: {file, line, trigger}, exit: {file, line, trigger} }`.
     Phase 2 maps these to `StartNoneLudeable`/`StopNoneLudeable` boundary actions. Empty if none found.
   - `object_model` — trackable entity classes, their prefabs, and spawn/despawn sites
   - `event_systems` — pattern type (C# event / `Action` / `UnityEvent` / bus) with examples
   - `input_ai` — input model; whether AI/bots exist, how they spawn, controllability
   - `threading` — main-thread only, or coroutines/async/Jobs in use
   - `existing_ludeo` — any prior Ludeo wiring found (or none)

**Include file paths, class/method names, scene names, and line numbers for all findings.**

## 7. ✅ Success Criteria

The gate — satisfy all before advancing to phase 2.

**Guideline phase-1 criteria:**
- [ ] `ludeo-integration-plan/CODE_MAP.json` exists.
- [ ] Lifecycle hooks, core classes, event systems, and candidate entities are all listed.
- [ ] **Every symbol is verified against the actual codebase** — each entry carries a real `file:line`;
      no guessed class/method/scene names.

**Skill-specific additions:**
- [ ] `serialization` recorded (mode found + user's decision).
- [ ] `session_boundaries` lists **every distinct gameplay exit path** (not just the happy-path end),
      with `assembly` set; open-world/procedural sub-structure used where applicable.
- [ ] `non_ludeoable_candidates` recorded (mid-gameplay non-ludeoable segments with enter/exit sites,
      or explicitly empty) — phase 2 needs these to plan `StartNoneLudeable`/`StopNoneLudeable`.
- [ ] `existing_ludeo` recorded (prior/partial integration detected, or explicitly none).

## 8. Common Mistakes

- **Guessing symbol names** instead of grepping — every name in the map must trace to a `file:line`.
- **Hunting for a `main()`, a frame loop, or a build script** — Unity has none (see §5).
- **Missing an exit path** — listing only `GameOver` and forgetting return-to-menu / quit /
  load-different-save; each is a required `End`/`Abort` later (CR-007).
- **Treating a transition/streaming cache as the save** (`CacheScene`/`Persist*`, interior↔exterior,
  Addressables hand-off) — these hold partial deltas, not the canonical save.
- **(Re-)classifying the save system here** — game-level classification is phase 0 intake; the
  per-entity matrix is phase 8.
- **Enumerating every prefab/scene exhaustively** — sample to identify entity *types*; don't dump the
  whole asset tree.
- **Editing `m_SerializationMode` by file** and assuming the repo converted — it doesn't re-serialize
  existing assets; only the Editor toggle / reserialize does.

## Related / Next

- Patterns: `ludeo-integration-docs/game-patterns/open-world.md`, `.../procedural-world.md`.
- **Next:** `phase 2` (SDK lifecycle) — enter via the orchestrator `2-lifecycle-orchestrator.md` and
  run it as a **single phase**. Do not treat "map SDK integration points" as a standalone phase: it is
  only task 1 of five (map points → TDD → plan → implement → human compile gate) the orchestrator
  dispatches as subagents.
