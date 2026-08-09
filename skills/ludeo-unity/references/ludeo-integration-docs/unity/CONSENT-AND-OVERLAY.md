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
Ludeos. Subscribe to `PlayerConsentUpdated` `[SDK]` before `Activate`; it can fire more than once.

```csharp
session.PlayerConsentUpdated += data => {              // [SDK] C# event — subscribe with +=
    // data.canCreateLudeo, data.canPlayLudeo
    m_switch.SetFlags(data.canCreateLudeo, data.canPlayLudeo);   // [Layer] CR-001 + CR-012 mechanism
    galleryButton.SetActive(data.canCreateLudeo || data.canPlayLudeo);   // [Unity] hide if neither
};
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
> attempt `OpenRoom`; if the switch is still disabled, do nothing yet. Then in `PlayerConsentUpdated`,
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
- Choosing a Ludeo fires the `LudeoSelected` `[SDK]` notification → the play/restore flow
  (`GetLudeo` → restore → `OpenRoom` for the ludeo). That flow is phase 5 · task 3; here we only ensure the
  entry point exists and is consent-gated.

## 3. Pause / resume — two directions, both required (CR-011)

Pause/resume is **two separate wirings that travel in opposite directions**. A complete integration needs
both; wiring only one is the #1 mid-play failure. Do not conflate them:

| | §3.1 **Requests** (SDK → game) | §3.2 **Triggers** (game → SDK) |
| --- | --- | --- |
| Mechanism | `PauseGameRequested` / `ResumeGameRequested` `[SDK]` C# events you **subscribe** to | `SendAction("PauseLudeo")` / `("ResumeLudeo")` you **emit** |
| Direction | SDK tells the game *"freeze now"* | game tells the backend *"stop the clock"* |
| Effect | the game's simulation freezes | the **Ludeo objective timer** + event tracking stop |
| Fires / emitted in | **Player Flow, cloud only** — never in Creator Flow, and **never in a local build** | **every pause, in either flow, whatever caused it — while a gameplay session is active** |

> **The freeze does not stop the timer.** These are not alternatives and the second is not optional on any
> environment. A `PauseGameRequested` freeze only stops *your* simulation; the platform's objective timer is
> frozen server-side solely by your **tracked pause event** reaching the Studio Lab Global Trigger
> (`SendAction` → `game.events` → the trigger's `PAUSE_KEY` action → the timer freezes at that event's time).
> No emitted action, no stopped clock — on the cloud exactly as much as locally.

### 3.1 Requests: `PauseGameRequested` / `ResumeGameRequested` (SDK → game)

While the Ludeo overlay is open **during playback**, the simulation must **freeze** — not just input.
Subscribe to both (plain `Action`, no data struct) before `Activate`:

```csharp
session.PauseGameRequested  += HandlePauseRequested;   // [SDK] C# event — NOT the old AddNotifyPauseGame
session.ResumeGameRequested += HandleResumeRequested;  // [SDK] C# event

