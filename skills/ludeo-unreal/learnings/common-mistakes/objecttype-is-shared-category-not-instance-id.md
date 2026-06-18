---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 3
question: null
sanitized: true
---

# ObjectType in CreateObject is a shared category, not a unique instance identifier

## The Mistake

During FTPS_Online Stage 3, the agent set `ObjectType` to unique per-instance names like `"Bot_A_0"`, `"Bot_B_1"`, `"Bot_A_2"`. This created a unique schema type for every bot in Studio Labs, which is wrong.

The SDK docs (`State Management` page) show:

```cpp
params.objectType = "Player"; // Client-specified type identifier
```

`ObjectType` is a **type category** (like a class name), not an instance identifier. All players share `"Player"`, all bots share `"Bot"`, etc. Unique identity goes into **attributes** on the object.

## What Studio Labs saw

Before fix: 32 different object types (`Bot_A_0`, `Bot_A_1`, ..., `Bot_B_15`) — each appearing as a separate Game Object type in the dashboard.

After fix: 2 object types (`Player`, `Bot`) — with per-instance identity stored as the `EntityIdentity` attribute (`"Bot_A_0"`, `"Bot_B_3"`, etc.).

## The Fix

```cpp
// CORRECT — shared type, unique identity as attribute
Params.ObjectType = TEXT("Bot");  // Shared category
WritableObj.WriteData("EntityIdentity", *BotIdentity);  // "Bot_A_0" — unique per instance

// WRONG — unique type per instance
Params.ObjectType = *FString::Printf(TEXT("Bot_%s_%d"), *Team, BotIndex);
```

## Prevention

1. **Read the SDK docs on `CreateObject` before writing entity registration code.** The C SDK docs (`State Management` page) and the UE docs (`Track Gameplay` page) both show `objectType = "Player"` as the pattern.
2. **Rule of thumb:** if you're generating the ObjectType string with `Printf` or string concatenation, you're probably doing it wrong. ObjectType should be a static string constant.
3. **Check Studio Labs after first run.** If you see N unique Game Object types where you expected 1-2, the ObjectType is wrong.
