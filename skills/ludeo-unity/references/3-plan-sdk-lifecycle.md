# Phase 3 · Task 3 — Plan the SDK Lifecycle (Unity)

> **Single-task subagent brief.** Dispatched by the phase-3 orchestrator
> (`2-lifecycle-orchestrator.md`). Do exactly this one task, produce the §6 artifact, and return a
> short summary + the artifact path. You run in isolated context — your inputs are the files in §2.
> **Entry: only via the orchestrator.** This is task 3 of 5 in phase 3 (SDK lifecycle), not a phase of
> its own — never open or run it standalone.
>
> **Legend:** `[SDK]` = Ludeo package API · `[Layer]` = prescribed façade
> ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Turn the integration points + TDD into a concrete plan for the **`LudeoController` layer** (the
prescribed façade), its notification registration, the game-hook edits, and the **non-gameplay
emissions** — without searching game code. Output
`ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md`.

## 2. Inputs (Input Contract)

- [ ] `ludeo-integration-plan/CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`, `TDD_<GameName>.md`.
- [ ] **Phase 1 done** — `LudeoSettings.asset` configured (apiKey/auth/Steam already set). This plan
      **consumes** that config; it does **not** re-gather it.
- [ ] Context files read:
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001/003/007/009/011/012.
  - `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` — the full callback/notification flow.
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the layer spine **the plan instantiates**.
  - **If `session_boundaries` has the `{ model, start_sites[], exit_sites[], pause_overlay[] }`
    sub-structure**, also read `ludeo-integration-docs/game-patterns/open-world.md` — **this is the
    phase where the `OpenRoom` bind point is decided**.
- Reads files only; does **not** analyze the Unity project directly. If no TDD exists, ask the
  orchestrator: *"No TDD found — run task 2 first, or continue without?"*

## 3. Steps

1. Read the context files, then the three artifacts.
2. **Design the `LudeoController` layer** against `REFERENCE-ARCHITECTURE.md` — name the concrete files
   and where they go (e.g. `Assets/Scripts/Ludeo/`), or the opt-out mapping onto existing managers
   (keep the façade boundary, dummy/disabled wiring, consent gating, and notification registration).
3. **Bind each integration point** to a location:
   - `InitLudeoSession` + register notifications + `Activate` `[SDK]` → bootstrap MonoBehaviour in the
     init scene (from `entry_points`).
   - `OpenRoom` `[SDK]` via `[Layer]` → the gameplay **start** site.
   - `UpdateStateObjects()` `[Layer]` → a gameplay MonoBehaviour `Update` `[Unity]` (CR-005).
   - `End`/`Abort` `[SDK]` via `[Layer]` → **every** exit path (CR-007), incl. `OnApplicationQuit`.
   - **Session release** → `OnApplicationQuit` `[Unity]`: end/abort active gameplay (CR-007) **and
     `Dispose()` the owned `LudeoSession`** (the plugin disposes the room/reader, not the session —
     skipping it breaks Editor re-init; `05-LIFECYCLE-MANAGEMENT.md` "Shutdown").
4. **Document the callback chains** (CR-009): `OpenRoom` cb → `AddGamePlayer`; `RoomReady` notification
   → `Begin`; `End`/`Abort` cb → `CloseRoom`. **Not** game call sites.
5. **Plan the notification registration** (§5 table) — registered once, before `Activate`.
6. **Plan the non-gameplay emissions** from `SDK_INTEGRATION_POINTS.non_ludeoable`:
   - For each, plan the `[Layer]` façade method that wraps `SendAction("StartNoneLudeable")` /
     `"StopNoneLudeable"` at the enter/exit sites — the actual edits land in phase 6.
   - Plan the **capture-hygiene pause** pair (`PauseLudeo`/`ResumeLudeo`) if the game has a true
     sim-freeze pause/cutscene (distinct from the overlay pause notification).
   - Note the **one-time platform global-trigger mapping** (out-of-code; phase 6) so non-ludeoable
     windows are backend-excluded.
   - **No dangling non-ludeoable:** ensure each `Start`/`Pause` has a matching `Stop`/`Resume`, and that
     a Gameplay Session `End`/`Abort` closes any still-open span.

## 4. Questions to ask the human

