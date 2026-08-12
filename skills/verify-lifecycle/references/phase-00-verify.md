# Phase 0 — Verify the SDK lifecycle from a game run log

## 1. Goal / Purpose

Produce a deterministic PASS/WARN/FAIL verdict on a Ludeo SDK integration by running the game
normally and checking its log with `tools/ludeo_verify.js`. Output: a report the studio can act on
(every FAIL has a fix hint) and, on PASS, confidence that the lifecycle is wired correctly.

## 2. Inputs (Input Contract)

- A build of the game with the Ludeo SDK integrated (any engine).
- Scenario choice: `creator` (default — play and create a ludeo) or `player` (play a ludeo).
- Network access to the real Ludeo backend (the run is live; no mocks).
- Node ≥ 18 to run the CLI (or a browser for `tools/LudeoVerify.html`).

## 3. Steps

1. Print the engine recipe and have the user (or a script) run the game accordingly:
   `node tools/ludeo_verify.js instructions --engine <unreal|unity|native> --scenario <creator|player>`
   - **Unreal** (non-Shipping build): `MyGame.exe -LudeoLogLevelSettings="All:Verbose" -LudeoCommandList="backendlogs-enabled=0"` → log at `<Project>\Saved\Logs\<Project>.log`. Player scenario: append `,activation-ludeoid=<LUDEO_ID>` to the command list.
   - **Unity**: LudeoSettings → **Ludeo Log Level = Verbose** (default `Error` hides everything); commands go in `Assets/StreamingAssets/LudeoSDK/RunCommands.json` → log at `%USERPROFILE%\AppData\LocalLow\<Company>\<Product>\Player.log`. See the Unity log-reading guide in `ludeo-unity-integration` (`references/ludeo-integration-docs/unity/READING-UNITY-LOGS.md`) for per-OS paths.
   - **Native C++**: enable file logging via `LudeoInitializeParams.loggingToFileParams` (captures the version banner) + `ludeo_SetLoggingLevel(All, Verbose)` → `LudeoSDK.log`; a custom `LudeoLogCallback` routed through the game's own logger also works (the checker reads `[Ludeo]`-prefixed lines).
2. Play ~60 seconds; creator: create a ludeo; player: press Play on the ludeo prompt and finish
   the run. Quit through the game's own quit path (clean shutdown is asserted).
3. `node tools/ludeo_verify.js check <logfile> --scenario <creator|player>` (add `--json` for
   machine-readable output).
4. Walk the report top-to-bottom; fix FAILs in the game code, re-run from step 1 until PASS.

## 4. Questions to ask the human

- Which scenario matters right now — creating ludeos (creator) or playing them (player)? Default: creator.
- Can they quit the game via its own menu/quit path? (Task-kill invalidates the shutdown checks.)
- For player scenario without a portal click: do they have a `LUDEO_ID` to force via `activation-ludeoid`?

## 5. Patterns to apply

- Exit code discipline: `0` pass, `1` fail, `2` unusable input (wrong file or verbosity off — the
  fix is the run recipe, not the integration).
- `Canceled` results after `Starting shutdown` are expected quit-in-flight behavior (reported as
  WARN); `Canceled` before shutdown is a real ordering bug.
- Teardown order is the most common failure: End → wait for callback → RemovePlayer → Room_Close
  → wait → Session_Release → wait → Shutdown, pumping `ludeo_Tick` between each. Calling
  Room APIs after `Session_Release` yields `InvalidParameters` ("interface handle is invalid").
- Custom game loggers are often not thread-safe — torn/out-of-order lines are an integration
  smell worth reporting, though the checker tolerates them.

## 6. Output Contract

- The report (text or `--json`) with per-check status, offending line numbers, and hints.
- On FAIL: the list of findings handed to the user or the owning engine skill.
- Never claim "verified" without exit code 0 from a real run's log.

## 7. ✅ Success Criteria

- `check` exits 0 on a log from a real, complete game run of the chosen scenario.
- No unexplained ERR/FTL lines; no leaked handles; clean shutdown present.
- If the log had a `secrets` warning, the user was told to redact before sharing.

## 8. Common Mistakes

- Running at default verbosity (Unity default is `Error`) → exit 2, nothing to check.
- Task-killing the game and then "fixing" the resulting shutdown FAILs in code.
- Treating backend 5xx noise as an integration bug — re-run when the backend is healthy.
- Enabling file logging after `ludeo_Initialize` → the version banner is missing and the `banner`
  check fails; prefer `LudeoInitializeParams.loggingToFileParams`.
- Pasting an unredacted log (websocket URLs carry auth tokens) into a ticket.
