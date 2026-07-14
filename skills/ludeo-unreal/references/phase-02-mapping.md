# Phase 02 — Mapping

## 1. Goal / Purpose

Produce a **focused CODE_MAP** (integration surface only) and select the **curated gameplay slice** that Phases 4-6 are scoped to. Quick human approval, then proceed to implementation.

**Deliverables:**
- Curated slice selection (map + game mode + entities + actions)
- Focused CODE_MAP covering the integration surface (lifecycle hooks, event systems, entity classes, save system, Player Flow restoration paths)
- Save system classification (Group 1/2/3)
- Integration architecture plan (Subsystem + Component, plugin structure)
- Player Flow restoration approach (reconciliation vs manual)

---

## 2. Inputs (Input Contract)

```
Required:
  gamePath: string          — Root path of the game project
  engineVersion: string     — "UE 4.x" or "UE 5.x" (from Phase 1)
  gameType: string          — "FPS", "TPS", "Action", etc. (from Phase 1)
  demoMapHint: string|null  — Human's initial suggestion for curated slice map (from Phase 1)

Optional:
  gameDescription: string   — GDD, wiki page, or informal description
  ludeoContext: MCP          — ludeo-context MCP server (if available)
```

**Before starting this phase, verify:**

- [ ] Phase 1 completed — `.ludeo/integration.json` exists with `gameTitle`, `engineVersion`, `gameType`
- [ ] Game codebase is accessible and compiles (or at least browseable)
- [ ] Human is available for questions (this phase requires the most human input)

**Optional enrichment:**
- Game design document or wiki — helps identify game modes, phases, entity types
- `ludeo-context` MCP — call `get_repos_context` for any prior integration notes on this game
- `sdk-docs` MCP — call `get_documentation_index` to verify SDK version compatibility

---

## 3. Steps

### Key Concepts (read before starting)

**Room ≠ Highlight.** Before running the analysis, internalize this:

- A **room** is a long-running **recording session** that stays open for the entire gameplay session (map load → map exit). One room per session.
- **Highlights** are moments extracted from the room's recorded data while it is open. The player presses F9 to capture; you do NOT close the room to produce a highlight.
- Room lifecycle corresponds to "when does the player start / stop recording gameplay," NOT "what counts as one highlight."
- Typical mapping: `OnMatchStarted` → open room, `OnMatchEnded` / menu return → close room.

This is a common early mistake (see `learnings/common-mistakes/room-is-not-highlight.md` — captured from FPSGameStarterKit). Treat `sessionUnit` in the CODE_MAP as "one recording session," not "one highlight unit." When you see examples like "match, level, wave, mission, round" in this document, read them as *recording session boundaries*, not as highlight boundaries.

---

### Analysis Checklist

Each item describes **what to find** and **how to find it**. Run these in order — later items build on earlier findings.

**Scope:** This analysis targets the **integration surface** — where Ludeo code will hook into the game. It is NOT an exhaustive catalog of every class. Focus on: lifecycle hooks, event systems, entity classes relevant to the curated slice, save system, and Player Flow restoration paths.

**Classify genre → load the matching playbook.** From the game type (Phase 1 intake) plus a quick web/code check, classify the genre and load the matching `references/game-patterns/<genre>.md` (catalog of actions + tracking + Unreal grep idioms). See `references/game-patterns/INDEX.md` to classify. For a **streaming / no-per-map-level** game (session boundaries are state-machine/event-driven, not `OpenLevel`/`ServerTravel` per map), also load `references/game-patterns/open-world.md` — it decides where a Gameplay Session begins/ends. For a **turn-based** game (initiative / action points / grid), load `references/game-patterns/turn-based.md` (it also covers the turn-boundary capture-cadence decision).

#### 3.1 Project Structure

| What | How | Record In |
|------|-----|-----------|
| Source directories | `ls Source/`, `ls Plugins/` | codeMap.codebase_summary |
| `.uproject` file | Read `*.uproject` — lists plugins, engine version, modules | codeMap.codebase_summary |
| Build files | `Glob("**/*.Build.cs")` — module dependencies, public/private includes | codeMap.build_system |
| Existing plugins | `ls Plugins/`, `ls Plugins/GameFeatures/` — identify plugin architecture style | codeMap.plugins |
| Config files | `ls Config/` — DefaultGame.ini, DefaultEngine.ini | findings |

#### 3.2 Core Game Classes

| What | How | Record In |
|------|-----|-----------|
| Game Instance | `Grep("(UGameInstance\|AGameInstance)", type: "cpp")` — app-lifetime owner | codeMap.core_classes |
| Game Mode | `Grep("UCLASS.*GameMode", glob: "*.h")` + check `DefaultEngine.ini` for `/Script/Engine.WorldSettings.GlobalDefaultGameMode` | codeMap.core_classes |
| Game State | `Grep("UCLASS.*GameState", glob: "*.h")` + check GameMode's `GameStateClass` | codeMap.core_classes |
| Player Controller | `Grep("UCLASS.*PlayerController", glob: "*.h")` | codeMap.core_classes |
| Player State | `Grep("UCLASS.*PlayerState", glob: "*.h")` | codeMap.core_classes |
| Character / Pawn | `Grep("UCLASS.*(Character\|Pawn)", glob: "*.h")` — identify hierarchy depth | codeMap.core_classes |
| HUD / UI framework | `Grep("(CommonUI\|UMG\|UUserWidget)", glob: "*.h")` — determines non-ludeoable areas | codeMap.core_classes |

