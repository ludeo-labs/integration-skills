# Phase 3 · Task 5 — Compile & Run Gate (Unity)

> **Run by the orchestrator — NOT a subagent, and by the agent alone.** The orchestrator
> (`3-lifecycle-orchestrator.md`) compiles headlessly and reads the log (the Console's output is in it),
> then proves the run half on the dev player through the test harness built in task 6: a capture run, and
> the highlight key producing a highlight (§3). Only when the phase-1 readiness check found that the
> machine can't build or launch a player does it drive this **with the user**: they focus the Editor
> (recompile) and play the game (overlay).
> **Entry: only via the orchestrator.** This is task 5 of 5 in phase 3 (SDK lifecycle), not a phase of
> its own — never open or run it standalone.
>
> **Legend:** `[SDK]` = Ludeo package API · `[Layer]` = prescribed façade · `[Unity]` = engine API.

## 1. Goal / Purpose

Get the project compiling cleanly (headless by default) **with the package installed** (and, if the optional
`LUDEO_SDK` define is used, also with it **off**), then confirm the game still plays **and the Ludeo
capture overlay works** — the first end-to-end proof a Gameplay Session opened. "Compiling" is Editor
script compilation; errors land in the `-logFile` you passed (or `Editor.log` with the Editor open).

## 2. Inputs (Input Contract)

- [ ] Task 4 done — the `LudeoController` layer created + game hooks edited.
- [ ] Phase 1 done — package installed, `LudeoSettings.asset` configured, native smoke test passed.
- [ ] Context files read:
  - `ludeo-integration-docs/unity/READING-UNITY-LOGS.md` — **how you observe compile output** (required).
  - `ludeo-integration-docs/04-BUILD-INTEGRATION.md` — build model + native/IL2CPP/asmdef troubleshooting.
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — exact `[SDK]` signatures (for callback mismatches).
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (runtime disable), CR-003 (callbacks).

> **⚠️ You cannot see the Editor Console.** Every compile result + runtime check comes from **reading
> Unity's log files**. Grep `Editor.log` (or a dedicated `-logFile`) for `error CS`,
> `WrapperDllNotFound`, and exceptions. **Do not declare success without reading a log.**

## 3. Steps — the recompile loop

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Compile with the package installed (default path)         │
│    └─ error CS in Editor.log? → read FIRST error → fix → retry│
│ 2. (only if the optional LUDEO_SDK define is used)           │
│    Compile with the define OFF → fix #else fallbacks → retry  │
│ 3. Clean compile? → confirm the game PLAYS + overlay → SUCCESS│
└─────────────────────────────────────────────────────────────┘
```

**How "compile" works in Unity:** the Editor recompiles automatically when `.cs` changes and it
regains focus (or on `AssetDatabase.Refresh`) — no `make`/`cmake`.

**A resident headless Editor is running (case B, Unity 6+): compile inside it.** A separate `-batchmode`
run is refused while any Editor holds the project. Run `unity command recompile --project-path …`, poll
`unity command recompile_status` until `completed`, then read errors with `unity command console_status`
and `unity command console` ([`agent-editor-tooling.md`](agent-editor-tooling.md) → *Compiling inside a
resident Editor*). Or stop it and use the default below. Either way, judge the result by timestamps (your
edit, then the `.dll` under `Library/ScriptAssemblies/`, then the log) and your type names, not by zero
errors alone: a failed compile leaves the previous `.dll` in place.

**Default — headless, with no Editor holding the project:** force a compile to a clean log, and judge it
the same way (timestamps, then your type names in the `.dll`):
```bash
Unity -batchmode -projectPath <ABS_PROJECT> -quit -logFile <ABS>\ludeo-compile.log
```
A non-zero exit + `error CS…` lines = compile errors. (Use the Editor path matching `ProjectVersion.txt`.)

- **Step 1 — package installed (default).** Trigger a compile, grep the log for `error CS`, fix
  iteratively (layer/hook errors surface here).
- **Step 2 — `LUDEO_SDK` off (only if that define is used).** Remove it from **Player → Scripting
  Define Symbols** (or `-define:`), recompile, fix the `#else` fallback types. Skip if relying on the
  runtime switch (the normal case) — CR-001 disable is runtime, not a compile mode.
- **Step 3 — run, yourself.** Clean compile → rebuild the dev player with the harness (task 6) and run a
  `capture-run` job into gameplay. Confirm the overlay from its log line
  (`LudeoSdkConfig received -- bindings rebuilt …`, which also names the live capture hotkey), then have
  the launcher press that key and find the highlight and its `onCaptureVideoRequest` line in the log
  ([`agent-test-harness.md`](agent-test-harness.md) → *Capturing a moment*). Read the run's
  `result.json` and the log for Ludeo errors. Only if the machine can't build or launch a player, have the
  user play and watch for the overlay (§7).

**Max 10 failed attempts**, then list remaining `error CS`, identify the pattern (same file/type?),
and hand to the user for manual review.

> **Before telling the user to run, remind them about config.** A clean compile does *not* mean Ludeo
> will authenticate. Confirm `LudeoSettings.asset` has a **real `apiKey`** and, for local no-launcher
> testing (`runWithoutLauncher = true`), **both** `launcherUserId` (Steam id) **and** `betaVersion`
> (Steam beta branch name) — the SDK needs the pair, and `Activate` rejects if either is missing. All
> set in phase 1. With a placeholder/missing key, or a half-set no-launcher pair, the game runs but
> **Ludeo won't authenticate** (`Activate` rejects) — and the SDK log won't name the offending field,
> so check the `apiKey` and the `launcherUserId`/`betaVersion` pair first when auth fails.

## 4. Questions to ask the human

Normally nothing: compile and run it yourself. Ask only when you can't:
- **The integrator's Editor holds the project:** ask them to close it for the
  headless compile (or to focus it to recompile, and report).
- **The machine can't build or launch a player:** ask the user to **play the game, enter gameplay**, and
  confirm the **capture overlay** appears.
- **No way into gameplay:** if the harness can't reach gameplay with the game's own entry points, ask how
  (a dev command, a level select).
- If the same error persists after fixes, share the exact `error CS…` line, the code section, and the
  doc-12 signature checked against, and ask for guidance.

## 5. Patterns to apply — common Unity compile errors

| Error (`Editor.log`) | Likely cause | Fix |
| --- | --- | --- |
| `CS0246: LudeoSDK / Ludeo* not found` | Package not resolved, or a custom asmdef with "Override References" doesn't see the auto-referenced assembly | Confirm `Packages/manifest.json` has the package; if asmdefs, add the `LudeoSDK` reference (or Auto Referenced) — `04-BUILD-INTEGRATION.md` |
| `CS1503` / arg-type mismatch on a callback | Wrong `Action<…CallbackData>` type | Match the exact callback-data struct in doc 12 (CR-003) |
| `CS0103: PauseGameRequestedRequest` | Used the C++ name | It's `PauseGameRequested`/`ResumeGameRequested` (no `…Request`) |
| `CS0117: …Begin/End/Abort` signature | Wrong overload | Reproduce the signature from doc 12 verbatim |
| `CS0246` only when `LUDEO_SDK` is OFF | `#else` fallback types missing | Provide stub fallback types in the `#else` branch |
| `CS0234: LudeoManager.Tick` | Tried to call the internal tick | Remove it — the plugin ticks itself (CR-005) |

**Debugging:** read the FIRST `error CS` (others cascade); check line:column; compare against the plan /
`REFERENCE-ARCHITECTURE.md`; verify `[SDK]` signatures against doc 12; check asmdef boundaries if only
the game module fails to see `LudeoSDK`.

## 6. Output Contract

Report to the orchestrator: (1) compile status (package-on ✅/❌, define-off ✅/❌ or N/A), (2) each
`error CS` fixed + the fix, (3) overlay confirmation (or the failure to chase), (4) any remaining issue
+ log excerpt.

## 7. ✅ Success Criteria

- [ ] Clean compile **with the package** — no `error CS` in the log (you read it).
- [ ] *(Only if `LUDEO_SDK` is used)* clean compile with the define **off** (fallback types compile).
- [ ] Game still **plays** — the dev player's capture run shows no new exceptions in its log.
- [ ] **Ran the game, entered gameplay → the Ludeo capture overlay works.** The agent proves it: the
      overlay's bindings log line names the highlight key, pressing that key produced a highlight
      (`onCaptureVideoRequest … highlightId=…`), and a screenshot shows the saving toast. This is the
      **primary confirmation a Gameplay Session opened**. An idle overlay square may never be drawn, so
      its absence proves nothing. Log shows no Ludeo errors. (Without a player build, the human looks
      for the overlay instead.)
- [ ] No SDK tick wired; pause/notification names correct; no scattered raw `[SDK]` calls (spot-check).

## 8. Common Mistakes

- **Declaring success without reading a log** — you can't see the Console.
- **Building "with the define off" when no `LUDEO_SDK` define is used** — there's one compile path.
- **Telling the user to run before checking the apiKey** — a clean compile hides an auth failure.
- **Treating "compiles" as "works"** — the overlay is the real proof; chase its absence in the log now,
  not through every later phase.
- **No-launcher auth fails with a vague log** — if `runWithoutLauncher = true` and `Activate`/auth
  rejects with no clear cause, the usual culprit is a missing or mismatched `launcherUserId`/`betaVersion`
  pair (both are required together). The SDK log rarely names the field — check the pair before anything else.

## Related / Next

- This closes phase 3. The capture pipeline is now live. **Next:** phase 4 (map game objects) —
  `4-map-game-objects.md` (census + wave plan), then phase 5 (tracking & restore). Actions come **later**,
  in phase 6, after the player flow is proven — they are no longer the next step after lifecycle.
