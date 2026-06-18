# Shooter Genre Patterns (Unreal)

> **Applies to:** FPS, TPS, Arena Shooters, Battle Royale, Tactical Shooters
> **Load when:** Game involves guns, projectiles, health/damage combat, player-vs-enemy or PvP
>
> Action names below map to the Ludeo subsystem / DataWriter `SendAction` call (see
> `references/phase-05-actions.md` and `references/sdk-reference/`).

> **MVP scope (curated-first):** In Phases 3–5, treat this catalog as a menu — implement only the
> actions/objects present in your **curated slice** (`integration.json → curatedSlice`). The full
> catalog applies at **expansion** (Phase 7), when coverage broadens to the whole game.

---

## 1. Actions Catalog

### Combat Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Kill` | Player kills enemy/opponent | "Kill 10 enemies" | 100 pts |
| `Death` | Player dies | "Survive without dying" (inverse) | -50 pts |
| `Headshot` | Kill via headshot | "Get 5 headshots" | +50 bonus |
| `MeleeKill` | Kill with melee weapon | "Get 3 melee kills" | +25 bonus |
| `ExplosiveKill` | Kill with explosive | "Get 2 explosive kills" | +25 bonus |
| `MultiKill` | Multiple kills in short window | "Get a double kill" | +100 bonus |
| `Assist` | Contributed damage to a kill | "Get 5 assists" | 50 pts |
| `TeamKill` | Killed a teammate (negative) | — | -200 pts |
| `WeaponFire` / `ShotFired` | Player fired a weapon (per-shot heartbeat) | "Land 20 shots" | — |

> **Kill actions are composable, additive axes — not mutually exclusive.** Real integrations fire the broad
> `Kill` AND the kill-method (`Headshot`/`MeleeKill`/`ExplosiveKill`) AND a per-enemy-type `Kill<Type>` from
> a single death, so both broad ("kill 10 enemies") and specific ("kill a heavy") goals score off one event.
> Emit them together; don't pick one. Enemy-type and kill-method are usually derived from the victim's
> tags/damage-type at kill time. See `learnings/architecture/additive-action-emission-for-composable-goals.md`
> and `learnings/common-mistakes/enemy-death-signal-varies-across-families.md`.

### Downed / Revive Actions

In revive-based shooters, `Death` fires only on the downed→dead transition; track the defeat-state enum (see Tracking Checklist) for the in-between states.

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Downed` | Player entered downed/bleed-out state (not yet dead) | — | — |
| `Revived` | This player was revived by a teammate | — | +50 |
| `RevivedTeammate` | This player revived a teammate | "Revive 2 teammates" | 100 pts |

### Weapon/Equipment Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Reload` | Weapon reloaded | — | — |
| `WeaponSwitch` | Changed weapon | — | — |
| `PickupWeapon` | Picked up a weapon | "Pick up 3 weapons" | 10 pts |
| `PickupAmmo` | Picked up ammo | — | — |
| `PickupHealth` | Picked up health | — | — |
| `PickupArmor` | Picked up armor | — | — |
| `UseGrenade` | Threw grenade | — | — |
| `UseAbility` | Used special ability | "Use ability 5 times" | — |

### Movement Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Jump` | Player jumped | — | — |
| `DoubleJump` | Double jump (if available) | — | — |
| `Dash` | Dash/dodge | — | — |
| `Sprint` | Started sprinting | — | — |

### Progression/Objective Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ObjectiveComplete` | Completed map objective | "Complete all objectives" | 500 pts |
| `FlagCapture` | Captured the flag | "Capture 2 flags" | 300 pts |
| `PointCapture` | Captured control point | "Capture 3 points" | 200 pts |
| `Respawn` | Player respawned | — | — |
| `RoundWin` | Won a round | — | 1000 pts |
| `MatchWin` | Won the match | — | 2000 pts |

---

## 2. Search Keywords

Grep these in C++/Blueprint method/field names and comments. Group results by category.

### Combat / Damage / Kill
```
kill, killed, death, die, died, dead, frag, eliminate, eliminated
damage, hurt, hit, takeDamage, applyDamage, OnDamage, dealDamage, IDamageable
headshot, critical, crit, lethal, fatal
health, hp, hitpoints, armor, shield
spawn, respawn, revive
```