#### 3.3 Lifecycle Hooks

Not all games use matches. Games may be level-based, wave-based, mission-based, or open-world. The goal is to discover what constitutes one **playable unit** (the thing a Ludeo room wraps) and where its boundaries are.

**IMPORTANT: Room ≠ Highlight.** A room is a **recording session** that stays open for the duration of gameplay (e.g., an entire map session). Multiple highlights can be captured from a single open room (the player presses F9 whenever they want). You do NOT close a room to produce a highlight — highlights are extracted from the room's recorded data while it's open. Open a room when gameplay begins (map load, match start), close it when the gameplay session ends (return to menu, map transition). One room per map session, many highlights per room.

| What | How | Record In |
|------|-----|-----------|
| Progression structure | Determine what defines one playable unit — match, level, wave, mission, round, session. Check GameMode logic, level design, and game flow | codeMap.lifecycle_hooks.sessionUnit |
| Game phases / states | `Grep("(GamePhase\|MatchState\|EGameState\|EMatch\|ELevel\|EMission\|EWave\|ERound)", glob: "*.h")` — state enums, phase managers | codeMap.lifecycle_hooks |
| Session boundaries | `Grep("(HandleMatch\|OnMatchStart\|OnMatchEnd\|StartMatch\|EndMatch\|LevelStart\|LevelEnd\|LevelComplete\|WaveStart\|WaveEnd\|MissionStart\|MissionComplete\|RoundStart\|RoundEnd\|SessionStart\|SessionEnd)", glob: "*.cpp")` | codeMap.lifecycle_hooks |
| Map / level transitions | `Grep("(ServerTravel\|OpenLevel\|LoadStreamLevel\|SeamlessTravel)", glob: "*.cpp")` | codeMap.lifecycle_hooks |
| BeginPlay / EndPlay overrides | `Grep("(::BeginPlay\|::EndPlay)", glob: "*.cpp")` on core classes found in 3.2 | codeMap.lifecycle_hooks |
| Experience / game feature loading | `Grep("(UGameFeatureAction\|ExperienceManager\|ExperienceDefinition)", glob: "*.h")` (UE 5.x with GameFeatures) | codeMap.lifecycle_hooks |

#### 3.4 Event Systems

| What | How | Record In |
|------|-----|-----------|
| Multicast delegates | `Grep("DECLARE_DYNAMIC_MULTICAST_DELEGATE", glob: "*.h")` | codeMap.event_systems |
| Gameplay message subsystem | `Grep("UGameplayMessageSubsystem", glob: "*.h")` (Lyra-style games) | codeMap.event_systems |
| Custom event buses | `Grep("(EventBus\|EventDispatcher\|MessageBus\|BroadcastEvent)", glob: "*.h")` | codeMap.event_systems |
| Gameplay tags | `Grep("FGameplayTag", glob: "*.h")` — if GAS or tag-based events are used | codeMap.event_systems |

#### 3.4.5 "What Breaks on Restore?" Diagnostic (Snapshot vs Trail)

For every subsystem discovered above (event systems, phase enums, objective classes, mission managers, level blueprint scripted logic), ask this question:

> *If I capture this subsystem's current values at time T and restore them at time 0 (ignoring everything that happened between), what breaks?*

The answer classifies the subsystem into one of two categories:

| Category | Behavior on restore-from-snapshot | Examples | Restoration strategy |
|----------|-----------------------------------|----------|--------------------|
| **Snapshot** | Nothing breaks — current values are sufficient | Player position, entity health, current phase enum, inventory, ability on/off | Capture current values per-tick, apply on restore (standard Phase 5 pattern) |
| **Trail** | Everything breaks — scripted logic re-executes from start, stale VO, early-phase NPC spawns, tutorial prompts fire at mid-mission | Milestones passed, objectives completed, mission props used (deployables placed, cameras disabled, extraction zone activated), level BP scripted state, tutorial flags | Capture the **sequence of events** as a time-ordered trail; replay via the game's own notifier functions (e.g., `NotifyClientPassedMilestone`) before applying snapshot state |

**How to spot trail subsystems during grep:**

| Signal | Grep |
|--------|------|
| Milestone / objective delegates | `Grep("(OnMilestonePassed\|ObjectiveComplete\|Milestone\|FlagPassed\|OnObjective)", glob: "*.h")` |
| Mission director / flow controllers | `Grep("(MissionDirector\|MissionFlow\|MissionState\|ObjectiveManager\|QuestSystem)", glob: "*.h")` |
| Level blueprint scripted actors | `Grep("ALevelScriptActor", glob: "*.cpp")` — inspect for `HandleActionPhaseStarted`-style event handlers that queue VO or spawn NPCs |
| Mission prop state | `Grep("(DeviceState\|DeviceState\|bIsActivated\|bIsDeployed\|ExtractionActivated)", glob: "*.h")` |

**Rule — this drives Phase 5 scoping:**

**Any subsystem classified as `trail` that is needed for the curated slice's demo is Phase 5 work. Full stop. Do NOT defer it to Phase 8 as "enrichment."**

If your curated slice demo requires the level BP to look sane (no stale VO, no early-phase NPCs, no tutorial prompts), then the level BP's dependencies — mission progression, milestone trail, objective state — are part of Phase 5. Missing them means Phase 5 isn't actually done; the demo just hasn't revealed it yet.

**Record classification** in `integration.json → stateClassification`:

