# 12 — Ludeo Unity SDK API Reference (C#)

> **Source of truth.** Every other doc in this skill cites this file for exact signatures. It is
> derived from the managed `LudeoSDK` assembly (the Ludeo Unity plugin) and cross-checked against
> the `ludeosdk-unity-game-tank` reference integration. If a signature here ever disagrees with the
> installed package, the installed package wins — re-verify against it.
>
> **Pinned to:** Ludeo Unity package `com.ludeosdk.unity` (verify version in the project's
> `Packages/manifest.json` / package `package.json`).

- **Namespace:** `using LudeoSDK;`
- **Everything async is callback-based.** `Activate`, `OpenRoom`, `AddGamePlayer`, `Begin`, `End`,
  `Abort`, `GetLudeo`, `CloseRoom`, `RemoveGameplayer` return `void` and report success/failure via
  an `Action<…CallbackData>`. Check `data.resultCode == LudeoResult.Success` **inside the callback**
  — never treat the call as synchronous.
- **The SDK ticks itself.** `LudeoManager.Tick()` is internal, driven by the plugin's
  `LudeoUnityManager`. Do not call it. The game only drives its own attribute-sampling cadence.
- **Every callback-data struct** carries `LudeoResult resultCode` (where applicable) and a
  `T GetClientData<T>()` to retrieve context passed via the generic `<T>` call overloads.

---

## Object graph — who creates what

```
LudeoManager  (static entry point)
  └─ InitLudeoSession(cb) ─────────────► LudeoSession            (one per app run)
       └─ Activate(cb)                                            connects to backend
       └─ OpenRoom(data, cb) ──────────► LudeoRoom               (one active; ActiveRoom)
            └─ AddGamePlayer(data, cb) ─► LudeoGameplaySession    (per player; tank = 1)
                 └─ Begin/End/Abort(cb)                           gameplay lifetime
            └─ CreateStateObject(type) ─► LudeoStateObject        (capture; per tracked entity)
                 └─ SetAttribute(name, value)                     typed attributes
                 └─ CreateOrGetStateComponent ─► LudeoStateComponent  (nested attributes)
       └─ GetLudeo(id, cb) ────────────► LudeoDataReader          (play/restore)
            └─ GetStateObjects() ───────► LudeoStateObjectRestore[]
                 └─ TryGetAttribute(name, out value)              read back attributes
```

**Two flows share these types:**
- **Creator (capture):** `OpenRoom(roomId)` → `AddGamePlayer` → `Begin` → create `LudeoStateObject`s
  + `SetAttribute` each tick → `End`/`Abort` → `CloseRoom`.
- **Play (restore):** `LudeoSelected` notification → `GetLudeo(id)` → read `LudeoDataReader` →
  `OpenRoom(roomId, ludeoId)` → `AddGamePlayer` → `RoomReady` → apply state → `Begin`.

---

## `LudeoManager` — static entry point (`IDisposable`)

| Member | Signature | Notes |
| --- | --- | --- |
| Init | `static void InitLudeoSession(Action<LudeoSessionInitCallbackData> cb)` | Call **once** per app run. Callback delivers the `LudeoSession`. `<T>` overload adds `clientData`. |
| Logging level | `static LudeoResult SetLoggingLevel(LudeoLogLevel level, LudeoLogCategory category = LudeoLogCategory.All)` | |
| Logging sink | `static LudeoResult SetLoggingCallback(Action<string> info, Action<string> warning, Action<string> error)` | Defaults route to `Debug.Log/LogWarning/LogError`. |
| Tick | *internal* | **Not callable.** Plugin-driven via `LudeoUnityManager`. |

The session created by `InitLudeoSession` succeeds only if `data.resultCode == LudeoResult.Success`;
then read `data.ludeoSession`.

---

## `LudeoSession` — backend connection (`IDisposable`)

Get it from the `InitLudeoSession` callback. Register notifications **before** `Activate`.

| Member | Signature |
| --- | --- |
| Activate | `void Activate(Action<LudeoSessionActivateCallbackData> cb, LudeoSessionLocalizationData loc = default)` (+ `<T>` clientData overload) |
| Open room | `void OpenRoom(LudeoOpenRoomData data, Action<LudeoOpenRoomCallbackData> cb)` (+ `<T>`) |
| Get ludeo | `void GetLudeo(Guid ludeoId, Action<LudeoGetLudeoCallbackData> cb)` (+ `<T>`) |
| Open gallery | `void OpenGallery()` |
| Set localization | `void SetLocalization(LudeoSessionLocalizationData loc)` |

**Notifications** (register after init, before `Activate`; each has a matching `RemoveNotify…`):

