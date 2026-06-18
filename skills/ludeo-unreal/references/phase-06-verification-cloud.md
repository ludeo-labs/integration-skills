# Phase 06 — Verification & cloud

Validate the release build and upload it to the Ludeo platform.

Gates 1–4 — compile → verify → validate-build → upload — **are the `cloud-upload` skill**
(`ludeo-labs/integration-skills/skills/cloud-upload`). This phase runs that skill (installing it first if
it isn't present) and adds the Unreal specifics plus the final cloud-run check. Do not advance past a
failed gate.

> **Stub note (current):** `cloud-upload` is referenced, not hard-wired. If it is not installed/available,
> record what you can and surface the gap — do not block the integration on it. The boundary (what the
> integration skill produces vs. what `cloud-upload` owns) is still being finalized with that skill's owner.

## 1. Goal / Purpose

Validate the release build and upload it to the Ludeo platform. The concrete deliverable is a **`buildId`**
for a build that passed local verification, `validate-build`, CLI upload, platform processing to **ready**,
and a **cloud playtest session** confirming the game runs on Ludeo infrastructure. Reaching this phase means
the **curated slice is validated end-to-end in the cloud** — the MVP milestone. It is **not** the end of the
integration: full-game **Expansion is Phase 7** and **Polish is Phase 8**.

## 2. Inputs (Input Contract)

Required artifacts from prior phases:

- [ ] Phases 0–5 complete — SDK wired, lifecycle/actions/state/player-flow implemented
      (`.ludeo/integration.json` prerequisites met)
- [ ] Ludeo SDK integrated. If not, stop — resume an earlier integration phase
- [ ] `.ludeo/cloud-upload.json` initialized (by the `cloud-upload` skill)
- [ ] Shipping build configuration and output path known (or captured in Step 1)
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
   (If it cannot be installed in this environment, record the gap and proceed manually with the gate-by-gate
   notes below — see the Stub note above.)
2. **Invoke the skill** and let it walk gates 1–4 in order, feeding it the Unreal specifics below. Stop at
   the first gate it fails — do not move on to the cloud-run step until gate 4 reaches `artifacts-created`.

Unreal specifics to hand the skill, gate by gate:

- **Gate 1 — compile:** package in **Shipping** via `RunUAT BuildCookRun` / project `Build.bat`; confirm
  the Ludeo plugin is enabled for Shipping and its module is in packaged `Binaries/` (unless `sdkFree`).
- **Gate 2 — scenarios:** run applicable scenarios against the **packaged Shipping build** (not
  PIE/editor), adapted from this game's integration code (`new` → full suite, `sdkFree` → `s01` only).
- **Gate 3 — build folder:** exec-path is `<Game>/Binaries/Win64/<Game>.exe`; expect `Engine/` and
  `<Game>/Content/Paks/*.pak`. (cloud-upload delegates this to the `validate-build` skill.)
- **Gate 4 — upload:** `--exec-path` is the `Binaries/Win64` game binary, **not** the root launcher;
  `--build-creation-type` matches the compile gate; dry-run before the real upload; let the poll reach
  `artifacts-created` before continuing. Capture the returned `buildId`.

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
5. Advance phase: `.ludeo/integration.json` → `currentPhase: 6` (the **curated slice is cloud-validated** —
   the MVP milestone). Do **not** mark the integration complete here — Expansion (Phase 7) and Polish
   (Phase 8) still follow. Final completion is set at the end of Phase 8.

> There is no `ludeo run` CLI subcommand today — cloud verification happens through Studio Labs after
> upload. Check `ludeo --help` before claiming a different command exists.

## 4. Questions to ask the human

- Which Unreal packaging command / platform produces the Shipping build, and where does output land?
- `new`, `sdkFree`, or `modification`? Versions (`--game-version`, `--sdk-version`)?
- Game ID, token source (local vs CI), and target `--env-id` for cloud run?
- Can the agent drive the local packaged build for scenarios, or walk through manual steps?
- Who confirms the Studio Labs cloud session — agent or human?

## 5. Patterns to apply

- **Ordered, blocking gates** — verification before validate-build before upload before cloud run.
- **Test the packaged Shipping build**, not PIE/editor.
- **Adapt scenarios from actual integration code** — unresolved placeholders didn't test this game.
- **Dry-run before real upload** — catches wrong paths before bytes move.
- **Token hygiene** — never in `ludeo.json`, logs, or git.
- **Local pass ≠ cloud pass** — validate-build proves the folder; cloud run proves Ludeo infrastructure.

## 6. Output Contract

| Artifact | Content |
| --- | --- |
| Shipping build | Clean package at a known path |
| `.ludeo/cloud-upload.json` | All gates `pass` including `cloudRun`; `buildId` captured |
| `.ludeo/integration.json` | `currentPhase: 6` (slice cloud-validated; NOT marked complete) |
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
- [ ] `.ludeo/integration.json` updated — `currentPhase: 6` (slice cloud-validated; integration NOT yet complete — Expansion/Polish follow)

## 8. Common Mistakes

- Running verification in **PIE/editor** or against a **stale** build.
- Ludeo plugin enabled in Editor but **excluded from Shipping**.
- Skipping scenario adaptation — generic steps that don't match this game's integration.
- Treating validate-build pass as sufficient — cloud run catches platform-specific failures.
- Ctrl-C'ing the upload poll before **ready** / `artifacts-created`.
- Assuming upload success means the game **plays** in cloud without a Studio Labs session.
- Wrong `--exec-path` (root launcher vs `Binaries/Win64/` game binary).
- Putting the access token in `ludeo.json` or committing it.
- Marking the integration **complete** at Phase 6 — it is the slice-cloud-validated milestone only; Expansion (7) and Polish (8) still follow.
