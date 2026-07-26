# Phase 0 — Kickoff Intake Questionnaire

## 1. Goal / Purpose

This questionnaire captures **design, UX, and environment decisions that cannot be derived from code inspection**. It runs at Phase 0 kickoff, BEFORE Phase 1 architecture analysis starts.

Structural tools (BP Inspector, code-map, grep) answer *what classes/delegates exist*. They cannot answer: *what must the first frame of Player Flow look like?* Those are UX calls the game team has to state — and in practice they surface as mid-project corrections that each cost a rebuild cycle.

This document covers 6 question groups. Every question is **wired to a downstream gate** — answers become mandatory checks in a specific later phase. Questions that don't have a downstream gate don't belong here.

Derived from the ActionGame retrospective (Apr 2026) and dry-run-validated against Lyra.

---

## 2. Inputs (Input Contract)

**At Phase 0, after the curated slice is selected but before Phase 1 analysis begins.** Target time: 20-30 minutes with the game-team lead. If the team can't answer a question, record `"unknown"` and mark as a risk — do NOT block kickoff. Risks resurface at the phase that gates on them.

**How to ask — the audience knows their game and UE, and nothing about Ludeo.** Before asking any question from this document, strip the skill's internal vocabulary: no tier numbers, phase gates, or reference-file names in question text, and every Ludeo-side concept (cloud build, Player Flow, room, highlight) explained inline in one sentence of game-dev language. An integrator hearing unexplained pipeline jargon either blocks on it or answers wrong silently. If they push back on a question, answer the meta-question plainly first, then re-confirm their choice. See `learnings/common-mistakes/intake-questions-must-be-jargon-free.md`.

---

## 3. Steps

### Step 1 — Run the Six Question Groups

Work through each question group below in order. For each question, ask the human, record their answer to `.ludeo/integration.json` under the `intake` block, and flag unknowns as risks.

Write every answer to `.ludeo/integration.json` under a new `intake` block:

```json
{
  "intake": {
    "visiblePlayerState": { ... Group 1 answers ... },
    "dynamicPhaseMetadata": { ... Group 2 answers ... },
    "playbackUXBar": { ... Group 3 answers ... },
    "captureTimingRules": { ... Group 4 answers ... },
    "eventDrivenScriptedSystems": { ... Group 5 answers ... },
    "launchModel": { ... Group 6 answers ... },
    "completedAt": "2026-MM-DD",
    "risks": ["unknown:<question-id>", ...]
  }
}
```

Downstream pre-flight checklists read this block directly. If a required field is missing, the phase's pre-flight check fails and the agent must resolve it before proceeding.

---

#### Group 1 — Visible Player State (HUD / Avatar Invariants)

**Why this matters:** Even with perfect C++ state restoration, the **first rendered frame** of Player Flow must match the captured moment visually, or the demo feels broken. "State is correct but the avatar looks wrong" is the most common UX failure mode — and it's a design call, not a technical one.

**Questions:**

| ID | Question |
|----|----------|
| `VPS-1` | What MUST the player see correctly **in the first frame** of Player Flow? Walk the avatar top-to-bottom: mask/helmet, face, weapon in hand, weapon attachments, ammo count, health bar, armor/shield, equipped gadget, active status effects (buffs, debuffs, overheat). |
| `VPS-2` | What visible state is cosmetic and CAN be deferred or skipped? Idle fidget, breathing animation, mid-reload pose, cape sway. |
| `VPS-3` | What HUD/metadata must read correctly at frame 0? Score, mission timer, objective marker text, radar/minimap dots, squad indicators, mini-map icons. |
| `VPS-4` | Is there a loadout/progression/unlock dependency that drives which weapons or gadgets the player can be restored with? |

**Record as:**
```json
"visiblePlayerState": {
  "firstFrameRequired": ["mask", "primaryWeaponEquipped", "ammoCount", "healthBar"],
  "deferrable": ["idleFidget", "breathing"],
  "hudAtFrameZero": ["missionTimer", "objectiveMarker"],
  "loadoutDependency": "none | <description>"
}
```

**→ Wired to:** Phase 03 pre-flight checklist (see `phase-03-map-objects.md` §7 pre-flight). Every item in `firstFrameRequired` becomes a mandatory restoration path that must be implemented (not stubbed) before Phase 03 can complete.

