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
> [`00-CRITICAL-REQUIREMENTS.md`](./00-CRITICAL-REQUIREMENTS.md). **Init is synchronous**
> (`Initialize()` + `CreateSession(out …)` return a `LudeoResult`); **everything else async is a
> callback** — each step's result arrives in an `Action<…CallbackData>`, not as a return value.

---

## Two lifetimes (recap)

- **Ludeo Session** (`LudeoSession`) — one per app run; created at startup, `Dispose()`d at shutdown.
- **Player / gameplay** (`LudeoPlayer`) — one per playable moment;
  `BeginGameplay`…`EndGameplay`/`AbortGameplay`.

→ Full table + diagram in [`00-CRITICAL-REQUIREMENTS.md`](./00-CRITICAL-REQUIREMENTS.md).

> **No discrete level / match / scene?** The `(level, match, run)` examples are illustrative, not
> constraining. For open-world / streaming / sandbox / MMO games — where boundaries are state-machine
> or event-driven, not `SceneManager.LoadScene` calls — **one continuous live run is one gameplay
> session**. Bind `OpenRoom` to the game's canonical "gameplay began" event, `EndGameplay` on death and
> `AbortGameplay` on return-to-menu/quit, and keep the standard two-signal gate (`AddPlayer` +
> `RoomReady` → `BeginGameplay`) — no third gate. Read
> [`game-patterns/open-world.md`](./game-patterns/open-world.md) before mapping `OpenRoom` for these games.

> **No main menu — game boots straight into gameplay?** The classic flow leans on a main menu as an
> implicit **waiting room**: it absorbs the async `Activate` and **consent** latency before the first
> creator `OpenRoom`, and it's where the create-vs-play branch resolves. A game that auto-starts a run
> on the first scene's `Start()` has no such wait — open a creator room before consent flips
> `LudeoFlowSwitch` on and it **silently no-ops** (no room, no capture, passes a smoke test). You
> replace the menu with an explicit **SDK-readiness gate**: load the level immediately, but hold the
> first interactive/recorded frame until Activate + consent resolve (or a bounded timeout falls through
> to an *uncaptured* game). Read [`unity/LAUNCH-AND-READINESS.md`](./unity/LAUNCH-AND-READINESS.md)
> before planning the lifecycle for these games — and for any classic game with a fast/skippable menu.

---

## Where each step lives (scene mapping)

| Stage | Typical Unity location |
| --- | --- |
| Initialize + CreateSession + subscribe events + Activate | Bootstrap MonoBehaviour in the **init scene** (e.g. `SceneInit`), `Awake`/`Start` `[Unity]` |
| Open room / add player / begin | When the **gameplay scene** starts a match (after load) |
| Per-frame attribute sampling | Gameplay MonoBehaviour `Update` `[Unity]` → `UpdateStateObjects()` `[Layer]` |
| End / abort | Every gameplay **exit path** (CR-007) |
| Session release (end/abort active run **+ `Dispose()` the owned session**) | App shutdown (`OnApplicationQuit` `[Unity]`) |

---

## Startup sequence (once per app run)

```
LudeoManager.Initialize()                                 [SDK]  ← synchronous, returns LudeoResult
        │  Success (or LudeoManagerAlreadyInitialized)
        ▼
LudeoManager.SessionManager.CreateSession(out session)   [SDK]  ← synchronous, returns LudeoResult
        ▼
  subscribe ALL events on session (with +=)              [SDK]   ← BEFORE Activate
        ▼
  session.Activate(cb)                                    [SDK]   ← registers the events natively
        │  cb: LudeoSessionActivateCallbackData (resultCode, isLudeoSelected)
        ▼
  PlayerConsentUpdated fires → canCreateLudeo/canPlayLudeo → flowSwitch.SetFlags(...)  [Layer] (CR-012)
        ▼
  if isLudeoSelected == true → a LudeoSelected event follows shortly → PLAY flow
  else → normal game start (CREATE flow when consent allows) — LudeoSelected may still arrive later
```

1. **`LudeoManager.Initialize()`** `[SDK]` — call once, synchronously; check the returned
   `LudeoResult` (`Success`, or `LudeoManagerAlreadyInitialized` = benign no-op). `WrapperDllNotFound`
   here = native layer didn't load (build problem, see `04-BUILD-INTEGRATION.md`). This is what brings
   up the native layer / overlay and `LudeoUnityManager`.
2. **`LudeoManager.SessionManager.CreateSession(out LudeoSession session)`** `[SDK]` — synchronous;
   delivers the `LudeoSession` via the `out` param when it returns `Success`. **You own this session**
   (`IDisposable`).
