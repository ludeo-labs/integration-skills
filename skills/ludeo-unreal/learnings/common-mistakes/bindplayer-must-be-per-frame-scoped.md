---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 5
question: null
sanitized: true
---

# BindPlayer must use per-frame FScopedWritableObjectBindPlayerGuard, not a one-time call

The Lyra reference integration uses `FScopedWritableObjectBindPlayerGuard` on **every write tick** inside `UpdateWritableObjects()`. This scoped guard binds the player perspective to the writable object for the duration of the write, then unbinds when the guard is destroyed.

**Wrong pattern (ActionRoguelike bug):**
```cpp
// Called once during RegisterEntity:
WritableObj.BindPlayer(TCHAR_TO_UTF8(*PlayerID));
```

**Correct pattern (Lyra reference):**
```cpp
// Called every write tick in UpdateWritableObjects:
const FScopedWritableObjectBindPlayerGuard<FLudeoWritableObject> BindGuard(
    PlayerObject.GetValue(), TCHAR_TO_UTF8(*TrackedPlayerID));
```

**How to apply:** In `WritePlayerState()` or equivalent, always wrap player data writes with `FScopedWritableObjectBindPlayerGuard`. Do not rely on a one-time `BindPlayer()` call during entity registration. The scoped guard also ensures proper cleanup if the function exits early.