**Evidence:** ActionGame #1 (ability state — first-frame unmasked player broke the fantasy for 5 seconds).

---

#### Group 2 — Dynamic Phase Metadata

**Why this matters:** Most games have a small set of globals that drive music, AI pressure, UI tone. These are tempting to treat as static room-open metadata. But if they change during a captured slice, they must be written **per-tick** — and if they must be restored (not just written), that's a separate requirement.

**Questions:**

| ID | Question |
|----|----------|
| `DPM-1` | Are there game-wide phase/state enums that drive music, AI behavior, UI, or mission flow? Name them. (ActionGame: `MissionState`, `CombatPhase`, `IntensityScale`, `LevelProgression`.) |
| `DPM-2` | Do any of them CHANGE during the curated slice? If yes → must be written per-tick to GameMetadata. |
| `DPM-3` | Do they need to be RESTORED in Player Flow (restored session reads back captured phase), or is write-only sufficient? |
| `DPM-4` | Any truly static metadata (one-time at room open)? Map name, bot count, difficulty, experience asset. |

**Record as:**
```json
"dynamicPhaseMetadata": {
  "phaseEnums": [
    {"name": "MissionState", "changesDuringSlice": true, "mustRestore": true},
    {"name": "DifficultyTier", "changesDuringSlice": false, "mustRestore": false}
  ],
  "staticMetadata": ["MapURL", "BotCount"]
}
```

**→ Wired to:** Phase 4 pre-flight (GameMetadata writable object plan). Every phase enum where `changesDuringSlice: true` must appear in the per-tick write loop. Every one where `mustRestore: true` must appear in the Player Flow read-and-apply path.

**Evidence:** ActionGame #5 (MissionState captured in Combat played back as Stealth — music, AI, UI all wrong). Lyra Phase 7 ExperienceName restoration required for multi-mode dynamic ServerTravel — a closely related case.

---

#### Group 3 — Playback UX Bar

**Why this matters:** The gap between *"restored state is correct"* and *"the first 5 seconds of the Ludeo feels like a Ludeo"* is a UX bar that must be set explicitly. Otherwise the integration lands fine technically and still gets rejected on feel. Setting the bar up front routes cinematics/montages/locks into Phase 4 gating code instead of end-of-project debug panic.

**Questions:**

| ID | Question |
|----|----------|
| `PUX-1` | What should the first 5 seconds of Player Flow feel like? Immediate action? Is a visible transition (black frame, HUD fade-in) acceptable, and for how long? |
| `PUX-2` | What intro cinematics, briefing voiceovers, pre-match countdowns, warmup phases, or tutorial gates play at normal mission start? Must they ALL be skipped in Player Flow? Who triggers each (C++, level BP, ability system, Wwise event)? |
| `PUX-3` | Are ability-activate / draw-weapon / equip-gadget animations acceptable in Player Flow, or must they be instant? |
| `PUX-4` | What is the acceptable input-lock window from spawn to "player has full control"? |

**Record as:**
```json
"playbackUXBar": {
  "firstFiveSecondsMustFeel": "immediate gameplay, no briefing",
  "gatesToSuppressInPlayerFlow": [
    {"gate": "setupBriefingVO", "trigger": "AGameLevelScriptActor::HandleActionPhaseStarted"},
    {"gate": "abilityActivateMontage", "trigger": "UPlayerAbility"},
    {"gate": "warmupPhase", "trigger": "GamePhaseSubsystem::StartPhase(Warmup)"}
  ],
  "instantAnimationsRequired": ["ability-activate", "weapon-equip"],
  "maxInputLockMs": 500
}
```

**→ Wired to:** Phase 4 pre-flight (every `gatesToSuppressInPlayerFlow` entry must have a gating path in the restoration code) AND Phase 4 functional verification (human must confirm first-5-seconds matches `firstFiveSecondsMustFeel`).

**Evidence:** ActionGame #8 (setup VO + ability-activate montage — entire end-of-project debug session). **Lyra validation:** warmup phase skip decision (Phases 4+2) — this question would have flagged it up front instead of surfacing as a mid-phase correction.

---

