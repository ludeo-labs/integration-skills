# Phase 4 · Task 2 — Plan State Restoration (Unity)

> **Single-task subagent brief.** Dispatched by the phase-4 orchestrator
> (`9-tracking-restore-orchestrator.md`) **once per wave**. **Append this wave's rows** to
> `RESTORATION_PLAN.md` — **analysis only, no code, run nothing** — then return a summary + the artifact
> path. **You do not run the human review gate** — the orchestrator surfaces the rows to the user for
> approval. You run in isolated context — your inputs are the files in §2.
>
> **Wave-loop role (append-only):** plan **only this wave's** entities (the `wave: N` rows task 0 appended,
> which task 1 just captured). Create `RESTORATION_PLAN.md` on Wave 1; **append** each later wave's rows —
> **never rewrite a confirmed wave's rows.** This wave's rows are the row-for-row inverse of this wave's
> capture.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Restoration is the inverse of tracking. Read the already-approved `OBJECT_TRACKING.md` and, row by row,
specify how each captured GameObject is rebuilt when a Ludeo is selected: spawned from its `objectType`
bucket, attributes read back with `TryGetAttribute`, references re-linked by **your own stable key**.
Deliverable: a reviewed `RESTORATION_PLAN.md` that `phase 11`/`phase 12` (tasks 3–4) consume. **No code
is written here.**

## 2. Inputs (Input Contract)

- [ ] **Phase 3** → `ludeo-integration-plan/OBJECT_TRACKING.md`, **approved** (entity model is fixed).
- [ ] **Phase 3** per-entity matrix (`OBJECT_TRACKING.md` rows + `CODE_MAP.save_system.per_entity`) +
      `CODE_MAP.save_system.group`. (Game-level classification originates in `phase 0` `INTAKE.md`.)
- [ ] **Phase 2** → the `[Layer]` exists (`LudeoController`, `LudeoPlayFlow`, the `onRoomReady` hook) so
      the restore flow this plan slots into is real, not hypothetical.
- [ ] **Recommended:** task 1 (`phase 9`) done, so the capture code (its `objectType` strings,
      `LudeoKeys` constants, stable-key attribute names) exists to mirror against. If not, plan against
      `OBJECT_TRACKING.md` and flag any field the implementation may still rename.
