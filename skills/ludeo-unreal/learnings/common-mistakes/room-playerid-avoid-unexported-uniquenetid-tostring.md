---
category: common-mistakes
tier: generalizable
sourceGame: EndlessFPS
phase: 3
question: "How is the FLudeoRoomAddPlayerParameters.PlayerID derived? If via APlayerState::GetUniqueId().ToString() it will fail to link from a plugin (FUniqueNetIdWrapper::ToString is not exported). Use APlayerState::GetPlayerId() for single-player, or GetUniqueId().GetUniqueNetId()->ToString() when an online subsystem is present."
sanitized: true
---

# Deriving the room PlayerID: FUniqueNetIdWrapper::ToString() is not exported

## The mistake

To build the `FLudeoRoomAddPlayerParameters.PlayerID` string for `FLudeoRoom::AddPlayer`, the
obvious code is:

```cpp
const FString Id = PlayerState->GetUniqueId().ToString();   // LNK2019 from a plugin
```

`APlayerState::GetUniqueId()` returns an `FUniqueNetIdRepl`, whose `ToString()` is inherited from
`FUniqueNetIdWrapper`. That method is **not exported** from the Engine module, so calling it from a
plugin module links with:

```
error LNK2019: unresolved external symbol
"__declspec(dllimport) public: class FString __cdecl FUniqueNetIdWrapper::ToString(void)const"
```

(The phase-02 reference also flags this symbol as version-sensitive — treat the warning as binding,
not hypothetical.)

## Correct options

- **Single-player / offline games (no online subsystem):** the net id is empty anyway. Use the
  replicated, exported `APlayerState::GetPlayerId()` — unique per player in the match:
  ```cpp
  return FString::Printf(TEXT("Player%d"), PlayerState->GetPlayerId());
  ```
- **Games with an online subsystem:** reach the inner net id, whose `ToString()` *is* exported
  (it lives on `FUniqueNetId` in CoreOnline, not on the wrapper):
  ```cpp
  if (FUniqueNetIdPtr NetId = PlayerState->GetUniqueId().GetUniqueNetId())
  {
      return NetId->ToString();
  }
  ```

## Why it matters

The Ludeo `PlayerID` only needs to be **stable and unique per player within the room** — it does
not need to be a platform net id. For the common single-player curated slice, `GetPlayerId()` is the
simplest correct choice and avoids dragging OnlineSubsystem/CoreOnline link dependencies into the
integration plugin for a value that would be empty regardless.