#### Group 4 — Capture Timing Rules

**Why this matters:** A Ludeo captured too early is boring or empty — not because the integration is broken, but because nothing interesting has happened yet. Without documented thresholds, the team files "early capture looks wrong" as a bug and the agent debugs a non-bug for hours.

> ### ⚠️ HARD RULE — the room OPENS at level load, NOT at "gameplay start"
>
> **`OpenRoom` happens as soon as the gameplay world is ready (component `BeginPlay`), decoupled from
> any warmup / countdown / "combat-triggered" / "interesting-state" condition.** The ONLY thing those
> conditions gate is **`BeginGameplay`** (the N-way gate: RoomReady + PlayerAdded + gameplay-phase).
>
> Do **not** phrase or record this as "open the room when gameplay starts," and do **not** gate
> `Session::OpenRoom` on a game phase. In **Creator flow the platform delivers `OnRoomReady` ~1 ms
> after `AddPlayer` ONLY when the room opened in the normal level-load window** — a room opened late
> (e.g. seconds later, when the Playing phase starts) **never receives `OnRoomReady`, the begin gate
> hangs, and nothing records** (Lyra Phase 2, log-verified). Two distinct triggers:
> | Trigger | When | Gated on a game phase/state? |
> |---|---|---|
> | **Room open** (`OpenRoom` + `AddPlayer`) | level load (`BeginPlay`) | **NO — always at level load** |
> | **BeginGameplay** | round actually interactive | **YES — warmup-skip / Playing-phase / interesting-state** |
>
> See `learnings/common-mistakes/open-creator-room-at-level-load-not-on-phase.md`.

**Questions:**

| ID | Question |
|----|----------|
| `CTR-1` | When does **interactive gameplay BEGIN** (i.e. when should `BeginGameplay` fire)? After warmup/countdown? At "combat"? After N seconds of progression? (The room still OPENS at level load regardless — this only gates `BeginGameplay`.) Which pre-gameplay phases must be skipped in Player Flow? |
| `CTR-2` | When should the room CLOSE? Mission end? Extraction? Death? Explicit player action (photo mode, manual end)? |
| `CTR-3` | Is there a minimum "interesting state" threshold below which captures are EXPECTED to be uninteresting (e.g., `LevelProgression > 0`, at least one enemy killed)? Name it. |

**Record as:**
```json
"captureTimingRules": {
  "beginGameplayTrigger": "missionState == Alarm OR Combat",
  "roomCloseTrigger": "missionEnd OR playerDeath",
  "minimumInterestingStateThreshold": "LevelProgression > 0 AND elapsedSeconds > 30",
  "_note": "Room ALWAYS opens at level load (BeginPlay). beginGameplayTrigger gates only BeginGameplay, never OpenRoom."
}
```

**→ Wired to:** Phase 2 lifecycle code review — `OpenRoom` is at level load (NEVER phase-gated);
`beginGameplayTrigger`/`minimumInterestingStateThreshold` gate **`BeginGameplay`** (the N-way gate);
`roomCloseTrigger` gates the teardown chain. Also wired to a TDD documentation block so that when
early/empty captures surface, the team can match against the documented threshold before debugging.

**Evidence:** ActionGame #9 (`LevelProgression=0` in test captures debugged as broken writes until
clarified as "capture too early, not a bug"). Lyra Phase 2 (room gated on Playing phase → `OnRoomReady`
never fired → nothing recorded; fixed by opening the room at `BeginPlay`).

---

#### Group 5 — Event-Driven Scripted Systems (Progression Trails)

**Why this matters:** There are two kinds of state. **Snapshot state** (positions, health, current phase enum) can be captured and applied directly on restore. **Progression trail state** (objectives passed, milestones hit, mission props used, level BP event history) cannot — because the game's scripted systems respond to a *sequence of past events*, not current values. If you snapshot the current state and restore it at time 0, the level blueprint re-executes setup-phase logic, queues stale briefing VO, and spawns early-phase NPCs. The only fix is to capture the trail of events and replay them to drive the scripted systems forward to the captured moment.

The skill previously deferred these systems to Phase 7 (enrichment) — which is wrong for anything load-bearing in the curated slice. This group surfaces them up front so Phase 4 plans include trail capture from the start.