```json
"stateClassification": {
  "snapshot": [
    {"subsystem": "PlayerPawn.Transform"},
    {"subsystem": "MissionState", "note": "per-tick write required"}
  ],
  "trail": [
    {"subsystem": "OnMilestonePassed", "loadBearing": true, "captureHook": "...", "replayHook": "..."},
    {"subsystem": "ObjectiveManager.State", "loadBearing": true}
  ]
}
```

If the intake questionnaire Group 5 (Event-Driven Scripted Systems) was run at Phase 1, cross-check findings here with the team's stated answers. Discrepancies are risks — surface them to the human.

#### 3.5 Save System

**Step 1: Check reference sample catalog.** Before running any analysis, read `references/reference-sample-catalog.md` and check whether the current game matches a known sample (by name, engine version, or architecture). If it matches, START from the sample's classification and verify each precondition against the current project — do not re-derive from scratch. A matching sample is the strongest signal and overrides grep-based inference.

**Step 2: C++ grep sweep (first-pass evidence).**

| What | How | Record In |
|------|-----|-----------|
| SaveGame classes | `Grep("USaveGame", glob: "*.h")` | codeMap.save_system |
| `UPROPERTY(SaveGame)` on gameplay classes | `Grep("UPROPERTY\\([^)]*SaveGame", glob: "*.h")` | codeMap.save_system |
| Save/load calls | `Grep("(SaveGameToSlot\|LoadGameFromSlot\|AsyncSaveGameToSlot)", glob: "*.cpp")` | codeMap.save_system |
| Checkpoint system | `Grep("(Checkpoint\|SavePoint\|AutoSave)", glob: "*.h")` | codeMap.save_system |
| Serialization | `Grep("(Serialize\|FArchive\|FMemoryWriter\|FMemoryReader)", glob: "*.cpp")` on game classes | codeMap.save_system |
| Custom serializers | `Grep("(FFastArraySerializer\|NetDeltaSerialize\|FRepMovement)", glob: "*.h")` — **blockers for SaveWorld** | codeMap.save_system |
| BP-only detection | Check if `Source/` directory exists and contains game code. If absent or empty → BP-only. | codeMap.codebase_summary.isBlueprintOnly |

**Step 3: BP-only save system classification (REQUIRED for BP-only projects).**

If the C++ grep sweep in Step 2 returns **no results for `UPROPERTY(SaveGame)` or USaveGame subclasses**, AND the project is BP-only (no `Source/` directory owning gameplay state), **grep evidence is insufficient to classify the save system**. Use the BP Inspector tool, falling back to a human question if the tool is unavailable.

**Option A — Automated (recommended):** Use the **BP Inspector tool** (see SKILL.md → Available Tools). Run `inspect`, read the report, and classify:

- **SaveGame flags found** (`saveGame: true` on gameplay variables) → Group 1 (SaveWorld-compatible). Record `method: "bp-inspection"`.
- **No SaveGame flags** → Still classify as Group 1 (SaveWorld-compatible, pending flag setup). Record `flagsSet: false`. SaveGame flags will be set in Phase 4 when the curated variable list is finalized.
- The report also answers structural questions (parent class, components, movement type) — use these throughout Phase 2 analysis.

Populate `saveSystemEvidence.bpVariablesInspected` from the JSON report.

**Option B — Fallback (if BP Inspector unavailable):** Ask the human to open a representative gameplay BP and check if the SaveGame checkbox is set on gameplay variables (Health, Energy, Score). Yes → Group 1. No → Group 1 pending flag setup (Phase 4 will handle). Only classify as Group 3 (WritableObject) if the human explicitly prefers it.

**Do NOT infer save system capability from grep results alone in a BP-only project.** Grep cannot see BP variables — they live in `.uasset` files, not headers. An empty grep result is *inconclusive*, not negative (see `learnings/common-mistakes/do-not-trust-learning-without-verifying-precondition.md`).

**Step 4: Record structured evidence (REQUIRED).**

Before writing `saveSystemGroup` to `integration.json`, populate `saveSystemEvidence` with what you actually checked:

```json
"saveSystemEvidence": {
  "referenceSampleMatch": "FPSGameStarterKit" | null,
  "cppUPropertySaveGameFound": true | false,
  "isBlueprintOnly": true | false,
  "bpVariablesInspected": [
    {"bp": "BP_CharacterBase", "variable": "Health", "saveGameFlag": true | false | "not-verified"}
  ],
  "humanConfirmedClassification": true | false,
  "method": "grep-positive" | "bp-inspection" | "reference-sample" | "smoke-test"
}
```

**Rule:** If `isBlueprintOnly == true` AND `method == "grep-positive"` is the only signal, that is NOT sufficient evidence — reject the classification and go back to Step 3. The skill enforces that grep alone cannot classify a BP-only project's save system.

#### 3.6 AI / Bots

| What | How | Record In |
|------|-----|-----------|
| AI controllers | `Grep("AAIController", glob: "*.h")` | codeMap.ai |
| Behavior trees | `Grep("(UBehaviorTree\|UBTTask\|UBTDecorator)", glob: "*.h")` | codeMap.ai |
| Bot spawning | `Grep("(SpawnBot\|BotCount\|NumBots\|AddBot)", glob: "*.cpp")` | codeMap.ai |
| Bot names / identity | `Grep("(BotName\|RandomBotName\|AIPlayerName)", glob: "*.cpp")` — affects Player Flow matching | codeMap.ai |

