# Phase 3 · Task 4 — Implement the SDK Lifecycle (Unity)

> **Single-task subagent brief.** Dispatched by the phase-3 orchestrator
> (`3-lifecycle-orchestrator.md`). Create the layer + wire the hooks, then return a summary + the list
> of files created/edited. **You do not compile** — the orchestrator runs task 5 (the human-gated
> compile+run) after you return. You run in isolated context — inputs are the files in §2.
> **Entry: only via the orchestrator.** This is task 4 of 5 in phase 3 (SDK lifecycle), not a phase of
> its own — never open or run it standalone.
>
> **Legend:** `[SDK]` = Ludeo package API · `[Layer]` = prescribed façade · `[Unity]` = engine API.

## 1. Goal / Purpose

Execute the plan: create the `LudeoController` layer files, wire the bootstrap, and edit the
🎮 game-initiated hook points. Produces the integration layer + edited game files — ready for the
task-5 compile+run gate.

## 2. Inputs (Input Contract)

- [ ] `ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md` (task 3) — layer files, hook table, order.
- [ ] `ludeo-integration-plan/TDD_<GameName>.md` (task 2) — architecture decisions, risks.
- [ ] **Phase 1 done** — package installed, `using LudeoSDK;` compiles, `LudeoSettings.asset` configured.
- [ ] Context files read:
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001/003/007/009/010/011/012/013.
  - `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` — the flow to reproduce.
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the **canonical code** for each class
    (incl. the boot-straight **readiness-gate** additions: `TryReleaseCreatorGate` + the gated
    `HandleActivateDone`/`HandleConsentUpdated`).
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — exact `[SDK]` signatures (reproduce verbatim).
  - **If the plan includes a readiness gate** (`SDK_LIFECYCLE_PLAN` step 3.5 /
    `CODE_MAP.launch_model.readiness_gate_required`), also read
    `ludeo-integration-docs/unity/LAUNCH-AND-READINESS.md`.

> **No config step here.** No `LudeoConfig.h`/`ludeo.ini`/auth questionnaire — the package reads
> `LudeoSettings.asset` (phase 1). If the apiKey is a placeholder, point the user back to
> **Ludeo → Setup and Show LudeoSettings**; don't add a config class.
> **Exception (dev/QA only):** if phase 1 set up the `LUDEO_DEV`-gated dev-override shim
> (`LudeoDevConfig.ApplyOverrides`, see `unity/UPM-INSTALL-AND-DEFINES.md` → *Dev/QA runtime overrides*),
> call it as the **first line before `LudeoManager.Initialize()`**, inside the `#if LUDEO_DEV` guard. That is **not**
> the config class this rule forbids — it's a build-gated test affordance that compiles out of production.

## 3. Steps

### 1. Load the plan
Extract from `SDK_LIFECYCLE_PLAN`: layer files (paths + responsibilities), game files to edit
(locations + snippets), and the implementation order.

### 2. Create the layer files (from `REFERENCE-ARCHITECTURE.md`)
Create under the plan's path (e.g. `Assets/Scripts/Ludeo/`). Reproduce the canonical code, renaming
objectTypes/attributes/actions to the game. Each gets its own `.cs` (game assembly; package is
**auto-referenced** — no asmdef ref / no define needed):

| File `[Layer]` | Purpose |
| --- | --- |
| `LudeoController.cs` | Façade: `Initialize` + `SessionManager.CreateSession`, subscribe **all** session events before `Activate`, route begin/end/abort/track/action through the flow switch, expose the game-facing API (incl. `StartNoneLudeable`/`StopNoneLudeable` wrappers — scaffold; call sites are phase 6). |
| `LudeoIntegrationData.cs` | Shared state: session/room/gameplay-session, ids, flags, restored data, `OpenRoomData` factories. |
| `LudeoFlowSwitch.cs` | CR-001 + CR-012: defaults to Disabled+Dummy; `SetFlags` enables on consent; `SwitchToCreate`/`SwitchToPlay`. |
| `ILudeoFlow.cs` + `LudeoCreatorFlow` / `LudeoPlayFlow` / `DisabledLudeoFlow` | Room open + add-player; play restores by objectType bucket. |
| `LudeoInitRoomHandler.cs` | The `OpenRoom` → `AddPlayer` callback chain (CR-009). |
| `ILudeoGameplaySessionManager.cs` + `LudeoGameplaySessionManager` + `DummyLudeoGameplaySessionManager` | Begin/End/Abort, `SendAction`, the tracked-handler registry, `UpdateStateObjects`. |
| `ILudeoStateHandler.cs` + `DefaultLudeoStateHandler` | Per-object capture context (writers land in phase 5 · task 1). |
| `LudeoKeys.cs` / `LudeoActionKeys.cs` | objectType / attribute / action string constants. **Scaffold only** — real keys discovered in phase 6 (actions) & phase 4 (objects). Seed the standard non-gameplay action names (`StartNoneLudeable`/`StopNoneLudeable`/`PauseLudeo`/`ResumeLudeo`) + what the layer needs now. |