**Questions:**

| ID | Question |
|----|----------|
| `EDS-1` | Does the game have mission/objective/milestone systems that drive scripted events (NPC spawns, VO, cinematics, map activation, escape-zone activation, tutorial prompts)? List them. |
| `EDS-2` | For each listed system, does it fire based on **current state** (snapshot works) or **a sequence of past events** (trail required)? If the game has an "OnMilestonePassed" / "ObjectiveComplete" / "FlagRaised" delegate that triggers scripted logic, it's a trail. |
| `EDS-3` | Does the level blueprint (ULevelScriptActor) execute scripted logic based on mission progression? If yes — this is **load-bearing for Phase 4**, not a Phase 7 addition. The level BP needs to believe the mission has reached the captured moment, or it replays early-phase logic. |
| `EDS-4` | What mission props have state that affects gameplay when restored? Deployables (partially deployed?), cameras (disabled?), extraction zones (activated?), switches, interactable objects, destructibles. Each one's state may need capture beyond position. |

**Record as:**
```json
"eventDrivenScriptedSystems": {
  "missionSystems": [
    {"name": "OnMilestonePassed", "kind": "trail", "loadBearing": true, "captureHook": "UMissionDirector::OnMilestonePassedDelegate", "replayHook": "NotifyClientPassedMilestone"},
    {"name": "ObjectiveState", "kind": "trail", "loadBearing": true}
  ],
  "missionProps": ["deployable", "camera", "escapeZone"],
  "levelBPDrivesScriptedLogic": true
}
```

**→ Wired to:** Phase 1 curated slice selection (if `levelBPDrivesScriptedLogic: true`, the slice must include progression trail capture in its Phase 4 plan — no deferral). Phase 4 pre-flight (every `kind: "trail"` + `loadBearing: true` entry must have both a capture path AND a replay path planned — not stubs, not deferred). Phase 4 functional verification (level BP does not re-execute early-phase logic on restore).

**Evidence:** ActionGame setup-phase VO + early-phase NPC spawn bug. The agent initially deferred milestone/objective tracking to Phase 7 as "enrichment." When this surfaced as a broken demo, it tried to hack around it with VO suppress races and late-sweep NPC destruction ("sometimes we win, sometimes not" — TDD line 457) before pulling Phase 7 work back into Phase 4 properly.

---

#### Group 6 — Launch Model & SDK-Readiness

**Why this matters:** A classic frontend menu silently does three jobs for the SDK — it absorbs `Init`→`Activate` latency, it absorbs **async consent** latency (the flow flips from disabled to enabled before the first Creator `OpenRoom`), and it is where the create-vs-play branch is consumed. A game that **boots straight into a gameplay level** — no menu — has none of that cover, so it needs an explicit **SDK-readiness idle gate**: hold the first interactive/recorded frame until `Activate` + consent resolve, **bounded** with a fallthrough so an offline / no-Steam machine still launches (uncaptured) instead of hanging. This is a lifecycle-*shape* decision that can't be read from code alone, and if missed it surfaces late as "the first room never records."

**Questions:**

| ID | Question |
|----|----------|
| `LM-1` | On launch, does the game drop the player straight into a playable level, or through a frontend menu (main menu / lobby / press-start) first? If there's a menu, is it a deliberate click-through, or does "Play" immediately load-and-start? |
| `LM-2` | Does the game ever auto-continue, skip the intro, or boot directly into a session (a "continue" path, a debug auto-enter)? These blow past the menu's implicit wait the same way a menu-less boot does. |
| `LM-3` | For playing back a Ludeo: does the player pick one from a gallery/menu, or can the game be launched with a specific moment **pre-selected** (boot straight into the restored moment)? |

**Record as:**
```json
"launchModel": {
  "creatorLaunch": "menu-gated | boot-straight | fast-menu-autostart",
  "menuDwell": "clickthrough | immediate-load-start",
  "playerLaunch": "gallery | preselected",
  "readinessGateRequired": true
}
```

