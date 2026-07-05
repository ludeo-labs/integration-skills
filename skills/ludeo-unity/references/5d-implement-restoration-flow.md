# Phase 5 · Task 3 — Implement Restoration Flow (Unity)

> **Single-task subagent brief.** Dispatched by the phase-5 orchestrator
> (`5-tracking-restore-orchestrator.md`) **once — in Wave 1 only.** Wire the restore-side **flow** (the
> inverse of `phase 3`'s session lifecycle), declare `ApplyRestoredState()` as a **stub**, then return a
> summary + the files you created/edited. **You do not run the human-gated play test** — the orchestrator
> plays a captured Ludeo and reads the log (you can see neither the Console nor a live replay). You run in
> isolated context — your inputs are the files in §2. Follow propose-confirm-execute.
>
> **Wave-loop role (one-time plumbing):** the restore **flow** is moment-agnostic — built once in Wave 1
> and **not re-run for later waves** (waves ≥2 only grow capture + the `ApplyRestoredState()` data
> read-back, task 4). Make the stub and the apply call site **wave-agnostic**: the flow calls
> `ApplyRestoredState()`; task 4 fills it, bucket by bucket, growing each wave. Do not bake any single
> wave's entity set into the flow.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Build **when and how** a Ludeo is triggered, frozen, applied, and resumed — the SDK-orchestration half of
restoration: the `HandleLudeoSelected → GetLudeo → HandleGetLudeoDone` entry chain, re-entrant teardown,
`LudeoRestoredData` reader extraction + cache, `onBeginRestore` scene load + the begin-gate's third leg,
`InitRoom`, the CR-010 freeze/suppress, `RoomReady → Begin` resume, CR-011 overlay pause/resume, and the
reset-every-restore pause flags. It does **not** read entity state back into the world (that is task 4).
The two halves meet at one seam: the apply path calls `ApplyRestoredState()` — a **stub here** (declared,
log-only body); task 4 fills it.

## Why this is its own task

Restoration fuses two inverses. The **data** half (inverse of task 1: the two-pass attribute read-back)
is mechanical and lives in task 4. **This** half is the inverse of `phase 3`'s lifecycle — the
`LudeoSelected` interrupt, freeze timing, the `GetLudeo`/`OpenRoom` chain, the single-fire apply gate, the
begin-gate's three legs, `RoomReady`-withheld-until-Play, replay→replay re-entrancy, overlay pause/resume.
It is the part integrations most often get wrong, so it gets its own task and its own runnable smoke test
(with the apply stubbed). The orchestrator verifies the flow here **before** task 4 fills reconstruction.

## 2. Inputs (Input Contract)

- [ ] **Task 2** → `ludeo-integration-plan/RESTORATION_PLAN.md` exists and the user **approved** it — the
      **flow** rows especially: interrupt-flow hook table, freeze/overlay hooks, apply placement,
      pre-match suppression list.
- [ ] **Phase 3** → the `[Layer]` exists (`LudeoController` + flow switch + the `onRoomReady`/
      `onBeginRestore` hooks + the `Begin`-gate). The play flow may be scaffolded but no-op; you fill it in.
      **Hard prerequisite:** the resume re-uses `phase 3`'s `RoomReady → Begin` chain, not a new path.
- [ ] **Recommended:** task 1 (capture) done, so the `objectType` strings and `LudeoKeys` constants the
      entry-identity read touches are real. The bulk of task 1's mirror is task 4's concern.
- [ ] Context files read (relative to this brief — the **flow** reading list; two-pass / per-object /
      reconciliation / environment in `07 §4/§5/§6/§8/§9` belong to task 4):
  - `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — **§2** (the flow + ordering invariants), **§2.2**
    (the two restore triggers + complete-teardown table), **§3.1** (`LudeoRestoredData` — the reader
    extraction you build; §3.2/§3.3 accessors are task 4), **§10** (freeze + `RoomReady → Begin` + overlay,
    CR-010/011).
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the `[Layer]` skeleton you extend
    (`LudeoController`, `LudeoFlowSwitch`/`LudeoPlayFlow`, `LudeoIntegrationData.ludeoRestoredData`, the
    `onRoomReady`/`onBeginRestore` hooks). **The `Begin`-gate (`m_roomReady` + `NotifyPlayerAdded` +
    `m_sceneReadyForRestore`) lives here.**
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — **CR-009** (callback-driven; `Begin` waits on
    `RoomReady` **and** `AddGamePlayer` **and** scene-loaded), **CR-010** (freeze the sim), **CR-011**
    (overlay pause, separate flag), **CR-007** (every exit routes through `End`/`Abort`).
  - `ludeo-integration-docs/unity/CONSENT-AND-OVERLAY.md` — the overlay pause/resume + `ReturnToMainMenu`
    exit notifications, and the gallery entry (`OpenLudeoGallery`), all consent-gated (CR-012).
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — exact `[SDK]` signatures (reproduce verbatim).

> **Skip flow rows with unresolved Open Questions** in `RESTORATION_PLAN.md` — surface them to the
> orchestrator before generating code for them.

## The Seam to task 4

This task and task 4 meet at exactly one interface. **Build the lifecycle scaffold here with the data
read-back stubbed:**
- Declare **`ApplyRestoredState()` with a stub body** — log a line (`"[Ludeo] ApplyRestoredState STUB —
  filled in phase 5 · task 4"`) and return. Do **not** build the two-pass, the `keyMap`, the per-entity
  `RestoreLudeoState` callbacks, the deferred queue, or the bucket accessors (`RestoreLudeoStateOfObject` /
  `TryGetAllLudeoStateObjectByType` / `GetAndRestoreLudeoStateOfObject` / `GetLudeoTrackedDefinitions`) —
  those are task 4.
- The apply path (`onRoomReady` or scene-load, per Step 1.5) calls `ApplyRestoredState()` **after the scene
  is loaded, before `Begin`**, honoring the freeze/suppress order (Step 4). **That call site, the apply
  placement, and the freeze order are this task's contract — task 4 must not re-wire them.**
- The **entry-identity read** (Step 3 — which scene/level to load from the buckets) is a flow decision and
  lives **here**, not in task 4. It reads a couple of well-known attributes off the world/definitions
  bucket — it does **not** need task 4's per-entity apply.

Result: playing a captured Ludeo freezes correctly on selection, loads the captured scene on Play, reaches
the `ApplyRestoredState()` stub in order while frozen/suppressed, resumes via `RoomReady → Begin`, and
pauses/resumes under the overlay — **with no entities restored yet** (the stub no-ops).

## 3. Steps

> **Reproduce `[SDK]` signatures from `12-SDK-API-REFERENCE.md` verbatim** — `LudeoManager` notifications
> (`AddNotifyLudeoSelected`, `AddNotifyPauseGame`/`ResumeGame`, `AddNotifyReturnToMainMenu`),
> `GetLudeo(ludeoId, callback)`, `LudeoDataReader.GetStateObjects(out LudeoStateObjectRestore[])` →
> `LudeoResult`, the room chain (`OpenRoom(forLudeo) → AddGamePlayer → RoomReady`), `BeginGameplay`. The
> `[Layer]` wraps these — the game calls the façade, not the raw SDK.

### Step 1: Read the plan (flow rows)
Read `ludeo-integration-plan/RESTORATION_PLAN.md`. Extract the **flow** rows (entity/property/reference/
deferred/environment rows are task 4's):
- The **LudeoSelected interrupt-flow** table (tear down, `SwitchToPlay`, `onBeginRestore` scene-load start,
  freeze, `GetLudeo` + cache reader, `InitRoom`).
- The **apply placement** (scene-load vs `onRoomReady`, Step 1.5) and the **wait-for-player** mechanism
  (freeze vs suppress — decided by the apply's sync/async shape).
- The **mid-play overlay hooks** (`AddNotifyPauseGame`/`ResumeGame`/`ReturnToMainMenu` → file:method).
- The **pre-match / location-override suppression** list and the `IsInLudeoFlow` gate for each.
- The **entry-identity → scene-load** decision (which attribute names the target scene).

### Step 1.5: Confirm where "apply" runs (two valid placements — `07 §2.1`)
The plan recorded one of two placements; honor the chosen seam (both honor *scene-loaded → **apply →
unfreeze → `Begin`** on `RoomReady`* — apply is never preceded by an unfreeze):
- **Apply at scene-load** (gated on `IsInLudeoFlow`): the scene-load hook spawns + applies (the spawn/apply
  is task 4); `BeginGameplay` is called later from the `RoomReady` handler.
- **Apply inside `onRoomReady`** (REFERENCE-ARCHITECTURE's compressed bootstrap):
  `ApplyRestoredState(); BeginGameplay(() => Time.timeScale = 1f);` — apply **while still frozen**, then
  `Begin`, then unfreeze in `Begin`'s callback (synchronous-apply order). An **async** apply instead spawns
  unfrozen-but-suppressed and freezes only the scalar write (`07 §10.1`).

Pick whichever matches where this game loads its gameplay scene. **Also wire the `onBeginRestore`
selection-time hook** (kicks the scene load before the room opens) and its scene-load completion signal
(`NotifySceneReadyForRestore()`) — `phase 3` scaffolds them; fill them in. **`ApplyRestoredState()` is a
stub at this point (the Seam)** — you are wiring *where* it runs, not *what* it does.

### Step 2: Add the restore-flow `[Layer]` — `LudeoRestoredData` + the apply stub (07 §3.1)
`phase 3` wired the tracking side; add the **flow-side restore additions**:
- **`LudeoRestoredData`** (`07 §3.1`) — constructed in `HandleGetLudeoDone`; calls `GetStateObjects` `[SDK]`
  **once**, groups the flat `LudeoStateObjectRestore[]` into `LudeoStateObjectsLookup`
  (`Dictionary<string, List<LudeoStateObjectRestore>>`), and **validates it is populated** (non-empty — an
  empty result is the "no data to restore" failure, not a pass). Cache it in
  `LudeoIntegrationData.ludeoRestoredData`. **Do not read attributes back here** — grouping + caching only.
- **`ApplyRestoredState()` stub** — declared on the apply owner (the `[Layer]` or the gameplay-scene
  controller, per Step 1.5), log-only body. The world-definitions rebuild (`TrackedDefinitionsForLudeo`)
  and the bucket accessors are **task 4**.

**The flows must hold `m_data` from construction** (REFERENCE-ARCHITECTURE's `LudeoFlowSwitch` ctor),
because `onBeginRestore` (and game code it triggers) can run *before* `InitRoom`; a lazy `m_data = data`
inside `InitRoom` makes that first read a `NullReferenceException`. **Do not duplicate** members `phase 3`
already created.

### Step 3: Wire the entry chain + tear-down (07 §3.3, §2.2)
Implement the notification-driven entry (`07 §3.3`) — **never call these from a game event** (CR-009):
- `HandleLudeoSelected` `[SDK]` → store `ludeoId`, `GetLudeo(ludeoId, HandleGetLudeoDone)` `[SDK]`.
- `HandleGetLudeoDone` → **re-entrant** (`07 §2.2`): if a run is already live — a capture **or a previous
  replay** the player is leaving by picking another Ludeo from the overlay — tear it down **completely**
  first via `AbortGameplay` `[Layer]` (abort the **session** + `StopTrackingAllLudeoStates()` + `CloseRoom`
  `[SDK]` + reset `isGameplayActive`/`m_gameplayStarted`), then `ResetBeginGate` `[Layer]` (`m_roomReady` /
  `m_sceneReadyForRestore` / `ludeoGameplaySession`), and **start the new play only in the teardown's async
  callback** (issuing `Abort`/`CloseRoom` then opening a room synchronously stacks a second room). Then
  build `LudeoRestoredData` (Step 2), `SwitchToPlay()` `[Layer]` (consent gate, CR-012 → `IsInLudeoFlow`
  becomes `true`), **invoke `m_onBeginRestore` (start the async scene load + suppress intros + reset both
  pause flags to an unfrozen baseline, `07 §10.3`) BEFORE `InitRoom`**, then `InitRoom` `[Layer]`
  (`OpenRoom(forLudeo) → AddGamePlayer`).

> **Teardown must also reset the *game's own* world singletons the begin-gate depends on — not just the
> Ludeo layer.** The gate (`RoomReady ∧ AddGamePlayer ∧ sceneLoaded`) transitively rests on game-side
> statics: a player/world reference, a network runner, a persistent world-controller singleton. If those are
> **never nulled** on teardown, the 2nd replay's gate can latch onto the **dying prior world** — it begins
> against the previous run's runner/world/player. Symptom: replay #1 is clean; replay #2 begins but plays
> against the wrong (previous) world. Add the game's own never-nulled singletons to the teardown reset list.
> (This is the engine/world-level analogue of the persistent-singleton baseline reset task 4 does per-entity.)

The `onBeginRestore` hook fires before the room opens (the world id is already in the buckets here; the
room chain would surface it too late to start an async load). Its scene loader must call
`NotifySceneReadyForRestore()` `[Layer]` on completion — the begin-gate's third leg. **Read the entry
identity** (which scene to load) from the world/definitions bucket here, with a direct `TryGetAttribute` —
this is flow-owned and does not need task 4's per-entity apply.

> **Arm *everything the scene/room `Setup` consumes during load* here — not just the scene id.** A
> run-scaling counter (combat level / depth), a procedural room list, an RNG-suppression flag: the world
> reads these *as it builds*, which is **before** `ApplyRestoredState()` runs. They're already in the cached
> `LudeoRestoredData` (the buckets exist from `HandleGetLudeoDone`), so set them at `onBeginRestore`,
> pre-LoadScene. `ApplyRestoredState()` owns only **live-object** state (the two-pass entity apply), which
> the world consumes *after* the scene is up — arming a load-consumed value there is a frame too late, and
> the world builds against fresh/zeroed values. Symptom: the layout/scene is right but difficulty,
> wave-scaling, or suppressed re-rolls are off.

**At the menu / startup there is no player
or world — you *boot* one here**, not restore into the menu (it silently no-ops, `07 §2`).

Map `m_onStopGame` onto this game's "freeze the active run" hook. The gallery entry point
(`OpenLudeoGallery` `[Layer]`, consent-gated) comes from CONSENT-AND-OVERLAY — confirm it's wired.

### Step 4: Freeze, resume, and overlay (CR-010/011, `07 §10`)
- **Protect restored state during restore (CR-010)** — *not just input* — by the mechanism the plan chose
  for this game's apply shape (`07 §10.1`):
  - **Synchronous apply** → freeze the whole apply (`Time.timeScale = 0f` `[Unity]`, or a spawn-paused
    structural freeze).
  - **Async apply** (spawn/reposition awaits `WaitForFixedUpdate` / a coroutine / `UniTask` / NavMesh
    `Warp`) → **do NOT `Time.timeScale = 0f` around it — `FixedUpdate` stops and the apply deadlocks
    (silent hang).** Run the create unfrozen with state-mutating systems **suppressed via `IsInLudeoFlow`**
    (input, AI, cinematics), and freeze only the narrow synchronous scalar write. *(Which side the apply
    lands on is a task-4 detail; here you wire the freeze/suppress mechanism the plan chose.)*
- **Resume = `RoomReady → Begin`:** in the `onRoomReady` hook (`phase 3`), **apply (if applying here,
  Step 1.5) → unfreeze → `BeginGameplay()`** `[Layer]` — **never unfreeze before the apply runs**. **Not**
  `ResumeGame`, **not** `PlayerReady` (does not exist in this SDK), **not** a self-built prompt. `Begin` is
  gated on **`RoomReady` ∧ `AddGamePlayer` ∧ `sceneLoaded`** (CR-009 + the restore scene-load leg,
  `NotifySceneReadyForRestore()`) — don't re-trigger `Begin` from a game event, and ensure the scene loader
  actually signals completion (an `async void` loader won't).
- **Mid-play overlay (CR-011):** wire `AddNotifyPauseGame`/`AddNotifyResumeGame` `[SDK]` → freeze/resume,
  and `AddNotifyReturnToMainMenu` `[SDK]` → a CR-007 exit (stop tracking + `CloseRoom` + load menu). Keep
  the **CR-010 restore freeze and the CR-011 overlay pause on two separate flags** (engine paused iff
  *either* is set) — one shared flag lets a mid-play `ResumeGame` unfreeze a restore. Names have **no
  `Request` suffix**.
- **Reset both flags at lifecycle start AND at the start of every restore if the layer is a persistent
  singleton.** Two flags only protect you if both *start* `false` each run. When the integration layer is a
  `ScriptableObject` service, a `DontDestroyOnLoad` MonoBehaviour, or `static` state, its fields persist
  across Editor playmode sessions **and across replays within one session** — a pause flag left `true` last
  run (e.g. the overlay/Ludeo-done `PauseGame` with no matching `ResumeGame`) carries in and silently holds
  `timeScale = 0`, so the restored Ludeo loads but never unfreezes (async restore: **deadlocks**). A
  bootstrap-only reset misses the **replay→replay** case (a shipped build never restarts between replays)
  — so also reset both flags in the per-restore `onBeginRestore` hook. Clear both flags (and other mutable
  runtime state); never assume zero-init. A freshly-constructed `LudeoController` avoids only the
  *bootstrap* case; its `HandleGetLudeoDone` teardown handles the replay case.
- **If a restored Ludeo plays but input seems dead, check three independent gates** (`07 §10.4`), not just
  the obvious one — they present identically: (1) the global input-enabled flag (re-enable at `Begin` if the
  restore path suppressed it), (2) per-entity control locks (restore often re-activates the player with
  controls disabled — re-enable movement *and* non-movement handlers at gameplay start), (3)
  `Time.timeScale` (a frozen sim looks exactly like blocked input).

### Step 5: Gate start-of-run mechanisms on `IsInLudeoFlow` — two categories
Implement the suppression the plan enumerated, gated to skip when `LudeoController.Instance.IsInLudeoFlow`
`[Layer]` is `true`. On the player (Ludeo) flow, suppress **everything between launch and the first
interactive frame of the captured state** — in two distinct categories, *both* gated, not just the first:

1. **State-clobbering** — mechanisms that would overwrite restored values: intro cutscenes, countdowns,
   slow-mo intros, fly-in cameras, default-spawn teleports (`SpawnPoint`/`Respawn`), scripted scene-start
   events, `Start`/`OnEnable` re-initializers. Skip these or the Ludeo loads at the **wrong** state.
2. **Flow-blocking** — UI/gates that stall progression to the playable frame *without* touching state:
   "press start"/"press any key"/"click to continue" gates, modal popups (daily-reward, news, "what's
   new"), EULA/login/age-gate prompts, tutorial overlays, confirmation dialogs, between-segment
   reward/shop screens. Auto-dismiss or bypass these or the Ludeo loads at the **right** state but never
   becomes **interactive** — the player stares at a popup instead of the captured moment.

The Ludeo must start *exactly* at the captured state, **interactive**, on the first visible frame.
`IsInLudeoFlow` already exists (`m_data.isInLudeo`) — **no stub**; don't invent an ad-hoc "is this a
replay" check. These fire during the scene load (which `onBeginRestore` kicked) and hit the gate **before**
the apply runs. The gate mechanism is identical for both categories; only the *what-to-look-for* widens —
don't filter the codebase scan to state-touching mechanisms and miss a blocking modal.

### Step 6: Self-check, then hand back (no play test here)
You do **not** play a Ludeo — the orchestrator does. Before returning, statically self-check against §7's
pre-handoff criteria, then return a summary + the files you created/edited + any open questions. **The
runtime gate (play a captured Ludeo: freeze → captured scene loads → stub reached in order → `Begin`;
replay→replay teardown; overlay pause/resume) is the orchestrator's** — it cannot be verified from this
isolated context, and the `ApplyRestoredState()` stub no-ops so **no state is restored yet (expected;
task 4 verifies state).**

## 4. Questions to ask the human

Surface to the orchestrator; don't guess:
- A **flow hook the plan names that doesn't exist** (e.g., no scene-loader completion callback) — propose
  adding it (`NotifySceneReadyForRestore()` awaitable) as a separate named change.
- **Apply placement ambiguity** the plan didn't resolve (scene-load vs `onRoomReady`).
- A **freeze-vs-suppress** decision the plan left open for the apply's sync/async shape.

## 5. Patterns to apply

- **This is the inverse of `phase 3`, not task 1.** Every piece mirrors the session lifecycle `phase 3`
  wired (`OpenRoom → AddGamePlayer → RoomReady → Begin`). If you find yourself reading entity attributes
  back into the world, stop — that's task 4; leave the stub.
- **Read-then-load.** No scene loads in the `LudeoSelected` handler directly — `onBeginRestore` starts the
  async load once the world id is known from the buckets; the apply runs after the scene is up.
- **Order: scene-loaded → apply → unfreeze → `Begin` (on `RoomReady`)** (`07 §2.1`). Never Begin-then-apply;
  **never unfreeze-then-apply**; never apply in the `GetLudeo` callback.
- **Two separate pause flags** (CR-010 restore freeze vs CR-011 overlay), reset every restore for a
  persistent layer — else a stale flag holds `timeScale = 0` and the restored Ludeo looks like dead input.
- **`HandleGetLudeoDone` is re-entrant** — every entry tears the prior run down completely and starts the
  new play **only in the teardown callback**.
- **Flows receive `m_data` at construction** — a lazy in-`InitRoom` assign is a latent `NullReferenceException`.
- **Capture is creator-only, restore is play-only** — gate every pre-match suppression on `IsInLudeoFlow`.
- **Don't modify game logic** beyond the flow wiring + gating; propose-confirm-execute every change.

## 6. Output Contract

- Restore-flow `.cs`: `LudeoRestoredData` (extraction + cache), the `HandleLudeoSelected`/
  `HandleGetLudeoDone` entry chain with re-entrant teardown, `onBeginRestore` scene-load + the begin-gate's
  third leg, `InitRoom`, the CR-010 freeze/suppress, `RoomReady → Begin` resume, CR-011 overlay
  pause/resume, and the reset-every-restore pause flags (with backups for edited game files).
- The **`ApplyRestoredState()` stub** wired into the apply path (`onRoomReady` | scene-load), called after
  scene-load / before `Begin`.
- A report: (1) apply placement + apply shape (freeze vs suppress), (2) flow `[Layer]` added, (3) the Seam
  (`ApplyRestoredState()` STUB call site), (4) overlay hooks wired, (5) pre-match suppression gated, (6)
  files modified, (7) ready for the orchestrator's flow gate. Note (5) covers **both** categories — state-clobbering and flow-blocking UI.
- **No compile / play performed** — that's the orchestrator's human gate.

## 7. ✅ Success Criteria

**Guideline phase-5 criteria this task feeds** (verified at the orchestrator's gate, not here):
- [ ] **Flow reaches the restore entry point on a real captured Ludeo** — freeze on select → captured scene
      loads on Play → `ApplyRestoredState()` stub reached in order → `Begin`.
- [ ] **Pause/overlay behavior correct** — overlay open freezes the sim, close resumes (CR-011).
- [ ] **Restore (flow) verified by a human** — including the replay→replay teardown (no stale-flag deadlock).

**Skill-specific pre-handoff criteria (satisfy before returning):**
- [ ] `LudeoRestoredData` built in `HandleGetLudeoDone`: `GetStateObjects` called once, grouped into
      `LudeoStateObjectsLookup`, **validated non-empty**, cached — no attribute read-back here.
- [ ] `ApplyRestoredState()` declared as a **stub** (log-only) and called **after scene-load, before
      `Begin`**, honoring the freeze order — that call site is the Seam task 4 must not re-wire.
- [ ] Entry chain is notification-driven (`HandleLudeoSelected`/`HandleGetLudeoDone`), never from a game
      event (CR-009); `HandleGetLudeoDone` is re-entrant and starts the new play in the teardown callback.
- [ ] `onBeginRestore` fires **before** `InitRoom`, starts the async scene load, and resets both pause
      flags; the loader calls `NotifySceneReadyForRestore()` (begin-gate leg 3).
- [ ] `Begin` gated on `RoomReady ∧ AddGamePlayer ∧ sceneLoaded`; not re-triggered from a game event.
- [ ] CR-010 freeze and CR-011 overlay on **two separate flags**, reset at lifecycle start **and** every
      restore (persistent layer); freeze-vs-suppress matches the apply shape (async ⇒ suppress, not freeze).
- [ ] Start-of-run mechanisms gated on `IsInLudeoFlow` — **both** categories: state-clobbering (intros,
      spawns, re-initializers) **and** flow-blocking (press-start gates, modals/popups, EULA/login, tutorial
      overlays). The Ludeo reaches the captured state *and* is interactive on the first visible frame.
- [ ] Flows hold `m_data` from construction; no `#if` toggling (CR-001 runtime); backups for edited files.

## 8. Common Mistakes

- **Compiling / playing here** — the orchestrator owns the (human-gated) play test.
- **Reading entity attributes back** — that's task 4; leave the stub.
- **A scene load in the `LudeoSelected` handler** instead of `onBeginRestore` (read-then-load).
- **Begin-then-apply / unfreeze-then-apply / apply-in-GetLudeo** — wrong order (`07 §2.1`).
- **Freezing an async apply** with `timeScale = 0` — deadlocks `FixedUpdate` (`07 §10.1`).
- **One shared pause flag** or a bootstrap-only reset — stale flag deadlocks the replay→replay restore.
- **`async void` scene loader with no completion signal** — `Begin`'s third leg never fires.
- **Using the C++ `…Request` notification names** or calling `Begin` from a game event.

## Related / Next

- Task 2 (`5c-plan-state-restoration.md`) — produces `RESTORATION_PLAN.md`, the plan this task implements.
- `phase 3` — wired the `RoomReady → Begin` chain this task reuses for the post-restore resume.
- **Next (orchestrator):** run the task-3 flow gate (play a captured Ludeo: freeze → scene → stub → `Begin`;
  replay→replay; overlay), then dispatch task 4 (`5e-implement-state-reconstruction.md`) to fill the stub.
