# Phase 3 — SDK Lifecycle (Orchestrated)

> **This is the phase-3 entry point.** Guideline phase 3 ("plan & implement the SDK lifecycle") is one
> logical phase made of five single-task briefs. The driving agent runs as an **orchestrator**: it
> dispatches one **subagent per task** (via the Agent tool), passing artifacts **by file**, so the
> whole thing feels like a single phase to the user. The five briefs stay distinct files; this doc is
> the conductor.

## 1. Goal / Purpose

Stand up the full **SDK session lifecycle**: map every game-event → SDK-call site, produce the TDD,
design the `LudeoController` layer, implement the layer + wire the game hooks, and reach a **clean
compile that runs with the capture overlay live**. Includes the **restoration entry point** (the
`LudeoSelected`/`onBeginRestore`/`RoomReady` stubs — the *flow logic* is phase 5 tasks 3–4) and the
**Non-Gameplay Handling** plan (identify here; emit in phase 6). Deliverable: a compiling, running
integration layer plus the planning artifacts the later phases consume.

## 2. Inputs (Input Contract)

- [ ] **Fresh agent session** (the orchestrator's own context stays lean — subagents carry the heavy
      per-task context). If this chat already has phase-3 work in it, start fresh.
- [ ] **Phase 1 complete** — package installed (`using LudeoSDK;` resolves), `LudeoSettings.asset`
      configured (apiKey/auth/Steam), `KYG.md` recorded.
- [ ] **Phase 2 complete** — `ludeo-integration-plan/CODE_MAP.json` exists.
- [ ] The five task briefs are present in `references/` (see §3).

## 3. Steps (the orchestration)

The driving agent is the **orchestrator**. It does **not** do the task work inline — it dispatches a
subagent per task and only inspects the returned artifact before dispatching the next. This keeps each
task in isolated context (no bloat) and lets the user experience one continuous phase.

**Dispatch pattern (per task):**
> Use the **Agent** tool (`subagent_type: general-purpose`). Prompt the subagent with: the **absolute
> path to the task brief**, the **Unity project path**, and the **input artifact paths** it needs.
> Tell it to follow the brief exactly, produce the brief's Output-Contract artifact, and return a
> short summary + the artifact path. On return, **verify the artifact exists and is well-formed**,
> relay any human-questions the subagent surfaced, then dispatch the next task. Pass state **by file**
> (the artifacts on disk), never by re-narrating prior output.

| # | Task | Brief | Reads | Produces |
| --- | --- | --- | --- | --- |
| 1 | Map integration points | `references/3a-find-sdk-integration-points.md` | `CODE_MAP.json` | `SDK_INTEGRATION_POINTS.json` |
| 2 | Technical Design Document | `references/3b-create-tdd.md` | `CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`, `TDD_TEMPLATE.md` | `TDD_<Game>.md` |
| 3 | Plan the layer | `references/3c-plan-sdk-lifecycle.md` | the three above | `SDK_LIFECYCLE_PLAN_<Game>.md` |
| 4 | Implement layer + hooks | `references/3d-implement-sdk-lifecycle.md` | TDD + plan | layer `.cs` files + edited game hooks |
| 5 | **Compile + run gate** | `references/3e-compile-and-fix.md` | the edited project | clean compile + live capture overlay |

**Tasks 1–4 run automatically as subagents. Task 5 does NOT** — the agent cannot see the Unity Editor
Console, and the gate needs the human to focus the Editor (recompile) and play the game (overlay). The
orchestrator runs 1→4 hands-off, then **surfaces the task-5 gate to the user** and waits for their
confirmation (or explicit skip). This is the single unavoidable human touch-point in phase 3.

**Non-Gameplay Handling is planned in this phase (emitted later).** The guideline folds non-gameplay
handling into the lifecycle. In Unity it splits three ways — task 1 maps the sites, task 3 plans the
emissions, and the actual `SendAction` calls land in phase 6. See §5 for the model and the standard
action names.

## 4. Questions to ask the human

The orchestrator relays whatever a subagent surfaces — it does not invent its own. Expected ones:
- **In the TDD task:** studio/graphics details and game modes not inferable from code.
- **In the plan task (open-world/streaming games):** which `start_sites[]` entry binds `OpenRoom`.
- **The compile + run gate (task 5):** the user confirms a clean recompile and a live capture overlay.

## 5. Patterns to apply

- **Orchestrator / single-task-subagent dispatch** — the pattern above. Each brief is written to be run
  by a subagent in isolation; the orchestrator is thin.
- **⚠️ Ludeo Session ≠ Gameplay Session.** `LudeoSession` (`InitLudeoSession` + `Activate`) is **app
  lifetime** — once at bootstrap, disposed at shutdown. `LudeoGameplaySession` (`Begin`…`End`/`Abort`)
  is **one playable moment** — many per run. Init/Activate/Dispose never go inside level start/end.
- **The reference architecture is the spine** — `unity/REFERENCE-ARCHITECTURE.md`
  (`LudeoController`/`LudeoFlowSwitch`/`LudeoGameplaySessionManager`/`ILudeoStateHandler`/`LudeoKeys`).
  Game code calls the `[Layer]` façade; the façade calls `[SDK]`. No scattered raw SDK calls (CR-001).
