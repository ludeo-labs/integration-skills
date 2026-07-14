# RTS Genre Patterns (Unreal)

> **Applies to:** Real-Time Strategy, Tower Defense, Base Builders, MOBA (partial)
> **Load when:** Game involves unit production, base building, resource management, strategic combat
>
> Action names below map to the Ludeo subsystem / DataWriter `SendAction` call (see
> `references/phase-06-actions.md` and `references/sdk-reference/`).

> **MVP scope (curated-first):** In Phases 4–6, treat this catalog as a menu — implement only the
> actions/objects present in your **curated slice** (`integration.json → curatedSlice`). The full
> catalog applies at **expansion** (Phase 8), when coverage broadens to the whole game.

---

## 1. Actions Catalog

### Unit/Building Production

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `BuildUnit` | Produced a unit | "Build 20 units" | 10 pts |
| `BuildStructure` | Built a structure | "Build 5 structures" | 50 pts |
| `BuildDefense` | Built defensive structure | "Build 3 towers" | 30 pts |
| `UpgradeUnit` | Upgraded a unit | "Upgrade 5 units" | 25 pts |
| `UpgradeStructure` | Upgraded a structure | — | 25 pts |
| `Research` | Completed research/tech | "Research 3 upgrades" | 100 pts |

### Combat

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `UnitKill` | Destroyed an enemy unit | "Destroy 50 units" | varies by unit |
| `StructureDestroy` | Destroyed enemy structure | "Destroy 3 buildings" | 200 pts |
| `UnitLost` | Lost a unit | "Lose fewer than 10 units" (inverse) | — |
| `StructureLost` | Lost a structure | — | — |
| `HeroKill` | Killed a hero unit | "Kill the enemy hero" | 500 pts |
| `HeroDeath` | Hero unit died | — | — |

### Economy / Resources

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ResourceCollect` | Gathered resources | "Collect 1000 gold" | per unit |
| `ResourceSpend` | Spent resources | — | — |
| `TradeComplete` | Completed a trade | — | — |
| `WorkerCreated` | Created a worker/harvester | — | — |

### Territory / Objectives

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `CapturePoint` | Captured a strategic point | "Capture 3 points" | 200 pts |
| `LosePoint` | Lost a strategic point | — | — |
| `ObjectiveComplete` | Completed map objective | "Complete all objectives" | 500 pts |
| `WaveComplete` | Survived a wave (tower defense) | "Survive 10 waves" | 100 pts |
| `MatchWin` | Won the match | — | 2000 pts |

### Player Commands

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `AttackOrder` | Issued attack command | — | — |
| `MoveOrder` | Issued move command | — | — |
| `GroupSelect` | Selected a control group | — | — |
| `UseAbility` | Used a special ability | "Use ability 5 times" | — |

---

## 2. Search Keywords

Grep these in C++/Blueprint method/field names and comments. Group results by category.

### Units / Entities / Spawning
```
unit, troop, soldier, army, squad, group, formation
spawn, produce, create, train, recruit, summon, deploy
destroy, kill, die, death, eliminate, remove
hero, champion, commander, leader
worker, harvester, gatherer, villager, peasant, drone, probe, scv
```

### Buildings / Structures / Construction
```
build, construct, place, erect, foundation
structure, building, tower, wall, gate, barracks, factory
upgrade, level, tier, tech, evolve, improve
demolish, raze, dismantle, sell
defense, turret, cannon, fortification
```

### Resources / Economy
```
resource, gold, wood, stone, food, mineral, gas, supply, mana, energy
harvest, gather, mine, collect, extract
cost, afford, spend, buy, purchase, invest
income, rate, production, economy
trade, market, exchange
population, supply, capacity, limit, cap
```

### Territory / Map Control
```
capture, control, occupy, claim, contest, neutral
territory, zone, region, sector, point, node, base
flag, beacon, outpost, expansion
minimap, fog, reveal, scout, explore, vision
```

### Combat / Orders
```
attack, fight, engage, assault, siege, raid, charge
defend, retreat, garrison, hold, guard
move, patrol, waypoint, rally, formation
select, group, hotkey, command, order, queue
ability, spell, skill, power, cooldown, cast
damage, armor, range, dps, aoe
```

### Game Flow
```
wave, round, phase, age, era, epoch
victory, defeat, surrender, ally, enemy, neutral
score, objective, mission, campaign, scenario
```

> **Unreal idioms** (engine-API hooks to grep in C++/Blueprint):
> - **Selection / orders:** cursor picks via `GetHitResultUnderCursorByChannel` /
>   `LineTraceSingleByChannel`; input bound in `SetupInputComponent` (`BindAction`); per-actor
>   click via the `AActor` `OnClicked` delegate (Click Events enabled on the player controller).
> - **Produce / destroy:** `UWorld::SpawnActor`, `AActor::Destroy`.
> - **Unit movement / AI:** `AAIController`, `MoveTo`, `UNavMovementComponent`, Behavior Tree.
> - **Events:** multicast delegates (`DECLARE_DYNAMIC_MULTICAST_DELEGATE`), `UFUNCTION` `On*`/`Handle*`.

---

## 3. Tracking Checklist

After object tracking is implemented (phase 4/5), verify these are covered. Types map to the
Unreal DataWriter set-attribute calls; see `references/phase-05-tracking-restore.md` and
`references/phase-06-actions.md` for the exact API.

### Player State (CRITICAL)
- [ ] Resources (each type: gold, wood, etc.)
- [ ] Population / supply (current and cap)
- [ ] Tech level / age / era
- [ ] Score
- [ ] Team / faction

### Units
- [ ] Position (`FVector`)
- [ ] Unit type / actor class
- [ ] Health / HP
- [ ] Owner / player ID
- [ ] Current order / AI state (idle, moving, attacking, gathering) — typically `AAIController` + state enum / Behavior Tree
- [ ] Target entity ID
- [ ] Is alive

### Structures / Buildings
- [ ] Position
- [ ] Building type
- [ ] Health
- [ ] Owner / player ID
- [ ] Build progress (0.0 to 1.0)
- [ ] Is complete
- [ ] Upgrade level
- [ ] Production queue (if producing units)

### Resources / Economy
- [ ] Resource node positions
- [ ] Resource node remaining amount
- [ ] Player resource totals (each type)

### Map / Territory
- [ ] Control point ownership
- [ ] Fog of war state (per player)
- [ ] Explored areas

### Environment
- [ ] Destructible terrain (if applicable)
- [ ] Weather / time of day (if affects gameplay)
- [ ] Level metadata (map name, game mode, player count)
