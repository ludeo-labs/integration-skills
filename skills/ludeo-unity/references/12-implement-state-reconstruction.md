# Phase 4 · Task 4 — Implement State Reconstruction (Unity)

> **Single-task subagent brief.** Dispatched by the phase-4 orchestrator
> (`9-tracking-restore-orchestrator.md`) **once per wave**. Fill **this wave's** buckets in the
> `ApplyRestoredState()` body (task 3 declared it as a stub on Wave 1) — the two-pass bucket read-back (the
> inverse of task 1's capture) — then return a summary + the files you created/edited. **You do not run the
> human-gated play test** — the orchestrator plays a captured Ludeo and reads the log. Finishing **Wave 1**
> turns a capture into a playable Ludeo; each later wave widens what restores. You run in isolated context —
> your inputs are the files in §2. Follow propose-confirm-execute.
>
> **Wave-loop role (additive buckets):** add **only this wave's** `objectType` buckets / property
> read-backs to `ApplyRestoredState()`. **Do not rewrite a previously-confirmed wave's buckets**, and do
> not touch the flow / entry chain / freeze flags (task 3's territory). The orchestrator verifies that this
> wave's **cumulative** set restores (prior waves still work + this wave's types now appear).
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Fill the **data** half of restoration — the inverse of task 1. Where task 1 registered objects and wrote
attributes (`SetAttribute`), this task spawns them in Pass 1 and reads attributes back with
`TryGetAttribute` in Pass 2. Produces the real `ApplyRestoredState()`: the restore-read accessors, the
per-Ludeo `keyMap`, the two-pass spawn + property apply + reference resolution, matched/singleton baseline
reset, the deferred-property queue, pre-existing reconciliation, and environment/world restore.

## The Seam from task 3

Task 3 declared `ApplyRestoredState()` as a stub and already calls it from the apply path
(`onRoomReady`/scene-load) in the correct order — **after the scene boot, while frozen/suppressed, before
`Begin`**. This task replaces the stub body with the real two-pass implementation. **Leave the call site,
the apply placement, the freeze/suppress mechanism, the entry-identity read, the `LudeoSelected` handler,
and the overlay registrations exactly as task 3 wrote them.** If you find yourself touching the entry
chain, the freeze flags, or the wait-for-player logic, you're in task 3's territory — stop.

`LudeoRestoredData` (the populated `LudeoStateObjectsLookup`) is handed to you by task 3; here you build
the accessors that **read** it and the per-entity apply. `IsInLudeoFlow` is set/cleared by task 3's flow —
this task only **reads** it, to gate pre-existing reconciliation (Step 7) so task 1's batch registration
doesn't double-create during a restore.

## 2. Inputs (Input Contract)

- [ ] **Task 3** → the apply lifecycle, the `LudeoRestoredData` cache, and the `ApplyRestoredState()` stub
      exist and are called; the orchestrator's flow gate passed (freeze → scene load → stub reached →
      `Begin`). **Hard prerequisite** — without its apply gate and the populated `LudeoRestoredData`, there
      is nothing to read back into.
- [ ] **Task 1** (`phase 9`) → the capture code exists, so the `objectType` strings, `LudeoKeys` constants,
      and stable-key attribute names you read back are **real and pinned**. **Hard prerequisite** — you
      cannot restore what task 1 didn't capture. If a key was renamed since the plan, reconcile first.
