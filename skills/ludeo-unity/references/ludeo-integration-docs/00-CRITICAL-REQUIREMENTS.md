# 🚨 CRITICAL REQUIREMENTS — Ludeo SDK Integration (Unity / C#)

> **⚠️ Mandatory for a working Unity integration.** Violating these causes broken captures,
> un-restorable Ludeos, or a game that plays itself behind the overlay.

**Applies to:** Ludeo Unity plugin (`com.ludeosdk.unity`) integrations, Unity 2021.3 LTS+.

> **If you are coming from the generic / C++ guidance:** a couple of C++ Critical Requirements **do
> not apply** in Unity because the managed wrapper handles them (CR-004, CR-008 below). They are kept
> here, by number, marked **N/A — handled by the plugin**, so you know why they're gone and don't
> reintroduce them. Signatures referenced here are defined in
> [`12-SDK-API-REFERENCE.md`](./12-SDK-API-REFERENCE.md).
>
> **⚠️ v4.3.0 note:** CR-002 (object/component scope) is **no longer N/A** — the v4.3.0 write/read
> API is explicitly scoped (`using EnterObjectScope()`), so it is now a real Unity requirement. See
> CR-002 below.

> **Legend (used in the code below):** `[SDK]` = Ludeo package API (signatures in
> [`12-SDK-API-REFERENCE.md`](./12-SDK-API-REFERENCE.md)) · `[Layer]` = a helper from the prescribed
> layer ([`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md)) · `[Unity]` = engine API.

---

## 🔑 KEY CONCEPT: Ludeo Session vs Gameplay Session

| | Ludeo Session | Gameplay Session |
| --- | --- | --- |
| **What** | SDK connection to the Ludeo backend | One playable moment (level, match, run) |
| **Type** | `LudeoSession` | `LudeoPlayer` |
| **Lifetime** | Entire app run | One gameplay instance |
| **Count** | ONE per app launch | MANY per app launch |
| **Created** | `LudeoManager.Initialize` → `SessionManager.CreateSession` → `LudeoSession.Activate` at startup (e.g. `SceneInit`) | `LudeoSession.OpenRoom` → `LudeoRoom.AddPlayer` → `LudeoPlayer.BeginGameplay` when a level starts |
| **Ended** | Session `Dispose()`d at app shutdown | `LudeoPlayer.EndGameplay` / `AbortGameplay` when the moment ends |

```
App Launch ──► [Ludeo Session Active] ──► App Quit
                     │
                     ├── SceneLevel run 1 ──► [Gameplay Session 1] ──► End
                     ├── SceneLevel run 2 ──► [Gameplay Session 2] ──► End
                     └── …
```

→ See [`05-LIFECYCLE-MANAGEMENT.md`](./05-LIFECYCLE-MANAGEMENT.md) for the full flow.

---

## 🔴 CR-001: The integration must be cleanly disableable (runtime dummies; compile-time define is optional)

> **Not a C-macro translation.** In Unity the SDK package is **auto-referenced once installed** —
> there is no build script and no required define. "Disabling Ludeo" is therefore **primarily a
> runtime concern**, which is how the reference integration actually works.

**Required (primary, runtime):** route *all* SDK use through interfaces so that when consent is
unavailable or the SDK can't initialize, `Dummy*`/`Disabled*` implementations make every call a
no-op and **the game plays normally**. The flow switch selects them (see CR-012 and
[`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md)).

```csharp
ILudeoGameplaySessionManager mgr = consentAllows                // [Layer]
    ? new LudeoGameplaySessionManager(data)     // [Layer] real
    : new DummyLudeoGameplaySessionManager();    // [Layer] no-ops — game unaffected
```

**Optional (compile-time):** a Scripting Define Symbol (e.g. `LUDEO_SDK`) is needed **only if you
must ship a build that excludes the SDK package entirely** (an unsupported platform, a stripped
build). Then guard `using LudeoSDK` code with `#if LUDEO_SDK … #else …(fallback types)… #endif`.
Most integrations never need this — keep the package installed and rely on the runtime switch.

