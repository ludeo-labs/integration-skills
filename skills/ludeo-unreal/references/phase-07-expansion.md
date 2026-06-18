# Phase 07 — Expansion (full-game coverage)

> **⚠ Scope: Phase 7 is for BROADER coverage, NOT for backfilling load-bearing state.**
>
> Phase 7 expands coverage beyond the curated slice: more entities across more maps, more actions,
> richer metadata, and full-game systems that a single slice never exercises. That's it.
>
> **If Phase 7 discovery reveals state required for the curated slice's demo to feel correct — e.g.,
> a progression trail the level blueprint depends on, mission prop state that affects gameplay, an
> objective system that drives scripted logic — that is a Phase 4 miss, not a Phase 7 addition.**
> Go back to Phase 4 (Tracking & Restore), re-run the "What breaks on restore?" diagnostic and the
> intake Group 5 questions (phase-00), add the missing subsystem to Phase 4's trail capture plan,
> and re-verify Phase 4's completion gate.
>
> **Failure pattern this prevents:** The ActionGame integration deferred milestone/objective tracking
> to expansion because it read as "enrichment." When the demo broke (level BP re-executed setup-phase
> logic on restore), the agent hacked around it with VO suppress races and late-sweep NPC destruction
> before eventually pulling the work back into Phase 4. If a snapshot restore produces wrong
> scripted-system behavior, the fix is in Phase 4, not here.
>
> **Test:** Before adding anything to Phase 7, ask: "Is this needed for the curated slice demo to feel
> correct?" If yes → Phase 4. If no → proceed with Phase 7.

---

## 1. Goal / Purpose

With the curated slice cloud-validated in Phase 6, Phase 7 broadens tracking to the full game. This
happens in two layers:

**Layer A — The Loop:** Re-apply Phases 3 (Map Objects), 4 (Tracking & Restore), and 5 (Actions) at
full-game scope — all maps, all game modes, all entity families, all action categories. The curated
slice was a beachhead; this is the full invasion.

**Layer B — The Expansion Layer:** Cover full-game systems that a single slice never exercises.
Re-running the loop alone is not enough — certain system categories only manifest at full-game scope
and require dedicated treatment:

- Mission / objective / quest state machines
- Environment and world state (doors, cameras, destructibles, alarms, level-script counters; world/cell
  state for streaming worlds)
- Stateful subsystems: wave/assault/spawn managers — cooldowns, RNG seeds, reservations; absolute
  timestamps converted to deltas
- Cross-slice entity families: extra AI families, vehicles, drones — tracked with typed iterators
- One-time / scripted state that must be re-applied on restore

**Deliverables:**
- Full entity inventory (beyond the curated slice)
- Per-entity state property mapping for all tracked entities
- Broader action discovery across all modes and entity families
- Write frequency strategy with performance budget
- Reconstruction feasibility preview (for Phase 8 Player Flow Polish)
- Human-approved Tracked Data plan covering the full game
- Implemented writable objects, state writing, and action hooks for all new entities and actions
- Updated TDD (`tddSections7a/7b`) and `integration.json`

### Input Contract

```
Required:
  tddSections1-6: markdown   — Prior TDD sections (.ludeo/tdd/integration-tdd.md)
  codeMap: json              — .ludeo/code-map.json (populated through Phase 5)
  curatedSlice: object       — integration.json → curatedSlice (baseline entities/actions)
  workingPlugin: files       — Plugin from Phases 2-5 with lifecycle + state + actions + non-gameplay
  phase6Verification: notes  — Cloud verification results from Phase 6

Optional:
  ludeoContext: MCP          — ludeo-context MCP server (QA event lists, genre patterns)
  sdkDocs: MCP               — sdk-docs MCP server (DataWriter/DataReader API)
```

### Output Contract

```
Produces:
  tddSection7a: markdown     — Tracked Data Plan (discovery) appended to .ludeo/tdd/integration-tdd.md
  tddSection7b: markdown     — Expansion Implementation section appended to TDD
  expansionCode: files        — New writable objects, state writing, action hooks
  decisions[]: Decision[]     — Appended to integration.json → decisions[]
  integration.json update     — currentPhase: 8 on completion
```

---

## 2. Inputs (Input Contract)

Before starting this phase, verify:

- [ ] Phase 6 cloud verification completed — curated slice validated in the cloud
- [ ] Plugin compiles cleanly with lifecycle + state tracking + actions + non-gameplay code
- [ ] CODE_MAP populated with `core_classes`, `event_systems`, `lifecycle_hooks`, `ai`, `inventory`,
      `ability_system`
- [ ] `curatedSlice.entities` and `curatedSlice.actions` populated (from Phases 3/5)
- [ ] Save system group known (`integration.json → saveSystemGroup`)
- [ ] Human is available — this phase has two hard approval gates before implementation begins

---

## 3. Steps

Phase 7 runs as two consecutive sub-phases: **§3A Discovery** (analysis only, no code) followed by
**§3B Implementation** (code-producing). Do not start §3B without human approval of the §3A plan.

---

### §3A — Discovery (re-run Map Objects → Tracking & Restore → Actions at full-game scope)

This is analysis only. No C++ code is written. Complete ALL analysis items before presenting to the
human.

#### §3A.1 Baseline Review

Read Phases 3–5 output from the TDD. Catalog what is already tracked so this phase only discovers
what is NEW.

| What | Where to Find |
|------|---------------|
| Entities with writable objects | TDD Section 3 — typically GameMetadata + Player, maybe Bot |
| State properties per entity | TDD Section 3 — per-entity property list (Position, Health, TeamID, etc.) |
| Actions currently hooked | TDD Section 5 — typically Kill, Death, 1-3 slice-specific |
| Serialization approach | TDD Section 3 / `integration.json → saveSystemGroup` |
| Write frequency | TDD Section 3 — current tick interval for state writes |

Record the baseline in a summary table before proceeding. Everything discovered below is **additive**
to this baseline.

#### §3A.2 Game Mode / Experience Discovery

**Do this BEFORE entity discovery.** Many games have fundamentally different gameplay styles under
one roof (e.g., Lyra has Elimination, Control Points, and TopDownArena — a shooter, an objective
mode, and a bomberman-style mode). Entities and actions differ per mode.

**Step 1: Map all game modes / experiences**

| What to Find | How to Find |
|-------------|-------------|
| GameMode classes | `Grep("GameMode\|GameModeBase", glob: "*.h")` — find all mode subclasses |
| Experience assets (Lyra-style) | `Glob(pattern: "*Experience*.uasset", path: "Content/")` or `Grep("ExperienceDefinition\|ExperienceAction", glob: "*.h")` |
| Map-to-mode bindings | `Grep("(GameModeName\|DefaultGameMode\|/Game/.*GameMode)", glob: "*.ini")` |
| Mode-specific components | `Grep("(GameFeature\|GameFeatureAction\|AddComponents)", glob: "*.h")` — modular games inject components per mode |

**Step 2: Classify each mode**

| Mode | Maps | Gameplay Style | Unique Entities | Unique Actions |
|------|------|---------------|-----------------|----------------|
| [mode] | [maps] | Same-style / Different-objective / Different-genre | [entities unique to this mode] | [actions unique to this mode] |

**Classification:**
- **Same-style** — Variants of the curated slice (TDM vs FFA — same combat, different scoring).
  Entities/actions mostly shared.
- **Different-objective** — Same core gameplay but different win condition (Control Points vs
  Elimination). Adds objective entities/actions.
- **Different-genre** — Fundamentally different gameplay (shooter vs bomberman). Requires separate
  entity/action sets.

**Decision point — ask the human:** "Here are the game modes I found: [table]. Which should Ludeo
support? Are there modes that should be excluded (e.g., tutorial, test modes)?"

**If the game has different-genre modes:** Flag this as an architectural decision — the implementation
will need **mode-conditional entity/action registration** (different trackers for different
experiences). Record this in the Tracked Data plan.

#### §3A.3 Gameplay Tag Audit