- [ ] **Task 2** → `ludeo-integration-plan/RESTORATION_PLAN.md` exists and the user **approved** it.
- [ ] Context files read (relative to this brief — the **data** reading list; the LudeoSelected-flow /
      freeze / overlay sections `07 §2/§10` belong to task 3):
  - `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — **§3.2/§3.3** (the restore-read `[Layer]`
    accessors + façade — the code you add), **§4** (two-pass + `keyMap` + the matched/singleton
    **baseline-reset callout**), **§5** (per-object apply snippets), **§6** (references, fail-loud), **§7**
    (deferred properties), **§8** (world/definitions restore), **§9** (pre-existing reconciliation).
  - `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — **§10** (the `OnStateDataUpdate` lambdas your
    `RestoreLudeoState` callbacks invert) + **§4** (identity by bucket + your own key). Read task 1's
    capture code as the other half of every apply.
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — **CR-006** (two-pass; **reset matched/singleton
    instances before applying**), **CR-014** (stable identity — never `GetInstanceID()`/`ObjectId`).
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the restore-read façade methods (`07 §3`).
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — exact `[SDK]` signatures (reproduce verbatim).

> **Skip any entity with unresolved Open Questions** in `RESTORATION_PLAN.md` — surface them to the
> orchestrator before generating its restore code.

## 3. Steps

> **Reproduce `[SDK]` signatures from `12-SDK-API-REFERENCE.md` verbatim** —
> `LudeoStateObjectRestore.TryGetAttribute(name, out value)` returns `bool` (the inverse of capture's
> `SetAttribute`, overloaded for `int/float/double/bool/string/Vector3/Quaternion/byte[]`). The `[Layer]`
> wraps these — the game calls the façade (`GetAndRestoreLudeoStateOfObject` / `RestoreLudeoStateOfObject` /
> `TryGetAllLudeoStateObjectByType`), not the raw reader.

