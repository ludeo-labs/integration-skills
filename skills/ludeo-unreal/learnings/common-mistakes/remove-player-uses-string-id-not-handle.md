---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

# FLudeoRoomRemovePlayerParameters uses PlayerID (FString), not PlayerHandle

`FLudeoRoomRemovePlayerParameters` has a `PlayerID` field (`FString`), not `PlayerHandle`. Similarly, `FLudeoRoomOnRemovePlayerDelegate` signature is `(const FLudeoResult&, const FLudeoRoomHandle&, const FString& PlayerID)` — the third param is the player ID string, not `FLudeoPlayerHandle`.

This is asymmetric with `AddPlayer`, whose delegate returns `FLudeoPlayerHandle`.

**Fix:** Cache the player ID string when calling `AddPlayer`, and use it for `RemovePlayer`:
```cpp
// On AddPlayer:
CurrentPlayerID = PlayerID;

// On RemovePlayer:
FLudeoRoomRemovePlayerParameters RemoveParams;
RemoveParams.PlayerID = CurrentPlayerID;
```