#### 3.7 Ability System (if present)

| What | How | Record In |
|------|-----|-----------|
| GAS components | `Grep("UAbilitySystemComponent", glob: "*.h")` | codeMap.ability_system |
| Gameplay abilities | `Grep("UGameplayAbility", glob: "*.h")` | codeMap.ability_system |
| Attribute sets | `Grep("UAttributeSet", glob: "*.h")` — health, damage, etc. | codeMap.ability_system |
| Health component | `Grep("(HealthComponent\|Health.*Component)", glob: "*.h")` — check for init timing issues | codeMap.ability_system |

#### 3.8 Inventory / Loadout

| What | How | Record In |
|------|-----|-----------|
| Inventory system | `Grep("(Inventory\|InventoryManager\|InventoryComponent)", glob: "*.h")` | codeMap.inventory |
| Weapon / equipment slots | `Grep("(QuickBar\|EquipmentSlot\|WeaponSlot\|Loadout)", glob: "*.h")` | codeMap.inventory |
| Item definitions | `Grep("(ItemDefinition\|ItemInstance\|EquipmentDefinition)", glob: "*.h")` | codeMap.inventory |

#### 3.9 Curated Slice Selection

After running the analysis checklist, suggest 2-3 candidate gameplay slices for the MVP integration.

**How to identify candidates:**

| Step | How |
|------|-----|
| Find maps | Glob for `.umap` files in `Content/`. Read level references in config. |
| Find game modes per map | Grep for `GameModeOverride`, `DefaultGameMode` in world settings. Check `DefaultEngine.ini`. |
| Classify maps | Arena/wave (best first slice) > Story/mission (good second) > Menu/lobby/transition (skip) |
| Estimate action density | Count ability classes, delegate declarations, event enums near each map's code |
| Check dependencies | Does the slice need persistent state from outside (loadout, progression, unlocks)? |
| Use human hint | If the human suggested a demo map in Phase 1, start with that |

**Present to human:**
```
Curated Slice Candidates:
1. [MapName] + [GameMode] — [1-line description]. Entities: [list]. Actions: [list]. Dependencies: [none|list].
   → RECOMMENDED: [why]
2. [MapName] + [GameMode] — [1-line description]. ...
3. (optional third candidate)

Which slice should we target for the 48h MVP?
```

**Record the chosen slice** in `integration.json → curatedSlice` with: mapName, gameMode, description, entities (from analysis), actions (from analysis), restorationApproach.

##### Discover what is actually placed/spawned in the curated slice

`inspect` only reports gameplay-class BPs by asset; it cannot tell you what is actually placed or spawned in the curated map, and it deliberately filters out plain-`Actor` BPs (spawners, weapon actors, AI managers, pickups). For a marketplace-kitbash project (often hundreds of BPs from many asset packs), this is the difference between drowning in irrelevant demo content and seeing the ~handful of classes the slice actually uses. Two steps:

1. **Enumerate the curated map.** Run `inspect-level <curated_map_path>`. The class histogram shows what is placed; `focusActors` dumps the BP properties of spawn/AI actors (spawn counts, spawn-class arrays, wave flags) under their real variable names — read these to answer "is the spawner snapshot or trail?" and "what does it spawn?".
2. **Deep-dive the classes it surfaced.** Run `inspect-path` on the specific spawner / weapon / manager classes from step 1 to get their full variable, component, function, and event dump. These are exactly the plain-`Actor` BPs `inspect` skipped.

Scope analysis to the classes the curated map actually uses — not every BP in the project.

##### 3.9.1 Entity Priority Tiering (mandatory)

"Track everything" is not a plan. "Track only the player" is also not a plan. After identifying the entity categories in the curated slice, **force the human to tier each one** — no category left unranked. This surfaces wrong assumptions up front (the canonical ActionGame example: the agent assumed vehicles could be deferred as transient; the human corrected with "WE cannot defer cars!!!" mid-Phase 5).

Enumerate every entity category visible in the slice. Typical buckets: player, teammates/crew, hostile AI, neutral AI (civilians), vehicles, physics props, objective item/collectibles, placeables, deployables, environmental interactables (doors, cameras, terminals), objective markers.

Ask the human to tier each:

| Tier | Meaning |
|------|---------|
| **P0 (must track)** | Absence breaks the demo — capture is incomplete or Player Flow feels broken. |
| **P1 (should track)** | Adds fidelity; defer only if it blocks MVP. Revisit in Phase 8 enrichment. |
| **P2 (can defer for MVP)** | Genuinely skippable for 48h MVP. |

**Present to human:**
```
Entity categories in [slice]:
- [Category 1]: P0 / P1 / P2?
- [Category 2]: P0 / P1 / P2?
...

No category can remain unranked — every item gets a tier.
```

For each **P0** and **P1** entity: does each subtype need its own `ObjectType`, or can they share? (ActionGame: HeavyEnemy/Trooper/Officer/Bystander each warrant their own for differentiated kill actions. Generic `EnemyKill` produces boring highlight reels.)

For each P0/P1: does it persist across phases, wave-spawn, or player-place? Drives restoration strategy (restore-in-place vs. re-spawn-from-ClassPath).