**Tags are the cheapest discovery mechanism.** Gameplay tag config files reveal scoring systems,
accolades, movement abilities, message channels, and UI features — all in one place.

| What to Find | How to Find |
|-------------|-------------|
| Tag config files | `Glob(pattern: "**/*Tags*.ini", path: "Config/")` and `Glob(pattern: "**/*Tags*.ini", path: "Plugins/")` |
| C++ tag definitions | `Grep("UE_DEFINE_GAMEPLAY_TAG\|FGameplayTag::RequestGameplayTag", glob: "*.cpp")` |
| Tag-driven messages | `Grep("FGameplayTag.*Message\|TAG_.*Message", glob: "*.h")` |
| Scoring/accolade tags | Look for tags containing: Score, Accolade, Elim, Streak, Kill, Death, Assist, Ability |
| Movement/ability tags | Look for tags containing: Ability.Type, Movement, Dash, Sprint, Jump |

**Read ALL tag config files.** In Lyra, `ShooterCoreTags.ini` reveals scoring, accolades, dash, ADS,
weapon ammo — all in one file. This is faster and more complete than grepping C++ headers.

**Cross-reference:** Tags that appear in both `.ini` configs AND C++ `UE_DEFINE_GAMEPLAY_TAG` are
code-driven. Tags only in `.ini` are likely BP-driven — flag these for Blueprint investigation.

**CRITICAL: Every `Ability.Type.Action.*` tag is a candidate Ludeo action.** For each tag found
(e.g., `Ability.Type.Action.Dash`, `Ability.Type.Action.Grenade`, `Ability.Type.Action.Melee`):

1. Add it to the action candidate list for §3A.6
2. The hook point is `AbilityActivatedCallbacks` on the player's `UAbilitySystemComponent` — NOT
   GameplayMessageSubsystem or delegates.
3. Similarly, `Event.Movement.*` tags represent gameplay events worth tracking.

Do NOT wait until §3A.6 to discover these — carry them forward now.

#### §3A.4 Entity Discovery (full-game scope — forget the curated slice)

**Scope:** This analysis covers the **full game**, not just the curated slice. You are now discovering
EVERY experience, EVERY game mode, EVERY map. Scope all greps to the game's Source directory (e.g.,
`path: "Source/{GameName}/"`) to avoid matching engine source, third-party plugins, or the Ludeo
plugin itself.

Use the matching `references/game-patterns/<genre>.md` Actions Catalog + Tracking Checklist as the
full-game coverage list (the curated slice used a subset).

**C++ entity discovery:**

| Entity Category | How to Find | Notes |
|----------------|-------------|-------|
| AI / Bot entities | `Grep("(AIController\|BotController\|AIPawn\|BehaviorTree)", glob: "*.h")` | Check AI state (blackboard, perception) |
| Vehicles | `Grep("(Vehicle\|AVehicle\|UVehicleMovement)", glob: "*.h")` | Type, occupants, movement state |
| Interactables | `Grep("(Pickup\|Interactable\|Collectible\|Loot)", glob: "*.h")` | Spawn state, availability |
| World objects | `Grep("(Objective\|CapturePoint\|SpawnPoint\|Zone\|Flag)", glob: "*.h")` | Ownership, progress |
| Match / game state | `Grep("(GameState\|MatchState\|RoundState\|ScoreBoard)", glob: "*.h")` | Scores, timers, round info |
| Inventory / loadout | `Grep("(Inventory\|Loadout\|Equipment\|Backpack)", glob: "*.h")` | Equipped items, ammo counts |
| Destructibles | `Grep("(Destructible\|DestructionState\|Breakable\|Damageable)", glob: "*.h")` | Damage state, intact/destroyed |
| Controller-owned components | `Grep("(QuickBar\|Inventory\|Equipment\|Loadout)", glob: "*.h")` on Controller classes | In some games (Lyra), weapon/item state lives on the Controller, not the Pawn — check BOTH hierarchies |

**Blueprint entity discovery (critical for BP-heavy games):**

| What to Check | How to Find |
|--------------|-------------|
| BP class hierarchy | `Grep("BlueprintType\|Blueprintable", glob: "*.h")` — find C++ base classes extended in BP |
| BP-only actors in levels | Check `Content/` for Blueprint assets placed in levels |
| Actor components in BP | Some entities are composed entirely of BP components (health, energy, AI) — state lives in component variables |
| Data-driven entities | `Grep("(DataTable\|DataAsset\|PrimaryAssetType)", glob: "*.h")` |

**If the game is Blueprint-heavy:** Use the **BP Inspector tool** (see SKILL.md → Available Tools)
to discover BP entities, their components, parent classes, and variables.

For each discovered entity, record: class name, source file, lifecycle (persistent vs
spawned/destroyed vs streamed), and relevance to Player Flow reconstruction.

#### §3A.5 Per-Entity State Mapping

For each confirmed entity, discover its trackable state. The goal is to discover what state **this
game** has, not to assume a specific set.

**Property discovery approach:**

| What to Look For | How to Find |
|-----------------|-------------|
| C++ UPROPERTYs | Read the entity's header — look for `UPROPERTY` with gameplay-relevant types (float, int, FVector, FString, enums) |
| Component state | `Grep("UActorComponent\|USceneComponent", glob: "*.h")` on the entity's class |
| Blueprint variables | `Grep("BlueprintReadWrite\|BlueprintReadOnly\|EditAnywhere", glob: "*.h")` — for BP-only variables, use the BP Inspector tool |
| Behavior tree / AI state | `Grep("(BehaviorTree\|BlackboardComponent\|BTTask\|BTDecorator)", glob: "*.h")` |
| Destructible / environmental state | `Grep("(Destructible\|Health\|Durability\|DamageState)", glob: "*.h")` |
| Progression / score state | `Grep("(Score\|Points\|XP\|Level\|Rank\|Currency)", glob: "*.h")` |
| Cooldown / timer state | `Grep("(Cooldown\|Timer\|Duration\|Charge)", glob: "*.h")` |
| Runtime getter state | Check Controllers and AIControllers for getter methods: `GetControlRotation()`, `GetMoveStatus()`, `GetFocusActor()`, perception queries |
| Match-level state | `Grep("(MatchTime\|TimeRemaining\|TimeLimit\|RoundNumber\|ScoreLimit\|WinCondition\|GamePhase)", glob: "*.h")` |
| Paired min/max values | When tracking Health, check for MaxHealth; when tracking Energy, check for MaxEnergy |

**UE5 Blueprint type caveat:** Blueprint "float" properties are actually `FDoubleProperty` (double
precision) at the C++ level. The BP Inspector report shows these as `real`. When reading BP
health/damage/energy values via reflection, use `double` not `float` to avoid truncation.

**Per-entity access strategy:** For each entity, note whether it has a C++ class (direct access) or
is BP-only (needs `StaticLoadClass`, tag-based discovery, or runtime reflection). This directly
affects implementation complexity.

**One-way transition optimization:** If a property is a one-way boolean transition on a high-count
entity type (intact → destroyed, available → collected), consider tracking the **transition as an
action** (with position data) instead of polling N entities per tick. E.g., `BlockDestroyed` action
with location vs polling 50 destructible blocks for state changes.

**Key analysis per property:**

- [ ] Is it a UPROPERTY? If using SaveWorld approach, does it have the `SaveGame` flag?
- [ ] Is it in C++ or Blueprint-only? (BP-only requires reflection or manual reads)
- [ ] How to read it? (direct access, getter, reflection, component traversal)
- [ ] How to restore it in Player Flow? (direct set, deferred, behavioral — note for Phase 8)
- [ ] Is it redundant with another property?
- [ ] Static or dynamic? (set once vs changes per tick)

When extending GameMetadata with new attributes, add a `SchemaVersion` integer property (e.g.,
`WriteData("SchemaVersion", 2)`) so Player Flow can detect version mismatches.

**Required GameMetadata for multi-mode games:** If the game has multiple game modes/experiences, the
experience/mode name is **required** GameMetadata — not a nice-to-have. Without it, Player Flow
cannot know which mode to set up during reconstruction. Add `ExperienceName` or `GameModeName` for
any game with more than one mode.

