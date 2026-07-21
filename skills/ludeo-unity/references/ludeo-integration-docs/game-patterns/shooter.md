# Shooter Genre Patterns (Unity)

> **Applies to:** FPS, TPS, Arena Shooters, Battle Royale, Tactical Shooters
> **Load when:** Game involves guns, projectiles, health/damage combat, player-vs-enemy or PvP
>
> Action names below map to `[SDK]` `LudeoGameplaySession.SendAction(string)` via the `[Layer]`
> `LudeoController.SendAction` (see `phase 7`).

---

## 1. Actions Catalog

> **Candidates, not a capture list.** The **Tier** column ranks capture priority for *this* genre;
> still apply phase 6's keep test before sending any action.
> - **T1 — Capture:** signature scored milestones / one-shot highlights that define the genre.
> - **T2 — Capture if scored or a notable beat in *this* game;** otherwise drop.
> - **T3 — Usually drop:** tracked **state** or high-frequency input noise — capturing bloats the
>   Ludeo. Keep only if exceptionally scored. (Rows with both Objective and Scoring empty are almost
>   always T3.)
>
> **Genre T3 traps:** the whole **Movement** group, `Reload`/`WeaponSwitch` (mechanical noise; current
> weapon + ammo are tracked **state**), and `PickupAmmo`/`PickupHealth`/`PickupArmor` (the totals are
> tracked state).
>
> **Scope (phase 6) — orthogonal to tier:** player-scoped (guard on the player as actor/subject) —
> `Kill`, `Death`, `Headshot`, `MultiKill`, `MeleeKill`, `Assist`; **global** (no guard, fire once) —
> `RoundWin`, `MatchWin`, `ObjectiveComplete`, `FlagCapture`, `PointCapture`.

### Combat Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Kill` | T1 | Player kills enemy/opponent | "Kill 10 enemies" | 100 pts |
| `Death` | T1 | Player dies | "Survive without dying" (inverse) | -50 pts |
| `Headshot` | T1 | Kill via headshot | "Get 5 headshots" | +50 bonus |
| `MultiKill` | T1 | Multiple kills in short window | "Get a double kill" | +100 bonus |
| `MeleeKill` | T2 | Kill with melee weapon | "Get 3 melee kills" | +25 bonus |
| `ExplosiveKill` | T2 | Kill with explosive | "Get 2 explosive kills" | +25 bonus |
| `Assist` | T2 | Contributed damage to a kill | "Get 5 assists" | 50 pts |
| `TeamKill` | T2 | Killed a teammate (negative) | — | -200 pts |

### Weapon/Equipment Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `PickupWeapon` | T2 | Picked up a weapon | "Pick up 3 weapons" | 10 pts |
| `UseAbility` | T2 | Used special ability | "Use ability 5 times" | — |
| `Reload` | T3 | Weapon reloaded | — | — |
| `WeaponSwitch` | T3 | Changed weapon | — | — |
| `PickupAmmo` | T3 | Picked up ammo | — | — |
| `PickupHealth` | T3 | Picked up health | — | — |
| `PickupArmor` | T3 | Picked up armor | — | — |
| `UseGrenade` | T3 | Threw grenade | — | — |

### Movement Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Jump` | T3 | Player jumped | — | — |
| `DoubleJump` | T3 | Double jump (if available) | — | — |
| `Dash` | T3 | Dash/dodge (T2 only if a *scored* mechanic) | — | — |
| `Sprint` | T3 | Started sprinting | — | — |

### Progression/Objective Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `ObjectiveComplete` | T1 | Completed map objective | "Complete all objectives" | 500 pts |
| `FlagCapture` | T1 | Captured the flag | "Capture 2 flags" | 300 pts |
| `PointCapture` | T1 | Captured control point | "Capture 3 points" | 200 pts |
| `RoundWin` | T1 | Won a round | — | 1000 pts |
| `MatchWin` | T1 | Won the match | — | 2000 pts |
| `Respawn` | T3 | Player respawned | — | — |

---

## 2. Search Keywords

Grep these in C# method/field names and comments. Group results by category. In Unity, combat and
pickups frequently route through **physics callbacks** (`OnTriggerEnter`/`OnCollisionEnter`) and
**event hooks** (`UnityEvent`, C# `event`/`Action`, `On*`/`Handle*` handlers) — search those too.

### Combat / Damage / Kill
```
kill, killed, death, die, died, dead, frag, eliminate, eliminated
damage, hurt, hit, takeDamage, applyDamage, OnDamage, dealDamage, IDamageable
headshot, critical, crit, lethal, fatal
health, hp, hitpoints, armor, shield
spawn, respawn, revive
OnTriggerEnter, OnCollisionEnter, OnControllerColliderHit, Raycast
```

### Weapons / Equipment / Pickups
```
weapon, gun, firearm, rifle, pistol, shotgun, sniper
fire, shoot, trigger, attack, projectile, bullet, ammo, ammunition
reload, magazine, clip
pickup, collect, grab, loot, item, drop, OnTriggerEnter
grenade, explosive, rocket, mine, throwable
melee, knife, punch, bash
equip, unequip, holster, swap, switch
```

### Movement / Player Actions
```
jump, doubleJump, wallJump, dash, dodge, sprint, crouch, prone, slide
CharacterController, Rigidbody, Move, AddForce, Input, InputAction
```

### Game Flow / Objectives
```
objective, mission, quest, goal, flag, capture, point, control
score, scoring, points, reward, bonus
round, match, wave, level, stage
win, lose, victory, defeat, gameOver, endGame, endRound, endMatch
```

---

## 3. Tracking Checklist

After object tracking is implemented (phase 9), verify these are covered. Types map to `[SDK]`
`SetAttribute` overloads (see `12-SDK-API-REFERENCE.md`). Sections are tiered by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

### Player — CRITICAL
- [ ] Position (`Vector3`)
- [ ] Rotation (`Quaternion`)
- [ ] Velocity (`Vector3`)
- [ ] Health / HP (`int`/`float`)
- [ ] Is alive/dead (`bool`)
- [ ] Current weapon / weapon ID
- [ ] Ammo (current + reserve)
- [ ] Score / kills / deaths
- [ ] Team ID
- [ ] Appearance / equipped cosmetics (skin, outfit, character-model or team-color variant — by content id). Constant through the clip but **visible**; the `06 §9.3` step-1 carve-out — a default-skin replay is visibly wrong

### Enemies / NPCs — IMPORTANT
- [ ] Position, rotation
- [ ] Health
- [ ] AI state (idle, alert, attacking, fleeing) — often a `NavMeshAgent` + state enum
- [ ] Target entity ID
- [ ] Enemy type / prefab ID
- [ ] Is alive/dead

### Weapons — IMPORTANT
- [ ] Weapon type
- [ ] Owner ID
- [ ] Ammo count
- [ ] Is equipped
- [ ] Position (if a world item)

### Projectiles (if persistent/visible) — OPTIONAL
- [ ] Position, velocity
- [ ] Projectile type
- [ ] Owner ID
- [ ] Damage value

### Pickups / Items — OPTIONAL
- [ ] Position
- [ ] Item type
- [ ] Is collected / available
- [ ] Respawn state (if applicable)

### Environment — OPTIONAL
- [ ] Destructible objects (destroyed state)
- [ ] Doors (open/closed/locked)
- [ ] Level metadata (map name, game mode, difficulty)
