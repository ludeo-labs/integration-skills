# 12 — Ludeo Unity SDK API Reference (C#)

> **Source of truth.** Every other doc in this skill cites this file for exact signatures. It is
> derived from the managed `LudeoSDK` assembly (the Ludeo Unity plugin) and cross-checked against
> the plugin's bundled reference integration (`LudeoController` + the tracker/replayer sample under
> `Assets/_LudeoNonBuild/`). If a signature here ever disagrees with the installed package, the
> installed package wins — re-verify against it.
>
> **Pinned to:** Ludeo Unity package `com.ludeosdk.unity` **v4.3.0** (CoreSDK 4.2.0). Verify the
> version in the project's `Packages/manifest.json` / package `package.json`.
>
> **⚠️ v4.3.0 is a breaking rewrite** that aligned the Unity API with the Unreal plugin. If you have
> seen older skill guidance (or an older integration), read [§ What changed in v4.3.0](#-what-changed-in-v430)
> at the bottom — many old names (`InitLudeoSession`, `LudeoStateObject`, `SetAttribute`,
> `AddGamePlayer`, `AddNotify*`, `LudeoGameplaySession`) **no longer exist**.

- **Namespace:** `using LudeoSDK;`
- **Init is synchronous and two-step.** `LudeoManager.Initialize()` (returns `LudeoResult`) then
  `LudeoManager.SessionManager.CreateSession(out LudeoSession)` (returns `LudeoResult`). Neither takes
  a callback — check the returned `LudeoResult == LudeoResult.Success`.
- **Backend ops are callback-based.** `Activate`, `OpenRoom`, `GetLudeo`, `AddPlayer`, `RemovePlayer`,
  `CloseRoom`, `BeginGameplay`, `EndGameplay`, `AbortGameplay` return `void` and report success/failure
  via an `Action<…CallbackData>`. Check `data.resultCode == LudeoResult.Success` **inside the callback**
  — never treat the call as synchronous. Each has a **`…Async`** `Task`-returning overload
  (`ActivateAsync`, `OpenRoomAsync`, `GetLudeoAsync`, `AddPlayerAsync`, `RemovePlayerAsync`,
  `CloseRoomAsync`, `BeginGameplayAsync`, `EndGameplayAsync`, `AbortGameplayAsync`) whose continuation
  resumes on the Unity main thread when awaited from it.
- **Notifications are C# events on `LudeoSession`**, not `AddNotify*` methods. Subscribe with `+=`
  **before** `Activate` (the session registers them natively inside `Activate`).
- **There is no `clientData` / `GetClientData<T>()`** anymore — C# closures capture context directly.
- **Writes and reads are scoped.** `WriteData`/`ReadData` only take effect inside an **open scope**
  opened via `using (obj.EnterObjectScope())` (and `using (component.EnterComponentScope())` nested
  inside it). This is a hard requirement — see [`00-CRITICAL-REQUIREMENTS.md` CR-002](./00-CRITICAL-REQUIREMENTS.md).
- **The SDK ticks itself.** `LudeoManager.Tick()` is internal, driven by the plugin's
  `LudeoUnityManager`. Do not call it. The game only drives its own attribute-sampling cadence.

---

## Object graph — who creates what

```
LudeoManager  (static entry point)
  ├─ Initialize() : LudeoResult ───────────────► brings up the SDK (no session yet)
  └─ SessionManager.CreateSession(out session) ► LudeoSession            (one per app run)
       └─ Activate(cb, loc)                                              connects to backend
       └─ OpenRoom(params, cb) ──────────► LudeoRoom  (one active; LudeoRoom.ActiveRoom)
            ├─ AddPlayer(params, cb) ─────► LudeoPlayer               (per player; single-player = 1)
            │    └─ Begin/End/AbortGameplay(cb)                       gameplay lifetime
            └─ Writer  (LudeoRoomWriter) ─► CreateObject(type) ─► LudeoWritableObject  (capture)
                 │                                └─ using EnterObjectScope() → WriteData(name, value)
                 │                                └─ CreateOrGetComponent ─► LudeoWritableComponent
                 └─ SendAction(playerId, action)
       └─ GetLudeo(id, cb) ──────────────► LudeoDataReader                (play/restore)
            └─ GetObjects(out arr) ───────► LudeoReadableObject[]
                 └─ using EnterObjectScope() → ReadData(name, out value) / GetAllAttributes(out …)
```

**Two flows share these types:**
- **Creator (capture):** `OpenRoom(roomId)` → `AddPlayer` → `BeginGameplay` → `room.Writer.CreateObject`
  + (per tick) `using EnterObjectScope()` / `WriteData` → `EndGameplay`/`AbortGameplay` → `CloseRoom`.
- **Play (restore):** `LudeoSelected` event → `GetLudeo(id)` → `LudeoDataReader.GetObjects` →
  `OpenRoom(roomId, ludeoId)` → `AddPlayer` → `RoomReady` → apply state (scoped reads) → `BeginGameplay`.

---

## `LudeoManager` — static entry point (`IDisposable`)

| Member | Signature | Notes |
| --- | --- | --- |
| Initialize | `static LudeoResult Initialize()` | Call **once** per app run, **before** anything else. Sets up the SDK core + `LudeoUnityManager`; does **not** create a session. Returns `LudeoManagerAlreadyInitialized` if already up (treat as a no-op success). |
| Session manager | `static LudeoSessionManager SessionManager { get; }` | Lazily created; use it to create the session **after** `Initialize` succeeds. |
| Logging level | `static LudeoResult SetLoggingLevel(LudeoLogLevel level, LudeoLogCategory category = LudeoLogCategory.All)` | |
| Logging sink | `static LudeoResult SetLoggingCallback(Action<string> info, Action<string> warning, Action<string> error)` | Defaults route to `Debug.Log/LogWarning/LogError`. |
| Core dll name | `static string CoreDllName { get; }` | Which native core dll resolved (Release/Development). |
| Tick | *internal* | **Not callable.** Plugin-driven via `LudeoUnityManager`. |

```csharp
if (LudeoManager.Initialize() is var init && init != LudeoResult.Success
        && init != LudeoResult.LudeoManagerAlreadyInitialized)
{
    Debug.LogError($"[Ludeo] Initialize failed: {init}");   // stop — no SDK this run
    return;
}
if (LudeoManager.SessionManager.CreateSession(out LudeoSession session) != LudeoResult.Success)
{
    Debug.LogError("[Ludeo] CreateSession failed");
    return;
}
// subscribe to session events HERE, then session.Activate(...)
```

## `LudeoSessionManager` — session factory

Obtain via `LudeoManager.SessionManager` (never `new`).

| Member | Signature |
| --- | --- |
| Create session | `LudeoResult CreateSession(out LudeoSession ludeoSession)` |

---

## `LudeoSession` — backend connection (`IDisposable`)

Get it from `SessionManager.CreateSession`. **Subscribe to the events below (with `+=`) before
`Activate`** — `Activate` is what registers them natively.

| Member | Signature |
| --- | --- |
| Activate | `void Activate(Action<LudeoSessionActivateCallbackData> cb, LudeoSessionSetLocalizationParameters loc = default)` · `Task<…> ActivateAsync(loc = default)` |
| Open room | `void OpenRoom(LudeoSessionOpenRoomParameters data, Action<LudeoOpenRoomCallbackData> cb)` · `Task<…> OpenRoomAsync(data)` |
| Get ludeo | `void GetLudeo(Guid ludeoId, Action<LudeoGetLudeoCallbackData> cb)` · `Task<…> GetLudeoAsync(ludeoId)` |
| Set localization | `void SetLocalization(LudeoSessionSetLocalizationParameters loc)` |

**Events** (subscribe with `+=` after `CreateSession`, before `Activate`; unsubscribe with `-=`):

| Event | Delegate type | Fires when |
| --- | --- | --- |
| `LudeoSelected` | `Action<LudeoSelectedCallbackData>` | Player chose to play a Ludeo (carries `ludeoId`) |
| `RoomReady` | `Action<LudeoSessionRoomReadyCallbackData>` | Opened room is ready for play (carries `ludeoRoom`) |
| `PlayerConsentUpdated` | `Action<LudeoSessionConsentUpdatedCallbackData>` | Consent changed (`canCreateLudeo`, `canPlayLudeo`) |
| `PauseGameRequested` | `Action` | Overlay requests pause — **no args** |
| `ResumeGameRequested` | `Action` | Overlay requests resume — **no args** |
| `GameBackToMenuRequested` | `Action` | Player exits the Ludeo to main menu — **no args** |
| `MuteGameRequested` | `Action<LudeoSessionMuteRequestCallbackData>` | Mute/unmute requested (`isMuted`) |
| `LocalizationUpdated` | `Action<LudeoSessionLocalizationChangedCallbackData>` | Overlay language changed (`language`) |

> ⚠️ The event names are **`PauseGameRequested` / `ResumeGameRequested` / `GameBackToMenuRequested` /
> `PlayerConsentUpdated`** — not the old `AddNotifyPauseGame` / `…ResumeGame` / `…ReturnToMainMenu` /
> `…ConsentUpdated` methods. Pause/resume/back-to-menu are plain `Action` (no data struct).

```csharp
session.LudeoSelected        += HandleLudeoSelected;
session.RoomReady            += HandleRoomReady;
session.PlayerConsentUpdated += HandleConsentUpdated;
// CR-011 needs BOTH halves in these handlers: freeze the sim AND emit PauseLudeo/ResumeLudeo —
// the freeze alone doesn't stop the Ludeo objective timer. See unity/CONSENT-AND-OVERLAY.md §3.
session.PauseGameRequested   += HandlePauseRequested;    // freeze + SendAction(PauseLudeo)
session.ResumeGameRequested  += HandleResumeRequested;   // unfreeze + SendAction(ResumeLudeo)
session.GameBackToMenuRequested += HandleReturnToMainMenu;
session.MuteGameRequested    += d => SetMuted(d.isMuted);
session.LocalizationUpdated  += d => SetLanguage(d.language);
session.Activate(HandleActivateDone);   // registers the above natively; check resultCode in the cb
```

**You OWN the `LudeoSession`.** It is `IDisposable`; `Dispose()` it on shutdown (`OnApplicationQuit`).
Disposing the session also disposes `LudeoRoom.ActiveRoom` if one is open.

---

## `LudeoRoom` — gameplay room (`IDisposable`)

Singleton-style: `static LudeoRoom ActiveRoom`. Obtained from the `OpenRoom` callback
(`data.ludeoRoom`) or the `RoomReady` event.

| Member | Signature |
| --- | --- |
| **Writer** | `LudeoRoomWriter Writer { get; }` — the capture/actions API (Creator flow) |
| Add player | `void AddPlayer(LudeoRoomAddPlayerParameters data, Action<LudeoRoomAddPlayerCallbackData> cb)` · `AddPlayerAsync(data)` |
| Remove player | `void RemovePlayer(LudeoRoomRemovePlayerParameters data, Action<LudeoRoomRemovePlayerCallbackData> cb)` · `RemovePlayerAsync(data)` |
| Get player | `LudeoResult GetPlayer(string playerId, out LudeoPlayer player)` |
| Close room | `void CloseRoom(Action<LudeoCloseRoomCallbackData> cb)` · `CloseRoomAsync()` |

The `AddPlayer` callback delivers the `LudeoPlayer` (`data.player`).

---

## `LudeoRoomWriter` — capture + actions (Creator flow)

Obtained from `LudeoRoom.ActiveRoom.Writer` (or `data.ludeoRoom.Writer`). This is where object
creation and actions moved to in v4.3.0.

| Member | Signature | Notes |
| --- | --- | --- |
| **Create capture object** | `LudeoResult CreateObject(string objectType, out LudeoWritableObject obj)` | |
| Get/recreate object | `LudeoResult GetObject(string objectType, uint objectId, out LudeoWritableObject obj)` | |
| Destroy object | `LudeoResult DestroyObject(LudeoWritableObject obj)` | equivalent to `obj.DestroyObject()` |
| **Send action** | `LudeoResult SendAction(string playerId, string action)` | Parameterless game action ("Kill", "HeadShot"); bound to `playerId`. (Or `LudeoPlayer.SendAction(action)` — binds to that player.) |
| Send batching | `LudeoResult SetSendSettings(uint sendIntervalMs)` | Optional; sensible defaults. Main thread only. |

---

## `LudeoPlayer` — one player's playable moment

From the `AddPlayer` callback (`data.player`). Lifetime: created → `BeginGameplay` →
`EndGameplay`/`AbortGameplay`. Invalidated by `RemovePlayer` / `CloseRoom`.

| Member | Signature | Notes |
| --- | --- | --- |
| Player id | `string PlayerId { get; }` | the id passed to `AddPlayer` |
| Begin | `void BeginGameplay(Action<LudeoPlayerBeginGameplayCallbackData> cb)` · `BeginGameplayAsync()` | Starts SDK recording of the moment |
| End | `void EndGameplay(Action<LudeoPlayerEndGameplayCallbackData> cb)` · `EndGameplayAsync()` | Normal finish → creates the Ludeo |
| Abort | `void AbortGameplay(Action<LudeoPlayerAbortGameplayCallbackData> cb)` · `AbortGameplayAsync()` | Discard the moment |
| Send action | `void SendAction(string action)` | Bound to this player's `PlayerId` |
| ~~MarkHighlight~~ | *obsolete* (`[Obsolete]`) | Highlights handled internally; do not call |

---

## `LudeoWritableObject` — capture context (`IDisposable`)

Created via `LudeoRoom.Writer.CreateObject`. Properties: `string ObjectType`, `uint ObjectId`,
`string[] PlayerIds`.

| Member | Signature |
| --- | --- |
| **Open write scope** | `LudeoWriteScope EnterObjectScope()` — use in a `using` block; `WriteData` only counts inside it |
| Write attribute | `void WriteData(string name, T value)` where `T ∈ { int, float, double, bool, string, Vector3, Quaternion, byte[] }` |
| Blob (sized) | `void WriteData(string name, byte[] data, uint size = uint.MaxValue)` |
| Bind player | `bool BindPlayer(string playerId)` |
| Nested component | `LudeoResult CreateOrGetComponent(string name, out LudeoWritableComponent comp)` |
| Destroy | `LudeoResult DestroyObject()` |

```csharp
using (writableObject.EnterObjectScope())          // REQUIRED — writes are ignored outside a scope
{
    writableObject.WriteData(LudeoKeys.HP, hp);
    writableObject.WriteData(LudeoKeys.Position, transform.position);   // Vector3 → Vec3Float
    writableObject.WriteData(LudeoKeys.Rotation, transform.rotation);   // Quaternion → Vec4Float
}
```

- **Only these typed overloads exist.** There is no `uint`/`long`/`short` overload — cast to `int`/
  `double` (or a blob) if you need a wider integer. `Vector3`→`Vec3Float`, `Quaternion`→`Vec4Float`
  are preserved as fixed-point internally.
- **Prefer discrete typed attributes over `byte[]` blobs.**
- Values are cached and **diff-sent on the SDK's internal tick** — only changed values go to the
  backend. Calling `WriteData` does not itself send.

### `LudeoWritableComponent` — nested attribute scope
From `LudeoWritableObject.CreateOrGetComponent`. Properties: `string ParentObject`, `string Name`.
Same `WriteData` overloads. Open its scope **inside** the parent object's scope:

```csharp
using (writableObject.EnterObjectScope())
using (writableComponent.EnterComponentScope())
{
    writableComponent.WriteData(LudeoKeys.Ammo, ammo);
}
```

---

## `LudeoDataReader` — restore data (`IDisposable`)

From the `GetLudeo` callback (`data.ludeoDataReader`). Properties: `string PlayerId`, `string LudeoId`.
Lifetime is tied to the session (invalidated when the session is destroyed).

| Member | Signature |
| --- | --- |
| Get all objects | `LudeoResult GetObjects(out LudeoReadableObject[] objects)` |

`LudeoDataReader` is `IDisposable`. Dispose it when you are done restoring (e.g. after the run ends),
or let the session teardown release it. The returned `LudeoReadableObject[]` is managed.

### `LudeoReadableObject` — one restored object (`IDisposable`, `: LudeoRestoreBase`)
Properties: `uint ObjectId`, `string ObjectType`.

| Member | Signature |
| --- | --- |
| **Open read scope** | `LudeoReadScope EnterObjectScope()` — use in a `using` block; reads only work inside it |
| Read attribute | `bool ReadData(string name, out T value)` where `T ∈ { int, float, double, bool, string, Vector3, Quaternion, byte[] }` |
| Bulk read (all) | `void GetAllAttributes(out LudeoAttributesCollection all)` — one native traversal (preferred) |
| Bulk read (typed) | `void GetAllAttributes(out Dictionary<string,int/float/double/bool/Vector3/Quaternion/string>)` |
| All components | `void GetAllComponents(out Dictionary<string, LudeoReadableComponent>)` · blobs: `out Dictionary<string, Tuple<uint, byte[]>>` |
| Exists? | `bool IsAttributeExists(string name, out LudeoDataType type)` |
| Nested component | `LudeoResult CreateOrGetComponent(string name, out LudeoReadableComponent comp)` |

```csharp
using (readable.EnterObjectScope())                 // REQUIRED — reads outside a scope are ignored
{
    readable.ReadData(LudeoKeys.HP, out int hp);
    readable.ReadData(LudeoKeys.Position, out Vector3 pos);
    // or, cheaper when you need many at once:
    readable.GetAllAttributes(out LudeoAttributesCollection all);
    all.GetAllAttributes(out Dictionary<string, float> floats);
}
```

Restoration groups these **by `ObjectType`** (see [`07-RESTORATION-PATTERNS.md`](./07-RESTORATION-PATTERNS.md)):
build a `Dictionary<string, List<LudeoReadableObject>>`, take `[0]` for singletons, iterate for
collections. `ReadData` returns `false` if the name is absent, the type mismatches, or you are not
inside an open scope. Prefer **one `GetAllAttributes` per object** over many `ReadData` calls — each
`GetAllAttributes(out Dictionary<…>)` re-walks the whole context; the `LudeoAttributesCollection`
overload walks once.

### `LudeoReadableComponent` — nested read scope (`: LudeoRestoreBase`)
From `LudeoReadableObject.CreateOrGetComponent`. Properties: `string ParentObject`, `string Name`.
`ReadData` / `GetAll*` / `IsAttributeExists` as above; open `EnterComponentScope()` **inside** the
parent object's read scope.

### `LudeoRestoreBase` / `LudeoAttributesCollection`
`LudeoReadableObject` and `LudeoReadableComponent` both derive from `LudeoRestoreBase`, which supplies
the `GetAllAttributes` / `GetAllComponents` overloads. `LudeoAttributesCollection` is the one-shot
snapshot returned by `GetAllAttributes(out LudeoAttributesCollection)`; read the per-type dictionaries
off it with the same `GetAllAttributes(out Dictionary<…>)` overloads.

### `LudeoWriteScope` / `LudeoReadScope` — scope handles (`IDisposable` readonly struct)
Returned by `EnterObjectScope`/`EnterComponentScope`. Always consume via `using`. `bool IsValid` tells
you the scope actually opened (writes/reads are ignored when `false`). Disposal leaves the scope.

---

## Enums

### `LudeoResult` (check for `Success`)
`Success`(0), `InvalidVersion`, `InvalidParameters`, `InvalidAuth`, `NotFound`, `TimedOut`,
`Unknown`, `WrongState`, `SDKDisabled`, `NetworkError`, `Canceled`, `InvalidConfiguration`,
`WrongType`, `InvalidData`, plus wrapper codes: `WrapperDllNotFound`, `LudeoNotYetInit`,
`LudeoManagerAlreadyInitialized`, `LudeoManagerAlreadyDisposed`, `WrapperException`,
`GameSessionNotFound`, `CaptureServiceError`, `CaptureServiceInitFailed`.

> `SDKDisabled` — the backend disabled the SDK; stop attempting to create sessions.
> `WrapperDllNotFound` — native DLL missing (build/package/platform issue).
> `LudeoManagerAlreadyInitialized` — `Initialize()` was already called; treat as a benign no-op.
> `LudeoNotYetInit` — `CreateSession` (or another op) ran before `Initialize()` succeeded.
> `GameSessionNotFound` — `GetPlayer` was asked for an unknown `playerId`.
> `InvalidAuth` — from the `Activate` callback: implicit (Steam) auth but Steam wasn't initialized
> before `Activate` (the SDK won't init it), or an invalid `launcherUserId` in explicit mode. Treat
> as non-fatal — continue without Ludeo (`05-LIFECYCLE-MANAGEMENT.md`, `unity/UPM-INSTALL-AND-DEFINES.md §3`).
> Two cause-families (code-ordering vs Steam-environment) + red-herring logs: `unity/READING-UNITY-LOGS.md`.

### `LudeoDataType` (attribute types)
`Bool`, `Int8`, `UInt8`, `Int16`, `UInt16`, `Int32`(=`Int`), `UInt32`(=`Uint`), `Int64`, `UInt64`,
`Float`, `Double`, `String`, `Vec3Float`, `Vec4Float`(=`QuatFloat`), `Blob`, `Component`.

---

## Callback-data & parameter structs

| Struct | Key public fields |
| --- | --- |
| `LudeoSessionActivateCallbackData` | `resultCode`, `isLudeoSelected` |
| `LudeoSelectedCallbackData` | `ludeoId` (`Guid`) |
| `LudeoSessionRoomReadyCallbackData` | `ludeoRoom` |
| `LudeoSessionConsentUpdatedCallbackData` | `canCreateLudeo`, `canPlayLudeo` |
| `LudeoSessionMuteRequestCallbackData` | `isMuted` |
| `LudeoSessionLocalizationChangedCallbackData` | `language` |
| `LudeoOpenRoomCallbackData` | `resultCode`, `ludeoRoom` |
| `LudeoCloseRoomCallbackData` | `resultCode` |
| `LudeoGetLudeoCallbackData` | `resultCode`, `ludeoDataReader` |
| `LudeoRoomAddPlayerCallbackData` | `resultCode`, `player` (`LudeoPlayer`) |
| `LudeoRoomRemovePlayerCallbackData` | `resultCode` |
| `LudeoPlayerBeginGameplayCallbackData` / `…EndGameplayCallbackData` / `…AbortGameplayCallbackData` | `resultCode` |
| `LudeoSessionOpenRoomParameters` | ctors: `(string roomId)` creator · `(string roomId, Guid ludeoId)` play · `(Guid ludeoId)` play. Fields: `ThreadSafe` (bool), `MaxConcurrentWrites` (uint, 0 = SDK default 1024). A parameterless `new LudeoSessionOpenRoomParameters()` = creator with an SDK-chosen roomId. |
| `LudeoRoomAddPlayerParameters` | ctor `(string playerId)` |
| `LudeoRoomRemovePlayerParameters` | ctor `(string playerId)` |
| `LudeoSessionSetLocalizationParameters` | `language` (2-char code), `supportedLanguages` (`string[]`, optional) |

There is **no** `GetClientData<T>()` and **no** `<T>` clientData overloads — capture context in the
C# closure instead.

---

## Rules & gotchas (cited by later phases)

1. **Init is sync + two-step, backend ops are callbacks.** `Initialize()` + `CreateSession(out …)`
   return a `LudeoResult` directly; `Activate`/`OpenRoom`/`GetLudeo`/`AddPlayer`/`BeginGameplay`/etc.
   deliver their result only inside the callback (the call returns `void`).
2. **Subscribe to events before `Activate`.** `Activate` registers them natively; late subscribers
   miss early notifications.
3. **`isLudeoSelected == true`** in the Activate callback guarantees a `LudeoSelected` event follows
   shortly — branch into the play flow rather than starting normal gameplay. `false` does **not** rule
   a Ludeo out — `LudeoSelected` can arrive at any time after `Activate`.
4. **Every `WriteData`/`ReadData` is inside a `using` scope (CR-002).** Component scopes nest inside
   the parent object scope. Writes/reads outside a scope are silently dropped.
5. **Attributes over blobs.** Use typed `WriteData`; reserve `byte[]` for genuinely opaque data.
6. **No manual tick.** The plugin ticks the SDK; managed arrays + GC handle reader data.
7. **Identity is not an SDK id-map.** Restore matches by `ObjectType` bucket + your own key
   attributes; `uint ObjectId` is SDK-assigned, not your stable game id.
8. **`IDisposable` types:** `LudeoManager`, `LudeoSession`, `LudeoRoom`, `LudeoWritableObject`,
   `LudeoDataReader`, `LudeoReadableObject` (+ the `LudeoWriteScope`/`LudeoReadScope` structs via
   `using`). The SDK disposes the room internally (disposing the session disposes `ActiveRoom`); the
   state/reader objects are managed. **But you OWN the `LudeoSession`** returned by `CreateSession`:
   `Dispose()` it on shutdown (`OnApplicationQuit`). Skipping this is masked in a built player but
   breaks Editor re-init — a later Play can return `WrongState`
   (`Client still holding a handle to a Session instance`). See `05-LIFECYCLE-MANAGEMENT.md` "Shutdown".

---

## 🔄 What changed in v4.3.0

Old skill guidance / older integrations used the pre-4.3.0 API. Everything in the left column is
**gone** (no compatibility shims):

| Removed / old (≤4.0.x) | New (v4.3.0) |
| --- | --- |
| `LudeoManager.InitLudeoSession(cb)` (async, delivers session) | `LudeoManager.Initialize()` + `LudeoManager.SessionManager.CreateSession(out session)` (both sync) |
| `LudeoSessionInitCallbackData` | *(none — `CreateSession` uses an `out` param)* |
| `session.AddNotifyLudeoSelected(…)` etc. + `RemoveNotify…` | C# events: `session.LudeoSelected += …` etc. |
| `AddNotifyPauseGame` / `…ResumeGame` / `…ReturnToMainMenu` / `…ConsentUpdated` | `PauseGameRequested` / `ResumeGameRequested` / `GameBackToMenuRequested` / `PlayerConsentUpdated` |
| `LudeoOpenRoomData` | `LudeoSessionOpenRoomParameters` |
| `room.AddGamePlayer(LudeoRoomAddGamePlayerData, cb)` | `room.AddPlayer(LudeoRoomAddPlayerParameters, cb)` |
| `room.RemoveGameplayer(…)` | `room.RemovePlayer(…)` |
| `room.GetGamePlaySession(id, out LudeoGameplaySession)` | `room.GetPlayer(id, out LudeoPlayer)` |
| callback `data.ludeoGameplaySession` | `data.player` (`LudeoPlayer`) |
| `LudeoGameplaySession` + `Begin`/`End`/`Abort` | `LudeoPlayer` + `BeginGameplay`/`EndGameplay`/`AbortGameplay` |
| `LudeoGameplaySession.SendAction(action)` | `room.Writer.SendAction(playerId, action)` **or** `LudeoPlayer.SendAction(action)` |
| `room.CreateStateObject(type, out LudeoStateObject)` | `room.Writer.CreateObject(type, out LudeoWritableObject)` |
| `room.GetStateObject(type, id, out …)` | `room.Writer.GetObject(type, id, out …)` |
| `LudeoStateObject` + `SetAttribute(name, value)` | `LudeoWritableObject` + `using EnterObjectScope()` → `WriteData(name, value)` |
| `LudeoStateObject.DestroyStateObject()` | `LudeoWritableObject.DestroyObject()` / `Writer.DestroyObject(obj)` |
| `LudeoStateComponent` + `CreateOrGetStateComponent` | `LudeoWritableComponent` + `CreateOrGetComponent` + `EnterComponentScope()` |
| `LudeoDataReader.GetStateObjects(out LudeoStateObjectRestore[])` | `LudeoDataReader.GetObjects(out LudeoReadableObject[])` |
| `LudeoStateObjectRestore` + `TryGetAttribute(name, out v)` | `LudeoReadableObject` + `using EnterObjectScope()` → `ReadData(name, out v)` (or `GetAllAttributes`) |
| `LudeoStateComponentRestore` | `LudeoReadableComponent` |
| `<T>` clientData overloads + `GetClientData<T>()` | *(removed — use C# closures)* |
| `LudeoSessionLocalizationData` | `LudeoSessionSetLocalizationParameters` |

New in v4.3.0: `…Async` (`Task`) overloads for every callback op; thread-safe writer via
`LudeoSessionOpenRoomParameters.ThreadSafe` / `MaxConcurrentWrites`; `LudeoRoomWriter.SetSendSettings`;
bulk restore reads via `GetAllAttributes(out LudeoAttributesCollection)`. `LudeoDataReader` was
intentionally **not** renamed.
