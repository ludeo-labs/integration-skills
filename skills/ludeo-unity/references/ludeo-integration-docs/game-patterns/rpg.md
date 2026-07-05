# RPG Genre Patterns (Unity)

> **Applies to:** Action RPGs, open-world RPGs (Daggerfall, Skyrim/Fallout-likes, Witcher-likes),
> JRPGs with real-time combat, MMORPGs, looter-RPGs (Diablo-likes)
> **Load when:** Game involves character stats/leveling, quests, inventory/equipment, dialogue, or
> faction/reputation systems
>
> **Most RPGs are also open-world / streaming.** If the game has no per-level scenes, load
> [open-world.md](./open-world.md) (session boundaries) and
> [open-world-tracking.md](./open-world-tracking.md) (streaming-world tracking) **alongside** this
> file — this file is the genre catalog; those are the structural shape.
>
> Action names below map to `[SDK]` `LudeoGameplaySession.SendAction(string)` via the `[Layer]`
> `LudeoController.SendAction` (see `phase 6`).

---

## 1. Actions Catalog

> **Candidates, not a capture list.** The **Tier** column ranks capture priority for *this* genre;
> still apply phase 6's keep test before sending any action.
> - **T1 — Capture:** signature scored milestones / one-shot highlights that define the genre.
> - **T2 — Capture if scored or a notable beat in *this* game;** otherwise drop.
> - **T3 — Usually drop:** tracked **state** or high-frequency noise — capturing bloats the Ludeo.
>   Keep only if exceptionally scored. (Rows with both Objective and Scoring empty are almost always T3.)
>
> **Genre T3 traps:** `GainXP` (XP total is tracked **state**; fires on every kill), `Equip` (equipped
> gear is tracked state), and `DialogueChoice`/`UseConsumable`/`Purchase`/`Sell` unless scored.
>
> **Scope (phase 6) — orthogonal to tier:** RPG beats are **almost all player-scoped** (mostly
> single-player) — `Kill`, `Death`, `LevelUp`, `QuestComplete`, `BossKill`. Guard any combat site that
> can fire for a non-player actor; genuinely global events are rare here.

### Combat Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Kill` | T1 | Player kills enemy/creature | "Defeat 10 enemies" | 100 pts |
| `Death` | T1 | Player dies | "Survive without dying" (inverse) | -50 pts |
| `BossKill` | T1 | Defeated a boss/named enemy | "Defeat the boss" | 1000 pts |
| `CriticalHit` | T2 | Landed a critical hit | "Land 5 crits" | +50 bonus |
| `Block` / `Parry` | T2 | Blocked or parried an attack | "Parry 3 attacks" | +25 bonus |
| `SpellCast` | T2 | Cast a spell (T3 if high-frequency, unscored) | "Cast 10 spells" | — |
| `AbilityUsed` | T2 | Used a class ability / shout | "Use ability 5 times" | — |

### Quest / Progression Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `QuestComplete` | T1 | Completed a quest | "Complete the quest" | 500 pts |
| `LevelUp` | T1 | Character gained a level | "Reach level N" | 200 pts |
| `LocationDiscovered` | T1 | Discovered a new location | "Discover 3 locations" | 100 pts |
| `QuestObjective` | T2 | Completed a quest step | "Advance the quest" | 100 pts |
| `SkillUp` | T2 | A skill increased | "Raise a skill" | 50 pts |
| `QuestAccepted` | T3 | Accepted a quest | — | — |
| `GainXP` | T3 | Gained experience | — | — |

### Loot / Economy / Crafting Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `ItemCrafted` | T2 | Crafted / forged an item | "Craft an item" | 50 pts |
| `ChestOpened` | T2 | Opened a container/chest | "Open 3 chests" | 25 pts |
| `LootItem` | T2 | Picked up / looted an item | "Loot 5 items" | 10 pts |
| `Equip` | T3 | Equipped gear | — | — |
| `Purchase` / `Sell` | T3 | Bought/sold at a vendor | — | — |
| `UseConsumable` | T3 | Drank a potion / ate food | — | — |

### Interaction / Social Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `PersuadeSuccess` | T2 | Passed a persuasion/speech check | "Persuade an NPC" | 50 pts |
| `Lockpick` | T2 | Picked a lock | "Pick 3 locks" | 25 pts |
| `DialogueChoice` | T3 | Made a dialogue choice | — | — |
| `Steal` | T3 | Stole an item (caught/uncaught) | — | — |
| `FastTravel` | T3 | Fast-traveled (same run; not a session boundary — see open-world.md) | — | — |

---

## 2. Search Keywords

Grep these in C# method/field names and comments. Group results by category. In Unity, combat and
interaction frequently route through **physics callbacks** (`OnTriggerEnter`/`OnCollisionEnter`) and
**event hooks** (`UnityEvent`, C# `event`/`Action`, `On*`/`Handle*` handlers) — search those too.

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
loot, pickup, container, chest, OnTriggerEnter
gold, currency, coin, buy, sell, vendor, merchant, trade, barter
craft, forge, smith, enchant, brew, alchemy, recipe
consumable, potion, food, eat, drink, useItem, heal
```

### Interaction / Dialogue / World
```
dialogue, conversation, talk, speak, NPC, choice, response
persuade, intimidate, bribe, speech, lockpick, pickpocket, steal, crime, bounty
interact, activate, use, open, OnInteract, IInteractable
time, weather, day, night, schedule, AI, NavMeshAgent
```

---

## 3. Tracking Checklist

After object tracking is implemented (phase 5 · task 1), verify these are covered. Types map to `[SDK]`
`SetAttribute` overloads (see `12-SDK-API-REFERENCE.md`). For streaming worlds, also apply
[open-world-tracking.md](./open-world-tracking.md) (track the loaded neighborhood + world/cell state,
not the whole save). Sections are tiered by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

### Player — CRITICAL
- [ ] Position (`Vector3`), Rotation (`Quaternion`)
- [ ] Health / HP, Mana / Magicka, Stamina/Fatigue (`int`/`float`)
- [ ] Is alive/dead (`bool`)
- [ ] Level, XP, attributes/skills (current values)
- [ ] Equipped gear (weapon, armor — by item/content id, not reference)
- [ ] Inventory (array of item ids + counts; never object references — `06 §9.4`)
- [ ] Gold / currency
- [ ] Current region/cell id (open-world)
- [ ] Faction reputation / standing

### NPCs / Enemies — IMPORTANT
- [ ] Position, rotation, health
- [ ] AI state (idle, combat, fleeing, schedule) — often `NavMeshAgent` + state enum
- [ ] Disposition / faction / is-hostile
- [ ] Target entity (by stable key)
- [ ] Dialogue/quest state if it gates behavior
- [ ] Is alive/dead (a killed-not-respawned NPC is a **state flag**, not just an unregister — `06 §9.4`)

### Quests / World State — IMPORTANT (world flags that gate the visible moment are CRITICAL)
- [ ] Active quest ids + current stage/objective (as their own objectType)
- [ ] World/global flags that affect the visible moment
- [ ] Game-time, weather, season (a `WorldState` singleton — `open-world-tracking.md §3`)

### Items / Containers / World objects — OPTIONAL
- [ ] Dropped/world items: position, item type, owner key
- [ ] Containers/chests: opened/looted state, contents
- [ ] Doors / locks: open, locked state
- [ ] Lootable corpses: looted state
