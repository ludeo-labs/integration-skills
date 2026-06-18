# Lyra Integration PR Learnings

**Source:** [PR #5 — Ludeo SDK integration for Lyra Starter Game (UE 5.7)](https://github.com/EdgeGamingGG/ludeosdk-lyra-sample/pull/5)
**Date:** March 2026
**91 files, ~14,600 lines**

This document categorizes patterns from the Lyra integration into three tiers to inform the integration skill. The skill should use universal patterns directly, ask the human about generalizable patterns, and treat Lyra-specific patterns as examples only.

---

## 1. Universal Patterns

These apply to any UE Ludeo integration. The skill should implement them directly.

### Architecture
- **Subsystem + Component split** — `UGameInstanceSubsystem` for session lifetime (init, activate, shutdown, Player Flow entry), `UGameStateComponent` for match lifetime (room lifecycle, state tracking, actions). Clear separation of concerns.
- **Dynamic component loading** — Core game creates Ludeo component via `StaticLoadClass("/Script/LudeoIntegrationRuntime.LudeoGameStateComponent")` in GameState constructor. Zero compile-time coupling — if plugin is disabled, `StaticLoadClass` returns nullptr and no component is created.
- **GameFeature plugin isolation** — All Ludeo code in `Plugins/GameFeatures/LudeoIntegration/`. Core game has no `#include` of plugin headers.

### SDK Lifecycle
- **Deferred session activation** — SDK overlay requires window handle; window may not exist on first tick. Use `FTSTicker` to retry each frame until window is ready.
- **Per-frame SDK tick** — Register `FTSTicker` delegate for `LudeoManager::Tick()`. Decoupled from game tick so SDK can tick even when game is paused.
- **API key resolution chain** — Command-line (`-LudeoAPIKey=`) > env var (`LUDEO_API_KEY`) > config (`DefaultGame.ini`). Never hardcoded.
- **Teardown chain** — Always in order: `EndGameplay → RemovePlayer → CloseRoom`. Subsystem coordinates teardown when switching Ludeos or returning to menu.

### Room Lifecycle
- **3-way gate for BeginGameplay** — Multiple async conditions must ALL be true before gameplay starts. Lyra required: `bRoomReady` (SDK callback) + `PlayerHandle` (SDK callback) + `bGamePhaseActive` (game phase system). Other games will have different conditions but the pattern is the same: gate on N async signals.
- **Scoped guards (RAII)** — `FScopedLudeoDataReadWriteEnterObjectGuard` for object scope entry/exit. Destructor auto-exits. Prevents double-entry errors.

### Player Flow
- **Skip-to-gameplay sequence** — Skip non-gameplay phases → force gameplay phase → short delay (let loading screen dismiss) → pause → open room with LudeoID → unpause → apply state → begin gameplay.
- **Pending state pattern** — Subsystem fetches Ludeo data and stores in `Pending*` fields. After `ServerTravel` to correct map, component picks up pending state during room open.

### Development
- **Console command** — Register `Ludeo.Play <LudeoID>` for testing Player Flow without UI.
- **Command-line launch** — Support `-LudeoID=<id>` for automated testing.
- **Minimal core touches** — Lyra required ~50 lines across 5 files. The principle: keep core modifications as small and generic as possible.

---

## 2. Generalizable Patterns

Lyra showed one implementation of each. The skill must discover the game's equivalent and **ask the human** when it can't determine the answer from code analysis alone.

| Pattern | Lyra's Implementation | What the Skill Should Ask |
|---------|----------------------|---------------------------|
| **Write frequency** | 10Hz accumulator (write state every 0.1s) | "How volatile is the game's state? Does position/health change every frame or less? What frequency balances fidelity vs performance?" |
| **Event deduplication** | WeaponPickup debounced 1s; suppressed if <2 slots or within 1s of spawn | "Does the event system fire duplicate or redundant events for a single gameplay moment? What dedup strategy is needed?" |
| **Deferred property application** | Health deferred — GAS resets health to max during init; applied via `OnAbilitySystemInitialized` + next-tick timer | "Which game systems overwrite or reset state during initialization? What properties need to be applied after init completes?" |
| **Entity matching (Player Flow)** | Bots matched by spawn index (bot names are random in Lyra) | "Do NPCs/bots have stable identifiers across sessions, or do we need a matching strategy (by index, by type, by position)?" |
| **Non-gameplay phases** | Warmup phase skipped, Playing phase force-started via custom `SkipPhase()`/`StartPhase()` API | "What phases or states exist between map load and actual gameplay? Which need to be skipped or fast-forwarded for Player Flow?" |
| **Core game hooks needed** | Added delegates on GameState, SkipPhase API on PhaseSubsystem, ability broadcast, UE_API exports on QuickBar/Settings | "What events/delegates already exist in the game code? What minimal API surface needs to be exposed for the plugin?" |
| **Pause detection** | `TickComponent` polls `GetWorld()->IsPaused()` for state transitions | "How does the game handle pause? Is there a pause event/delegate, or do we need to poll?" |
| **Action discovery** | Subscribed to `UGameplayMessageSubsystem` with gameplay tags | "What event/message system does the game use? Delegates, gameplay messages, custom event bus, blueprint events?" |
| **State object granularity** | GameMetadata (write once), Player (10Hz), Bot[] (10Hz per bot) | "What are the distinct entity types to track? Which have static data (write once) vs dynamic data (write continuously)? How many instances?" |
| **Weapon/inventory tracking** | QuickBar slot array with asset path names | "How does the game represent inventory/loadout? Slots, lists, equipped items? What uniquely identifies each item?" |
| **Pause action naming** | Creator: `StartNoneLudeable`/`StopNoneLudeable`. Player: `PauseLudeo`/`ResumeLudeo` | "Should pause tracking differ between Creator Flow and Player Flow?" (Usually yes — Creator pauses recording, Player pauses playback timer) |

### When to Ask vs When to Infer

The skill should **infer from code analysis** when possible:
- Event systems (grep for delegate declarations, message subsystems, event dispatchers)
- Phase/state machines (look for state enums, phase managers, game mode states)
- Existing save systems (look for `SaveGame`, serialization, checkpoint code)
- Entity types (scan for pawn classes, character classes, AI controllers)

The skill should **ask the human** when:
- Multiple valid approaches exist (write frequency, dedup strategy)
- Game-specific domain knowledge is needed (what counts as a "significant action")
- Code analysis is ambiguous (is this delegate the right hook point?)
- Performance tradeoffs require human judgment (state size vs update frequency)
- Ordering/timing dependencies aren't obvious from code (deferred health, phase skipping)

---

### SaveWorld vs Manual Writable Objects

This is a critical decision point. The two approaches have different tradeoffs and the skill should recommend one based on the game's characteristics.

#### Approach Comparison

| | SaveWorld (`FLudeoObjectStateManager::SaveWorld()`) | Manual Writable Objects (`FLudeoWritableObject`) |
|---|---|---|
| **What it does** | Captures full world state via UE's built-in serialization | You define exactly which properties to write per object |
| **Code effort** | Low — configure what actors/properties to include | High — enumerate every property, manage scoped guards |
| **Comprehensiveness** | High — captures all marked UPROPERTYs automatically | Risk of missing properties you forgot to add |
| **Delta size** | Larger — captures everything, even unchanged data | Smaller — only write what matters |
| **Performance** | Full-world serialization per tick = more CPU | Only tracked properties = less CPU |
| **Custom types** | Breaks with custom serializers (FFastArraySerializer, NetDeltaSerialize) | Works with any data, including non-UPROPERTY state |
| **Static vs dynamic data** | No distinction — everything serialized each tick | Can separate write-once (metadata) from write-per-tick (position) |
| **Debugging** | Harder — opaque serialization blob | Easier — you know exactly what's being sent |
| **Player Flow reconstruction** | Uses `RestoreWorld()` — automatic if serialization works | Manual reconstruction — must apply each property in correct order |
| **Real example** | FPS Starter Kit — simple actor model, SaveWorld per frame | Lyra — FFastArraySerializer broke SaveWorld, required manual objects |

#### Decision Matrix

| Factor | Favors SaveWorld | Favors Manual |
|--------|:---:|:---:|
| Game has compatible existing save system | X | |
| Custom serializers (FFastArraySerializer, NetDeltaSerialize) | | X |
| Non-UPROPERTY state (raw C++ members, custom containers) | | X |
| Small state, short matches | X | |
| Large state, long sessions (delta size matters) | | X |
| Many dynamic actors (need to scope what to track) | | X |
| Complex object relationships / reconstruction ordering | | X |
| Performance-sensitive title | | X |
| Team wants fastest integration | X | |

#### Skill Recommendation Flow

The skill should analyze the game and present a recommendation:

1. **Scan for serialization blockers** — grep for `FFastArraySerializer`, `NetDeltaSerialize`, custom `Serialize()` overrides in game state classes. If found → lean Manual.
2. **Check for existing save system** — look for `USaveGame` subclasses, `SaveGameToSlot`, checkpoint systems. If present and compatible → lean SaveWorld.
3. **Estimate state scope** — count tracked actor types, estimate property volume, consider session length. Large scope → lean Manual for delta control.
4. **Present recommendation with rationale** to the human. The human makes the final call.

**Questions for the human:**
- "Does the game use custom serializers or non-standard containers for gameplay state?"
- "How large is the typical game state, and how long are sessions?"
- "Is there an existing save system we can leverage?"

## 3. FPS Starter Kit Comparison

The [FPS Starter Kit](https://github.com/EdgeGamingGG/ludeosdk-unreal-samples) is an older, simpler integration that embeds Ludeo code directly in the game module (not a plugin). It validates WHY the Lyra plugin approach is better, but has some useful patterns:

### Useful patterns from FPS Kit
- **Ref-counted SDK init guard** — `InitializationGuard` tracks `NumberOfInstanceInitialized`; only calls `Initialize()`/`Finalize()` on 0→1 / →0 transitions. Handles multiple GameInstance scenarios (multiplayer, editor PIE).
- **Explicit state machine enum** — `ELudeoGameSessionInitializationState` with named states (NotInitialized → SessionSetup → WaitingForRoom → RoomReady → Succeeded/Failed). More verbose than Lyra's boolean flags but more debuggable.
- **Action enum pattern** — Actions defined as `UENUM`, reported by enum name string. Simpler than Lyra's gameplay message subscription.
- **SaveWorld approach** — Uses `FLudeoObjectStateManager::SaveWorld()` for full world state capture (see table above).

### What confirms Lyra's plugin approach is better
- **Tight coupling** — Every class prefixed `FPSGameStarterKitLudeo*`, compiled into game module. Can't disable without removing code.
- **No plugin isolation** — SDK API changes break game code directly.
- **No dynamic loading** — Always compiled in; no `StaticLoadClass` decoupling.
- **Full-world state per frame** — Scalability concern for larger games.

## 4. Game-Specific Patterns (Examples Only)

Captured as examples in reference docs. Not rules — the skill must adapt to each game.

### Lyra-Specific
- **Action set**: Kill, Death, Assist, Grenade, Dash, WeaponPickup, HealthPickup, multi-kill accolades (DoubleKill–PentaKill), kill streaks (5/10/15/20), damage type tags
- **State attributes**: ControlRotation (separate from actor Rotation, needed for camera aim), PerceivedEnemies, MoveStatus, FocusTarget (bot AI observables)
- **Architecture specifics**: LyraGamePhaseSubsystem SkipPhase/StartPhase API, GameplayAbilitySystem integration, QuickBar slot-based inventory
- **Lyra quirks**: FFastArraySerializer prevents SaveWorld approach (required manual writable objects), bot names are random (required index-based matching), health reset during GAS init (required deferred application)

### FPS Starter Kit-Specific
- **Action set**: PlayerCollectMoney, PlayerCollectItem, PlayerShoot, PlayerDamageTaken, PlayerKill, PlayerDie, OpenPauseMenu, ClosePauseMenu
- **Architecture**: Direct game module integration (no plugin), GameInstance owns SDK lifecycle, GameState owns room lifecycle
- **State capture**: SaveWorld per frame with default save actors (LevelScriptActor, PlayerController, PlayerState)

---

## 5. Out of Scope for Current Phase

- **Testing infrastructure** — Tier 1/2/3 test pyramid is well-documented in the PR but is a future phase concern
- **Open source readiness** — Handled by the `ludeo-opensource-review` skill separately
- **Build scripts and packaging** — Separate cloud build skill concern