#### §3A.6 Broader Action Discovery

Discover actions beyond Kill/Death. The approach is **discovery-driven, not assumption-driven** —
find what events the game actually fires, then decide which are worth tracking.

**Step 4a: Discover the game's event surface area**

| What to Find | How to Find |
|-------------|-------------|
| Multicast delegates | `Grep("DECLARE_MULTICAST_DELEGATE\|DECLARE_DYNAMIC_MULTICAST", glob: "*.h")` |
| Message subsystem channels | `Grep("(UGameplayMessageSubsystem\|FGameplayTag.*Message\|BroadcastMessage)", glob: "*.h")` |
| Event dispatchers (BP) | `Grep("(BlueprintAssignable\|BlueprintCallable.*Event)", glob: "*.h")` |
| Custom event buses | `Grep("(EventBus\|EventDispatcher\|OnNotify\|Subscribe)", glob: "*.h")` |
| Accolade / reward systems | `Grep("(Accolade\|Award\|Achievement\|Medal\|Streak)", glob: "*.h")` |
| GAS ability tags | Tags from §3A.3: every `Ability.Type.Action.*` and `Event.Movement.*` tag. Hook: `AbilityActivatedCallbacks` on the player's ASC. |

**Step 4b: Filter for Ludeo-relevant actions**

| Category | Examples (vary per game) | Signal |
|----------|------------------------|--------|
| Combat events | Kills, assists, damage types, headshots | Most FPS/TPS games |
| Skill expression | Ability use, combos, perfect dodges | Ability/skill systems |
| Achievement moments | Multi-kills, streaks, records | Accolade/processor systems |
| Collection / economy | Pickups, purchases, crafting | Item systems |
| Objective progress | Captures, defenses, deliveries | Objective-based modes |
| Movement / traversal | Vehicle entry, teleport, grapple | Movement mechanics |
| Social | Emotes, pings, callouts | Social features |
| State changes | Transform, class swap, respawn | Character state changes |

**Step 4c: Genre pattern suggestions**

Read the standard FPS action set into context —
`Read("<skill-base-dir>/learnings/common-mistakes/standard-fps-action-set.md")` — and use it as a
starting point. These are **suggestions to validate against the game**, not a checklist to implement
blindly.

**Key principle:** Bias toward capturing MORE actions, not fewer. Actions are cheap to track and
don't have to become Studio Labs triggers immediately — they're available for future use.

**Step 4d: Enrich existing actions**

For each already-tracked action, examine the event payload:

| Check | What to Look For |
|-------|-----------------|
| Context tags | Does the event carry `FGameplayTagContainer` or `InstigatorTags`/`ContextTags`? E.g., Kill already works, but `GameplayEffect.DamageType.*` tags reveal the weapon/method used |
| Magnitude / damage value | Does the event include damage amount, distance, or other numeric context? |
| Secondary actors | Does the event reference a secondary actor (assist player, item used, ability cast)? |
| State delta actions | Can a meaningful action be derived from comparing state between ticks? |

**Step 4e: Action Naming Convention**

Before finalizing the action list:

1. **Name from the player's perspective.** A player says "double kill" not "elim chain." Use
   `DoubleKill`, not `ElimChain`. Use `KillStreak5`, not `ElimStreak`.
2. **Actions and context are SEPARATE.** `Kill` is always `Kill`. The weapon/damage type is sent as a
   separate action with the full tag path. Do NOT merge them into `Kill_Rifle`.
3. **Use PascalCase.** `WeaponPickup`, `DoubleKill`, `ControlPointCaptured`.
4. **Accolades map to human-readable names.** `DoubleKill`, `TripleKill`, `KillStreak5`, `KillStreak10`
   — not processor class names.
5. **If `ludeo-context` MCP is available**, query it for QA event naming conventions.

#### §3A.7 Write Frequency Strategy

For each dynamic entity, determine the update frequency:

| Factor | Guidance |
|--------|---------|
| Baseline | 10Hz (~100ms interval) — proven in Lyra for FPS |
| Short sessions (<5 min) | 10Hz is fine |
| Long sessions (>15 min) | Consider 5Hz or adaptive |
| Many entities (>10 dynamic) | Consider reducing per-entity frequency |
| Large state per entity | Consider delta tracking (only write changed properties) |
| Many instances of one type (>50) | Aggregate state or use proximity-based filtering |
| Static properties | Write once at BeginGameplay or first tick — NOT every frame |

**Performance budget formula:**

```
bytes_per_second = num_entities x properties_per_entity x avg_property_size x frequency_hz
```

Where `avg_property_size`: float = 4B, FVector = 12B, FRotator = 12B, int32 = 4B, FString = 2 x
length + overhead.

**Threshold:** If the estimate exceeds ~50KB/s, recommend frequency reduction or delta tracking.

#### §3A.8 Expansion Layer Discovery

The loop above (§3A.1–§3A.7) covers entity/action widening. Before presenting the Tracked Data plan,
also discover these full-game systems that a single slice never exercises:

**Mission / Objective / Quest State Machines**

| What to Find | How to Find |
|-------------|-------------|
| Quest / mission managers | `Grep("(Quest\|Mission\|Objective\|Task)\w*Manager\|Component\|Subsystem", glob: "*.h")` |
| State machine enums | `Grep("(QuestState\|MissionState\|ObjectiveStatus\|TaskPhase)", glob: "*.h")` |
| Stage / phase progression | `Grep("(SetStage\|AdvancePhase\|CompleteObjective\|FailMission)", glob: "*.h")` |
| Active/completed/failed tracking | `Grep("(ActiveQuests\|CompletedMissions\|FailedObjectives)", glob: "*.h")` |

For each quest/mission/objective system: capture the full state machine state (active stage, per-sub-
objective completion flags, timer if timed). Identify whether state is stored on a subsystem, game
state, or player state component.

**Environment / World State**

| What to Find | How to Find |
|-------------|-------------|
| Doors / gates | `Grep("(Door\|Gate\|Hatch\|AccessPanel)\w*(Open\|Close\|Lock\|State)", glob: "*.h")` |
| Cameras / security | `Grep("(SecurityCamera\|Surveillance\|CCTV\|AlertCamera)", glob: "*.h")` |
| Destructibles / breakables | `Grep("(Destructible\|Breakable\|Damageable\|DestructionState)", glob: "*.h")` |
| Alarm / alert systems | `Grep("(Alarm\|Alert\|Detection\|SuspicionLevel\|AlertState)", glob: "*.h")` |
| Level-script counters | Level Blueprint variable greps — use the BP Inspector / KismetDump tool |
| World streaming / cell state | For open-world games — see `references/game-patterns/open-world-tracking.md` |

For environment/world state: prefer **one-way transition actions** (e.g., `DoorOpened` with location)
over per-tick polling for high-count static actors. Capture world/cell state mutations using the
open-world tracking pattern for streaming worlds.

**Stateful Subsystems (wave/assault/spawn managers)**

| What to Find | How to Find |
|-------------|-------------|
| Wave / round managers | `Grep("(WaveManager\|WaveController\|SpawnDirector\|AssaultManager)", glob: "*.h")` |
| Spawn reservations / pools | `Grep("(SpawnPool\|SpawnReservation\|SpawnBudget\|SpawnQueue)", glob: "*.h")` |
| RNG state | `Grep("(FRandomStream\|RandSeed\|RandomSeed\|FMath::RandRange)", glob: "*.h")` |
| Cooldown / recharge systems | `Grep("(Cooldown\|RechargeTimer\|AbilityCooldown\|SpawnCooldown)", glob: "*.h")` |
| Absolute timestamps | `Grep("(GetGameTimeSinceCreation\|GetTimeSeconds\|FDateTime\|AbsoluteTime)", glob: "*.h")` |

