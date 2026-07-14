# Survival / Sandbox Genre Patterns (Unreal)

> **Applies to:** Survival/crafting games (Valheim, 7 Days to Die, Rust, Subnautica), sandbox/builder
> games (Minecraft-likes), base-building survival, colony sims with a controlled avatar
> **Load when:** Game involves gathering resources, crafting/building, hunger/thirst/temperature
> survival meters, or placing/destroying world structures
>
> **These games are almost always open-world / streaming and often indefinite (no death-end).** Load
> [open-world.md](references/game-patterns/open-world.md) (session boundaries — note the §7 sandbox edge case:
> load→play→save-exit = one session) and [open-world-tracking.md](references/game-patterns/open-world-tracking.md)
> (streaming-world tracking) **alongside** this file.
>
> Action names below map to the Ludeo subsystem / DataWriter `SendAction` call (see
> `references/phase-06-actions.md` and `references/sdk-reference/`).

> **MVP scope (curated-first):** In Phases 4–6, treat this catalog as a menu — implement only the
> actions/objects present in your **curated slice** (`integration.json → curatedSlice`). The full
> catalog applies at **expansion** (Phase 8), when coverage broadens to the whole game.

---

> ⚠️ **Two shapes of "survival" — pick the right subset.** (1) **Full crafting sandbox** (Valheim, Rust,
> Minecraft, 7 Days): gathering + crafting + building + hunger/thirst/temperature. (2) **Survival-FPS /
> survival-horror** (mostly combat + inventory + a health/stamina meter, **no** crafting/building/gathering).
> Validated Ludeo survival integrations so far are the **survival-FPS slice** — if your game has no
> crafting/building/resource-meter systems, use the **Combat/Threat** actions + **inventory** + the
> **survival-meter** items below, and skip the Gathering / Crafting-Building sections entirely.

---

## 1. Actions Catalog

### Gathering / Harvesting Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ResourceGathered` | Harvested wood/stone/ore/fiber | "Gather 50 wood" | 5 pts |
| `Mined` | Mined a block / ore node | "Mine 10 ore" | 10 pts |
| `TreeChopped` | Felled a tree | "Chop 5 trees" | 10 pts |
| `ItemPickup` | Picked up a loose item | — | — |

### Crafting / Building Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ItemCrafted` | Crafted an item/tool | "Craft a tool" | 25 pts |
| `StructurePlaced` | Placed a building piece | "Build a shelter" | 50 pts |
| `StructureUpgraded` | Upgraded a structure | — | 25 pts |
| `StructureDestroyed` | Demolished / lost a structure | — | — |
| `RecipeUnlocked` | Unlocked a recipe / tech | "Unlock a recipe" | 100 pts |

### Survival Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Ate` / `Drank` | Consumed food/water | — | — |
| `Slept` | Slept (time-skip; same run — see open-world.md) | — | — |
| `Healed` | Restored health | — | — |
| `StarvationDamage` | Took hunger/thirst/cold damage | "Survive a day without starving" (inverse) | — |
| `DayedSurvived` | Survived another day | "Survive 7 days" | 200 pts |

### Combat / Threat Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `CreatureKill` | Killed a creature/mob | "Kill 10 creatures" | 50 pts |
| `BossKill` | Defeated a boss creature | "Defeat the boss" | 1000 pts |
| `Death` | Player died | "Survive without dying" (inverse) | -50 pts |
| `Tamed` | Tamed/domesticated a creature | "Tame a creature" | 100 pts |
| `HitTaken` | Player took damage (survived) | — | — |
| `ShotFired` | Fired a ranged weapon (per-shot heartbeat, if armed) | — | — |
| `StruggleFree` / `EscapeGrab` | Broke free of an enemy grab/grapple (horror-survival) | "Escape 3 grabs" | 25 pts |

> **Kills are additive, multi-axis** (same as shooter.md): one creature death fires the broad `CreatureKill`
> AND a per-type `Kill<Type>` AND, if armed, a per-weapon `Kill<Weapon>` (e.g. by-pistol/by-shotgun/by-melee).
> Emit them together. See `learnings/architecture/additive-action-emission-for-composable-goals.md`.

---

## 2. Search Keywords

Grep these in C++/Blueprint method/field names and comments. Group results by category.

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
creature, mob, animal, enemy, monster, spawn, spawner, AI
attack, damage, kill, death, die, takeDamage, IDamageable
tame, domesticate, breed, mount, pet, follower
aggro, alert, hostile, passive, faction
```

> **Unreal idioms** (engine-API hooks to grep in C++/Blueprint):
> - **Gather / harvest / interact:** `OnComponentBeginOverlap`, `LineTraceSingleByChannel`.
> - **Spawn creatures / nodes:** `UWorld::SpawnActor`, spawner actors, `AAIController`.
> - **Build / place / destroy:** `SpawnActor` / `AActor::Destroy`; `OnComponentHit` for placement.
> - **Events:** multicast delegates, `UFUNCTION` `On*`/`Handle*`.

---

## 3. Tracking Checklist

After object tracking is implemented (phase 4/5), verify these are covered. Types map to the
Unreal DataWriter set-attribute calls; see `references/phase-05-tracking-restore.md` and
`references/phase-06-actions.md` for the exact API. These worlds stream and persist
heavily — apply [open-world-tracking.md](references/game-patterns/open-world-tracking.md): track the **loaded neighborhood
+ world state**, scope cell/chunk mutations to what the captured moment needs, not the entire save.

### Player (CRITICAL)

> Universal player items (position, look/aim rotation, health, alive, team) → `references/game-patterns/common.md` §1.

- [ ] Position (`FVector`), Rotation (`FRotator`)
- [ ] Health, Hunger, Thirst, Stamina, Temperature (and any survival meter — `int`/`float`)
- [ ] Is alive/dead (`bool`)
- [ ] Equipped tool/weapon (by item/content id)
- [ ] Inventory / hotbar (array of item ids + counts; never references — `references/game-patterns/open-world-tracking.md §4`)
  - [ ] For ranged weapons: **magazine (loaded) vs reserve ammo are distinct** — often the same "quantity" property on different inventory entries (see `learnings/save-systems/firearm-magazine-separate-from-reserve-ammo.md`).
- [ ] Unlocked recipes / tech (if it gates the moment)

### Placed structures / world edits
- [ ] Structure/block type + position (by stable cell/chunk + content id — `references/game-patterns/open-world-tracking.md §4`)
- [ ] Health / durability / damage state
- [ ] Owner / team key (multiplayer)
- [ ] Built/destroyed state (destroyed = **state flag**, distinguish from streamed-out — `references/game-patterns/open-world-tracking.md §2`)

### Resource nodes
- [ ] Type, position
- [ ] Remaining yield / depleted state + respawn timer

### Creatures / mobs
- [ ] Position, rotation, health
- [ ] Creature type, AI state (idle, aggro, fleeing) — typically `AAIController` + Behavior Tree
- [ ] Tamed/owned state + owner key
- [ ] Target (by stable key); is alive/dead

### World state (CRITICAL for survival)
- [ ] Game-time, day count, weather, season (a `WorldState` singleton — `references/game-patterns/open-world-tracking.md §3`)

### Containers
- [ ] Position, contents (array of item ids + counts), owner key
