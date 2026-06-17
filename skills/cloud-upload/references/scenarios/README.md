# Bundled Ludeo verification suite

These are the **standard test scenarios the skill ships with**. Phase 2
([`../phase-02-verify-test-scenario.md`](../phase-02-verify-test-scenario.md)) runs **every** scenario
in this folder against the build before it can be uploaded. They are written generically — they
describe what *any* Ludeo-integrated game must do — and the agent **adapts each one to the game under
test** by reading that game's integration code.

## How the agent runs the suite against a specific game

For each scenario file, in order:

1. **Resolve the placeholders from the game code.** Every scenario has a `## Game-specific adaptation`
   note listing what to look up — the capture trigger, the restore entry point, the state fields that
   define a "moment", the `DataWriter`/`DataReader` keys, etc. Read the game's Ludeo integration to
   fill these in. This is the step that makes a generic scenario test *this* game.
2. **Run the steps** against the **phase-1 packaged build** (never the editor) — executing them if the
   agent can drive the game, otherwise walking a human through them.
3. **Judge against the scenario's `## Pass criteria` only.**
4. **Record** the result per scenario in `.ludeo/cloud-upload.json` →
   `gates.scenario.suite[<id>] = { result, evidence }`.

The gate **passes only if every applicable scenario passes**. A failure stops the pipeline — do not
validate the folder or upload.

## Applicability

- **`new` builds** (SDK present): run the whole suite.
- **`sdkFree` builds** (no SDK): the game never captures or restores Ludeos, so only `s01` (launch &
  stability) applies — skip `s02`–`s06` and note in state that they were skipped because `sdkFree`.

## The suite

| # | Scenario | What it proves |
| - | -------- | -------------- |
| s01 | [Build launch & stability](s01-build-launch-smoke.md) | The packaged build runs and reaches a playable state |
| s02 | [Capture (Creator flow)](s02-capture-creator-flow.md) | Capturing a moment produces a valid Ludeo |
| s03 | [Restore (Player flow)](s03-restore-player-flow.md) | Restoring a Ludeo snapshot-restores into the captured moment |
| s04 | [Data round-trip](s04-data-round-trip.md) | `DataWriter` values come back through `DataReader` on restore |
| s05 | [Cold-start restore & replay](s05-cold-start-restore-replay.md) | Restore works from a fresh process and stays playable |
| s06 | [Graceful failure](s06-graceful-failure-invalid-ludeo.md) | An invalid/expired Ludeo fails cleanly, no crash |

Teams can add **game-specific** scenarios on top of this suite — see
[`../authoring-test-scenarios.md`](../authoring-test-scenarios.md).