Surface to the orchestrator:
- **Open-world/streaming:** which `start_sites[]` entry binds `OpenRoom` (if `open-world.md` doesn't decide it).
- Where the layer files should live, if the project has a strong existing convention (default `Assets/Scripts/Ludeo/`).

## 5. Patterns to apply

**🔔 Session-lifetime notifications the plan MUST cover** — registered **once** on the `LudeoSession`,
**before** `Activate`. Unity names — **not** the C++ `…Request` names.

| Notification `[SDK]` | Required? | Handler responsibility |
| --- | --- | --- |
| `AddNotifyLudeoSelected` | ✅ | Enter play flow — **stub** here (`GetLudeo` + cache reader); restore flow is phase 5 · task 3, data read-back phase 5 · task 4. |
| `AddNotifyRoomReady` | ✅ | Gameplay-start gate **and** post-Ludeo-load resume: **apply → unfreeze → `Begin`** (never unfreeze first); restore `Begin` also waits on the scene-load leg (CR-010/CR-009). |
| `AddNotifyConsentUpdated` | ✅ | Feed `LudeoFlowSwitch.SetFlags(canCreate, canPlay)` + gate the gallery button (CR-012). |
| `AddNotifyPauseGame` | ✅ | **Freeze the simulation** (`Time.timeScale = 0f`) — the #1 mid-play failure if missing (CR-011). |
| `AddNotifyResumeGame` | ✅ | Unfreeze the sim (`Time.timeScale = 1f`) (CR-011). |
| `AddNotifyReturnToMainMenu` | ✅ | A CR-007 exit: stop tracking, `CloseRoom`, load the menu scene. |
| `AddNotifyMuteRequest` / `AddNotifyLocalizationChanged` | optional | Mute audio / set language. |

> ⚠️ `AddNotifyPauseGame`/`AddNotifyResumeGame` take a plain `Action` (no data struct). The overlay
> pause (SDK-driven) is **distinct** from the game-initiated capture-hygiene `PauseLudeo`/`ResumeLudeo`.

- **Plan the layer, not scattered calls.** Game code calls the `[Layer]` façade; the façade calls
  `[SDK]`. Scattering `LudeoSDK` calls makes CR-001/CR-007 nearly impossible.
- **Disable is runtime (CR-001).** Route all SDK use through interfaces with `Dummy*`/`Disabled*`
  fallbacks via `LudeoFlowSwitch` — not `#if` macros.
- **No `LudeoConfig`/`ludeo.ini`/auth questionnaire** — config is `LudeoSettings.asset` (phase 1).
- **Callback-driven ≠ game integration point (CR-009).**

## 6. Output Contract

`ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md` containing:
- **Layer file list** — each `[Layer]` class to create (path + responsibility), or the opt-out mapping.
- **Bootstrap** — the init-scene MonoBehaviour + the `LudeoController` construction with game-supplied
  delegates (`onInitDone`, `onRoomReady`, `onStopGame`, `onExitToMainMenu`, + `onBeginRestore` unless
  create-only).
- **Hook points** — table of 🎮 game-initiated edits: file · class/method · line · `[SDK]`/`[Layer]`
  call · CR.
- **Callback chains** — `OpenRoom→AddGamePlayer`, `RoomReady→Begin`, `End→CloseRoom`.
- **Notification registration** — the §5 table with planned handler bodies/stubs.
- **Non-gameplay plan** — the `StartNoneLudeable`/`StopNoneLudeable` (and `PauseLudeo`/`ResumeLudeo`)
  façade methods + emit sites (edits deferred to phase 6) + the platform global-trigger note.

## 7. ✅ Success Criteria

- [ ] Layer file list (or opt-out mapping) defined against `REFERENCE-ARCHITECTURE.md`.
- [ ] Bootstrap + all delegates planned; `onRoomReady` applies **before** unfreeze; begin-gate includes
      the restore scene-load leg.
- [ ] **Every** exit path routed to `End`/`Abort` (CR-007); `OnApplicationQuit` ends/aborts **and**
      `Dispose()`s the session.
- [ ] **All required notifications registered before `Activate`** (§5).
- [ ] Callback chains documented, not as game call sites (CR-009).
- [ ] **Non-gameplay emissions planned** with no dangling non-ludeoable span (matched Start/Stop,
      closed on `End`).

## 8. Common Mistakes

- **Scattering raw `[SDK]` calls** instead of the façade (breaks CR-001/CR-007).
- **Planning `AddGamePlayer`/`Begin`/`CloseRoom` as game call sites** (CR-009).
- **Planning a config class / re-gathering auth** — it's `LudeoSettings.asset` (phase 1).
- **Unfreezing before applying** in `onRoomReady` (CR-010).
- **Forgetting to close a non-ludeoable/pause span on session `End`** — dangling exclusion.

## Related / Next

- **Next (orchestrator):** task 4 — `4-implement-sdk-lifecycle.md` (create the layer + edit hooks).
