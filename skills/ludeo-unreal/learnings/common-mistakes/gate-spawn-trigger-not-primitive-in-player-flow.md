---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: 4
question: "Does the game have a runtime populate trigger (wave-start, combat-start, elimination-refill) that can fire while playing forward from a restored state? If yes, gate the TRIGGER on bIsPlayerFlow, never the spawn primitive."
sanitized: true
---

# Gate the spawn TRIGGER, never the spawn PRIMITIVE, in Player Flow

## Precondition

The game populates the world through a **runtime trigger** — a wave-start, combat-start,
room-enter, or elimination-refill event — that calls a spawn routine. In Player Flow you also
restore that same population from captured Ludeo state. When the replay **plays forward** from
the restored moment, the live trigger can re-fire.

## Problem

Player-Flow restore repopulates the world by calling the game's spawn routine directly (Pass 1
spawns tracked entities via `SpawnActor` / an `AIManager->Spawn` primitive). If a live trigger
then fires during play-forward — the wave manager starts "the next wave", the combat encounter
re-arms, the refill logic tops up the pool — it **re-creates the population you already
restored**: duplicate enemies, wrong counts, a second copy of the moment.

The instinct is to guard the spawn call itself. That is the mistake: **restore's own Pass 1
calls the primitive**, so gating the primitive on `bIsPlayerFlow` makes restore spawn nothing —
an empty replay.

## Fix

Gate the **decision to populate** (the trigger), not the **mechanism that populates** (the
primitive):

```cpp
// WRONG — this also blocks restore's Pass-1 spawn, giving an empty replay
void AAIManager::SpawnWave(int32 WaveIndex)
{
    if (LudeoComp && LudeoComp->IsPlayerFlow()) return;   // ❌ kills restore too
    ...
}

// RIGHT — gate the trigger; leave the primitive callable by restore
void AWaveDirector::OnWaveShouldStart(int32 WaveIndex)
{
    if (LudeoComp && LudeoComp->IsPlayerFlow()) return;   // ✅ suppress the live re-fire
    AIManager->SpawnWave(WaveIndex);                       // primitive stays open — restore calls it
}
```

## Distinguish RE-CREATE (suppress) from ADVANCE (keep)

Not every trigger during play-forward is wrong:

- **Re-create** — a trigger that re-fires the wave/encounter you already restored. **Suppress it.**
- **Advance** — a spawner that moves to the **next** wave from the *restored cursor*
  (the restored wave index, not wave 0). That is legitimate forward continuation. **Keep it.**

Restore the spawn cursor / wave index as tracked state so "advance" continues from the right
point instead of restarting the sequence.

## How to apply

Player Flow (Phase 4): for each populate trigger, ask "if this fires after restore, does it
duplicate the restored population or advance past it?" Suppress the duplicators on `bIsPlayerFlow`;
leave the primitives open; restore the cursor so advance is correct.

## Related learnings

- `destroy-default-spawns-before-restoring-tracked.md` — companion: destroy the game's *default*
  level-start spawns before restore lays down tracked ones. This one covers the *play-forward re-fire*.
- `restore-ai-destroy-trips-death-escalation-mechanic.md` — watch for side effects when clearing
  default spawns.
- `audit-all-isplayerflow-guards.md` — the general rule that only state-*writing* gets gated in Player Flow; this is the spawn-side corollary.