**Record in `integration.json → curatedSlice.entityTiers`:**
```json
"entityTiers": {
  "P0": [
    {"category": "player", "objectType": "Player"},
    {"category": "vehicles", "objectType": "Vehicle"},
    {"category": "hostileAI", "objectType": ["Kill_HeavyEnemy", "Kill_Trooper", "Kill_Officer"]}
  ],
  "P1": [{"category": "lootBags", "objectType": "LootBag"}],
  "P2": [{"category": "physicsProps", "reason": "decorative, no gameplay impact"}]
}
```

**→ Wired to:** Phase 5 pre-flight (every P0 entity must have a WritableObject registration path). Phase 5 cannot complete without all P0 entities tracked. P1 entities default to not-implemented-in-MVP unless the human later promotes them.

#### 3.10 Player Flow Restoration Approach

Determine how state will be restored during Player Flow:

| Approach | When to use | How to detect |
|----------|------------|---------------|
| **Reconciliation** (SaveWorld + property filters) | Game has compatible save system (Group 1), no serialization blockers | `USaveGame` classes exist, no `FFastArraySerializer` on gameplay state |
| **Manual** (DataReader per property) | No save system, or serialization blockers present | Group 2-3, or `FFastArraySerializer`/`NetDeltaSerialize` found on gameplay state |

Record the approach in `integration.json → curatedSlice.restorationApproach`.

---

### CODE_MAP Generation

After running the analysis checklist and selecting the curated slice, produce `.ludeo/code-map.json`. This map covers the **integration surface** — where Ludeo code hooks into the game — scoped to the curated slice. It is NOT an exhaustive catalog of every class. Subsequent phases use it for fast code lookups.

#### CODE_MAP Schema

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-03-22",
  "codebase_summary": {
    "engine": "UE 5.x",
    "sourceModules": ["GameName", "GameNameEditor"],
    "pluginCount": 0,
    "usesGameFeatures": false,
    "keyDirectories": {
      "source": "Source/GameName/",
      "plugins": "Plugins/",
      "config": "Config/"
    }
  },
  "core_classes": [
    {
      "role": "GameMode",
      "className": "AMyGameMode",
      "file": "Source/Game/MyGameMode.h",
      "baseClass": "AGameModeBase",
      "keyMethods": ["InitGame", "HandleMatchHasStarted"],
      "notes": ""
    }
  ],
  "lifecycle_hooks": {
    "appStart": {
      "description": "Game instance initialization — SDK init happens here",
      "location": "Source/Game/MyGameInstance.cpp:Init()",
      "notes": ""
    },
    "sessionUnit": {
      "description": "One recording session (Room lifecycle). See 'Key Concepts' at the top of this file — this is NOT a highlight unit. Typically: entire match, level, or mission. Room stays open for the full session; many highlights are captured within one room.",
      "type": "",
      "notes": "Determines what a Ludeo room wraps. NOT what constitutes a highlight."
    },
    "roomOpen": {
      "description": "When the Ludeo room should open — start of the playable unit (e.g., level load, match start, wave begin)",
      "location": "",
      "notes": ""
    },
    "gameplayStart": {
      "description": "When actual interactive gameplay begins (after loading, warmup, countdowns)",
      "location": "",
      "notes": "This is the BeginGameplay trigger point"
    },
    "gameplayEnd": {
      "description": "When interactive gameplay ends (death, scoreboard, victory, level complete)",
      "location": "",
      "notes": "This is the EndGameplay trigger point"
    },
    "roomClose": {
      "description": "When the Ludeo room should close — end of the playable unit",
      "location": "",
      "notes": ""
    },
    "mapTransition": {
      "description": "How the game transitions between maps/levels",
      "location": "",
      "notes": ""
    }
  },
  "event_systems": [
    {
      "type": "delegate|message_subsystem|event_bus|gameplay_tags",
      "className": "",
      "file": "",
      "usage": "How events are dispatched/subscribed",
      "notes": ""
    }
  ],
  "save_system": {
    "group": 0,
    "description": "",
    "classes": [],
    "serializationBlockers": [],
    "notes": ""
  },
  "ai": {
    "hasAI": false,
    "controllerClass": "",
    "spawnMechanism": "",
    "identityStable": null,
    "notes": ""
  },
  "ability_system": {
    "hasGAS": false,
    "healthComponent": "",
    "initTimingNotes": "",
    "notes": ""
  },
  "inventory": {
    "hasInventory": false,
    "systemType": "",
    "itemIdentifier": "",
    "notes": ""
  },
  "build_system": {
    "modules": [],
    "pluginDependencies": [],
    "notes": ""
  },
  "plugins": [
    {
      "name": "",
      "path": "",
      "type": "GameFeature|regular|engine",
      "relevance": "Where Ludeo plugin should live or what it interacts with"
    }
  ]
}
```

#### CODE_MAP Generation Steps

1. Run analysis checklist sections 3.1–3.8
2. For each finding, populate the corresponding CODE_MAP section
3. For `lifecycle_hooks`, trace the call chain from each hook to understand ordering:
   - Which fires first — GameMode::InitGame or GameState::BeginPlay?
   - Is there an experience/asset loading step between map load and gameplay?
   - What triggers match end — a timer, score threshold, or explicit call?
4. Write `.ludeo/code-map.json`
5. Present a summary to the human for verification before proceeding

---

## 4. Questions to Ask the Human

Ask these after completing the analysis checklist and curated slice selection. Skip questions where code analysis already provides a clear answer. **Keep it lean — 2-4 questions max.**

### Always Ask

1. **Curated slice confirmation:** Present the 2-3 candidates from section 3.9 and ask which to target. If the human already named a map in Phase 1, lead with that as the recommendation.
2. **Save system classification:** Present findings and recommend a group:
   - "Based on code analysis, this game appears to be **Group N**. [rationale]. Does this match your understanding?"
3. **State tracking approach:** Present the recommended approach from section 3.10 and ask the developer to validate:
   - "Based on the save system analysis, I recommend **[reconciliation / manual]** for state tracking and Player Flow restoration. Here's why: [rationale — e.g., compatible SaveGame classes exist / no save system found / serialization blockers detected]. This affects how all state tracking and restoration works from Phase 5 onward. Does this approach work for your team?"
   - If the developer has a preference or constraints (team expertise, performance concerns, existing save infrastructure), adjust the recommendation.

### Ask Only If Needed

4. **If no clear gameplay start hook:** "I couldn't find a clear 'gameplay started' signal for [chosen slice]. What indicates that the player can start playing?"
5. **If multiple event systems found:** "I found multiple event systems: [list]. Which is the primary one for gameplay events in the curated slice?"

---

## 5. Patterns to Apply

These are **universal patterns** from prior integrations. Apply them directly — do not ask the human whether to use them.

### Architecture Pattern: Subsystem + Component

All Ludeo integrations use this split:

| Class | Base Class | Lifetime | Responsibilities |
|-------|-----------|----------|-----------------|
| `ULudeoSessionSubsystem` | `UGameInstanceSubsystem` | App lifetime (survives map loads) | SDK init/tick/shutdown, session create/activate/destroy, Player Flow entry (GetLudeo, ServerTravel), teardown coordination, SDK notification handlers |
| `ULudeoGameStateComponent` | `UGameStateComponent` | Session lifetime (per playable unit — match, level, wave) | Room open/close, AddPlayer/RemovePlayer, N-way gate → BeginGameplay, state tracking, action reporting, Player Flow state application, teardown chain |

**Why GameStateComponent, not WorldSubsystem:**

| Factor | WorldSubsystem | GameStateComponent |
|--------|---------------|-------------------|
| Ticking | Requires `UTickableWorldSubsystem` | Built-in `TickComponent` |
| GameState access | Indirect: `GetWorld()->GetGameState()` | Direct: `GetGameState()` |
| Lifecycle timing | `Initialize` fires before GameState exists | `BeginPlay` fires when GameState is ready |
| Replication (multiplayer) | Cannot replicate (UObject) | Built-in replication (Actor component) |

### Plugin Isolation

- All Ludeo code in a **GameFeature plugin** (e.g., `Plugins/GameFeatures/LudeoIntegration/`)
- Core game loads the component via `StaticLoadClass` — **zero compile-time dependency**
- If the plugin is not enabled, `StaticLoadClass` returns `nullptr` and no Ludeo code runs
- Core game changes are minimal and generic (delegates, exports — no Ludeo-specific logic)

### Deferred Session Activation

SDK overlay requires a window handle. The window may not exist on the first frame.

```
Initialize():
  CreateSession()
  RegisterNotifications()  // MUST be before Activate
  ActivateSession()
    → if window exists → activate immediately
    → if no window → start FTSTicker, retry each frame until window ready
