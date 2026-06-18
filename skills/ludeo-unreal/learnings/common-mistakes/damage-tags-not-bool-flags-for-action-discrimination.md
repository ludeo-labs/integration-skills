---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "Does the game use a damage event struct that exposes BOTH per-hit boolean flags (bIsCritical, bIsKillshot, ...) AND a damage-type tag container? If yes, derive kill-method actions from the tags, not from the booleans + auxiliary pointers."
sanitized: true
---

# Use damage-type tags, not boolean flags, to discriminate kill-method actions

## Precondition

GAS-based game with a damage-event struct (e.g. ActionGame's `FGameplayDamageEvent`, Lyra-style verb message) that has **both**:

- Boolean fields like `bIsCritical`, `bIsKillshot`, `bIsArmorBreak`.
- A `FGameplayTagContainer DamageTypeTagContainer` populated from the GE's damage-type CDO.
- Optional auxiliary pointers (e.g. `ThrowableData* != nullptr`).

The integrator wants to emit per-method kill actions — `Headshot`, `Melee`, `ExplosiveKill`, `KnifeKill`, etc. The boolean fields look like the obvious discriminators. They are not.

## The mistake

Two real bugs in ActionGame's first action pass:

```cpp
// BUG 1 — fires Headshot for grenade-to-the-head
if (DamageEventData.bIsCritical) SendLudeoAction("Headshot");

// BUG 2 — fires ExplosiveKill for thrown knives, ammo bags, smoke grenades
if (DamageEventData.ThrowableData != nullptr) SendLudeoAction("ExplosiveKill");
```

Why each is wrong:

- `bIsCritical` is set in `PrepareDamageEvent` based on **damage location** (head zone), regardless of damage type. AoE explosion damage that catches a head bone has `bIsCritical = true`. Direct grenade-projectile-to-the-head crits the head. So `Headshot` ends up co-firing with `ExplosiveKill` on a single frag-to-the-face.
- `ThrowableData != nullptr` is true for **all** throwables. The throwable hierarchy (in ActionGame) is `UThrowableData → {UGrenadeData, UThrowableProjectileData (knives), AmmoBag, MedBag, SmokeGrenade, …}`. A throwing-knife kill carries non-null `ThrowableData` but is not explosive.

## The fix

Use the damage-type tags. They are populated from the GE's damage-type CDO at damage-application time and are the same discriminator the engine itself uses internally (e.g. ActionGame's `AGameCharacter` checks `DamageType_HurtReaction_Explosion`):

```cpp
const FGameplayTagContainer& DT = DamageEventData.DamageTypeTagContainer;
const bool bIsBullet    = DT.HasTag(Tags.DamageType_Projectile_Bullet);
const bool bIsExplosive = DT.HasTag(Tags.DamageType_Explosion)
                       || DT.HasTag(Tags.DamageType_Projectile_Grenade);
const bool bIsMelee     = DT.HasTag(Tags.DamageType_Melee);
const bool bIsKnife     = DT.HasTag(Tags.DamageType_Knife);

if (DamageEventData.bIsCritical && bIsBullet) SendLudeoAction("Headshot");
if (!DamageEventData.bIsKillshot) return;
if (bIsMelee)          SendLudeoAction("Melee");
else if (bIsExplosive) SendLudeoAction("ExplosiveKill");
else if (bIsKnife)     SendLudeoAction("KnifeKill");
```

## Detection / how to apply

When wiring a kill-method axis:
1. Open the damage-event struct definition. List every `bIs*` field and every pointer field. Confirm with a grep of the engine's own consumers that boolean fields are NOT method-discriminators (they will be hit-zone, lethality, frequency, etc.).
2. Find the GAS damage-type tags (typically a flat namespace like `DamageType.Projectile.Bullet`, `DamageType.Explosion`). Use these.
3. Cross-check against engine code that already discriminates by method (combat reactions, analytics, perk gates, helmet-pop). The same predicate they use is the one to use here.

## Anti-pattern

Trusting field names. `bIsCritical` sounds like "headshot", `ThrowableData` sounds like "explosive". Field semantics in GAS damage events are usually about hit details (zone, lethality, frequency, source-reference for FX), not about discriminating action categories.

## Cross-reference

- `common-mistakes/elimination-debouncing-with-message-subsystem.md` — separate problem, also action-emission-side.
- `common-mistakes/use-filter-not-iterate-and-break-for-tags.md` — pattern for tag-based predicates.