**Validation:**
- [ ] All SDK access goes through interfaces with `Dummy*`/`Disabled*` fallbacks (the flow switch).
- [ ] With consent off / SDK uninitialized, the game **runs and plays normally** (dummies no-op).
- [ ] *(Only if shipping no-SDK builds)* compiles with the package removed behind the optional define.

→ See [`unity/UPM-INSTALL-AND-DEFINES.md`](./unity/UPM-INSTALL-AND-DEFINES.md).

---

## 🔴 CR-002: Scope every write and read (`using EnterObjectScope()`)

> **Changed in v4.3.0.** This used to be "N/A — handled by the plugin". It is **not** anymore. The
> v4.3.0 write/read API is explicitly scoped: `WriteData`/`ReadData` only take effect while the
> object's (or component's) scope is open, and the scope is an `IDisposable` you must close.

**Required — wrap every `WriteData`/`ReadData` in a `using` scope:**
```csharp
// CAPTURE
using (writableObject.EnterObjectScope())          // [SDK] LudeoWriteScope
{
    writableObject.WriteData("health", hp);        // [SDK] ignored if outside the scope
    writableObject.WriteData("position", transform.position);
}

// RESTORE
using (readableObject.EnterObjectScope())          // [SDK] LudeoReadScope
{
    readableObject.ReadData("health", out int hp); // [SDK] returns false if outside the scope
}
```

**Nested components go inside the parent object's scope:**
```csharp
using (writableObject.EnterObjectScope())
using (writableComponent.EnterComponentScope())    // [SDK] must be nested in the object scope
{
    writableComponent.WriteData("ammo", ammo);
}
```