- **Activation config is in `LudeoSettings.asset` (phase 1), not in `Activate()` args.** The guideline's
  "activation includes apiKey + game version + auth" is satisfied by the package reading
  `LudeoSettings` — do **not** plan a config class or re-gather auth here.

### Non-Gameplay Handling — the Unity model (standard action names)

Three distinct mechanisms; don't conflate them:

1. **Whole non-gameplay screens** (main menu, lobby, loading) — sit **outside** any Gameplay Session.
   Nothing tracks them; **no action needed**. Handled purely by session bracketing (`Begin` only when
   gameplay starts; `End`/`Abort` on every exit — CR-007).
2. **Non-ludeoable *areas* inside live play** (shops, NPC dialogue, tutorials, safe zones, in-game
   menus) — tracking **keeps running**; the game emits **boundary actions** at enter/exit using the
   standard names **`StartNoneLudeable`** / **`StopNoneLudeable`** (`[SDK]` `SendAction(string)`). A
   **one-time, out-of-code step** maps those actions onto the platform's **global triggers**, and the
   **backend** excludes those time windows. (Identify the enter/exit sites in task 1; plan the emit in
   task 3; the `SendAction` calls land in phase 6.)
3. **Pause / cutscene = local capture hygiene** — a true sim freeze, distinct from non-ludeoable areas.
   Standard names **`PauseLudeo`** / **`ResumeLudeo`**. Note: the **overlay** pause is SDK-driven and
   separate — `AddNotifyPauseGame`/`AddNotifyResumeGame` freeze `Time.timeScale` (CR-011); that is the
   Ludeo overlay covering the game, not a game-initiated capture-hygiene pause.

> **Open cross-skill items:** (a) whether `StartNoneLudeable`/
> `StopNoneLudeable` is one generic start/stop pair for all non-ludeoable areas or needs per-area
> names — a platform global-trigger semantics question; (b) the core (C++) skill currently emits
> game-specific names (`ShopEntered`/`ShopExited`) and must sibling-sync to these standard names.

## 6. Output Contract

Produced across the subagent tasks (each brief owns its own contract):
- `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (task 1)
- `ludeo-integration-plan/TDD_<Game>.md` (task 2)
- `ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<Game>.md` (task 3) — includes the Non-Gameplay Handling plan
- `LudeoController` layer `.cs` files + edited game hooks (task 4)
- A clean compile and a live capture overlay (task 5)

## 7. ✅ Success Criteria (the guideline phase-3 gate)

The orchestrator confirms **all** of these before advancing — they are produced across tasks 1–5:

- [ ] **Every game-event → SDK-call mapping listed** (task 1).
- [ ] **All async gate conditions before `Begin` defined** — RoomReady apply→unfreeze→`Begin`, incl. the
      restore scene-load leg (task 3).
- [ ] **Layer files created** (task 4).
- [ ] **All notifications registered before `Activate`** (task 3 plan + task 4 enforcement).
- [ ] **Activation includes apiKey + game version + auth** — via `LudeoSettings.asset` (phase 1), read
      by the package (not `Activate()` args).
- [ ] **Menus/transitions excluded from capture** — session bracketing; non-ludeoable areas planned
      with `StartNoneLudeable`/`StopNoneLudeable`.
- [ ] **Pause/resume bracketed correctly** — overlay `AddNotifyPauseGame`/`Resume` freeze the sim;
      capture-hygiene `PauseLudeo`/`ResumeLudeo` planned.
- [ ] **No dangling non-ludeoable on `End`** — any open `StartNoneLudeable`/`PauseLudeo` span is closed
      before a Gameplay Session ends.
- [ ] **Project compiles with/without the SDK** (task 5).
- [ ] **Capture overlay appears at runtime** — the human-confirmed proof a Gameplay Session opened.

## 8. Common Mistakes

- **Running the tasks inline instead of dispatching subagents** — bloats the orchestrator's context and
  loses the one-phase feel. Dispatch; pass artifacts by file.
- **Trying to subagent-automate the compile gate** — task 5 needs the human + the Editor. Surface it.
- **Re-narrating prior output to the next task** instead of pointing it at the artifact file.
- **Treating callback-driven ops as game call sites** (`AddGamePlayer`/`Begin`/`CloseRoom` — CR-009).
- **Planning a config class / re-gathering auth** — config is `LudeoSettings.asset` (phase 1).
- **Conflating the three non-gameplay mechanisms** — whole-screen bracketing vs non-ludeoable areas
  (backend-excluded, tracking continues) vs capture-hygiene pause (sim freeze).

## Related / Next

- Briefs: `3a-find-sdk-integration-points.md`, `3b-create-tdd.md`, `3c-plan-sdk-lifecycle.md`,
  `3d-implement-sdk-lifecycle.md`, `3e-compile-and-fix.md`.
- **Next:** phase 4 (map game objects) — `4-map-game-objects.md` (census + wave plan), then phase 5
  (tracking & restore). Actions are phase 6 (after the player flow is proven); the non-gameplay standard
  actions planned here are emitted there.