> **CR-001 is interfaces + dummies, not `#if`.** Add a `#if LUDEO_SDK … #else … #endif` only if you
> must ship a build that **excludes** the package (rare — `unity/UPM-INSTALL-AND-DEFINES.md §4`).

### 3. Wire the bootstrap (init scene)
In the init-scene MonoBehaviour from the plan (`Awake`/`Start`):
```csharp
m_ludeo = new LudeoController(                                              // [Layer]
    onInitDone:       startingInLudeo => { /* play flow → replay scene; else → main menu */ },
    onRoomReady:      () => { ApplyRestoredState(); m_ludeo.BeginGameplay(() => Time.timeScale = 1f); }, // CR-010: apply WHILE frozen → Begin → unfreeze
    // CR-011 pair — freeze AND report; the freeze alone leaves the objective timer draining.
    // PauseGame/ResumeGame are the game's own freeze primitives, which emit PauseLudeo/ResumeLudeo
    // (phase 6); showMenu:false keeps the game's pause UI from stacking under the Ludeo overlay.
    onStopGame:       () => PauseGame(showMenu: false),  // CR-011a freeze + CR-011b action  [Unity]
    onResumeGame:     () => ResumeGame(),                // CR-011a unfreeze + CR-011b action
    onExitToMainMenu: () => SceneManager.LoadScene("Menu"),                 // [Unity]
    onBeginRestore:   () => { Time.timeScale = 0f; StartCoroutine(LoadRestoreSceneThenNotify()); });    // [Unity]+[Layer]
m_ludeo.SetGameplayerId(localPlayerId);
```
`ApplyRestoredState()` / `LoadRestoreSceneThenNotify()` are stubs — scene-load wiring is phase 5 · task 3, the
two-pass body is phase 5 · task 4. A **create-only** game may omit `onBeginRestore`.

> **Boot-straight (readiness gate, per the plan):** there is no init scene — construct the controller
> from a `RuntimeInitializeOnLoadMethod(BeforeSceneLoad)` hook or a build-index-0 boot scene, before the
> gameplay scene's `Start()`. Wire `TryReleaseCreatorGate` + the gated
> `HandleActivateDone`/`HandleConsentUpdated` (REFERENCE-ARCHITECTURE), keep the gameplay scene
> frozen/suppressed behind a "ready" cover until release, fire the creator `OpenRoom` on
> release-with-`canCreate`, and add the **bounded timeout fallthrough** to an uncaptured run. The play
> branch suppresses the scene's auto-start under `IsInLudeoFlow`. See `unity/LAUNCH-AND-READINESS.md`.

### 4. Edit the game hook points (🎮 game-initiated only)
From the plan's hook table. **Back up edited files first** (`.bak` or rely on the branch). Route
through the `[Layer]` façade — never raw `[SDK]`:

| Hook `[Unity]` site | `[Layer]` call | CR |
| --- | --- | --- |
| Gameplay **start** (after scene/match load) | create-flow `InitRoom` → `OpenRoom` `[SDK]` | CR-009 |
| Gameplay MonoBehaviour `Update` | `m_ludeo.UpdateStateObjects()` (while gameplay active) | CR-005 |
| **Every** exit path (level end / death / quit / restart / scene unload) | `m_ludeo.EndGameplay(...)` / `AbortGameplay(...)` | CR-007 |
| `OnApplicationQuit` | `m_ludeo.Shutdown()` — end/abort any active run **and `Dispose()` the owned `LudeoSession`** | CR-007 |

> The non-gameplay `SendAction` **call sites** (`StartNoneLudeable` etc.) are **not** edited here —
> they land in phase 6. Task 4 only scaffolds the façade methods. **Do NOT wire an SDK tick** (CR-005).

### 4.5 Required: notification registration (enforce, even if the plan is silent)
In `LudeoController`, **after** `CreateSession` succeeds and **before** `Activate`, subscribe to these
on the `LudeoSession`. If the plan omitted any, **add it anyway** — hard requirement.