| Method | Callback type | Fires when |
| --- | --- | --- |
| `AddNotifyLudeoSelected` | `Action<LudeoSelectedCallbackData>` | Player chose to play a Ludeo (carries `ludeoId`) |
| `AddNotifyRoomReady` | `Action<LudeoSessionRoomReadyCallbackData>` | Opened room is ready for play (carries `ludeoRoom`) |
| `AddNotifyConsentUpdated` | `Action<LudeoSessionConsentUpdatedCallbackData>` | Consent changed (`canCreateLudeo`, `canPlayLudeo`) |
| `AddNotifyPauseGame` | `Action` | Overlay requests pause — **no args** |
| `AddNotifyResumeGame` | `Action` | Overlay requests resume — **no args** |
| `AddNotifyReturnToMainMenu` | `Action` | Player exits the Ludeo to main menu — **no args** |
| `AddNotifyMuteRequest` | `Action<LudeoSessionMuteRequestCallbackData>` | Mute/unmute requested (`isMuted`) |
| `AddNotifyLocalizationChanged` | `Action<LudeoSessionLocalizationChangedCallbackData>` | Overlay language changed (`language`) |

> ⚠️ The names are `AddNotifyPauseGame` / `AddNotifyResumeGame` — **not** `…PauseGameRequest`. Pause
> and resume callbacks take a plain `Action` (no data struct).

---

## `LudeoRoom` — gameplay room (`IDisposable`)

Singleton-style: `static LudeoRoom ActiveRoom`. Obtained from the `OpenRoom` callback
(`data.ludeoRoom`) or the `RoomReady` notification.

| Member | Signature |
| --- | --- |
| Add player | `void AddGamePlayer(LudeoRoomAddGamePlayerData data, Action<LudeoRoomAddGamePlayerCallbackData> cb)` (+ `<T>`) |
| Remove player | `void RemoveGameplayer(LudeoRoomRemoveGamePlayerData data, Action<LudeoRoomRemovePlayerCallbackData> cb)` (+ `<T>`) |
| Get gameplay session | `LudeoResult GetGamePlaySession(string gamePlayerId, out LudeoGameplaySession session)` |
| Close room | `void CloseRoom(Action<LudeoCloseRoomCallbackData> cb)` (+ `<T>`) |
| **Create capture object** | `LudeoResult CreateStateObject(string objectType, out LudeoStateObject obj)` |
| Get/recreate object | `LudeoResult GetStateObject(string objectType, uint objectId, out LudeoStateObject obj)` |

The `AddGamePlayer` callback delivers the `LudeoGameplaySession` (`data.ludeoGameplaySession`).

---

## `LudeoGameplaySession` — one player's playable moment

From the `AddGamePlayer` callback. Lifetime stages: created → `Begin` → `End`/`Abort`.

| Member | Signature | Notes |
| --- | --- | --- |
| Begin | `void Begin(Action<LudeoGameplaySessionBeginCallbackData> cb)` (+ `<T>`) | Starts SDK recording of the moment |
| End | `void End(Action<LudeoGameplaySessionEndCallbackData> cb)` (+ `<T>`) | Normal finish → creates the Ludeo |
| Abort | `void Abort(Action<LudeoGameplaySessionAbortCallbackData> cb)` (+ `<T>`) | Discard the moment |
| Send action | `void SendAction(string action)` | Parameterless game action ("Kill", "HeadShot"); bound to the room's player |
| ~~MarkHighlight~~ | *obsolete* | Highlights handled internally; do not call |

---

## `LudeoStateObject` — capture context (`IDisposable`)

Created via `LudeoRoom.CreateStateObject`. Properties: `string ObjectType`, `uint ObjectId`,
`string[] GamePlayerIds`.

| Member | Signature |
| --- | --- |
| Set attribute | `void SetAttribute(string name, T value)` where `T ∈ { int, float, double, bool, string, Vector3, Quaternion, byte[] }` |
| Blob (sized) | `void SetAttribute(string name, byte[] data, uint size = uint.MaxValue)` |
| Bind player | `bool BindPlayer(string playerId)` |
| Nested component | `LudeoResult CreateOrGetStateComponent(string name, out LudeoStateComponent comp)` |
| Destroy | `LudeoResult DestroyStateObject()` |

- **Prefer discrete typed attributes over `byte[]` blobs.** `Vector3`→`Vec3Float`,
  `Quaternion`→`Vec4Float` are preserved as fixed-point internally.
- Values are cached and **diff-sent on the SDK's internal tick** — only changed values go to the
  backend. Calling `SetAttribute` does not itself send.

### `LudeoStateComponent` — nested attribute scope
From `LudeoStateObject.CreateOrGetStateComponent`. Same `SetAttribute` overloads as above.
Properties: `string ParentObject`, `string Name`.

---

## `LudeoDataReader` — restore data (`IDisposable`)

From the `GetLudeo` callback (`data.ludeoDataReader`). Properties: `string PlayerId`, `string LudeoId`.

