# Phase 5 — Tracking & Restore (Orchestrated, Iterative Wave Loop)

> **This is the phase-5 entry point.** Guideline phase 5 ("Tracking & restore (game objects)") is one
> logical phase, run as an **iterative wave loop**: the census + wave plan from phase 4 is implemented
> **one wave at a time**, each wave proven by a human at its own restore gate before the next widens scope.
> Within a wave the work is single-task briefs: **deep-scope** (task 0) → **capture** (task 1) → **restore
> plan** (task 2) → **restore flow** (task 3, **wave 1 only**) → **state reconstruction** (task 4). The
> driving agent runs as an **orchestrator**: it dispatches one **subagent per task** (via the Agent tool),
> passes artifacts **by file**, and **owns every human gate itself** — so the whole thing feels like a
> single phase to the user.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Turn the approved **census + wave plan** into a **working capture-and-replay loop, wave by wave**. **Wave 1**
proves the full round-trip on the **restorable spine + the must-have set** (world/level identity + player +
time-base/continuity + the few collections the moment is visibly wrong without): register handlers and
sample per-tick attributes (creator/write side), plan restoration, wire the SDK-orchestration play flow
(`LudeoSelected → GetLudeo →` freeze/overlay/pause `→ RoomReady → Begin`, restore entry point), and fill the
two-pass read-back. **Each later wave widens the tracked set** and re-runs capture + reconstruction for the
added types, ending in the same human restore gate. **Deliverable:** a captured highlight that plays back
and **visibly restores positions/state** — first for Wave 1 (the prerequisite for actions/enrichment), then
for each widened wave.

## 2. Inputs (Input Contract)

- [ ] **Fresh agent session** for the orchestrator (its context stays lean — subagents carry the heavy
      per-task context). If this chat already has phase-5 work in it, start fresh.
- [ ] **Phase 3 complete** — the `[Layer]` exists (`LudeoController` + flow switch +
      `DefaultLudeoStateHandler` + `LudeoKeys` scaffold + the `onRoomReady`/`onBeginRestore` hooks + the
      `Begin`-gate) and the SDK lifecycle compiles and runs with the capture overlay live.
- [ ] **Phase 4 census complete** — `ludeo-integration-plan/OBJECT_TRACKING.md` exists with the **Part-A
      census + wave plan** (`## Wave Rollout`, `## Object Type Census`, `## Spawn/Own Pattern Summary`) and
      the user **approved** it (type coverage, load-bearing flags, wave order, Wave 1 = restorable spine +
      must-have set). The **per-entity deep detail is NOT in it yet** — task 0 appends it per wave.
- [ ] The task briefs are present in `references/` (see §3): `9a` (deep-scope), `9`, `10`, `11`, `12`.

## 3. Steps (the orchestration)