- [ ] Context files read (relative to this brief):
  - `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — **the core input.** §1 (the model — buckets, no
    id-map, snapshot-not-replay), §2 (the restore flow + ordering invariants), §4 (two-pass), §8
    (world/level restore), §9 (pre-existing reconciliation), §10 (freeze + wait-for-player). The restore
    `[Layer]` API in §3 and per-object code in §5 are task-3/task-4 concerns — skim, don't plan code from them.
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the `[Layer]` the restore flow runs through
    (`LudeoController`, `LudeoPlayFlow`, `LudeoRestoredData`, the `onRoomReady` hook).
  - `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — **§4** (identity by bucket + your own key, no ID
    map; references captured as the target's key, resolved two-pass). **What was captured determines what
    can be restored.**
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the restore surface *at a glance*:
    `LudeoDataReader.GetStateObjects()` → `LudeoStateObjectRestore[]`; `TryGetAttribute(name, out value)`
    mirrors each `SetAttribute` and returns `false` when an attribute is absent; grouping is **by
    `ObjectType`**. **You do not need exact signatures or the callback shape for planning.**
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — **CR-006** (two-pass), **CR-010** (freeze),
    **CR-011** (overlay pause), **CR-014** (stable identity — no `GetInstanceID()`).
  - `ludeo-integration-docs/unity/CONSENT-AND-OVERLAY.md` — the overlay pause/resume notifications
    (`AddNotifyPauseGame`/`ResumeGame`, CR-011), `ReturnToMainMenu` exit (CR-007), and the gallery entry.

> **🛑 Planning scope — analysis only.** You do **not** need exact `[SDK]` signatures, the `GetLudeo`
> callback shape, or the package source. Reference restoration at the level of *which call maps to which
> step* (`07 §2`). If you find yourself opening the `LudeoSDK` package source, stop — the answer is in
> `07` / REFERENCE-ARCHITECTURE / doc 12, or it's a task-3/task-4 concern; note it as an Open Question.

> **Produced by this task if absent:** the **world-state inventory** (`GAME_ANALYSIS_ENVIRONMENT.md`).
> No earlier phase emits it; Step 9 builds it before planning environment restoration.

## 3. Steps

### Step 1: Read prior artifacts
From `ludeo-integration-plan/`:
- `OBJECT_TRACKING.md` → the **spine**: entities, `objectType` strings, stable-key attributes, property
  kinds + cadence, the Cross-Entity References table, Batch/Stream-in Registration Sites,
  reconciliation/manual per entity, and the `Structural:` line (level-based vs open-world/streaming).
- `CODE_MAP.json` → `save_system.group` (1/2/3), `session_boundaries` (and whether it has the
  `{ model, start_sites[], exit_sites[], pause_overlay[] }` open-world sub-structure), the scene-load hook.
- `CODE_MAP.save_system.per_entity` → per-entity reconciliation-vs-manual matrix (built in `phase 3`;
  must agree with the `OBJECT_TRACKING.md` entity rows — if they disagree, **surface it for the user**).
- `GAME_ANALYSIS_ENVIRONMENT.md` → world-state inventory for Step 9 (produce it there if absent).

> **Open-world / streaming games:** if `session_boundaries` carries the open-world sub-structure, also
> read `game-patterns/open-world.md` and `game-patterns/open-world-tracking.md`: the run is one Gameplay
> Session (no per-level scene), "pre-existing at load" means the new-game/load-save moment, and restore
> must re-bind to **persistent world ids** across stream cycles, scoping to the loaded neighborhood — not
> blind-spawn the whole save.
>
> **Procedural-assembly games:** if `session_boundaries.assembly == "procedural"`, also read
> `game-patterns/procedural-world.md`. The scene is a **container**: "load the scene" yields an
> empty/default world and the generator **re-rolls**. Restore must **re-drive the generator from the
> captured `RunMetadata` generation inputs and suppress the re-roll** (gate `RandomChunk`/`RandomEncounter`
> on `IsInLudeoFlow`), and restore the run-scaling counter before any post-restore spawns (§5 of that file,
> §8 of `07`). **Single vs multi-room (§2.1):** one room live → `07 §8` + the re-roll/scaling deltas
> suffice; several rooms navigable → **procedural ∩ open-world**, also restore layout/connectivity +
> per-room `ChunkDelta` state (`open-world-tracking.md §3`), scoped to the reachable set.

### Step 2: Select the per-group restoration strategy
Branch on `save_system.group`:
- **Group 1 (full Unity save system — `JsonUtility`/`ScriptableObject`/binary slot loads)** — restore
  through the existing `Load(slot)` path; feed it a synthetic save built from the Ludeo buckets. Two-pass
  still required for references unless the loader is already multi-pass.
- **Group 2 (checkpoint/`PlayerPrefs`-only)** — extend the checkpoint/respawn manager to accept a
  synthetic checkpoint built from Ludeo data; identify which checkpoint constraints must be relaxed.
- **Group 3 (no save system)** — build the restoration path end-to-end; the two-pass bucket-apply is the
  spine; every entity needs an explicit spawn function + setters.

Record the chosen strategy and exactly what existing game machinery (if any) restoration reuses.

### Step 3: Design the `LudeoSelected` interrupt flow
The play flow has a documented shape in REFERENCE-ARCHITECTURE (`HandleLudeoSelected` →
`HandleGetLudeoDone` → `HandleRoomReady` → bootstrap `onRoomReady`). **Map each step onto this game's
hooks** and identify what must be torn down / suppressed. The handler for a `LudeoSelected` `[SDK]`
notification must work in **any** state (menu, mid-gameplay, loading, cutscene):

1. **Tear down** any active gameplay session + room (the SDK `LudeoSession` stays alive); cancel in-flight
   transitions; suppress non-restoration input. If currently capturing, route through `EndGameplay`/
   `AbortGameplay` `[Layer]` (CR-007).
2. The flow switch flips to **Play** (`SwitchToPlay()` `[Layer]`, consent-gated, CR-012) and
   `IsInLudeoFlow` `[Layer]` becomes `true` — the seam that gates all pre-match suppression.
3. **Load the scene** named in the Ludeo metadata; block until load completes. (Open-world: no scene
   load — re-enter the persistent world / load-save moment. **Procedural-assembly: loading the scene is
   not enough** — re-drive the level builder/pool from the captured `RunMetadata` generation inputs and
   restore the scaling counter — `procedural-world.md §5`.) Pre-match sequences **and the generator's
   random selection** fire here and must silently skip / be overridden via the `IsInLudeoFlow` gate.
4. **Freeze the sim** for the restore window — `Time.timeScale = 0f` `[Unity]` (CR-010), tracked on a
   **CR-010 freeze flag separate from the CR-011 overlay-pause flag** (CONSENT-AND-OVERLAY §3). **Decide
   now whether the apply is synchronous or async** (`07 §10.1`): if spawn/reposition **awaits** a physics
   step / coroutine / `UniTask` / NavMesh `Warp`, `Time.timeScale = 0f` stops `FixedUpdate` and the apply
   **deadlocks** — plan to **suppress** state-mutating systems via `IsInLudeoFlow` and freeze only the
   synchronous scalar write. Record the chosen shape.
5. The reader is delivered async in `HandleGetLudeoDone`; the `[Layer]` extracts the restore buckets into
   `LudeoIntegrationData.ludeoRestoredData` there and opens the room. **Apply runs later, on `RoomReady`**
   — not in the `GetLudeo` callback.
6. On **`RoomReady`** (the `onRoomReady` hook from `phase 2`): **apply (two-pass + environment) → unfreeze
   → `BeginGameplay()`** `[Layer]`, in that order. **Never unfreeze before apply.** A *synchronous* apply
   can fold the unfreeze into `Begin`'s callback; an *async* apply runs the create unfrozen-but-suppressed
   and freezes only the scalar write (`07 §10.1`). `Begin` runs after apply so the SDK records playback
   from the restored state.

Also plan four distinct sets of hooks:
- **Selection-time (`onBeginRestore`)** — fires at Ludeo *selection*, in `HandleGetLudeoDone` **before the
  room opens** (`onInitDone` is session-boot; `onRoomReady` is too late). This is where the game **starts
  the async scene load** (the world id is known from the buckets here) and **suppresses intros**. Its
  loader must call `NotifySceneReadyForRestore()` `[Layer]` on completion — the **third leg of the begin
  gate** (`RoomReady ∧ AddGamePlayer ∧ sceneLoaded`), which usually means **adding an awaitable/completion
  event to an `async void` scene loader**. Map this onto a game hook (file:method); if no such loader
  callback exists, flag adding one as an Open Question.
- **Post-restore resume** — reuse `phase 2`'s `onRoomReady` hook. Apply state inside it, **then** unfreeze,
  before `BeginGameplay`. **Resume is `RoomReady → Begin`** — *not* a self-built "press to begin" prompt,
  *not* `PlayerReady` (**does not exist in this SDK**), *not* `ResumeGame` (that's the mid-play overlay).
- **Mid-play overlay open/close** (CONSENT-AND-OVERLAY §3, CR-011) — `AddNotifyPauseGame` →
  `Time.timeScale = 0f`, `AddNotifyResumeGame` → `Time.timeScale = 1f`, `AddNotifyReturnToMainMenu` → a
  CR-007 exit (stop tracking + `CloseRoom` + load menu scene). Session-lifetime; easy to forget. Map each
  onto a game hook. **Names have no `Request` suffix.**
- **Pre-match / location-override suppression** — every mechanism the game runs at start of a run that
  would touch restored state: intro cutscenes, countdowns, slow-mo intros, fly-in cameras, default-spawn
  teleports (`SpawnPoint`/`Respawn`), scripted scene-start events, `Start`/`OnEnable` re-initializers.
  List each with its hook (file:method) and the plan to gate it on `IsInLudeoFlow` `[Layer]`.

Map each step onto a concrete game hook (file:method) where known; flag any that don't yet exist as an
Open Question for task 3/task 4.

### Step 4: Specify the two-pass algorithm (CR-006)
Document the two passes concretely. The Unity model has **no SDK id-map** — you build your own key map
from the stable-key attribute you captured:
- **Pass 1 — Create:** for each `objectType` bucket (`RestoreLudeoStateOfObject` for singletons /
  `TryGetAllLudeoStateObjectByType` for collections `[Layer]`), spawn a type-only instance via the spawn
  function, read its **stable-key attribute** (`TryGetAttribute` `[SDK]`), and populate
  `Dictionary<stableKey, GameObject> keyMap`. Singletons (the player) need no key.
- **Pass 2 — Apply + Resolve:** iterate the buckets again, apply non-reference attributes via
  `TryGetAttribute` → setter, and resolve reference attributes by looking up the captured target key in
  `keyMap`.

Define the `keyMap`: key = your captured stable key (the `int`/string/world-id from `phase 3` §5), value
= the spawned/matched runtime GameObject. State that it is **per-Ludeo** and discarded after restoration.
If the spawn graph has ordering constraints (the player must exist before per-player UI/weapons), split
Pass 1 into **1a (foundational)** and **1b (dependent)** and record which entities go in each.

> **`TryGetAttribute` returns `false`** when an attribute is absent or the type mismatches. For every
> property, state the fallback: keep the spawn default, or treat as a restore error. Partial/version-tolerant
> restore is a feature of the attribute model (doc 06 §1.4) — don't fail the whole restore on one missing
> optional field, but **do** fail loud on a missing key (Step 6).

### Step 5: Build the per-entity spawn + setter inventory
The heart of the plan and the direct mirror of `OBJECT_TRACKING.md`'s entity blocks. For **each** tracked
entity, fill one restoration block:
- **Spawn function** — the inverse of the register hook; takes `objectType` (and minimal identity),
  returns a fresh, property-less instance (`Instantiate` the same prefab, or the spawner's `Spawn`).
- **`keyMap` key** — the stable-key attribute; note whether the entity is *created fresh* or *matched to
  a scene-placed instance* (Step 8). Singleton → bucket `[0]`, no key.
- **Baseline reset (matched / persistent singletons only)** — a matched instance and a persistent player
  singleton (`phase 3` flagged it) are **not** re-instantiated, so they keep the prior run's state; name
  the reset to run **first** in the apply (the game's new-game/respawn path, or the explicit fields to
  clear — inventory, ammo, buffs, score, cooldowns, status flags). A freshly *spawned* entity needs none.
- **Per-property apply** — for every property `phase 3` captured, name the setter and whether it applies
  in Pass 2 or is **deferred** (Step 7). Reference properties get a Pass-2 `keyMap` lookup. Each is a
  `TryGetAttribute(K.Name, out value)` `[SDK]` read against the **same `LudeoKeys` constant** capture used.
- **Approach** — `reconciliation` (route through the game's recreate/load path, §5.1) or `manual`
  (explicit `TryGetAttribute` → setter, §5.2), taken from the matrix — never re-decided here by policy.

### Step 6: Resolve cross-entity references
Take the Cross-Entity References table from `OBJECT_TRACKING.md` verbatim and turn each row into a Pass-2
resolution step (`06 §4`): the captured value is the target's **stable key**, resolved through `keyMap`
to the live target GameObject. State the failure policy explicitly: **a missing `keyMap` entry in Pass 2
is a Pass 1 bug — fail loud, never substitute null.** Any reference with no resolution path is an Open
Question.

### Step 7: Identify deferred properties
List every property that cannot be applied at spawn and must run after Pass 2, before handing control to
the player. Heuristic: anything that no-ops or reverts when set too early in Unity:
- `Rigidbody.velocity`/`angularVelocity` `[Unity]` — the body must be active and not re-zeroed by the
  first physics step.
- `Animator` state/pose — the `Animator` must be enabled and past its entry transition.
- `NavMeshAgent` position/path — agent must be on the NavMesh (`Warp`).
- Ability/cooldown timers that a `Start`/`OnEnable` resets.

For each: why it must defer (which subsystem must be online first) and its position in the deferred queue
if deferred properties depend on each other — capture the order here, don't infer it at runtime.

### Step 8: Plan pre-existing-object reconciliation
Mirror of `phase 3`'s Batch/Stream-in Registration Sites. A freshly loaded scene is **not empty** —
editor-placed objects (and `Awake`/`Start`-spawned content) already exist. They must **not** be
double-created. For each batch-registered entity type, decide: does restoration *match* the captured
bucket entry to the scene-placed instance (by stable key, then apply properties), or *spawn* a fresh one?
Specify the match key and the hook where matching runs relative to scene load.

> **Open-world / streaming:** match against **persistent world ids**, and only restore the loaded
> neighborhood; entities in unloaded cells re-bind when their cell streams in (`open-world-tracking.md`).

### Step 9: Plan environment restoration
**If `GAME_ANALYSIS_ENVIRONMENT.md` does not exist, build it now** — a light world-state inventory written
to `ludeo-integration-plan/`. Inventory the world-level state a viewer would notice: time-of-day /
lighting, weather, world/quest flags, audio mix, camera state, spawned-world progress. Model it as a
**singleton "world" `objectType`** (captured in `phase 9` via `LudeoCreatorFlow.StoreGameDefinitions` or
its own handler) restored with the same bucket discipline (usually no references → Pass 2 is pure property
application).
- **Ordering:** environment restoration runs **after** entity restoration — world flags can despawn
  entities you just spawned, or fire logic for entities not yet present. State the order explicitly.
- **Procedural-assembly exception:** the `RunMetadata` **generation inputs** (selection/seed, sub-roll,
  progress cursor, scaling counter) are *definitions*, not environment — they restore **before** entities
  because the builder needs them to assemble the container (`07 §8`). Plan them as a distinct early step
  that re-drives the generator under `IsInLudeoFlow` and sets the scaling counter; ordinary
  world/environment flags still restore *after* entities. State both positions (`procedural-world.md §5`).
- **Exclusion list:** record state deliberately **not** restored (UI history, local player prefs/settings,
  graphics options) and why.

### Step 10: Specify the wait-for-player flow (CR-010)
From scene-load until `Begin`, the game **MUST protect restored state** — *not* just input. Pick the
mechanism by the apply's shape (`07 §10.1`):
- **Synchronous apply** → `Time.timeScale = 0f` `[Unity]` for the whole apply; on `RoomReady` the
  `onRoomReady` hook (`phase 2`) **applies state → unfreezes → calls `BeginGameplay()`** `[Layer]`.
- **Async apply** (spawn/reposition awaits a physics step / coroutine / `UniTask` / NavMesh `Warp`) →
  `Time.timeScale = 0f` stops `FixedUpdate` and **deadlocks** the apply. Plan to **suppress** the
  state-mutating systems (input, AI, cinematics) via `IsInLudeoFlow`, and freeze only the narrow scalar
  write. Suppression — not the freeze — is the overwrite guard here.

**Resume is the `RoomReady → Begin` chain** — **not** a self-built prompt, **not** `PlayerReady` (doesn't
exist), **not** `ResumeGame` (the mid-play overlay-closed resume, CR-011). Track the **CR-010 restore
freeze and the CR-011 overlay pause as two separate flags** (engine paused iff either is set —
CONSENT-AND-OVERLAY §3). Note whether the game has an existing pause system to reuse or a minimal
`timeScale`/suppression freeze must be built (common Group 3), and **whether the spawner is async**.

### Step 11: Confidence + open questions
Tag each entity restoration block `high | medium | low`. Low-confidence blocks and genuine ambiguities
(missing hooks, unresolved references, fields task 1 may rename, deferred-order uncertainty) go in
dedicated sections. These are the gate items the human resolves before task 3.

### Step 12: Produce + self-validate the output
Write `ludeo-integration-plan/RESTORATION_PLAN.md` (schema in §6), then walk §7's self-validation
checklist and fix any gap before handing back. Do **not** run a human review — return the artifact path +
a summary; the orchestrator surfaces it for approval.

## 4. Questions to ask the human

Surface to the orchestrator; don't guess:
- The apply's **sync/async shape** if the spawner's awaiting behavior can't be inferred from code (decides
  freeze-vs-suppress).
- A **scene loader with no completion signal** (`async void`) — adding `NotifySceneReadyForRestore()` is a
  prerequisite for the begin gate's third leg.
- **Disagreements** between `OBJECT_TRACKING.md` rows and `CODE_MAP.save_system.per_entity` — surface, don't
  silently reconcile.
- Any **reference with no resolution path**, or a tracking row with no sensible restoration inverse.

## 5. Patterns to apply

### The Mirror Principle (drive the whole plan from this)
Every restoration decision is the inverse of a tracking decision in `OBJECT_TRACKING.md`. Do not introduce
entities, properties, or keys tracking didn't capture — **you cannot restore what wasn't written.**

| `OBJECT_TRACKING.md` (capture side) | `RESTORATION_PLAN.md` (rebuild side) |
|---|---|
| `objectType` string | The **bucket key** — `LudeoStateObjectsLookup[objectType]`; **must match exactly** |
| Register hook (file:line) | Spawn function invoked in **Pass 1** (type-only, property-less) |
| Stable-key attribute (collections) | Read in Pass 1 via `TryGetAttribute` → keyed into your **Pass-1 key→instance map** |
| Singleton (player, bucket `[0]`) | No key — take the single bucket entry; match the scene's existing instance. **If persistent (`DontDestroyOnLoad`/`static`/SO-held), reset it to baseline before applying** (`07 §4`/§9) |
| Unregister hook | n/a — restore doesn't destroy; but the loaded scene is **not empty** — reconcile against scene-placed instances (Step 8) |
| Property · static / `identity` | Apply at spawn or early in **Pass 2** |
| Property · `dynamic-continuous`/`dynamic-discrete` | Apply the **final captured value** once in **Pass 2** — a *snapshot*, not a replay |
| Property · `reference` (target's stable key) | **Pass 2** `keyMap` lookup → set the live reference |
| Batch / stream-in site | Pre-existing-object reconciliation — *match scene-placed* vs *spawn* (Step 8) |
| Entity marked `reconciliation` | Restore through the game's existing load/recreate path (§5.1) |
| Entity marked `manual` | Restore via explicit per-property `TryGetAttribute` → setter (§5.2) |

If a tracking row has no sensible restoration inverse (or vice versa), record it as an Open Question.

- **No SDK id-map (the #1 C++→Unity trap).** There is **no** `LudeoObjectId ↔ game id` map. Objects come
  back grouped **by `objectType` bucket**; re-associate identity yourself via the stable-key attribute.
  `LudeoStateObjectRestore.ObjectId` `[SDK]` is an SDK-assigned `uint`, **not** your stable id (CR-014).
- **Snapshot, not replay.** `dynamic` captures restore as the single final value, applied once.
- **Two-pass is mandatory (CR-006).** Single-pass silently corrupts reference graphs by spawn order.
- **Fail loud on missing keys; tolerate missing optional attributes.**
- **Protect restored state during restore (CR-010), not just input** — freeze sync, suppress async.
- **Drive reconciliation/manual from the matrix**, per entity, never by global policy.
- **Environment after entities.** **Analysis only** — this task writes no game code.

## 6. Output Contract

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/RESTORATION_PLAN.md` | Approved plan that task 3/task 4 consume |
| `ludeo-integration-plan/GAME_ANALYSIS_ENVIRONMENT.md` | World-state inventory (produced in Step 9 if absent) |

May also surface disagreements between `OBJECT_TRACKING.md` rows and `CODE_MAP.save_system.per_entity`.

`RESTORATION_PLAN.md`:
```markdown
# State Restoration Plan — <GameName>

**Engine:** Unity <version>
**Save-system group:** <1 | 2 | 3>   **Strategy:** <reuse Load() | extend checkpoint | build end-to-end>
**Structural:** <level-based | open-world/streaming> · **Assembly:** <authored | procedural (re-drive generator from RunMetadata)>
**Entities to restore:** X (mirrors OBJECT_TRACKING.md)   **Deferred properties:** Y   **Pending human review**

## LudeoSelected Interrupt Flow
| Step | Game hook (file:method) | Notes |
|---|---|---|
| Tear down gameplay session + room | ... | EndGameplay/AbortGameplay; SDK LudeoSession stays alive (CR-007) |
| SwitchToPlay → IsInLudeoFlow=true | LudeoController [Layer] | consent-gated (CR-012); gates pre-match suppression |
| Selection-time: start scene load + suppress intros | onBeginRestore (HandleGetLudeoDone, before room opens) | loader calls NotifySceneReadyForRestore() → begin-gate leg 3 |
| Freeze sim / suppress (CR-010) | Time.timeScale = 0f (sync apply) or IsInLudeoFlow suppression (async apply) | separate flag from CR-011 overlay pause; async → freeze deadlocks |
| Extract reader buckets | HandleGetLudeoDone [Layer] | cache into ludeoRestoredData; do NOT apply here |
| On RoomReady (∧ AddGamePlayer ∧ sceneLoaded): apply → unfreeze → Begin | onRoomReady (phase 2) | two-pass + environment; apply before unfreeze; then BeginGameplay |

## Two-Pass Algorithm (CR-006 — no SDK id-map)
- **keyMap:** your stable key (<field>) → spawned/matched GameObject. Per-Ludeo, discarded after restore.
- **Pass 1 split:** <none | 1a foundational: …, 1b dependent: …>
- Pass 2 missing-key policy: fail loud (Pass 1 bug). Missing optional attribute: keep spawn default.

## Entity: <ObjectType>
- objectType string: `<exact match to OBJECT_TRACKING.md>`
- Approach: <reconciliation | manual>
- Pass: <1 | 1a | 1b>   Pre-existing: <spawn | match scene-placed, key=<attr>>   Singleton: <yes bucket[0] | no>
- Baseline reset before apply: <none (fresh spawn) | `<reset method @ file:line>` (matched / persistent singleton)>
- Spawn function: <inverse of register hook @ file:line>

### Property Restoration (TryGetAttribute → setter)
| Property | Kind | Setter | Pass 2 | Deferred? | Reference resolves to | If absent |
|---|---|---|---|---|---|---|
| ... | ... | ... | yes/no | no / queue#N | — / <Target> via keyMap | keep default / error |

## Cross-Entity Reference Resolution
| From | Field | To | Resolution | Failure |
|---|---|---|---|---|
| ... | ... | ... | keyMap lookup in Pass 2 | fail loud |

## Deferred Property Queue (after Pass 2, before player resume)
| Order | Entity | Property | Why deferred | Depends on |
|---|---|---|---|---|
| 1 | ... | Rigidbody.velocity | body active / not re-zeroed by first FixedUpdate | — |

## Pre-Existing-Object Reconciliation
| Entity | Match key | Hook (rel. to scene load) | Spawn or match |
|---|---|---|---|
| ... | ... | OnSceneLoaded | match scene-placed |

## Environment Restoration
- Order relative to entities: after (world flags can affect spawned entities)
| World property | Setter | Notes |
|---|---|---|
| ... | ... | ... |
- **Excluded (not restored):** <UI history, prefs, graphics options> — rationale

## Overlay Control & Wait-For-Player
- Pause mechanism: <reuse game pause | build minimal Time.timeScale freeze>
- **Selection-time hook:** `onBeginRestore` (before room opens) → start async scene load + suppress intros;
  loader calls `NotifySceneReadyForRestore()` (begin-gate leg 3). NOT `onInitDone` (session-boot).
- **Post-restore resume hook:** `onRoomReady` (phase 2) → ApplyRestoredState → unpause → `BeginGameplay`
  (apply before unpause). NOT `ResumeGame`, NOT `PlayerReady` (doesn't exist), NOT a self-built prompt.
- **Mid-play overlay hooks** (CR-011): `AddNotifyPauseGame` → <file:method>  ·  `AddNotifyResumeGame` →
  <file:method>  ·  `AddNotifyReturnToMainMenu` → <file:method> (CR-007 exit)
- CR-010 freeze flag and CR-011 overlay flag are separate; paused iff either is set.

## Open Questions
- ...

## Needs Human Review (Low Confidence)
| Item | Reason | Action |
|---|---|---|
| ... | ... | ... |
```

## 7. ✅ Success Criteria

**Guideline phase-4 criteria this task feeds** (verified downstream at the human gates):
- [ ] The plan ensures the **reader does not assert on missing attributes** — every property states a
      `TryGetAttribute` → `false` fallback (keep default / error); only a missing **key** fails loud.
- [ ] The plan makes **human restore-verification** reachable — every tracked entity has a spawn function +
      setters, so task 4 can actually rebuild + restore the moment.

**Skill-specific self-validation (walk before handing back; fix any failure):**
- [ ] **Mirror is complete** — every entity in `OBJECT_TRACKING.md` has a restoration block; every property
      row a setter + Pass-2 mapping (or a deferred-queue entry). No row left un-reversed.
- [ ] **No stub rows** — every spawn function, setter, `keyMap` key, hook named with file:method (or a
      flagged Open Question), not `TODO`.
- [ ] **`objectType` strings match `OBJECT_TRACKING.md` / `LudeoKeys` exactly.**
- [ ] **Cross-Entity References table covers every reference property.**
- [ ] **Order is right** — `LudeoSelected` → switch to Play + freeze/suppress → start scene load
      (`onBeginRestore`) → cache reader in `HandleGetLudeoDone` → on `RoomReady` apply (Pass 1 + Pass 2 +
      env) → unfreeze → `Begin`. Not Begin-then-apply; not unfreeze-then-apply; not apply-in-GetLudeo.
- [ ] **Begin gate has all three legs** — `RoomReady ∧ AddGamePlayer ∧ sceneLoaded`; loader has a real
      completion signal (`NotifySceneReadyForRestore()`), not an unguaranteed `async void`.
- [ ] **Freeze-vs-suppress matches the apply shape** — async spawn is suppressed via `IsInLudeoFlow`, not
      frozen with `timeScale = 0` (which deadlocks `FixedUpdate`).
- [ ] **No SDK id-map anywhere** — identity is bucket + your stable key; `ObjectId` is not a match key (CR-014).
- [ ] **Overlay-control hooks named** (`AddNotifyPauseGame`/`ResumeGame`/`ReturnToMainMenu`), no `Request`
      suffix; **two separate pause flags** (CR-010 restore freeze vs CR-011 overlay).
- [ ] **Deferred queue is ordered** and each entry names *why* it defers.
- [ ] **Pre-existing reconciliation chose match-vs-spawn per entity** with a stable-key match.
- [ ] **Every matched / persistent singleton has a baseline reset named** (the player especially), running
      first in the apply. Freshly-spawned entities correctly have none.
- [ ] **Pre-match / location-override mechanisms enumerated**, each gated on `IsInLudeoFlow`.
- [ ] **Environment ordering** after-entities; exclusion list rationalized.
- [ ] **Low-confidence + Open Questions** populated (empty on a complex game is itself a yellow flag).
- [ ] **Disagreements** between `OBJECT_TRACKING.md` and `CODE_MAP.save_system.per_entity` surfaced.

## 8. Common Mistakes

- **Writing code / running anything** — this is analysis only; task 3/task 4 write code.
- **Introducing entities/properties tracking didn't capture** — the fix belongs in `phase 3`/task 1.
- **Planning a timeline replay** instead of a single-value snapshot apply.
- **Single-pass restoration** — silently corrupts reference graphs by spawn order (CR-006).
- **One shared pause flag** — a mid-play `ResumeGame` then unfreezes a restore (`07 §10.4`).
- **Freezing an async apply** with `timeScale = 0` — deadlocks `FixedUpdate` (`07 §10.1`).
- **Omitting a persistent-singleton baseline reset** — prior-run inventory/buffs/score leak across Ludeos.
- **Handing off without the self-validation pass** — gaps surface as bugs in task 3/task 4.

## Related / Next

- `phase 3` (`8-map-game-objects.md`) — produces `OBJECT_TRACKING.md`, the spine this plan mirrors.
- Task 1 (`9-implement-object-tracking.md`) — emits the capture code; restoration is its row-for-row inverse.
- **Next (orchestrator):** surface `RESTORATION_PLAN.md` for human approval, then dispatch task 3
  (`11-implement-restoration-flow.md`) followed by task 4 (`12-implement-state-reconstruction.md`).
