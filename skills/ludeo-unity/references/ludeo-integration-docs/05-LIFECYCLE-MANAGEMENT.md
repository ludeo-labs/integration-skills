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
> `AbortGameplay` on return-to-menu/quit, and gate `BeginGameplay` on the standard **three** legs
> (`AddPlayer` + `RoomReady` + **scene-loaded**). The scene-loaded leg is *not* optional for streaming
> games — it is where it matters most, because the SDK room chain routinely completes while
> terrain/sublevels are still streaming in. Read
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
| Open room / add player | When the **gameplay scene** starts a match — kick these at load *start*, so SDK latency hides under the load |
| **Scene-loaded signal** (`[Layer]`) | `NotifySceneLoadStarted()` at the load **request**; `NotifySceneReady()` at its **completion**, once the loading screen is down |
| BeginGameplay | Never from a game call site — the **three-leg gate** fires it (`RoomReady` ∧ `AddPlayer` ∧ scene-loaded) |
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
  if isLudeoSelected == true → a LudeoSelected event follows → PLAY flow
  else → normal game start (CREATE flow available when consent allows)
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
   block the player), then `isLudeoSelected == true` ⇒ launched to play a Ludeo; a `LudeoSelected`
   event follows → branch to the play flow.
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
| `PlayerConsentUpdated` | `LudeoSessionConsentUpdatedCallbackData` | Gate create/play + gallery (CR-012) |
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
> the scene-loaded signal, `EndGameplay`/`AbortGameplay`, and shutdown.

```
🎮 GAME CODE initiates                         📞 CALLBACK-DRIVEN (never from game events)
─────────────────────────────                 ─────────────────────────────────────────────────
LudeoManager.Initialize        [SDK] (sync)
SessionManager.CreateSession   [SDK] (sync)
session.Activate               [SDK]
session.OpenRoom               [SDK] ─────────► onOpenRoom cb → room.AddPlayer               [SDK]
                                                onAddPlayer cb → store data.player (LudeoPlayer) ⎫ 3-leg
                                                RoomReady event                                 ⎬ begin
NotifySceneReady()             [Layer] ───────► (scene loader completion — leg 3)               ⎭ gate
                                                    └─► player.BeginGameplay [SDK] ← last leg fires it
player.EndGameplay / AbortGameplay [SDK] ─────► onEnd cb → room.CloseRoom                     [SDK]
session.Dispose (shutdown)     [SDK]
```

The `[Layer]` façade (`LudeoController`) wires these callbacks for you; the game calls the façade's
`[Layer]` methods (`OpenLudeoGallery`, `BeginGameplay`, `EndGameplay`, …), which call the `[SDK]`
methods above in the right order.

---

## 🔴 The `BeginGameplay` gate: THREE legs, both flows (CR-009)

`BeginGameplay` `[SDK]` starts recording **including the video encoder** — everything from it to
`EndGameplay` is in the Ludeo's video. So it fires only when all three legs are in, **whichever is
last**, in *both* the capture and restore flows (leg 3 is not restore-only):

| Leg | Signal | Delivered by |
| --- | --- | --- |
| 1 | `RoomReady` event | `[SDK]` |
| 2 | `AddPlayer` callback stored the `LudeoPlayer` | `[SDK]` the `onAddPlayer` cb |
| 3 | The gameplay scene finished loading **and the loading screen is down** | `[Layer]` `NotifySceneLoadStarted()` / `NotifySceneReady()` — *your* loader |

**All three race each other; none is implied by another.**

- **Legs 1 vs 2:** independent async events, no ordering guarantee. `BeginGameplay` straight from
  `RoomReady` finds a null player and **records nothing** — intermittent, so it survives a first smoke
  test. (Alternative: fetch the player in the `RoomReady` handler via
  `LudeoRoom.GetPlayer(gamePlayerId, out LudeoPlayer)`.)