The driving agent is the **orchestrator**. It does **not** do the task work inline — it dispatches a
subagent per task, inspects the returned artifact, then **runs that task's human gate itself** before
dispatching the next. This keeps each task in isolated context (no bloat) and keeps the iteration state
(what was tried, what the log showed, which wave we're on) in the **persistent orchestrator**, not in a
subagent that's gone.

**Dispatch pattern (per task):**
> Use the **Agent** tool (`subagent_type: general-purpose`). Prompt the subagent with: the **absolute
> path to the task brief**, the **Unity project path**, the **input artifact paths** it needs, **and which
> wave `N` (+ the `objectType`s in that wave)**. Tell it to follow the brief exactly, produce the brief's
> Output-Contract artifact (code and/or a plan file), **not** to run the human-gated compile/play (the
> orchestrator owns it), and to return a short summary + the files it created/edited + any human-questions.
> On return, **verify the artifacts exist**, relay questions, then **run the gate** (below). Pass state
> **by file**, never by re-narrating prior output.

**Fix-loop pattern (per gate failure):**
> When a human gate fails (compile error, missing log line, wrong replay behavior), the orchestrator
> **re-dispatches a fix subagent** pointed at the **same brief**, with the **failing log text / the
> human's report passed by file** plus the list of files the prior subagent touched. The orchestrator
> holds the iteration state across as many human round-trips as it takes. Root-cause every fix
> (no try/catch or symptom-masking, `phase 3 · task 5`); propose-confirm-execute each change.
>
> **Guardrail escalation (cross-wave):** if a wave-`N` gate fails because state **owned by an earlier,
> already-confirmed wave** is wrong or missing, that is **not** a wave-`N` fix. Re-open the **earlier**
> wave — re-dispatch its task 0 / task 1 for the missing state, re-verify **its** gate — then resume wave
> `N`. Never patch the symptom forward into the current wave (`4-map-game-objects.md` §5; the mirror
> principle, §5 below).

### The wave loop (outer structure)

Read the `## Wave Rollout` table from `OBJECT_TRACKING.md` → an **ordered** list of waves (Wave 1 =
restorable spine + must-have set). Then, **for each wave in order:**

```
for N in waves:                                  # OUTER LOOP
    task 0  deep-scope(N)     -> append wave N's per-entity rows  → GATE 0 (row review)
    task 1  capture(N)        -> register + writers for N's types → GATE 1 (recompile + PLAY + capture)
    task 2  restore-plan(N)   -> append N's RESTORATION_PLAN rows → GATE 2 (human approves the rows)
    if N == 1:
        task 3  restore-flow  -> flow .cs + ApplyRestoredState STUB → GATE 3 (flow play-test)  # ONCE
    task 4  reconstruct(N)    -> fill N's buckets in ApplyRestoredState → GATE 4 (N restores)
    -> ask the human: "wave N restores — widen to wave N+1?"        # confirm-before-widen
```

**Wave 1 runs the full pipeline** (it builds the one-time restore flow). **Waves ≥ 2 are data-only**
(`deep-scope → capture → restore-plan → reconstruct`) and **skip task 3** — the flow already exists; only
the tracked set, the capture writers, and the `ApplyRestoredState()` data read-back grow. **Phase 6
(actions) may start once Wave 1 is green** — it does not wait for every wave.

> **Re-entered later to widen (phase 8).** This loop is not one-shot. When `phase 8` (`8-polish.md`) adds
> waves to widen coverage after the integration ships, it appends them to `## Wave Rollout` (a phase-4
> census update) and **re-enters this orchestrator for just those waves** — run exactly as waves ≥ 2
> (data-only, **skip task 3**), each ending in its own restore gate. The wave counter simply continues; a
> fresh session is fine (state lives in the files, not the chat).

| # | Task | Brief | Cadence | Produces | Human gate (orchestrator-run) |
| --- | --- | --- | --- | --- | --- |
| 0 | Deep-scope this wave | `references/5a-deep-scope-wave.md` | **per wave** | wave N's `## Entity` rows appended to `OBJECT_TRACKING.md` (+ `save_system.per_entity`) | **human reviews & approves wave N's rows** (no code/run) |
| 1 | Implement object tracking (capture) | `references/5b-implement-object-tracking.md` | **per wave** (additive) | capture `.cs` for N's types (register + `OnStateDataUpdate` writers + keys) | **recompile clean + play + actually capture a session**, registration fires, no `LudeoResult` errors |
| 2 | Plan state restoration | `references/5c-plan-state-restoration.md` | **per wave** (append) | wave N's rows in `RESTORATION_PLAN.md` | **human reviews & approves the rows** (no code/run) |
| 3 | Implement restoration flow | `references/5d-implement-restoration-flow.md` | **ONCE (wave 1 only)** | flow `.cs` + `LudeoRestoredData` + `ApplyRestoredState()` **stub** | **play a captured Ludeo**: freeze → captured scene loads → stub reached in order → `Begin`; replay→replay tears down clean; overlay pause/resume |
| 4 | Implement state reconstruction | `references/5e-implement-state-reconstruction.md` | **per wave** (additive buckets) | wave N's buckets filled in `ApplyRestoredState()` (two-pass read-back) | **play a captured Ludeo**: wave N's cumulative set restores on first frame, non-zero two-pass counts, cross-ref resolved; **placement sanity — no restored entity sits in empty space / far from the geometry** (§ below); replay-twice shows the **second's** state |

**No task here is hands-off** — every one ends in a human gate the orchestrator must run, because the
agent **cannot see the Unity Editor Console** and the capture/replay gates require the human to actually
play/capture a Ludeo. Dispatch task 0, run its gate, **only then** task 1, and so on; finish a wave before
starting the next.

### The capture-before-replay dependency (do not skip)

Tasks 3 and 4 **cannot be verified without a real captured Ludeo** — you can't replay what was never
captured. So **each wave's** task-1 gate is not just "capture compiles and runs" — the human must
**actually play the game and capture at least one (ideally two, for the replay-twice tests) Ludeo** that
includes **that wave's** new attributes before task 4 (and, in Wave 1, task 3) is tested. Make this ask
explicit at every wave's task-1 gate.

> **Required at the Task-4 gate: a placement sanity check from a deep-state capture.** Two parts, both
> mandatory — not advisory:
> 1. **Capture past the run's start, not at a level's origin.** A capture taken at the first room/level
>    can sit at the engine's instantiate origin (an identity frame), so absolute positions restore
>    correctly *there* even when the world's spatial frame is rebuilt non-deterministically elsewhere —
>    masking the bug entirely. Require the gate's Ludeo to be captured **mid-run / past the first
>    segment**.
> 2. **Look at where the restored entities land.** Ask the integrator the symptom question directly:
>    *"On the restored first frame, does any entity (player, enemies, props) sit in empty space, fall
>    through the floor, or appear far from the geometry?"* A **yes** is a displaced-frame bug — the
>    captured world frame wasn't reconstructed (`CODE_MAP.session_boundaries.world_frame`;
>    [`game-patterns/procedural-world.md`](ludeo-integration-docs/game-patterns/procedural-world.md) §3/§5).
>    This is a **symptom-level** check: it catches the failure even when phase 2's up-front detection
>    missed the cause, and it doubles as a general "is the restore visually coherent" gate, not a
>    genre-specific one.

