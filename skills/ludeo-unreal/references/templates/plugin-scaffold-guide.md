# Plugin Scaffold Templates

## Overview

These templates describe the universal plugin structure for Ludeo SDK integrations. The Subsystem + Component pattern is identical across all UE games — only the game-specific names and hook points change.

**Usage:** During Phase 3, the skill generates the plugin scaffold by following these templates and substituting game-specific values from the CODE_MAP.

---

## Template Variables

Replace these placeholders with game-specific values from Phase 2 analysis:

| Variable | Source | Example |
|----------|--------|---------|
| `{GameName}` | `integration.json → gameTitle` | `Voyager` |
| `{PluginName}` | `{GameName}LudeoIntegration` | `VoyagerLudeoIntegration` |
| `{SubsystemClass}` | `U{GameName}LudeoSubsystem` | `UVoyagerLudeoSubsystem` |
| `{ComponentClass}` | `U{GameName}LudeoComponent` | `UVoyagerLudeoComponent` |
| `{GameModuleAPI}` | From `.Build.cs` — e.g., `VOYAGER_API` | `VOYAGER_API` |
| `{GameModeClass}` | CODE_MAP `core_classes[role=GameMode]` | `AVoyagerGameMode` |
| `{GameStateClass}` | CODE_MAP `core_classes[role=GameState]` | `AVoyagerGameState` |
| `{RoomOpenHook}` | CODE_MAP `lifecycle_hooks.roomOpen` | `OnMatchStarted` delegate |
| `{GameplayStartHook}` | CODE_MAP `lifecycle_hooks.gameplayStart` | `OnGamePhaseChanged` |
| `{GameplayEndHook}` | CODE_MAP `lifecycle_hooks.gameplayEnd` | `OnMatchEnded` |
| `{CuratedMap}` | `integration.json → curatedSlice.mapName` | `LevelWaveCombat` |

---

## File Structure

```
Plugins/
└── {PluginName}/
    ├── {PluginName}.uplugin
    ├── Source/
    │   └── {PluginName}/
    │       ├── {PluginName}.Build.cs
    │       ├── {PluginName}Module.h
    │       ├── {PluginName}Module.cpp
    │       ├── {SubsystemClass}.h
    │       ├── {SubsystemClass}.cpp
    │       ├── {ComponentClass}.h
    │       └── {ComponentClass}.cpp
    └── Config/
        └── (empty for now — config added in Phase 3+)
```

---

## 1. {PluginName}.uplugin

```json
{
    "FileVersion": 3,
    "Version": 1,
    "VersionName": "1.0",
    "FriendlyName": "{GameName} Ludeo Integration",
    "Description": "Ludeo SDK integration for {GameName}",
    "Category": "Game",
    "CreatedBy": "Ludeo",
    "Modules": [
        {
            "Name": "{PluginName}",
            "Type": "Runtime",
            "LoadingPhase": "Default"
        }
    ],
    "Plugins": [
        {
            "Name": "LudeoUESDK",
            "Enabled": true
        }
    ]
}
```

---

## 2. {PluginName}.Build.cs

```csharp
using UnrealBuildTool;

public class {PluginName} : ModuleRules
{
    public {PluginName}(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "LudeoUESDK",       // Ludeo UE wrapper
            "{GameName}"         // Game module — for accessing game classes
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            // Add as needed during compile-fix
        });
    }
}
```

---

## 3. Module (.h / .cpp)

Standard UE module boilerplate. Registers the module. No custom logic needed.

---

## 4. Subsystem — {SubsystemClass}

**Base class:** `UGameInstanceSubsystem`
**Lifetime:** App lifetime (survives map loads)

### Responsibilities

| Responsibility | SDK API | When |
|---------------|---------|------|
| SDK init | `FLudeoManager::Initialize()` | `Initialize()` |
| Per-frame tick | `FLudeoManager::Tick()` via `FTSTicker` | Every frame |
| Session create | `FLudeoSessionManager::CreateSession()` | After init |
| Register notifications | `Session.AddNotify*()` | Before activate |
| Activate session | `Session.Activate()` | After notifications (deferred if no window) |
| API key resolution | cmd-line → env var → config | During activate |
| Console command | `Ludeo.Play <LudeoID>` | For dev testing |
| Player Flow entry | `OnLudeoSelected` → store pending → `ServerTravel` | On notification |
| Teardown coordination | Component calls back to subsystem for cross-map cleanup | On cleanup |
| Session destroy | `Session.Destroy()` | `Deinitialize()` |

### Key patterns (all universal, see phase-03-lifecycle.md Section 5 for full code):
- Deferred activation (retry until window handle exists)
- API key resolution chain
- Pending Ludeo state for Player Flow ServerTravel
- Console command for dev testing

---

## 5. Component — {ComponentClass}

**Base class:** `UGameStateComponent`
**Lifetime:** Per playable unit (match, level, wave)

### Responsibilities

| Responsibility | SDK API | When |
|---------------|---------|------|
| Room open | `Session.OpenRoom()` | Component `BeginPlay` or room-open hook |
| Add player | `Room.AddPlayer()` | Player spawn/ready |
| N-way gate | Check all conditions → `BeginGameplay()` | Each condition fires `TryBeginGameplay` |
| State tracking (Creator) | `WritableObject.WriteData()` | `TickComponent` after BeginGameplay |
| State restoration (Player) | `ReadableObject.ReadData()` | After BeginGameplay in Player Flow |
| Action reporting | `RoomWriter.SendAction()` | On game events (Phase 6) |
| End gameplay | `Player.EndGameplay()` | Gameplay end signal |
| Remove player | `Room.RemovePlayer()` | After EndGameplay |
| Close room | `Room.Close()` | After RemovePlayer |

### N-Way Gate Conditions (populate from CODE_MAP)

```
Condition 1: bRoomReady        — SDK OnRoomReady notification
Condition 2: PlayerHandle set  — SDK OnPlayerAdded callback
Condition 3: bGamePhaseActive  — Game: {GameplayStartHook} signals gameplay
[Add more from CODE_MAP analysis]
```

Each condition setter calls `TryBeginGameplay()`. Whichever fires last triggers it.

---

## 6. Core Game Modifications

Minimal changes to the game code (outside the plugin):

| Change | Where | Why |
|--------|-------|-----|
| Add plugin to `.uproject` | `{GameName}.uproject` | Enable the plugin |
| `StaticLoadClass` for Component | `{GameModeClass}::InitGame` or `{GameStateClass}::BeginPlay` | Dynamic component loading — zero compile-time dependency |
| API export macros | Game class headers (if methods are called from plugin) | Required for cross-DLL calls |
| Delegate declarations (if needed) | Game state/mode headers | For plugin to bind to game events |

### StaticLoadClass Pattern

```cpp
// In GameMode or GameState — loads the Ludeo component dynamically
void A{GameModeClass}::InitGame(...)
{
    Super::InitGame(...);

    UClass* LudeoComponentClass = StaticLoadClass(
        UGameStateComponent::StaticClass(),
        nullptr,
        TEXT("/Script/{PluginName}.{ComponentClass}"));

    if (LudeoComponentClass)
    {
        GameState->AddComponentByClass(LudeoComponentClass, false, FTransform::Identity, false);
    }
}
```

If the plugin is disabled, `StaticLoadClass` returns `nullptr` and no Ludeo code runs.
