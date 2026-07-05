# Phase 3 · Task 2 — Technical Design Document (Unity)

> **Single-task subagent brief.** Dispatched by the phase-3 orchestrator
> (`3-lifecycle-orchestrator.md`). Do exactly this one task, produce the §6 artifact, and return a
> short summary + the artifact path. You run in isolated context — your inputs are the files in §2.
> **Entry: only via the orchestrator.** This is task 2 of 5 in phase 3 (SDK lifecycle), not a phase of
> its own — never open or run it standalone.

## 1. Goal / Purpose

Produce a TDD from `CODE_MAP.json` + `SDK_INTEGRATION_POINTS.json` — architecture assessment,
integration strategy, and risk analysis — before implementation planning. Output
`ludeo-integration-plan/TDD_<GameName>.md`, following `TDD_TEMPLATE.md` exactly.

## 2. Inputs (Input Contract)

- [ ] `ludeo-integration-plan/CODE_MAP.json` (phase 2).
- [ ] `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (task 1).
- [ ] Context files read:
  - `ludeo-integration-docs/TDD_TEMPLATE.md` — the output structure (follow it exactly).
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CRs that inform risk assessment.
  - `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` — lifecycle concepts for capture/restore sections.
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the layer the strategy will use.
  - *(when available)* `06-TRACKING-PATTERNS.md` / `07-RESTORATION-PATTERNS.md` deepen the capture /
    reconstruction sections.
- **Do not re-analyze game code** — use only the two artifacts above.

## 3. Steps

1. Read the inputs + `TDD_TEMPLATE.md`.
2. Fill the template section by section, Unity-specifically:
   - **Game Overview** — Unity version + render pipeline from `project_summary`; input system + 3rd-party
     packages from `input_ai` / `packages`; game modes inferred from code (ask if unclear); studio/
     graphics ask the user if not in code.
   - **Integration Key Concepts** — capture via per-frame `UpdateStateObjects()` `[Layer]` sampling;
     reconstruction via **objectType buckets** (spawn-from-data by default; re-bind-to-persistent only
     if needed, CR-014); patterns from `CODE_MAP`; threading (main-thread expected; coroutines/async/
     Jobs → CR-013).
   - **State Capture Solution** — game-specific mermaid diagram; object lifecycle from `object_model`
     (one `ILudeoStateHandler` per entity, stop on `OnDestroy`); **non-Ludeoable handling** (whole-screen
     bracketing + the `non_ludeoable` boundary actions from task 1); actions from `event_systems` →
     `SendAction`.
   - **State Reconstruction Solution** — game-specific mermaid reflecting CR-010 order; object recreation
     per objectType bucket with two-pass (CR-006).
   - **Multiplayer** — document only if `CODE_MAP` shows it; else **N/A** (v1 targets single-player).
   - **Risks & Open Questions** — evidence-based, citing `CODE_MAP`/`SDK_INTEGRATION_POINTS`. Check the
     applicable CRs: CR-001 (runtime disable), CR-005 (sampling site, no SDK tick), **CR-007 (ALL exit
     paths enumerated?)**, CR-009 (callback wiring), CR-010/011 (pause), CR-014 (identity). Concrete
     risks only.
3. Flag human-required sections inline: `> ⚠️ **REQUIRES HUMAN INPUT:** [what's needed and why]`.

## 4. Questions to ask the human

Surface to the orchestrator:
- Studio / graphics details and **game modes** not inferable from code.
- Any template section that genuinely needs a human decision (flagged with the `REQUIRES HUMAN INPUT` marker).

## 5. Patterns to apply

- Follow `TDD_TEMPLATE.md` exactly; remove its HTML comments; replace example diagrams with
  game-specific ones.
- **Reconstruction = objectType buckets, spawn-from-data by default** (CR-014); re-bind-to-persistent
  only when justified.
- The **save-system classification** lives in `KYG.md` (phase 1, game-level); the per-entity
  reconciliation matrix is phase 4 — the reconstruction section here is provisional until then.

## 6. Output Contract

`ludeo-integration-plan/TDD_<GameName>.md` (game name from `project_summary`, spaces → underscores),
following `TDD_TEMPLATE.md` with game-specific diagrams and no template HTML comments.

## 7. ✅ Success Criteria

- [ ] TDD exists at `ludeo-integration-plan/TDD_<GameName>.md`, all template sections filled or marked N/A.
- [ ] Capture, reconstruction, and **non-Ludeoable handling** sections reflect this game's `CODE_MAP`.
- [ ] Risks are evidence-based and cite the artifacts; no speculative risks.
- [ ] Human-required sections flagged with the `REQUIRES HUMAN INPUT` marker.

## 8. Common Mistakes

- **Re-analyzing game code** instead of using the two artifacts.
- **Fabricating risks** or omitting the CR-007 exit-path check.
- **Leaving template HTML comments / example diagrams** in the output.
- **Treating the reconstruction section as final** before phase 4's per-entity matrix.

## Related / Next

- **Next (orchestrator):** task 3 — `3c-plan-sdk-lifecycle.md` (plan the layer from this TDD + the artifacts).
