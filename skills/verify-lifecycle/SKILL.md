---
name: ludeo-verify-lifecycle
description: Verify a Ludeo SDK integration by running the game normally and checking its log against the SDK lifecycle contract. Use when the user asks to verify or test an integration, test the SDK lifecycle, check a run log, or asks "did my integration work" — for Unity, Unreal, or native C++ games alike. Produces a deterministic PASS/WARN/FAIL report with a fix hint per finding. Do NOT use for performing the integration itself (use ludeo-unreal-integration or ludeo-unity-integration), uploading builds (use cloud-upload), or diagnosing cloud cast session/VM logs (use ludeo-diagnose-session).
metadata.version: 0.1.0
---

# Ludeo SDK Lifecycle Verification

**Skill version:** 0.1.0 · Compare against the [latest release](https://github.com/ludeo-labs/integration-skills/releases/latest) to confirm your installed copy is current. If older, run `npx skills update ludeo-labs/integration-skills/skills/verify-lifecycle` (then start a fresh agent session — `SKILL.md` is cached per session).

## Overview

The SDK deliberately exposes no API to query lifecycle state — its log is the observable surface,
and the log format is contractual (the Ludeo backend parses it). This skill turns that into a
deterministic integration test: the game runs **normally against the real backend**, then
`tools/ludeo_verify.js` checks the log for correct lifecycle order
(Activate → OpenRoom → AddPlayer → RoomReady → Begin → End → Close → clean shutdown) plus
integration-quality checks: unfinished async calls, failed API calls, callbacks that never
returned, missing notification handlers, SDK errors, leaked handles, tick-threading problems,
and credentials leaked into the log. Determinism comes from order/result assertions on the SDK's
machine-parseable markers — never from timing.

Engine-agnostic: the checker auto-detects all four log containers — native `LudeoSDK.log`,
Unreal output log, Unity `Player.log`, and custom game loggers that prefix SDK lines with
`[Ludeo]`.

## When to use

- "Verify my Ludeo integration" / "test the SDK lifecycle"
- "Did my integration work?" / "check this run log"
- As the runtime-verification gate at the end of an engine integration
  (`ludeo-unreal-integration` Step 7a, `ludeo-unity-integration` compile-and-fix phase)

Not for: doing the integration, uploading builds (`cloud-upload`), or cloud cast/VM session
diagnosis (`ludeo-diagnose-session`).

## Workflow

Single phase — see `references/phase-00-verify.md` for the full run recipes and report
interpretation.

1. **Produce a log.** Print the per-engine recipe and walk the user through the run:

   ```bash
   node tools/ludeo_verify.js instructions --engine unreal|unity|native --scenario creator|player
   ```

   Essentials: force Verbose logging, play ~60 seconds, create a ludeo (creator scenario) or play
   one (player scenario), quit through the game's own quit path — never task-kill.

2. **Check it.**

   ```bash
   node tools/ludeo_verify.js check <logfile> [--scenario creator|player] [--json]
   ```

   Exit codes: `0` pass (warnings allowed) · `1` at least one FAIL · `2` unusable input
   (not a Ludeo log or verbosity off — re-run step 1). Use `--json` when you need to act on
   findings programmatically.

3. **Interpret and fix.** Every FAIL row carries a fix hint. Fix in the game (or hand the finding
   to the owning engine skill), re-run, repeat until PASS. Warnings are report-worthy but don't
   block.

Non-technical users can skip the CLI entirely: `tools/LudeoVerify.html` is a zero-install
drag-drop page (keep it next to `ludeo_verify.js`).

## Ground rules

- The game runs against the real backend. Backend outages (HTTP 5xx in the log) make the run
  non-conformant — re-run rather than explain away.
- Never paste raw logs into reports or issues without checking the `secrets` finding: SDK logs can
  contain auth tokens in websocket URLs.
- Do not claim an integration verified without a PASS from an actual game run
  (no synthetic/hand-edited logs).
- The marker strings are contractual but owned by the SDK repo — if the checker suddenly reports
  `unusable` on a healthy new SDK version, suspect marker drift and check the tool's README before
  blaming the integration.

## Tools

| File | Purpose |
| --- | --- |
| `tools/ludeo_verify.js` | Checker + Node CLI (zero dependencies, Node ≥ 18) |
| `tools/LudeoVerify.html` | Drag-drop report page for humans (loads `ludeo_verify.js` from the same folder) |
| `tools/ludeo_verify.test.js` | Self-test: `npm test` from the repo root, or `node --test` inside `tools/` |
| `tools/fixtures/` | Scrubbed real-world log fixture used by the self-test |
