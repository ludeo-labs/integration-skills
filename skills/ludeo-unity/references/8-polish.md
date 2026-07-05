# Phase 8 — Polish & Completion (widen coverage, fix, finalize)

> **This phase does NOT re-implement capture or reconstruction.** It is the **grow-the-integration**
> phase: it **checks what state Ludeo could still capture but doesn't yet**, **recommends** the gaps to the
> user, and — when they want to expand — **drives phases 4 & 5** to add that state as new **waves**. Capture
> and reconstruction stay owned by `4-map-game-objects.md` (census + wave plan) and
> `5-tracking-restore-orchestrator.md` (the wave loop); this phase routes back into them, it never
> duplicates their machinery. It also folds in cosmetic/timing polish + bug fixes and, when nothing material
> remains, **finalizes** the integration.
>
> **Not orchestrated.** This phase dispatches no subagents of its own. Its gap check is inline analysis; its
> "expand" path hands control to the **phase-5 orchestrator** (which owns the per-wave subagents + gates).
>
> **It loops.** Widen → verify the new waves at their restore gates → re-check for more gaps → widen again,
> until the user is satisfied. Completion is a user decision, not a fixed endpoint.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

The prior phases proved a **working, uploaded integration** on the wave plan's initial scope (Wave 1's
restorable spine + whatever waves the user chose to complete). Real games have **more state a viewer would
notice** than the first waves captured — full-game systems a curated moment never exercises. This phase:

1. **Finds** the state Ludeo could still capture but doesn't yet (the **gap check**, Step 1).
2. **Recommends** it to the user, prioritized (Step 2).
3. On approval, **widens** the integration by adding that state as **new waves** — appending to phase 4's
   `## Wave Rollout` and re-running the phase-5 wave loop for just those waves (Step 3), then looping back
   to re-check.
4. Applies **cosmetic/timing polish** and fixes bugs surfaced in earlier phases (Step 4).
5. **Finalizes** — records completion in the TDD and flags a re-upload when the build changed (Step 5).

**Deliverable:** either a wider, human-verified integration (more waves green) or a documented, user-agreed
"complete at current scope" — never a silent stop.

## 2. Inputs (Input Contract)

- [ ] **Phase 7 reached** — the integration compiles, at least Wave 1 restores for a human, actions fire in
      both flows, and a build has been (or can be) uploaded. Polish widens a *working* integration; it does
      not substitute for an unproven one.
- [ ] **Phase 4 census exists** — `ludeo-integration-plan/OBJECT_TRACKING.md` with the `## Wave Rollout`,
      `## Object Type Census`, and per-wave `## Entity` sections for the completed waves.
- [ ] **Phase 5 artifacts exist** — `RESTORATION_PLAN.md`, the capture code, and `ApplyRestoredState()`
      filled for the completed waves. `CODE_MAP.json` (incl. `save_system`, `session_boundaries`).
- [ ] **`TDD_<GameName>.md`** — the living design doc; this phase appends a completion section to it.
- [ ] Context files read (relative to this file):
  - [`ludeo-integration-docs/06-TRACKING-PATTERNS.md`](ludeo-integration-docs/06-TRACKING-PATTERNS.md) —
    **§1.1** (iterative capture↔reconstruct — the model this phase extends), **§9** (what-to-track guide).
  - [`ludeo-integration-docs/07-RESTORATION-PATTERNS.md`](ludeo-integration-docs/07-RESTORATION-PATTERNS.md)
    — **§8** (world/environment restore), **§10** (freeze / wait-for-player / cosmetic timing).
  - [`ludeo-integration-docs/game-patterns/INDEX.md`](ludeo-integration-docs/game-patterns/INDEX.md) — the
    genre §3 Tracking Checklists, used in Step 1 as the full-coverage list the curated waves sampled from.
  - [`4-map-game-objects.md`](4-map-game-objects.md) — the census + wave assignment rules (Step 3 appends a
    wave the same way) and the **load-bearing guardrail**.
  - [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md) — the wave loop this phase
    re-enters for appended waves.

## 3. Steps

### Step 1: Gap check — what state can Ludeo still capture that it doesn't?

Analysis only — no code. Diff **what the game has** against **what the waves captured**.

#### 1a. Baseline — read what is already tracked
From `OBJECT_TRACKING.md`: the `## Wave Rollout` (which types landed in which wave), the per-entity
property tables, and the `## Genre Coverage Check`. From `RESTORATION_PLAN.md`: which of those restore.
Everything below is measured **against this baseline** — you are hunting only what is **NEW**.

#### 1b. Discover uncaptured state (the categories a curated slice never exercises)
Walk each category; a curated slice + a few waves routinely miss these. For each hit, record: what it is,
where it lives (file:line), whether it is a new **type** or a new **property** on a tracked type, and a
rough **load-bearing-for-a-broader-moment** read.

