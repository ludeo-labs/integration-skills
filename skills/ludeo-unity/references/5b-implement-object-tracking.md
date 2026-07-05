# Phase 5 · Task 1 — Implement Object Tracking (Unity)

> **Single-task subagent brief.** Dispatched by the phase-5 orchestrator
> (`5-tracking-restore-orchestrator.md`) **once per wave**. Wire the `[Layer]` handler calls for **this
> wave's** entities (the `## Entity` rows task 0 just appended for `wave: N`), then return a summary + the
> files you created/edited. **You do not run the human-gated compile/play** — the orchestrator runs it (it
> can see neither the Editor Console nor a captured session). You run in isolated context — your inputs are
> the files in §2. Follow propose-confirm-execute.
>
> **Wave-loop role (additive):** capture grows **per wave**. Wire only **this wave's** types; **do not edit
> a previously-confirmed wave's writers, `objectType` buckets, or `LudeoKeys`** — append new ones. Adding
> attributes changes the capture schema, so the orchestrator will have the human **re-capture** at your
> gate (prior-wave Ludeos are now stale, `06 §6`).
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Wire the **creator/write side** of tracking: from `OBJECT_TRACKING.md`, register a
`DefaultLudeoStateHandler` per tracked GameObject, supply its `OnStateDataUpdate` writer, sample each
tick, unregister on real removal, fill the `LudeoKeys` constants, and register pre-existing objects in a
batch pass. Produces the capture code the orchestrator then verifies at runtime — and the
`objectType`/`LudeoKeys` surface that restoration (tasks 2–4) mirrors row-for-row.

## 2. Inputs (Input Contract)

- [ ] **This wave's rows** in `ludeo-integration-plan/OBJECT_TRACKING.md` — the `## Entity` blocks tagged
      `wave: N` that **task 0** (`5a-deep-scope-wave.md`) appended and the user **approved** at the task-0
      gate (entity model, `objectType` strings, stable keys, property kinds + cadence, batch/stream-in
      sites, cross-entity references, per-entity reconciliation/manual matrix; for Wave 1, the
      world-identity + time-base objects). The orchestrator tells you **which wave `N`**. Wire **only**
      those types.
- [ ] **Phase 3** → the `[Layer]` exists (`LudeoController` + flow switch + `DefaultLudeoStateHandler` +
      a `LudeoKeys` scaffold) and the SDK lifecycle compiles/runs.
- [ ] Context files read (relative to this brief):
  - `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — **§1.4** (attributes vs blobs), **§3** (the
    handler model — register / per-tick sample / unregister, and the **creator-only rule box**), **§4**
    (identity by bucket + your own key, **no ID map**), **§5** (where registration plugs in), **§6**
    (batch registration), **§10** (the constants/keys class), **§11** (cadence). All canonical code lives here.
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the `[Layer]` you're calling
    (`LudeoController`, `ILudeoStateHandler`/`DefaultLudeoStateHandler`, `LudeoKeys`).
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — **CR-001** (disable is **runtime via the
    dummy, not `#if`**), **CR-005** (no SDK tick — you drive `UpdateStateObjects()`), **CR-013** (main
    thread), **CR-014** (stable identity, no `GetInstanceID()`).
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — exact `[SDK]` signatures (reproduce verbatim).

> **Skip entities with unresolved Open Questions** in `OBJECT_TRACKING.md` — surface them to the
> orchestrator before generating their code.

## 3. Steps

> **Reproduce `[SDK]` signatures from `12-SDK-API-REFERENCE.md` verbatim** —
> `LudeoRoom.CreateStateObject(objectType, out LudeoStateObject)` returns `LudeoResult`;
> `LudeoStateObject.SetAttribute(name, value)` is overloaded for
> `int/float/double/bool/string/Vector3/Quaternion/byte[]`. The `[Layer]` already wraps these — you call
> the façade, not the raw SDK.

### Step 1: Read the plan
Read `ludeo-integration-plan/OBJECT_TRACKING.md`. Per entity, extract: objectType string, spawn/own
pattern (§2.x), register/unregister hook sites (file:line), stable-key source, properties (kind + type
+ cadence), reference targets, restoration approach (reconciliation / manual), and the streaming flags.
Also extract the Batch/Stream-in table, the Time-Base/Continuity singleton, and Cross-Entity References.

### Step 2: Choose the implementation style
Two-plus valid ways to wire the handler (`06 §5`). Decide up front — it changes *where* the register
call + lambda live:
- **Entity-embedded** (default): each MonoBehaviour registers itself (in `Start`/spawn) and its
  `OnStateDataUpdate` lambda samples its own fields. Use when the object has its state locally and
  lifetimes are irregular.
