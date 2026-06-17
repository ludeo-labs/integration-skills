# Phase 5 — Actions (Orchestrated)

> **This is the phase-5 entry point.** Guideline phase 5 ("Actions") is one logical phase made of two
> single-task briefs: **map** the action points, then **implement** the `SendAction` calls. The driving
> agent runs as an **orchestrator**: it dispatches one **subagent per task** (via the Agent tool),
> passing artifacts **by file**, and **runs the single human gate itself** — so the whole thing feels
> like a single phase to the user.
>
> **Runs after phase 4.** Per the guideline, actions are wired only once the **player flow is proven**
> (phase 4 — a captured highlight plays back and visibly restores). Actions are enrichment on top of a
> working capture/replay loop, not a prerequisite for it.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Find the in-code points where significant **player actions** fire and insert `SendAction` calls so they
emit in **both** the Creator (capture) and Player (restore) flows — plus emit the **non-gameplay standard
actions** planned in phase 2 (`StartNoneLudeable`/`StopNoneLudeable` at non-ludeoable area boundaries,
`PauseLudeo`/`ResumeLudeo` for capture-hygiene pause) and document the **one-time platform global-trigger
mapping** the backend uses to exclude those windows. Deliverable: a reviewed action map + the wired
`SendAction` calls, with emission confirmed in the log in both flows.

## 2. Inputs (Input Contract)

- [ ] **Fresh agent session** for the orchestrator (its context stays lean — subagents carry the heavy
      per-task context). If this chat already has phase-5 work in it, start fresh.
- [ ] **Phase 4 complete** — the player flow is proven (captured highlight plays back and restores). The
      `[Layer]` exists with `LudeoController.SendAction` + the `LudeoActionKeys` scaffold (phase 2) seeded
      with the standard non-gameplay names.