3. **Subscribe events** `[SDK]` on the session **before** `Activate` (next section) — `Activate`
   registers them natively; late subscribers miss early notifications.
4. **`LudeoSession.Activate`** `[SDK]` — connects to backend **and authenticates**. In its callback,
   check `data.resultCode` (treat failure as non-fatal — continue the game *without* Ludeo, never
   block the player), then `isLudeoSelected == true` ⇒ a Ludeo is **already** selected and a
   `LudeoSelected` event follows shortly → branch to the play flow. `false` does **not** rule a Ludeo
   out for this run — `LudeoSelected` can arrive at any later point.
   > **Auth happens here, and with implicit (Steam) auth — `runWithoutLauncher = false`, the
   > production default — Steam must already be initialized before this call.** The SDK auto-detects
   > Steam but does **not** initialize it; if Steam isn't running, `Activate` returns
   > `LudeoResult.InvalidAuth`. So the real startup order is **Initialize → CreateSession → subscribe
   > events → (game's Steam init) → Activate** — Steam must be up before `Activate`, not before init.
   > **Because Steam usually initializes late/async (a login scene) while the SDK bootstraps early,
   > don't call `Activate` inline — gate it on a game-owned "auth ready" signal** with a bounded
   > fallback (see [`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md) → "Implicit
   > auth: gate Activate on Steam-ready"). Explicit auth (`runWithoutLauncher = true` +
   > `launcherUserId`) needs no Steam. Full toggle reference:
   > [`unity/UPM-INSTALL-AND-DEFINES.md §3`](./unity/UPM-INSTALL-AND-DEFINES.md). A bounded timeout
   > fallback (proceed without Ludeo if no callback within N seconds) keeps the player unstuck.
   > `InvalidAuth` triage (two cause-families + red-herring logs):
   > [`unity/READING-UNITY-LOGS.md`](./unity/READING-UNITY-LOGS.md).
5. **Consent** via the `PlayerConsentUpdated` event `[SDK]` feeds `LudeoFlowSwitch.SetFlags(...)` `[Layer]`.

---

## Subscribing to session events (before `Activate`) — all `[SDK]`

Events are C# `event`s on `LudeoSession` (v4.3.0 replaced the old `AddNotify*`/`RemoveNotify*`
methods). Subscribe with `+=`, unsubscribe with `-=`.

| Event `[SDK]` | Handler arg | Role |
| --- | --- | --- |
| `LudeoSelected` | `LudeoSelectedCallbackData` | Enter **play** flow (carries `ludeoId`) |
| `RoomReady` | `LudeoSessionRoomReadyCallbackData` | Room ready → restore (play) / begin |
| `PlayerConsentUpdated` | `LudeoSessionConsentUpdatedCallbackData` | Gate create/play (CR-012) |
| `PauseGameRequested` | *(none — plain `Action`)* | Overlay pause (CR-011) |
| `ResumeGameRequested` | *(none — plain `Action`)* | Overlay resume (CR-011) |
| `GameBackToMenuRequested` | *(none — plain `Action`)* | Exit-to-menu (a CR-007 exit) |
| `MuteGameRequested` | `LudeoSessionMuteRequestCallbackData` | Mute/unmute audio |
| `LocalizationUpdated` | `LudeoSessionLocalizationChangedCallbackData` | Language change |

> Names are `PauseGameRequested`/`ResumeGameRequested`/`GameBackToMenuRequested`/`PlayerConsentUpdated`
> — *not* the old `AddNotify*` methods. Exact arg types: doc 12.

---

## Who calls what — game code vs. callback-driven (CR-009)

> **#1 lifecycle mistake:** calling `AddPlayer`/`BeginGameplay` straight from a game event. They are
> driven by *callbacks*. Game code initiates only `Initialize`/`CreateSession`/`Activate`, `OpenRoom`,
> `EndGameplay`/`AbortGameplay`, and shutdown.

```
🎮 GAME CODE initiates                         📞 CALLBACK-DRIVEN (never from game events)
─────────────────────────────                 ─────────────────────────────────────────────────
LudeoManager.Initialize        [SDK] (sync)
SessionManager.CreateSession   [SDK] (sync)
session.Activate               [SDK]
session.OpenRoom               [SDK] ─────────► onOpenRoom cb → room.AddPlayer               [SDK]
                                                onAddPlayer cb → store data.player (LudeoPlayer)
                                                RoomReady event → player.BeginGameplay        [SDK]
player.EndGameplay / AbortGameplay [SDK] ─────► onEnd cb → room.CloseRoom                     [SDK]
session.Dispose (shutdown)     [SDK]
```

The `[Layer]` façade (`LudeoController`) wires these callbacks for you; the game calls the façade's
`[Layer]` methods (`BeginGameplay`, `EndGameplay`, …), which call the `[SDK]` methods above in the
right order.

> **⚠️ The `onAddPlayer` callback and the `RoomReady` event RACE — `BeginGameplay` needs both.**
> They are **independent** async events: the `AddPlayer` callback delivers the `LudeoPlayer`, while
> `RoomReady` is a separate event. The diagram lists them on consecutive lines, but there is **no
> ordering guarantee** — `RoomReady` can (and on some backends does) arrive *before* `AddPlayer`'s
> callback has stored the player. If you call `BeginGameplay` straight from `RoomReady`, the player is
> still null and **the run records nothing** — a silent failure that often passes the first smoke test
> (which happens to win the race the other way), then bites intermittently. Gate `BeginGameplay` on
> **both** signals (whichever completes last triggers it) — see `unity/REFERENCE-ARCHITECTURE.md`
> (`m_roomReady` + `NotifyPlayerAdded`). Or fetch the player from the room in the `RoomReady` handler
> via `LudeoRoom.GetPlayer(gamePlayerId, out LudeoPlayer)`.

---

## Capture (creator) gameplay flow

```
match start (game code)
  └─ session.OpenRoom(data.CreateOpenRoomDataForCreator(), onOpenRoom)   [SDK] arg via [Layer]
        └─ onOpenRoom: room.AddPlayer(new LudeoRoomAddPlayerParameters(playerId), onAddPlayer)  [SDK]
              └─ onAddPlayer: store data.player (LudeoPlayer)             [SDK type]   ⎫ RACE —
        └─ RoomReady event                                                [SDK]        ⎬ no order
              └─ player.BeginGameplay(onBegun)  [SDK]  ← only once BOTH onAddPlayer + RoomReady done ⎭ guarantee
              └─ onBegun: gameplay runs; each frame UpdateStateObjects()  [Layer] scoped WriteData (CR-005/002)
              └─ create objects for tracked entities (see 06)             [SDK] room.Writer.CreateObject
match ends / any exit (CR-007)
  └─ controller.EndGameplay() [Layer] → player.EndGameplay(onEnd) [SDK] → room.CloseRoom(onClose) [SDK]
     (controller.AbortGameplay() [Layer] → player.AbortGameplay(...) [SDK] for restart/quit)
```

- `CreateOpenRoomDataForCreator()` is a `[Layer]` helper that builds the `[SDK]`
  `LudeoSessionOpenRoomParameters` (creator form has **no** `ludeoId`).
- `BeginGameplay` `[SDK]` starts SDK recording — only after the room is ready and the player added
  (CR-009).
- `EndGameplay` `[SDK]` finalizes/creates the Ludeo; `AbortGameplay` `[SDK]` discards. Route **every**
  exit through one (CR-007), then `CloseRoom` `[SDK]`.

---

## Play (restore) flow — entry & spine

Detail in [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md); the lifecycle spine:

```
LudeoSelected (or Activate.isLudeoSelected) → store ludeoId
  └─ session.GetLudeo(ludeoId, onGetLudeo)                                     [SDK]
        └─ onGetLudeo: cache LudeoDataReader [SDK type]; flowSwitch.SwitchToPlay() [Layer] (consent-gated)
              └─ build restore buckets (LudeoRestoredData via dataReader.GetObjects) [Layer] ← do NOT apply yet (CR-010)
              └─ onBeginRestore() [Layer] ← start async scene load + suppress intros, BEFORE the room opens
              └─ flow.InitRoom() [Layer] → session.OpenRoom(CreateOpenRoomDataForLudeo()) [SDK] → AddPlayer [SDK]
RoomReady ∧ AddPlayer ∧ sceneLoaded (NotifySceneReadyForRestore)   ← all three gate BeginGameplay (CR-009)
  └─ apply restored state (two-pass, scoped reads) [Layer] → unfreeze (Time.timeScale=1f) [Unity] → player.BeginGameplay [SDK]  (CR-010 order)
```

- Play `LudeoSessionOpenRoomParameters` `[SDK]` carries the **`ludeoId`**; creator's does not (doc 12).
- Restore buckets come from `LudeoDataReader.GetObjects(out LudeoReadableObject[])` `[SDK]`; each read
  is inside `using (readable.EnterObjectScope())` (CR-002).
- State is applied **on `RoomReady`**, **before** unfreezing and `BeginGameplay` — never inside the
  `GetLudeo` callback, never unfreeze-first (CR-010). Async apply suppresses instead of freezing (`07 §10.1`).

---

## Pause / resume / return-to-menu (runtime contract)

- **`PauseGameRequested` / `ResumeGameRequested`** `[SDK]` events — overlay open/close during playback,
  **cloud Player Flow only** — never in Creator Flow and never in a local build, so verify this half on the
  streamed build. Freeze the **simulation**: `Time.timeScale = 0f` `[Unity]` / restore `1f` (CR-011).
  Idempotent. Don't open the game's own pause menu here (it stacks under the overlay) — and the handler must
  **also** emit the pause trigger below; freezing alone leaves the objective timer running under the overlay.
- **`SendAction("PauseLudeo")` / `("ResumeLudeo")`** — the **other direction**, and required on **every**
  pause: the SDK-requested overlay pause, the player's ESC/pause menu, cutscenes, dialogue, loading screens.
  This is the only thing that stops the **Ludeo objective timer** — it's frozen server-side when the action
  matches its **Studio Lab Global Trigger**, so an unmapped string is silently ignored. Emit at the game's
  pause primitive, once per transition, with a reachable `ResumeLudeo` on every exit path.
  → [`unity/CONSENT-AND-OVERLAY.md`](./unity/CONSENT-AND-OVERLAY.md) §3.
- **`GameBackToMenuRequested`** `[SDK]` event — treat as a CR-007 exit: stop tracking, `CloseRoom`
  `[SDK]`, load the menu scene (`SceneManager.LoadScene` `[Unity]`).

---

## Shutdown

Two things on `OnApplicationQuit` `[Unity]`:

1. **End/abort any active gameplay session** (CR-007) so a mid-session quit still produces or cleanly
   discards a Ludeo.
2. **`Dispose()` the `LudeoSession` you own.** It is `IDisposable` and was handed to you by
   `SessionManager.CreateSession` — **you** own it. Disposing the session also disposes
   `LudeoRoom.ActiveRoom`; the reader / state objects are managed. Do **not** assume "the plugin
   disposes internally" for the session (12 §rules).

Both belong in one `Shutdown()` on the façade (`LudeoController.Shutdown()` — see
[`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md)), called from
`OnApplicationQuit`.

> **⚠️ Editor: skip the session `Dispose()` and the 2nd Play is dead.** A missed `Dispose()` is masked
> in a **built player** (the process exits, native state goes with it) — so a smoke test passes. But in
> the **Editor** the static `LudeoManager` + native session **survive across Play sessions** (the native
> DLL stays loaded in the Editor process, unless Domain Reload is on). On a later Play,
> `CreateSession`/`Activate` finds a still-held handle, logs `Core:Error Client still holding a handle
> to a Session instance`, and returns `WrongState`. First Play looks fine; every later Play is dead. A
> session already left dangling before you add the fix needs **one Editor restart** to clear native state.

---

## Threading

All of the above runs on the **main thread**; the plugin marshals callbacks there, so touching
GameObjects inside Ludeo callbacks is safe. The `…Async` (`Task`) overloads also resume on the main
thread when awaited from it. If the game uses coroutines/`async`/Jobs, marshal back to main before any
`[SDK]` call (CR-013).

---

## Common lifecycle failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| No Ludeo created | Missed an exit path | Route every exit through `EndGameplay`/`AbortGameplay` `[SDK]` (CR-007) |
| Attribute never records / restores | `WriteData`/`ReadData` called outside a scope | Wrap in `using (obj.EnterObjectScope())` (CR-002); the handler does this per tick |
| `BeginGameplay` fails / "no LudeoPlayer"; run records nothing (intermittent) | `BeginGameplay` called from `RoomReady` alone — it won the race against the `AddPlayer` callback that sets the player | Gate `BeginGameplay` on **both** `RoomReady` and `onAddPlayer` (whichever is last); or use `LudeoRoom.GetPlayer` in `RoomReady` (CR-009) |
| `AddPlayer`/`BeginGameplay` no-ops | Called from a game event, not the callback | Chain via `onOpenRoom`/`RoomReady` (CR-009) |
| Restored state wrong | Applied in `GetLudeo` cb / before `BeginGameplay`; or unfrozen before apply | Apply on `RoomReady`, **apply→unfreeze→`BeginGameplay`** (never unfreeze first) (CR-010) |
| Restore hangs; `BeginGameplay` never fires | Async spawn (awaits physics/coroutine/`UniTask`/NavMesh) frozen with `timeScale=0` → `FixedUpdate` stalls | **Suppress** via `IsInLudeoFlow` instead of freezing the async create; freeze only the scalar write (CR-010, `07 §10.1`) |
| Restore applies into empty scene | `BeginGameplay`/apply fired on `RoomReady` before the scene finished loading | Add the scene-load leg: `NotifySceneReadyForRestore()` from the loader's completion (CR-009) |
| First-restore `NullReferenceException` | Play flow's `m_data` assigned lazily in `InitRoom`; restore-read fired earlier | Inject shared state into flows at **construction** (REFERENCE-ARCHITECTURE) |
| Game plays under overlay | Pause/resume events not subscribed | Subscribe `PauseGameRequested`/`ResumeGameRequested` `[SDK]` before Activate (CR-011) |
| Restored Ludeo loads but input is dead (player can't move/act) | A persistent-singleton (`ScriptableObject`/`DontDestroyOnLoad`/`static`) layer carried a stale pause/freeze flag from a prior playmode session → `timeScale = 0` | Reset all mutable runtime state at the start/bootstrap hook; check the three input gates (`07 §10.4`) |
| **Second replay** in one session hangs, opens a double room, or replays unsuppressed | First play not torn down on re-entry — stale pause flag deadlocks async restore, unclosed room+session, un-reset gameplay-active flag | Make `HandleGetLudeoDone` re-entrant: full `AbortGameplay` + `ResetBeginGate` + per-restore pause reset; start the new play only in the teardown callback (`07 §2.2`) |
| `WrapperDllNotFound` from `Initialize()` | Native layer didn't load | Build/platform/plugins (`04-BUILD-INTEGRATION.md`) |
| `InvalidAuth` in Activate cb (implicit/Steam auth) | Steam not initialized before `Activate` — the SDK won't init it for you | Bring Steam up before `Activate` (Initialize → CreateSession → subscribe → Steam init → Activate); or use explicit auth (`runWithoutLauncher = true` + `launcherUserId`) for no-Steam/CI runs (`unity/UPM-INSTALL-AND-DEFINES.md §3`) |
| `CreateSession`/`Activate` returns `WrongState` / `Client still holding a handle to a Session instance` on the 2nd+ Editor Play (1st was fine) | Prior Play's `LudeoSession` never disposed; native state survives across Editor Plays | `Dispose()` the owned session in `Shutdown()` on `OnApplicationQuit`; restart the Editor **once** to clear the already-dangling session (see "Shutdown") |

---

## Calls used in this doc

**`[SDK]` (verbatim — authority: [`12-SDK-API-REFERENCE.md`](./12-SDK-API-REFERENCE.md)):**
`LudeoManager.{Initialize, SessionManager}` · `LudeoSessionManager.CreateSession` ·
`LudeoSession.Activate` · `LudeoSession` events `{LudeoSelected, RoomReady, PlayerConsentUpdated,
PauseGameRequested, ResumeGameRequested, GameBackToMenuRequested, MuteGameRequested,
LocalizationUpdated}` · `LudeoSession.OpenRoom` · `LudeoSession.GetLudeo` · `LudeoSession.Dispose` ·
`LudeoRoom.{AddPlayer, GetPlayer, CloseRoom, Writer}` · `LudeoRoomWriter.CreateObject` ·
`LudeoPlayer.{BeginGameplay, EndGameplay, AbortGameplay}` · `LudeoDataReader.GetObjects`.
Types: `LudeoSessionOpenRoomParameters`, `LudeoRoomAddPlayerParameters`, `LudeoDataReader`,
`LudeoReadableObject`, the `*CallbackData` structs.

**`[Layer]` (from [`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md) — rename
freely):** `LudeoController.{BeginGameplay, EndGameplay, AbortGameplay, UpdateStateObjects}` ·
`LudeoFlowSwitch.{SetFlags, SwitchToCreate, SwitchToPlay}` · `ILudeoFlow.InitRoom` ·
`LudeoIntegrationData.{CreateOpenRoomDataForCreator, CreateOpenRoomDataForLudeo}`
· `LudeoRestoredData`.

**`[Unity]`:** `Time.timeScale` · `SceneManager.LoadScene` · MonoBehaviour `Awake`/`Start`/`Update`/
`OnApplicationQuit`.

→ Implementation: phases `3c-plan-sdk-lifecycle.md` and `3d-implement-sdk-lifecycle.md`.