**Critical for timestamps:** Capture wave/assault timing as **deltas** (time remaining or elapsed
since an event), NOT as absolute world-time values. Absolute timestamps go stale the moment the
Ludeo is replayed on a different machine or at a later time. E.g., instead of `WaveStartAbsoluteTime
= GetGameTimeSinceCreation()`, capture `WaveTimeElapsed = GetGameTimeSinceCreation() -
WaveStartTime`. For RNG state: if the game's RNG seeds are deterministic, capture the seed and the
N-calls-consumed count, not the current random value.

**Cross-slice Entity Families**

For AI families, vehicles, and drone swarms that exceed the curated slice:

- Use `TActorIterator<T>` typed iterators for each entity family — don't try to generalize into a
  single untyped loop.
- Register each family in a separate typed map: `FLudeoWritableObject::WritableObjectMapType
  TrackedBotWritables`, `TrackedVehicleWritables`, `TrackedDroneWritables`, etc.
- For hierarchically related types (e.g., all AI enemies are subclasses of `ABaseEnemy`), use
  the base class iterator and check subclass at registration.
- Identify whether a family needs AIController-based or PlayerState-based discovery (§3B.1).

**One-time / Scripted State**

| What to Find | How to Find |
|-------------|-------------|
| One-shot trigger volumes | `Grep("(OnceOnly\|bHasTriggered\|bAlreadyActivated\|bOneShot)", glob: "*.h")` |
| Scripted events / VO | `Grep("(ScriptedAction\|CinematicEvent\|VoiceOverTrigger\|OneTimeEvent)", glob: "*.h")` |
| Modifier applications | `Grep("(ApplyModifier\|ApplyEffect\|GrantAbility\|GrantItem)", glob: "*.h")` |
| Stat initializers | `Grep("(InitStats\|InitAttributes\|SetBaseValue\|SetLevel)", glob: "*.h")` |

For one-time/scripted state: capture which triggers have fired (bool flags) and which scripted
modifiers have been applied (e.g., granted abilities, stat multipliers). On restore, re-apply ONLY
the modifiers that were active at capture — do NOT re-run the scripted init sequences, which would
double-apply.

---

### §3A.9 Human Approval Gate (before implementation)

**Do NOT proceed to §3B until the human approves the Tracked Data plan.**

Present the complete plan using the tables in §5. Show ALL of:

1. Game Mode Map (from §3A.2)
2. Entity Inventory Table (§5.1) — per mode where applicable
3. State Property Tables per entity (§5.2)
4. Action Inventory Table (§5.3) — including enrichments to existing actions
   - Present the EXACT strings that will be passed to `ReportAction()`. The human should confirm
     these match expectations (catches `ElimChain` vs `DoubleKill`, `Kill_Rifle` vs `Kill` + `DamageType`).
5. Write Frequency Summary (§5.4)
6. Reconstruction Preview (§5.5)
7. Expansion Layer findings (mission state, world state, subsystem state, cross-slice families, one-time state)
8. Architectural decisions (mode-conditional, BP access strategy, multiplayer)

Iterate on the plan if the human requests changes.

---

### §3B — Implementation (now the whole game, not just the slice)

Discovery is complete from §3A. Implementation follows Phase 3's patterns at full-game scope.

#### §3B.1 Review §3A Tracked Data Plan

For each entity, property, and action in the approved plan, verify implementability:

| What | Check |
|------|-------|
| Entity class accessible | Can the plugin access the class? (module dependency, API export macro) |
| Properties readable | Are getters exported? Are components accessible? Are UPROPERTYs public/protected? |
| Event hooks available | Are delegates declared with the module's API export? Are message channels accessible? |
| Serialization compatible | Does the property type work with `WriteData`? (primitives, FVector, FRotator, FString, FTransform — all supported) |
| No circular dependencies | Adding module dependencies won't create cycles? |

Flag any issues — these become questions for the human in §4.

#### §3B.2 Plan Implementation Order

Dependencies flow naturally: entities must exist before actions can reference them.

1. **GameMetadata extensions** — new metadata properties from §3A.5 (SchemaVersion, ExperienceName)
2. **Player extensions** — new state properties for the existing Player writable object
3. **New entity types** — one family at a time: Bot, then Vehicle, then Interactable, etc.
4. **Expansion layer state** — mission/quest subsystems, world-state actors, wave managers
5. **Broader actions** — new action hooks referencing any entity type

Each step is a compile-test unit. Do not batch all changes.

#### §3B.3 Check API Exports for New Classes

For every new game class the plugin will access, verify the module API export:

```
Grep("GAMENAME_API", glob: "NewEntityClass.h")
```

- Class declaration has `GAMENAME_API` macro
- Getter methods used for property reads are exported (not inline-only)
- Delegate declarations are accessible from the plugin module
- Module dependency is listed in the plugin's `.Build.cs`

#### §3B.4 New Entity Writable Object Registration

Create writable objects for new entity types using Phase 3's pattern. New entities are registered
alongside the existing Player object — extend `RegisterTrackedEntities()`, do not replace it.

**Bot entity example** (most common new entity type) — uses the SDK's `WritableObjectMapType` to
track multiple instances. `FLudeoWritableObject` has a private default constructor and **cannot** be
stored directly in `TMap<FString, FLudeoWritableObject>` (compile error). Use the SDK's map type
keyed by `const UObject*`, with a separate map for metadata:

```cpp
// In Component header
FLudeoWritableObject::WritableObjectMapType TrackedBotWritables;
TMap<const UObject*, FString> BotNameMap;

// In RegisterTrackedEntities() — Creator Flow only
void ULudeoIntegrationComponent::RegisterBotEntities(const FLudeoRoomWriter& RoomWriter)
{
    for (TActorIterator<APlayerState> It(GetWorld()); It; ++It)
    {
        APlayerState* PS = *It;
        if (!PS || !PS->IsABot()) continue;
        if (TrackedBotWritables.Contains(PS)) continue;

        FLudeoRoomWriterCreateObjectParameters Params;
        Params.Object = PS;
        Params.ObjectTypeName = TEXT("Bot");

        auto Result = RoomWriter.CreateObject(Params);
        if (Result.IsSuccessful())
        {
            TrackedBotWritables.Add(PS, Result.GetValue());
            BotNameMap.Add(PS, PS->GetPlayerName());
        }
    }
}
```

**Alternative: AIController-based bot discovery** — some games (PvE, simpler shooters) spawn AI
without `APlayerState`. Use `TActorIterator<AAIController>` instead:

```cpp
void ULudeoIntegrationComponent::RegisterBotEntities_AIController(const FLudeoRoomWriter& RoomWriter)
{
    for (TActorIterator<AAIController> It(GetWorld()); It; ++It)
    {
        AAIController* AIC = *It;
        if (!AIC || TrackedBotWritables.Contains(AIC)) continue;

        FLudeoRoomWriterCreateObjectParameters Params;
        Params.Object = AIC;
        Params.ObjectTypeName = TEXT("Bot");

        auto Result = RoomWriter.CreateObject(Params);
        if (Result.IsSuccessful())
        {
            TrackedBotWritables.Add(AIC, Result.GetValue());
            BotNameMap.Add(AIC, AIC->GetName());
        }
    }
}
```

**Note:** Bots and other non-player entities are writable objects only — they are NOT added as Ludeo
players via `AddPlayer()`. Only the human player is added via `AddPlayer()` and bound with
`BindPlayer`.

**Player Flow entity discovery:** In Player Flow, `CreateWritableObjects()` is skipped (Creator-only
guard). But action detection (`RegisterActionListeners`) needs to know about entities. Discover them
from the world independently:

```cpp
void ULudeoIntegrationComponent::DiscoverEntitiesForPlayerFlow()
{
    // Do NOT create writable objects — Player Flow only reads, never writes
    // Populate BotNameMap so action handlers can identify bots
    for (TActorIterator<APlayerState> It(GetWorld()); It; ++It)
    {
        APlayerState* PS = *It;
        if (!PS || !PS->IsABot()) continue;
        BotNameMap.Add(PS, PS->GetPlayerName());
    }
    // Then call RegisterActionListeners() — it uses BotNameMap for entity identification
    // but does NOT require writable objects
}
```

