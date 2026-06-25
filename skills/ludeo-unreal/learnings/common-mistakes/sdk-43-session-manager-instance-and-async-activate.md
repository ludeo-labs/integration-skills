---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 2
question: "For SDK 4.3.0+, did you verify that session creation goes through FLudeoManager::GetSessionManager() (instance), and that Activate/OpenRoom/CloseRoom/GetLudeo are ASYNC with completion delegates — not the static/synchronous forms in the phase-02 reference skeleton?"
sanitized: true
---

# LudeoUESDK 4.3.0: session manager is instance-based and Activate is async (reference skeleton is stale)

The `references/phase-02-lifecycle.md` §3.14 / §5.3 skeleton models the session API as static and
synchronous. Verified against the 4.3.0 headers
(`Plugins/LudeoUESDK/Source/LudeoUESDK/Public/LudeoUESDK/...`), the real API differs in ways that
do NOT compile if copied verbatim:

| Reference skeleton (WRONG for 4.3.0) | Actual 4.3.0 API |
|---|---|
| `FLudeoSessionManager::CreateSession(...)` (static) | `FLudeoManager::GetInstance()` → `TWeakPtr` → pin → `Manager->GetSessionManager().CreateSession()` returns `FLudeoSession*` **synchronously** |
| `FLudeoSessionManager::GetSession(handle)` | `FLudeoSession::GetSessionBySessionHandle(handle)` (static on `FLudeoSession`) or `Manager->GetSessionManager().GetSessionBySessionHandle(...)` |
| `FLudeoSessionManager::DestroySession(handle)` | `Manager->GetSessionManager().DestroySession(FDestroyLudeoSessionParameters{SessionHandle}, delegate)` |
| `FLudeoResult Result = Session->Activate(Params);` (synchronous) | `Session->Activate(Params, FLudeoSessionOnActivatedDelegate)` — **async**, 3-param completion delegate `(Result, SessionHandle, bool bIsLudeoSelected)` |
| `Room->Close()` | `Session->CloseRoom(FLudeoSessionCloseRoomParameters{RoomHandle}, delegate)` |

All of `Activate / OpenRoom / CloseRoom / GetLudeo / AddPlayer / RemovePlayer / BeginGameplay /
EndGameplay` are async with a completion delegate as the **last** parameter. Bind those delegates
with `CreateUObject` (UE 5.7 rejects capturing lambdas in SDK delegates — see
`ue57-lambda-invoke-deduction-failure`).

Other verified-correct facts for 4.3.0 (match existing learnings):
- `FLudeoManager::GetInstance()` → `TWeakPtr<FLudeoManager>` (pin before use; `Initialize`/`Finalize`
  return `FLudeoResult`; `Tick()` is arg-less).
- `FLudeoSession::operator const FLudeoSessionHandle&()` yields the session handle from the `FLudeoSession*`.
- `FLudeoRoomAddPlayerParameters` / `FLudeoRoomRemovePlayerParameters` both carry `PlayerID` (FString).
- `FLudeoSessionSteamAuthenticationData.AuthenticationID` (+ `BetaBranchName`); assign to
  `ActivateParams.AuthenticationDetails` (it has `operator=` from the steam struct).
- `FLudeoRoomWriter::SendAction(FLudeoRoomWriterSendActionParameters{PlayerID:FString, ActionName:FName})`.

**Rule:** on 4.3.0+, treat the phase-02 skeleton's session/activation code as pseudocode for
*structure only*. Grep the headers and code against the real (instance-based, async-delegate) API.