| Member | Signature |
| --- | --- |
| Get all objects | `LudeoResult GetStateObjects(out LudeoStateObjectRestore[] objects)` |

Lifetime is tied to the session. The returned array is managed — no manual release (CR-008 N/A).

### `LudeoStateObjectRestore` — one restored object
Properties: `uint ObjectId`, `string ObjectType`.

| Member | Signature |
| --- | --- |
| Read attribute | `bool TryGetAttribute(string name, out T value)` where `T ∈ { int, float, double, bool, string, Vector3, Quaternion, byte[] }` |
| Exists? | `bool IsAttributeExists(string name, out LudeoDataType type)` |
| Nested component | `LudeoResult CreateOrGetStateComponent(string name, out LudeoStateComponentRestore comp)` |

Restoration groups these **by `ObjectType`** (see `07-RESTORATION-PATTERNS.md`): build a
`Dictionary<string, List<LudeoStateObjectRestore>>`, take `[0]` for singletons, iterate for
collections. `TryGetAttribute` returns `false` if the name is absent or the type mismatches.

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

### `LudeoDataType` (attribute types)
`Bool`, `Int8`, `UInt8`, `Int16`, `UInt16`, `Int32`(=`Int`), `UInt32`(=`Uint`), `Int64`, `UInt64`,
`Float`, `Double`, `String`, `Vec3Float`, `Vec4Float`(=`QuatFloat`), `Blob`, `Component`.

---

## Callback-data & parameter structs

| Struct | Key public fields |
| --- | --- |
| `LudeoSessionInitCallbackData` | `resultCode`, `ludeoSession` |
| `LudeoSessionActivateCallbackData` | `resultCode`, `isLudeoSelected` |
| `LudeoSelectedCallbackData` | `ludeoId` (`Guid`) |
| `LudeoSessionRoomReadyCallbackData` | `ludeoRoom` |
| `LudeoSessionConsentUpdatedCallbackData` | `canCreateLudeo`, `canPlayLudeo` |
| `LudeoSessionMuteRequestCallbackData` | `isMuted` |
| `LudeoSessionLocalizationChangedCallbackData` | `language` |
| `LudeoOpenRoomCallbackData` | `resultCode`, `ludeoRoom` |
| `LudeoCloseRoomCallbackData` | `resultCode` |
| `LudeoGetLudeoCallbackData` | `resultCode`, `ludeoDataReader` |
| `LudeoRoomAddGamePlayerCallbackData` | `resultCode`, `ludeoGameplaySession` |
| `LudeoRoomRemovePlayerCallbackData` | `resultCode` |
| `LudeoGameplaySessionBeginCallbackData` / `…EndCallbackData` / `…AbortCallbackData` | `resultCode` |
| `LudeoOpenRoomData` | ctors: `(string roomId)` creator · `(string roomId, Guid ludeoId)` play · `(Guid ludeoId)` play |
| `LudeoRoomAddGamePlayerData` | ctor `(string playerId)` |
| `LudeoRoomRemoveGamePlayerData` | ctor `(string playerId)` |
| `LudeoSessionLocalizationData` | `language`, `supportedLanguages` |

All callback structs expose `T GetClientData<T>()` for context passed via the `<T>` call overloads.

---

## Rules & gotchas (cited by later phases)

1. **Async = callback.** Result is only valid inside the callback; the call returns `void`.
2. **Register notifications before `Activate`.** After init, before activating the session.
3. **`isLudeoSelected == true`** in the Activate callback guarantees a `LudeoSelected` notification
   follows shortly — branch into the play flow rather than starting normal gameplay.
4. **Attributes over blobs.** Use typed `SetAttribute`; reserve `byte[]` for genuinely opaque data.
5. **No manual tick, no manual resource release.** Plugin ticks; managed arrays + GC handle reader
   data; `LudeoStateObject` manages the context stack internally (CR-002/005/008 are N/A — see
   `00-CRITICAL-REQUIREMENTS.md`).
6. **Identity is not an SDK id-map.** Restore matches by `ObjectType` bucket + your own key
   attributes; `uint ObjectId` is SDK-assigned, not your stable game id.
7. **`IDisposable` types:** `LudeoManager`, `LudeoSession`, `LudeoRoom`, `LudeoStateObject`,
   `LudeoDataReader`, `LudeoStateObjectRestore`. The SDK disposes the room / reader / state-objects
   internally — do not dispose those mid-flow. **But you OWN the `LudeoSession`** handed to you by
   `InitLudeoSession`, and the plugin does **not** dispose it for you: `Dispose()` it on shutdown
   (`OnApplicationQuit`). Skipping this is masked in a built player but breaks Editor re-init — the
   2nd Play returns `WrongState` with `Client still holding a handle to a Session instance`. See
   `05-LIFECYCLE-MANAGEMENT.md` "Shutdown".