```

### API Key Resolution

Check sources in order: command-line arg (`-LudeoAPIKey=`) → environment variable (`LUDEO_API_KEY`) → config file (`DefaultGame.ini`).

### N-Way Gate for BeginGameplay

Multiple async conditions must ALL be true. The exact conditions vary per game, but the pattern is:

```cpp
void TryBeginGameplay()
{
    if (bGameplayStarted) return;          // already started
    if (!bRoomReady) return;               // SDK: OnRoomReady
    if (!PlayerHandle.IsSet()) return;     // SDK: OnPlayerAdded
    if (!bGamePhaseActive) return;         // Game: phase/state system
    // ... add more conditions as needed

    bGameplayStarted = true;
    // → CreateWritableObjects, RegisterListeners, BeginGameplay()
}
```

Each condition setter calls `TryBeginGameplay()`. Whichever fires last triggers it.

### Teardown Chain

Always in this order: `EndGameplay → RemovePlayer → CloseRoom`. The subsystem coordinates teardown when switching Ludeos or returning to menu via a callback pattern.

### Player Flow Pending State

Subsystem fetches Ludeo data and stores in `Pending*` fields before `ServerTravel`. After map load, the component checks for pending state to determine if this is Player Flow or Creator Flow.

---

## 6. Output Contract

```
Produces:
  tddSection1: markdown         — Architecture TDD section written to .ludeo/tdd/integration-tdd.md
  saveSystemGroup: 1|2|3        — Written to integration.json → saveSystemGroup
  saveSystemEvidence: object    — Structured evidence for the classification (see §3.5 Step 4) — REQUIRED, not optional
  curatedSlice: object          — Written to integration.json → curatedSlice
  codeMap: json                  — Written to .ludeo/code-map.json (focused on integration surface)
  decisions[]: Decision[]        — Appended to integration.json → decisions[]
  findings[]: Finding[]          — Appended to integration.json → findings[]
```

**Hard rule:** `saveSystemGroup` cannot be recorded without a populated `saveSystemEvidence` object. If `isBlueprintOnly == true` AND the only signal is a grep-based inference, the evidence is insufficient — go back to §3.5 Step 3 (human verification or smoke test) before recording the classification.

The TDD section produced by this phase should follow this structure. Adapt headings as needed for the specific game.

```markdown
# Section 1 — Architecture