- **Leg 3 vs the room chain:** `RoomReady` knows nothing about `SceneManager`, and the room chain
  normally finishes *first* — you deliberately kick `OpenRoom` at load start to hide SDK latency. So
  `BeginGameplay` on legs 1+2 alone starts the encoder **mid-load**, and the Ludeo opens on a loading
  screen, a black frame, or the scene you left. In restore it also applies state into an empty scene
  (`07 §10`). Timing-dependent: a fast local load wins the race and passes a smoke test; a cold or
  streaming load loses.

### Leg 3: what it means, and both its edges

Latch it at **"the level is loaded and the loading screen is over"** — the first frame the player sees
the game. Leg 3 is a **floor, not a ceiling**: `BeginGameplay` may never fire before it.

- ✅ **Recorded on purpose — do NOT defer past these:** intro cinematics, fade-ins, countdowns, spawn
  animations. They are part of the moment. For a genuinely non-gameplay stretch (lobby, scoreboard) use
  non-ludeoable marking (`StartNoneLudeable`), not a later `BeginGameplay`. **Capture flow only:** in
  *restore* these same mechanisms are separately **suppressed** because they would clobber restored
  state (CR-010, `07 §10.1` — which also carves out a cutscene the viewer *should* see). That is
  suppression of the mechanism, not a later leg 3.
- ❌ **Excluded:** the loading screen, the load-time black frame, the scene you traveled *from*.
- **It is scene STATE, so signal both edges:** `NotifySceneLoadStarted()` at the load **request**,
  `NotifySceneReady()` when the load completes. Completion-only leaves the flag `true` after run 1, so
  the **2nd+ run in a session** begins mid-load — invisible to a one-run smoke test. **Clear it at the
  *request*, not from inside the loader**: loader/generator code runs only once the new scene is
  already up, so a flag cleared there still answers for the level you are *leaving* — it fails by
  succeeding at the wrong time. See
  [[a-world-ready-flag-may-still-answer-for-the-world-you-are-leaving]]. (Play-flow re-entry is already
  covered by `ResetBeginGate()`, `07 §2.2`.) Don't re-arm from `EndGameplay`/`AbortGameplay` instead:
  they complete asynchronously and a late completion can wipe a leg the next run already latched.

**Finding the signal** — best first: the **loading-screen controller** (whatever hides the cover already
knows); else `SceneManager.LoadSceneAsync`'s `AsyncOperation.completed` / `SceneManager.sceneLoaded`
`[Unity]`; for additive/streamed content, when *all* loads for the playable area report done. Prefer a
**predicate over current state** to a fire-once event — a predicate can be re-evaluated, a missed event
cannot.

> **No timeout, no fallthrough.** The only real gap is an `async void` loader with no completion signal —
> an authoring bug: add an awaitable/event and call from it (BL-2). A timer, frame count, or "begin anyway
> after N seconds" re-creates exactly the bug this leg prevents, intermittently and silently. If leg 3
> never latches, `BeginGameplay` never fires and the run is uncaptured — loud in verification, which is
> the point.

**Verify:** log a timestamp per leg. Leg 3 must be at or after the loading screen came down, and
`BeginGameplay` at `max(leg1, leg2, leg3)`. Re-check on a **second run in the same session** — that is
where a missing `NotifySceneLoadStarted()` shows up.

---

## Capture (creator) gameplay flow

```
match start / scene load STARTS (game code)
  ├─ start loading the gameplay scene                                     [Unity] async
  └─ session.OpenRoom(data.CreateOpenRoomDataForCreator(), onOpenRoom)   [SDK] arg via [Layer]
        └─ onOpenRoom: room.AddPlayer(new LudeoRoomAddPlayerParameters(playerId), onAddPlayer)  [SDK]
              └─ onAddPlayer: store data.player (LudeoPlayer)             [SDK type]   ⎫ 3-leg
        └─ RoomReady event                                                [SDK]        ⎬ gate —
scene load COMPLETES / loading screen down (game code)                                 ⎪ no order
  └─ controller.NotifySceneReady()                                        [Layer]      ⎭ guarantee
              └─ player.BeginGameplay(onBegun)  [SDK]  ← only once ALL THREE legs are done
              └─ onBegun: gameplay runs; each frame UpdateStateObjects()  [Layer] scoped WriteData (CR-005/002)
              └─ create objects for tracked entities (see 06)             [SDK] room.Writer.CreateObject
match ends / any exit (CR-007)
  └─ controller.EndGameplay() [Layer] → player.EndGameplay(onEnd) [SDK] → room.CloseRoom(onClose) [SDK]
     (controller.AbortGameplay() [Layer] → player.AbortGameplay(...) [SDK] for restart/quit)
```