- **Game modes / experiences.** Does the game have modes/scenes beyond the one(s) the waves cover
  (`Grep` scene names, mode enums, mode managers)? A different mode has its own entities/actions and its own
  world identity — and needs the **active mode/experience name** captured on the world/definitions singleton
  so restore knows which mode to rebuild. Multi-mode → recommend a wave per mode's distinctive types.
- **Mission / objective / quest state machines.** `Grep("Quest|Mission|Objective|Task|Stage|Phase")` for
  managers + state enums. Capture the machine's resolved state (active stage, per-sub-objective flags, timer
  **remaining** if timed) as a singleton objectType — snapshot, not a re-run of the script.
- **World / environment state.** Doors/gates, security cameras, alarms/alert level, destructibles, lighting/
  time-of-day/weather, level-script counters. Prefer **one-time transition actions** (e.g. a `DoorOpened`
  action with position — phase 6) over per-tick polling of many static actors. World flags model as the
  environment/world singleton (`07 §8`), restored **after** entities.
- **Stateful subsystems.** Wave/spawn managers, cooldown/recharge systems, RNG. **Capture timers as deltas
  (remaining/elapsed-since), never absolute wall-clock** — an absolute timestamp goes stale the moment the
  Ludeo replays later/elsewhere (`06 §9.4`). For deterministic RNG, capture the **seed + calls-consumed**,
  not the current value. This is `SessionState`/`Continuity` territory (phase 4 Step B1) widened.
- **Cross-slice entity families.** Extra AI families, vehicles, drones, NPC populations not in the completed
  waves. Each is a new collection objectType with its own stable key.
- **One-time / scripted state.** One-shot triggers (`bHasTriggered`), granted buffs/modifiers, scripted
  scene events. Capture **which fired / which are active**; on restore re-apply only the *active* result —
  do **not** re-run the init sequence (double-apply). Restore mechanics live in `07 §9` — this phase only
  flags the state; the wave implements it.
- **Genre checklist gaps.** Re-walk the matching `game-patterns/<genre>.md` §3 Tracking Checklist against the
  `## Genre Coverage Check` table — every unchecked item is a candidate.
- **Write-frequency sanity (perf).** If widening pushes many dynamic entities at a high sample cadence,
  sanity-check the volume: `entities × dynamic-props × avg-size × Hz`. Static/identity properties are written
  once (they diff-send free — `06 §3.1`); large populations may want a lower cadence or skip-unchanged
  (`06 §11`). Flag this as a wave-plan input, not a blocker.

#### 1c. Apply the load-bearing guardrail (the critical filter)
**Widening is for breadth, NOT for backfilling state the already-proven moment needs.** For each gap, ask:
*is this needed for a moment that has ALREADY passed its restore gate to feel correct?*

- **Yes** → this is a **miss in the wave that owns that moment**, not expansion. Re-open **that** wave
  (its `4-map-game-objects.md` Part-B rows + phase-5 capture/reconstruct) and re-verify **its** gate. Do not
  fold it into a new "expansion" wave. (This is the guardrail in `4-map-game-objects.md §5` /
  `5-tracking-restore-orchestrator.md §3`.)
- **No** → it is genuine broader coverage → a candidate **new wave** for Step 3.

### Step 2: Recommend to the user
Present the gap check as a **prioritized recommendation**, not a plan you execute silently:
- Group by proposed wave, most-load-bearing first, with the one-line rationale each.
- Separate the two buckets explicitly: **"earlier-wave misses to fix"** (guardrail, Step 1c) vs
  **"broader coverage to add"**.
- State the rough cost (how many new types/waves, any perf caveat from 1b).
- **Ask:** "Here's what Ludeo could still capture: [list]. Want me to expand to cover any of these now, or
  finalize at the current scope?" Let the user pick a subset — expansion is opt-in and incremental.

If the gap check finds **nothing material**, say so and go to Step 4/5.

### Step 3: Expand (only for the state the user chose)
This is the **run phases 4 & 5** path. It does not re-open the phase files' logic — it feeds them new input.

1. **Append to the census (a phase-4 Part-A update).** For each chosen item, add its row(s) to
   `OBJECT_TRACKING.md`'s `## Object Type Census` and a new line to `## Wave Rollout` (e.g. `Wave 4`) —
   classify spawn/own pattern, set the load-bearing flag, assign the wave. **Append only — never rewrite a
   confirmed wave's rows** (`4-map-game-objects.md` is append-friendly by design; §5). Guardrail fixes from
   Step 1c instead go back into **their owning wave's** rows.
