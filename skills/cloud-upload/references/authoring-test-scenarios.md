# Authoring a game-specific QA test scenario

Phase 2 already runs the **bundled Ludeo verification suite** ([`scenarios/`](scenarios/README.md)) —
the standard checks that ship with the skill and apply to any Ludeo integration. This file is for
adding scenarios **on top of** that suite: behavior unique to a particular game that the standard suite
can't know about (a specific game mode, a bespoke capture trigger, a known past regression).

You don't need to re-author the standard checks — capture, restore, data round-trip, cold start, and
graceful failure are already covered by the suite. Add a scenario here only when the game has behavior
worth verifying that the suite doesn't.

A good scenario is **named, stored in the project, and unambiguous** — same steps, same expected
results, every time, so "pass" means the same thing to everyone.

## Where scenarios live

Store scenarios in the **game project repo** (committed and reviewable), one file per scenario:

```
qa/ludeo-scenarios/<scenario-id>.md
```

`<scenario-id>` is a stable kebab-case id (e.g. `capture-and-restore-checkpoint`). Phase 2 records the
id it ran in `.ludeo/cloud-upload.json` → `gates.scenario`, so the id must not change once it's in use.
If your team already keeps QA docs elsewhere (a wiki, a sheet), point phase 2 at that location instead —
the only hard requirements are a **stable name** and **explicit pass criteria**.

## Anatomy of a scenario

Every scenario must answer four questions:

1. **What state must exist first?** (preconditions / setup)
2. **What exact steps does the tester take?** (ordered, one action per step)
3. **What must be observed?** (an expected result per step — observable, not "it works")
4. **When does it pass?** (an explicit pass rule, plus what evidence to attach)

## Template — copy this into `qa/ludeo-scenarios/<id>.md`

```markdown
---
id: capture-and-restore-checkpoint
name: Capture a checkpoint Ludeo and restore it
owner: QA / <team>
build-target: Shipping (packaged build, not the editor)
last-updated: 2026-06-17
---

# Capture a checkpoint Ludeo and restore it

## Preconditions / setup
- Fresh install of the packaged build (no prior save).
- Test account signed in; network available.

## Steps
| # | Action | Expected result |
| - | ------ | --------------- |
| 1 | Launch the packaged build | Main menu loads within 10s, no error dialog |
| 2 | Start a new game and reach the first checkpoint | Checkpoint banner shows; HUD shows score > 0 |
| 3 | Trigger a Ludeo capture at the checkpoint | Capture confirmation appears; no warning in logs |
| 4 | Quit, relaunch, and restore the captured Ludeo | Game loads directly into the checkpoint state |
| 5 | Compare restored state to step 2 | Player position, score, and inventory match step 2 |

## Pass criteria
- PASS only if **every** "Expected result" is observed, and the restored state in step 5 matches the
  captured state in step 2. Any mismatch, crash, or error dialog is a FAIL.

## Evidence to capture
- Screenshot of the checkpoint (step 2) and the restored state (step 5).
- The build's log file for the run.

## Notes
- Run against the **packaged** build from phase 1 — never the editor.
```

## A complete worked example

The 6 files in [`scenarios/`](scenarios/README.md) are worked examples of this exact format, and the
copy-paste template above shows a fully filled-in scenario. Use those as your reference.

## Naming convention

- `id`: kebab-case, stable, describes the behavior under test (`restore-after-death`, not `test1`).
- `name`: a human sentence describing what passing proves.
- One behavior per scenario — keep them small so a failure points at one thing.

## Good vs. weak expected results

- ✅ "Score HUD shows the same value as before the restore (e.g. 1500)."
- ✅ "Game loads directly into the checkpoint, not the main menu."
- ❌ "The Ludeo works." / "Everything looks fine." — not observable, can't be judged consistently.

## How phase 2 uses it

Game-specific scenarios run **alongside** the bundled suite, with the same rules:

1. The agent discovers your scenarios in `qa/ludeo-scenarios/` (or wherever your team keeps them).
2. It runs the steps against the **phase-1 packaged build** — executing them if it can drive the game,
   otherwise walking the human through each step.
3. It judges against **Pass criteria** only — not its own opinion of "looks fine".
4. It records each result in `.ludeo/cloud-upload.json` →
   `gates.scenario.suite[<id>] = { result, evidence }`. The gate passes only if **all** scenarios —
   bundled and game-specific — pass.

## Maintenance

- Update `last-updated` whenever steps or expected results change, and re-run the scenario.
- If the game changes such that a scenario can no longer pass, fix the scenario in the **same** PR — a
  stale scenario that always fails is as bad as none.
- Keep scenarios free of secrets and real account credentials (use a dedicated test account).