### Weapons / Equipment / Pickups
```
weapon, gun, firearm, rifle, pistol, shotgun, sniper
fire, shoot, trigger, attack, projectile, bullet, ammo, ammunition
reload, magazine, clip
pickup, collect, grab, loot, item, drop
grenade, explosive, rocket, mine, throwable
melee, knife, punch, bash
equip, unequip, holster, swap, switch
```

### Movement / Player Actions
```
jump, doubleJump, wallJump, dash, dodge, sprint, crouch, prone, slide
```

### Game Flow / Objectives
```
objective, mission, quest, goal, flag, capture, point, control
score, scoring, points, reward, bonus
round, match, wave, level, stage
win, lose, victory, defeat, gameOver, endGame, endRound, endMatch
```

> **Unreal idioms** (the keyword lists above are generic gameplay vocabulary; these are the
> engine-API hooks to grep for in C++/Blueprint):
> - **Damage / kill:** delegates `OnTakeAnyDamage`, `OnTakePointDamage`, `OnTakeRadialDamage`
>   (radial = explosives); `UGameplayStatics::ApplyDamage`/`ApplyRadialDamage`. (`AActor::TakeAnyDamage`
>   is the legacy UE4 virtual — deprecated in UE5; prefer the delegates.) For GAS games,
>   `UGameplayEffect` / `UAbilitySystemComponent`.
> - **Overlap / hit:** `OnComponentBeginOverlap`, `OnComponentHit`, `NotifyHit`, `ReceiveHit`.
> - **Trace:** `LineTraceSingleByChannel`, `SweepSingleByChannel`.
> - **Movement:** `ACharacter::Jump`/`StopJumping`, `UCharacterMovementComponent::OnJumped`,
>   `OnMovementModeChanged`, `LaunchCharacter`.
> - **Input:** Enhanced Input `UInputAction` assets (often named `IA_*`); bindings registered in
>   `SetupPlayerInputComponent`.
> - **Events:** multicast delegates (`DECLARE_DYNAMIC_MULTICAST_DELEGATE`), `UFUNCTION` `On*`/`Handle*`.
> - **Properties:** `UPROPERTY(EditAnywhere/BlueprintReadWrite)`.

---

## 3. Tracking Checklist

After object tracking is implemented (phase 3/4), verify these are covered. Types map to the
Unreal DataWriter set-attribute calls; see `references/phase-04-tracking-restore.md` and
`references/phase-05-actions.md` for the exact API.

### Player (CRITICAL)

Universal player items (position, body + **look/aim** rotation, velocity, health/armor, alive, stance, team)
→ `references/game-patterns/common.md` §1. Shooter-specific additions:

- [ ] Current weapon / active weapon slot index
- [ ] Ammo — **magazine (loaded) + reserve are distinct** (see `learnings/save-systems/firearm-magazine-separate-from-reserve-ammo.md`)
- [ ] Armor / shield pool + max (if separate from health)
- [ ] **Defeat-state enum** (e.g. Normal / Downed / BleedOut / Cuffed / Dead) — richer than a single alive/dead bool, for revive-based shooters
- [ ] Score / kills / deaths / assists (in GAS games, often gameplay-tag stack counts)

### Enemies / NPCs
- [ ] Position, rotation
- [ ] Health
- [ ] AI state (idle, alert, attacking, fleeing) — typically `AAIController` + state enum / Behavior Tree
- [ ] Target entity ID
- [ ] Enemy type / actor class
- [ ] Is alive/dead

### Weapons
- [ ] Weapon type
- [ ] Owner ID
- [ ] Ammo count
- [ ] Is equipped
- [ ] Position (if a world item)

### Projectiles (if persistent/visible)

> Most integrations **sweep & destroy** in-flight projectiles on restore rather than track them (prevents
> cross-Ludeo state leaks). Track projectile state only if persistent/visible projectiles are central to the
> captured moment.

- [ ] Position, velocity
- [ ] Projectile type
- [ ] Owner ID
- [ ] Damage value

### Pickups / Items
- [ ] Position
- [ ] Item type
- [ ] Is collected / available
- [ ] Respawn state (if applicable)

### Environment
- [ ] Destructible objects (destroyed state)
- [ ] Doors (open/closed/locked)
- [ ] Level metadata (map name, game mode, difficulty)