**For entities with dynamic lifetimes** (bots that respawn, vehicles that are destroyed), bind to
`OnDestroyed` to remove them from tracking maps. Note: `OnDestroyed` fires BEFORE `EndPlay`:

```cpp
PS->OnDestroyed.AddDynamic(this, &ThisClass::HandleTrackedEntityDestroyed);

void ULudeoIntegrationComponent::HandleTrackedEntityDestroyed(AActor* DestroyedActor)
{
    TrackedBotWritables.Remove(DestroyedActor);
    BotNameMap.Remove(DestroyedActor);
}
```

**Streaming-world caveat:** `EndPlay` + `OnDestroyed` fires for stream-out, not just actual
destruction. Gate the `DestroyObject` call on a real "removed from world" signal (death event,
consume delegate). See `references/game-patterns/open-world-tracking.md` §2.

#### §3B.5 Scoped Guard for Multi-Entity Writes

**CRITICAL:** Player writes and bot writes must use SEPARATE scoped guards. Bot writes happen OUTSIDE
the player guard's scope. Use explicit `{ }` braces to control guard lifetime:

```cpp
void ULudeoIntegrationComponent::WriteTrackedState()
{
    if (bIsPlayerFlow || !bGameplayActive) return;

    FLudeoRoom* Room = GetActiveRoom();
    if (!Room) return;

    // --- Player writes (inside scoped braces) ---
    {
        FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> PlayerGuard(*PlayerWritableObj);
        if (PlayerGuard.IsValid())
        {
            // BindPlayer is ONLY for the human player's writable object.
            FScopedWritableObjectBindPlayerGuard<FLudeoWritableObject> BindGuard(
                *PlayerWritableObj, TCHAR_TO_UTF8(*LocalPlayerID));

            APawn* Pawn = GetPlayerPawn();
            if (Pawn)
            {
                PlayerWritableObj->WriteData("Position", Pawn->GetActorLocation());
                PlayerWritableObj->WriteData("Rotation", Pawn->GetActorRotation());
                PlayerWritableObj->WriteData("ControlRotation",
                    Pawn->GetController()->GetControlRotation());
            }
        }
    } // PlayerGuard destroyed here — BEFORE bot writes

    // --- Bot writes (each bot gets its own scoped guard) ---
    for (auto& [BotActor, BotWritableObj] : TrackedBotWritables)
    {
        FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> BotGuard(BotWritableObj);
        if (!BotGuard.IsValid()) continue;

        const FString* BotName = BotNameMap.Find(BotActor);
        APawn* BotPawn = FindBotPawn(BotActor);
        if (!BotPawn) continue;

        BotWritableObj.WriteData("BotName", BotName ? *BotName : FString());
        BotWritableObj.WriteData("Position", BotPawn->GetActorLocation());
        BotWritableObj.WriteData("Rotation", BotPawn->GetActorRotation());

        if (AController* Controller = BotPawn->GetController())
        {
            BotWritableObj.WriteData("ControlRotation", Controller->GetControlRotation());

            if (AAIController* AIC = Cast<AAIController>(Controller))
            {
                AActor* FocusActor = AIC->GetFocusActor();
                BotWritableObj.WriteData("FocusTarget",
                    FocusActor ? FocusActor->GetName() : FString());
                BotWritableObj.WriteData("MoveStatus",
                    static_cast<int32>(AIC->GetMoveStatus()));
            }
        }
    }
}
```

#### §3B.6 Broader Action Hookup

> **Action naming convention (from §3A.6 Step 4e):** All action name strings must follow the
> convention established in §3A: player-facing PascalCase names, actions and context separated
> (`Kill` + `GameplayEffect.DamageType.Weapon.Rifle` as separate actions, not `Kill_Rifle`),
> accolades as human-readable names (`DoubleKill` not `ElimChain`).

Extend Phase 5's `ReportAction` pattern with new bindings. Add a `RegisterBroaderActionListeners()`
method called from the same BeginGameplay path as the curated-slice listeners.

**IMPORTANT:** Actions must fire in BOTH Creator and Player Flow. Do NOT guard
`RegisterActionListeners()` or `RegisterBroaderActionListeners()` with `if (bIsPlayerFlow) return`.
Only state WRITING is Creator-only — action SENDING works in both flows.

**CRITICAL — Poll-based action detection must be SEPARATE from state writing.** Structure
`TickComponent` like this:

```cpp
void ULudeoIntegrationComponent::TickComponent(float DeltaTime, ...)
{
    Super::TickComponent(DeltaTime, ...);

    if (!bGameplayActive) return;

    // 1. Poll-based action detection — runs in BOTH Creator and Player Flow
    DetectPollBasedActions();

    // 2. State writing — Creator Flow only
    if (!bIsPlayerFlow)
    {
        WriteTrackedState();
    }
}
```

```cpp
void ULudeoIntegrationComponent::RegisterBroaderActionListeners()
{
    // Example: Assist action
    if (AGameStateBase* GS = GetWorld()->GetGameState<AGameStateBase>())
    {
        // GS->OnAssist.AddDynamic(this, &ThisClass::HandleAssist);
    }

    // Example: Ability activation (for games with ability systems)
    // BindToAbilitySystem(LocalPlayer, &ThisClass::HandleAbilityActivated);

    // Example: Multi-kill / streak accolades
    // BindToAccoladeSystem(&ThisClass::HandleAccolade);
}

void ULudeoIntegrationComponent::HandleAssist(APlayerState* Assister, APlayerState* Victim)
{
    ReportAction(GetPlayerID(Assister), TEXT("Assist"));
}
```

#### §3B.6.1 GAS Ability Action Hooks

For GAS-based games, abilities fire through `AbilityActivatedCallbacks` on the player's
`UAbilitySystemComponent`:

```cpp
void ULudeoIntegrationComponent::RegisterAbilityListeners()
{
    UAbilitySystemComponent* ASC = UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(
        GetOwner());
    if (!ASC) return;

    ASC->AbilityActivatedCallbacks.AddUObject(
        this, &ThisClass::HandleAbilityActivated);
}

void ULudeoIntegrationComponent::HandleAbilityActivated(UGameplayAbility* Ability)
{
    if (!Ability) return;

    FGameplayTagContainer AbilityTags;
    Ability->GetAbilityTags(AbilityTags);

    // Map from 6A tag audit → player-facing action names
    static const TMap<FName, FString> TagToAction = {
        {FName("Ability.Type.Action.Dash"),       TEXT("Dash")},
        {FName("Ability.Type.Action.Grenade"),     TEXT("Grenade")},
        {FName("Ability.Type.Action.Melee"),       TEXT("Melee")},
        {FName("Ability.Type.Action.Reload"),      TEXT("Reload")},
        {FName("Ability.Type.Action.WeaponFire"),  TEXT("WeaponFire")},
        {FName("Ability.Type.Action.ADS"),         TEXT("ADS")},
    };

    for (const auto& [TagName, ActionName] : TagToAction)
    {
        if (AbilityTags.HasTag(FGameplayTag::RequestGameplayTag(TagName)))
        {
            ReportAction(GetLocalPlayerID(), ActionName);
            return;
        }
    }

    UE_LOG(LogLudeoIntegration, Verbose, TEXT("Unrecognized ability: %s"),
        *Ability->GetName());
}
```

The `TagToAction` map is populated from every `Ability.Type.Action.*` tag found in the §3A.3 tag
audit.

#### §3B.7 Static vs Dynamic Property Writes

Static properties are written once (at BeginGameplay or first tick). Dynamic properties are written
every tick. Separate them to avoid redundant writes:

```cpp
void ULudeoIntegrationComponent::WriteStaticProperties()
{
    if (bIsPlayerFlow) return; // Creator Flow only

    {
        FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> Guard(*GameMetadataObj);
        if (Guard.IsValid())
        {
            GameMetadataObj->WriteData("Difficulty", GetDifficulty());
            // Other one-time properties...
        }
    }

    for (auto& [BotActor, BotWritableObj] : TrackedBotWritables)
    {
        FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> Guard(BotWritableObj);
        if (Guard.IsValid())
        {
            const FString* BotName = BotNameMap.Find(BotActor);
            BotWritableObj.WriteData("BotName", BotName ? *BotName : FString());
        }
    }
}
```