void HandlePauseRequested()  => PauseGame(showMenu: false);   // freeze AND emit the trigger — see §3.2
void HandleResumeRequested() => ResumeGame();
```
- **Freeze the sim**, e.g. `Time.timeScale = 0f` `[Unity]` (plus the game's own pause for audio /
  streaming jobs if those advance world state). Input-only pausing leaves the game playing under the
  overlay — the #1 mid-play failure.
- **The handler must ALSO emit `PauseLudeo` / `ResumeLudeo`** (§3.2). Freezing alone leaves the objective
  timer running under the overlay: the player sits in the Ludeo UI while their clock drains. Two sanctioned
  wirings — pick whichever the game's code allows:
  1. **Recommended — route through the game's freeze primitive**, the same choke point §3.2 emits from, so
     freeze and report stay in one place. ⚠️ It must be the **freeze** function (`SetPaused(bool)`,
     `GameManager.PauseGame()`), **not** the menu-showing function: opening the game's pause menu here stacks
     it under the Ludeo overlay (next bullet). If the game's only choke point also shows UI, call it with the
     menu suppressed (a parameter or a thin freeze-only wrapper).
  2. **Otherwise — emit directly from this handler**, and keep §3.2's span flag so the pause is still
     reported exactly once if a pause-state detector also observes it.
- **Emit exactly once per transition.** The one real hazard here is the mirror image: if the handler emits
  *and* calls a primitive that also emits, the pause is reported twice. Pick a single choke point (the
  primitive) and let everything funnel through it, rather than emitting at both levels.
- **Do not confuse this with the player client's own `PauseLudeo` event.** The browser overlay emits an
  internal event of that name when the player hits ESC, but it only sends a `FREEZE_GAME` command to your
  game — it is a UI-layer freeze signal, **not** the tracked event that stops the timer. That one can only
  come from your game.
- **Do not open the game's own pause menu here** — the Ludeo overlay is already on screen; the player
  would see both stacked. Stand the game's ESC handler down **while the overlay is actually up** — i.e. while
  the SDK's own pause is in effect — not for the whole play flow:
  ```csharp
  void OnEscapePressed()
  {
      if (m_ludeoOverlayPause) return;  // overlay already on screen (cloud only) — the SDK owns this pause
      OpenPauseMenu();                  // every other case, incl. the entire local build: the game's own menu (§3.2)
  }
  ```
  ⚠️ Gating on `IsInLudeoFlow` instead would be wrong: that flag is set during playback in a **local** build
  too, where no overlay exists and no request ever arrives — the player would be left unable to pause at all.
- **⚠️ These never fire in a local build, and never in Creator Flow — they are cloud Player Flow only.**
  There is no browser to intercept ESC locally, so nothing raises them. **A local build's entire pause/resume
  obligation is §3.2**: the player pauses with the game's own menu, and the game emits `PauseLudeo` /
  `ResumeLudeo` — no part of §3.1 runs, and nothing else is needed. Two consequences worth planning around:
  - **You cannot exercise or regression-test §3.1 locally at all.** Wire it from this doc and verify it on
    the cloud build; a clean local run is no evidence the handler works, or even that it runs.
  - **A broken §3.1 is invisible until the game is streamed** — which is usually late. §3.2, by contrast,
    is fully testable locally (emit the action, read the log), so test what you can and don't mistake
    "works locally" for "works".
- **Two independent flags, not one boolean.** Track the overlay pause (CR-011 — `m_ludeoOverlayPause` above)
  and the post-Ludeo-load restore freeze ([CR-010](../00-CRITICAL-REQUIREMENTS.md)) separately; the engine is
  paused iff *either* is set. One shared flag lets `ResumeGame` unfreeze a mid-restoration pause, or `RoomReady`
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

### 3.2 Triggers: `PauseLudeo` / `ResumeLudeo` (game → SDK)

Freezing the sim is invisible to the backend. **The Ludeo objective timer keeps counting down through any
pause the game hasn't reported** — so *every* pause emits the pair, no matter what caused it:

```csharp
// The game's own pause primitive — the single choke point every pause path funnels through,
// including the SDK's PauseGameRequested handler (§3.1).
void PauseGame()
{
    /* … the game's existing freeze — ALWAYS runs … */
    if (m_ludeoPauseSpanOpen) return;                    // guards the REPORT only, never the freeze
    m_ludeoPauseSpanOpen = true;
    LudeoController.Instance.SendAction(LudeoActionKeys.PauseLudeo);   // [Layer] → stops the objective timer
}