- **Centralized in the spawner/manager** (§2.2): the manager that owns the objects registers a handler
  per instance and the lambda pulls via the object's accessors. Keeps SDK touch-points in one place
  (CR-009 spirit); prefer it when a clean manager/factory + accessors exist. Touches fewer game files.
- **Manager-sweep** (§2.7): a Ludeo-side manager sweeps the game's **save/serializer accessors** each
  throttled tick (not the scene), keeping one handler per **stable id** — it diffs the sweep set to
  register newcomers and stop vanished ids; there is **no per-GameObject register/unregister**. Use
  **only** when the game has a strong stable-id save manager but exposes no live-object enumerator
  (`06 §2.7`). The `OnStateDataUpdate` lambda reads from the swept record, and you **must supplement any
  viewer-visible state the serializer omits** (`06 §2.7` floor-not-ceiling). Singletons not in the
  accessors (player, world, quest) stay entity-embedded.

You may mix per subsystem. State the chosen style and confirm before generating code. The
`!IsInLudeoFlow` guard (capture is creator-only) and cadence rules are identical across all; identity is
local-fields for the first two and the serializer's stable id for the sweep.

### Step 3: Ensure the keys class exists (no macros, no adapter)
Unity needs **no** `LudeoCaptureMacros.h` and **no** `LudeoStateAdapter`/ID-map — the `[Layer]` from
`phase 3` already provides `DefaultLudeoStateHandler` and the tracked-handler registry. The one piece to
complete is the **constants class(es)**: one `LudeoKeys`-style class per tracked objectType (the
`OBJECT_NAME` objectType string + one `const string` per attribute name), so capture and restore
(`phase 5`/task 4) read the **same** constants (`06 §10`, REFERENCE-ARCHITECTURE "Keys"). Phase 3
scaffolded this — fill it from the plan's property names. Propose the class(es), confirm, then proceed.

### Step 4: Wire the register call + the `OnStateDataUpdate` writer
For each entity, at its **register hook** (per Step 5), emit the canonical `06 §3.1` call — **guarded
creator-only** (`06 §3` rule box):

```csharp
if (LudeoController.Instance.IsInLudeoFlow) return;   // [Layer] capture is creator-only; play restores from buckets
m_handler = LudeoController.Instance.StartTrackingLudeoState<DefaultLudeoStateHandler>(   // [Layer]
    <Keys>.OBJECT_NAME,
    obj => {                                          // OnStateDataUpdate — runs each sampling tick
        obj.SetAttribute(<Keys>.Key, m_myStableKey);  // [SDK] identity/key — write every tick (diff-sent, free)
        obj.SetAttribute(<Keys>.Position, transform.position);   // [SDK] Vector3 [Unity]
        // … every kept property from the plan …
    });
```

Keep the returned handler. Write **identity/key and dynamics in the same lambda** — never "register now,
key later" (`06 §3.1`). Singletons (the player) need no key; collections write their stable key (§4).

### Step 5: Wire register/unregister into hook sites
Hook sites come from the plan's pattern classification (`06 §2`/§5):

| Pattern | Register at | Unregister at |
|---|---|---|
| §2.1 Direct `Instantiate`/`Destroy` | spawn site, or the object's `Start` (gameplay active) | `OnDestroy` `[Unity]` |
| §2.2 Central spawner/manager | inside `Spawn`, after build | inside `Despawn`/`Destroy` |
| §2.3 Object pool | on `Get()` **after re-init** | on `Release()` / deactivate (not `OnDestroy`) |
| §2.4 Prefab/data-driven | the shared `Spawn`; objectType = prefab id | the shared `Despawn` |
| §2.7 Manager/serializer sweep | on first appearance in the sweep (one state object per stable id) | when the id **drops out of the sweep set** — never `OnDestroy` |

Unregister: `LudeoController.Instance.StopTrackingLudeoState(m_handler);` `[Layer]` (`06 §3.3`).
`EndGameplay` already stops all handlers on every exit path (CR-007), so per-object stop is only for
objects that die **during** a run.

