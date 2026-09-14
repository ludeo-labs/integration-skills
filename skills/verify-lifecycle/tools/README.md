# Ludeo SDK Integration Verifier

Deterministic lifecycle tests for studios integrating the Ludeo SDK: **run your game normally,
then check the log**. The verifier reads the core SDK's log (identical content across Unity,
Unreal, and native C++ engines) and asserts the lifecycle ran correctly, in order, and shut
down cleanly — plus a set of integration-quality checks (unfinished async calls, missing
notification handlers, SDK errors, leaked handles, credentials in the log).

No game-code changes are required. The game runs against the real backend; determinism comes
from order/result assertions on the SDK's machine-parseable log markers, never from timing.

## For studios (zero install)

1. Open **`LudeoVerify.html`** in any browser (double-click — keep it next to `ludeo_verify.js`).
2. Pick your scenario (**Creator** = play and create a ludeo; **Player** = play a ludeo) and
   follow the per-engine instructions shown on the page (they boil down to: force Verbose
   logging, play ~60 seconds, quit through the game's own quit path).
3. Drag the log file in. You get a PASS/FAIL report with a fix hint on every failing check.

Log locations: Unreal `<Project>\Saved\Logs\<Project>.log` · Unity
`%USERPROFILE%\AppData\LocalLow\<Company>\<Product>\Player.log` · native `LudeoSDK.log`.

## For CI / agents (Node ≥ 18, no npm dependencies)

```
node ludeo_verify.js instructions [--engine unity|unreal|native] [--scenario creator|player]
node ludeo_verify.js check <logfile> [--scenario creator|player] [--json]
```

Exit codes: `0` pass (warnings allowed) · `1` at least one FAIL · `2` unusable input
(not a Ludeo log / verbosity off). `--json` prints a machine-readable report
(`{result, sdk_version, checks: [{id, status, detail, hint}], ...}`).

## What gets checked

Shared checks (both scenarios): version banner, usable verbosity, every async call reached a
terminal succeeded/failed, no failed API calls, all game callbacks returned, notification-handler
audit, SDK error scan (Coherent overlay noise excluded), clean shutdown, leaked handles,
ludeo_Tick threading, credentials-in-log warning.

Scenario steps (ordered): Activate → \[player: LudeoSelected → GetLudeo\] → OpenRoom →
AddPlayer → RoomReady delivered → GameplaySession Begin → \[creator: data written\] →
End → \[creator: Room Close\].

## Development

```
cd skills/verify-lifecycle/tools
node --test
```

Or from the repo root, which is also what CI runs: `npm test`.

Tests live in `ludeo_verify.test.js` (Node's built-in test runner). Unreal/Unity variants are
covered by re-wrapping a synthesized native log into each engine's container format; failure
cases are in-memory mutations of the pass fixture.

### Marker contract

The log format is contractual — the Ludeo backend parses it, and
`LudeoSDK/Source/Infra/Ludeo/Infra/Misc/Logging.h` forbids changing it. Container-format
regexes are copied from `LudeoSDK/Tool/LudeoSDKLogFilter.html`; lifecycle marker strings were
verified against SDK v4.2.3 sources (`TaskManager.h`, `CallChecks.h`, `Notifications.h`,
`SessionImpl.h/.cpp`, `Init.cpp`, `InterfaceManager.cpp`). If a marker ever changes in the SDK,
update `MARKER` in `ludeo_verify.js` and the fixtures.

### Fixtures

- `fixtures/unity_creator_real.log.txt` — a **real** (scrubbed) Unity creator run with known
  findings (GameplaySession_End never called, leaked Room handle, backend 503s,
  SnapshotRequest handler missing). The test suite asserts these exact verdicts as a regression
  test on real-world data. (`.log.txt` because the repo gitignores `*.log`.)

  **This repo is public, so scrubbing covers identity as well as credentials.** Replaced with
  `REDACTED`: websocket `token=` values, Steam ids, hashed user ids, the game's name and
  executable path, and its Steam beta-branch name. Replaced with stable synthetic UUIDs (which
  keeps every line's real shape) : `gameId`/`game_id`, `ludeoId`, `userId`, `connectionId`/
  `principal_id`, and the reporting `device.id`.

  Scrub **by value, not by field name** — the same game id appears as `game_id=`, `gameId=`,
  `"gameId":`, and URL-encoded inside `connectionDetailsJSON`, so a field-name pass misses
  copies. Left intact on purpose: per-run ephemera (`gameplayId`, `roomId`, `highlightId`,
  `gamesessionId`, `requestId`, `correlation_id`, `socket_id`) and the reporting machine's
  hardware/OS strings — meaningless outside the run, and several checks read those lines.
- `fixtures/native_creator_pass.log.txt` — TODO, not generated yet (its test auto-skips). To generate:
  run the headless creator flow from the SDK repo
  (`Source/IntegrationTests/Source/DataReaderTests/CreateLudeoForTestApplication`) against staging
  with file logging enabled at Verbose — note the prebuilt test exe does not write a log file, so
  this needs a small run harness or the follow-up `LUDEO_LOG_TO_FILE` env var in the core SDK.
  Scrub it the same way as the fixture above — credentials **and** identifying data — before
  committing, and keep the `.log.txt` suffix or `.gitignore` will silently refuse the file.

## Home

Canonical home: `integration-skills/skills/verify-lifecycle/tools/` — shipped as part of the
`ludeo-verify-lifecycle` skill. See the skill's `SKILL.md` for the agent workflow.
