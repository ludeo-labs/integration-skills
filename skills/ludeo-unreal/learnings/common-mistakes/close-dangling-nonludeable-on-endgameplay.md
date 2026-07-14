---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# Send StopNoneLudeable before EndGameplay if game was paused

If the match ends while the game is in a paused/non-ludeoable state (Creator Flow), send `StopNoneLudeable` before calling `EndGameplay`. Otherwise the recording has a dangling pause marker with no matching resume.

```cpp
// In EndGameplay(), before ending:
if (bWasPaused && !bIsPlayerFlow && RoomHandle is valid)
{
    SendAction("StopNoneLudeable");
}
bWasPaused = false;
bMenuOverlayOpen = false;
```

Also reset `bMenuOverlayOpen` in EndGameplay to prevent stale state on next match.
