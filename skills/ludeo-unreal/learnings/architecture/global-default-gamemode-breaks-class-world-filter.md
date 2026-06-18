---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 2
question: "Is the gameplay/toolkit GameMode set as GlobalDefaultGameMode in DefaultEngine.ini? If yes, menu/meta maps WITHOUT a per-map override inherit the gameplay GameMode (and its GameState class) — classify battle worlds by a placed battle-infrastructure actor (grid manager, turn manager), not by GameMode/GameState class."
sanitized: true
---

# GlobalDefaultGameMode = gameplay mode breaks GameMode-class world classification

## Precondition

`DefaultEngine.ini` sets `GlobalDefaultGameMode` to the gameplay (toolkit) GameMode, and at
least one non-gameplay map (campaign/meta map, test level) has **no** per-map
`GameModeOverride`.

## What happened

On TacticsGame the plan was to attach the Ludeo component only in battle worlds, filtered by
"GameState is the toolkit's GameState class" (or "GameMode is the toolkit mode"). Map scanning
showed:

- The main menu map had `GameModeOverride = <MenuGameMode>` — fine, filtered out.
- The campaign/meta map had **no override** → it inherits `GlobalDefaultGameMode`, which is the
  toolkit's gameplay GameMode → it spawns the toolkit GameState **even though no battle ever
  runs there**. A class-based filter would attach the component (and open a room) in the
  campaign map.

## The fix — filter by placed battle infrastructure

Battle worlds in toolkit-based games carry a placed infrastructure actor the toolkit cannot run
without (here: the grid manager). Menu/meta maps have none. Filter on that:

```cpp
bool IsBattleWorld(const UWorld* World)
{
    for (TActorIterator<AActor> It(const_cast<UWorld*>(World)); It; ++It)
    {
        const UClass* C = It->GetClass();
        if (C && C->GetName().StartsWith(TEXT("BP_GridManager"))) // toolkit infra class
        {
            return true;
        }
    }
    return false;
}
```

Class-NAME matching (not class pointer) keeps zero compile-time/asset coupling.

## How to verify cheaply

ASCII-scan the candidate `.umap` files for the infrastructure class name: battle maps hit,
menu/meta maps must be 0-hit. Also scan each non-gameplay map for `GameModeOverride` to learn
whether it inherits the global default — absence of any "GameMode" string in the umap means
no override.
