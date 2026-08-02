# 2.0.0 (2026-07-24)


### ⚠ BREAKING CHANGES

* **ludeo-unity:** align the skill with the Ludeo Unity plugin **v4.3.0** breaking API rewrite. All
  SDK signatures, code patterns, and CRs updated across the API reference, reference architecture,
  critical requirements, lifecycle/tracking/restoration docs, every phase workflow, and the game-pattern
  and unity/* guides. Highlights:
  * init is now synchronous & two-step: `LudeoManager.Initialize()` + `LudeoManager.SessionManager.CreateSession(out …)` (was async `InitLudeoSession(cb)`).
  * notifications are C# events on `LudeoSession` (`LudeoSelected`, `RoomReady`, `PlayerConsentUpdated`, `PauseGameRequested`, `ResumeGameRequested`, `GameBackToMenuRequested`, `MuteGameRequested`, `LocalizationUpdated`) — replacing `AddNotify*`/`RemoveNotify*`.
  * capture moved to `LudeoRoom.Writer` (`LudeoRoomWriter`): `CreateObject` → `LudeoWritableObject`, `WriteData` inside `using EnterObjectScope()` (CR-002 flipped from N/A to required).
  * restore: `LudeoDataReader.GetObjects` → `LudeoReadableObject[]`, `ReadData`/`GetAllAttributes` inside `using EnterObjectScope()`.
  * gameplay session `LudeoGameplaySession` → `LudeoPlayer` (`BeginGameplay`/`EndGameplay`/`AbortGameplay`); `AddGamePlayer`→`AddPlayer`, `GetGamePlaySession`→`GetPlayer`; `SendAction` via `LudeoRoomWriter`/`LudeoPlayer`.
  * removed `clientData`/`GetClientData<T>()`; added `*Async` (`Task`) overloads; `LudeoDataReader` is now `IDisposable`.


# 1.0.0 (2026-06-17)


### Bug Fixes

* release ([c239853](https://github.com/ludeo-labs/integration-skills/commit/c2398536794db4711eda20f0b5b66ddc3248b56e))
* release ([59ee150](https://github.com/ludeo-labs/integration-skills/commit/59ee15046f493e9b1facafa709618ae70eff6d80))
* release ([720072a](https://github.com/ludeo-labs/integration-skills/commit/720072acf43af332bf07e26a7cb89eae1e755b59))
