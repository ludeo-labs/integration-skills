# Phase 04 — Upload via the Ludeo CLI

Final gate. Authenticate, dry-run, then `ludeo builds upload` the validated build and let the CLI poll
until the platform finishes processing it. All commands below are the real `@ludeo/cli` — confirm
against `ludeo <cmd> --help` if a flag looks off; don't invent flags.

## 1. Goal / Purpose
Get the phase-3 build onto the Ludeo cloud with the official CLI and confirm the platform processes it
all the way to **`artifacts-created`** (the build is **not playable** until then). Optionally assign
the processed build to a Ludeo environment.

## 2. Inputs (Input Contract)
- [ ] Phases 1–3 passed (`.ludeo/cloud-upload.json` gates all `pass`)
- [ ] CLI installed: `npm install -g @ludeo/cli`, then `ludeo version` works
- [ ] **Game ID** and **Access Token** from [Studio Labs](https://studio.ludeo.com) → Environments
- [ ] From earlier phases: `--local-directory` (build root), `--exec-path` (relative exe),
      `--game-version`, and `--sdk-version` (unless `sdkFree`)
- [ ] Decision: `new` vs `sdkFree` vs `modification`; `--build-type major` vs `minor`

## 3. Steps
1. **Install / verify** the CLI:
   ```bash
   npm install -g @ludeo/cli
   ludeo version
   ```
2. **Authenticate** (never echo, log, or commit the token — pull it from an env var / CI secret):
   ```bash
   ludeo auth set-token --access-token YOUR_ACCESS_TOKEN
   ludeo auth status     # confirm a token is saved
   ```
3. *(Optional)* Persist repeatable defaults so you don't repeat flags — **do not** put the token here:
   ```bash
   ludeo config init     # scaffolds ./ludeo.json
   ```
   `ludeo.json` fields: `game_id`, `exec_path`, `local_directory`, `build_type`, `sdk_version`,
   `skip_file_registration`. Flag values override `ludeo.json`, which overrides global defaults.
4. **Dry-run first** — validates params + directory structure and shows the file count/size without
   creating anything:
   ```bash
   ludeo builds upload --dry-run \
     --game-id YOUR_GAME_ID \
     --exec-path game.exe \
     --local-directory ./builds \
     --build-type major \
     --game-version "1.2.3" \
     --sdk-version "2.0.0"
   ```
5. **Upload** the real build. Pick the creation type to match phase 1:
   - **New build** (default — full build with the SDK):
     ```bash
     ludeo builds upload \
       --game-id YOUR_GAME_ID \
       --exec-path game.exe \
       --local-directory ./builds \
       --build-creation-type new \
       --build-type major \
       --game-version "1.2.3" \
       --sdk-version "2.0.0" \
       --changes-description "What changed"
     ```
   - **SDK-free build** (perf testing, no SDK): `--build-creation-type sdkFree` and omit `--sdk-version`.
   - **Modification build** (overlay changed files onto an existing base build): use the dedicated
     command — `ludeo builds modification --game-id ... --base-build-id ... --local-directory ./Windows
     --build-type minor --major-build-id ...`. The `--local-directory` holds **only changed files**, and
     its **folder name must match the base build's root folder** (the CLI stops if it doesn't).
   - In CI / non-TTY, add `--no-interactive` and supply every required flag.
6. **Let it poll.** After upload the CLI automatically tracks processing
   (`verifying → distributing → building artifacts`) every `--interval` seconds (default 30) until
   `artifacts-created` or a terminal failure. Don't Ctrl-C it expecting it's done — the build isn't
   playable until `artifacts-created`. If interrupted, processing continues on the platform; re-check
   later (step 7).
7. **Re-check / confirm status** of an existing build later:
   ```bash
   ludeo builds get    --game-id YOUR_GAME_ID --build-id BUILD_ID
   ludeo builds status --game-id YOUR_GAME_ID --build-id BUILD_ID --poll   # exits 0 on ready/success/complete, 1 otherwise
   ludeo builds list   --game-id YOUR_GAME_ID --verbose
   ```
8. *(Optional)* **Assign** the processed build to an environment:
   ```bash
   ludeo builds assign --game-id YOUR_GAME_ID --build-id BUILD_ID --env-id ENV_ID
   # or run without --build-id/--env-id in a terminal to pick from lists
   ```
9. Record `buildId`, status, and (if assigned) the env in `.ludeo/cloud-upload.json` → `gates.upload`.

## 4. Questions to ask the human
- Game ID, and where does the access token come from (local `auth set-token` vs CI secret/env var)?
- `new`, `sdkFree`, or `modification`? `--build-type major` or `minor` (minor needs `--major-build-id`)?
- `--game-version` and `--sdk-version` values?
- For a modification: the `--base-build-id` (from `ludeo builds list`) and matching root folder name.
- Should the build be assigned to an environment, and which one (`--env-id`)?

## 5. Patterns to apply
- **Always dry-run before the real upload** — it catches a wrong `--exec-path` / `--local-directory`
  before any bytes move.
- Reuse the phase-3 values verbatim: `--local-directory` = validated folder, `--exec-path` = confirmed exe.
- Prefer `ludeo.json` + a few flags over a wall of flags; flags win on conflict.
- **CI:** `npm i -g @ludeo/cli`, `ludeo auth set-token --access-token "$LUDEO_ACCESS_TOKEN"`, then
  `ludeo builds upload --no-interactive ...`. The upload step exits non-zero if processing fails, so the
  job fails fast — no separate status step needed unless re-checking later.

## 6. Output Contract
- Build uploaded and processed to `artifacts-created` (`ludeo builds status` reports ready/success).
- `buildId` recorded in `.ludeo/cloud-upload.json`; `gates.upload = "pass"`.
- *(Optional)* build assigned to the intended environment.

## 7. Success Criteria
- [ ] `ludeo builds upload` exits 0 and the build reaches `artifacts-created`
- [ ] `buildId` captured in state
- [ ] *(Optional)* build assigned to an environment

## 8. Common Mistakes
- Putting the access token in `ludeo.json` or committing it — keep it in `auth set-token` / a CI secret.
- Wrong `--exec-path` / `--local-directory` (the dry-run exists to catch this).
- Ctrl-C'ing the post-upload poll and assuming the build is ready — it isn't until `artifacts-created`.
- Using `new` when you meant `sdkFree` (or vice-versa), so the SDK decision from phase 1 doesn't match.
- A `minor` build (`upload` or `modification`) without `--major-build-id`.
- A modification whose `--local-directory` folder **name** doesn't match the base build's root folder.