Call `WriteStaticProperties()` once after `RegisterTrackedEntities()` completes.

#### §3B.8 Write Frequency Configuration

```cpp
// In Component constructor or BeginPlay
PrimaryComponentTick.TickInterval = 0.1f; // 10Hz — proven in Lyra for FPS
```

**Static/dynamic split reduces effective write volume** even at the same tick rate.

#### §3B.9 Action Pre-Implementation Verification (HARD GATE)

Before writing any action handler code, complete this verification. These rules are universal.

**Rule 1: Read the broadcaster, not just the listener.** For every event/message you plan to listen
to, open the file that BROADCASTS it. Read the 10-20 lines where the message/event is constructed.
Record which fields are actually populated. Do NOT assume a field name describes its content.

**Rule 2: Find the component's owner before accessing it.** Before calling
`FindComponentByClass<T>()` on any actor, determine which actor in the hierarchy actually owns the
component. In Lyra, the `UAbilitySystemComponent` lives on `PlayerState`, not `Pawn`.

**Rule 3: Cross-reference tag audit → action inventory.** Every `Ability.Type.Action.*` and
`Event.Movement.*` tag from §3A.3 MUST appear in the action inventory or be explicitly excluded
with a reason.

**Rule 4: Check exports before calling.** For every game class method you plan to call from the
plugin, grep for the module API export macro. If not exported, use reflection or find an alternative.

**Rule 5: Understand the consumer.** Actions and context metadata are separate dimensions in Studio
Labs — `Kill` is one action, `GameplayEffect.DamageType.Weapon.Rifle` is a separate context action.

**Rule 6: Log on bind, warn on null.** After binding any delegate or callback: add a log line
confirming the binding succeeded. Log a warning if the source object could be null.

**Action Audit Table (REQUIRED before writing handler code):**

```markdown
| Action Name | Event/Message Tag | Broadcaster File:Line | Fields Actually Populated | Fields Empty/TODO | Hook Mechanism | Source Object |
|-------------|-------------------|----------------------|--------------------------|-------------------|----------------|---------------|
| Kill        | Lyra.Elimination.Message | LyraHealthComponent.cpp:245 | InstigatorTags, Target, Instigator | ContextTags (empty) | GameplayMessageSubsystem | GameState |
| Dash        | Ability.Type.Action.Dash | (tag on ability, no broadcast) | — | — | AbilityActivatedCallbacks | PlayerState ASC |
| ...         | ... | ... | ... | ... | ... | ... |
```

If "Broadcaster File:Line" is empty for any row, you have not verified the data path and must not
write the handler.

#### §3B.10 Implementation Order and Verification

**Entity implementation order:**
1. GameMetadata extensions (validates the write pipeline)
2. Player extensions (new properties on existing writable object)
3. New entity families — one at a time, compiling between each

**For each entity:**
- Add writable object storage to Component header
- Add registration in `RegisterTrackedEntities()`
- Add static property writes in `WriteStaticProperties()`
- Add dynamic property writes in `WriteTrackedState()`
- Add cleanup in entity destroy handler and `EndGameplay`
- Compile and verify

**Action implementation order** — one category at a time with human verification between:

1. **Combat enrichment** — Assist, damage types, headshots
   → Compile → Ask human: "Do Kill, Death, Assist, and DamageType actions appear in Studio Labs?"
2. **Achievement actions** — Multi-kills, streaks, accolades
   → Compile → Ask human: "Do DoubleKill/KillStreak5 appear?"
3. **Ability/skill actions** — GAS ability activations
   → Compile → Ask human: "Do Dash, Grenade, Melee, etc. appear?"
4. **Collection actions** — Pickups, purchases, crafting
   → Compile → Verify
5. **Game-specific actions** — Unique mechanics flagged in §3A
   → Compile → Verify

If the human can't test after each category, batch at most 2 categories before verification. Never
implement all categories before any verification.

#### §3B.11 Verification Checklist

> "Phase 7 code compiles. Before we can mark this phase complete, please verify:
> 1. **Broader gameplay:** Play beyond the curated slice — test maps/modes that exercise new entities.
> 2. **F9 capture:** Capture a highlight during broader gameplay.
> 3. **Studio Labs check:** Do new entities appear with correct state? Do new actions fire?
> 4. **No duplicates:** Are any actions firing multiple times for the same event?
> 5. **Existing functionality preserved:** Do curated slice entities and Kill/Death actions still work?
> 6. Report back what worked and what didn't."

Additional automated checks:

- [ ] Grep for `bIsPlayerFlow` in the plugin source. Verify that NO action-related code is incorrectly
      guarded by it. Only state WRITING should be Creator-only.

**Schema incompatibility warning:** After adding new writable object attributes, all previously
recorded Ludeos become incompatible. The SDK will assert (crash) when trying to replay old captures
that lack the new attributes. Inform the human that all existing test captures must be re-recorded
after Phase 7 implementation.

---

## 4. Questions to Ask the Human

**Keep it lean — 3-4 questions max for §3A.** Skip questions where code analysis provides a clear
answer.

### Always Ask (§3A Gate)

1. **Game mode confirmation (from §3A.2):** "Here are the game modes/experiences I found: [table].
   Which should Ludeo support? Are there modes to exclude?" — Present BEFORE entity discovery.
2. **Entity list confirmation:** "Here are the entities I found across all supported modes: [table].
   Which are important for Ludeo highlights? Recommend tracking [list], skipping [list with
   rationale]."
3. **Action list confirmation:** "Here are the actions I discovered (including enrichments to existing
   actions): [table]. Confirm this list, and flag any game-specific actions I missed."
4. **Write frequency approval:** "Based on [N] entities with [M] dynamic properties, I estimate [X]
   KB/s at [Y]Hz. Recommended frequency: [frequency per entity type]. Does this seem reasonable?"

### Ask Only If Needed (§3B Gate)

5. **Only if API export issue found:** "The following classes/methods lack the module API export
   macro: [list]. Can you add `GAMENAME_API` to these declarations?"
6. **Only if the game is Blueprint-heavy:** "Are there important gameplay actors defined entirely in
   Blueprints that don't have C++ base classes?"
7. **If multiple different-genre modes found:** "Should the implementation use mode-conditional
   entity/action registration (different trackers per experience)?"
8. **If local multiplayer detected:** "Does this game have local multiplayer? If yes, does Ludeo need
   to track multiple local players, or just the primary player?"
9. **Only if performance concern:** "The write frequency budget estimates [X] KB/s for [N] entities.
   Should I implement delta tracking, or proceed at full frequency?"

---

## 5. Patterns to Apply

Consult these reference files for patterns applicable to the full-game scope:

- **`references/game-patterns/common.md`** — Universal capture baseline (player/avatar, camera/view,
  score/progression). Applies to every entity and mode.
- **`references/game-patterns/open-world.md`** — Session lifecycle for streaming worlds (no per-map
  levels, World Partition, continuous runs). Defines when a Gameplay Session begins and ends.
- **`references/game-patterns/open-world-tracking.md`** — What a streaming world captures: presence
  vs existence, world/cell objectTypes, persistent-world-id identity, scope-to-the-moment doctrine.
  The streaming delta on top of the baseline tracking model.
- **Genre files** in `references/game-patterns/` (e.g., `shooter.md`, `rts.md`) — Genre-specific
  action catalogs and tracking checklists for the game's genre(s).

### 5.1 Entity Inventory Table

