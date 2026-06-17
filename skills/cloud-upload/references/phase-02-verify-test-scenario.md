# Phase 02 — Verify test scenarios

Second ship gate. Before validating the folder and burning an upload, run the **bundled Ludeo
verification suite** ([`scenarios/`](scenarios/README.md)) against the freshly built game — plus any
game-specific scenarios the team has added — and confirm they all pass. This is the "does the
integration actually work in *this* build" check.

The suite ships **with the skill** and is generic to any Ludeo integration; the agent **adapts each
scenario to the game under test by reading that game's integration code** (capture trigger, restore
entry point, `DataWriter`/`DataReader` keys, the state fields that define a captured moment).

## 1. Goal / Purpose
Run every applicable scenario in [`scenarios/`](scenarios/README.md) against the phase-1 packaged build
and confirm each passes its own pass criteria. A single failing scenario stops the pipeline — do not
validate or upload a build that fails verification.

## 2. Inputs (Input Contract)
- [ ] Phase 1 passed — a clean shipping build exists at a known path
- [ ] The build's `--build-creation-type` is known: `new` (run the whole suite) or `sdkFree` (only `s01`)
- [ ] The game's Ludeo integration is readable, so the agent can resolve each scenario's
      `## Game-specific adaptation` placeholders
- [ ] Test account + network available (dedicated test account, never real credentials)

## 3. Steps
1. List the scenarios in [`scenarios/`](scenarios/README.md) and the team's own scenarios (if any —
   see [`authoring-test-scenarios.md`](authoring-test-scenarios.md)). Filter by applicability
   (`sdkFree` → `s01` only).
2. For each scenario, **resolve its `## Game-specific adaptation` items from the game code** — this is
   what makes a generic scenario test this game.
3. Run the scenario's steps against the phase-1 **packaged** build (not the editor, not a stale build);
   run them yourself if you can drive the game, otherwise walk a human through them.
4. Judge against that scenario's **`## Pass criteria` only** — don't substitute your own "looks fine".
5. Capture the listed evidence per scenario.
6. Record each result in `.ludeo/cloud-upload.json` →
   `gates.scenario.suite[<id>] = { result, evidence }`, with any skipped scenarios marked and why.
7. Gate result: **pass only if every applicable scenario passed.** On any failure, record it and stop.

## 4. Questions to ask the human
- Is this a `new` or `sdkFree` build (decides which scenarios apply)?
- Where is the game's Ludeo integration, so the adaptation placeholders can be resolved?
- Any game-specific scenarios to run **in addition** to the bundled suite?
- Can the agent drive the build directly, or should it walk you through the manual steps?

## 5. Patterns to apply
- Always run against the **phase-1 packaged build**. A pass on a different/older build is not a pass.
- Resolve adaptation placeholders from the **actual game code**, not assumptions — a scenario that
  wasn't adapted to this game didn't really test it.
- Re-run the suite if the build is rebuilt after a fix — the gate is tied to *this* artifact.
- Run cheap/blocking scenarios first (`s01` before the capture/restore chain `s02`→`s05`).

## 6. Output Contract
- Every applicable suite scenario (and any team scenarios) ran against the phase-1 build with a clear
  per-scenario pass/fail.
- Evidence captured and referenced from state.
- `.ludeo/cloud-upload.json` → `gates.scenario` records per-scenario results; the gate is `pass` only
  if all passed.

## 7. Success Criteria
- [ ] Every applicable scenario ran against the packaged build
- [ ] Each scenario's adaptation placeholders were resolved from the game's integration code
- [ ] All applicable scenarios passed; per-scenario results recorded in state

## 8. Common Mistakes
- Running scenarios in the **editor** instead of the packaged build.
- Passing the gate on a **stale** build from before the latest fix.
- Running a generic scenario **without adapting it** to the game — it proves nothing about this game.
- Marking the gate `pass` when one scenario failed or was silently skipped.
- Running the SDK scenarios (`s02`–`s06`) against an `sdkFree` build instead of skipping them.