2. **Re-enter the phase-5 wave loop for the appended wave(s).** Hand off to
   `5-tracking-restore-orchestrator.md`, running the new wave exactly like any wave **≥ 2**: `deep-scope
   (task 0) → capture (task 1) → restore-plan (task 2) → reconstruct (task 4)`, each at its human gate.
   **Skip task 3** (the restore *flow* is built once in Wave 1 and reused) — only the tracked set, the
   capture writers, and the `ApplyRestoredState()` buckets grow, additively. Re-capture at each new wave's
   task-1 gate (schema invalidation — `06 §6`).
3. **Loop back to Step 1.** A widened integration can reveal further gaps (a new family references another).
   Re-run the gap check until it comes back clean or the user stops.

> **Fresh session per wave batch.** Each wave carries heavy context. If the chat is long, suggest the user
> start a fresh session with the phase-5 orchestrator for the appended waves (SKILL.md "Fresh session").

### Step 4: Polish — cosmetic/timing fidelity + earlier-phase bugs
Once coverage is where the user wants it, tighten fidelity. **These reuse phase-5 patterns — point at them,
don't re-implement:**
- **Cosmetic / timing sequencing** — deferred properties that no-op when applied too early (`Rigidbody`
  velocity, `Animator` pose/state, `NavMeshAgent` warp, cooldown timers a `Start`/`OnEnable` resets). These
  belong in the **deferred queue** of the owning entity's restoration (`5c-plan-state-restoration.md` Step 7,
  `5e-implement-state-reconstruction.md`) and the environment/soundtrack restore (`5c` Step 9, `07 §8`).
- **Bugs surfaced earlier** — anything logged as an Open Question or a "known gap" in `RESTORATION_PLAN.md`
  / the TDD that isn't load-bearing enough to have blocked a gate. Root-cause each (no symptom-masking
  backstops — SKILL.md "Debugging & Diagnostic Gate").

> **⚠️ Scope of "timing" here is COSMETIC only.** If a timing problem makes a moment **unplayable** — a
> restore that lands the player in a non-controllable / wedged / nondeterministic state — that is **core**
> and belongs in the owning **phase-5 wave** (its CR-010 freeze / wait-for-player flow,
> `5c-plan-state-restoration.md §10` / `07 §10`), not here. Only sequence-the-visible-result work is polish.

Any code change here goes through the same recompile + **play/restore** human gate the wave loop uses — the
agent cannot see the Console (`unity/READING-UNITY-LOGS.md`); a clean compile never proves restore fidelity.

### Step 5: Finalize
When the user confirms nothing material remains:
1. **Append a completion section to `TDD_<GameName>.md`** (schema §6): final wave list + coverage, gaps
   deliberately **not** captured (with rationale), cosmetic polish applied, bugs fixed, and known accepted
   gaps. Unity has **no `integration.json` status file** — the TDD is the completion record.
2. **Flag a re-upload if the build changed.** Any new wave or fix means the uploaded build is stale — the
   new capture schema also invalidates prior cloud captures (`06 §6`). Tell the user to re-run **phase 7**
   (`7-upload-build.md`) to publish the widened build (a **minor** attached to the existing major), and that
   test captures must be re-recorded against the new schema.
3. Declare the integration complete **at the agreed scope**, naming what was and wasn't covered.

## 4. Questions to ask the human
- **Step 2 (the core one):** which recommended gaps to expand now vs. finalize at current scope — expansion
  is opt-in, per item.
- **Genre / mode**, if a mode or genre couldn't be inferred from code for the gap check.
- **Guardrail calls (Step 1c):** if it's unclear whether a gap is an earlier-wave miss or genuine breadth,
  surface it — the wrong call either re-opens a wave needlessly or defers load-bearing state.
- **Perf tradeoff (1b):** if a large widening pushes the write budget, whether to lower cadence / add
  skip-unchanged, or proceed at full cadence.
- **Finalize:** confirm "complete at current scope" before writing the TDD completion section.

## 5. Patterns to apply
- **Widen through the existing phases, never duplicate them** — this phase appends waves and re-enters the
  phase-5 loop; capture/reconstruction logic stays in phases 4 & 5.
- **Additive waves only** — a new wave appends `objectType` buckets + capture writers +
  `ApplyRestoredState()` buckets; it never rewrites a confirmed wave (`5` §5). Skip the restore *flow*
  (task 3) — built once in Wave 1.
- **The load-bearing guardrail decides the destination** (Step 1c) — breadth → new wave; a proven moment's
  missing state → fix the **owning** wave. Never carry load-bearing state forward as "enrichment."
- **Snapshot, not replay** — new mission/subsystem/one-time state captures the **resolved** value (timers as
  **remaining**, RNG as seed+count), applied once; never a timeline re-run (`06 §9.4`, `07 §9`).
- **Cosmetic timing here; playability timing is core** — deferred/visible-sequencing → this phase's polish
  (via `5c/5e`); unplayable-restore timing → the owning phase-5 wave.