| Entity | Class | Source File | Lifecycle | Relevance | Track? |
|--------|-------|-------------|-----------|-----------|--------|
| Player | `AMyCharacter` | `Source/Game/MyCharacter.h` | Persistent | Core | Yes (Phase 3) |
| Bot | `AMyAICharacter` | `Source/Game/AI/MyAICharacter.h` | Spawned | Core | Yes |
| Pickup | `APickupActor` | `Source/Game/Items/PickupActor.h` | Spawned | Medium | Yes |
| Projectile | `AProjectile` | `Source/Game/Weapons/Projectile.h` | Spawned | Low | No — transient |
| Door | `ADoorActor` | `Source/Game/World/DoorActor.h` | Persistent | Medium | One-time action |
| WaveManager | `AWaveManagerActor` | `Source/Game/Waves/WaveManager.h` | Persistent | High | Yes — subsystem |
| *(fill per game)* | | | | | |

**Lifecycle classification:**
- **Persistent** — exists for the entire playable unit
- **Spawned** — created and destroyed during gameplay
- **Streamed** — loaded/unloaded via level streaming (see open-world-tracking.md)

**Relevance classification:**
- **Core** — viewer would immediately notice if missing
- **High** — adds significant context
- **Medium** — enriches the scene but not critical
- **Low** — transient or cosmetic — usually skip

### 5.2 State Property Table (per entity)

One table per tracked entity. Example for a Bot entity:

| Property | Type | Static/Dynamic | Source | Reconstruction Notes |
|----------|------|----------------|--------|------------------------|
| Position | FVector | Dynamic | `GetActorLocation()` | `TeleportTo()` |
| Rotation | FRotator | Dynamic | `GetActorRotation()` | `SetActorRotation()` |
| Health | float | Dynamic | `HealthComponent->GetHealth()` | `SetHealth()` or deferred |
| BotName | FString | Static | `PlayerState->GetPlayerName()` | Set on spawn |
| TeamID | int32 | Static | `GetTeamId()` | Set on spawn |
| CurrentWeapon | FString | Dynamic | `EquipmentComponent->GetActiveSlot()` | Equip by asset path |
| *(fill per entity)* | | | | |

**Fill guidance:**
- Static properties are written once (BeginGameplay or first tick). Dynamic are written per-tick.
- Reconstruction Notes is a preview for Phase 8 — note feasibility now, implement later.
- Flag properties that require deferred application.

### 5.3 Action Inventory Table

| Action Name | Category | Trigger Event | Entity Binding | Player ID Source | Event System |
|-------------|----------|---------------|----------------|------------------|-------------|
| Kill | Combat | `OnPlayerEliminated` (Instigator) | Player | Killer PlayerState | Multicast delegate |
| Death | Combat | `OnPlayerEliminated` (Target) | Player | Victim PlayerState | Multicast delegate |
| Assist | Combat | `OnAssist` | Player | Assister PlayerState | Message subsystem |
| WeaponPickup | Collection | `OnInventoryChanged` | Player | Local PlayerState | Delegate |
| AbilityUsed | Skill | `OnAbilityActivated` | Player | Activator PlayerState | GAS callback |
| VehicleEnter | Movement | `OnVehicleEntered` | Vehicle | Driver PlayerState | Custom event |
| *(fill per game)* | | | | | |

**Fill guidance:**
- Every action needs a Player ID Source — must resolve to the same ID used in `AddPlayer`.
- Entity Binding indicates which entity the action is "about."
- Event System should match what the CODE_MAP documented in Phase 1.

### 5.4 Write Frequency Summary Table

| Entity Type | Count | Dynamic Properties | Frequency | Bytes/sec Estimate |
|-------------|-------|-------------------|-----------|-------------------|
| Player | 1 | 5 (Position, Rotation, ControlRotation, Health, Weapon) | 10Hz | ~520 B/s |
| Bot | 4 | 4 (Position, Rotation, Health, AIState) | 10Hz | ~1,280 B/s |
| GameMetadata | 1 | 2 (Score, Time) | 1Hz | ~8 B/s |
| Pickup | 8 | 1 (bAvailable) | 2Hz | ~16 B/s |
| WaveManager | 1 | 3 (WaveNumber, TimeElapsed, EnemiesRemaining) | 1Hz | ~12 B/s |
| **Total** | | | | **~1,836 B/s** |

**Fill guidance:**
- Estimate `avg_property_size` per type: FVector = 12B, FRotator = 12B, float = 4B, int32 = 4B.
- If total exceeds 50KB/s, reduce frequency for non-critical entities or add delta tracking.

### 5.5 Reconstruction Preview Table

| Entity | Approach | Complexity | Notes |
|--------|----------|-----------|-------|
| Player | Direct property set | Low | Position, rotation, health all have setters |
| Bot | Spawn + property set | Medium | Must spawn correct class, set AI state |
| Pickup | Toggle availability | Low | Set `bAvailable` flag |
| Vehicle | Spawn + occupy | High | Requires spawn, then seat player — Phase 8 concern |
| WaveManager | State set + timer delta | Medium | Apply WaveNumber, restart timer at captured delta |
| QuestState | Enum set + flag array | Medium | Set stage enum, apply completion flags without re-running init |
| *(fill per entity)* | | | |

**Complexity classification:**
- **Low** — direct setters available, no timing dependencies
- **Medium** — requires spawn or init sequencing, deferred property application
- **High** — complex dependencies, behavioral restoration, or custom reconstruction logic

---

## 6. Output Contract

After §3A analysis and human approval, append to `.ludeo/tdd/integration-tdd.md`:

```markdown
## Phase 7A: Expansion Discovery — Tracked Data Plan

### Entity Inventory

| Entity | Class | Source File | Lifecycle | Relevance | Track? |
|--------|-------|-------------|-----------|-----------|--------|
| [fill from §5.1] | | | | | |

### State Properties

#### [Entity Name 1]

| Property | Type | Static/Dynamic | Source | Reconstruction Notes |
|----------|------|----------------|--------|------------------------|
| [fill from §5.2] | | | | |

*(repeat per tracked entity)*

### Broader Actions

| Action Name | Category | Trigger Event | Entity Binding | Player ID Source | Event System |
|-------------|----------|---------------|----------------|------------------|-------------|
| [fill from §5.3] | | | | | |

### Expansion Layer Findings

#### Mission / Objective / Quest State
- [State machines found, how they're captured]

#### Environment / World State
- [Doors, cameras, destructibles, alarms, level-script counters found]

#### Stateful Subsystems
- [Wave managers, spawn pools, RNG seeds, cooldowns — absolute vs delta timestamps]

#### Cross-slice Entity Families
- [Extra AI families, vehicles, drones — typed iterators]

#### One-time / Scripted State
- [Trigger flags, scripted modifiers, granted abilities]

### Write Frequency Strategy

| Entity Type | Count | Dynamic Properties | Frequency | Bytes/sec Estimate |
|-------------|-------|-------------------|-----------|-------------------|
| [fill from §5.4] | | | | |

**Total estimated write rate:** [X] B/s
**Within budget:** [Yes / No — if No, mitigation plan]

### Reconstruction Preview

| Entity | Approach | Complexity | Notes |
|--------|----------|-----------|-------|
| [fill from §5.5] | | | |

### Key Decisions

- **Entity scope:** [Which entities to track and why. Which were excluded and why.]
- **Action scope:** [How many actions, rationale for inclusion/exclusion.]
- **Write frequency:** [Frequency per entity type, rationale, performance considerations.]
- **Serialization extension:** [How this extends Phase 3's approach — manual/SaveWorld/native.]
- **Blueprint handling:** [If applicable — how BP-only entities are handled.]
- **Expansion layer:** [Decisions on mission/world/subsystem/scripted state capture.]
```

After §3B implementation, also append:

