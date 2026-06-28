# Reference Architecture — the prescribed Ludeo integration layer

> **This skill is opinionated.** Use this layer. It is the proven shape from the
> `ludeosdk-unity-game-tank` sample, distilled to be game-agnostic. The code blocks below are the
> canonical version to reproduce in the game's project (adapting names/fields to the game); the
> **full compiling source** lives in the tank sample under `Assets/Scripts/LudeoScripts/`.
>
> **Keep in sync with the tank sample at the pinned SDK version** (see
> [`12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)). Signatures used here come from that doc.
>
> **Opt-out:** if a game already has a strong session/manager architecture, you may map the same
> responsibilities onto it — but keep the component boundaries, the dummy/disabled wiring (CR-001),
> the consent gating (CR-012), and the notification registration intact. See "Adapting" at the end.

> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)) · `[Layer]` = a helper from this layer ·
> `[Unity]` = engine API. **Every class defined in this doc *is* a `[Layer]` helper** (the SDK does
> not define them — rename freely); the `[SDK]` and `[Unity]` calls *inside* them are tagged inline,
> and grouped in the "Calls used in this doc" table at the end.

---

## Why a layer (don't scatter SDK calls)

A handful of game-owned classes wrap the SDK so the rest of the game touches **one façade**
(`LudeoController`) and never the raw SDK. This gives you: a single place for the session lifecycle,
a clean on/off switch (dummy implementations for CR-001), consent gating (CR-012), and a uniform
per-object tracking contract. Scattering `LudeoSDK` calls across gameplay code makes CR-007 (all
exit paths) and CR-001 (disabled build) nearly impossible to satisfy.

## Components

| Class | Responsibility |
| --- | --- |
| `LudeoController` | **Façade.** The only type the game calls. Owns session init/activate, notification registration, and routes begin/end/abort/track/action through the flow switch. |
| `LudeoIntegrationData` | Shared mutable state: session, room, gameplay session, ids, flags, restored data, cancellation token, `OpenRoomData` factories. |
| `LudeoFlowSwitch` | Selects the active `ILudeoFlow` (Creator/Play/Disabled) and `ILudeoGameplaySessionManager` (real/dummy) from consent + create-vs-play. **This is the CR-001 + CR-012 mechanism.** |
| `ILudeoFlow` → `LudeoCreatorFlow` / `LudeoPlayFlow` / `DisabledLudeoFlow` | Room open + add-player; creator stores game definitions; play restores by objectType bucket. |
| `LudeoInitRoomHandler` | The `OpenRoom` → `AddGamePlayer` callback chain (CR-009). |
| `ILudeoGameplaySessionManager` → real + `Dummy…` | Begin/End/Abort, `SendAction`, the tracked-handler registry, `UpdateStateObjects`. |
| `ILudeoStateHandler` → `DefaultLudeoStateHandler` | Per-object capture: holds a `LudeoStateObject` + an `OnStateDataUpdate` callback; writes attributes each tick. |
| `LudeoKeys` / `LudeoActionKeys` | String constants for objectTypes, attribute names, and actions (ideally generated — see `06-TRACKING-PATTERNS.md`). |

```
Game code ──► LudeoController (façade)
                 ├─ LudeoIntegrationData        (shared state)
                 ├─ LudeoFlowSwitch             (consent + create/play → real or dummy)
                 │    ├─ ILudeoFlow             Creator | Play | Disabled
                 │    └─ ILudeoGameplaySessionManager  real | Dummy
                 │          └─ List<ILudeoStateHandler>  (per tracked object)
                 └─ LudeoSession.AddNotify*      (lifecycle notifications)
```

---

## CR-001 + CR-012 in one place: the flow switch

`LudeoFlowSwitch` is how the integration turns on/off. It defaults to **Disabled + Dummy**, enables
only when consent allows, and picks Creator vs Play. Because the game always talks to the
interfaces, a disabled/consent-revoked SDK is a set of no-ops — the game plays normally (CR-001).

```csharp
public class LudeoFlowSwitch
{
    public ILudeoFlow LudeoFlow { get; private set; }
    public ILudeoGameplaySessionManager LudeoGameplay { get; private set; }
    public bool IsTrackingEnabled { get; private set; }

    private readonly ILudeoFlow m_create, m_play, m_disabled;
    private readonly ILudeoGameplaySessionManager m_real, m_dummy;
    private readonly LudeoIntegrationData m_data;
    private bool m_canCreate, m_canPlay;

    public LudeoFlowSwitch(LudeoIntegrationData data)
    {
        m_data = data;
        m_disabled = new DisabledLudeoFlow();
        m_create   = new LudeoCreatorFlow(data);   // inject shared state at CONSTRUCTION (not lazily in InitRoom)
        m_play     = new LudeoPlayFlow(data);      // so restore-reads fired before InitRoom don't NRE (see HandleGetLudeoDone)
        m_real     = new LudeoGameplaySessionManager(data);
        m_dummy    = new DummyLudeoGameplaySessionManager();
        LudeoFlow = m_disabled;   // safe defaults until consent + flow are known
        LudeoGameplay = m_dummy;
    }

    public void SetFlags(bool canCreate, bool canPlay)   // from AddNotifyConsentUpdated (CR-012)
    {
        m_canCreate = canCreate; m_canPlay = canPlay;
        if (!canCreate && !canPlay) Disable(); else Enable();
    }

    public bool SwitchToCreate() { m_data.isInLudeo = false; if (m_canCreate) { LudeoFlow = m_create; Enable(); } else Disable(); return m_canCreate; }
    public bool SwitchToPlay()   { m_data.isInLudeo = true;  if (m_canPlay)   { LudeoFlow = m_play;   Enable(); } else Disable(); return m_canPlay; }

    public void Enable()  { LudeoGameplay = m_real;  IsTrackingEnabled = true;  }
    public void Disable() { LudeoGameplay = m_dummy; IsTrackingEnabled = false; LudeoFlow = m_disabled; }
}
```

> The package is auto-referenced once installed, so this compiles without any define. Disabling is
> **runtime**: consent-off / uninitialized → the switch serves the dummy/disabled impls and the game
> runs normally (CR-001). A `#if LUDEO_SDK` guard is only needed if you must ship a build that
> excludes the SDK package entirely — then provide fallback types in the `#else`.

---

## Shared state: `LudeoIntegrationData`

```csharp
public class LudeoIntegrationData
{
    public bool isGameplayActive, isInLudeo, isDisplayPlayableMoment;
    public LudeoSession ludeoSession;
    public LudeoRoom ludeoRoom;
    public LudeoGameplaySession ludeoGameplaySession;
    public string gamePlayerId, ludeoPlayerId, roomId;
    public Guid ludeoId = default;
    public LudeoTrackedDefinitions ludeoTrackedDefinitions;   // game-defined "level config" DTO
    public LudeoRestoredData ludeoRestoredData;               // restore buckets (see 07)
    public CancellationTokenSource cancellationTokenSource;

    // Creator room takes a game-chosen roomId. There is NO parameterless LudeoOpenRoomData ctor — the
    // ctors are (string roomId), (Guid ludeoId), (string roomId, Guid ludeoId). Generate a roomId when
    // the game doesn't supply one.
    public LudeoOpenRoomData CreateOpenRoomDataForCreator(string roomId = null)
        => new LudeoOpenRoomData(roomId ?? Guid.NewGuid().ToString("N"));
    public LudeoOpenRoomData CreateOpenRoomDataForLudeo(string roomId = null)
        => roomId == null ? new LudeoOpenRoomData(ludeoId) : new LudeoOpenRoomData(roomId, ludeoId);

    public void CreateNewCancelationToken()
    {
        cancellationTokenSource?.Cancel();
        cancellationTokenSource = new CancellationTokenSource();
    }
}
```

---

## The façade: `LudeoController` (skeleton)

Created once at app init (e.g. a bootstrap MonoBehaviour in the init scene). It kicks off
`InitLudeoSession`, registers **all** notifications before `Activate` (CR-003/011/012), and exposes
a small game-facing API. Game-specific callbacks are passed in as delegates so the controller stays
engine-agnostic.

> **Constructing it fresh each bootstrap (as here) zeroes its runtime fields for free.** If you instead
> back the layer with a **persistent singleton** — a `ScriptableObject` service, a `DontDestroyOnLoad`
> MonoBehaviour, or `static` state (common when adapting to an existing game's service pattern) — those
> fields **survive across Editor playmode sessions** *and across replays within one session*, and are
> *not* re-zeroed on a fresh play. Add an explicit `Reset()`/start hook that clears every mutable field
> (pause/freeze flags, `isInLudeo`, cached session/room handles, id counters, keymaps) at lifecycle start.
> The highest-stakes case is a stale pause flag silently holding `timeScale = 0` after restore. **A bootstrap
> reset is necessary but NOT sufficient** — a second replay in the same session re-enters restore without
> re-running bootstrap and inherits the first play's flags, so the play-flow teardown above (`AbortGameplay`
> → `ResetBeginGate`) and the per-restore pause reset in `onBeginRestore` carry the load on replay. See
> [`CONSENT-AND-OVERLAY.md`](./CONSENT-AND-OVERLAY.md) §3 and [`../07-RESTORATION-PATTERNS.md`](../07-RESTORATION-PATTERNS.md) §2.2/§10.3.

```csharp
public class LudeoController
{
    public static LudeoController Instance { get; private set; }
    public bool IsInLudeoFlow => m_data.isInLudeo;
    public bool IsEnablePlayableMoments => m_data.isDisplayPlayableMoment;

    private readonly LudeoIntegrationData m_data = new LudeoIntegrationData();
    private readonly LudeoFlowSwitch m_switch;
    // game-supplied hooks:
    private readonly Action<bool> m_onInitDone;       // arg: starting in Ludeo (play) flow?
    private readonly Action m_onBeginRestore;         // fires at Ludeo-SELECTION, before the room opens (see HandleGetLudeoDone)
    private readonly Action m_onRoomReady, m_onStopGame, m_onExitToMainMenu;
    private readonly Action<Action> m_activateWhenReady;   // implicit-auth gate: game fires the supplied Activate once Steam is ready (null = activate inline)
    private bool m_gameplayStarted;
    private bool m_roomReady;              // leg 1 of the begin gate (see HandleRoomReady)
    private bool m_sceneReadyForRestore;   // leg 3 (restore only): the gameplay scene the apply writes into has finished loading

    public LudeoController(Action<bool> onInitDone, Action onRoomReady,
                           Action onStopGame, Action onExitToMainMenu,
                           Action onBeginRestore = null, Action<Action> activateWhenReady = null)
    {
        Instance = this;
        m_onInitDone = onInitDone; m_onRoomReady = onRoomReady;
        m_onStopGame = onStopGame; m_onExitToMainMenu = onExitToMainMenu;
        m_onBeginRestore = onBeginRestore;   // restore-only; null in create-only games
        m_activateWhenReady = activateWhenReady;   // implicit-auth (Steam) gate; null → Activate inline (explicit / cloud / Steam already up)
        m_switch = new LudeoFlowSwitch(m_data);
        LudeoManager.InitLudeoSession(HandleInitSessionDone);
    }

    // ── game-facing API ──────────────────────────────────────────────
    public void SetGameplayerId(string id) => m_data.gamePlayerId = id;
    public void OpenLudeoGallery() => m_data.ludeoSession?.OpenGallery();

    public ILudeoStateHandler StartTrackingLudeoState<T>(string objectType, Action<LudeoStateObject> onUpdate)
        where T : ILudeoStateHandler, new()
        => m_switch.LudeoGameplay.StartTrackingLudeoState(new T(), objectType, onUpdate);
    public void StopTrackingLudeoState(ILudeoStateHandler handler)   // per-object despawn (session end uses StopTrackingAll via EndGameplay)
        => m_switch.LudeoGameplay.StopTrackingLudeoState(handler);
    // Restore-facing façade methods (play flow) — GetAndRestoreLudeoStateOfObject / RestoreLudeoStateOfObject /
    // TryGetAllLudeoStateObjectByType / GetLudeoTrackedDefinitions — live in 07-RESTORATION-PATTERNS.md §3.

    public void UpdateStateObjects() => m_switch.LudeoGameplay.UpdateStateObjects();   // call each active-gameplay frame (CR-005)
    public void SendAction(string action) { if (m_data.isGameplayActive) m_switch.LudeoGameplay.SendAction(action); }

    public void BeginGameplay(Action onBegun)
    { m_switch.LudeoGameplay.BeginGameplay(onBegun); m_data.isGameplayActive = true; m_gameplayStarted = true; }

    public void EndGameplay(Action onDone)   // CR-007: route every normal exit here
    {
        if (!m_gameplayStarted) { onDone?.Invoke(); return; }
        m_gameplayStarted = false; m_data.isGameplayActive = false;
        m_switch.LudeoGameplay.StopTrackingAllLudeoStates();
        m_switch.LudeoGameplay.EndGameplay(onDone);
    }
    public void AbortGameplay(Action onDone)   // CR-007: restart / quit-to-menu / play-flow re-entry teardown (07 §2.2)
    {
        if (!m_gameplayStarted && m_data.ludeoRoom == null) { onDone?.Invoke(); return; }
        m_gameplayStarted = false; m_data.isGameplayActive = false;     // reset the suppression-gating flags
        m_switch.LudeoGameplay.StopTrackingAllLudeoStates();
        m_switch.LudeoGameplay.AbortGameplay(() =>                      // Abort the SESSION, THEN close the room…
            m_data.ludeoRoom.CloseRoom(_ => { m_data.ludeoRoom = null; onDone?.Invoke(); }));  // …then run onDone
    }

    // CR-007 + Editor re-init. YOU OWN `m_data.ludeoSession`: it is `IDisposable`, handed to you by
    // InitLudeoSession, and you must Dispose() it on shutdown. The plugin disposes the room / reader /
    // state-objects internally, but NOT the session you hold (12 §7). A missed Dispose is MASKED in a
    // built player (the process exits anyway), so a smoke test passes — but in the Editor the static
    // LudeoManager + native session survive across Play sessions, so the 2nd InitLudeoSession finds a
    // still-held handle, logs `Core:Error Client still holding a handle to a Session instance`, and
    // returns WrongState. First Play looks fine; every later Play is dead until you restart the Editor.
    // Wire Shutdown() to OnApplicationQuit (which also fires when you Stop playmode in the Editor).
    public void Shutdown()
    {
        EndGameplay(null);                                   // CR-007: best-effort finalize any live run (async; may not round-trip on quit)
        try { m_data.ludeoSession?.Dispose(); } catch { /* teardown — swallow */ }   // [SDK] release the owned session
        m_data.ludeoSession = null;
        Instance = null;                                     // re-arm for a clean re-init within the same Editor process
    }

    // Re-arm the three begin-gate legs so a flag left set by the PRIOR run can't fire Begin on the new,
    // not-yet-ready session (the multi-replay "Begin on a stale session" failure, 07 §2.2).
    private void ResetBeginGate()
    { m_roomReady = false; m_sceneReadyForRestore = false; m_data.ludeoGameplaySession = null; }

    // ── lifecycle ────────────────────────────────────────────────────
    private void HandleInitSessionDone(LudeoSessionInitCallbackData data)
    {
        if (data.resultCode != LudeoResult.Success) { Debug.LogError($"Ludeo init: {data.resultCode}"); return; }
        m_data.ludeoSession = data.ludeoSession;

        // Register ALL notifications BEFORE Activate (CR-011/012):
        var s = m_data.ludeoSession;
        s.AddNotifyLudeoSelected(HandleLudeoSelected);
        s.AddNotifyRoomReady(HandleRoomReady);
        s.AddNotifyConsentUpdated(HandleConsentUpdated);   // CR-012
        s.AddNotifyPauseGame(() => m_onStopGame?.Invoke()); // CR-011 (Time.timeScale = 0 in the game)
        s.AddNotifyResumeGame(() => { /* resume */ });      // CR-011
        s.AddNotifyReturnToMainMenu(HandleReturnToMainMenu);// CR-007 exit path
        s.AddNotifyMuteRequest(d => { /* mute audio = d.isMuted */ });
        s.AddNotifyLocalizationChanged(d => { /* set language = d.language */ });

        // Activate authenticates, and auth resolves HERE (not at init). With implicit auth
        // (runWithoutLauncher = false, the Steam default) the SDK auto-detects Steam but does NOT init
        // it — Steam must already be running or Activate's callback returns InvalidAuth. Steam usually
        // comes up LATE/async (e.g. a login scene) while this controller bootstraps EARLY, so calling
        // Activate inline here races ahead of Steam. The game injects an optional auth-ready gate so it
        // can defer Activate until Steam is up; the controller itself holds NO Steam dependency. No gate
        // (explicit auth / cloud token / Steam already up) → Activate inline. See "Implicit auth: gate
        // Activate on Steam-ready" below and UPM-INSTALL-AND-DEFINES.md §3.
        if (m_activateWhenReady != null) m_activateWhenReady(() => s.Activate(HandleActivateDone));
        else s.Activate(HandleActivateDone);
    }

    private void HandleActivateDone(LudeoSessionActivateCallbackData data)
    {
        if (data.resultCode != LudeoResult.Success)   // e.g. InvalidAuth when Steam wasn't initialized
        {
            // Non-fatal: let the game continue WITHOUT Ludeo rather than blocking the player.
            Debug.LogWarning($"Ludeo activate: {data.resultCode}; continuing without Ludeo.");
            m_onInitDone(isStartingInLudeoFlow: false);
            return;
        }
        m_data.isInLudeo = data.isLudeoSelected;
        // If isLudeoSelected, a LudeoSelected notification is guaranteed to follow → play flow.
        m_onInitDone(isStartingInLudeoFlow: data.isLudeoSelected);
    }

    private void HandleConsentUpdated(LudeoSessionConsentUpdatedCallbackData data)   // CR-012
    {
        m_switch.SetFlags(data.canCreateLudeo, data.canPlayLudeo);
        m_data.isDisplayPlayableMoment = data.canCreateLudeo || data.canPlayLudeo;   // gate gallery button
    }

    // RoomReady (a notification) and the AddGamePlayer callback are INDEPENDENT async events with NO
    // ordering guarantee — RoomReady can arrive before AddGamePlayer's callback has stored the gameplay
    // session. Begin must wait for BOTH (CR-009). Each path records its half and calls the gate;
    // whichever finishes last triggers the begin sequence.
    private void HandleRoomReady(LudeoSessionRoomReadyCallbackData data)
    {
        m_data.cancellationTokenSource?.Cancel();
        m_roomReady = true;
        TryBeginAfterRoomReady();
    }

    // Called by LudeoInitRoomHandler once AddGamePlayer has stored data.ludeoGameplaySession.
    public void NotifyPlayerAdded() => TryBeginAfterRoomReady();

    // Called by the game's scene loader once the gameplay scene the restore applies into has FINISHED
    // loading. RoomReady is independent of SceneManager — the SDK room chain knows nothing about your
    // scene load, so this is a real third leg, not a guaranteed-by-RoomReady fact. An async-void scene
    // loader has no completion signal; add an awaitable/event and call this from it (BL-2).
    public void NotifySceneReadyForRestore() { m_sceneReadyForRestore = true; TryBeginAfterRoomReady(); }

    private void TryBeginAfterRoomReady()
    {
        if (!m_roomReady || m_data.ludeoGameplaySession == null) return;   // legs 1+2: RoomReady AND AddGamePlayer (CR-009)
        if (m_data.isInLudeo && !m_sceneReadyForRestore) return;           // leg 3 (restore only): scene the apply writes into is loaded
        m_roomReady = false;                                               // begin exactly once per run
        m_onRoomReady();   // game: CR-010 → apply state → unfreeze → BeginGameplay (order per 07 §10.1)
    }

    private void HandleLudeoSelected(LudeoSelectedCallbackData data)   // play flow entry
    {
        m_data.ludeoId = data.ludeoId;
        m_data.ludeoSession.GetLudeo(data.ludeoId, HandleGetLudeoDone);
    }

    private void HandleGetLudeoDone(LudeoGetLudeoCallbackData data)
    {
        if (data.resultCode != LudeoResult.Success) { Debug.LogError($"GetLudeo: {data.resultCode}"); return; }
        m_data.ludeoPlayerId = data.ludeoDataReader.PlayerId;

        // RE-ENTRANCY (07 §2.2) — a run may ALREADY be live here: a capture in progress, OR (the common
        // miss) a PREVIOUS replay the player just exited by picking a second Ludeo from the overlay without
        // quitting. Tear the prior run down COMPLETELY first — AbortGameplay() aborts the session, stops
        // tracking, closes the room, and resets isGameplayActive/m_gameplayStarted — and start the new run
        // ONLY in its callback. Abort/CloseRoom are async: opening a room synchronously after issuing them
        // stacks a second room over a live one. Skipping this is the multi-replay bug — hang, double room,
        // and suppression silently off (07 §2.2). Extract the buckets first; the callback closes over `data`.
        if (m_gameplayStarted || m_data.ludeoRoom != null) AbortGameplay(StartPlayFromSelectedLudeo);
        else                                               StartPlayFromSelectedLudeo();

        void StartPlayFromSelectedLudeo()
        {
            ResetBeginGate();              // re-arm m_roomReady / m_sceneReadyForRestore / ludeoGameplaySession
            if (!m_switch.SwitchToPlay()) return;   // consent-gated
            // Extract restore buckets now; apply later on RoomReady (CR-010).
            m_data.ludeoRestoredData = new LudeoRestoredData(m_data.ludeoId, data.ludeoDataReader, out bool ok);
            if (!ok) return;

            // SELECTION-TIME hook — fires here, BEFORE the room opens. The room chain only yields the
            // world id at RoomReady, which is too late to start an async scene load; the game must begin
            // loading the restore scene (and suppress intros) NOW. onInitDone is session-boot only;
            // onRoomReady is too late. The game's loader calls NotifySceneReadyForRestore() when done (BL-1).
            // It ALSO resets both pause flags to an unfrozen baseline (07 §10.3): a prior play's overlay /
            // Ludeo-done PauseGame is inherited within ONE session — bootstrap does not re-run on replay.
            m_onBeginRestore?.Invoke();    // may read restore buckets — safe because the play flow
                                           // received m_data at CONSTRUCTION, not lazily in InitRoom

            m_switch.LudeoFlow.InitRoom(m_data);     // OpenRoom (for play) → AddGamePlayer → RoomReady
        }
    }

    private void HandleReturnToMainMenu() { /* CR-007: stop tracking + CloseRoom → m_onExitToMainMenu */ }
}
```

> **⚠️ RoomReady vs AddGamePlayer is a race (CR-009) — gate `Begin` on both.** They are independent
> async events; which one finishes first varies between runs, machines, and backends. The skeleton
> records each half (`m_roomReady`, and the session stored by `HandleAddPlayer` → `NotifyPlayerAdded`)
> and begins only when both are present. **Do not collapse this back to "Begin straight from
> RoomReady"** — when RoomReady wins the race the session is still null and the run records *nothing*
> (a silent failure that passes a smoke test, because the first run often wins the other way).
> Alternatively, fetch the session from the room inside `HandleRoomReady` via
> `LudeoRoom.GetGamePlaySession(gamePlayerId, out session)` instead of caching it from the callback.
>
> The tank's `LudeoController` additionally wraps these callbacks in a **timeout** — that is what the
> `cancellationTokenSource` exists for: cancel the timer when a callback arrives, and surface a failure
> if one never does. It also adds a creator-room init path and game-specific definition storage.
> Reproduce those as the game needs; the begin-gate above is part of the required spine.

> **⚠️ For restore, the begin gate is THREE legs, not two — and the scene load needs its own hook.**
> RoomReady has nothing to do with `SceneManager`: the SDK room chain
> (`OpenRoom → AddGamePlayer → RoomReady`) can complete while the gameplay scene the apply writes into is
> still loading. Applying then writes into an **empty scene** (BL-2). So the restore gate is `RoomReady ∧
> AddGamePlayer ∧ sceneLoaded` — the game signals the third leg via `NotifySceneReadyForRestore()`, which
> almost always means **adding an awaitable/completion event to a scene loader that was `async void`**. And
> the scene load must *start* before the room opens, so it's kicked from the **`onBeginRestore`
> selection-time hook** (in `HandleGetLudeoDone`, before `InitRoom`) — `onInitDone` is session-boot, `onRoomReady`
> is too late. Because that hook (and `OnBeginRestore`-style game code) can read restore buckets *before*
> `InitRoom` runs, the **flows receive `m_data` at construction** (`LudeoFlowSwitch` ctor) — a
> lazy-assign-in-`InitRoom` makes the first restore-read a latent `NullReferenceException` (the original
> "old ludeo" crash, BL/A-1).

---

## Implicit auth: gate `Activate` on Steam-ready (don't call it inline)

Implicit (Steam) auth is a **code-ordering** problem, not just the `runWithoutLauncher` toggle. Auth
resolves at `Activate`, and the SDK does **not** initialize Steam — so Steam must be up *first*. But the
controller bootstraps **early** (a bootstrap `Awake` / base scene) while Steam typically initializes
**late and async** (a login scene, via a Steam wrapper). Calling `Activate` inline in
`HandleInitSessionDone` therefore races ahead of Steam → the callback returns `InvalidAuth`.

The fix is the injected `activateWhenReady` gate above: the **game** decides when auth is ready and
fires the supplied `Activate`; the controller stays Steam-agnostic. The gate is **bounded** — on
timeout it activates anyway (and logs) so a no-Steam machine is never blocked forever.

```csharp
// GAME bootstrap — owns Steam; the controller does not. Pass a gate ONLY when implicit/Steam auth is in
// play; otherwise pass null so Activate fires inline. The Steam-wrapper defines are ILLUSTRATIVE — use
// whatever your project / wrapper (Steamworks.NET, Facepunch, …) actually defines.
#if STEAMWORKS_NET && !STEAMWORKS_OFF        // real player-facing Steam build
    Action<Action> authGate = activate => CoroutineRunner.Start(ActivateWhenSteamReady(activate));
#else                                        // cloud token build / no Steam compiled in
    Action<Action> authGate = null;          // nothing to wait for — Activate immediately
#endif
    m_controller = new LudeoController(onInitDone, onRoomReady, onStopGame, onExitToMainMenu,
                                       onBeginRestore, authGate);

#if STEAMWORKS_NET && !STEAMWORKS_OFF
IEnumerator ActivateWhenSteamReady(Action activate)
{
    // Explicit auth (a launcherUserId, incl. a LUDEO_DEV runtime override) needs no Steam — go now.
    var settings = Resources.Load<LudeoSettings>("LudeoSettings");
    if (settings != null && settings.runWithoutLauncher) { activate(); yield break; }

    float deadline = Time.realtimeSinceStartup + AUTH_READY_TIMEOUT_SECONDS;   // e.g. 15s
    EnsureSteamInitialized();   // MUST be idempotent — Steam may already be up; don't double-init / re-register listeners
    while (!SteamApiIsReady() && Time.realtimeSinceStartup < deadline) yield return null;
    if (!SteamApiIsReady())
        Debug.LogError("[Ludeo] Steam not ready before timeout; activating anyway — implicit auth will " +
                       "likely return InvalidAuth. See UPM-INSTALL-AND-DEFINES.md §3 / READING-UNITY-LOGS.md.");
    activate();   // fire Activate EXACTLY ONCE, ready or timed-out — never leave the game unauthenticated forever
}
#endif
```

- **Cloud / no-Steam builds pass `null`** (or take the `#else`) and `Activate` immediately — the cloud
  supplies the token. The three auth modes (implicit/Steam, explicit/`launcherUserId`, cloud-token), the
  conditional-compilation axis, and why implicit auth **can't be validated from a cloud build** are in
  [`UPM-INSTALL-AND-DEFINES.md §4`](./UPM-INSTALL-AND-DEFINES.md).
- **Editor caveat:** the Editor can confirm auth **succeeds**, but capture won't (the recorder needs a
  real player window) — "implicit auth works" and "capture works locally" are separate verifications.

---

## Flows: `ILudeoFlow` (open room + add player; restore)

```csharp
public interface ILudeoFlow
{
    void InitRoom(LudeoIntegrationData data);
    void StoreGameDefinitions(LudeoRoom room, LudeoTrackedDefinitions defs);
    void RestoreLudeoStateOfObject(string objectType, Action<LudeoStateObjectRestore> onRestore);
    bool TryGetAllLudeoStateObjectByType(string objectType, out List<LudeoStateObjectRestore> states);
}

// The OpenRoom → AddGamePlayer chain (CR-009): never call AddGamePlayer from a game event.
public class LudeoInitRoomHandler
{
    private readonly LudeoIntegrationData m_data;
    public LudeoInitRoomHandler(LudeoIntegrationData data) => m_data = data;

    public void HandleRoomOpened(LudeoOpenRoomCallbackData data)
    {
        if (data.resultCode != LudeoResult.Success) { /* fail */ return; }
        m_data.ludeoRoom = data.ludeoRoom;
        string playerId = m_data.isInLudeo ? m_data.ludeoPlayerId : m_data.gamePlayerId;
        m_data.ludeoRoom.AddGamePlayer(new LudeoRoomAddGamePlayerData(playerId), HandleAddPlayer);
    }
    public void HandleAddPlayer(LudeoRoomAddGamePlayerCallbackData data)
    {
        m_data.cancellationTokenSource?.Cancel();
        if (data.resultCode != LudeoResult.Success) { /* fail */ return; }
        m_data.ludeoGameplaySession = data.ludeoGameplaySession;
        // RoomReady may have ALREADY fired (the two race). Signal the controller so Begin happens once
        // both this callback and RoomReady are done. Never call Begin straight from here (CR-009).
        LudeoController.Instance?.NotifyPlayerAdded();
    }
}

public class LudeoCreatorFlow : ILudeoFlow   // capture
{
    private readonly LudeoIntegrationData m_data;
    public LudeoCreatorFlow(LudeoIntegrationData data) => m_data = data;   // construction injection
    public void InitRoom(LudeoIntegrationData data)
    {
        var h = new LudeoInitRoomHandler(m_data);
        m_data.ludeoSession.OpenRoom(m_data.CreateOpenRoomDataForCreator(), h.HandleRoomOpened);
    }
    public void StoreGameDefinitions(LudeoRoom room, LudeoTrackedDefinitions defs) { /* capture level/config as a state object */ }
    public void RestoreLudeoStateOfObject(string t, Action<LudeoStateObjectRestore> cb) { }     // no-op in create
    public bool TryGetAllLudeoStateObjectByType(string t, out List<LudeoStateObjectRestore> s) { s = null; return false; }
}

public class LudeoPlayFlow : ILudeoFlow   // restore (see 07)
{
    private readonly LudeoIntegrationData m_data;
    public LudeoPlayFlow(LudeoIntegrationData data) => m_data = data;   // construction injection — see below
    public void InitRoom(LudeoIntegrationData data)
    {
        var h = new LudeoInitRoomHandler(m_data);
        m_data.ludeoSession.OpenRoom(m_data.CreateOpenRoomDataForLudeo(), h.HandleRoomOpened);   // includes ludeoId
    }
    public void StoreGameDefinitions(LudeoRoom room, LudeoTrackedDefinitions defs) { }
    public void RestoreLudeoStateOfObject(string type, Action<LudeoStateObjectRestore> onRestore)
    {
        if (m_data.ludeoRestoredData.LudeoStateObjectsLookup.TryGetValue(type, out var list))
            onRestore(list[0]);   // singleton; collections use TryGetAllLudeoStateObjectByType
    }
    public bool TryGetAllLudeoStateObjectByType(string type, out List<LudeoStateObjectRestore> states)
        => m_data.ludeoRestoredData.LudeoStateObjectsLookup.TryGetValue(type, out states);
}

public class DisabledLudeoFlow : ILudeoFlow   // all no-ops (CR-001)
{
    public void InitRoom(LudeoIntegrationData d) { }
    public void StoreGameDefinitions(LudeoRoom r, LudeoTrackedDefinitions d) { }
    public void RestoreLudeoStateOfObject(string t, Action<LudeoStateObjectRestore> cb) { }
    public bool TryGetAllLudeoStateObjectByType(string t, out List<LudeoStateObjectRestore> s) { s = null; return false; }
}
```

---

## Gameplay session + tracking registry: `ILudeoGameplaySessionManager`

```csharp
public interface ILudeoGameplaySessionManager
{
    void BeginGameplay(Action onReady);
    void EndGameplay(Action onDone);
    void AbortGameplay(Action onDone);
    void SendAction(string action);
    ILudeoStateHandler StartTrackingLudeoState(ILudeoStateHandler handler, string objectType, Action<LudeoStateObject> onUpdate);
    void StopTrackingLudeoState(ILudeoStateHandler handler);
    void StopTrackingAllLudeoStates();
    void UpdateStateObjects();
}

public class LudeoGameplaySessionManager : ILudeoGameplaySessionManager
{
    private readonly LudeoIntegrationData m_data;
    private readonly List<ILudeoStateHandler> m_tracked = new List<ILudeoStateHandler>();
    public LudeoGameplaySessionManager(LudeoIntegrationData data) => m_data = data;

    public void BeginGameplay(Action onReady)
    {
        // Defensive: with the begin-gate (HandleRoomReady/NotifyPlayerAdded) the session is non-null
        // here, but never call Begin on a null session — that's the silent-NRE failure of the race.
        if (m_data.ludeoGameplaySession == null) { Debug.LogError("[Ludeo] BeginGameplay: no gameplay session"); return; }
        m_data.ludeoGameplaySession.Begin(d => { if (d.resultCode == LudeoResult.Success) onReady(); });
    }
    public void EndGameplay(Action onDone)
        => m_data.ludeoGameplaySession.End(d => m_data.ludeoRoom.CloseRoom(_ => { m_data.ludeoRoom = null; onDone?.Invoke(); }));
    public void AbortGameplay(Action onDone)
        => m_data.ludeoGameplaySession.Abort(_ => onDone?.Invoke());
    public void SendAction(string action) => m_data.ludeoGameplaySession.SendAction(action);

    public ILudeoStateHandler StartTrackingLudeoState(ILudeoStateHandler handler, string objectType, Action<LudeoStateObject> onUpdate)
    {
        if (m_data.ludeoRoom.CreateStateObject(objectType, out LudeoStateObject obj) != LudeoResult.Success) return null;
        handler.SetLudeoStateObjectForUpdate(obj, onUpdate);
        m_tracked.Add(handler);
        return handler;
    }
    public void StopTrackingLudeoState(ILudeoStateHandler h) { h.DestroyLudeoState(); m_tracked.Remove(h); }
    public void StopTrackingAllLudeoStates() { foreach (var h in m_tracked) h.DestroyLudeoState(); m_tracked.Clear(); }
    public void UpdateStateObjects() { for (int i = 0; i < m_tracked.Count; ++i) m_tracked[i].UpdateLudeoState(); }
}

public class DummyLudeoGameplaySessionManager : ILudeoGameplaySessionManager   // CR-001 disabled path
{
    public void BeginGameplay(Action onReady) => onReady?.Invoke();
    public void EndGameplay(Action onDone) => onDone?.Invoke();
    public void AbortGameplay(Action onDone) => onDone?.Invoke();
    public void SendAction(string a) { }
    public ILudeoStateHandler StartTrackingLudeoState(ILudeoStateHandler h, string t, Action<LudeoStateObject> u) => null;
    public void StopTrackingLudeoState(ILudeoStateHandler h) { }
    public void StopTrackingAllLudeoStates() { }
    public void UpdateStateObjects() { }
}
```

---

## Per-object capture: `ILudeoStateHandler`

```csharp
public interface ILudeoStateHandler
{
    LudeoStateObject StateObject { get; }
    Action<LudeoStateObject> OnStateDataUpdate { get; }
    void SetLudeoStateObjectForUpdate(LudeoStateObject stateObject, Action<LudeoStateObject> onUpdate);
    void UpdateLudeoState();
    void DestroyLudeoState();
}

public class DefaultLudeoStateHandler : ILudeoStateHandler
{
    public LudeoStateObject StateObject { get; private set; }
    public Action<LudeoStateObject> OnStateDataUpdate { get; private set; }
    private bool m_destroyed;

    public void SetLudeoStateObjectForUpdate(LudeoStateObject o, Action<LudeoStateObject> u) { StateObject = o; OnStateDataUpdate = u; }
    public void UpdateLudeoState() => OnStateDataUpdate(StateObject);   // writes SetAttribute(...) for this object
    public void DestroyLudeoState() { if (!m_destroyed) m_destroyed = StateObject.DestroyStateObject() == LudeoResult.Success; }
}
```

The game registers a handler per tracked entity and supplies the per-tick writer:
```csharp
LudeoController.Instance.StartTrackingLudeoState<DefaultLudeoStateHandler>(
    LudeoPlayerKeys.OBJECT_NAME,
    obj => {
        obj.SetAttribute(LudeoPlayerKeys.HP, hp);
        obj.SetAttribute(LudeoPlayerKeys.Position, transform.position);
        obj.SetAttribute(LudeoPlayerKeys.Rotation, transform.rotation);
    });
```

---

## Keys: `LudeoKeys` / `LudeoActionKeys`

Plain constant classes — one per tracked objectType plus an actions class. `OBJECT_NAME` is the
`objectType` passed to `CreateStateObject`; the rest are attribute names. Keep capture and restore
reading the **same** constants. Prefer generating these (Editor tool) over hand-maintaining — see
`06-TRACKING-PATTERNS.md`.

```csharp
public static class LudeoActionKeys { public const string PLAYER_KILL = "PlayerKill", PLAYER_DIED = "PlayerDeath"; }
public static class LudeoPlayerKeys {
    public const string OBJECT_NAME = "PlayerTank";
    public const string HP = "HP", Position = "Position", Rotation = "Rotation", Speed = "Speed";
}
```

---

## How the game wires it (bootstrap)

```csharp
// In a bootstrap MonoBehaviour in the init scene (Awake/Start):           [Unity]
m_ludeo = new LudeoController(                                            // [Layer]
    onInitDone:      startingInLudeo => { if (startingInLudeo) {/* go to level for replay */} else {/* main menu */} },
    // SYNCHRONOUS apply: apply WHILE frozen, then Begin, then unfreeze (07 §10.1). Never unfreeze before apply.
    onRoomReady:     () => { ApplyRestoredState(); m_ludeo.BeginGameplay(() => Time.timeScale = 1f); }, // [Unity]+[Layer] CR-010
    onStopGame:      () => Time.timeScale = 0f,   // [Unity] CR-011 pause
    onExitToMainMenu:() => LoadMenuScene(),       // [Unity] SceneManager.LoadScene
    // SELECTION-TIME hook (restore only): kick the async scene load + suppress intros; call
    // m_ludeo.NotifySceneReadyForRestore() from the loader's completion (begin-gate leg 3).
    onBeginRestore:  () => { Time.timeScale = 0f; StartCoroutine(LoadRestoreSceneThenNotify()); }); // [Unity]+[Layer]
m_ludeo.SetGameplayerId(localPlayerId);           // [Layer]

// Gameplay MonoBehaviour:
void Update() { if (gameplayActive) m_ludeo.UpdateStateObjects(); }   // [Unity] Update → [Layer] (CR-005)
// Every exit path (CR-007) → m_ludeo.EndGameplay(...) or AbortGameplay(...)   [Layer]

// Bootstrap MonoBehaviour — dispose the owned session on quit (CR-007 + Editor re-init, see Shutdown()):
void OnApplicationQuit() => m_ludeo.Shutdown();   // [Unity] → [Layer]; required, not optional
```

---

## Adapting to an existing architecture (opt-out)

You may host these responsibilities in the game's own managers instead of these exact classes, but
preserve: (1) a single façade boundary so SDK calls aren't scattered; (2) the dummy/disabled
implementations behind interfaces (CR-001); (3) consent gating via the flow switch (CR-012); (4) all
notifications registered before `Activate`; (5) the per-object handler contract for tracking. If you
drop the interface seam, CR-001 and CR-007 become very hard to satisfy — don't.

---

## Calls used in this doc

**`[SDK]`** (verbatim — authority: [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)),
wrapped by the `[Layer]` classes above: `LudeoManager.InitLudeoSession` · `LudeoSession.{Activate,
OpenRoom, GetLudeo, OpenGallery, Dispose}` · `LudeoSession.AddNotify{LudeoSelected, RoomReady, ConsentUpdated,
PauseGame, ResumeGame, ReturnToMainMenu, MuteRequest, LocalizationChanged}` ·
`LudeoRoom.{AddGamePlayer, CloseRoom, CreateStateObject}` · `LudeoGameplaySession.{Begin, End, Abort,
SendAction}` · `LudeoStateObject.{SetAttribute, DestroyStateObject}` · `LudeoDataReader.GetStateObjects`.
Types: `LudeoOpenRoomData`, `LudeoRoomAddGamePlayerData`, the `*CallbackData` structs.

**`[Layer]`** (defined here — the SDK does **not** define these; rename freely): `LudeoController` ·
`LudeoIntegrationData` · `LudeoFlowSwitch` · `ILudeoFlow` (`LudeoCreatorFlow` / `LudeoPlayFlow` /
`DisabledLudeoFlow`) · `LudeoInitRoomHandler` · `ILudeoGameplaySessionManager`
(`LudeoGameplaySessionManager` / `DummyLudeoGameplaySessionManager`) · `ILudeoStateHandler`
(`DefaultLudeoStateHandler`) · `LudeoKeys` / `LudeoActionKeys`.

**`[Unity]`:** `Time.timeScale` · `SceneManager.LoadScene` · MonoBehaviour `Awake`/`Start`/`Update`/
`OnApplicationQuit` · `Debug.LogError`.
