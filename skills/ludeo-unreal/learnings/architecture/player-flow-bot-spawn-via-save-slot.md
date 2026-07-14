---
category: architecture
tier: generalizable
sourceGame: FTPS_Online
phase: 5
question: "Does this game's bot spawner read counts from a save slot? If yes, write to the save slot directly from C++ (UGameplayStatics::SaveGameToSlot) before travel — don't fight with BP reflection on GameInstance or GameMode."
sanitized: true
---

# Bot spawning in Player Flow: write to the game's save slot, not to BP variables

## Precondition

Applies when the game spawns bots by reading configuration from a USaveGame slot (LoadGameFromSlot) during level initialization.

## What happened (FTPS_Online)

The game's AISpawner reads bot counts from BP_GInstance, which loads them from a save slot via LoadGameFromSlot("slot", 0). Five failed approaches before finding the right one:

1. **Set BP_GInstance variables via reflection** → clobbered by LoadGame
2. **Call SaveBotNumbers via CallFunctionByNameWithArguments** → BP function's cached save object was null from C++ context
3. **Manual SpawnActor** → spawned bots but no team assignment, AI controller, collision, or GM registration
4. **Call AISpawner directly** → calls LoadGame which clobbers values; also causes duplicate spawns
5. **bSkipLoadGame flag** → required BP edit, flag name mismatch across reflection, still didn't work because values on BP_GInstance reset during travel

## The fix that worked

Write directly to the save slot from C++ using standard UE save system APIs:

```cpp
USaveGame* SaveObj = UGameplayStatics::LoadGameFromSlot(TEXT("slot"), 0);
if (!SaveObj)
{
    UClass* SaveClass = LoadClass<USaveGame>(nullptr, TEXT("/Game/.../BP_SaveGame.BP_SaveGame_C"));
    if (SaveClass) SaveObj = UGameplayStatics::CreateSaveGameObject(SaveClass);
}
if (SaveObj)
{
    LudeoBPReflection::SetInt(SaveObj, TEXT("AI_Numbers_A"), BotCountA);
    LudeoBPReflection::SetInt(SaveObj, TEXT("AI_Numbers_B"), BotCountB);
    UGameplayStatics::SaveGameToSlot(SaveObj, TEXT("slot"), 0);
}
```

This works because:
- The save slot is the single source of truth — the game's own LoadGame reads from it
- Standard UE APIs (SaveGameToSlot/LoadGameFromSlot) work reliably from C++
- No BP function calls, no reflection timing issues, no flag hacks
- The game's spawn system handles all initialization (team, AI, collision, names)

## Key lesson

When a game reads configuration from a save slot, **use the save slot as the communication channel**. Don't try to bypass it with reflection on transient BP variables that get overwritten during map travel or initialization. The save slot persists reliably across all transitions.

## How to discover the slot name

Use the BP Inspector: `RunBPInspector.bat graph-function /Game/.../BP_GInstance LoadGame` → look for `LoadGameFromSlot` node → the `Slot Name` pin value is the slot name.
