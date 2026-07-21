# 05 — Lifecycle Management (Unity)

The full SDK lifecycle: startup → activation → notifications → room → gameplay → shutdown, and the
branch into the play/restore flow. Map it onto **scenes + MonoBehaviour callbacks**, not a main loop.

> **Legend — every call below is tagged by kind:**
> - **`[SDK]`** exact Ludeo package API — authoritative signatures in
>   [`12-SDK-API-REFERENCE.md`](./12-SDK-API-REFERENCE.md), reproduce verbatim.
> - **`[Layer]`** helper from the prescribed layer
>   ([`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md)) — the SDK does **not**
>   define these; rename to fit the game.
> - **`[Unity]`** Unity engine API.
>
> Rules it must obey: CR-003/007/009/010/011 in
> [`00-CRITICAL-REQUIREMENTS.md`](./00-CRITICAL-REQUIREMENTS.md). **Everything async is a callback** —
> each step's result arrives in an `Action<…CallbackData>`, not as a return value.

---

## Two lifetimes (recap)

- **Ludeo Session** (`LudeoSession`) — one per app run; created at startup, released at shutdown.
- **Gameplay Session** (`LudeoGameplaySession`) — one per playable moment; `Begin`…`End`/`Abort`.

→ Full table + diagram in [`00-CRITICAL-REQUIREMENTS.md`](./00-CRITICAL-REQUIREMENTS.md).

> **No discrete level / match / scene?** The `(level, match, run)` examples are illustrative, not
> constraining. For open-world / streaming / sandbox / MMO games — where boundaries are state-machine
> or event-driven, not `SceneManager.LoadScene` calls — **one continuous live run is one Gameplay
> Session**. Bind `OpenRoom` to the game's canonical "gameplay began" event, `End` on death and
> `Abort` on return-to-menu/quit, and keep the standard two-signal gate (`AddGamePlayer` + `RoomReady`
> → `Begin`) — no third gate. Read [`game-patterns/open-world.md`](./game-patterns/open-world.md)
> before mapping `OpenRoom` for these games.

> **No main menu — game boots straight into gameplay?** The classic flow leans on a main menu as an
> implicit **waiting room**: it absorbs the async `InitLudeoSession → Activate` and **consent**
> latency before the first creator `OpenRoom`, and it's where the create-vs-play branch resolves. A
> game that auto-starts a run on the first scene's `Start()` has no such wait — open a creator room
> before consent flips `LudeoFlowSwitch` on and it **silently no-ops** (no room, no capture, passes a
> smoke test). You replace the menu with an explicit **SDK-readiness gate**: load the level
> immediately, but hold the first interactive/recorded frame until Activate + consent resolve (or a
> bounded timeout falls through to an *uncaptured* game). Read
> [`unity/LAUNCH-AND-READINESS.md`](./unity/LAUNCH-AND-READINESS.md) before planning the lifecycle for
> these games — and for any classic game with a fast/skippable menu.

---

## Where each step lives (scene mapping)

| Stage | Typical Unity location |
| --- | --- |
| Init + Activate + register notifications | Bootstrap MonoBehaviour in the **init scene** (e.g. `SceneInit`), `Awake`/`Start` `[Unity]` |
| Open room / add player / begin | When the **gameplay scene** starts a match (after load) |
| Per-frame attribute sampling | Gameplay MonoBehaviour `Update` `[Unity]` → `UpdateStateObjects()` `[Layer]` |
| End / abort | Every gameplay **exit path** (CR-007) |
| Session release (end/abort active run **+ `Dispose()` the owned session**) | App shutdown (`OnApplicationQuit` `[Unity]`) |

---

## Startup sequence (once per app run)

```
LudeoManager.InitLudeoSession(cb)                         [SDK]
        │  cb: LudeoSessionInitCallbackData (resultCode, ludeoSession)
        ▼
  register ALL notifications on ludeoSession              [SDK]   ← BEFORE Activate
        ▼
  ludeoSession.Activate(cb)                               [SDK]
        │  cb: LudeoSessionActivateCallbackData (resultCode, isLudeoSelected)
        ▼
  AddNotifyConsentUpdated fires → canCreateLudeo/canPlayLudeo  → flowSwitch.SetFlags(...)  [Layer] (CR-012)
        ▼
  if isLudeoSelected == true → a LudeoSelected notification follows → PLAY flow
  else → normal game start (CREATE flow available when consent allows)
```

1. **`LudeoManager.InitLudeoSession`** `[SDK]` — call once. Callback delivers the `LudeoSession`
   (check `resultCode == Success`). `WrapperDllNotFound` here = native layer didn't load (build
   problem, see `04-BUILD-INTEGRATION.md`).
2. **Register notifications** `[SDK]` on the session **before** `Activate` (next section).
3. **`LudeoSession.Activate`** `[SDK]` — connects to backend **and authenticates**. In its callback,
   check `data.resultCode` (treat failure as non-fatal — continue the game *without* Ludeo, never
   block the player), then `isLudeoSelected == true` ⇒ launched to play a Ludeo; a `LudeoSelected`
   notification follows → branch to the play flow.
   > **Auth happens here, and with implicit (Steam) auth — `runWithoutLauncher = false`, the
   > production default — Steam must already be initialized before this call.** The SDK auto-detects
   > Steam but does **not** initialize it; if Steam isn't running, `Activate` returns
   > `LudeoResult.InvalidAuth`. So the real startup order is **Init → register notifications → (game's
   > Steam init) → Activate** — Steam must be up before `Activate`, not before init. **Because Steam
   > usually initializes late/async (a login scene) while the SDK bootstraps early, don't call
   > `Activate` inline — gate it on a game-owned "auth ready" signal** with a bounded fallback (see
   > [`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md) → "Implicit auth: gate
   > Activate on Steam-ready"). Explicit auth (`runWithoutLauncher = true` + `launcherUserId`) needs no
   > Steam. Full toggle reference: [`unity/UPM-INSTALL-AND-DEFINES.md §3`](./unity/UPM-INSTALL-AND-DEFINES.md).
   > A bounded timeout fallback (proceed without Ludeo if no callback within N seconds) keeps the player
   > unstuck. `InvalidAuth` triage (two cause-families + red-herring logs):
   > [`unity/READING-UNITY-LOGS.md`](./unity/READING-UNITY-LOGS.md).
4. **Consent** via `AddNotifyConsentUpdated` `[SDK]` feeds `LudeoFlowSwitch.SetFlags(...)` `[Layer]`.

---

## Registering notifications (before `Activate`) — all `[SDK]`

| Notification `[SDK]` | Callback arg | Role |
| --- | --- | --- |
| `AddNotifyLudeoSelected` | `LudeoSelectedCallbackData` | Enter **play** flow (carries `ludeoId`) |
| `AddNotifyRoomReady` | `LudeoSessionRoomReadyCallbackData` | Room ready → restore (play) / begin |
| `AddNotifyConsentUpdated` | `LudeoSessionConsentUpdatedCallbackData` | Gate create/play + gallery (CR-012) |
| `AddNotifyPauseGame` | *(none — plain `Action`)* | Overlay pause (CR-011) |
| `AddNotifyResumeGame` | *(none — plain `Action`)* | Overlay resume (CR-011) |
| `AddNotifyReturnToMainMenu` | *(none — plain `Action`)* | Exit-to-menu (a CR-007 exit) |
| `AddNotifyMuteRequest` | `LudeoSessionMuteRequestCallbackData` | Mute/unmute audio |
| `AddNotifyLocalizationChanged` | `LudeoSessionLocalizationChangedCallbackData` | Language change |

> Names are `AddNotifyPauseGame`/`AddNotifyResumeGame` — *not* `…Request`. Exact arg types: doc 12.

---

## Who calls what — game code vs. callback-driven (CR-009)

> **#1 lifecycle mistake:** calling `AddGamePlayer`/`Begin` straight from a game event. They are
> driven by *callbacks*. Game code initiates only `OpenRoom`, `End`/`Abort`, and shutdown.

```
🎮 GAME CODE initiates                         📞 CALLBACK-DRIVEN (never from game events)
─────────────────────────────                 ─────────────────────────────────────────────────
LudeoManager.InitLudeoSession  [SDK]
ludeoSession.Activate          [SDK]
ludeoSession.OpenRoom          [SDK] ─────────► onOpenRoom cb → room.AddGamePlayer        [SDK]
                                                onAddGamePlayer cb → store ludeoGameplaySession
                                                RoomReady notification → gameplaySession.Begin [SDK]
gameplaySession.End / Abort    [SDK] ─────────► onEnd cb → room.CloseRoom                  [SDK]
session release (shutdown)
```

The `[Layer]` façade (`LudeoController`) wires these callbacks for you; the game calls the façade's
`[Layer]` methods (`OpenLudeoGallery`, `BeginGameplay`, `EndGameplay`, …), which call the `[SDK]`
methods above in the right order.

> **⚠️ The `onAddGamePlayer` callback and the `RoomReady` notification RACE — `Begin` needs both.**
> They are **independent** async events: the `AddGamePlayer` callback delivers the
> `LudeoGameplaySession`, while `RoomReady` is a separate notification. The diagram lists them on
> consecutive lines, but there is **no ordering guarantee** — `RoomReady` can (and on some
> backends does) arrive *before* `AddGamePlayer`'s callback has stored the session. If you call
> `Begin` straight from `RoomReady`, the session is still null and **the run records nothing** — a
> silent failure that often passes the first smoke test (which happens to win the race the other way),
> then bites intermittently. Gate `Begin` on **both** signals (whichever completes last triggers it) —
> see `unity/REFERENCE-ARCHITECTURE.md` (`m_roomReady` + `NotifyPlayerAdded`). Or fetch the session
> from the room in the `RoomReady` handler via `LudeoRoom.GetGamePlaySession(gamePlayerId, out session)`.

---

## Capture (creator) gameplay flow

```
match start (game code)
  └─ ludeoSession.OpenRoom(data.CreateOpenRoomDataForCreator(), onOpenRoom)   [SDK] arg via [Layer]
        └─ onOpenRoom: room.AddGamePlayer(new LudeoRoomAddGamePlayerData(playerId), onAddPlayer)  [SDK]
              └─ onAddPlayer: store data.ludeoGameplaySession                  [SDK type]   ⎫ RACE —
        └─ RoomReady notification                                              [SDK]        ⎬ no order
              └─ gameplaySession.Begin(onBegun)  [SDK]  ← only once BOTH onAddPlayer + RoomReady done ⎭ guarantee
              └─ onBegun: gameplay runs; each frame UpdateStateObjects()       [Layer] writes attributes (CR-005)
              └─ create LudeoStateObjects for tracked entities (see 06)        [SDK] room.CreateStateObject
match ends / any exit (CR-007)
  └─ controller.EndGameplay() [Layer] → gameplaySession.End(onEnd) [SDK] → room.CloseRoom(onClose) [SDK]
     (controller.AbortGameplay() [Layer] → gameplaySession.Abort(...) [SDK] for restart/quit)
```

- `CreateOpenRoomDataForCreator()` is a `[Layer]` helper that builds the `[SDK]`
  `LudeoOpenRoomData` (creator form has **no** `ludeoId`).
- `Begin` `[SDK]` starts SDK recording — only after the room is ready and the player added (CR-009).
- `End` `[SDK]` finalizes/creates the Ludeo; `Abort` `[SDK]` discards. Route **every** exit through
  one (CR-007), then `CloseRoom` `[SDK]`.

---

## Play (restore) flow — entry & spine

Detail in [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md); the lifecycle spine:

```
LudeoSelected (or Activate.isLudeoSelected) → store ludeoId
  └─ ludeoSession.GetLudeo(ludeoId, onGetLudeo)                                [SDK]
        └─ onGetLudeo: cache LudeoDataReader [SDK type]; flowSwitch.SwitchToPlay() [Layer] (consent-gated)
              └─ build restore buckets (LudeoRestoredData)  [Layer] ← do NOT apply yet (CR-010)
              └─ onBeginRestore() [Layer] ← start async scene load + suppress intros, BEFORE the room opens
              └─ flow.InitRoom() [Layer] → ludeoSession.OpenRoom(CreateOpenRoomDataForLudeo()) [SDK] → AddGamePlayer [SDK]
RoomReady ∧ AddGamePlayer ∧ sceneLoaded (NotifySceneReadyForRestore)   ← all three gate Begin (CR-009)
  └─ apply restored state (two-pass) [Layer] → unfreeze (Time.timeScale=1f) [Unity] → gameplaySession.Begin [SDK]  (CR-010 order)
```

- Play `LudeoOpenRoomData` `[SDK]` carries the **`ludeoId`**; creator's does not (doc 12).
- State is applied **on `RoomReady`**, **before** unfreezing and `Begin` — never inside the `GetLudeo`
  callback, never unfreeze-first (CR-010). Async apply suppresses instead of freezing (`07 §10.1`).

---

## Pause / resume / return-to-menu (runtime contract)

- **`AddNotifyPauseGame` / `AddNotifyResumeGame`** `[SDK]` — overlay open/close during playback.
  Freeze the **simulation**: `Time.timeScale = 0f` `[Unity]` / restore `1f` (CR-011). Idempotent.
- **`AddNotifyReturnToMainMenu`** `[SDK]` — treat as a CR-007 exit: stop tracking, `CloseRoom`
  `[SDK]`, load the menu scene (`SceneManager.LoadScene` `[Unity]`).

---

## Shutdown

Two things on `OnApplicationQuit` `[Unity]`:

1. **End/abort any active gameplay session** (CR-007) so a mid-session quit still produces or cleanly
   discards a Ludeo.
2. **`Dispose()` the `LudeoSession` you own.** It is `IDisposable` and was handed to you by
   `InitLudeoSession` — **you** own it. The plugin disposes the room / reader / state-objects
   internally, but **not** the session you hold (12 §7). Do **not** assume "the plugin disposes
   internally" for the session.

Both belong in one `Shutdown()` on the façade (`LudeoController.Shutdown()` — see
[`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md)), called from
`OnApplicationQuit`.

> **⚠️ Editor: skip the session `Dispose()` and the 2nd Play is dead.** A missed `Dispose()` is masked
> in a **built player** (the process exits, native state goes with it) — so a smoke test passes. But in
> the **Editor** the static `LudeoManager` + native session **survive across Play sessions** (the native
> DLL stays loaded in the Editor process). On the 2nd Play, `InitLudeoSession` finds a still-held handle,
> logs `Core:Error Client still holding a handle to a Session instance`, and returns `WrongState`. First
> Play looks fine; every later Play is dead. A session already left dangling before you add the fix needs
> **one Editor restart** to clear native state.

---

## Threading

All of the above runs on the **main thread**; the plugin marshals callbacks there, so touching
GameObjects inside Ludeo callbacks is safe. If the game uses coroutines/`async`/Jobs, marshal back
to main before any `[SDK]` call (CR-013).

---

## Common lifecycle failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| No Ludeo created | Missed an exit path | Route every exit through `End`/`Abort` `[SDK]` (CR-007) |
| `Begin` fails / "no gameplay session"; run records nothing (intermittent) | `Begin` called from `RoomReady` alone — it won the race against the `AddGamePlayer` callback that sets the session | Gate `Begin` on **both** `RoomReady` and `onAddPlayer` (whichever is last); or use `LudeoRoom.GetGamePlaySession` in `RoomReady` (CR-009) |
| `AddGamePlayer`/`Begin` no-ops | Called from a game event, not the callback | Chain via `onOpenRoom`/`RoomReady` (CR-009) |
| Restored state wrong | Applied in `GetLudeo` cb / before `Begin`; or unfrozen before apply | Apply on `RoomReady`, **apply→unfreeze→`Begin`** (never unfreeze first) (CR-010) |
| Restore hangs; `Begin` never fires | Async spawn (awaits physics/coroutine/`UniTask`/NavMesh) frozen with `timeScale=0` → `FixedUpdate` stalls | **Suppress** via `IsInLudeoFlow` instead of freezing the async create; freeze only the scalar write (CR-010, `07 §10.1`) |
| Restore applies into empty scene | `Begin`/apply fired on `RoomReady` before the scene finished loading | Add the scene-load leg: `NotifySceneReadyForRestore()` from the loader's completion (CR-009) |
| First-restore `NullReferenceException` | Play flow's `m_data` assigned lazily in `InitRoom`; restore-read fired earlier | Inject shared state into flows at **construction** (REFERENCE-ARCHITECTURE) |
| Game plays under overlay | Pause/resume notifications not registered | Register `AddNotifyPauseGame`/`ResumeGame` `[SDK]` (CR-011) |
| Restored Ludeo loads but input is dead (player can't move/act) | A persistent-singleton (`ScriptableObject`/`DontDestroyOnLoad`/`static`) layer carried a stale pause/freeze flag from a prior playmode session → `timeScale = 0` | Reset all mutable runtime state at the start/bootstrap hook; check the three input gates (`07 §10.4`) |
| **Second replay** in one session hangs, opens a double room, or replays unsuppressed | First play not torn down on re-entry — stale pause flag deadlocks async restore, unclosed room+session, un-reset gameplay-active flag | Make `HandleGetLudeoDone` re-entrant: full `AbortGameplay` + `ResetBeginGate` + per-restore pause reset; start the new play only in the teardown callback (`07 §2.2`) |
| `WrapperDllNotFound` in init cb | Native layer didn't load | Build/platform/plugins (`04-BUILD-INTEGRATION.md`) |
| `InvalidAuth` in Activate cb (implicit/Steam auth) | Steam not initialized before `Activate` — the SDK won't init it for you | Bring Steam up before `Activate` (Init → notifications → Steam init → Activate); or use explicit auth (`runWithoutLauncher = true` + `launcherUserId`) for no-Steam/CI runs (`unity/UPM-INSTALL-AND-DEFINES.md §3`) |
| Init returns `WrongState` / `Client still holding a handle to a Session instance` on the 2nd+ Editor Play (1st was fine) | Prior Play's `LudeoSession` never disposed; native state survives across Editor Plays | `Dispose()` the owned session in `Shutdown()` on `OnApplicationQuit`; restart the Editor **once** to clear the already-dangling session (see "Shutdown") |

---

## Calls used in this doc

**`[SDK]` (verbatim — authority: [`12-SDK-API-REFERENCE.md`](./12-SDK-API-REFERENCE.md)):**
`LudeoManager.InitLudeoSession` · `LudeoSession.Activate` · `LudeoSession.AddNotify{LudeoSelected,
RoomReady, ConsentUpdated, PauseGame, ResumeGame, ReturnToMainMenu, MuteRequest,
LocalizationChanged}` · `LudeoSession.OpenRoom` · `LudeoSession.GetLudeo` · `LudeoSession.Dispose` · `LudeoRoom.AddGamePlayer`
· `LudeoRoom.CloseRoom` · `LudeoRoom.CreateStateObject` · `LudeoGameplaySession.Begin/End/Abort`.
Types: `LudeoOpenRoomData`, `LudeoRoomAddGamePlayerData`, `LudeoDataReader`, the `*CallbackData`
structs.

**`[Layer]` (from [`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md) — rename
freely):** `LudeoController.{BeginGameplay, EndGameplay, AbortGameplay, UpdateStateObjects,
OpenLudeoGallery}` · `LudeoFlowSwitch.{SetFlags, SwitchToCreate, SwitchToPlay}` ·
`ILudeoFlow.InitRoom` · `LudeoIntegrationData.{CreateOpenRoomDataForCreator, CreateOpenRoomDataForLudeo}`
· `LudeoRestoredData`.

**`[Unity]`:** `Time.timeScale` · `SceneManager.LoadScene` · MonoBehaviour `Awake`/`Start`/`Update`/
`OnApplicationQuit`.

→ Implementation: phases `3-plan-sdk-lifecycle.md` and `4-implement-sdk-lifecycle.md`.