### Step 1: Read the plan (data rows)
Read `ludeo-integration-plan/RESTORATION_PLAN.md`. Extract the **data** rows (interrupt-flow / freeze /
overlay rows are task 3's): the per-group strategy, the two-pass mapping (Pass 1a/1b split + `keyMap` key),
each entity's spawn function + per-property setters + approach (reconciliation/manual) + **baseline-reset**
(matched/persistent singletons), the Cross-Entity References table, the deferred-property queue (with
order), the pre-existing match-vs-spawn decisions, and the environment-restore order + exclusion list. Also
read `OBJECT_TRACKING.md` + the task-1 capture code so every read mirrors a write.

### Step 2: Add the restore-read `[Layer]` (07 §3.2/§3.3) — fill the stub infrastructure
Add the **restore-read additions** that `ApplyRestoredState()` uses (reproduce from `07 §3` — names are
conventions the game may already use):
- **`LudeoPlayFlow` bucket accessors** (`07 §3.2`) — `RestoreLudeoStateOfObject` (singleton `[0]` +
  pass-through overload), `TryGetAllLudeoStateObjectByType` (collection). `LudeoCreatorFlow`/
  `DisabledLudeoFlow` implement all three as **no-ops** — restore only happens in the play flow (CR-001).
- **`LudeoController` façade methods** (`07 §3.3`) — `GetAndRestoreLudeoStateOfObject`,
  `RestoreLudeoStateOfObject`, `TryGetAllLudeoStateObjectByType`, `GetLudeoTrackedDefinitions`. The game
  calls only these.
- **`TrackedDefinitionsForLudeo`** — the world-definitions rebuild read out of `LudeoRestoredData`
  (`07 §3.1`/§8), surfaced via `GetLudeoTrackedDefinitions()`.

These read the `LudeoStateObjectsLookup` that task 3's `LudeoRestoredData` already populated. **Do not
re-wire** the `ApplyRestoredState()` call site, the freeze, or the entry chain (task 3's contract) — only
fill the body and the accessors it calls.

### Step 3: Implement the two-pass apply (CR-006, `07 §4`)
The Unity model has **no SDK id-map** — build your own `keyMap` from the stable-key attribute you captured.
Implement exactly the Pass 1 / Pass 2 split the plan recorded, inside `ApplyRestoredState()`:
- **Pass 1 — Create:** for each `objectType` bucket, spawn a **type-only** instance via the entity's spawn
  function, read its **stable-key attribute** (`TryGetAttribute` `[SDK]`), and add
  `keyMap[stableKey] = instance`. Singletons (the player) take bucket `[0]` and need no key. **A matched
  instance or persistent singleton (`07 §4`/§9) is NOT spawned here — it kept the prior run's state; the
  plan named its baseline reset, run it first in Pass 2 (Step 4).**
- **Pass 2 — Apply + Resolve:** read non-reference attributes → setters; resolve reference attributes via
  `keyMap` (Step 5).

```csharp
// SINGLETON (player): the restore driver invokes the apply synchronously via the façade   [Layer]
LudeoController.Instance.GetAndRestoreLudeoStateOfObject(LudeoPlayerKeys.OBJECT_NAME, RestoreLudeoState);

// COLLECTION (enemies): the spawner pulls the bucket, spawns type-only, and applies EACH ENTRY in this loop
LudeoController.Instance.TryGetAllLudeoStateObjectByType(enemyObjectType, out List<LudeoStateObjectRestore> bucket); // [Layer]
for (int i = 0; i < bucket.Count; ++i) {
    EnemyController e = SpawnEnemy(/* type-only */);          // Pass 1: create (Awake activates it)   [Unity]
    LudeoController.Instance.RestoreLudeoStateOfObject(       // Pass 2: apply NOW, in the driver's call stack
        bucket[i], e.RestoreLudeoState);                     // [Layer] — NOT stashed for the instance's Start()
}
```

> **⚠️ Apply synchronously from the driver — never defer the apply to the spawned object's `Start`/`OnEnable`
> (`07 §4`).** Do **not** stash the entry on the instance and let the object pull-and-apply from its own
> setup callback. **Unity does not guarantee `Start()` (and may defer/skip `OnEnable`) for objects
> `Instantiate`d during a scene load/unload transition — exactly the restore path.** A dropped-`Start`
> instance never receives its state and sits frozen at its spawn defaults; the failure hides on the
> **first** replay and surfaces on the **2nd+ replay in one session**. It also breaks two-pass ordering
> (Pass 2 must follow all of Pass 1, Step 5). Activate the instance in `Awake` (always synchronous at
> `Instantiate`); apply **state** from the driver's Pass-2 sweep; make the apply **idempotent** so a late
> `Start()` re-apply is harmless.

`keyMap` (`Dictionary<yourKey, GameObject>`) is **per-Ludeo, discarded after restore**. If the plan split
Pass 1 into **1a (foundational)** / **1b (dependent)**, preserve that order.

> **Missing-key policy:** a Pass-2 `keyMap` miss is a **Pass-1 bug — fail loud, never substitute null**
> (Step 5). A missing *optional attribute* (`TryGetAttribute` → `false`) just keeps the spawn default
> (`07 §1.4`). Implement the per-property fallback the plan specified — don't fail the whole restore on one
> missing optional field.

### Step 4: Write the per-entity `RestoreLudeoState` callbacks (07 §5)
For **each** tracked entity, write the apply callback as the **inverse of its task-1 `OnStateDataUpdate`
lambda** — same `LudeoKeys` `[Layer]` constants, `TryGetAttribute` `[SDK]` read → live-object setter `[Unity]`:

```csharp
void RestoreLudeoState(LudeoStateObjectRestore r) {          // inverse of the 06 §10 capture lambda
    ResetToBaseline();                                       // [Unity] matched/persistent singleton ONLY (07 §4):
                                                             // clear prior-run state (inventory/buffs/score/cooldowns)
    r.TryGetAttribute(K.Position, out Vector3 pos);          // [SDK] read back what SetAttribute wrote
    r.TryGetAttribute(K.HP,       out int hp);
    transform.position = pos;  m_player.UpdateCurrentHP(hp);  // [Unity]
    // r.TryGetAttribute(K.Velocity, ...) → DEFER (Step 6)
    // r.TryGetAttribute(K.TargetId, ...) → resolve in Pass 2 via keyMap (Step 5)
}
```

Drive each from the plan's per-entity block:
- **Approach** — `reconciliation` (route through the game's recreate/load path) or `manual` (explicit
  `TryGetAttribute` → setter), **per entity from the matrix** — never re-decided by policy here.
- **Baseline reset first** — if the plan flagged the entity a **matched instance or persistent singleton**
  (the player on `DontDestroyOnLoad`/`static`/an SO-held reference), call its reset (the plan named it)
  **at the top of the apply, before any `TryGetAttribute`**. It was never re-instantiated, so uncaptured
  fields (inventory, ammo, buffs, score, cooldowns, status flags) survive from the prior run and leak in
  otherwise. Freshly-spawned entities skip this — `Instantiate` already gave them a clean slate.
- **Collections** read their stable key into `keyMap` in Pass 1 (Step 3); **singletons** don't.
- Match `objectType` strings and `LudeoKeys` constants **exactly** to the capture side — a mismatch
  silently returns an empty bucket / `false`.

### Step 5: Resolve cross-entity references in Pass 2 (07 §6)
For every row in the plan's Cross-Entity References table, the captured value is the **target's stable key**;
resolve it against `keyMap` in Pass 2 and **fail loud on a miss**:

```csharp
r.TryGetAttribute(LudeoWeaponKeys.OwnerId, out int ownerKey);    // [SDK] captured target key
if (keyMap.TryGetValue(ownerKey, out GameObject owner))          // [Unity]
    m_owner = owner.GetComponent<TankPlayer>();
else
    Debug.LogError($"restore: OwnerId {ownerKey} not in keyMap — Pass 1 bug");   // FAIL LOUD, never null
```

A substituted `null` produces a silently broken replay. Every reference row must have a resolution step;
any with no path is an Open Question — surface it to the orchestrator.

### Step 6: Apply deferred properties after Pass 2, before `Begin` (07 §7)
Implement the plan's deferred-property queue **in its recorded order** — these revert/no-op if applied at
spawn because their subsystem isn't online yet:
- `Rigidbody.velocity`/`angularVelocity` `[Unity]` — after the body is active, before the first sim step.
- `Animator` state/normalized time `[Unity]` — after the `Animator` is enabled + past its entry transition.
- `NavMeshAgent` position/path `[Unity]` — after the agent is on the NavMesh (use `Warp`).
- Ability/cooldown timers — after any `Start`/`OnEnable` re-initializer has run.

The freeze (task 3, Step 4) holds until these are applied, so the player never sees the pre-defer frame.
Don't infer ordering at runtime — follow the queue.

### Step 7: World / environment restore (07 §8)
Implement the world rebuild the plan specified, driven by the restored definitions:

```csharp
LudeoTrackedDefinitions defs = LudeoController.Instance.GetLudeoTrackedDefinitions();   // [Layer]
SpawnLevel(defs.gameConfig, defs.levelIdx);   // rebuild level/spawn definitions BEFORE entities
SetMusic(defs.gameMusic);
// then spawn + restore entities (Step 3) into that rebuilt world
```

**Ordering:** restore **level/spawn definitions before** entities; restore **world/environment state after**
entities when a world flag could despawn/alter a just-spawned entity. Honor the plan's **exclusion list**.

> **Procedural / non-deterministic assembly (`game-patterns/procedural-world.md §5`, `07 §8`):** "load the
> scene" is not restoration — it yields an empty container and the generator re-rolls. Read the captured
> `RunMetadata` (via `GetLudeoTrackedDefinitions()` `[Layer]`) and **re-drive the level builder/pool from
> the generation inputs**, gating `RandomChunk`/`GetEncounterByLevel`/wave-rolls on `IsInLudeoFlow` so they
> return the *captured* ids instead of rolling. Restore the scaling counter (combat level) **before** any
> post-restore spawn, and assemble the container **before** the two-pass entity restore.

### Step 8: Pre-existing-object reconciliation (07 §9)
For each batch-registered type, implement the plan's match-vs-spawn decision — **match** the scene-placed
instance by stable key (don't double-spawn) for objects the scene always places; **spawn** fresh from the
bucket for objects the captured run created dynamically. **A matched instance kept the prior run's state —
reset it to baseline before applying (Step 4 / `07 §9`).** This whole path runs only because `IsInLudeoFlow`
is `true` (set by task 3); the creator flow uses `06 §6` batch *registration* instead — gate it on
`!IsInLudeoFlow` so it doesn't also fire during a restore.

> **Open-world / streaming:** re-bind by **persistent world id** across stream cycles, restore only the
> loaded neighborhood (`game-patterns/open-world-tracking.md`).

### Step 9: Self-check, then hand back (no play test here)
You do **not** play a Ludeo — the orchestrator does. Before returning, statically self-check against §7's
pre-handoff criteria, then return a summary + the files you created/edited + any open questions. **The
runtime gate (play a captured Ludeo: restored snapshot on the first frame, non-zero two-pass counts,
cross-ref resolved, no `keyMap`-miss; replay-twice shows the second's state) is the orchestrator's** — it
cannot be verified from this isolated context.

## 4. Questions to ask the human

Surface to the orchestrator; don't guess:
- A **reference row with no resolution path** in the plan's Cross-Entity References table.
- A `LudeoKeys` constant / `objectType` string that **disagrees with the task-1 capture code** (renamed
  since the plan) — reconcile before generating apply code.
- A **setter or spawn function the plan names that doesn't exist** — propose adding it as a separate change.

## 5. Patterns to apply

- **Restoration mirrors tracking.** Every read inverts a task-1 write — same `LudeoKeys`, same `objectType`
  buckets. A gap means the fix is in `phase 3`/task 1, not a fabricated attribute here.
- **Don't touch the flow.** The apply gate, freeze, `LudeoSelected` handler, overlay registrations, and
  entry-identity/scene-boot are task 3's. This task only fills `ApplyRestoredState()` and its accessors.
- **No SDK id-map, no `EnterObject`, no `ObjectId` matching** — identity is bucket + your own stable key
  (`07 §4`); `LudeoStateObjectRestore.ObjectId` is an SDK `uint`, never a match key (CR-014).
- **Snapshot, not replay.** `dynamic` captures restore as the single final value, applied once.
- **Two-pass is mandatory (CR-006).** Pass 1 spawns + builds `keyMap`; Pass 2 applies + resolves references.
- **Apply synchronously from the driver** — never defer to a spawned object's `Start`/`OnEnable` (dropped
  on scene-transition spawns → frozen 2nd-replay). Make the apply idempotent.
- **Reset matched/persistent singletons before applying (`07 §4`).** Uncaptured state leaks otherwise.
- **Fail loud on a missing reference key**; keep the spawn default on a missing *optional* attribute.
- **Read `IsInLudeoFlow`, don't set it** — it's task 3's switch; here it only gates pre-existing reconciliation.
- **Gate spawn *triggers*, never the spawn *primitive* (`07 §9`).** A wave-start / combat-start / refill
  trigger that fires during play-forward duplicates the restored population on top of the snapshot — gate
  it on `IsInLudeoFlow`. The per-enemy spawn primitive (`AIManager.Spawn`) stays **ungated** — Pass 1 calls
  it to place the restored entities. Suppress a trigger that re-creates the **restored** wave; keep one that
  merely advances to the next wave from the restored cursor.
- **Don't modify game logic** beyond the restore read-back; propose-confirm-execute every change.

## 6. Output Contract

- The filled `ApplyRestoredState()` — the two-pass apply with a per-Ludeo `keyMap`, per-entity
  `RestoreLudeoState` callbacks, cross-entity reference resolution, baseline reset, deferred-property queue,
  pre-existing reconciliation, and world/environment restore.
- The restore-read `[Layer]`: `LudeoPlayFlow` bucket accessors, `LudeoController` façade methods,
  `TrackedDefinitionsForLudeo` (with backups for edited game files).
- A report: (1) restore-read `[Layer]` added, (2) entities restored X/Y + properties immediate/deferred +
  references resolved, (3) baseline-reset list, (4) pre-existing match/spawn counts, (5) environment
  restored + excluded, (6) skipped (open questions), (7) files modified, (8) ready for the orchestrator's
  state gate.
- **No compile / play performed** — that's the orchestrator's human gate.

## 7. ✅ Success Criteria

**Guideline phase-4 criteria this task feeds** (verified at the orchestrator's gate, not here):
- [ ] **Captured highlight plays back and visibly restores positions/state** — restored snapshot present on
      the first visible frame, non-zero two-pass counts, a cross-entity reference resolved correctly.
- [ ] **Reader does not assert on missing attributes** — `TryGetAttribute` → `false` keeps the spawn
      default; only a missing **key** fails loud.
- [ ] **Restore verified by a human** — including the replay-twice no-leak test (second Ludeo's state shows,
      not the first's; no dropped-`Start` defaults).

**Skill-specific pre-handoff criteria (satisfy before returning):**
- [ ] `ApplyRestoredState()` implements the plan's exact Pass 1 / Pass 2 split with a per-Ludeo `keyMap`
      (discarded after restore); Pass 1a/1b order preserved if the plan split it.
- [ ] Each entity has a `RestoreLudeoState` callback that is the inverse of its task-1 lambda — same
      `LudeoKeys` constants, `objectType` strings matched exactly.
- [ ] Apply is driven **synchronously from the restore loop**, never deferred to a spawned object's
      `Start`/`OnEnable`; the apply is idempotent.
- [ ] Matched instances / persistent singletons reset to baseline **before** any `TryGetAttribute`.
- [ ] Cross-entity references resolved via `keyMap` in Pass 2, **fail loud** on a miss (never null).
- [ ] Deferred-property queue applied after Pass 2, before `Begin`, in the plan's order.
- [ ] World/level definitions restored **before** entities; environment **after**; exclusion list honored.
- [ ] Pre-existing reconciliation gated on `IsInLudeoFlow`; batch *registration* gated `!IsInLudeoFlow`.
- [ ] Restore-read accessors are no-ops in creator/disabled flows (CR-001); the task-3 call site/freeze/entry
      chain left untouched (the Seam); backups for edited files.

## 8. Common Mistakes

- **Compiling / playing here** — the orchestrator owns the (human-gated) state-verify play test.
- **Touching task 3's flow** — the apply gate, freeze, entry chain, overlay are not yours to re-wire.
- **Deferring the apply to a spawned object's `Start`/`OnEnable`** — dropped on scene-transition spawns →
  frozen 2nd-replay (`07 §4`). Apply synchronously from the driver.
- **Single-pass apply** — silently corrupts reference graphs by spawn order (CR-006).
- **Substituting null on a missing reference key** instead of failing loud (Pass-1 bug).
- **Omitting a persistent-singleton baseline reset** — prior-run inventory/buffs/score leak across Ludeos.
- **Fabricating an attribute task 1 didn't capture** — the fix belongs in `phase 3`/task 1.
- **`ObjectId`/`GetInstanceID()` as a match key** (CR-014).

## Related / Next

- Task 1 (`9-implement-object-tracking.md`) — emits the capture code; this is its row-for-row inverse.
- Task 2 (`10-plan-state-restoration.md`) — produces `RESTORATION_PLAN.md`, the plan this task implements.
- Task 3 (`11-implement-restoration-flow.md`) — built the apply lifecycle + the `ApplyRestoredState()` stub
  this task fills (hard prerequisite).
- **Next (orchestrator):** run the task-4 state gate (play a captured Ludeo: first-frame snapshot, non-zero
  counts, cross-ref resolved; replay-twice no-leak). When it passes, **phase 4 is complete** — the player
  flow is proven and phase 5 (actions) may begin.
