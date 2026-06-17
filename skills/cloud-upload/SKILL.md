---
name: cloud-upload
description: Ship a finished, integrated game build to the Ludeo cloud with the @ludeo/cli tool. Walks four gates — compile + Ludeo-SDK check, a named QA test scenario, build-folder validation, then authenticate and upload via the CLI and poll until the build finishes processing. Trigger when the user wants to upload/ship/publish a packaged build to Ludeo — e.g. "upload my build to Ludeo", "publish the build", "ship to Ludeo cloud", "ludeo builds upload". NOT for writing SDK integration code — use the engine integration skill for that.
metadata:
  version: 0.1.0
---

# cloud-upload

## Overview

This skill takes a **finished, already-integrated** game build and ships it to the Ludeo cloud. It is
the last mile after engine integration: it gates the build through four checks — compile + SDK
presence, a named QA test scenario, build-folder validation — and only then authenticates and uploads
with the official `@ludeo/cli` tool, polling until the platform finishes processing the build
(`artifacts-created`). The outcome is a uploaded, processed build that can be assigned to a Ludeo
environment.

## When to use

- "Upload / ship / publish my build to Ludeo"
- "Run `ludeo builds upload`" / "push this build to the Ludeo cloud"
- "I packaged the game, get it onto Ludeo"

If the project is **not yet integrated** with the Ludeo SDK (no plugin/package wired in), stop and
point the user at the engine integration skill — see [`AGENTS.md`](../../AGENTS.md) for engine
detection. This skill ships a build; it does not write integration code.

## Ground rules

- **Never invent SDK or CLI behavior.** This skill is pinned to the real `@ludeo/cli` commands
  documented in [`references/phase-04-upload-ludeo-cli.md`](references/phase-04-upload-ludeo-cli.md).
  If a command, flag, or status value isn't covered there or in the CLI's `--help`, check
  `ludeo <cmd> --help` / the `sdk-docs` MCP server before claiming it — don't guess.
- **The gates are ordered and blocking.** Don't validate a folder that didn't compile, and don't
  upload a build whose QA scenario failed. A failed gate stops the pipeline.
- **Never print, log, or commit the access token.** Get the Game ID + Access Token from
  [Studio Labs](https://studio.ludeo.com) → Environments, supply it via `ludeo auth set-token` or a CI
  secret/env var, and keep it out of `ludeo.json` and out of git. The repo's secret-scan + `.gitignore`
  back this up — see [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
- **Learnings are append-only and sanitized** — no game names, tokens, or proprietary paths. Follow
  [`shared/learnings-policy/learning-sanitization.md`](../../shared/learnings-policy/learning-sanitization.md).

## Workflow

Walk the phases in order. Each has a reference file under `references/`; read it before acting. Do not
advance past a failed gate.

| Phase | Gate | Reference |
| --- | --- | --- |
| 1 — Compile test | Build in ship config; confirm the Ludeo SDK is compiled in (or `sdkFree` is intentional) | [`references/phase-01-compile-test.md`](references/phase-01-compile-test.md) |
| 2 — Verify test scenarios | Run the **bundled Ludeo verification suite** (adapted to the game's code) against the built game; all must pass | [`references/phase-02-verify-test-scenario.md`](references/phase-02-verify-test-scenario.md) |
| 3 — Validate build folder | Confirm the build folder is complete, self-contained, and actually launches | [`references/phase-03-validate-build-folder.md`](references/phase-03-validate-build-folder.md) |
| 4 — Upload via Ludeo CLI | Authenticate, dry-run, `ludeo builds upload`, poll to `artifacts-created`; optionally assign to an env | [`references/phase-04-upload-ludeo-cli.md`](references/phase-04-upload-ludeo-cli.md) |

## State & resume

Pipeline state lives in the user's project at `.ludeo/cloud-upload.json` (the `.ludeo/` directory is
git-ignored). Record each gate's result and the captured upload inputs:

```json
{
  "currentPhase": 1,
  "gates": {
    "compile": null,
    "scenario": { "result": null, "suite": {} },
    "buildFolder": null,
    "upload": null
  },
  "build": { "localDirectory": null, "execPath": null, "gameVersion": null, "sdkVersion": null, "buildType": null },
  "buildId": null
}
```

On each session, read this file, resume at the first gate that hasn't passed, and re-run a gate if the
build changed underneath it (a passed gate on a stale build is not a pass). Do one gate per session
unless the user asks to run the whole pipeline.