- `CreateOpenRoomDataForCreator()` is a `[Layer]` helper that builds the `[SDK]`
  `LudeoSessionOpenRoomParameters` (creator form has **no** `ludeoId`).
- **`OpenRoom` early, `BeginGameplay` late.** Opening the room at load *start* is deliberate — it hides
  SDK latency under the load. That is exactly why leg 3 exists: the room chain finishes first, and
  `BeginGameplay` must still wait for the scene. Never "fix" a too-early begin by delaying `OpenRoom`.
- `BeginGameplay` `[SDK]` starts SDK recording **and the video encoder** — only once all three gate legs
  are in (CR-009). Everything after it is in the Ludeo's video.
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
RoomReady ∧ AddPlayer ∧ sceneLoaded (NotifySceneReady)   ← the same three legs gate BeginGameplay (CR-009)
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
| **Ludeo video opens on a loading screen / black frames / the previous scene**; first seconds are not gameplay | `BeginGameplay` fired on legs 1+2 while the gameplay scene was still loading — the encoder started during the load | Add leg 3: `NotifySceneReady()` `[Layer]` from the loader's completion (once the loading screen is down), and gate on all three (CR-009) |
| First run's video is correct, **every later run in the same session** opens on the loading screen | Only leg 3's completion edge is wired, so `m_sceneReady` stayed `true` from the previous scene | Also call `NotifySceneLoadStarted()` at the load **request** (not from inside the loader) |
| `BeginGameplay` fails / "no LudeoPlayer"; run records nothing (intermittent) | `BeginGameplay` called from `RoomReady` alone — it won the race against the `AddPlayer` callback that sets the player | Gate `BeginGameplay` on **both** `RoomReady` and `onAddPlayer` (whichever is last); or use `LudeoRoom.GetPlayer` in `RoomReady` (CR-009) |
| `AddPlayer`/`BeginGameplay` no-ops | Called from a game event, not the callback | Chain via `onOpenRoom`/`RoomReady` (CR-009) |
| Restored state wrong | Applied in `GetLudeo` cb / before `BeginGameplay`; or unfrozen before apply | Apply on `RoomReady`, **apply→unfreeze→`BeginGameplay`** (never unfreeze first) (CR-010) |
| Restore hangs; `BeginGameplay` never fires | Async spawn (awaits physics/coroutine/`UniTask`/NavMesh) frozen with `timeScale=0` → `FixedUpdate` stalls | **Suppress** via `IsInLudeoFlow` instead of freezing the async create; freeze only the scalar write (CR-010, `07 §10.1`) |
| Restore applies into empty scene | `BeginGameplay`/apply fired on `RoomReady` before the scene finished loading | Add the scene-load leg: `NotifySceneReady()` from the loader's completion (CR-009) |
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
freely):** `LudeoController.{BeginGameplay, EndGameplay, AbortGameplay, UpdateStateObjects,
OpenLudeoGallery}` · `LudeoFlowSwitch.{SetFlags, SwitchToCreate, SwitchToPlay}` ·
`ILudeoFlow.InitRoom` · `LudeoIntegrationData.{CreateOpenRoomDataForCreator, CreateOpenRoomDataForLudeo}`
· `LudeoRestoredData`.

**`[Unity]`:** `Time.timeScale` · `SceneManager.LoadScene` · MonoBehaviour `Awake`/`Start`/`Update`/
`OnApplicationQuit`.

→ Implementation: phases `3c-plan-sdk-lifecycle.md` and `3d-implement-sdk-lifecycle.md`.