**→ Wired to:** Phase 2 lifecycle. When `creatorLaunch` is `boot-straight` / `fast-menu-autostart` (or a menu whose "Play" is `immediate-load-start`), Phase 2 MUST add the SDK-readiness idle gate — the game's own pause / in-game surface realized as the "ready & waiting" state, opening no Creator room until an explicit start trigger, **bounded** with a fallthrough that starts uncaptured on consent-denied / init-failure / timeout. Phase 1 cross-checks this answer against the default-map / boot-flow code and flags a mismatch. See `learnings/architecture/cloud-needs-idle-ready-state-before-room-open.md` and `learnings/architecture/sdk-activation-competes-with-game-boot.md`.

**Evidence:** A menu-less game has nothing to absorb `Activate` / consent latency; a Creator `OpenRoom` fired synchronously at level `BeginPlay` races ahead of consent and silently no-ops (no room, no `OnRoomReady`, no error). Surfaced on cloud-build integrations of boot-straight games — the same failure the classic menu hides by accident.

---

### Step 2 — Record Answers and Flag Risks

1. **Record answers to `integration.json → intake`** at end of the kickoff session.
2. **Flag unknowns as risks**, not gaps. Revisit at the phase that gates on them.
3. **Downstream phases enforce.** Phase 4 pre-flight reads `intake.visiblePlayerState.firstFrameRequired` and fails if any item is not restored. Phase 4 verification reads `intake.playbackUXBar.firstFiveSecondsMustFeel` and blocks completion until human confirms. Without this enforcement, the intake is ritual. With it, it's a contract.

---

## 4. Questions to Ask the Human

All questions are embedded in the six groups in §3. There are no additional questions beyond the groups — each group is a structured question set to be asked verbatim (after stripping Ludeo-internal vocabulary per the audience note in §2).

---

## 5. Patterns to Apply

**What this questionnaire does NOT cover** (and why — these are out of scope by design):

- **Curated slice selection, offline backend, exact load command** — already covered in SKILL.md Phase 0 setup.
- **Entity/action tier priority (P0/P1/P2)** — imported into Phase 1 entity discovery as a tiering mechanic, not a kickoff question.
- **Action granularity and naming** — already covered in Phase 5 (Significant Actions).
- **Rebuild time, branch policy, QA logistics** — observed empirically during Phase 0 setup; not a design question.

These were in an earlier draft and were dropped to prevent kickoff theater and duplication with existing phase coverage.

---

## 6. Output Contract

```
Produces:
  integration.json → intake    — All five groups recorded; unknowns listed as risks
  risks[]                      — Any "unknown:<question-id>" entries for downstream phases
```

The `intake` block is a contract, not a log. Downstream phases read it directly and fail pre-flight if required fields are missing.

---

## 7. ✅ Success Criteria

- [ ] SDK references resolve (plugin headers compile)
- [ ] Project compiles WITH the SDK enabled
- [ ] Project compiles WITHOUT the SDK enabled (baseline)
- [ ] Intake questionnaire answered and recorded in `.ludeo/integration.json`
- [ ] VCS detected; isolation context created; SDK acquired (per Phase 0 steps)

---

## 8. Common Mistakes

This questionnaire was validated by replaying it against two integrations:

**ActionGame** (source of the evidence): 4 of 10 recorded mid-project corrections would have been prevented (visible ability state, MissionState restoration, setup-VO + ability-activate-montage, early-capture LevelProgression=0). The remaining 6 are structural/technical discoveries that intake correctly cannot prevent.

**Lyra** (independent validation): 1 of 10 recent phase-1-through-7 decisions would have been cleanly prevented (warmup-phase skip — exactly Group 3 / `PUX-2`). 2 more borderline (ExperienceName dynamic metadata partial match with Group 2). The other 7 are engine quirks, export strategies, and technical architecture — correctly out of intake scope.

**Signal:** Groups 1-4 catch real UX/design failures on both AAA and sample-game integrations without bloating into territory better handled by structural tools or later-phase discovery.

**Group 6 (Launch Model)** was added from cross-engine parity work — a boot-straight game has no menu to absorb `Activate`/consent latency, so it needs the SDK-readiness idle gate up front. It wires to the same Phase 2 lifecycle rule already captured in `learnings/architecture/cloud-needs-idle-ready-state-before-room-open.md`; surfacing it at intake turns a mid-project "first room never records" correction into a kickoff answer.
