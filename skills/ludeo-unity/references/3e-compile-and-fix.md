# Phase 3 · Task 5 — Compile & Run Gate (Unity)

> **Human-gated task — NOT a subagent.** The orchestrator (`3-lifecycle-orchestrator.md`) drives this
> directly **with the user**, because the agent cannot see the Unity Editor Console and the gate needs
> the human to focus the Editor (recompile) and play the game (overlay). This is the single
> human touch-point of phase 3.
> **Entry: only via the orchestrator.** This is task 5 of 5 in phase 3 (SDK lifecycle), not a phase of
> its own — never open or run it standalone.
>
> **Legend:** `[SDK]` = Ludeo package API · `[Layer]` = prescribed façade · `[Unity]` = engine API.

## 1. Goal / Purpose

Get the project compiling cleanly in the Editor **with the package installed** (and, if the optional
`LUDEO_SDK` define is used, also with it **off**), then confirm the game still plays **and the Ludeo
capture overlay appears** — the first end-to-end proof a Gameplay Session opened. "Compiling" is Editor
script compilation; errors land in `Editor.log`.

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
regains focus (or on `AssetDatabase.Refresh`) — no `make`/`cmake`. To force a headless compile to a
clean log:
```bash
Unity -batchmode -projectPath <ABS_PROJECT> -quit -logFile <ABS>\ludeo-compile.log
```
A non-zero exit + `error CS…` lines = compile errors. (Use the Editor path matching `ProjectVersion.txt`.)

- **Step 1 — package installed (default).** Trigger a compile, grep the log for `error CS`, fix
  iteratively (layer/hook errors surface here).
- **Step 2 — `LUDEO_SDK` off (only if that define is used).** Remove it from **Player → Scripting
  Define Symbols** (or `-define:`), recompile, fix the `#else` fallback types. Skip if relying on the
  runtime switch (the normal case) — CR-001 disable is runtime, not a compile mode.
- **Step 3 — run.** Clean compile → have the user play and watch for the overlay (§7).

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

This task **is** the human interaction:
- Ask the user to **focus the Editor** to recompile (or run the headless command) and report/confirm.
- Ask the user to **play the game, enter gameplay**, and confirm the **capture overlay** appears.
- If the same error persists after fixes, share the exact `error CS…` line, the code section, and the
  doc-12 signature checked against, and ask for guidance.

## 5. Patterns to apply — common Unity compile errors

| Error (`Editor.log`) | Likely cause | Fix |
| --- | --- | --- |
| `CS0246: LudeoSDK / Ludeo* not found` | Package not resolved, or a custom asmdef with "Override References" doesn't see the auto-referenced assembly | Confirm `Packages/manifest.json` has the package; if asmdefs, add the `LudeoSDK` reference (or Auto Referenced) — `04-BUILD-INTEGRATION.md` |
| `CS1503` / arg-type mismatch on a callback | Wrong `Action<…CallbackData>` type | Match the exact callback-data struct in doc 12 (CR-003) |
| `CS0103: AddNotifyPauseGameRequest` | Used the C++ name | It's `AddNotifyPauseGame`/`AddNotifyResumeGame` (no `…Request`) |
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
- [ ] Game still **plays** — no new exceptions in `Editor.log` (Play mode); ideally a player build too.
- [ ] **Ran the game, entered gameplay → the Ludeo capture overlay appears** (a small in-game square
      prompting **`Shift+F4`**). This is the **primary visual confirmation a Gameplay Session opened** —
      every other signal at this stage is in the logs. Log shows no Ludeo errors.
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