void ResumeGame()
{
    /* … the game's existing unfreeze … */
    if (!m_ludeoPauseSpanOpen) return;                   // never emit an unmatched ResumeLudeo
    m_ludeoPauseSpanOpen = false;
    LudeoController.Instance.SendAction(LudeoActionKeys.ResumeLudeo);  // on every unpause/exit path
}
```

- **The span flag guards the *report*, not the freeze.** Put the early return **after** the game's own pause
  work, never before it. `PauseGame()` is the real primitive and usually does more than set `timeScale`
  (pushes a pause source, ducks audio, halts streaming jobs, shows UI); a second pause reason arriving while
  a span is open must still get all of that — it just must not report a second `PauseLudeo`.
- **Report state is not freeze state.** One boolean cannot own both. If the game can be paused by two
  independent sources at once (its own modal *and* the Ludeo overlay), the freeze needs a **pause-source
  set/refcount** and `HandleResumeRequested` must release only the SDK's source — otherwise closing the
  overlay unfreezes a game the player still has paused behind it. This is the same "two independent flags,
  not one boolean" rule as §3.1's CR-010/CR-011 pair, applied to a third source.

- **Every pause origin emits.** The clock does not care what caused the pause:

  | Pause origin | Freeze the sim | Emit `PauseLudeo` |
  | --- | --- | --- |
  | Ludeo overlay / platform timer (`PauseGameRequested` fires — cloud only) | ✅ your handler | ✅ **yes — the freeze alone won't stop the timer** |
  | Player's ESC / pause menu (nothing fires — the SDK can't see it) | ✅ the game already does | ✅ only the game can |
  | Cutscene, dialogue box, loading screen | ✅ game's own | ✅ |
  | **Waiting to play a Ludeo / between gameplay sessions** | ✅ the game's own pause | ❌ **no session — see below** |

  Every row *inside an active gameplay session* emits; the clock does not care what caused the pause. The
  two halves fail differently, and **not on the same environments**: miss §3.1 and the overlay covers a
  still-simulating game **on the cloud only** (locally it never fires, so the bug is invisible until you
  stream); miss §3.2 and the objective timer drains through every pause, everywhere.
- **No action outside an active gameplay session.** While the player is waiting to play a Ludeo — or in any
  gap between `BeginGameplay` and `End`/`Abort` — pause the game with its **own** in-game functions and emit
  **nothing**. `SendAction` belongs to a live gameplay session. The `if (!gameplayActive) return;` bail in
  the emit path is therefore correct by design, not a missed case.
  - ⚠️ **But set the span flag from what actually got emitted, not from the attempt.** A pause can open
    *before* `BeginGameplay` lands and close after — an intro or loading freeze that starts as the session
    is coming up, or a restore that begins frozen. If you set `m_ludeoPauseSpanOpen = true` and then let the
    façade silently swallow the send, the later unpause emits a **`ResumeLudeo` with no matching
    `PauseLudeo`**. Have the emit report whether it went out, and only open the span if it did:
    ```csharp
    if (!LudeoController.Instance.TrySendAction(LudeoActionKeys.PauseLudeo)) return;  // no session — nothing to pair
    m_ludeoPauseSpanOpen = true;
    ```
    The mirror case matters too: if gameplay becomes active while the game is **already** frozen, no further
    transition occurs, so nothing is ever reported for that span. Seed the flag from the current freeze state
    when the session starts, and emit `PauseLudeo` then if it's already frozen.
- **Wire it at the game's pause primitive**, not at the ESC key — pauses reached from focus loss, a
  controller-disconnect modal, a scripted cutscene, or the SDK's own request must all emit it. One choke
  point, every path, exactly once.
- **Every `PauseLudeo` needs a reachable `ResumeLudeo` on all exit paths** — a dangling open span leaves the
  objective timer stopped for the rest of the run (mirror of the CR-007 "no dangling on `EndGameplay`" rule).
- **`PauseLudeo` is not `StartNoneLudeable`.** Both are game → SDK triggers sent the same way, but the
  platform treats them differently — pick by **what should happen to the clock**:

  | | **Non-ludeoable area** (`StartNoneLudeable`/`StopNoneLudeable`) | **Pause/resume** (`PauseLudeo`/`ResumeLudeo`) |
  | --- | --- | --- |
  | Blocks Ludeo creation in the span | ✅ | ✅ |
  | Objective timer + event tracking | **keep running** | **pause** |
  | Backend saves the span's data | ✅ | ❌ |
  | Use for | gameplay that can't be reconstructed (warmup, scoreboard, custom-physics segment) | no active gameplay at all (pause menu, cutscene, dialogue, loading screen) |

  **Both pairs must be wired in every integration** — they cover different situations, not different
  environments.
- **The names are a convention, not SDK constants — and the Studio Lab mapping is load-bearing.**
  `SendAction` takes an arbitrary string. The action becomes a timer-stopping event only once the integrator
  maps it in **Studio Lab → your environment → Global Triggers**, as the tracked event that starts/ends the
  Pause/Resume segment; the backend matches your emitted string to that trigger's `PAUSE_KEY` action and
  freezes the clock at the event's timestamp. **An unmapped string is silently ignored** — the code looks
  right, the log shows the action, and the timer keeps running. Use these names by default so the mapping is
  predictable, and record it as a human action item
  ([`6b-implement-game-actions.md`](../../6b-implement-game-actions.md) Step 6).

## 4. The other overlay notifications

| Notification `[SDK]` | Handler responsibility |
| --- | --- |
| `GameBackToMenuRequested` | A **CR-007 exit**: stop tracking, `CloseRoom` `[SDK]`, load the menu scene (`SceneManager.LoadScene` `[Unity]`). Route through the façade's exit path. |
| `MuteGameRequested` | Mute/unmute game audio per `data.isMuted` (e.g. `AudioListener.volume` `[Unity]`). |
| `LocalizationUpdated` | Apply `data.language` to the game's localization, if supported. |

## 5. Registration timing

All of the above register **once, on the `LudeoSession`, before `Activate`** — they are
session-lifetime, not per-Ludeo. The `[Layer]` `LudeoController` does this in its init-session
callback; see [`05-LIFECYCLE-MANAGEMENT.md`](../05-LIFECYCLE-MANAGEMENT.md) "Registering
notifications" and [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md) `HandleInitSessionDone`.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| Game plays under the overlay — **on the cloud, having looked fine locally** | Pause/resume **requests** not subscribed, or input-only pause. These never fire locally, so local testing cannot catch it | `PauseGameRequested`/`ResumeGameRequested` → freeze the sim (§3.1, CR-011); verify on the cloud build |
| **Objective timer keeps counting down while the game is paused** — under the cloud overlay *and* in a local pause menu | Pause/resume **triggers** never emitted — only §3.1 was wired. Freezing the sim does not stop the server-side clock | `SendAction("PauseLudeo")`/`("ResumeLudeo")` at the game's pause primitive, reached from the SDK handler too (§3.2) |
| Timer still runs even though `PauseLudeo` is in the log | The action isn't mapped to a **Pause/Resume Global Trigger** in Studio Lab, or the string doesn't match the mapping | Map it (out-of-code, §3.2 last bullet); verify the emitted string equals the configured tracked event |
| Pause reported twice / timer resumes early | Both the SDK handler *and* the pause primitive emit | Emit from **one** choke point; keep `m_ludeoPauseSpanOpen` idempotent (§3.2) |
| **Game unfreezes while the player's own pause menu is still open** | One boolean owns both the freeze and the report, so closing the overlay released a freeze the game still wanted | Track pause **sources** (set/refcount) for the freeze; `HandleResumeRequested` releases only the SDK's source. The span flag governs reporting only (§3.2) |
| Game's second pause reason is lost (audio keeps playing, streaming jobs run) | The span-flag early return sits **before** the game's freeze work in `PauseGame()` | Move the return **after** the freeze — it guards the report, never the freeze (§3.2) |
| Ludeo overlay and the game's pause menu both on screen | Game's ESC handler still opens its menu while the overlay is up | Stand the ESC handler down while the SDK's overlay pause is in effect (§3.1) |
| **Player can't pause at all while replaying a Ludeo locally** | ESC handler gated on `IsInLudeoFlow` — but locally no overlay exists and no pause request ever arrives, so nothing takes its place | Gate on the overlay-pause flag, not the flow (§3.1). Locally, pause is the game's own menu + §3.2's actions |
| Objective timer never restarts after a pause | Dangling `PauseLudeo` — an exit path skips `ResumeLudeo` | Emit `ResumeLudeo` on **every** unpause/exit path (§3.2) |
| Gallery button on a consent-off run does nothing | Visibility not gated on consent | Gate on `canCreateLudeo \|\| canPlayLudeo` (CR-012) |
| Resume unfreezes a mid-restoration pause | One shared pause flag | Separate CR-010 / CR-011 flags; paused iff either set |
| Restored Ludeo loads but player can't move/act ("dead input") | A persistent-singleton pause/freeze flag left `true` by a prior playmode session keeps `timeScale = 0` | Reset all mutable runtime state at the start/bootstrap hook; never assume zero-init (§3) |
| **Second replay** (in one session) hangs / double room / suppression off | First play's run not torn down — stale pause flag (deadlock), unclosed room+session, un-reset gameplay-active | Make `HandleGetLudeoDone` re-entrant: `AbortGameplay` + `ResetBeginGate` + per-restore pause reset, new play in the teardown callback (07 §2.2) |
| Never enters create/play despite consent | `SetFlags` not wired to `PlayerConsentUpdated` | Feed the flow switch from the consent callback |
| Run starts but no room/overlay (no error) | `OpenRoom` fired before the first `ConsentUpdated` landed — switch still disabled, call no-ops | Record `wantCapture`; (re)fire `OpenRoom` from the consent callback once `canCreateLudeo` is true (§1) |
| "Back to menu" leaves player stuck in the Ludeo | `GameBackToMenuRequested` not handled | Treat as a CR-007 exit: stop tracking + `CloseRoom` + load menu |

---

## Calls used in this doc

**`[SDK]`** (authority: [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)):
`LudeoSession` events `{PlayerConsentUpdated, LudeoSelected, PauseGameRequested, ResumeGameRequested,
GameBackToMenuRequested, MuteGameRequested, LocalizationUpdated}` · `LudeoSession.OpenGallery` ·
`LudeoRoom.CloseRoom` · `LudeoRoomWriter.SendAction` / `LudeoPlayer.SendAction`.

**`[Layer]`** (from [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md)):
`LudeoFlowSwitch.{SetFlags, SwitchToCreate, SwitchToPlay}` · `LudeoController.OpenLudeoGallery` ·
`LudeoController.IsEnablePlayableMoments` · `LudeoController.IsInLudeoFlow` · `LudeoController.SendAction` ·
`LudeoActionKeys.{PauseLudeo, ResumeLudeo, StartNoneLudeable, StopNoneLudeable}`.

**`[Unity]`:** `Time.timeScale` · `SceneManager.LoadScene` · `AudioListener.volume` ·
`GameObject.SetActive`.