**Forbidden:** calling `WriteData`/`ReadData` outside an open scope (silently dropped — a smoke test
still "passes" but the attribute never records/restores); opening a component scope without the parent
object scope open; hand-pairing `Enter…`/`Leave…` instead of `using` (leaks the scope on an early
return/exception). Use `using` — the scope's `Dispose()` is the `Leave`. The
`DefaultLudeoStateHandler` in [`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md)
opens the scope once per object per tick around the game's `WriteData` calls, so gameplay code never
manages scopes directly.

---

## 🔴 CR-003: Async operations are callback-driven

**Init is the exception — it is synchronous.** `LudeoManager.Initialize()` and
`LudeoManager.SessionManager.CreateSession(out session)` each return a `LudeoResult` directly (no
callback); check it inline. Everything that talks to the backend afterwards is callback-driven:
returns `void` and reports its result through an `Action<…CallbackData>`. Check
`data.resultCode == LudeoResult.Success` **inside the callback**. (Each also has an awaitable
`…Async` overload.)

**Callback ops:** `LudeoSession.Activate`, `OpenRoom`, `GetLudeo`; `LudeoRoom.AddPlayer`,
`RemovePlayer`, `CloseRoom`; `LudeoPlayer.BeginGameplay`, `EndGameplay`, `AbortGameplay`.

**Required:**
```csharp
session.Activate(data => {                                       // [SDK]
    if (data.resultCode != LudeoResult.Success) { Debug.LogError($"Activate failed: {data.resultCode}"); return; }  // [Unity] Debug.LogError
    // activated — and check data.isLudeoSelected to branch into the play flow
});
```

**Forbidden:** treating the call as if it returned a result — there is no synchronous return value.

---

## ⚪ CR-004: Window handle — **N/A in Unity (handled by the plugin)**

The plugin manages the capture surface/window. There is no window handle to pass.

---

## 🔴 CR-005: Do NOT wire SDK Tick — drive your own attribute sampling

The plugin instantiates a `LudeoUnityManager` that drives the SDK's internal tick. **You must not
call any SDK tick.** What you *do* drive each frame, while a gameplay session is active, is your own
attribute sampling — looping your `ILudeoStateHandler`s and writing current values.

**Required:**
```csharp
void Update() {
#if LUDEO_SDK
    if (m_gameplayActive)
        LudeoController.Instance.UpdateStateObjects(); // [Layer] opens a scope + WriteData on each tracked object
#endif
}
```

**Rules:** sample on a consistent cadence (per-frame, throttled, or on-change), on the **main
thread**. Do not look for a "main loop" to insert a Ludeo tick — Unity has none and the plugin ticks
itself.

---

## 🔴 CR-006: Two-pass restoration is MANDATORY

Restore in two passes so cross-object references resolve.

**Required:**
```csharp
// PASS 1 — create every GameObject from the restore buckets (by objectType)
foreach (var entry in bucket)             // bucket = LudeoStateObjectsLookup[objectType]  [Layer]
    Instantiate(...);                     // [Unity] create, register id → object

// PASS 2 — read attributes and resolve references (now every object exists)
foreach (var (obj, restore) in created) {
    using (restore.EnterObjectScope())               // [SDK] CR-002 — reads need an open scope
        restore.ReadData("health", out int hp);      // [SDK]
    // resolve cross-refs by YOUR stored key attribute, not by SDK ObjectId
}
```

**Why:** single-pass breaks when object B references object A that isn't spawned yet.

> **Reset matched/singleton instances before applying** (player/restore flow only — creator flow plays from
> the game's own fresh start and needs none of this). Pass 1 *spawns* fresh objects (zero-initialized), but the
> **player singleton** and any **scene-placed object you match instead of spawn** (`07 §9`) are the same live
> objects from the previous run — apply overwrites only the captured fields, so **uncaptured gameplay *and
> visual* state leaks across runs:** not just logical fields (inventory, ammo, score, buffs, cooldowns, status
> flags) but **everything visually relevant** that rides on a `DontDestroyOnLoad`/manager object and survives
> the scene reload — persistent HUD/score readouts, active VFX/particle emitters, world-space damage numbers,
> screen-shake, post-processing (vignette/bloom from a prior buff). Reset the instance to a clean baseline at
> the top of its restore apply, *then* apply the snapshot. (Distinct from the persistent-singleton *pause-flag*
> trap below — same cause, different victim.)

→ See [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md).

---

## 🔴 CR-007: `End`/`Abort` the gameplay session on **ALL** exit paths

> **⚠️ THE #1 CAUSE OF BROKEN INTEGRATIONS.** Miss one exit path → no Ludeo for that scenario.

**Every way to leave active gameplay must route through `LudeoController.EndGameplay(...)` or
`AbortGameplay(...)`** (the tank-pattern facade centralizes this).

**Audit ALL of these Unity exit paths:**

| Exit path | Example | Must end the session |
| --- | --- | --- |
| Level complete / win | `OnLevelComplete()` | ✅ End |
| Level failed / death | `OnPlayerDied()`, `GameOverMenu` | ✅ End |
| Quit to menu | `ReturnToMainMenu()`, pause-menu button | ✅ Abort |
| Restart level | `RestartLevel()` | ✅ Abort |
| Quit app | `OnApplicationQuit()` | ✅ End/Abort |
| Scene unload | `OnDestroy()` of the gameplay manager / scene teardown | ✅ End/Abort |
| `GameBackToMenuRequested` event | SDK overlay "exit to menu" | ✅ Abort + close room |
| `LudeoSelected` while a run is active (mid-capture **or finishing a replay to play another**) | player picks a Ludeo mid-run or a second Ludeo from the overlay | ✅ **Abort session** + stop tracking + close room + **reset begin-gate / both pause flags / gameplay-active** (07 §2.2) |

**Validation:**
- [ ] Listed every function/scene-exit/notification that leaves gameplay.
- [ ] Each routes through `EndGameplay`/`AbortGameplay`.
- [ ] Tested: quit mid-level → Ludeo created · restart → handled · return-to-menu → handled.

---

## ⚪ CR-008: Release ObjectsInfo — **N/A in Unity (handled by the plugin)**

`LudeoDataReader.GetObjects` returns a **managed** `LudeoReadableObject[]`. There is nothing to
release; GC handles it. No `ObjectsInfo_Release` equivalent.

> **v4.3.0 caveat:** `LudeoDataReader` itself is now `IDisposable`. You don't release the *array*, but
> the reader you got from the `GetLudeo` callback can be `Dispose()`d when the run is done (or left to
> the session teardown, which invalidates it). It's tied to the session lifetime, not a single run.

---

## 🔴 CR-009: Callback-driven operations are NOT game integration points

Some operations are triggered by SDK callbacks/notifications, not by your game events.

**🎮 Game code calls these:** `Initialize` + `CreateSession` (startup), `Activate` (after
session created + events subscribed), `OpenRoom` (gameplay start), `NotifySceneLoadStarted` /
`NotifySceneReady` (the scene-load edges), `EndGameplay`/`AbortGameplay` (all exit paths), session
`Dispose` (shutdown).

**📞 Driven by callbacks/notifications (do NOT call from game event handlers):**

| Operation | Called from |
| --- | --- |
| `LudeoRoom.AddPlayer` | the `OpenRoom` callback (`HandleRoomOpened`) |
| `LudeoPlayer.BeginGameplay` | the **three-leg begin gate** — the `RoomReady` event ∧ the `AddPlayer` callback ∧ scene-loaded; whichever leg is last fires it |
| `LudeoRoom.CloseRoom` | after `EndGameplay`/`AbortGameplay` completes, or on `GameBackToMenuRequested` |

**Forbidden:** calling `OpenRoom` then immediately `AddPlayer`/`BeginGameplay` from the same
level-load handler — the room/player aren't ready yet. Chain them through the callbacks.

### The begin gate has THREE legs, in BOTH flows

`BeginGameplay` starts SDK recording **including the video encoder**, so it must fire at the first real
gameplay frame — never before. Three independent, racing signals; whichever is last fires it:

| Leg | Meaning | Source |
| --- | --- | --- |
| 1 | The `RoomReady` event arrived | `[SDK]` |
| 2 | The `AddPlayer` callback stored the `LudeoPlayer` | `[SDK]` |
| 3 | **The gameplay scene finished loading and the loading screen is down** | `[Layer]` — *your* loader calls `NotifySceneLoadStarted()` / `NotifySceneReady()` |

Leg 3 applies to the **capture (creator) flow as well as restore** — it is not restore-only. Skipping it
starts the encoder mid-load (the Ludeo opens on a loading screen) and, in restore, applies state into an
empty scene. Latch it at *level loaded + loading screen down*; intros/fade-ins/countdowns are inside the
recording by design. **No timeout fallthrough** — a "begin anyway after N seconds" re-creates the defect.
Clear leg 3 at the load **request**, not from inside the loader
([[a-world-ready-flag-may-still-answer-for-the-world-you-are-leaving]]).

→ Full rules and how to find the signal:
[`05-LIFECYCLE-MANAGEMENT.md` → *The `BeginGameplay` gate*](./05-LIFECYCLE-MANAGEMENT.md). Code:
`unity/REFERENCE-ARCHITECTURE.md`.

> **⚠️ Legs 1 and 2 race — `BeginGameplay` requires BOTH.** They
> are independent async events with no ordering guarantee. Calling `BeginGameplay` from `RoomReady`
> alone fails whenever `RoomReady` wins (the `LudeoPlayer` is still null → the run records nothing) —
> and it's intermittent, so it survives a first smoke test. Gate `BeginGameplay` so it fires only once
> both have completed (whichever is last), or fetch the player in the `RoomReady` handler via
> `LudeoRoom.GetPlayer(playerId, out LudeoPlayer)`. See `unity/REFERENCE-ARCHITECTURE.md`.

> **⚠️ For *restore*, leg 3 also carries the reveal.** RoomReady is
> independent of `SceneManager` — applying restored state on RoomReady while the scene is still loading
> writes into an empty scene. Gate = `RoomReady ∧
> AddPlayer ∧ sceneLoaded`. **Fire `NotifySceneReady()` only once the scene the player will see is
> finished** — async spawns settled, sim frozen-ready — not merely scene-activated,
> and keep the scene covered until it, so the player never resumes onto a level still assembling
> (07 §2.1 invariant 5 / §10.1).** See CR-010 and `unity/REFERENCE-ARCHITECTURE.md`.

→ See [`05-LIFECYCLE-MANAGEMENT.md`](./05-LIFECYCLE-MANAGEMENT.md) for the callback flow.

---

## 🔴 CR-010: Protect restored state until `Begin` — apply, *then* unfreeze, *then* `Begin`

> **⚠️ #1 RESTORATION FAILURE:** "loads the right level, but the game keeps running and the restored
> state is wrong." (And its async twin: "the restore **hangs forever** and `Begin` never fires.")

Nothing — player input, AI, or a live `Update`/`FixedUpdate` — may overwrite the restored snapshot before
`Begin` starts recording. **Two mechanisms, and the apply's shape decides which:**

- **Synchronous apply** (`Instantiate` + setters, no awaits) → **freeze** the whole apply with
  `Time.timeScale = 0f` (pause audio too if needed). Order: **apply (while frozen) → `Begin` → unfreeze.**
- **Async apply** (awaits a physics step, coroutine/`UniTask` spawn, NavMesh `Warp`/bake) → **`Time.timeScale = 0f`
  does NOT run `FixedUpdate`, so a frozen async apply DEADLOCKS** (silent hang, not a crash). Instead
  **suppress** the state-mutating systems (input, AI trees, cinematics) via `IsInLudeoFlow` while the sim
  runs, apply a **narrow freeze only around the synchronous scalar write**, then unfreeze → `Begin`. Here
  suppression — not the freeze — is the overwrite guard. Full hybrid in
  [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md) §10.1.

**Sequence:**
1. `LudeoSelected` fires → set the `IsInLudeoFlow` "restoring" flag **first** (gates pre-match cutscenes/
   countdowns/default spawns), tear down any active session/room, suppress input.
2. `Time.timeScale = 0f` and **start loading** the level scene — kicked from the `onBeginRestore`
   selection-time hook (before the room opens); pre-match sequences skip due to the flag.
3. Cache the `LudeoDataReader` from the `GetLudeo` callback. **Do not apply yet.**
4. Player presses Play → SDK runs `OpenRoom → AddPlayer → RoomReady`. BeginGameplay waits on **all three**
   of RoomReady ∧ AddPlayer ∧ **scene-loaded** (CR-009).
5. **In the `RoomReady` handler:** apply state (Pass 1 + Pass 2 + environment) → unfreeze →
   `LudeoPlayer.BeginGameplay` (sync apply may fold unfreeze into `BeginGameplay`'s callback). **Apply is never
   preceded by an unfreeze.**

**Forbidden:** applying state in the `GetLudeo` callback (before `RoomReady`); calling `Begin` before the
apply; **unfreezing before the apply runs** (live frames mid-restore); **`Time.timeScale = 0f` around an
awaited spawn** (deadlock); pausing input only while physics/AI keep running during a *synchronous* apply.

→ See [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md) §10.

---

## 🔴 CR-011: Wire pause/resume in **both** directions

> **⚠️ #1 MID-PLAY FAILURE:** "the overlay covers a game that's still playing itself."

Distinct from CR-010 (the one-time post-load freeze). Pause/resume is **two wirings, opposite directions**;
a complete integration needs both, and each fails in its own way when missing.

**Required — (a) requests, SDK → game.** The overlay opens → freeze the sim; closes → resume. Subscribe
**once, after `CreateSession` and before `Activate`**. **Cloud Player Flow only** — never in Creator Flow and
**never in a local build**, so this half cannot be exercised locally and a broken handler stays invisible
until the game is streamed. **In a local build the whole obligation is (b)** — the player pauses with the
game's own menu and the game emits the actions; don't stand that menu down on a flow flag.
```csharp
session.PauseGameRequested  += HandlePauseRequested;   // [SDK] event — subscribe before Activate
session.ResumeGameRequested += HandleResumeRequested;  // must freeze AND emit (b)
```

**Required — (b) triggers, game → SDK.** **Every** pause **during an active gameplay session** emits
`SendAction(LudeoActionKeys.PauseLudeo)` / `ResumeLudeo` at the game's pause primitive — the SDK-requested
overlay pause included, not just ESC, cutscenes, and loading screens. Freezing the sim is invisible to the
backend: the **objective timer** is frozen server-side only when your tracked action reaches its **Studio Lab
Global Trigger**. Miss this and the clock drains through every pause on **every** environment. Outside a
gameplay session (waiting to play a Ludeo, between `Begin` and `End`/`Abort`), pause with the game's own
in-game functions and emit **nothing**. Copy the idempotent form from
[`unity/CONSENT-AND-OVERLAY.md`](./unity/CONSENT-AND-OVERLAY.md) §3.2.

**Forbidden:** not registering the notifications; suppressing input only; conflating with CR-010; opening
the game's own pause menu from the request handler (it stacks under the overlay); **freezing without
emitting** — the #1 way the timer drains under the overlay; emitting from *both* the request handler and the
pause primitive (report once per transition — guard with a span flag). Note both callbacks are a plain
`Action` (no data struct). Handlers must be idempotent across repeated open/close toggles.

→ Full rules, the pause-origin table, and `PauseLudeo` vs `StartNoneLudeable`:
[`unity/CONSENT-AND-OVERLAY.md`](./unity/CONSENT-AND-OVERLAY.md) §3.

> **Persistent-singleton trap:** the CR-010 freeze and CR-011 pause flags must **start `false` each run**.
> When the integration layer is a persistent singleton (`ScriptableObject` service / `DontDestroyOnLoad` /
> `static`), its fields survive across Editor playmode sessions **and across replays within one session** — a
> pause flag left `true` last run silently holds `timeScale = 0`, so a freshly-restored Ludeo loads but never
> unfreezes (looks like dead input; on an async restore it **deadlocks**, §10.1). Reset both flags (and other
> mutable runtime state) at a deterministic lifecycle start — **and again at the start of every restore**, since
> a replay→replay re-enters restore without re-running bootstrap (07 §2.2/§10.3). Never assume zero-init. See
> [`unity/CONSENT-AND-OVERLAY.md`](./unity/CONSENT-AND-OVERLAY.md) §3 and
> [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md) §2.2/§10.3–10.4.

---

## 🟢 CR-012 (Unity): Respect consent — `canCreateLudeo` / `canPlayLudeo`

Subscribe to `PlayerConsentUpdated` (before `Activate`). Gate behaviour on the flags:

```csharp
session.PlayerConsentUpdated += data => {                 // [SDK] event
    // data.canCreateLudeo, data.canPlayLudeo
    bool sdkUsable = data.canCreateLudeo || data.canPlayLudeo;
    galleryButton.SetActive(sdkUsable);    // [Unity] hide gallery if neither
};
```
- Don't open a room **for create** unless `canCreateLudeo`; don't open **for play** unless
  `canPlayLudeo`. If both are false the user opted out — treat the SDK as disabled this run.

→ See [`unity/CONSENT-AND-OVERLAY.md`](./unity/CONSENT-AND-OVERLAY.md).

---

## 🟢 CR-013 (Unity): Touch Unity and the SDK on the main thread

The plugin marshals its callbacks to the main thread, so it's safe to touch GameObjects inside Ludeo
callbacks. If your game uses coroutines/`async`/Jobs/worker threads, **marshal back to the main
thread** before calling the SDK or mutating GameObjects (e.g. via a main-thread dispatcher).

---

## 🟢 CR-014 (Unity, conditional): Stable identity only when re-binding to persistent entities

`GetInstanceID()` and object references are **not stable across runs** — never use them to match
captured to restored objects. Restoration matches by **`ObjectType` bucket**.

- **Default (spawn-from-bucket):** create fresh GameObjects from the restored entries; no stable id
  needed.
- **Only if** you must re-bind a restored entry to a specific pre-existing/persistent entity: store
  your own stable id **as an attribute** at capture and match on it at restore.

---

## 📊 Validation checklist

- **CR-001:** all SDK access behind interfaces; game **plays normally** with consent off (dummies); compile-time define only if shipping no-package builds.
- **CR-003:** every async call checks `resultCode` inside its callback.
- **CR-005:** no SDK tick wired; attribute sampling runs per active-gameplay frame on the main thread.
- **CR-006:** Pass 1 creates all objects; Pass 2 reads attributes + resolves refs by your keys. Reset matched/singleton instances (player) to baseline before applying — they kept the prior run's gameplay **and visual** state (HUD/VFX/post-fx included).
- **CR-007 (⚠️):** every gameplay exit path routes through `End`/`Abort`; tested quit/restart/menu.
- **CR-002 (⚠️ v4.3.0):** every `WriteData`/`ReadData` is inside `using EnterObjectScope()`; component scopes nested in the object scope.
- **CR-009:** `AddPlayer`/`BeginGameplay`/`CloseRoom` only from their driving callbacks; restore `BeginGameplay` gates on RoomReady ∧ AddPlayer ∧ scene-loaded.
- **CR-010 (⚠️):** restoring-flag first → start load (onBeginRestore) → freeze → cache reader → on RoomReady **apply → unfreeze → BeginGameplay** (never unfreeze before apply; never `timeScale=0` around an awaited spawn — suppress instead).
- **CR-011 (⚠️):** both directions — (a) `PauseGameRequested`/`ResumeGameRequested` subscribed before Activate, freeze the sim; (b) `PauseLudeo`/`ResumeLudeo` emitted at the game's pause primitive on **every** pause, the SDK-requested one included, so the objective timer actually stops. Freezing ≠ stopping the clock. Emit once per transition; the action must be mapped to a Studio Lab Global Trigger to have any effect.
- **CR-012:** consent flags gate create/play and the gallery button.
- **CR-013:** SDK/GameObject access on the main thread.
- **CR-014:** no cross-run instance ids; stable-id-as-attribute only when re-binding.
- **N/A (handled by plugin):** CR-004 (window handle), CR-008 (release info — but the `LudeoDataReader` is now `IDisposable`). *(CR-002 is no longer N/A — see above.)*

---

## 🔗 Related documents

- [`05-LIFECYCLE-MANAGEMENT.md`](./05-LIFECYCLE-MANAGEMENT.md) — full callback/notification flow.
- [`06-TRACKING-PATTERNS.md`](./06-TRACKING-PATTERNS.md) — handlers, attributes, actions.
- [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md) — `LudeoSelected` → play flow, two-pass.
- [`12-SDK-API-REFERENCE.md`](./12-SDK-API-REFERENCE.md) — exact signatures.
- [`unity/REFERENCE-ARCHITECTURE.md`](./unity/REFERENCE-ARCHITECTURE.md) — the prescribed layer.

**Remember:** these are non-negotiable. The N/A ones are not "skipped" — they're handled for you by
the managed wrapper.
