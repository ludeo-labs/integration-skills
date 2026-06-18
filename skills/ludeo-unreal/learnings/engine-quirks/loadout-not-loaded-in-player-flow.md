---
category: engine-quirks
tier: game-specific
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---
# APlayerStateBase::IsLoadoutLoaded never becomes true in Player Flow

## Precondition
ActionGame with bSkipSetupPhase=true (Ludeo Player Flow).

## What happened
The loadout async-load path (`OnValidLoadoutAndCharacter` → `AsyncLoadLoadoutAssets` → `OnDoneLoadingLoadoutAssets`) is triggered during the setup phase via `Multicast_SetLoadout` / character-class replication. When Player Flow skips setup entirely, this path never executes. `bIsLoadoutLoaded` stays false for the entire session. `OnLoadoutLoadedDelegate` never broadcasts.

## Diagnostic evidence
Added pointer-logging at bind and timeout sites:
```
bind:    PS=0000013BBC23A040  IsLoaded=0
timeout: OrigPS=0000013BBC23A040  NowPS=0000013BBC23A040  OrigLoaded=0  NowLoaded=0
```
Same PlayerState pointer (no swap), still false after 5s. Zero dialog/loadout log activity after level travel in Player Flow.

## Fix
Replaced the IsLoadoutLoaded delegate gate with an AnimInstance-based settle poll:
1. Poll until all TrackedEntities have valid `GetMesh()->GetAnimInstance()`
2. Then tick 15 more frames for AnimBP pose evaluation
3. Re-pause and OpenRoom

The game plays fine without the loadout being "loaded" — the loadout state is irrelevant in Player Flow.

## Related
The briefing VO race (PlayDialog vs ResumeAfterLudeoBoot) that originally motivated the loadout gate also doesn't exist — the level BP's deferred PlayDialog call is itself gated on the same loadout signal that never fires.
