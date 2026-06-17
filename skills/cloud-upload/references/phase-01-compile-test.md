# Phase 01 — Compile test (build + Ludeo SDK check)

First ship gate. A build that doesn't compile in its shipping configuration — or that silently
dropped the Ludeo SDK — cannot produce Ludeos, so catch it here before spending time on the later
gates.

## 1. Goal / Purpose
Compile the game in its **shipping/release** configuration and confirm two things:
1. it compiles cleanly (zero errors), and
2. the **Ludeo SDK is actually compiled into the build** — the plugin/package is present and its code
   is not stripped — **unless** this is intentionally an `sdkFree` build (see phase 4
   `--build-creation-type sdkFree`), in which case confirm the SDK is intentionally absent.

## 2. Inputs (Input Contract)
- [ ] Project compiles in its normal/editor config before any ship build
- [ ] The shipping/release configuration and the build-output path are known (ask if unclear)
- [ ] Ludeo SDK is already integrated (plugin/package wired in). If not, this is the wrong skill —
      send the user to the engine integration skill (see [`AGENTS.md`](../../AGENTS.md))
- [ ] Decision recorded: is this a normal SDK build, or an `sdkFree` (perf-testing) build?

## 3. Steps
1. Detect the build system and the shipping config — **do not hardcode**:
   - Unreal: package via `RunUAT BuildCookRun` / the project's `Build.bat` in **Shipping**.
   - Unity: batchmode build (`-quit -batchmode -buildTarget ... -executeMethod ...`) in the release target.
   - Other/native: the project's documented release build command.
2. Compile in the shipping config. Capture the full build log; treat any error as a gate failure.
3. Confirm the Ludeo SDK is **present in the artifact** (skip if `sdkFree`):
   - Unreal: Ludeo plugin enabled in the `.uproject` / present under `Plugins/`, and listed in the
     relevant `*.Build.cs` dependencies; the packaged `Binaries/` contain its module.
   - Unity: the Ludeo SDK package is in `Packages/manifest.json` (or under `Assets/`), referenced by
     the right `asmdef`, and its managed assembly is in the `*_Data/Managed/` of the player build.
4. Confirm the SDK is **not stripped** by release-mode optimization (skip if `sdkFree`):
   - Unity: managed code stripping / IL2CPP can drop "unused" Ludeo types — verify a `link.xml`
     preserves the SDK assembly, or that the stripping level keeps it.
   - Unreal: confirm the plugin module is not excluded from Shipping.
5. Record the result in `.ludeo/cloud-upload.json` → `gates.compile` (pass/fail + build-output path),
   and capture `build.localDirectory` for later phases if the output path is now known.

## 4. Questions to ask the human
- Which configuration ships (Shipping/Release vs Development)? What command builds it?
- Where does the build output land (this becomes `--local-directory` in phase 4)?
- Is the SDK expected in this build, or is this intentionally an `sdkFree` build?
- What `game-version` / `sdk-version` should this build carry? (Captured now, used in phase 4.)

## 5. Patterns to apply
- Tie the SDK check to the phase-4 `--build-creation-type`: a `new` build **must** contain the SDK;
  an `sdkFree` build **must not** depend on it.
- Test the **packaged artifact**, not the editor — editor-play compiling proves nothing about a
  Shipping package.
- Capture versions here so phase 4 doesn't have to re-derive them.

## 6. Output Contract
- A clean shipping build at a known output path.
- Ludeo SDK confirmed present + not stripped (or `sdkFree` confirmed intentional).
- `.ludeo/cloud-upload.json` → `gates.compile = "pass"`, `build.localDirectory` / versions recorded.

## 7. Success Criteria
- [ ] Shipping/release build compiles with 0 errors
- [ ] Ludeo SDK present in the packaged artifact and not stripped — OR `sdkFree` confirmed
- [ ] Build-output path and target versions recorded in state

## 8. Common Mistakes
- Verifying a **Development** build, then shipping **Shipping** (different code paths / stripping).
- Unity managed-code stripping / IL2CPP silently removing the Ludeo assembly — looks compiled, fails at runtime.
- Ludeo plugin enabled in Editor but excluded from the Shipping target.
- Assuming "it runs in the editor" means the package contains the SDK.