> **§2.7 has no per-GameObject hook.** You never hook `Start`/`OnDestroy` on the tracked objects — the
> sweep-to-sweep diff *is* the register/unregister, so the streaming `OnDestroy`=stream-out trap can't
> arise (existence is the manager's current set, `06 §2.7`/§3.3). Keep one handler per stable id and reuse
> it across sweeps; only `StopTrackingLudeoState` when an id leaves the set.

> **Streaming worlds (`game-patterns/open-world-tracking.md §2`): do not unregister on stream-out.** The
> despawn hook also fires when a cell unloads — gate `StopTrackingLudeoState` on a real removal signal
> (death/consume/destroy), not on `OnDestroy` alone. Instrument fast-path spawners (pool acquires, bulk
> loaders) that bypass the manager.

### Step 6: Per-tick sampling + cadence
Capture is **per-tick sampling**, not per-setter (the lambda re-reads live state each tick). Confirm the
sampler driver exists (from `phase 3`'s gameplay MonoBehaviour) and is gated correctly:

```csharp
void Update() { if (m_gameplayActive && !LudeoController.Instance.IsInLudeoFlow) LudeoController.Instance.UpdateStateObjects(); } // [Unity]→[Layer]
```

Do **not** wire an SDK tick (CR-005); sample on the **main thread** (CR-013). Apply cadence from the
plan: per-tick is the default; add skip-unchanged guards or throttle distant objects only where the plan
called for it (`06 §11`). **References** capture the target's **stable key**, never a reference
(`06 §4`). Suspend sampling in menus/cutscenes via the game's own flags (`06 §8`).

### Step 7: Batch registration for pre-existing objects
For each entry in the plan's Batch/Stream-in table, add a pass that registers everything already alive
when gameplay begins, **skipped in the play flow** (`06 §6`):

```csharp
void OnGameplayBegan()
{
    if (LudeoController.Instance.IsInLudeoFlow) return;   // [Layer] play flow → objects come from buckets
    foreach (var e in <Manager>.Instance.All) e.RegisterLudeoTracking();   // each calls StartTrackingLudeoState
    // REQUIRED: register the world/level IDENTITY (scene name / level index / chunk-room-seed) as its own
    // objectType, sampled per-tick — restoration's very FIRST step rebuilds the world from it (07 §8).
    // Also register run/world metadata (mode, region, weather) on the same object where gameplay-relevant.
}
```

`IsInLudeoFlow` `[Layer]` already exists on the controller (`m_data.isInLudeo`) — **no stub needed**;
don't invent an ad-hoc "is this a replay" check. Streaming worlds: register stream-in newcomers at their
stream-in hook, not in a one-shot whole-world pass (`open-world-tracking.md §6`).

> **⚠️ The world/level identity key is a capture requirement, not a restore-time afterthought.** Phase 5 · task 3's
> first action is to rebuild the captured world, and it can only restore what *this* task wrote — a Ludeo
> captured before the identity attribute existed comes back with an empty key and "chunk '' not found"
> (`07 §8`). Capture it here, sampled every tick. **Corollary:** adding *or renaming* any capture attribute
> (here or in a later phase) **invalidates every previously captured Ludeo** for that field — there is no
> migration. After any capture-schema change, tell the orchestrator the human must **re-capture** before
> testing restore; a fresh run re-samples valid data.

> **Time-base / continuity (`phase 4` Step 4.5):** implement the singleton `SessionState`/`Continuity`
> objectType the plan defined — master/session clock (`AudioSource.time`/`dspTime`, beat/bar), **remaining**
> timers & cooldowns, in-progress sequence/wave/combo index — sampled per-tick. Without it the moment
> rebuilds but replays from the top (a rhythm moment restarts its music).

> **Procedural-assembly games (`game-patterns/procedural-world.md §3`):** implement the plan's singleton
> **`RunMetadata`** objectType capturing the **generation inputs** — selection id (chunk/room/seed),
> sub-roll id (encounter/wave-set), progress cursor (wave/depth), scaling counter (combat level) — as
> **stable asset names/values** (never instance ids / scene index / list position, CR-014). Sample it
> per-tick alongside the player. This is what lets task 4 rebuild the *container* the entities live in.

### Step 8: Reconciliation wiring (only where the matrix says so)
For entities marked **reconciliation** in the per-entity matrix (`OBJECT_TRACKING.md` entity rows /
`CODE_MAP.save_system.per_entity`, built in `phase 4`): have the `OnStateDataUpdate` lambda mirror the
named fields the game's own serializer writes. For **manual** entities, all writes are the explicit
`SetAttribute` calls from Step 4.

> ⚠️ **Reconciliation only applies when the save writes named fields.** If the serializer produces an
> opaque/packed blob, you cannot mirror it into Ludeo's named-attribute API — capture discrete
> attributes instead and treat the entity as manual, regardless of the matrix. Surface any
> "reconciliation" entry that actually serializes a blob to the orchestrator (`phase 4` Step 8, `06 §1.4`).

### Step 9: Self-check, then hand back (no compile here)
You do **not** run the human-gated compile/play — the orchestrator does. Before returning, statically
self-check against §7's pre-handoff criteria, then return a summary + the files you created/edited + any
open questions. **The runtime gate (recompile clean + capture a session + no `LudeoResult` errors in the
log) is the orchestrator's** — it cannot be verified from this isolated context.

## 4. Questions to ask the human

Surface to the orchestrator; don't guess:
- A **collection type with no resolvable stable key** in the plan — adding one is a prerequisite.
- An entity the matrix marks **reconciliation** that actually serializes an **opaque blob** — treat as
  manual and report it.
- A **register/unregister hook site the plan names that doesn't exist** — propose adding it as a separate
  named change first; don't invent game logic.

## 5. Patterns to apply

- **Propose-confirm-execute** for every change; confirm the keys class(es) before creating.
- **No `#if LUDEO_SDK_ENABLED` at capture sites** — disable is runtime via the dummy (CR-001). Only the
  optional package-excluding `LUDEO_SDK` define uses `#if` (the rare ship-without-package case).
- **No ID map, no macros, no `EnterObject`/`LeaveObject`** — identity is bucket + your own key (`06 §4`);
  CR-002 is N/A in Unity.
- **Capture is creator-only** — guard every register + the sampler on `!IsInLudeoFlow` (`06 §3` rule box).
- **No SDK tick** (CR-005); sample on the **main thread** (CR-013); never key on `GetInstanceID()` (CR-014).
- **Attributes by default, not blobs** (`06 §1.4`) — `byte[]` only for entities the plan flagged.
- **Match `objectType` strings exactly** to `OBJECT_TRACKING.md` — restoration looks them up by name.
- **Don't modify game logic** — only add `[Layer]` calls; if a hook site is missing, propose adding it
  as a separate named change first.

## 6. Output Contract

- Capture code wired per entity: register/unregister calls + `OnStateDataUpdate` writers at the plan's
  hook sites (with backups for edited game files).
- Filled `LudeoKeys`-style constants class(es) — one per tracked objectType.
- The batch/stream-in registration pass, the world/level identity objectType, and the time-base/continuity
  singleton (+ `RunMetadata` for procedural games).
- A report: (1) style chosen (per subsystem if mixed), (2) keys classes created/filled, (3) entities
  instrumented X/Y + properties wired, (4) batch sites, (5) reconciliation vs manual counts, (6) skipped
  (open questions), (7) files modified, (8) ready for the orchestrator's runtime gate.
- **No compile performed** — that's the orchestrator's human gate.

## 7. ✅ Success Criteria

**Guideline phase-5 criteria this task feeds** (verified at the orchestrator's gate, not here):
- [ ] Capture runs at runtime — registration fires and ≥1 Ludeo can be captured with **no**
      `LudeoResult`/dropped-attribute errors in the log (orchestrator's task-1 gate; the precondition for
      any restore test).

**Skill-specific pre-handoff criteria (satisfy before returning):**
- [ ] Every non-skipped entity in `OBJECT_TRACKING.md` has a register call + an `OnStateDataUpdate` writer
      covering its kept properties, at the plan's hook sites.
- [ ] Every register + the sampler is guarded `!IsInLudeoFlow` (capture is creator-only, `06 §3`).
- [ ] `LudeoKeys` constants exist for every tracked objectType; `objectType` strings match the plan exactly.
- [ ] Collections write a **stable key** attribute every tick (no `GetInstanceID()`/references, CR-014);
      singletons need none.
- [ ] The **world/level identity** objectType and the **time-base/continuity** singleton are captured
      per-tick (+ `RunMetadata` for procedural games).
- [ ] Batch/stream-in pass registers pre-existing objects, skipped when `IsInLudeoFlow`; stream-out does
      **not** unregister (open-world).
- [ ] `UpdateStateObjects()` driven per active-gameplay frame; **no** SDK tick (CR-005), main thread (CR-013).
- [ ] No `#if` toggling at capture sites (CR-001 is runtime); backups exist for edited game files.

## 8. Common Mistakes

- **Compiling here** — the orchestrator owns the (human-gated) compile + capture verification.
- **Splitting "register now, key later"** instead of writing identity + dynamics in one lambda (`06 §3.1`).
- **Unregistering on `OnDestroy`/stream-out** in a streaming world (presence ≠ existence).
- **Defaulting to blobs** instead of discrete typed attributes (`06 §1.4`).
- **Keying on `GetInstanceID()` / object references** (CR-014) — unstable across runs and stream cycles.
- **Skipping the world-identity or time-base/continuity object** — the Ludeo rebuilds but can't be
  relocated / resumed; the failure only shows at restore.
- **Wiring an SDK tick** (CR-005) or sampling off the main thread (CR-013).

## Related / Next

- `phase 4` (`4-map-game-objects.md`) — produces `OBJECT_TRACKING.md`, the plan this task consumes.
- **Next (orchestrator):** run the task-1 human gate (recompile + capture a session), then dispatch task 2
  (`5c-plan-state-restoration.md`) — restoration is the row-for-row inverse of this capture.
