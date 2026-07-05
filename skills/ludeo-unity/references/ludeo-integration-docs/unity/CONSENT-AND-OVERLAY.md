# Consent & Overlay (Unity) — the runtime contract

Two Unity-specific runtime concerns the integration must honor: **consent** ([CR-012](../00-CRITICAL-REQUIREMENTS.md))
gates whether the SDK may create or play Ludeos at all, and the **overlay** notifications
([CR-011](../00-CRITICAL-REQUIREMENTS.md) + the exit/mute/localization callbacks) keep the game
correct while the Ludeo UI is up. Both are driven by `LudeoSession` notifications registered **once**,
before `Activate` (see [`05-LIFECYCLE-MANAGEMENT.md`](../05-LIFECYCLE-MANAGEMENT.md)).

> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)) · `[Layer]` = prescribed façade
> ([`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md)) · `[Unity]` = engine API.

---

## 1. Consent (CR-012)

The backend reports, per session, whether the player consented to **creating** and/or **playing**
Ludeos. Register `AddNotifyConsentUpdated` `[SDK]` before `Activate`; it can fire more than once.

```csharp
session.AddNotifyConsentUpdated(data => {                 // [SDK]
    // data.canCreateLudeo, data.canPlayLudeo
    m_switch.SetFlags(data.canCreateLudeo, data.canPlayLudeo);   // [Layer] CR-001 + CR-012 mechanism
    galleryButton.SetActive(data.canCreateLudeo || data.canPlayLudeo);   // [Unity] hide if neither
});
```

Rules:
- **Feed the flow switch.** `LudeoFlowSwitch.SetFlags` `[Layer]` enables the real flow/manager only
  when consent allows; otherwise it serves the `Disabled`/`Dummy` impls and the game plays normally
  (CR-001). The game **never** branches on consent itself — it asks the switch.
- **Gate create vs play independently.** Don't `OpenRoom` **for create** unless `canCreateLudeo`;
  don't `OpenRoom` **for play** unless `canPlayLudeo` (`SwitchToCreate()`/`SwitchToPlay()` `[Layer]`
  already return `false` and stay disabled when the matching flag is off).
- **Both false ⇒ treat the SDK as disabled this run** — no gallery, no rooms, dummies everywhere.

> **⚠️ Consent arrives *async* — an `OpenRoom` at run-start can fire before it and silently no-op.**
> `Activate` and the **first** `ConsentUpdated` complete on the SDK's schedule, which can be **after** the
> gameplay scene has loaded and your "run started" signal has fired. If `OpenRoom` (via `SwitchToCreate()`)
> runs in that window, the flow switch is **still disabled** (flags not yet set) → it returns `false` and
> **no-ops**: no room, no `RoomReady`, no overlay, **and no error** (disabled-flow is a no-op by design).
> This is **not** the consent-off case — consent *would* allow it; the call was just too early.
> **Fix — record intent, fire from the callback:** when the run starts, set a `wantCapture` flag and
> attempt `OpenRoom`; if the switch is still disabled, do nothing yet. Then in `AddNotifyConsentUpdated`,
> after `SetFlags`, if `wantCapture && canCreateLudeo` and no room is open, fire `OpenRoom` there — the
> first point `canCreateLudeo` is known. (Keep it idempotent: guard on room-already-open.)

## 2. The gallery (entry to the play flow)

The gallery is the Ludeo UI where the player picks a Ludeo to play. Open it through the façade:

```csharp
public void OpenLudeoGallery() => m_data.ludeoSession?.OpenGallery();   // [Layer] → [SDK] OpenGallery
```
- **Only surface the gallery button when consent allows it** — gate its visibility on
  `canCreateLudeo || canPlayLudeo` (the `[Layer]` exposes this as `IsEnablePlayableMoments` /
  `isDisplayPlayableMoment`). A gallery button on a consent-off run is a dead end.
- Choosing a Ludeo fires the `AddNotifyLudeoSelected` `[SDK]` notification → the play/restore flow
  (`GetLudeo` → restore → `OpenRoom` for the ludeo). That flow is phase 11; here we only ensure the
  entry point exists and is consent-gated.

## 3. Overlay pause / resume (CR-011)

While the Ludeo overlay is open **during playback**, the simulation must **freeze** — not just input.
Register both (plain `Action`, no data struct) before `Activate`:

```csharp
session.AddNotifyPauseGame(()  => Time.timeScale = 0f);   // [SDK] + [Unity] — NOT AddNotifyPauseGameRequest
session.AddNotifyResumeGame(() => Time.timeScale = 1f);   // [SDK] + [Unity]
```
- **Freeze the sim**, e.g. `Time.timeScale = 0f` `[Unity]` (plus the game's own pause for audio /
  streaming jobs if those advance world state). Input-only pausing leaves the game playing under the
  overlay — the #1 mid-play failure.
- **Two independent flags, not one boolean.** Track the overlay pause (CR-011) and the post-Ludeo-load
  restore freeze ([CR-010](../00-CRITICAL-REQUIREMENTS.md)) separately; the engine is paused iff
  *either* is set. One shared flag lets `ResumeGame` unfreeze a mid-restoration pause, or `RoomReady`
  cancel a player-opened overlay.
- **Idempotent.** The pair toggles repeatedly across one play session — handlers must tolerate
  repeated open/close.
- **Reset both flags at a deterministic lifecycle start AND at the start of every restore — never assume
  zero-init.** If the integration layer is a **persistent singleton** (a `ScriptableObject` service, a
  `DontDestroyOnLoad` MonoBehaviour, or `static` state), its private runtime fields **survive across Editor
  playmode sessions, scene reloads, AND replays within one session** — they are *not* re-zeroed on a fresh
  play. A pause flag left `true` by a prior run (the SDK fired `PauseGame` — e.g. the overlay or the
  Ludeo-done pause — with no matching `ResumeGame` before the run ended) carries into the next play and
  silently keeps the engine at `timeScale = 0`. The new run then loads, restores, and `Begin`s a Ludeo
  correctly — but it never unfreezes, presenting **exactly like dead input** (or, on an async restore that
  awaits `FixedUpdate`, a silent **deadlock**, [`07`](../07-RESTORATION-PATTERNS.md) §10.1). See the
  three-gate diagnostic ([`07`](../07-RESTORATION-PATTERNS.md) §10.4). A **bootstrap-only** reset is *not*
  enough: a second replay (player picks another Ludeo from the overlay without quitting) re-enters restore
  without re-running bootstrap, so a shipped build's process restart never happens either — reset both flags
  in the per-restore `onBeginRestore` hook too (07 §2.2/§10.3). Clear *both* pause flags — and any other
  mutable runtime state (cached session/room handles, `isInLudeo`, id counters, keymaps) — so the engine
  begins each run unpaused. The freshly-constructed `LudeoController` of
  [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md) sidesteps the *bootstrap* case but **not** the
  replay case — its `HandleGetLudeoDone` teardown + per-restore reset do.

## 4. The other overlay notifications

| Notification `[SDK]` | Handler responsibility |
| --- | --- |
| `AddNotifyReturnToMainMenu` | A **CR-007 exit**: stop tracking, `CloseRoom` `[SDK]`, load the menu scene (`SceneManager.LoadScene` `[Unity]`). Route through the façade's exit path. |
| `AddNotifyMuteRequest` | Mute/unmute game audio per `data.isMuted` (e.g. `AudioListener.volume` `[Unity]`). |
| `AddNotifyLocalizationChanged` | Apply `data.language` to the game's localization, if supported. |

## 5. Registration timing

All of the above register **once, on the `LudeoSession`, before `Activate`** — they are
session-lifetime, not per-Ludeo. The `[Layer]` `LudeoController` does this in its init-session
callback; see [`05-LIFECYCLE-MANAGEMENT.md`](../05-LIFECYCLE-MANAGEMENT.md) "Registering
notifications" and [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md) `HandleInitSessionDone`.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| Game plays under the overlay | Pause/resume not registered, or input-only pause | `AddNotifyPauseGame`/`ResumeGame` → freeze the sim (CR-011) |
| Gallery button on a consent-off run does nothing | Visibility not gated on consent | Gate on `canCreateLudeo \|\| canPlayLudeo` (CR-012) |
| Resume unfreezes a mid-restoration pause | One shared pause flag | Separate CR-010 / CR-011 flags; paused iff either set |
| Restored Ludeo loads but player can't move/act ("dead input") | A persistent-singleton pause/freeze flag left `true` by a prior playmode session keeps `timeScale = 0` | Reset all mutable runtime state at the start/bootstrap hook; never assume zero-init (§3) |
| **Second replay** (in one session) hangs / double room / suppression off | First play's run not torn down — stale pause flag (deadlock), unclosed room+session, un-reset gameplay-active | Make `HandleGetLudeoDone` re-entrant: `AbortGameplay` + `ResetBeginGate` + per-restore pause reset, new play in the teardown callback (07 §2.2) |
| Never enters create/play despite consent | `SetFlags` not wired to `AddNotifyConsentUpdated` | Feed the flow switch from the consent callback |
| Run starts but no room/overlay (no error) | `OpenRoom` fired before the first `ConsentUpdated` landed — switch still disabled, call no-ops | Record `wantCapture`; (re)fire `OpenRoom` from the consent callback once `canCreateLudeo` is true (§1) |
| "Back to menu" leaves player stuck in the Ludeo | `ReturnToMainMenu` not handled | Treat as a CR-007 exit: stop tracking + `CloseRoom` + load menu |

---

## Calls used in this doc

**`[SDK]`** (authority: [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)):
`LudeoSession.AddNotify{ConsentUpdated, LudeoSelected, PauseGame, ResumeGame, ReturnToMainMenu,
MuteRequest, LocalizationChanged}` · `LudeoSession.OpenGallery` · `LudeoRoom.CloseRoom`.

**`[Layer]`** (from [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md)):
`LudeoFlowSwitch.{SetFlags, SwitchToCreate, SwitchToPlay}` · `LudeoController.OpenLudeoGallery` ·
`LudeoController.IsEnablePlayableMoments`.

**`[Unity]`:** `Time.timeScale` · `SceneManager.LoadScene` · `AudioListener.volume` ·
`GameObject.SetActive`.