```markdown
## Phase 7B: Expansion Implementation

### Entities Implemented
| Entity | Class | Planned | Implemented | Notes |
|--------|-------|---------|-------------|-------|
| Player (extended) | [class] | [properties from §3A] | [properties implemented] | [deviations] |
| Bot | [class] | [properties from §3A] | [properties implemented] | [deviations] |
| [Entity N] | [class] | [from §3A] | [implemented] | [notes] |

### Actions Implemented
| Action | Event Source | Planned | Implemented | Notes |
|--------|-------------|---------|-------------|-------|
| Assist | [delegate] | Yes | Yes/No | [reason if no] |
| [Action N] | [source] | Yes | Yes/No | [notes] |

### Write Frequency
| Entity | Planned | Actual | Rationale |
|--------|---------|--------|-----------|
| Player | [freq] | [freq] | [any change] |
| Bot | [freq] | [freq] | [any change] |

### Performance Observations
- Write rate: [X] KB/s observed (budget was [Y] KB/s)
- Entity count: [N] entities tracked simultaneously
- Delta tracking: [implemented / not needed]

### Key Decisions
- [Entity implementation order and rationale]
- [Any plan deviations and why]
- [Write frequency adjustments]

### Learnings Captured
- [New learnings from this phase — append to learnings/]
```

---

## 7. ✅ Success Criteria

- [ ] Phases 3–5 re-applied at full scope (all maps/modes, entity families, actions, objects)
- [ ] Mission / objective / quest state captured & restored
- [ ] Environment / world state captured (doors, cameras, destructibles, alarms, level-script counters; world/cell state for streaming worlds)
- [ ] Stateful subsystems captured (wave/assault/spawn managers — cooldowns, RNG, reservations; absolute timestamps → deltas)
- [ ] Cross-slice entity families covered (extra AI families, vehicles, drones — typed iterators)
- [ ] One-time / scripted state re-applied on restore
- [ ] Schema versioning bumped when attributes added/removed; prior Ludeos re-recorded
- [ ] Expanded coverage re-validated in cloud (re-run Phase 6) and human-verified across multiple moments

---

## 8. Common Mistakes

### From Discovery (§3A)

#### 8.1 Skipping Baseline Review
Rediscovering what Phases 3–5 already captured wastes context and may produce conflicting decisions.
Always start by cataloging the existing tracked state before searching for new entities and properties.

#### 8.2 Tracking Everything
Not every actor needs a writable object. Projectiles, particle effects, and transient objects usually
are not worth tracking. For each candidate entity, ask: "Would a viewer notice if this was missing
from the highlight?" If the answer is no, skip it.

#### 8.3 Ignoring Reconstruction Cost
Tracking state is only half the problem. If a property cannot be meaningfully restored in Player Flow
(Phase 8), it adds noise without value. Note reconstruction feasibility per property in the State
Property Table. Flag high-complexity items.

#### 8.4 Not Considering Session Length
10Hz works for 3-minute Lyra matches. A 30-minute match at 10Hz with 20 dynamic entities produces
significantly more data. Always factor session length into the write frequency strategy.

#### 8.5 Missing Game-Specific Actions
Genre patterns (Kill, Death, Assist, WeaponPickup, AbilityUsed, Accolade) are starting points, not
exhaustive lists. Every game has unique mechanics that produce memorable moments. Always ask the
human for game-specific actions that grep patterns may have missed.

#### 8.6 Assuming C++-Only Entity Architecture
Some games define core gameplay entities entirely in Blueprints. If C++ entity discovery finds few
results but the game clearly has complex gameplay, entities likely live in Blueprint assets. Always
run the Blueprint discovery pass and the gameplay tag audit.

#### 8.7 Skipping Game Mode Discovery
Jumping straight to entity discovery without mapping all game modes first means you only find
entities for modes you already know about. In Lyra, this would miss Control Points (objective
entities) and TopDownArena (bombs, destructibles, pickups) entirely.

#### 8.8 Presenting Partial Results
Showing entity tables before finishing action/scoring/ability discovery invites the human to approve
an incomplete plan. Complete ALL checklist items before presenting anything.

#### 8.9 Only Checking Pawn for State
In many UE games (especially those using GAS or modular gameplay), critical state-bearing components
like inventory, equipment, and quickbar live on the Controller, not the Pawn. Always check BOTH the
Pawn hierarchy AND the Controller hierarchy.

#### 8.10 Ignoring Action Enrichment
Discovery finds new events. Enrichment extracts richer context from events already hooked in Phase 5.
Kill already works — but examining the event payload for `DamageType` tags, weapon context, or
distance adds significant value. Don't stop at "the event fires" — ask "what data does the event
carry?"

### From Implementation (§3B)

#### 8.11 Writing Bot State Inside Player Scoped Guard
Bot writable objects must be written OUTSIDE the player's `FScopedLudeoDataReadWriteEnterObjectGuard`
scope. If bot writes happen inside the player guard, the SDK associates bot data with the player
object — corrupting both. Use explicit `{ }` braces so the player guard destructs before bot writes
begin (see §3B.5).

#### 8.12 Guarding Actions with bIsPlayerFlow
Actions must fire in BOTH Creator and Player Flow. Only state WRITING is Creator-only. Do NOT add
`if (bIsPlayerFlow) return` to `RegisterActionListeners()` or `RegisterBroaderActionListeners()`.
This is the most common mistake in expansion — agents apply the Creator-only guard broadly instead
of to writes only.

#### 8.13 Not Registering Writable Objects Before Use
The SDK asserts (crashes) when `WriteData` is called on an unregistered object. All writable objects
must be created via `RoomWriter.CreateObject()` before any `WriteData` calls. Check
`Result.IsSuccessful()` after `CreateObject`.

#### 8.14 Missing GameMetadata After Extension (SILENT failure)
If Phase 7 adds new metadata properties, the GameMetadata writable object must still be written FIRST.
If GameMetadata creation is moved or accidentally removed during refactoring, Ludeo creation fails
silently — no error, just no Ludeo produced.

#### 8.15 Forgetting to Unbind New Event Listeners
Every new delegate binding in `RegisterBroaderActionListeners()` needs a matching unbind in the
teardown path. If delegates fire after room close, the `ReportAction` call hits an invalid room.

#### 8.16 Delta Tracking with Stale Initial Values
If implementing dirty-flag delta tracking, ensure the first write sends ALL properties — not just
changed ones. Player Flow reconstruction needs a complete initial state. Use a `bFirstWrite` flag to
force a full write, or initialize "previous value" trackers to sentinel values.

#### 8.17 Player Flow Entity Discovery Gap
During Creator Flow, `RegisterTrackedEntities()` creates writable objects. During Player Flow, that
path is skipped (Creator-only guard). Player Flow reconstruction still needs to know which entities
exist — use `TActorIterator` during Player Flow to discover entities independently (see §3B.4
"Player Flow Entity Discovery").

### Expansion-Specific

#### 8.18 Capturing Absolute Timestamps
Wave-start times, spawn timers, and cooldown expirations stored as absolute world-time values go stale
the moment the Ludeo is replayed. Capture all timing state as **deltas** (time elapsed since an event,
or time remaining). Never capture `GetGameTimeSinceCreation()` directly as a restore target.

#### 8.19 Missing a Separate AI Class Hierarchy
Games often have multiple AI entity types (standard bots, heavy bots, bosses, drone swarms, turrets)
that share a common base class. Using a single `TActorIterator<ABaseEnemy>` will catch them all, but
the writable object maps must remain typed per family — mixing families into one map loses type
identity and breaks the restore pass. Use `Cast<>` at registration to separate into typed maps.

#### 8.20 Re-Running Init Sequences for One-Time/Scripted State
On restore, the instinct is to replay the scripted event or run `InitStats()` again. This double-
applies: the player already has the stats from `BeginPlay`; running `InitStats()` again adds a second
layer. Instead, capture the final-state values of the modifiers and apply them as absolute overwrites
on restore. Only the delta between "freshly spawned" and "captured state" should be applied.

#### 8.21 Treating Stream-Out as Destruction (streaming worlds)
In streaming-world games, `EndPlay` + `OnDestroyed` fires for both actor destruction and World
Partition cell unload. Gating `DestroyObject` on `OnDestroyed` alone will remove NPC tracking when
the player moves away, causing the replay to drop objects that should still exist. Gate the
`DestroyObject` call on a real "removed from world" signal from the game's persistence layer. See
`references/game-patterns/open-world-tracking.md` §2.