### Re-capture every wave (schema invalidation)

Each wave's `capture(N)` **adds attributes** to the capture schema, which **invalidates Ludeos captured in
prior waves** (`06 §6` / `phase 5 · task 1`). So at **every** wave's task-1 gate the human must **re-capture** — the
Ludeo used for that wave's task-4 (GATE 4) must contain wave N's new attributes, not a stale prior-wave
capture. The same applies after any in-wave capture-schema fix.

### Reading the logs (every gate)

The orchestrator runs the gates but still **cannot see the Console** — it confirms each gate by reading
**Unity's log files** per
[`unity/READING-UNITY-LOGS.md`](ludeo-integration-docs/unity/READING-UNITY-LOGS.md), and beyond the log
relies on the integrator's word (a clean compile never proves capture/restore works). The compile-and-fix
loop + `error CS` table live in [`phase 3 · task 5`](3e-compile-and-fix.md) — cite it, don't repeat it.

## 4. Questions to ask the human

The orchestrator relays whatever a subagent surfaces — it does not invent its own. Expected ones:
- **Task 0 (deep-scope):** a collection type whose stable key is unresolved; an entity whose
  "reconciliation" row actually serializes an opaque blob (treat as manual); a **load-bearing cross-wave
  reference** that should reshape the wave plan (takes it back to the phase-4 census gate).
- **Task 2 (plan):** the apply's sync/async shape (freeze vs suppress); missing scene-loader completion
  signal; disagreements between this wave's `OBJECT_TRACKING.md` rows and `CODE_MAP.save_system.per_entity`.
- **Task 0 gate:** approve **wave N's** appended rows.
- **Task 1 gate:** confirm a clean recompile + a **captured** session that includes wave N's attributes,
  **captured mid-run / past the first segment** (an origin capture masks displaced-frame bugs — see the
  Task-4 placement check) — and capture a 2nd Ludeo for the replay-twice tests. **Re-capture** if a prior
  wave's Ludeo is stale.