## Abstract

[2-3 sentences: what game, what architecture approach, what curated slice,
what restoration approach (reconciliation vs manual)]

## Curated Slice

**Map:** [chosen map]
**Game Mode:** [game mode for this map]
**Description:** [1-2 sentences describing the gameplay moment]
**Entities to Track:** [list — e.g., Player, EnemyAI, Pickups]
**Actions to Track:** [list — e.g., Kill, Death, AbilityUsed]
**Restoration Approach:** [reconciliation | manual]
**Why This Slice:** [2-3 sentences — self-contained, action-rich, few dependencies]

## Game Overview

### Engine
[UE version]

### Game Modes
[List game modes. Mark which is used by the curated slice.]

### 3rd Parties
[Major middleware relevant to the integration: GAS, CommonUI, etc.]

## Integration Key Concepts

[3-5 bullet points summarizing the most important design decisions.
Each explains WHAT and WHY in 1-2 sentences.]

## Architecture

### Why Subsystem + Component
[Explain the two-lifetime split for THIS game specifically.
What is app-lifetime vs match-lifetime in this game?]

### Why GameStateComponent
[Reference the comparison table from Section 5.
Add any game-specific reasons.]

### Architecture Diagram
[ASCII diagram showing the two classes, their responsibilities,
and how they connect to the game's classes. See Lyra TDD for format.]

## Save System Classification

**Group: [1|2|3]**
**Rationale:** [Why this classification, based on code analysis findings]

[If Group 1/2: describe the existing save system]
[If blockers found for SaveWorld: list them]
[Preliminary recommendation: SaveWorld vs Manual — final decision is in Phase 8]

## SDK Concept → Game Equivalent

| SDK Concept | Game Equivalent | Notes |
|-------------|----------------|-------|
| Session activation | [Game's startup sequence] | |
| Room open | [Match/level start hook] | |
| Room close | [Match/level end hook] | |
| BeginGameplay | [Actual gameplay start signal] | |
| EndGameplay | [Gameplay end signal] | |
| Player added | [Player join/spawn mechanism] | |
| Player removed | [Player leave/despawn] | |
| Pause/Resume | [Game's pause mechanism — recorded in `integration.json → pauseMechanism`]. How the game pauses matters: `UGameplayStatics::SetGamePaused`, `APlayerController::SetPause`, custom pause manager, time dilation, or CommonUI-driven. The SDK's `OnPauseGameRequested` callback fires when the overlay appears — the game must respond using its own mechanism. | |
| Non-ludeoable areas | [Menus, loading screens, cinematics] | |

## Integration Plan

### Plugin Structure
[Where the plugin lives, what modules it contains, .uplugin and .Build.cs notes]

### Core Game Modifications
[List every file in the core game that needs changes.
Each change should be minimal and generic.]

### Estimated Effort
[Per-phase rough estimates: small/medium/large]

## Risk Assessment

**Only list risks that are evidenced by code analysis.** Do not invent risks to fill a table. If no risks were found, say "No risks identified." A risk must reference a specific finding — a code pattern, missing API, or architectural constraint discovered during analysis.

**Not a risk:** LudeoUESDK engine version compatibility. Check `config/sdk-sources.json` → `supportedEngineVersions` — the plugin supports UE 4.27 through 5.7.

### Risk Classification Discipline

**What is and is not a risk.** A risk is a concrete failure mode with evidence and no settled plan. Before listing something as a risk, apply two filters:

- **Is it a documented procedure?** BP-only/CommonUI packaging, editing a `.uasset`, enabling a plugin — these have known, handled steps (and often a learning). They are **Phase N tasks**, not risks. Listing them inflates the table and buries the real risks.
- **Is it a known-unknown with a clear resolution path?** "Ammo location not yet found", "exact death delegate not confirmed" — these are **open tasks** scheduled into the phase that resolves them, not risks.

Each genuine risk MUST name (a) the concrete failure mode and (b) the evidence for it. Example of a real one worth surfacing: "Player Flow restore competes with the level's own runtime enemy spawner, which auto-spawns on load — restored enemies may be duplicated or overwritten." If you cannot state a failure mode and evidence, it is not a risk. (See `learnings/common-mistakes/speculative-compatibility-risks.md` and Common Mistake 8.12.)

### Identified Risks
| Risk | Evidence | Severity | Mitigation |
|------|----------|----------|------------|
| [Only if found] | [File/pattern that proves this is real] | Low/Medium/High | [mitigation] |

### Open Questions
[Anything unresolved that needs human input before proceeding to Phase 3]

## Dependencies
- LudeoUESDK plugin + Ludeo C SDK (setup method recorded in `integration.json` → `sdkSetup`)
- [Other dependencies found during analysis: Steam, online services, etc.]
```

---

## 7. ✅ Success Criteria

- [ ] `.ludeo/code-map.json` exists (integration-surface CODE_MAP)
- [ ] Lifecycle hooks, core classes, event systems, and candidate entities listed
- [ ] Every symbol verified against the actual codebase (no guessed names)
- [ ] Curated slice selected (map + mode + entities) and recorded in `integration.json → curatedSlice`
- [ ] Save-system group classified with evidence

---

## 8. Common Mistakes

These are errors that a prior skill-generated TDD made when applied to Lyra. The skill should actively avoid each one.

### 8.1 Wrong Subsystem Type — WorldSubsystem Instead of GameStateComponent

**Mistake:** Using `UWorldSubsystem` for match-lifetime logic.
**Why it's wrong:** `Initialize` fires before `GameState` exists; no built-in ticking; no replication path.
**Prevention:** Always use `UGameStateComponent` for match-lifetime logic. See comparison table in Section 5.

### 8.2 Code in Game Module Instead of Plugin

**Mistake:** Placing Ludeo classes in `Source/GameName/System/` instead of a separate plugin.
**Why it's wrong:** Defeats plugin isolation; cannot disable without code removal; creates compile-time coupling.
**Prevention:** All Ludeo code goes in `Plugins/GameFeatures/LudeoIntegration/`. Core game uses `StaticLoadClass` for zero compile-time dependency.

### 8.3 Fabricated C-Style SDK API

**Mistake:** Using C SDK function names (`ludeo_DataWriter_SetFloat`, `ludeo_DataWriter_EnterObject`).
**Why it's wrong:** The UE SDK wrapper has a completely different API surface. C SDK examples won't compile.
**Prevention:** Use only UE wrapper classes:
- `FLudeoManager` — SDK singleton
- `FLudeoSession` / `FLudeoSessionManager` — session lifecycle
- `FLudeoRoom` / `FLudeoRoomWriter` — room and data access
- `FLudeoWritableObject` / `FLudeoReadableObject` — state tracking
- `FLudeoPlayer` — player lifecycle
- `FScopedLudeoDataReadWriteEnterObjectGuard` — RAII scope guard

If unsure about API details, check the `sdk-docs` MCP server or `references/sdk-reference/` files.

### 8.4 Incomplete N-Way Gate

**Mistake:** Only gating on RoomReady + PlayerAdded (2 conditions), missing the game phase condition.
**Why it's wrong:** Without a phase gate, `BeginGameplay` can fire during loading screens or warmup.
**Prevention:** Always include a game-phase or gameplay-active condition. Analyze the game's phase/state system during 3.3 to identify what signals "gameplay has started."

### 8.5 Missing Bot Tracking

**Mistake:** Only tracking the human player, ignoring bots/NPCs.
**Why it's wrong:** In vs-bots modes, Player Flow has no opponents to restore. Bot state is needed for scene reconstruction.
**Prevention:** During analysis (3.6), identify all AI-controlled entities. Each bot gets its own writable object. Determine identity matching strategy (index-based if names are random, name-based if stable).

### 8.6 Wrong Attribute Schema

**Mistake:** Storing position as three floats (`PositionX`, `PositionY`, `PositionZ`) instead of `FVector`.
**Why it's wrong:** The UE SDK wrapper supports native UE types. Using separate floats creates schema mismatches between Creator Flow writes and Player Flow reads.
**Prevention:** Use native UE types in `WriteData`/`ReadData`:
- `FVector` for position
- `FRotator` for rotation and control rotation
- `float` for health, score
- `int32` for team ID, slot indices
- `FString` for asset paths, names

### 8.7 Missing ControlRotation

**Mistake:** Only tracking actor rotation, not controller rotation.
**Why it's wrong:** In FPS/TPS games, the camera/aim direction comes from `GetControlRotation()`, not `GetActorRotation()`. Without it, Player Flow restores the wrong aim direction.
**Prevention:** Always track both `Rotation` (body) and `ControlRotation` (camera/aim) as separate `FRotator` attributes.

### 8.8 Nested Object Hierarchy That Doesn't Exist

**Mistake:** Designing nested component structures (Object → Component → SubComponent) in writable objects.
**Why it's wrong:** The UE SDK uses flat writable objects with scoped guards. There is no component nesting.
**Prevention:** Keep writable objects flat. All attributes on a single object. Use scoped guards for write transactions, not for hierarchy.

### 8.9 Stored Writer Handle

**Mistake:** Caching a `DataWriterHandle` member variable for write operations.
**Why it's wrong:** The UE SDK accesses the writer through `FLudeoRoom::GetRoomWriter()` on demand.
**Prevention:** Always get the `FLudeoRoomWriter` from the room when needed. Do not cache it.

### 8.10 Wrong Player Flow Ordering

**Mistake:** Applying state while paused, then unpausing.
**Why it's wrong:** `TeleportTo` may not process correctly while `CharacterMovementComponent` is paused.
**Prevention:** Unpause first, then apply state (teleport, team, health, weapons), then `BeginGameplay()`.

### 8.11 Relative Paths in Bash Commands

**Mistake:** Using relative paths (`ls Plugins/LudeoUESDK/`) or assuming `cd` persists between bash calls.
**Why it's wrong:** The bash tool does not preserve working directory between calls. Relative paths fail silently after prior `cd` commands, leading to false "file not found" conclusions and unnecessary destructive recovery actions.
**Prevention:** Always use absolute paths. When operating inside a submodule, combine `cd` and commands with `&&` in a single bash call: `cd "<absolute-path>/Plugins/LudeoUESDK" && git status`. Never run destructive git commands based on a single failed path check — verify with absolute paths first.

### 8.12 Invented Risks

**Mistake:** Listing risks that aren't evidenced by code analysis (e.g., "UE version compatibility" when the plugin supports the version).
**Why it's wrong:** Fabricated risks waste the human reviewer's time and undermine trust in the TDD.
**Prevention:** Every risk must reference a specific finding — a code pattern, missing API, or constraint discovered during analysis. Check `config/sdk-sources.json` for known compatibility info. If no real risks were found, say "No risks identified."
