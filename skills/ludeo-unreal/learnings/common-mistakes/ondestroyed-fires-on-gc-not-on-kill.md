---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Do AI characters stay in the world after death (ragdoll, pooling)?"
sanitized: true
---

# OnDestroyed fires on garbage collection, not on kill — use alive state polling

## Problem

`AActor::OnDestroyed` fires when the actor is removed from the world (GC/pool), NOT when the character is killed. In ActionGame, enemies stay as ragdolls after death. Kill actions never fire because OnDestroyed is never called during gameplay.

## Fix

Use poll-based kill detection: track `bWasAlive` per entity, check `AGameCharacter::IsAlive()` each tick, fire action on `true → false` transition. Include the enemy type in the action name via the gameplay tag system (`GetType().GetTagName()` → extract last segment).

```
"Kill_HeavyEnemy", "Kill_StandardEnemy", "Kill_Civilian", etc.
```

## How to Apply

For any game where enemies persist after death, use alive-state polling instead of OnDestroyed for kill detection.
