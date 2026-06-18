# 05-LIFECYCLE-MANAGEMENT.md - SDK Lifecycle Management

> **Purpose:** Complete guide to SDK initialization, session management, and game flow integration  
> **When to use:** When implementing SDK lifecycle hooks in your game  
> **Read time:** ~20 minutes  
> **Prerequisites:** [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [SDK Lifecycle Phases](#2-sdk-lifecycle-phases)
3. [Game Session vs Gameplay Session](#3-game-session-vs-gameplay-session)
4. [SDK Initialization (Game Startup)](#4-sdk-initialization-game-startup)
5. [Game Session Activation](#5-game-session-activation)
6. [Gameplay Session Management](#6-gameplay-session-management)
7. [Session Cleanup and Shutdown](#7-session-cleanup-and-shutdown)
8. [Integration Points Summary](#8-integration-points-summary)
9. [Timeline and Flow Diagrams](#9-timeline-and-flow-diagrams)
10. [Error Handling](#10-error-handling)
11. [Testing and Validation](#11-testing-and-validation)

---

## 1. Overview

### What is Lifecycle Management?

The Ludeo SDK has a specific lifecycle that must be carefully managed to ensure proper state tracking and restoration. This document covers:

- **SDK Initialization** - Setting up the SDK when your game launches
- **Session Management** - Managing the Game Session and Gameplay Sessions
- **Proper Cleanup** - Releasing resources when gameplay ends or game shuts down

### Two-Level Session Model

The SDK uses a two-level session model:

1. **Game Session** - Activated when the game loads, persists until game closes
2. **Gameplay Session** - Created for each gameplay instance (level, match, mission, etc.)

This separation allows the SDK to remain active throughout the game's lifetime while tracking individual gameplay moments.

### Callback-Driven Architecture

**CRITICAL CONCEPT:** Most SDK operations are asynchronous and callback-driven:

- **🎮 Game Code Integration Points** - Where you call SDK functions from your game's event handlers (e.g., when map loading starts, when game shuts down)
- **📞 SDK Callback Handlers** - Functions the SDK calls back into your code when async operations complete

**Only ONE game code integration point for gameplay session:**
- Call `ludeo_Session_OpenRoom()` when level/match loading starts

**Everything else happens via callbacks:**
- `OnRoomOpenedCallback` → triggers `AddPlayerToRoom()`
- `OnPlayerAddedCallback` + `OnRoomReadyCallback` → trigger `TryBeginGameplaySession()`
- The callbacks drive the flow, not your game events

---

## 2. SDK Lifecycle Phases

### Phase Overview

| Phase | Trigger | SDK Operations | State |
|-------|---------|----------------|-------|
| **Initialization** | Game launch | `ludeo_Initialize()`, `ludeo_Session_Create()` | SDK ready |
| **Game Session Active** | Game loaded | `ludeo_Session_Activate()` | Ready for gameplay |
| **Gameplay Session Start** | Level/match loading | `ludeo_Session_OpenRoom()`, `ludeo_Room_AddPlayer()` | Preparing tracking |
| **Gameplay Active** | Gameplay begins | `ludeo_GameplaySession_Begin()` (sync) | Full tracking active |
| **Gameplay End** | Match/level ends | `ludeo_GameplaySession_End()` | Tracking stopped |
| **Room Closed** | Return to menu | `ludeo_Room_Close()` | Cleanup |
| **Shutdown** | Game exit | `ludeo_Session_Release()`, `ludeo_Shutdown()` | SDK terminated |

### Critical Rules

⚠️ **CRITICAL:**
- **Game Session** is activated ONCE when the game loads
- **Gameplay Sessions** are created/destroyed for EACH gameplay instance (can happen many times)
- **Never** skip phases - follow the exact order
- **Always** check return values and handle errors gracefully
- **Call** `ludeo_Tick()` every frame on a consistent thread

### 🎯 Quick Reference: What You Call vs. What Calls You

| Operation | You Call | SDK Calls You Back |
|-----------|----------|-------------------|
| SDK Init | `ludeo_Initialize()` | - |
| Session Activate | `ludeo_Session_Activate()` | `OnSessionActivatedCallback()` |
| **Room Open** | **`ludeo_Session_OpenRoom()`** ← 🎮 Game event | **`OnRoomOpenedCallback()`** |
| **Player Add** | `ludeo_Room_AddPlayer()` ← 📞 From callback | **`OnPlayerAddedCallback()`** |
| **Room Ready** | - (register once at init) | **`OnRoomReadyCallback()`** ← 📞 Auto-fired |
| **Gameplay Begin** | `ludeo_GameplaySession_Begin()` ← 📞 From callbacks | - (synchronous) |
| Gameplay End | `ludeo_GameplaySession_End()` | `OnGameplayEndedCallback()` |

**Key Insight:** Only **Room Open** is triggered by game events. Player adding and gameplay begin happen inside SDK callbacks.

---

## 3. Game Session vs Gameplay Session

**→ See [03-SDK-FUNDAMENTALS.md Section 2.1](./03-SDK-FUNDAMENTALS.md#21-game-session-vs-gameplay-session) for full explanation**

**Quick reference:**
- **Game Session** (Section 5): ONE per game launch, activated once, released at shutdown
- **Gameplay Session** (Section 6): ONE per level/match, created and destroyed many times

The following sections detail how to implement each.

---

## 4. SDK Initialization (Game Startup)

### When to Initialize

Initialize the SDK **as early as possible** during game startup, typically in your main initialization function or GameInstance initialization.

### Implementation

```cpp
// Example initialization implementation

bool Initialize()
{
    // Initialize core SDK
    
    auto params = Ludeo::create<LudeoInitializeParams>();
    LudeoResult result = ludeo_Initialize(&params);
    if (result != LudeoResult::Success) {
        // Handle error - log and continue without Ludeo
        return false;
    }

    // Default ludeo commands
	ludeo_Command("backendlogs-enabled", "0");
	ludeo_Command("monitor-enabled", "0");
    
    // Local debug command used to force ludeo playback
    ludeo_Command("activation-ludeoid", /*selectedLudeoID*/);

    // Create session handle
    auto create_params = Ludeo::create<LudeoSessionCreateParams>();
    
    // Register notifications BEFORE activation
    RegisterNotifications();
    
    return true;
}
```

### Registering Notifications

Register for notifications **after session creation, before** activating the session:

```cpp
void RegisterNotifications()
{
    // Register for LudeoSelected - this is how the game knows when a user wants to play a Ludeo
    auto selectedParams = Ludeo::create<LudeoSessionAddNotifyLudeoSelectedParams>();
    LudeoResult result = ludeo_Session_AddNotifyLudeoSelected(
        session_handle, &selectedParams, callback_data, OnLudeoSelectedCallback);
    
    // Register for RoomReady - CRITICAL: register upon session creation
    auto roomReadyParams = Ludeo::create<LudeoSessionAddNotifyRoomReadyParams>();
    result = ludeo_Session_AddNotifyRoomReady(
        session_handle, &roomReadyParams, nullptr, OnRoomReadyCallback);
    
    // Check results and handle errors appropriately for your game
}
```

### Integration Point: Game Startup

```cpp
// Example: In your game's main initialization

int main()
{
    // Initialize other game systems...
    
#if LUDEO_SDK_ENABLED
    // Initialize Ludeo SDK early
    if (!InitializeLudeoSDK("your-api-key")) {
        // Log warning - game continues without Ludeo
    }
#endif
    
    // Continue game initialization...
    return RunGame();
}
```

**→ See:** [04-BUILD-INTEGRATION.md](./04-BUILD-INTEGRATION.md) for build system setup  
**→ See:** [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) for API patterns

---

## 5. Game Session Activation

### When to Activate

Activate the Game Session **immediately after initialization**, typically still during game startup. The session should be active before the player reaches the main menu.

### Why Activate Early

- Allows the game to receive LudeoSelected notifications at any time
- Enables SDK overlay and platform features
- Prepares the SDK for gameplay sessions
- Establishes connection to Ludeo backend during startup
- **Hides async activation latency** in game's natural startup time

### Window Handle (Critical!)

The `windowHandle` parameter is **REQUIRED** for video capture and overlay functionality. You must provide the native window handle for your platform.

#### Getting Window Handle by Platform

```cpp
void* GetPlatformWindowHandle()
{
#if defined(_WIN32)
    // Windows - Get HWND
    return /* your game's HWND */;
    
#elif defined(__APPLE__)
    // macOS - Get NSWindow*
    return /* your game's NSWindow* */;
    
#elif defined(__linux__)
    // Linux - Get X11 Window or Wayland surface
    return /* your game's window */;
    
#endif
}
```

### Implementation

```cpp
void ActivateSession()
{
    // Prepare activation parameters
    auto params = Ludeo::create<LudeoSessionActivateParams>();
    params.platformUrl = "https://services.ludeo.com";
    params.apiKey = api_key;
    params.gameVersion = game_version;
    params.windowHandle = GetPlatformWindowHandle();  // CRITICAL for video/overlay
    
    // Activate (async operation)
    LudeoResult result = ludeo_Session_Activate(
        session_handle, &params, callback_data, OnSessionActivatedCallback);
    
    // Check result and handle appropriately
}

// Callback when activation completes
void OnSessionActivatedCallback(const LudeoSessionActivateCallbackParams* data)
{
    if (data->resultCode == LudeoResult::Success) {
        // Session is now active - ready for gameplay sessions
        session_active = true;
    } else {
        // Handle activation failure - game continues without Ludeo
    }
}
```

### Integration Point: After Initialization

```cpp
bool Initialize(const char* apiKey, const char* gameVersion)
{
    // ... initialization code from Section 4 ...
    
    // Activate session immediately after creation
    ActivateSession();
    
    return true;
}
```

---

## 6. Gameplay Session Management

### 6.1 Overview

A **Gameplay Session** represents one instance of gameplay. The flow has several distinct steps:

1. **Open Room** - When level/gameplay starts loading
2. **Add Player(s)** - All players must be added before gameplay can begin
3. **Wait for Room Ready** - Room ready callback confirms all players added
4. **Begin Gameplay** - When gameplay actually starts (loading complete)
5. **End Gameplay** - When gameplay finishes
6. **Remove Player(s)** - All players removed from room
7. **Close Room** - Final cleanup

---

### ⚠️ **CRITICAL: Callback-Driven Flow - Common Mistake**

**THE MISTAKE:** Calling `AddPlayer()` directly from game code after `OpenRoom()`.

Many integrations incorrectly place these operations in game event handlers:

```cpp
// ❌ WRONG - Don't do this!
void Game::StartMap(const char* mapName) {
    LoadMapData(mapName);
    
    ludeo_mgr.OpenRoom(mapName);           // Async operation
    ludeo_mgr.AddPlayer(playerId, name);   // ❌ WRONG! Room not open yet!
    
    FinalizeMapLoad();
}
```

**Why this fails:**
- `OpenRoom()` is **asynchronous** - it returns before the room is actually open
- `AddPlayer()` requires an open room - calling it immediately will fail or cause errors
- The DataWriter and Room handles aren't available until the callback fires

**THE CORRECT FLOW:**

```cpp
// ✅ CORRECT - Game code (in Game::StartMap or similar)
void Game::StartMap(const char* mapName) {
    LoadMapData(mapName);
    
    ludeo_mgr.OpenRoom(mapName);  // Only call this from game code
    
    FinalizeMapLoad();
    // AddPlayer happens automatically in the callback chain
}

// ✅ CORRECT - Callback handler (in LudeoManager.cpp)
void LudeoManager::OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data) {
    LudeoManager* mgr = static_cast<LudeoManager*>(data->clientData);
    
    if (data->resultCode == LudeoResult::Success) {
        mgr->m_room_handle = data->room;
        mgr->m_data_writer = data->dataWriter;
        
        // NOW call AddPlayer - room is confirmed open
        mgr->AddPlayer(mgr->m_player_id, mgr->m_player_name);
    }
}

// ✅ CORRECT - More callbacks (in LudeoManager.cpp)
void LudeoManager::OnPlayerAddedCallback(const LudeoRoomAddPlayerCallbackParams* data) {
    // Sets player_added flag, calls TryBeginGameplaySession()
}

void LudeoManager::OnRoomReadyCallback(const LudeoSessionRoomReadyCallbackParams* data) {
    // Sets room_ready flag, calls TryBeginGameplaySession()
}

void LudeoManager::TryBeginGameplaySession() {
    // Only proceeds when BOTH player_added AND room_ready are true
    if (m_player_added && m_room_ready) {
        BeginGameplaySession();
    }
}
```

**The Rule:**
- **🎮 Game Code**: Calls `OpenRoom()` when level loading starts
- **📞 Callbacks**: Handle `AddPlayer()`, `BeginGameplaySession()`
- The SDK callback chain drives the flow automatically

**Integration Point Count:**
- Game code integration points for gameplay session: **1** (OpenRoom only)
- Callback handlers required: **4** (OnRoomOpened, OnPlayerAdded, OnRoomReady, TryBeginGameplaySession)

---

### 6.2 Opening a Room (Level Loading Starts)

**🎮 GAME CODE INTEGRATION POINT**

Call this from your game code when your level/match **starts loading** (not when it's ready).

```cpp
void OnGameplayLoading(const char* levelId, const char* playerId)
{
    // Open a room - this provides the DataWriter
    auto room_params = Ludeo::create<LudeoSessionOpenRoomParams>();
    room_params.roomId = nullptr;  // Auto-generate room ID
    room_params.ludeoId = pending_ludeo_id;  // nullptr if not restoring
    
    LudeoResult result = ludeo_Session_OpenRoom(
        session_handle, &room_params, callback_data, OnRoomOpenedCallback);
    
    // Check result and handle appropriately
}
```

### 6.3 Room Opened Callback

**📞 SDK CALLBACK HANDLER** - SDK calls this when room is ready

This callback is triggered by the SDK after `ludeo_Session_OpenRoom()` completes. This is **NOT** called directly by your game code - it's called by the SDK when the async operation finishes.

```cpp
void OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) {
        // Handle room open failure
        return;
    }
    
    // Store critical handles
    room_handle = data->room;
    data_writer = data->dataWriter;  // CRITICAL: Store DataWriter
    
    // Add player(s) to room - creates GameplaySession handle(s)
    AddPlayerToRoom(player_id);  // ← Trigger player adding from HERE
}
```

### 6.4 Adding Players to Room

**📞 CALLED FROM SDK CALLBACK** - Triggered by `OnRoomOpenedCallback`

**CRITICAL:** You must add **ALL players** that will participate in the gameplay session. For single-player games, this is typically one player. For multiplayer, add each player.

This is typically called from within `OnRoomOpenedCallback` (Section 6.3), not directly from game event handlers.

```cpp
void AddPlayerToRoom(const char* playerId)
{
    auto params = Ludeo::create<LudeoRoomAddPlayerParams>();
    params.playerId = playerId;
    
    LudeoResult result = ludeo_Room_AddPlayer(
        room_handle, &params, callback_data, OnPlayerAddedCallback);
    
    // Check result and handle appropriately
}

void OnPlayerAddedCallback(const LudeoRoomAddPlayerCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) {
        // Handle add player failure
        return;
    }
    
    // Store GameplaySession handle for this player
    gameplay_session_handle = data->gameplaySession;
    player_added = true;
    
    // For multiplayer: Add remaining players
    // For single-player: Check if both conditions met to begin gameplay
    TryBeginGameplaySession();  // ← May trigger gameplay begin from HERE
}
```

### 6.5 Room Ready Notification

**📞 SDK CALLBACK HANDLER** - SDK calls this automatically when room is ready

**CRITICAL:** Before beginning gameplay, you must wait for the **Room Ready** notification. This confirms all players have been added successfully. This notification must be registered **upon session creation**, before any room is opened.

This callback fires automatically from the SDK - it is NOT triggered by game events.

```cpp
// 🎮 GAME CODE: Register during session creation (Section 4)
void RegisterRoomReadyNotification()
{
    auto params = Ludeo::create<LudeoSessionAddNotifyRoomReadyParams>();
    
    LudeoResult result = ludeo_Session_AddNotifyRoomReady(
        session_handle, &params, callback_data, OnRoomReadyCallback);
    
    // Check result and handle appropriately
}

// 📞 SDK CALLBACK: Called automatically by SDK when room ready
void OnRoomReadyCallback(const LudeoSessionRoomReadyCallbackParams* data)
{
    if (data->resultCode == LudeoResult::Success) {
        // Room is ready
        room_ready = true;
        
        // Check if player was already added - if both conditions met, begin gameplay
        TryBeginGameplaySession();  // ← May trigger gameplay begin from HERE
    }
}
```

### 6.6 Beginning Gameplay (After Loading Complete)

**📞 CALLED FROM SDK CALLBACKS** - Triggered when both conditions are met

**PREREQUISITES (both must be true):**
- ✅ Player(s) added to room (`OnPlayerAddedCallback` received)
- ✅ Room Ready notification received (`OnRoomReadyCallback` fired)

**IMPORTANT:** This is called from **SDK callbacks** (Sections 6.4 and 6.5), not directly from game code. Both `OnPlayerAddedCallback` and `OnRoomReadyCallback` call `TryBeginGameplaySession()`, which checks if both conditions are met.

```cpp
void TryBeginGameplaySession()
{
    // Only begin when BOTH conditions are met
    if (!player_added || !room_ready) {
        return;  // Wait for other condition
    }
    
    OnGameplayBegin();  // ← Gameplay begin happens HERE
}

void OnGameplayBegin()
{
    auto params = Ludeo::create<LudeoGameplaySessionBeginParams>();
    
    LudeoResult result = ludeo_GameplaySession_Begin(
        gameplay_session_handle, &params);
    
    if (result == LudeoResult::Success) {
        // Gameplay session is now active
        gameplay_session_active = true;
    } else {
        // Handle begin gameplay failure
    }
}
```

### 6.7 Ending Gameplay

Call this when gameplay ends (level complete, match over, player dies, etc.).

```cpp
void OnGameplayEnd(bool isAbort)
{
    auto params = Ludeo::create<LudeoGameplaySessionEndParams>();
    params.isAbort = isAbort ? LUDEO_TRUE : LUDEO_FALSE;
    
    LudeoResult result = ludeo_GameplaySession_End(
        gameplay_session_handle, &params, callback_data, OnGameplayEndedCallback);
    
    // Check result and handle appropriately
}

void OnGameplayEndedCallback(const LudeoGameplaySessionEndCallbackParams* data)
{
    gameplay_session_active = false;
    
    // CRITICAL: Remove all players before closing room
    RemovePlayerFromRoom(player_id);
}
```

### 6.8 Removing Players from Room

**CRITICAL:** You must remove **ALL players** from the room before closing it. This is the reverse of adding players.

```cpp
void RemovePlayerFromRoom(const char* playerId)
{
    auto params = Ludeo::create<LudeoRoomRemovePlayerParams>();
    params.playerId = playerId;
    
    LudeoResult result = ludeo_Room_RemovePlayer(
        room_handle, &params, callback_data, OnPlayerRemovedCallback);
    
    // Check result and handle appropriately
}

void OnPlayerRemovedCallback(const LudeoRoomRemovePlayerCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) {
        // Handle remove player failure
        return;
    }
    
    // For multiplayer: Remove remaining players
    // For single-player: All players removed, proceed to close room
    
    if (all_players_removed) {
        CloseRoom();
    }
}
```

### 6.9 Closing Room

**PREREQUISITE:** All players must be removed from the room before closing.

```cpp
void CloseRoom()
{
    auto close_params = Ludeo::create<LudeoRoomCloseParams>();
    
    LudeoResult result = ludeo_Room_Close(
        room_handle, &close_params, callback_data, OnRoomClosedCallback);
    
    // Check result and handle appropriately
}

void OnRoomClosedCallback(const LudeoRoomCloseCallbackParams* data)
{
    // Cleanup handles
    room_handle = nullptr;
    data_writer = nullptr;
    gameplay_session_handle = nullptr;
    
    // Ready for next gameplay session
}
```

### 6.10 Integration Points

**KEY CONCEPT:** Only **Room Opening** is called directly from game code. Player adding and gameplay begin are triggered by SDK callbacks in response to async operations.

```cpp
// Example: In your level/scene manager

// 🎮 GAME CODE INTEGRATION POINT
void LoadLevel(const char* levelId)
{
    // Start loading...
    
#if LUDEO_SDK_ENABLED
    // Open room when level begins loading
    // This triggers callback chain: OnRoomOpenedCallback → AddPlayerToRoom → OnPlayerAddedCallback + OnRoomReadyCallback → TryBeginGameplaySession
    OnGameplayLoading(levelId, GetCurrentPlayerId());
#endif
    
    // Continue loading...
    // NOTE: Gameplay session begin happens asynchronously via callbacks, not here
}

// ❌ DO NOT CALL FROM GAME CODE - Triggered by callbacks
// void OnGameplayBegin() is called from TryBeginGameplaySession()
// which is called from OnPlayerAddedCallback and OnRoomReadyCallback

// 🎮 GAME CODE INTEGRATION POINT
void OnLevelEnd(bool playerQuit)
{
#if LUDEO_SDK_ENABLED
    // End gameplay, remove players, close room
    OnGameplayEnd(playerQuit);
#endif
    
    // Unload level...
}
```

**→ See:** [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) for state tracking during gameplay  
**→ See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) for LudeoSelected handling

---

## 7. Session Cleanup and Shutdown

### 7.1 Releasing Session

Release the Game Session when the game is shutting down:

```cpp
void ReleaseSession()
{
    // Ensure room is closed first if still open
    if (room_handle != nullptr) {
        // Close room before releasing session
    }
    
    auto params = Ludeo::create<LudeoSessionReleaseParams>();
    
    LudeoResult result = ludeo_Session_Release(
        session_handle, &params, callback_data, OnSessionReleasedCallback);
    
    // Check result and handle appropriately
}

void OnSessionReleasedCallback(const LudeoSessionReleaseCallbackParams* data)
{
    session_handle = nullptr;
    session_active = false;
    
    // Session released successfully
}
```

### 7.2 SDK Shutdown

Shutdown the SDK when the game exits:

```cpp
void Shutdown()
{
    // Release session first
    if (session_handle != nullptr) {
        ReleaseSession();
        // May need to wait for callback depending on your implementation
    }
    
    // Shutdown SDK
    ludeo_Shutdown();
}
```

### 7.3 Integration Point: Game Exit

```cpp
// Example: In your game's shutdown code

void GameShutdown()
{
#if LUDEO_SDK_ENABLED
    ShutdownLudeoSDK();
#endif
    
    // Shutdown other systems...
}
```

---

## 8. Integration Points Summary

### Complete Integration Checklist

| Game Event | Ludeo Action | Function to Call | Called From | Notes |
|------------|--------------|------------------|-------------|-------|
| Game launch | Initialize SDK | `Initialize()` | 🎮 Game code | Early in startup |
| Game ready | Activate session | `ActivateSession()` | 🎮 Game code | After init, before menu |
| Every frame | Process callbacks | `ludeo_Tick()` | 🎮 Game code | In main loop |
| **Level/match loading** | **Open room** | **`OnGameplayLoading()`** | **🎮 Game code** | **When loading starts** |
| Room opened | Add player(s) | `AddPlayerToRoom()` | 📞 SDK callback | Add ALL players |
| Player added | Track condition | `OnPlayerAddedCallback()` | 📞 SDK callback | Set `player_added = true` |
| Room ready | Track condition | `OnRoomReadyCallback()` | 📞 SDK callback | Set `room_ready = true` |
| Both conditions met | Begin gameplay | `TryBeginGameplaySession()` | 📞 SDK callback | Only when player_added AND room_ready |
| Gameplay ends | End gameplay | `OnGameplayEnd()` | 🎮 Game code | Match over, level complete |
| After end | Remove player(s) | `RemovePlayerFromRoom()` | 📞 SDK callback | Remove ALL players |
| All players removed | Close room | `CloseRoom()` | 📞 SDK callback | Final cleanup |
| Game shutdown | Release & shutdown | `Shutdown()` | 🎮 Game code | During exit |

**Legend:**
- 🎮 **Game code** = Call from your game's event handlers
- 📞 **SDK callback** = Called automatically by SDK in response to async operations

### State Machine

```
UNINITIALIZED
    │
    ├─► Initialize() ──► INITIALIZED
    │                        │
    │                        ├─► ActivateSession() ──► SESSION_ACTIVE
    │                                                        │
    │                                                        ├─► OnGameplayLoading()
    │                                                        │       │
    │                                                        │       ├─► Room Opens
    │                                                        │       │       │
    │                                                        │       │       ├─► Add Player(s)
    │                                                        │       │               │
    │                                                        │       │               ├─► Room Ready
    │                                                        │       │                       │
    │                                                        │       │                       ├─► READY_FOR_GAMEPLAY
    │                                                        │       │                               │
    │                                                        │       │                               ├─► OnGameplayBegin()
    │                                                        │       │                                       │
    │                                                        │       │                                       ├─► GAMEPLAY_ACTIVE
    │                                                        │       │                                               │
    │                                                        │       │                                               ├─► OnGameplayEnd()
    │                                                        │       │                                                       │
    │                                                        │       │                                                       ├─► Remove Player(s)
    │                                                        │       │                                                               │
    │                                                        │       │                                                               ├─► Close Room
    │                                                        │       └───────────────────────────────────────────────────────────────┘
    │                                                        │       (Can repeat for multiple gameplay sessions)
    │                                                        │
    │                                                        ├─► Shutdown() ──► SHUTTING_DOWN
    │                                                                               │
    └────────────────────────────────────────────────────────────────────────────► SHUTDOWN
```

---

## 9. Timeline and Flow Diagrams

### Full Lifecycle Timeline

```
┌──────────────────────────────────────────────────────────────────┐
│ GAME LAUNCH                                                      │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_Initialize()                                               │
│ ludeo_Session_Create()                                           │
│ ludeo_Session_AddNotifyLudeoSelected()                          │
│ ludeo_Session_Activate() ──────────► [ASYNC]                    │
│     └─► OnSessionActivatedCallback() ──► Game Session Active    │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LEVEL/MATCH STARTS LOADING                                       │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_Session_OpenRoom() ──────────► [ASYNC]                    │
│     └─► OnRoomOpenedCallback()                                  │
│         └─► DataWriter available                                │
│         └─► ludeo_Room_AddPlayer() ──────────► [ASYNC]         │
│             └─► OnPlayerAddedCallback()                         │
│                 └─► GameplaySession handle ready                │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LOADING COMPLETE, GAMEPLAY BEGINS                                │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_GameplaySession_Begin() [SYNC]                             │
│     └─► Returns immediately - full tracking active              │
│                                                                  │
│ [TRACK GAMEPLAY - Use DataWriter to capture state]              │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ GAMEPLAY ENDS                                                    │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_GameplaySession_End() ──────────► [ASYNC]                 │
│     └─► OnGameplayEndedCallback()                               │
│         └─► ludeo_Room_RemovePlayer() ──────────► [ASYNC]      │
│             └─► OnPlayerRemovedCallback()                       │
│                 └─► ludeo_Room_Close() ──────────► [ASYNC]     │
│                     └─► OnRoomClosedCallback()                  │
│                         └─► Room closed, ready for next session │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼ (Can repeat for multiple gameplay sessions)
                            │
┌──────────────────────────────────────────────────────────────────┐
│ GAME SHUTDOWN                                                    │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_Session_Release() ──────────► [ASYNC]                     │
│     └─► OnSessionReleasedCallback()                             │
│         └─► ludeo_Shutdown()                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Callback Chain

```
Initialize()
    │
    └─► Session_Create() [SYNC]
        │
        └─► AddNotifyLudeoSelected() [SYNC]
            │
            └─► Session_Activate() [ASYNC]
                    │
                    └─► OnSessionActivatedCallback()
                            │
                            └─► [Ready for gameplay sessions]
                                    │
                                    └─► OpenRoom() [ASYNC]
                                            │
                                            └─► OnRoomOpenedCallback()
                                                    │
                                                    └─► AddPlayer() [ASYNC] (repeat for all players)
                                                            │
                                                            └─► OnPlayerAddedCallback()
                                                                    │
                                                                    └─► TryBeginGameplaySession()
                                                                            │
                                                                            (waits for OnRoomReadyCallback if not yet received)
                                                                            │
                                                    OnRoomReadyCallback() ──┴─► (if both conditions met)
                                                                                    │
                                                                                    └─► GameplaySession_Begin() [SYNC]
                                                                                    │
                                                                                    └─► ... gameplay ...
                                                                                                    │
                                                                                                    └─► GameplaySession_End() [ASYNC]
                                                                                                            │
                                                                                                            └─► OnGameplayEndedCallback()
                                                                                                                    │
                                                                                                                    └─► RemovePlayer() [ASYNC]
                                                                                                                            │
                                                                                                                            └─► OnPlayerRemovedCallback()
                                                                                                                                    │
                                                                                                                                    └─► Room_Close() [ASYNC]
```

---

## 10. Error Handling

### General Principles

1. **Always check return values** for all SDK operations
2. **Log errors** but don't crash the game
3. **Gracefully degrade** - game should work without Ludeo
4. **Clean up** partial state on errors

### Error Handling Pattern

```cpp
LudeoResult result = ludeo_Session_OpenRoom(...);
if (result != LudeoResult::Success) {
    // Log error appropriately for your game
    // Continue game execution - don't crash
    // Set flag that Ludeo is unavailable for this session
    ludeo_available = false;
    return;
}
```

### Common Error Scenarios

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| Initialization fails | Log warning, continue without Ludeo |
| Session activation fails | Log error, disable Ludeo features |
| Room open fails | Skip tracking for this gameplay session |
| Player add fails | Close room, retry or skip session |
| Gameplay begin fails | Log error, continue gameplay without tracking |

### Defensive Checks

```cpp
// Always check if handles are valid before using
if (data_writer == nullptr) {
    // DataWriter not available - skip operation
    return;
}

if (!session_active) {
    // Session not active - cannot start gameplay
    return;
}

if (room_handle != nullptr) {
    // Room already open - close previous room first
    return;
}
```

---

## 11. Testing and Validation

### Lifecycle Test Checklist

```markdown
## SDK Lifecycle Tests

### Initialization
- [ ] SDK initializes without errors
- [ ] Session handle created successfully
- [ ] Notifications registered
- [ ] Activation starts successfully
- [ ] OnSessionActivatedCallback receives Success

### Gameplay Session
- [ ] Room opens when gameplay loads
- [ ] OnRoomOpenedCallback receives DataWriter
- [ ] All players added successfully
- [ ] OnPlayerAddedCallback receives GameplaySession handle for each player
- [ ] OnRoomReadyCallback fires (registered at session creation via ludeo_Session_AddNotifyRoomReady)
- [ ] GameplaySession begins after room ready confirmed (synchronous call)
- [ ] GameplaySession_Begin returns Success

### Cleanup
- [ ] GameplaySession ends when gameplay ends
- [ ] All players removed from room
- [ ] OnPlayerRemovedCallback fires for each player
- [ ] Room closes after all players removed
- [ ] Multiple gameplay sessions work correctly (play multiple levels)
- [ ] Session releases on shutdown
- [ ] SDK shuts down cleanly

### Error Handling
- [ ] Failed initialization doesn't crash game
- [ ] Game works without Ludeo if SDK unavailable
- [ ] Null checks prevent crashes
- [ ] Errors logged clearly
```

### Expected Log Output Example

```
SDK initialized
Session created
Session activation started (async)
Game Session activated - ready for gameplay

Opening room for level: <level_id>
Room opened - DataWriter available
Adding player to room: <player_id>
Player added - GameplaySession handle received
Room ready - all players added
Beginning gameplay session - tracking active

... gameplay happens ...

Ending gameplay session
Gameplay Session ended
Removing player from room: <player_id>
Player removed
Closing room
Room closed - ready for next session

... can repeat for multiple gameplay sessions ...

Releasing session
Session released
SDK shutdown complete
```

### Validation Commands

```cpp
// Example: Add debug commands to validate state
void PrintLudeoStatus()
{
    // Print status for debugging:
    // - Is SDK initialized
    // - Is session active
    // - Is room open
    // - Is gameplay session active
    // - DataWriter handle validity
    // - DataReader handle validity (if restoring)
}
```

---

## Related Documentation

- **⚠️ Critical:** [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Non-negotiable rules
- **📖 Prerequisites:** [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - SDK API patterns
- **🔗 Related:** [04-BUILD-INTEGRATION.md](./04-BUILD-INTEGRATION.md) - Build system setup
- **🔗 Next Steps:** [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Object tracking during gameplay
- **🔗 Advanced:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - LudeoSelected and restoration

---

**Last Updated:** December 2025  
**Version:** 1.0