- **Task 2 gate:** approve **wave N's** rows in `RESTORATION_PLAN.md`.
- **Task 3 gate (wave 1):** confirm the flow play-test (freeze → scene load → stub → `Begin`; replay→replay;
  overlay).
- **Task 4 gate:** confirm wave N's cumulative restored state on the first frame + the **placement sanity
  check** (no restored entity floating / fallen-through / far from geometry, from a deep-state capture —
  §3) + the replay-twice no-leak test.
- **End of each wave:** "wave N restores — widen to wave N+1?" (confirm-before-widen).

## 5. Patterns to apply

- **Iterative wave loop** — implement the wave plan one wave at a time; prove the round-trip on Wave 1's
  restorable spine + must-have set, then widen. The riskiest seam (does a Ludeo round-trip at all?) is
  proven early on a small set, not once against the full surface (`06 §1.1`).
- **One-time flow vs per-wave data** — the restore **flow** (task 3: `LudeoSelected`→freeze→`RoomReady`→
  `Begin`→stub) is moment-agnostic plumbing, built **once in Wave 1**. Only the **data** read-back inside
  `ApplyRestoredState()` (task 4) and the capture writers (task 1) grow per wave, **additively** — never
  re-wire the flow or edit a confirmed wave's writers/buckets for a later wave.
- **The load-bearing guardrail** — widening is for **breadth, not backfilling**. If a later wave needs
  state an already-confirmed wave should have carried, fix the **earlier** wave and re-verify its gate
  (guardrail escalation, §3). A gap belongs back in `phase 4`/task 0, not papered over downstream.
- **Orchestrator / single-task-subagent dispatch** — each brief is written to be run by a subagent in
  isolation; the orchestrator is thin and owns the human gates + the fix loop + the wave counter.
- **The mirror principle** — restoration (tasks 2/4) is the **row-for-row inverse** of capture (task 1)
  **for the wave's types**: same `objectType` buckets, same `LudeoKeys` constants, same stable keys. You
  cannot restore what tracking didn't capture.