- **Opt-in, incremental, looping** — recommend, let the user choose a subset, verify at gates, re-check.
  Completion is the user's call, recorded in the TDD.
- **Re-upload after widening** — a wider build + new schema means re-running phase 7 and re-recording
  captures.

## 6. Output Contract
| File | Purpose |
|------|---------|
| `ludeo-integration-plan/OBJECT_TRACKING.md` | Appended `## Wave Rollout` + census rows + per-wave `## Entity` sections for each new wave (via phase 4/5) |
| `ludeo-integration-plan/RESTORATION_PLAN.md` | Appended restoration rows for each new wave (via phase 5) |
| capture + `ApplyRestoredState()` code | New waves' writers + reconstruction buckets, additive (via phase 5) |
| `ludeo-integration-plan/TDD_<GameName>.md` | **Completion section** appended (Step 5) |

TDD completion section:
```markdown
## Phase 8: Polish & Completion

### Final coverage
- Waves captured & restoring: <1..N> — <one line each>
- Modes / experiences covered: <...>

### Widened in this phase
- <new wave(s) + what state they added, and why (broader coverage)>

### Earlier-wave misses fixed (guardrail)
- <state that a proven moment needed, re-opened in its owning wave>

### Cosmetic / timing polish
- <deferred properties, environment/soundtrack, sequencing fixes>

### Bugs fixed
- <earlier-phase Open Questions / known gaps resolved>

### Accepted gaps (deliberately NOT captured)
- <state + rationale (cosmetic-only, out of scope, perf)>

### Re-upload
- <re-ran phase 7 as minor build <id> | pending — build is stale until re-uploaded>
```

## 7. ✅ Success Criteria
- [ ] **Gap check run** against the current baseline across every Step-1b category (modes, mission/objective,
      world/environment, stateful subsystems, entity families, one-time state, genre checklist) — findings
      recorded, not skimmed.
- [ ] **Guardrail applied** — each gap sorted into *earlier-wave miss* (fix in the owning wave) vs *broader
      coverage* (new wave); no load-bearing state parked in an "expansion" wave.
- [ ] **User given a prioritized recommendation** and chose the expansion scope (or finalize) — expansion is
      opt-in.
- [ ] **Each chosen wave landed through phases 4 & 5** — appended to `## Wave Rollout`, run through the
      phase-5 loop (deep-scope → capture → restore-plan → reconstruct), and **passed its restore gate**
      (re-captured, placement-sane, replay-twice clean). Task 3 (flow) not re-run.
- [ ] **Cosmetic/timing polish + earlier bugs addressed** via the phase-5 patterns; any unplayable-restore
      timing pushed back to its owning wave as core, not patched here.
- [ ] **Completion recorded in the TDD** with final coverage + accepted gaps; **re-upload flagged** (phase 7)
      when the build changed, with re-recorded captures noted.
- [ ] Integration declared complete **at the user-agreed scope** — nothing stopped silently.

## 8. Common Mistakes
- **Re-implementing capture/reconstruction here** — this phase appends waves and re-enters phase 5; it owns
  no capture/restore logic of its own.
- **Rewriting a confirmed wave's rows / buckets** to add new state — waves are additive; append a new wave.
- **Backfilling load-bearing state as "expansion"** — if a proven moment needs it, fix the **owning** wave
  and re-verify its gate (the guardrail).
- **Capturing absolute timestamps** for timers/waves instead of remaining/elapsed deltas — they go stale on
  replay (`06 §9.4`).
- **Re-running scripted init on restore** for one-time state instead of re-applying only the active result —
  double-applies (`07 §9`).
- **Treating unplayable-restore timing as polish** — that is core; it belongs in the phase-5 wave (`07 §10`).
- **Expanding without asking** — the recommendation is opt-in; the user picks the scope.
- **Declaring done without re-uploading** — a widened build + new capture schema is stale until phase 7
  re-runs and captures are re-recorded (`06 §6`).
- **Claiming a wave restores from a clean compile** — every new wave needs the human play/restore gate.

## Related / Next
- [`4-map-game-objects.md`](4-map-game-objects.md) — append the new wave(s) to `## Wave Rollout` (Part-A
  census update); the load-bearing guardrail lives here.
- [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md) — the wave loop re-entered for
  the appended waves (run as waves ≥ 2, skipping task 3).
- [`6-actions-orchestrator.md`](6-actions-orchestrator.md) — if widening surfaces new player-perspective
  actions (e.g. `DoorOpened`, mode-specific events), add them there.
- [`7-upload-build.md`](7-upload-build.md) — **re-run after widening** to publish the wider build (minor).
- **Otherwise done** — the integration is complete at the agreed scope; the TDD records what was and wasn't
  covered.
</content>
</invoke>
