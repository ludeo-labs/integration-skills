# Survival / Sandbox Genre Patterns (Unity)

> **Applies to:** Survival/crafting games (Valheim, 7 Days to Die, Rust, Subnautica), sandbox/builder
> games (Minecraft-likes), base-building survival, colony sims with a controlled avatar
> **Load when:** Game involves gathering resources, crafting/building, hunger/thirst/temperature
> survival meters, or placing/destroying world structures
>
> **These games are almost always open-world / streaming and often indefinite (no death-end).** Load
> [open-world.md](./open-world.md) (session boundaries — note the §7 sandbox edge case:
> load→play→save-exit = one session) and [open-world-tracking.md](./open-world-tracking.md)
> (streaming-world tracking) **alongside** this file.
>
> Action names below map to `[SDK]` `LudeoGameplaySession.SendAction(string)` via the `[Layer]`
> `LudeoController.SendAction` (see `phase 7`).

---

## 1. Actions Catalog

> **Candidates, not a capture list.** The **Tier** column ranks capture priority for *this* genre;
> still apply phase 6's keep test before sending any action.
> - **T1 — Capture:** signature scored milestones / one-shot highlights that define the genre.
> - **T2 — Capture if scored or a notable beat in *this* game;** otherwise drop.
> - **T3 — Usually drop:** tracked **state** or high-frequency noise — capturing bloats the Ludeo.
>   Keep only if exceptionally scored. (Rows with both Objective and Scoring empty are almost always T3.)
>
> **Genre T3 traps:** `ItemPickup` and `Ate`/`Drank`/`Healed`/`StarvationDamage` (the survival meters
> are tracked **state** — capture the *milestone* like `DaysSurvived`, not every bite).
> `ResourceGathered`/`Mined`/`TreeChopped` are **high-frequency** — promote to T2 only when tied to a
> real objective ("gather 50 wood"); never `SendAction` on every harvest as flavor.
>
> **Scope (phase 6) — orthogonal to tier:** predominantly **player-scoped** — `CreatureKill`, `Death`,
> `StructurePlaced`, `Tamed`, `RecipeUnlocked` (guard kills that fire for non-player actors). World-wide
> events (a raid / boss spawn, `DaysSurvived` as a shared day rollover) are **global** — fire once.

### Gathering / Harvesting Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `ResourceGathered` | T3 | Harvested wood/stone/ore/fiber (T2 if tied to an objective) | "Gather 50 wood" | 5 pts |
| `Mined` | T3 | Mined a block / ore node | "Mine 10 ore" | 10 pts |
| `TreeChopped` | T3 | Felled a tree | "Chop 5 trees" | 10 pts |
| `ItemPickup` | T3 | Picked up a loose item | — | — |

### Crafting / Building Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `StructurePlaced` | T1 | Placed a building piece | "Build a shelter" | 50 pts |
| `RecipeUnlocked` | T1 | Unlocked a recipe / tech | "Unlock a recipe" | 100 pts |
| `ItemCrafted` | T2 | Crafted an item/tool | "Craft a tool" | 25 pts |
| `StructureUpgraded` | T2 | Upgraded a structure | — | 25 pts |
| `StructureDestroyed` | T2 | Demolished / lost a structure | — | — |

### Survival Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `DaysSurvived` | T1 | Survived another day | "Survive 7 days" | 200 pts |
| `Ate` / `Drank` | T3 | Consumed food/water | — | — |
| `Slept` | T3 | Slept (time-skip; same run — see open-world.md) | — | — |
| `Healed` | T3 | Restored health | — | — |
| `StarvationDamage` | T3 | Took hunger/thirst/cold damage | "Survive a day without starving" (inverse) | — |

### Combat / Threat Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `BossKill` | T1 | Defeated a boss creature | "Defeat the boss" | 1000 pts |
| `Death` | T1 | Player died | "Survive without dying" (inverse) | -50 pts |
| `Tamed` | T1 | Tamed/domesticated a creature | "Tame a creature" | 100 pts |
| `CreatureKill` | T2 | Killed a creature/mob | "Kill 10 creatures" | 50 pts |

---

## 2. Search Keywords

Grep these in C# method/field names and comments. In Unity, gathering,
placement, and damage frequently route through **physics callbacks**
(`OnTriggerEnter`/`OnCollisionEnter`/raycasts) and **event hooks** (`UnityEvent`, C# `event`/`Action`,
`On*`/`Handle*` handlers) — search those too.

### Gathering / Resources
```
gather, harvest, mine, chop, dig, forage, pick, collect, ResourceNode
resource, wood, stone, ore, metal, fiber, food, water, fuel
node, deposit, vein, depleted, respawn, regrow, yield
durability, harvestTool, pickaxe, axe, hit, OnHit
```

### Crafting / Building
```
craft, build, construct, place, snap, blueprint, recipe, schematic, ingredient
structure, piece, foundation, wall, floor, building, deconstruct, demolish, upgrade
inventory, stack, slot, storage, container, chest, crate
unlock, research, tech, techTree, progression
```

### Survival Meters
```
hunger, thirst, food, water, stamina, fatigue, temperature, cold, heat, warmth
health, hp, heal, regen, eat, drink, consume, sleep, rest, bed
oxygen, sanity, radiation, poison, disease, status, effect, buff, debuff
day, night, dayCount, time, weather, season, storm
```

### Creatures / Combat / Threats
```
creature, mob, animal, enemy, monster, spawn, spawner, AI, NavMeshAgent
attack, damage, kill, death, die, takeDamage, IDamageable
tame, domesticate, breed, mount, pet, follower
aggro, alert, hostile, passive, faction
```

---

## 3. Tracking Checklist

After object tracking is implemented (phase 9), verify these are covered. Types map to `[SDK]`
`SetAttribute` overloads (see `12-SDK-API-REFERENCE.md`). These worlds stream and persist heavily —
apply [open-world-tracking.md](./open-world-tracking.md): track the **loaded neighborhood + world
state**, scope cell/chunk mutations to what the captured moment needs, not the entire save. Sections
are tiered by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

### Player — CRITICAL
- [ ] Position (`Vector3`), Rotation (`Quaternion`)
- [ ] Health, Hunger, Thirst, Stamina, Temperature (and any survival meter — `int`/`float`)
- [ ] Is alive/dead (`bool`)
- [ ] Equipped tool/weapon (by item/content id)
- [ ] Inventory / hotbar (array of item ids + counts; never references — `06 §9.4`)
- [ ] Unlocked recipes / tech (if it gates the moment)

### World state — CRITICAL (for survival)
- [ ] Game-time, day count, weather, season (a `WorldState` singleton — `open-world-tracking.md §3`)

### Placed structures / world edits — IMPORTANT
- [ ] Structure/block type + position (by stable cell/chunk + content id — `open-world-tracking.md §4`)
- [ ] Health / durability / damage state
- [ ] Owner / team key (multiplayer)
- [ ] Built/destroyed state (destroyed = **state flag**, distinguish from streamed-out — `06 §3.3`)

### Creatures / mobs — IMPORTANT
- [ ] Position, rotation, health
- [ ] Creature type, AI state (idle, aggro, fleeing)
- [ ] Tamed/owned state + owner key
- [ ] Target (by stable key); is alive/dead

### Resource nodes — OPTIONAL
- [ ] Type, position
- [ ] Remaining yield / depleted state + respawn timer

### Containers — OPTIONAL
- [ ] Position, contents (array of item ids + counts), owner key