- **No SDK id-map (the #1 C++→Unity trap).** Identity is the `objectType` bucket + your own stable key;
  references resolve two-pass by matching keys (`06 §4`/`07 §4`). Never `GetInstanceID()` / `ObjectId`
  (CR-014).
- **Capture is creator-only; restore is play-only.** Guard capture on `!IsInLudeoFlow`; the restore path
  runs because `IsInLudeoFlow` is `true` (CR-001).
- **Player flow proven before actions.** Phase 5 reaches the actions prerequisite the moment **Wave 1**
  restores for a human — that is the guideline's gate for proceeding to phase 6 (actions).

## 6. Output Contract

Produced across the subagent tasks (each brief owns its own contract); the per-wave artifacts **accrete**:
- Per-wave `## Entity` rows appended to `OBJECT_TRACKING.md` + `save_system.per_entity` (task 0, each wave).
- Capture code — register calls + `OnStateDataUpdate` writers + filled `LudeoKeys`, **growing per wave**
  (task 1, additive).
- `ludeo-integration-plan/RESTORATION_PLAN.md` (+ `GAME_ANALYSIS_ENVIRONMENT.md` if absent), rows appended
  per wave (task 2).
- Restore-flow `.cs` — entry chain, `LudeoRestoredData` extraction/cache, `onBeginRestore` scene load,
  freeze/overlay, `RoomReady → Begin`, and the `ApplyRestoredState()` **stub** (task 3, **once**).
- The `ApplyRestoredState()` body — two-pass read-back, references, deferred queue, environment — **its
  buckets growing per wave** (task 4, additive).
- **A human-verified captured highlight that plays back and restores state — per wave** (each wave's gate).

## 7. ✅ Success Criteria (the guideline phase-5 gate)

Per wave, the orchestrator confirms the wave's gates; the **phase advances to actions once Wave 1 is
green**, and is **fully complete when the last wave in the plan is green**.

**Per-wave gate (every wave N):**
- [ ] Wave N's rows approved (task 0 gate) and mirrored in `RESTORATION_PLAN.md` (task 2 gate).
- [ ] Capture proven at runtime for N's types — registration fires, no `LudeoResult`/dropped-attribute
      errors in the log, and a Ludeo **including N's attributes** captured (task 1 gate; **re-captured**,
      not stale).
- [ ] **Captured highlight plays back and visibly restores wave N's cumulative set** on the first frame
      (task 4 gate), two-pass counts non-zero, cross-refs resolved.
- [ ] **Placement sanity, from a deep-state capture** — the gate's Ludeo was captured mid-run (not at a
      level's origin), and no restored entity floats in empty space / falls through / sits far from the
      geometry (task 4 gate). Catches displaced-world-frame bugs the symptom way, regardless of genre.
- [ ] **Replay→replay** (in one session) tears the prior run down cleanly and shows the **second** Ludeo's
      state — no stale-flag deadlock, no dropped-`Start` defaults, no persistent-singleton leak (tasks 3–4).

**Wave 1 additionally (the guideline phase-5 criteria + one-time flow):**
- [ ] **Flow reaches the restore entry point on a real captured Ludeo** (task 3 gate).
- [ ] **Pause/overlay behavior correct** — overlay open freezes the sim, close resumes (CR-011; task 3 gate).
- [ ] CR-010 restore freeze and CR-011 overlay pause on **two separate flags**, reset every restore.
- [ ] **Reader does not assert on missing attributes** — `TryGetAttribute` → `false` keeps the spawn
      default; only a missing **key** fails loud (tasks 2–4).
- [ ] Two-pass restoration (CR-006) with a per-Ludeo `keyMap`; references resolved, **fail loud** on a
      missing key (task 4).
- [ ] **Player Flow proven working before actions/enrichment proceed** — Wave 1's restore gate is the gate
      for phase 6.

**Phase complete:**
- [ ] Every wave in the `## Wave Rollout` plan has passed its restore gate (or a remaining wave is
      explicitly deferred with the user's sign-off).

## 8. Common Mistakes

- **Implementing the whole plan in one pass** instead of wave-by-wave — loses the early round-trip proof
  and the small, debuggable human gates that are the point of the loop.
- **Re-running task 3 (flow) per wave** — it is **once, in Wave 1**. Waves ≥2 skip it; only capture +
  reconstruction grow.
- **Editing a confirmed wave's writers/buckets when adding a later wave** — waves are **additive**; a later
  wave appends `objectType` buckets, it never rewrites an earlier wave's.
- **Testing a wave's restore against a stale prior-wave capture** — each wave's new attributes require a
  **re-capture** (schema invalidation).
- **Patching earlier-wave load-bearing state forward into the current wave** — re-open the earlier wave
  (guardrail escalation), don't absorb it here.
- **Running the tasks inline instead of dispatching subagents** — bloats the orchestrator's context and
  loses the one-phase feel. Dispatch; pass artifacts by file.
- **Trying to subagent-automate a gate** — every gate needs the human + the Editor. Surface it and wait.
- **Declaring the phase done by inspection** — the gate is a human watching each wave's highlight restore.

## Related / Next

- Briefs: `5a-deep-scope-wave.md` (task 0, per wave), `5b-implement-object-tracking.md` (task 1),
  `5c-plan-state-restoration.md` (task 2), `5d-implement-restoration-flow.md` (task 3, once),
  `5e-implement-state-reconstruction.md` (task 4).
- Phase 4 (`4-map-game-objects.md`) — produces the **census + wave plan** (Part A) and the **Part B
  deep-scope procedure** that task 0 runs per wave.
- **Next:** phase 6 (actions) — wire `SendAction`/`ReportAction` in both flows, now that the player flow
  is proven (Wave 1 green). Includes emitting the non-gameplay standard actions planned in phase 3.
- **Later — phase 8 (`8-polish.md`)** re-enters this loop to widen coverage: it appends new waves and runs
  them here as waves ≥ 2 (data-only, skip task 3).
