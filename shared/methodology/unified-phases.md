# Unified Integration Phases (0–9)

Every engine skill walks this same spine. The **skeleton is identical across engines**; only the
bodies (UE idioms vs Unity idioms) differ. Each phase carries a one-line **Purpose** and a
**Success Criteria** checklist — an agent may not mark a phase complete until every box is checked.

Phases tagged **[MVP]** are the curated-slice fast path (≈48h target): they produce a working
end-to-end demo scoped to one chosen gameplay slice. Phases tagged **[Expansion]** broaden to
full-game coverage. **MVP-first is mandatory.**

Each `references/*.md` file in a skill maps to one phase below and follows the
[per-phase template](./per-phase-template.md).

---

## Phase 0 — Setup & Install
**Purpose:** Install the SDK plugin/package, set defines/settings, confirm compile both ways, run intake, and select the curated slice **[MVP]**.
- [ ] SDK references resolve (`using LudeoSDK;` / plugin headers compile)
- [ ] Project compiles **with** the SDK enabled
- [ ] Project compiles **without** the SDK enabled (baseline)
- [ ] State file / plan dir initialized (`.ludeo/integration.json`)
- [ ] Intake questionnaire answered and recorded
- [ ] Curated slice chosen and confirmed by the user **[MVP]**

## Phase 1a — Map Game Code
**Purpose:** Produce a CODE_MAP of the project (entry points, core classes, scenes/managers, event systems, entities).
- [ ] `CODE_MAP.json` exists at the project root
- [ ] Lifecycle hooks, core classes, event systems, candidate entities listed
- [ ] Every symbol verified against the actual codebase (no guessed names)

## Phase 1b — Find Integration Points
**Purpose:** Identify exactly where SDK lifecycle/action/tracking calls will go.
- [ ] Each SDK touchpoint mapped to a concrete `file:line` hook
- [ ] Rationale recorded for each chosen hook
- [ ] Ambiguous hooks flagged as questions, not assumed

## Phase 1c — Technical Design Document
**Purpose:** Capture architecture, strategy, and risks before writing code.
- [ ] TDD §1 written
- [ ] TDD **human-approved**
- [ ] Risks and open questions enumerated

## Phase 1d — Classify Save System
**Purpose:** Determine the persistence model to drive restoration strategy.
- [ ] Save group recorded in the state file
- [ ] Evidence captured (reference-sample match or concrete code findings)
- [ ] Classification confirmed by the human

## Phase 2a — Plan Lifecycle
**Purpose:** Map SDK session lifecycle to game hook points and define the gate(s) before BeginGameplay.
- [ ] Every game-event → SDK-call mapping listed
- [ ] All gate conditions (async signals) before BeginGameplay defined
- [ ] Plan approved by the user

## Phase 2b — Implement Lifecycle
**Purpose:** Create the integration layer (subsystem/component or controller layer) and wire activation.
- [ ] Layer files created
- [ ] All notifications registered **before** `Activate`
- [ ] Activation includes apiKey + game version + auth

## Phase 2c — Compile & Fix (gate)
**Purpose:** Prove the lifecycle code builds in both configurations.
- [ ] Build passes with plugin/defines **OFF** (baseline)
- [ ] Build passes with plugin/defines **ON**
- [ ] First-error-first fix loop run to completion
- [ ] No stubs left in shipped code

## Phase 3a — Map Game Actions
**Purpose:** Find the in-code points where significant player actions fire.
- [ ] Action list mapped to `file:line` emit points
- [ ] Actions named from the **player's perspective**
- [ ] Matched to reference action names where they exist

## Phase 3b — Implement Game Actions
**Purpose:** Insert action-report calls so they fire in **both** Creator and Player flow.
- [ ] Actions emit at runtime in **Creator** flow
- [ ] Actions emit at runtime in **Player** flow
- [ ] player-id matches the id passed to AddPlayer
- [ ] Emission verified in logs

## Phase 4a — Map Game Objects
**Purpose:** Discover trackable objects and the discrete attributes (not blobs) to capture.
- [ ] Object→attribute table produced
- [ ] Typed attributes chosen by default
- [ ] Blob use (if any) justified as genuinely opaque

## Phase 4b — Implement Object Tracking
**Purpose:** Register state handlers and capture per-tick attributes (Creator/write side).
- [ ] RegisterEntity writes initial attributes
- [ ] Per-tick capture runs
- [ ] Writes confirmed in logs
- [ ] Write-side guarded to Creator flow only

## Phase 5a — Plan State Restoration
**Purpose:** Plan the restore — objectType buckets, two-pass spawn/apply, references, deferred props.
- [ ] `RESTORATION_PLAN.md` written
- [ ] Bucket + two-pass strategy defined
- [ ] Reference-resolution order defined
- [ ] Plan approved

## Phase 5b — Implement Restoration Flow
**Purpose:** Wire the SDK-orchestration flow (LudeoSelected → GetLudeo → play flow, freeze/overlay/pause, RoomReady → Begin, restore entry point).
- [ ] Flow reaches the restore entry point on a real captured Ludeo
- [ ] Pause/overlay behavior correct
- [ ] **Hard gate:** Player Flow proven working before actions/enrichment proceed

## Phase 5c — Implement State Reconstruction
**Purpose:** Fill the data read-back — two-pass spawn-from-bucket apply, references, deferred props, environment.
- [ ] Captured highlight plays back and visibly restores positions/state
- [ ] Reader does not assert on missing attributes
- [ ] Restore verified by a human

## Phase 6 — Non-Gameplay Handling **[Expansion]**
**Purpose:** Mark non-ludeoable areas; handle pause/resume, map transitions, segment marking.
- [ ] Menus/transitions excluded from capture
- [ ] Pause/resume bracketed correctly
- [ ] No dangling non-ludeoable on EndGameplay

## Phase 7 — Enrichment / Full-Game Coverage **[Expansion]**
**Purpose:** Broaden entity/action/state coverage beyond the curated slice; set write-frequency strategy.
- [ ] Full entity set discovered and implemented
- [ ] Full action set discovered and implemented
- [ ] Write-frequency strategy chosen and justified
- [ ] Coverage matches the full-game commitment

## Phase 8 — Player Flow Polish **[Expansion]**
**Purpose:** Deferred property application, two-pass reconstruction edge cases, animation/cosmetic state.
- [ ] Cold-spawned actors restore cosmetics
- [ ] Deferred props applied at the correct tick
- [ ] Restore preserves OnRep invariants

## Phase 9 — Upload & Verify
**Purpose:** Validate the release build and upload it to the Ludeo platform. Delegates to the
`cloud-upload` skill.
- [ ] Build validated (complete, self-contained, launches cleanly)
- [ ] Build uploaded via the `ludeo` CLI
- [ ] Platform status polled to `ready`
