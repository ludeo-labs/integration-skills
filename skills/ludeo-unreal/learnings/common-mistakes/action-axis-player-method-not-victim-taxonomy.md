---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 6
question: null
sanitized: true
---

# Action attribution is on the player-method axis, never the victim-archetype axis

## The mistake

The action stream named kills by the **victim's archetype**:

```cpp
// WRONG — bakes dead enemy's class into the action name
const FString ActionName = FString::Printf(TEXT("Kill_%s"), *EnemyType);
// → Kill_Sniper, Kill_HeavyEnemy, Kill_Shield
```

The action describes "what kind of enemy died", not "what the player did".

## Why it's wrong

The cloud's highlight picker scores actions per-player. The right axis is what the player did:

- `Headshot`, `Melee`, `StealthKill`, `ExplosiveKill`, `LongRangeKill`, `MultiKill`

The victim's class is **context** (attached to the action via attribution data, or as a separate parallel action), not part of the action name. The victim-axis breaks the cloud in three concrete ways:

1. Two players using a knife produce different actions if their targets differ — same play, different bucket.
2. The cloud cannot identify "Headshot" as a class of moments across all enemies — every variant is a different name.
3. Per-player attribution is impossible if the action name is the only signal, because the player who *did* the kill isn't in the name.

## The rule

1. Action names describe the **player's action**, not the target's identity.
2. Hook the **damage event** (carries instigator + damage type + hit location/bone), not the target's death event. The damage event has all the information needed to derive method.
3. Send `PlayerID` on every action via `SendAction(PlayerID, ActionName)`.
4. Composes with `name-actions-from-player-perspective.md` (no `Kill_Rifle` either) — both rules apply.

## Right hook (example: GAS-based games)

For ActionGame and similar:

- Hook the player character's damage delegate (`OnTakenDamage(const FGameplayDamageEvent&)` on the inflicting side).
- `FGameplayDamageEvent` carries: instigator, damage type, hit bone, hit location → derive `Headshot`, `Melee`, `Explosive`.
- For Headshot specifically: hit bone == head bone OR a damage-amplification flag is set.

## Cross-reference

- `name-actions-from-player-perspective.md` — no embedded variable data (Kill_Rifle is wrong for the same reason Kill_Sniper is wrong, but on a different axis).
- `action-stream-quality-checklist.md` — the meta-checklist that includes "kill-method split".
