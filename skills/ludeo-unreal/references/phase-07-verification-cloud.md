# Phase 07 — Verification & cloud

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
integration: full-game **Expansion is Phase 8** and **Polish is Phase 9**.

## 2. Inputs (Input Contract)

Required artifacts from prior phases:

- [ ] Phases 1–6 complete — SDK wired, lifecycle/actions/state/player-flow implemented
      (`.ludeo/integration.json` prerequisites met)
- [ ] Ludeo SDK integrated. If not, stop — resume an earlier integration phase
- [ ] `.ludeo/cloud-upload.json` initialized (by the `cloud-upload` skill)
- [ ] Shipping build configuration and output path known (or captured in Step 1)
- [ ] **Game ID** (already in `sdkSetup.ludeoGameId` — ask only if missing) from [Studio Labs](https://studio.ludeo.com) → **Game Options → Info** (the game **version** uuid — not the backend `gameId`; the Environments page still shows a copy, now being retired)
- [ ] **The environment this build ships to** — each of these, for *that* environment:
      - **Named.** Confirm *which* with the human if more than one is in play, and re-read it with
        `list_game_environments` (if it is in your tool list) rather than trusting `sdkSetup.ludeoEnvironments`.
      - **The integrator is in it.** If that entry's `integratorIsMember` isn't true, ask; if they don't know or
        it's no, have them check or add themselves in Studio Labs → Environments → Users management. That doesn't
        block the upload, but say plainly that their captures there fail silently until it's done.
      - **Anyone else who needs to capture there** is invited, per [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md).
      - **The branch creators run matches.** Ask which Steam beta branch they'll run the shipped build on — you
        can't verify this, so record it as that entry's `steamBranch` — then apply
        **Matching a branch to an environment** in [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md); it decides whether anything is written.
        Not the game version.
      - **The cloud binding is the cloud-run step below.** A cloud run is bound by assignment, not by the Beta
        Version Name: phase 03 §5.3's `ActivateSession` wraps the whole auth block in
        `if (!FParse::Param(…, TEXT("cloud")))`, so `[Ludeo] BetaBranchName` is never read there, and the cloud
        token selects the environment.
- [ ] **Global Triggers created** in Studio Labs → **the environment named above** (triggers are per environment): Pause/Resume on
      `PauseLudeo`/`ResumeLudeo`, Non-Ludeoable Area on `StartNoneLudeable`/`StopNoneLudeable`. Ask the user to
      confirm — without them the pause never stops the objective timer, and the failure is silent (phase 03 §5.9.1)
- [ ] **Explicit auth removed before shipping** — `[Ludeo] SteamAuthID` empty in every `*Game.ini` under `Config/` (they're
      packaged, and platform layers like `Config/Windows/WindowsGame.ini` merge in), and no `-SteamAuthID=` / `STEAM_AUTH_ID` in `run.bat` or the shipped environment. Explicit auth is
      a debugging convenience (phase 03 §3.16); left in, every creator who runs the shipped build through Steam
      authenticates as that one Steam id. The cloud run won't catch it — the `-cloud` path skips auth. A non-Steam game ships without it too: local
      creation for a non-Steam title isn't supported yet, so say so and ask the Ludeo integrations team rather
      than shipping an id
- [ ] CLI installed: `npm install -g @ludeo/cli`
- [ ] Test account + network for verification scenarios
- [ ] Access token via env var / `ludeo auth set-token` — **never** in git or `ludeo.json`

## 3. Steps

### Map / plan

1. Read `.ludeo/integration.json` — confirm phases 1–6 are done.
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
   the first gate it fails — do not move on to the cloud-run step until gate 4 reaches `artifacts-created` and `ludeo builds get` reports `success`.

Unreal specifics to hand the skill, gate by gate:

- **Gate 1 — compile:** package in **Shipping** via `RunUAT BuildCookRun` / project `Build.bat`; confirm
  the Ludeo plugin is enabled for Shipping and its module is in packaged `Binaries/` (unless `sdkFree`).
- **Gate 2 — scenarios:** run applicable scenarios against the **packaged Shipping build** (not
  PIE/editor), adapted from this game's integration code (`new` → full suite, `sdkFree` → `s01` only).
  The ship gate has already taken `SteamAuthID` out of the ini, so these local runs go implicit: with no Steam
  client they fail, and with one they reach whatever environment that branch routes to. Pass `-SteamAuthID=<id>
  -LudeoBetaBranch=<debug environment's name>` on the command line for them (never in `run.bat`).
- **Gate 3 — build folder:** exec-path is the root `run.bat` that `tools/BuildAndPackage.bat` emits (from
  `tools/run.bat.template`); expect it, `Engine/`, `<Game>/Content/Paks/*.pak`, and the Shipping exe under
  `<Game>/Binaries/Win64/`. Check that `run.bat` contains `-cloud` — a `run.bat` generated any other way may not.
  (cloud-upload delegates this to the `validate-build` skill.)
- **Gate 4 — upload:** `--exec-path` is the root `run.bat`, **never** the bare game exe — only `run.bat` passes `-cloud`, and
  without it the auth block runs on a machine with no Steam and activation fails;
  `--build-creation-type` matches the compile gate; dry-run before the real upload; let the poll reach
  `artifacts-created`, then poll `ludeo builds get` until it reports `success` — assigning needs that.
  Capture the returned `buildId`.

### Implement — Ludeo run in cloud

Confirm the uploaded build actually runs on Ludeo cloud infrastructure — not just that files uploaded.

1. Assign the build to the environment named at the Input Contract gate. Only a build that `ludeo builds get` reports as `success`
   can be assigned (it follows the upload poll's `artifacts-created`), and assigning changes what that environment serves — it may replace the build there now —
   so treat it like the upload: show `environment · BUILD_ID` and the exact resolved command, then wait for an
   explicit go-ahead. One confirmed assign per environment. `ENV_ID` is that environment's `envId` from the
   gate's fresh read (no tool → ask the human; Studio Labs → the environment):
   ```bash
   ludeo builds assign --game-id YOUR_GAME_ID --build-id BUILD_ID --env-id ENV_ID
   ```
2. Open **Studio Labs** → the assigned environment → start a **cloud test session** for this build.
3. Confirm the cloud session reports a live game instance / stream (game launches, reaches playable
   state). Capture session evidence (screenshot, session URL, or human confirmation).
4. Record cloud-run result in `.ludeo/cloud-upload.json` → `gates.cloudRun = "pass"`.
5. Advance phase: `.ludeo/integration.json` → `currentPhase: 6` (the **curated slice is cloud-validated** —
   the MVP milestone). Do **not** mark the integration complete here — Expansion (Phase 8) and Polish
   (Phase 9) still follow. Final completion is set at the end of Phase 9.

> There is no `ludeo run` CLI subcommand today — cloud verification happens through Studio Labs after
> upload. Check `ludeo --help` before claiming a different command exists.

## 4. Questions to ask the human

- Which Unreal packaging command / platform produces the Shipping build, and where does output land?
- `new`, `sdkFree`, or `modification`? Versions (`--game-version`, `--sdk-version`)?
- Game ID and token source (local vs CI)? The cloud run's `--env-id` is the environment named at the Input Contract gate.
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
| Ludeo cloud | Build at `success`, assigned to the gate's environment; cloud session confirmed |

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

The agent MUST satisfy **all** of these before marking phase 7 complete:

- [ ] Pass all verification tests
- [ ] validate-build passes
- [ ] Build uploaded via the Ludeo CLI
- [ ] Platform status polled to `success`
- [ ] Build assigned to the environment named at the Input Contract gate, after an explicit go-ahead
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
- Wrong `--exec-path` — the bare `Binaries/Win64/` exe instead of the root `run.bat`; without `-cloud`,
  activation fails on the cloud.
- Putting the access token in `ludeo.json` or committing it.
- Marking the integration **complete** at Phase 7 — it is the slice-cloud-validated milestone only; Expansion (7) and Polish (8) still follow.
