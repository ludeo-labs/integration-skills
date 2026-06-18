# 03-SDK-FUNDAMENTALS.md - Ludeo SDK Core Concepts

> **Purpose:** Foundational knowledge of how Ludeo SDK works  
> **For:** AI agents and developers integrating Ludeo SDK  
> **Read Time:** 15 minutes  
> **When to Load:** Before any implementation work

**Last Updated:** December 2025

---

## 📋 **Table of Contents**

1. [What is Ludeo SDK?](#1-what-is-ludeo-sdk)
2. [Core Concepts](#2-core-concepts)
3. [SDK Architecture](#3-sdk-architecture)
4. [API Pattern Overview](#4-api-pattern-overview)
5. [Data Type Mapping](#5-data-type-mapping)
6. [Handle Management](#6-handle-management)
7. [Callback Pattern](#7-callback-pattern)
8. [Threading Model](#8-threading-model)

---

## 1. What is Ludeo SDK?

### Purpose

Ludeo SDK enables games to create **playable moments** - game states that can be:
- **Captured** during gameplay (tracking)
- **Stored** as "Ludeos" on Ludeo platform
- **Shared** with other players
- **Restored** for playback (restoration)

### Key Capabilities

**Tracking:**
- Record game object states
- Track discrete gameplay actions
- Capture environment metadata
- Record player interactions

**Restoration:**
- Recreate complete game state
- Restore all objects and properties
- Replay gameplay moments
- Enable challenges and objectives

**Platform Integration:**
- Cloud storage of Ludeos
- Social sharing features
- Leaderboards and scoring
- Video capture overlay

---

## 2. Core Concepts

### 2.1 Game Session vs Gameplay Session

**Game Session:**
- Activated ONCE when game loads
- Persists throughout game's lifetime
- Released when game shuts down
- Think: "The game is running"

**Gameplay Session:**
- Created for EACH gameplay instance (level, match, mission)
- Multiple Gameplay Sessions per Game Session
- Begins when gameplay starts, ends when gameplay ends
- Think: "A playable moment"
```
Game Lifecycle:
Launch → [Game Session Active] → Shutdown
           ↓
           Level 1 → [Gameplay Session 1]
           Level 2 → [Gameplay Session 2]
           Level 3 → [Gameplay Session 3]
```

### 2.2 Room

A **Room** is a container for a gameplay instance:
- Created when level/match loads
- Provides the **DataWriter** for tracking
- Multiple players can be in one Room (multiplayer)
- Closed when gameplay ends
```
Room = Container for gameplay
  ├── DataWriter (for tracking)
  ├── Players (one or more)
  └── Gameplay Sessions (one per player)
```

### 2.3 DataWriter vs DataReader

**DataWriter:**
- Used during **tracking** (capture)
- Writes game state to Ludeo platform
- Active during Gameplay Session
- One per Room

**DataReader:**
- Used during **restoration** (playback)
- Reads game state from Ludeo platform
- Obtained when user selects a Ludeo
- Contains snapshot of tracked state
```
Capture:  Game → DataWriter → Ludeo Platform
Playback: Ludeo Platform → DataReader → Game
```

### 2.4 LudeoObjectId

Every tracked game object gets a **LudeoObjectId**:
- Unique identifier within a Ludeo
- Used to organize tracked attributes
- Required for all Set/Get operations
- Type: `uint64_t`
```cpp
LudeoObjectId player_id;      // Player's Ludeo ID
LudeoObjectId enemy_id;       // Enemy's Ludeo ID
LudeoObjectId projectile_id;  // Projectile's Ludeo ID
```

### 2.5 Attributes

**Attributes** are named properties of objects:
- Identified by **string names** (not IDs!)
- Typed (float, int, bool, vec3, etc.)
- Updated via DataWriter during tracking
- Retrieved via DataReader during restoration
```cpp
// Setting attributes (tracking)
ludeo_DataWriter_SetFloat("health", 75.0f);
ludeo_DataWriter_SetVec3Float("position", pos_array);

// Getting attributes (restoration)
float health;
ludeo_DataReader_GetFloat("health", &health);
```

### 2.6 Actions

**Actions** are discrete gameplay events:
- NOT continuous state (use attributes for that)
- Fire once at a moment in time
- Enable Ludeo objectives ("Get 5 kills")
- Enable Ludeo scoring (100 points per kill)
```cpp
// Actions = Events
LUDEO_ACTION("Kill");           // Fired once when enemy killed
LUDEO_ACTION("CollectCoin");    // Fired once when coin collected

// Attributes = Continuous state
LUDEO_CAPTURE_FLOAT(this, "player", "health", 85.0f);  // Updated continuously
```

### 2.7 LudeoSelected Event

**LudeoSelected** occurs when a user selects a Ludeo to play:
- Can happen AT ANY TIME (menu, gameplay, loading, cutscene)
- Game must interrupt current activity
- Game must load appropriate level
- Game must restore state from DataReader
- Game must pause and wait for player input

---

## 3. SDK Architecture

### 3.1 Layered Design
```
┌─────────────────────────────────────┐
│         Your Game Code              │
├─────────────────────────────────────┤
│    Ludeo Integration Layer          │
│  (LudeoManager, Capture Macros)     │
├─────────────────────────────────────┤
│       Ludeo SDK (C API)             │
├─────────────────────────────────────┤
│      Ludeo Platform Services        │
│  (Cloud Storage, Video, Overlay)    │
└─────────────────────────────────────┘
```

### 3.2 Component Separation

**Session Management:**
- Handles SDK lifecycle
- Manages Game Session
- Registers notifications

**Room Management:**
- Creates Rooms for gameplay
- Manages DataWriter access
- Handles player registration

**Tracking:**
- Object registration
- Attribute updates
- Action events

**Restoration:**
- LudeoSelected handling
- DataReader operations
- State recreation

---

## 4. API Pattern Overview

### 4.1 C API with Handles

SDK uses **opaque handle types**:
```cpp
typedef struct LudeoSessionImpl* LudeoHSession;
typedef struct LudeoRoomImpl* LudeoHRoom;
typedef struct LudeoDataWriterImpl* LudeoHDataWriter;
typedef struct LudeoDataReaderImpl* LudeoHDataReader;
typedef struct LudeoGameplaySessionImpl* LudeoHGameplaySession;
```

Handles are:
- Pointers to opaque structs
- Created by SDK functions
- Passed to subsequent operations
- Released when done

### 4.2 Synchronous vs Asynchronous

**Synchronous operations** (return immediately):
```cpp
ludeo_Initialize()              // Init SDK
ludeo_Tick()                    // Process callbacks
ludeo_DataWriter_SetFloat()     // Set attribute
ludeo_DataWriter_EnterObject()  // Enter context
```

**Asynchronous operations** (require callbacks):
```cpp
ludeo_Session_Activate()        // Activate Game Session
ludeo_Session_OpenRoom()        // Open Room
ludeo_Room_AddPlayer()          // Add player
ludeo_GameplaySession_Begin()   // Begin gameplay
ludeo_GameplaySession_End()     // End gameplay
ludeo_Room_Close()              // Close Room
ludeo_Session_GetLudeo()        // Fetch Ludeo data
```

**Critical:** Async operations return immediately. Use callbacks to know when complete!

### 4.3 Parameter Structs

All operations use versioned parameter structs:
```cpp
LudeoSessionActivateParams params = {};
params.apiVersion = LUDEO_SESSION_ACTIVATE_API_LATEST;  // REQUIRED!
params.platformUrl = "https://services.ludeo.com";
params.apiKey = "your-api-key";
params.gameVersion = "1.0.0";
params.windowHandle = hwnd;

ludeo_Session_Activate(session, &params, clientData, callback);
```

**Always set `apiVersion` to `*_API_LATEST`!**

### 4.4 Result Codes

All operations return `LudeoResult`:
```cpp
enum LudeoResult {
    Success = 0,
    InvalidArgument,
    NotReady,
    Timeout,
    NetworkError,
    // ... more
};
```

**Always check return values!**

---

> **⚠️ Critical SDK Rules:** See [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) for all mandatory rules (macro guards, return value checking, Enter/Leave pairing, etc.)

---

## 5. Data Type Mapping

### 6.1 Type Correspondence

| C++ Type | SDK Set Function | SDK Get Function | Notes |
|----------|------------------|------------------|-------|
| `float` | `SetFloat()` | `GetFloat()` | Single precision |
| `int32_t` | `SetInt32()` | `GetInt32()` | Signed 32-bit |
| `uint32_t` | `SetUInt32()` | `GetUInt32()` | Unsigned 32-bit |
| `uint64_t` | `SetUInt64()` | `GetUInt64()` | For IDs, large values |
| `bool` | `SetBool()` | `GetBool()` | Use `LUDEO_TRUE`/`LUDEO_FALSE` |
| `Vec3` | `SetVec3Float()` | `GetVec3Float()` | Pass `float[3]` array |
| `Vec4/Quat` | `SetVec4Float()` | `GetVec4Float()` | Pass `float[4]` array |
| `const char*` | `SetString()` | `GetString()` | Null-terminated string |

### 6.2 Usage Examples

**Float:**
```cpp
float health = 85.0f;
ludeo_DataWriter_SetFloat("health", health);

// Restoration
float restored_health;
if (ludeo_DataReader_GetFloat("health", &restored_health)) {
    player->SetHealth(restored_health);
}
```

**Integer:**
```cpp
int32_t score = 1500;
ludeo_DataWriter_SetInt32("score", score);

// Restoration
int32_t restored_score;
if (ludeo_DataReader_GetInt32("score", &restored_score)) {
    player->SetScore(restored_score);
}
```

**Boolean:**
```cpp
bool is_dead = true;
ludeo_DataWriter_SetBool("is_dead", is_dead ? LUDEO_TRUE : LUDEO_FALSE);

// Restoration
LudeoBool restored_dead;
if (ludeo_DataReader_GetBool("is_dead", &restored_dead)) {
    bool is_dead = (restored_dead == LUDEO_TRUE);
    player->SetDead(is_dead);
}
```

**Vec3 (Position):**
```cpp
Vec3 position = player->GetPosition();
float pos[3] = {position.x, position.y, position.z};
ludeo_DataWriter_SetVec3Float("position", pos);

// Restoration
float restored_pos[3];
if (ludeo_DataReader_GetVec3Float("position", restored_pos)) {
    player->SetPosition(Vec3(restored_pos[0], restored_pos[1], restored_pos[2]));
}
```

**Vec4 (Quaternion):**
```cpp
Quat rotation = player->GetRotation();
float rot[4] = {rotation.x, rotation.y, rotation.z, rotation.w};
ludeo_DataWriter_SetVec4Float("rotation", rot);

// Restoration
float restored_rot[4];
if (ludeo_DataReader_GetVec4Float("rotation", restored_rot)) {
    player->SetRotation(Quat(restored_rot[0], restored_rot[1], restored_rot[2], restored_rot[3]));
}
```

**String:**
```cpp
const char* name = "PlayerOne";
ludeo_DataWriter_SetString("name", name);

// Restoration
char restored_name[256];
if (ludeo_DataReader_GetString("name", restored_name, sizeof(restored_name))) {
    player->SetName(restored_name);
}
```

**Uint64 (IDs):**
```cpp
uint64_t owner_id = entity->GetOwnerID();
ludeo_DataWriter_SetUInt64("owner_id", owner_id);

// Restoration
uint64_t restored_owner_id;
if (ludeo_DataReader_GetUInt64("owner_id", &restored_owner_id)) {
    Player* owner = PlayerManager::Get().FindByID(restored_owner_id);
    entity->SetOwner(owner);
}
```

---

## 6. Handle Management

### 7.1 Handle Lifecycle

**Handles are created and managed by SDK:**
```cpp
// Session
LudeoHSession session = nullptr;
ludeo_Session_Create(&params, &session);  // SDK creates
// ... use session
ludeo_Session_Release(session);           // SDK releases

// DataWriter (obtained from Room callback)
LudeoHDataWriter writer = nullptr;
// SDK provides in OpenRoom callback
void OnRoomOpened(const LudeoSessionOpenRoomCallbackParams* data) {
    writer = data->dataWriter;  // SDK gives us the handle
}

// DataReader (obtained from GetLudeo callback)
LudeoHDataReader reader = nullptr;
void OnLudeoDataReceived(const LudeoSessionGetLudeoCallbackParams* data) {
    reader = data->dataReader;  // SDK gives us the handle
}
```

### 7.2 Handle Storage

**Store handles in manager class:**
```cpp
class LudeoManager {
private:
    LudeoHSession m_session_handle = nullptr;
    LudeoHRoom m_room_handle = nullptr;
    LudeoHGameplaySession m_gameplay_session_handle = nullptr;
    LudeoHDataWriter m_data_writer = nullptr;
    LudeoHDataReader m_data_reader = nullptr;
    
public:
    LudeoHDataWriter GetDataWriter() const { return m_data_writer; }
    LudeoHDataReader GetDataReader() const { return m_data_reader; }
};
```

### 7.3 Handle Validity

**Always check handles before use:**
```cpp
LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
if (writer == nullptr) {
    return;  // Not ready for tracking
}

// Safe to use
ludeo_DataWriter_SetCurrent(writer);
```

---

## 7. Callback Pattern

### 8.1 Callback Function Signature

All callbacks follow this pattern:
```cpp
void MyCallback(const LudeoXxxCallbackParams* data)
{
    // Check result
    if (data->resultCode != LudeoResult::Success) {
        LogError("Operation failed: %d", data->resultCode);
        return;
    }
    
    // Retrieve client data (your context)
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    // Handle success
    // ...
}
```

### 8.2 Client Data Pattern

Pass `this` as client data to access instance in callback:
```cpp
class LudeoManager {
public:
    void ActivateSession() {
        LudeoSessionActivateParams params = {};
        params.apiVersion = LUDEO_SESSION_ACTIVATE_API_LATEST;
        // ... other params
        
        ludeo_Session_Activate(
            m_session_handle,
            &params,
            this,                          // Pass instance pointer
            OnSessionActivatedCallback
        );
    }
    
private:
    static void OnSessionActivatedCallback(
        const LudeoSessionActivateCallbackParams* data)
    {
        if (info->resultCode != LudeoResult::Success)
        {
	        LogCallbackError("Session activation", info->resultCode);
	        return;
        }
        auto& manager = LudeoManager::Instance();
        
        if (data->resultCode == LudeoResult::Success) {
            manager->m_session_active = true;
        }
    }
    
    bool m_session_active = false;
    LudeoHSession m_session_handle = nullptr;
};
```

**Pattern:** Callback must be `static`, pass `this` as clientData, cast back in callback.

### 8.3 Common Callbacks

| Operation | Callback Type | Data Available |
|-----------|---------------|----------------|
| Session Activate | `LudeoSessionActivateCallback` | `resultCode` |
| Open Room | `LudeoSessionOpenRoomCallback` | `room`, `dataWriter` |
| Add Player | `LudeoRoomAddPlayerCallback` | `gameplaySession` |
| Begin Gameplay | `LudeoGameplaySessionBeginCallback` | `resultCode` |
| End Gameplay | `LudeoGameplaySessionEndCallback` | `resultCode` |
| Close Room | `LudeoRoomCloseCallback` | `resultCode` |
| Get Ludeo | `LudeoSessionGetLudeoCallback` | `dataReader` |
| Ludeo Selected | `LudeoSessionLudeoSelectedCallback` | `ludeoId` |
| Player Ready | `LudeoGameplaySessionPlayerReadyCallback` | `resultCode` |

---

## 8. Threading Model

### 8.1 SDK Thread Safety

**SDK operations are NOT inherently thread-safe.**

Call SDK functions from a **consistent thread** (typically main thread).

### 8.2 Tick Requirement

**`ludeo_Tick()` MUST be called once per frame on the same thread:**
```cpp
void GameLoop::Update() {
    // Game logic
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().Tick();  // Process callbacks
#endif
    
    // Rendering
}
```

### 8.3 Thread-Safe Integration

**If game uses multiple threads, queue SDK operations:**
```cpp
class LudeoManager {
    std::mutex m_queue_mutex;
    std::vector<std::function<void()>> m_pending_operations;
    
public:
    // Called from any thread
    void QueueOperation(std::function<void()> op) {
        std::lock_guard<std::mutex> lock(m_queue_mutex);
        m_pending_operations.push_back(std::move(op));
    }
    
    // Called from main thread during Tick
    void Tick() {
        ProcessQueue();  // Execute queued operations
        ludeo_Tick();    // SDK tick
    }
    
private:
    void ProcessQueue() {
        std::vector<std::function<void()>> ops;
        {
            std::lock_guard<std::mutex> lock(m_queue_mutex);
            ops.swap(m_pending_operations);
        }
        
        for (auto& op : ops) {
            op();
        }
    }
};

// Usage from any thread
LudeoManager::Get().QueueOperation([this]() {
    LUDEO_CAPTURE_FLOAT(this, "entity", "health", m_health);
});
```

---

## 📚 **Related Documentation**

**For detailed API signatures:**
- [12-SDK-API-REFERENCE.md](./12-SDK-API-REFERENCE.md) - Links to official API docs

**For implementation guidance:**
- [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) - SDK lifecycle integration
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Tracking implementation
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - Restoration implementation
- [08-CODE-PATTERNS.md](./08-CODE-PATTERNS.md) - Macro helpers and patterns

**For requirements:**
- [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Must-follow rules

**For troubleshooting:**
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) - Common errors and solutions

---

**Key Takeaways:**
1. Use attribute names (strings), not IDs
2. Async operations need callbacks
3. Always pair Enter/Leave (use RAII helpers)
4. Release resources when done

→ **For mandatory rules (error handling, macro guards, etc.):** See [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md)