- [ ] **Phase 1** → `ludeo-integration-plan/CODE_MAP.json`. **Phase 2** →
      `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (carries the non-ludeoable boundary-action
      mappings) + `TDD_<Game>.md` (its Actions section, if present).
- [ ] The two task briefs are present in `references/` (see §3).

## 3. Steps (the orchestration)

The driving agent is the **orchestrator**. It does **not** do the task work inline — it dispatches a
subagent per task, inspects the returned artifact, then **runs the human gate itself** after task 2. This
keeps each task in isolated context and lets the user experience one continuous phase.

**Dispatch pattern (per task):**
> Use the **Agent** tool (`subagent_type: general-purpose`). Prompt the subagent with: the **absolute
> path to the task brief**, the **Unity project path**, and the **input artifact paths** it needs. Tell
> it to follow the brief exactly, produce the brief's Output-Contract artifact, **not** to run the
> human-gated compile/play (the orchestrator owns it), and to return a short summary + the artifact path /
> files touched + any human-questions. On return, **verify the artifact exists**, relay questions, then
> dispatch the next task. Pass state **by file**, never by re-narrating prior output.

**Fix-loop pattern (gate failure):**
> When the human gate fails (compile error, or an action doesn't emit in a flow), the orchestrator
> **re-dispatches a fix subagent** pointed at the **implement** brief with the failing log text / the
> human's report **by file** + the files the prior subagent touched. Root-cause every fix
> (no try/catch or symptom-masking, `phase 5`/`5-compile-and-fix.md`); propose-confirm-execute each change.

| # | Task | Brief | Reads | Produces |
| --- | --- | --- | --- | --- |
| 1 | Map game actions | `references/6-map-game-actions.md` | `CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`, genre files | `ludeo-integration-plan/GAME_ACTIONS_MAP.md` (gameplay actions + the non-gameplay boundary actions) |
| 2 | Implement `SendAction` | `references/7-implement-game-actions.md` | `GAME_ACTIONS_MAP.md`, `SDK_INTEGRATION_POINTS.json` | filled `LudeoActionKeys` + `SendAction` call sites (gameplay + non-gameplay) + the platform global-trigger mapping note |

**Task 1 runs automatically as a subagent**, then the orchestrator **surfaces the action map to the human
for approval** (the action list is a judgment call — naming, keep/drop, scope). **Task 2 runs after
approval**, then the orchestrator **runs the single human gate**: recompile clean + play and confirm each
action **emits in the log in BOTH flows** (capture *and* replay). This compile+log gate is the single
unavoidable human touch-point in phase 5 (the agent can't see the Console; emission is log-only evidence).

### Reading the logs (the gate)

The orchestrator runs the gate but **cannot see the Console** — it confirms emission by reading **Unity's
log files** per [`unity/READING-UNITY-LOGS.md`](ludeo-integration-docs/unity/READING-UNITY-LOGS.md), and
beyond the log relies on the integrator's word. The compile-and-fix loop + `error CS` table live in
[`phase 5`](5-compile-and-fix.md).

## 4. Questions to ask the human

The orchestrator relays whatever a subagent surfaces — it does not invent its own. Expected ones:
- **Task 1:** genre (if the web search fails); a candidate that's plausibly state/noise (keep or drop);
  whether a player-scoped action's site can fire for non-player actors (needs a player-guard).
- **Task 1 gate:** approve `GAME_ACTIONS_MAP.md` (kept actions, names, drops, scope).
- **Task 2 gate:** confirm a clean recompile + each action emits in the log in **both** Creator and Player
  flow, and that the player-scoped actions are correctly attributed.
- **Out-of-code:** the **platform global-trigger mapping** for `StartNoneLudeable`/`StopNoneLudeable` — a
  one-time step the integrator performs on the platform (task 2 documents it).

## 5. Patterns to apply

- **Orchestrator / single-task-subagent dispatch** — each brief is run by a subagent in isolation; the
  orchestrator is thin and owns the human gate + fix loop.
- **Actions emit in BOTH flows.** `SendAction` is **never** gated on `IsInLudeoFlow` — the play flow
  re-fires the same sites so the SDK can score the Ludeo's win/fail during playback. Only **state writes**
  (phase 4 capture) are creator-only.
- **Filter for signal, not transcription.** Map *many meaningful* actions, not *many* actions —
  high-frequency input / tracked state / no-value candidates bloat the Ludeo and bury the moments that
  matter. The Dropped table keeps the filter reviewable.
- **Player-perspective naming + correct attribution.** Name actions from the player's perspective
  (`Kill`, `Death`); guard player-scoped actions on the player being actor/subject; fire global/match-scoped
  actions (`MatchWin`, `WaveComplete`) once, unguarded. The captured player identity is set via
  `SetGameplayerId` `[Layer]`, which **must match the id passed to `AddGamePlayer`** (phase 2) — that is
  what binds `SendAction` (parameterless in Unity) to the right player.
- **Non-gameplay handling is emitted here** (planned in phase 2). Three distinct mechanisms — whole
  non-gameplay screens (no action, session bracketing), non-ludeoable *areas*
  (`StartNoneLudeable`/`StopNoneLudeable` + platform global-trigger exclusion), capture-hygiene pause
  (`PauseLudeo`/`ResumeLudeo`, distinct from the SDK overlay pause). Don't conflate them.

## 6. Output Contract

Produced across the subagent tasks (each brief owns its own contract):
- `ludeo-integration-plan/GAME_ACTIONS_MAP.md` (task 1) — kept gameplay actions + Dropped table + the
  non-gameplay boundary/pause actions.
- Filled `LudeoActionKeys` + `SendAction` call sites (gameplay + non-gameplay), with backups (task 2).
- The **platform global-trigger mapping** note — the one-time out-of-code step (task 2).
- A clean compile + actions confirmed emitting in **both** flows in the log (the human gate).

## 7. ✅ Success Criteria (the guideline phase-5 gate)

The orchestrator confirms **all** of these before advancing to phase 6:

**Guideline phase-5 criteria:**
- [ ] **Action list mapped to `file:line` emit points** (task 1 → `GAME_ACTIONS_MAP.md`).
- [ ] **Actions named from the player's perspective** (task 1).
- [ ] **Matched to reference action names where they exist** — i.e. the genre-catalog names + the standard
      non-gameplay names (no canonical platform list exists yet) (task 1).
- [ ] **Actions emit at runtime in Creator flow** (task 2 gate, log).
- [ ] **Actions emit at runtime in Player flow** (task 2 gate, log).
- [ ] **player-id matches the id passed to `AddGamePlayer`** — via `SetGameplayerId` (phase 2); confirmed
      by correct attribution at the gate.
- [ ] **Emission verified in logs** (task 2 gate).

**Skill-specific additions:**
- [ ] Non-gameplay standard actions emitted — `StartNoneLudeable`/`StopNoneLudeable` at non-ludeoable area
      boundaries (no dangling open span on `EndGameplay`), `PauseLudeo`/`ResumeLudeo` for capture-hygiene.
- [ ] The **platform global-trigger mapping** documented as a one-time out-of-code step for the integrator.
- [ ] Player-scoped actions guarded on the player as actor/subject; global actions fired unguarded.
- [ ] No `#if` guard at call sites (CR-001 runtime); all calls route through the `[Layer]` façade.

## 8. Common Mistakes

- **Running the tasks inline instead of dispatching subagents** — bloats context, loses the one-phase feel.
- **Gating `SendAction` on `IsInLudeoFlow`** — actions must fire in **both** flows (the #1 actions bug).
- **Transcribing instead of filtering** — keeping high-frequency input / tracked state as actions bloats
  the Ludeo and degrades highlight detection.
- **Crediting the player with non-player actions** — a shared `OnEnemyKilled` needs a player-actor guard.
- **Forgetting the non-gameplay emissions** — they were *planned* in phase 2 and must be *emitted* here.
- **Skipping the platform global-trigger mapping** — without it the backend never excludes non-ludeoable
  windows.

## Related / Next

- Briefs: `6-map-game-actions.md`, `7-implement-game-actions.md`.
- Phase 2 (`2-lifecycle-orchestrator.md`) — planned the non-gameplay standard actions emitted here.
- Phase 4 (`9-tracking-restore-orchestrator.md`) — the player flow this phase enriches (run FIRST).
- **Next:** phase 6 (verification & cloud) — validate the release build and upload it to the Ludeo platform.