| Notification `[SDK]` | If missing, the symptom is… |
| --- | --- |
| `LudeoSelected` | A Ludeo is selected and nothing happens — no restoration entry. |
| `RoomReady` | `Begin` never fires; tracking never starts; post-load playback never resumes (CR-010). |
| `PlayerConsentUpdated` | Flow switch never enables; create/play stay disabled (CR-012). |
| `PauseGameRequested` | **Game keeps running while the overlay covers it — the #1 mid-play failure (CR-011).** |
| `ResumeGameRequested` | Overlay closes but the game stays paused (or never paused). |
| *(handler freezes but sends no action)* | Game freezes correctly, but the **Ludeo objective timer keeps draining** under the overlay — CR-011's second half. |
| `GameBackToMenuRequested` | "Back to menu" from the overlay leaves the player stuck in the Ludeo (CR-007). |
| `MuteGameRequested` / `LocalizationUpdated` | Mute / language requests ignored (optional). |

> ⚠️ Names are `PauseGameRequested`/`ResumeGameRequested` — **not** `…PauseGameRequest`. Both take a
> plain `Action`. The pause handler must freeze the **simulation** (`Time.timeScale = 0f`), not just input —
> **and must also reach the `PauseLudeo`/`ResumeLudeo` emit** (phase 6), because freezing the game does not
> stop the Ludeo objective timer. Route the handler through the game's **freeze** primitive (not a
> menu-showing one), or emit directly from it. See
> [`ludeo-integration-docs/unity/CONSENT-AND-OVERLAY.md`](./ludeo-integration-docs/unity/CONSENT-AND-OVERLAY.md) §3.

## 4. Questions to ask the human

Surface to the orchestrator: only if the plan is missing a path the code clearly needs and the
artifacts don't resolve it. Otherwise implement the plan as written.

## 5. Patterns to apply

- Reproduce `REFERENCE-ARCHITECTURE.md` canonical code; adapt names to the game.
- Façade-only: game → `[Layer]` → `[SDK]`; no scattered raw SDK calls (CR-001).
- Back up edited game files (`.bak` or the integration branch) before editing.
- **Rollback:** `mv File.cs.bak File.cs`, or `git checkout -- . ; rm -rf Assets/Scripts/Ludeo/`.

## 6. Output Contract

- All `[Layer]` `.cs` files created at the plan's path.
- Game hook files edited (with backups) per the plan's table.
- A report: (1) layer files created (paths), (2) game files edited (+ backup), (3) ready for task 5.
- **No compile performed** — that's task 5.

## 7. ✅ Success Criteria (pre-compile verification)

- [ ] All `[Layer]` files created (controller, data, flow switch, flows, init-room handler, gameplay
      session manager + dummy, state handler interface + default, keys).
- [ ] Bootstrap constructs `LudeoController` with its delegates; `onRoomReady` applies **before**
      unfreeze; begin gate includes the restore scene-load leg.
- [ ] Every gameplay exit path routes through `EndGameplay`/`AbortGameplay` (CR-007);
      `OnApplicationQuit` → `Shutdown()` ends/aborts **and** `Dispose()`s the session.
- [ ] `UpdateStateObjects()` called per active-gameplay frame; **no** SDK tick wired (CR-005).
- [ ] **All six required notifications registered before `Activate`** (§4.5).
- [ ] Pause handler **freezes the sim** (`Time.timeScale = 0f`, directly or via the game's freeze primitive)
      **and reaches the `PauseLudeo` emit**; resume handler mirrors it (CR-011 — both halves, once per
      transition). Freezing without emitting leaves the objective timer running under the overlay.
- [ ] SDK access goes through interfaces with `Dummy*`/`Disabled*` fallbacks (CR-001).
- [ ] Backups exist for every edited game file.

## 8. Common Mistakes

- **Compiling here** — task 5 owns the (human-gated) compile.
- **Wiring an SDK tick** (CR-005) or editing the non-gameplay `SendAction` call sites (phase 6).
- **Skipping the `LudeoSession.Dispose()`** in `Shutdown()` — 2nd Editor Play returns `WrongState`.
- **Registering notifications after `Activate`**, or using the C++ `…Request` names.
- **Scattering raw `[SDK]` calls** instead of routing through the façade.

## Related / Next

- **Next (orchestrator):** task 5 — `3e-compile-and-fix.md`, the **human-gated** compile+run gate.
