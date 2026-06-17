# Phase 06 — Verification & cloud

Validate the release build and upload it to the Ludeo platform.

Gates 1–4 — compile → verify → validate-build → upload — **are the [`cloud-upload`](../../cloud-upload/)
skill**. This phase runs that skill (installing it first if it isn't present) and adds the Unity
specifics plus the final cloud-run check. Do not advance past a failed gate.

## 1. Goal / Purpose

Validate the release build and upload it to the Ludeo platform. The concrete deliverable is a
**`buildId`** for a build that passed local verification, `validate-build`, CLI upload, platform
processing to **ready**, and a **cloud playtest session** confirming the game runs on Ludeo infrastructure.

## 2. Inputs (Input Contract)

Required artifacts from prior phases:

- [ ] Phases 0–5 complete — SDK wired, lifecycle/actions/state/player-flow implemented
      (`.ludeo/integration.json` prerequisites met)
- [ ] Ludeo SDK integrated. If not, stop — resume an earlier integration phase
- [ ] `.ludeo/cloud-upload.json` initialized (see [`cloud-upload/SKILL.md`](../../cloud-upload/SKILL.md))
- [ ] Release/shipping build configuration and output path known (or captured in step 1)
- [ ] **Game ID** + **Access Token** from [Studio Labs](https://studio.ludeo.com) → Environments
- [ ] CLI installed: `npm install -g @ludeo/cli`
- [ ] Test account + network for verification scenarios
- [ ] Access token via env var / `ludeo auth set-token` — **never** in git or `ludeo.json`

## 3. Steps

### Map / plan

1. Read `.ludeo/integration.json` — confirm phases 0–5 are done.
2. Read `.ludeo/cloud-upload.json` — resume at the first incomplete gate; re-run any gate whose build
   artifact changed since it last passed.
3. Confirm `build-creation-type` (`new` / `sdkFree` / `modification`) and which verification scenarios
   apply (`new` → full suite; `sdkFree` → `s01` only).

### Run the `cloud-upload` skill — gates 1–4

The compile → verify → validate-build → upload pipeline **is** the `cloud-upload` skill. Run that skill
instead of re-typing its commands here — it owns gates 1–4 and records them in `.ludeo/cloud-upload.json`.

1. **Make sure `cloud-upload` is installed.** If it isn't, install it first:
   ```bash
   npx skills add ludeo-labs/integration-skills/skills/cloud-upload
   ```
2. **Invoke the skill** and let it walk gates 1–4 in order, feeding it the Unity specifics below. Stop
   at the first gate it fails — do not move on to the cloud-run step until gate 4 reaches
   `artifacts-created`.

Unity specifics to hand the skill, gate by gate:

- **Gate 1 — compile:** build in release config via batchmode
  `-quit -batchmode -buildTarget <platform> -executeMethod <YourBuildMethod>` (not Development); confirm
  the Ludeo SDK survives IL2CPP / managed-code stripping (unless `sdkFree`).
- **Gate 2 — scenarios:** run applicable scenarios against the **packaged release build** (not the
  editor), adapted from this game's integration code (`new` → full suite, `sdkFree` → `s01` only).
- **Gate 3 — build folder:** exec-path is `<Game>.exe`; expect `<Game>_Data/` and `UnityPlayer.dll`.
  (cloud-upload delegates this to the `validate-build` skill.)
- **Gate 4 — upload:** `--exec-path` is the `<Game>.exe` at the build root; `--build-creation-type`
  matches the compile gate; dry-run before the real upload; let the poll reach `artifacts-created`
  before continuing. Capture the returned `buildId`.

### Implement — Ludeo run in cloud

Confirm the uploaded build actually runs on Ludeo cloud infrastructure — not just that files uploaded.

1. *(Recommended)* Assign the build to the target environment:
   ```bash
   ludeo builds assign --game-id YOUR_GAME_ID --build-id BUILD_ID --env-id ENV_ID
   ```
2. Open **Studio Labs** → the assigned environment → start a **cloud test session** for this build.
3. Confirm the cloud session reports a live game instance / stream (game launches, reaches playable
   state). Capture session evidence (screenshot, session URL, or human confirmation).
4. Record cloud-run result in `.ludeo/cloud-upload.json` → `gates.cloudRun = "pass"`.
5. Mark integration complete: `.ludeo/integration.json` → `currentPhase: 6`.

> There is no `ludeo run` CLI subcommand today — cloud verification happens through Studio Labs after
> upload. Check `ludeo --help` before claiming a different command exists.

## 4. Questions to ask the human

- Which Unity build method / `-buildTarget` produces the release package, and where does output land?
- `new`, `sdkFree`, or `modification`? Versions (`--game-version`, `--sdk-version`)?
- Game ID, token source (local vs CI), and target `--env-id` for cloud run?
- Can the agent drive the local packaged build for scenarios, or walk through manual steps?
- Who confirms the Studio Labs cloud session — agent or human?

## 5. Patterns to apply

- **Ordered, blocking gates** — verification before validate-build before upload before cloud run.
- **Test the packaged release build**, not the editor.
- **Adapt scenarios from actual integration code** — unresolved placeholders didn't test this game.
- **Dry-run before real upload** — catches wrong paths before bytes move.
- **Token hygiene** — never in `ludeo.json`, logs, or git.
- **Local pass ≠ cloud pass** — validate-build proves the folder; cloud run proves Ludeo infrastructure.

## 6. Output Contract

| Artifact | Content |
| --- | --- |
| Release build | Clean package at a known path |
| `.ludeo/cloud-upload.json` | All gates `pass` including `cloudRun`; `buildId` captured |
| `.ludeo/integration.json` | `currentPhase: 6` |
| Ludeo cloud | Build at `artifacts-created` / ready; cloud session confirmed |

```json
{
  "gates": {
    "compile": "pass",
    "scenario": { "result": "pass", "suite": {} },
    "buildFolder": "pass",
    "upload": "pass",
    "cloudRun": "pass"
  },
  "buildId": "<uuid>"
}
```

## 7. ✅ Success Criteria

The agent MUST satisfy **all** of these before marking phase 6 complete:

- [ ] Pass all verification tests
- [ ] validate-build passes
- [ ] Build uploaded via the Ludeo CLI
- [ ] Platform status polled to ready
- [ ] Ludeo run in cloud
- [ ] Access token never printed, logged, or committed
- [ ] `.ludeo/integration.json` updated — phase 6 complete

## 8. Common Mistakes

- Running verification in the **editor** or against a **stale** build.
- Skipping scenario adaptation — generic steps that don't match this game's integration.
- Treating validate-build pass as sufficient — cloud run catches platform-specific failures.
- Ctrl-C'ing the upload poll before **ready** / `artifacts-created`.
- Assuming upload success means the game **plays** in cloud without a Studio Labs session.
- Wrong `--exec-path` or uploading a parent folder instead of the build root.
- Putting the access token in `ludeo.json` or committing it.
