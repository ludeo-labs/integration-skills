# RPG Genre Patterns (Unreal)

> **Applies to:** Action RPGs, open-world RPGs (Daggerfall, Skyrim/Fallout-likes, Witcher-likes),
> JRPGs with real-time combat, MMORPGs, looter-RPGs (Diablo-likes)
> **Load when:** Game involves character stats/leveling, quests, inventory/equipment, dialogue, or
> faction/reputation systems
>
> **Most RPGs are also open-world / streaming.** If the game has no per-level scenes, load
> [open-world.md](references/game-patterns/open-world.md) (session boundaries) and
> [open-world-tracking.md](references/game-patterns/open-world-tracking.md) (streaming-world tracking) **alongside** this
> file — this file is the genre catalog; those are the structural shape.
>
> Action names below map to the Ludeo subsystem / DataWriter `SendAction` call (see
> `references/phase-06-actions.md` and `references/sdk-reference/`).

> **MVP scope (curated-first):** In Phases 4–6, treat this catalog as a menu — implement only the
> actions/objects present in your **curated slice** (`integration.json → curatedSlice`). The full
> catalog applies at **expansion** (Phase 8), when coverage broadens to the whole game.

---

## 1. Actions Catalog

### Combat Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Kill` | Player kills enemy/creature | "Defeat 10 enemies" | 100 pts |
| `Death` | Player dies | "Survive without dying" (inverse) | -50 pts |
| `CriticalHit` | Landed a critical hit | "Land 5 crits" | +50 bonus |
| `SpellCast` | Cast a spell | "Cast 10 spells" | — |
| `AbilityUsed` | Used a class ability / shout | "Use ability 5 times" | — |
| `Block` / `Parry` | Blocked or parried an attack | "Parry 3 attacks" | +25 bonus |
| `BossKill` | Defeated a boss/named enemy | "Defeat the boss" | 1000 pts |

### Quest / Progression Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `QuestAccepted` | Accepted a quest | — | — |
| `QuestObjective` | Completed a quest step | "Advance the quest" | 100 pts |
| `QuestComplete` | Completed a quest | "Complete the quest" | 500 pts |
| `LevelUp` | Character gained a level | "Reach level N" | 200 pts |
| `SkillUp` | A skill increased | "Raise a skill" | 50 pts |
| `GainXP` | Gained experience | — | — |
| `LocationDiscovered` | Discovered a new location | "Discover 3 locations" | 100 pts |

### Loot / Economy / Crafting Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `LootItem` | Picked up / looted an item | "Loot 5 items" | 10 pts |
| `Equip` | Equipped gear | — | — |
| `ItemCrafted` | Crafted / forged an item | "Craft an item" | 50 pts |
| `Purchase` / `Sell` | Bought/sold at a vendor | — | — |
| `UseConsumable` | Drank a potion / ate food | — | — |
| `ChestOpened` | Opened a container/chest | "Open 3 chests" | 25 pts |

### Interaction / Social Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `DialogueChoice` | Made a dialogue choice | — | — |
| `PersuadeSuccess` | Passed a persuasion/speech check | "Persuade an NPC" | 50 pts |
| `Lockpick` | Picked a lock | "Pick 3 locks" | 25 pts |
| `Steal` | Stole an item (caught/uncaught) | — | — |
| `FastTravel` | Fast-traveled (same run; not a session boundary — see open-world.md) | — | — |

---

## 2. Search Keywords

Grep these in C++/Blueprint method/field names and comments. Group results by category.

### Combat / Magic / Damage
```
attack, kill, killed, death, die, died, dead, defeat, slay
damage, hurt, hit, takeDamage, applyDamage, OnDamage, IDamageable, critical, crit
spell, cast, magic, mana, ability, shout, power, cooldown
block, parry, dodge, stagger, stun
health, hp, hitpoints, stamina, fatigue
```

### Stats / Leveling / Quests
```
level, levelUp, xp, experience, exp, skill, skillUp, attribute, perk, talent
stat, strength, agility, intelligence, endurance, charisma
quest, mission, objective, journal, questStage, QuestComplete, OnQuestUpdated
faction, reputation, disposition, standing, relationship
discover, location, mapMarker, fastTravel
```

### Inventory / Loot / Economy / Crafting
```
inventory, item, equip, unequip, wear, wield, slot, loadout
loot, pickup, container, chest
gold, currency, coin, buy, sell, vendor, merchant, trade, barter
craft, forge, smith, enchant, brew, alchemy, recipe
consumable, potion, food, eat, drink, useItem, heal
```

### Interaction / Dialogue / World
```
dialogue, conversation, talk, speak, NPC, choice, response
persuade, intimidate, bribe, speech, lockpick, pickpocket, steal, crime, bounty
interact, activate, use, open, OnInteract, IInteractable
time, weather, day, night, schedule, AI
```

> **Unreal idioms** (engine-API hooks to grep in C++/Blueprint):
> - **Interaction / loot:** `OnComponentBeginOverlap`, an interaction `UInterface`.
> - **AI / schedules:** `AAIController`, Behavior Tree, `UNavMovementComponent`.
> - **Stats / abilities / leveling:** for GAS games, `UAbilitySystemComponent`, `UGameplayEffect`,
>   attribute sets; damage via `OnTakeAnyDamage` / `OnTakePointDamage`.
> - **Events:** multicast delegates, `UFUNCTION` `On*`/`Handle*`.

---

## 3. Tracking Checklist

After object tracking is implemented (phase 4/5), verify these are covered. Types map to the
Unreal DataWriter set-attribute calls; see `references/phase-05-tracking-restore.md` and
`references/phase-06-actions.md` for the exact API. For streaming worlds, also apply
[open-world-tracking.md](references/game-patterns/open-world-tracking.md) (track the loaded neighborhood + world/cell state,
not the whole save).

### Player (CRITICAL)
- [ ] Position (`FVector`), Rotation (`FRotator`)
- [ ] Health / HP, Mana / Magicka, Stamina/Fatigue (`int`/`float`)
- [ ] Is alive/dead (`bool`)
- [ ] Level, XP, attributes/skills (current values)
- [ ] Equipped gear (weapon, armor — by item/content id, not reference)
- [ ] Inventory (array of item ids + counts; never object references — `06 §9.4`)
- [ ] Gold / currency
- [ ] Current region/cell id (open-world)
- [ ] Faction reputation / standing

### NPCs / Enemies
- [ ] Position, rotation, health
- [ ] AI state (idle, combat, fleeing, schedule) — typically `AAIController` + Behavior Tree + state enum
- [ ] Disposition / faction / is-hostile
- [ ] Target entity (by stable key)
- [ ] Dialogue/quest state if it gates behavior
- [ ] Is alive/dead (a killed-not-respawned NPC is a **state flag**, not just an unregister — `06 §9.4`)

### Quests / World State
- [ ] Active quest ids + current stage/objective (as their own objectType)
- [ ] World/global flags that affect the visible moment
- [ ] Game-time, weather, season (a `WorldState` singleton — `open-world-tracking.md §3`)

### Items / Containers / World objects
- [ ] Dropped/world items: position, item type, owner key
- [ ] Containers/chests: opened/looted state, contents
- [ ] Doors / locks: open, locked state
- [ ] Lootable corpses: looted state
