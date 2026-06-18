> **UE CAVEAT:** The "Common Pitfalls" table in this document references macro guards (`#ifdef`). For Unreal Engine, use plugin-based architecture instead. All other workflow guidance is applicable.

---

# 01-AI-AGENT-GUIDE.md - How AI Agents Should Use This Documentation

> **For:** AI agents performing Ludeo SDK integration  
> **Purpose:** Integration strategy, workflow guidance, and best practices  
> **Read Time:** 10 minutes

**Last Updated:** December 2025

---

## 📋 **Table of Contents**

1. [Overview: Your Role](#overview-your-role)
2. [User-Pending Integration Model](#user-pending-integration-model)
3. [The Integration Workflow](#the-integration-workflow)
4. [Context Management Strategy](#context-management-strategy)
5. [Research-First Approach](#research-first-approach)
6. [Decision Framework](#decision-framework)
7. [Code Generation Principles](#code-generation-principles) *(brief - see 03-SDK-FUNDAMENTALS for details)*
8. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid) *(workflow pitfalls only)*
9. [Checkpoints and Validation](#checkpoints-and-validation)
10. [When to Ask for Help](#when-to-ask-for-help)

---

## 1. Overview: Your Role

### What You're Doing
You are integrating the **Ludeo SDK** into a game to enable:
- **Capturing** gameplay state (tracking)
- **Storing** gameplay moments (Ludeos)
- **Restoring** gameplay state (playback)
- **Recording** gameplay actions for objectives/scoring

### Success Criteria
A successful integration means:
- ✅ Game compiles with SDK enabled AND disabled
- ✅ Players can capture gameplay moments
- ✅ Players can play back captured moments
- ✅ Game remains stable with SDK errors (graceful degradation)
- ✅ Actions enable objectives and scoring

### Your Constraints
- **Minimal intrusion:** Game code should work without SDK
- **Macro-based:** All SDK code behind `#if LUDEO_SDK_ENABLED`
- **No crashes:** SDK errors log warnings, never crash game
- **Complete capture:** Track ALL gameplay-affecting state

---

## 2. User-Pending Integration Model

### Integration Philosophy

This integration follows a **user-pending, step-by-step** approach where:
- **Agent proposes** specific changes based on plan and context
- **User reviews** changes via preview/diff
- **User confirms** before agent executes changes
- **User can choose** to implement themselves instead

### The Propose → Confirm → Execute Cycle

Each integration step follows this pattern:

```
1. AGENT: Analyzes codebase + context
2. AGENT: Proposes specific change (e.g., "Create LudeoConfig.h")
3. AGENT: Shows preview/diff of proposed change
4. AGENT: Asks: "Should I proceed with this change?"
5. USER: Confirms OR requests modification OR implements manually
6. AGENT: Executes (if confirmed) OR adjusts proposal
7. AGENT: Moves to next step
```

### Agent Responsibilities

**Before proposing changes:**
- Load relevant documentation files for current phase
- Analyze existing codebase structure
- Identify exact file paths and integration points
- Prepare complete, working code

**When proposing changes:**
- Explain WHAT you're doing and WHY
- Show WHERE changes will be made (file paths, line numbers)
- Provide full preview/diff of changes
- Highlight any assumptions or decisions made

**Example proposal format:**
```
Step 1.3: Create LudeoConfig.h

File: src/core/ludeo/LudeoConfig.h (new file)
Purpose: Define conditional compilation macros for SDK integration

Changes:
- Create new file with macro definitions
- Define LUDEO_SDK_ENABLED check
- Define helper macros (LUDEO_CODE, LUDEO_INCLUDE)
- Provide fallback types when SDK disabled

Preview:
[show complete file contents or diff]

Should I create this file?
```

### User Options at Each Step

The user can:
1. ✅ **Approve** - Agent creates/modifies files automatically
2. ✏️ **Modify** - User provides feedback, agent revises proposal
3. 🔧 **Manual** - User implements this step themselves
4. ⏭️ **Skip** - Skip this step (not recommended)
5. ❌ **Stop** - Pause integration to reassess

### Minute Phase Separation

Each major phase is broken into **minute steps**:
- Phase 1 (Build Setup) → 5-6 individual steps
- Phase 2 (SDK Lifecycle) → 8-10 individual steps
- Phase 3 (Gameplay Session) → 6-8 individual steps
- And so on...

**Each step** is a separate propose-confirm-execute cycle.

---

## 3. The Integration Workflow

### Stage 0: Preparation (Before Writing Code)

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md` (always in context)
- `02-RESEARCH-TEMPLATE.md` (complete the questionnaire)

**Your tasks:**
1. **Analyze the game architecture**
   - Identify game loop, initialization, shutdown
   - Find state machines, managers, singletons
   - Document threading model
   
2. **Inventory all game objects**
   - List every object type that affects gameplay
   - Document their properties and relationships
   - Identify creation/destruction patterns

3. **Identify gameplay actions**
   - What are the exciting moments? (kills, pickups, objectives)
   - What events should trigger actions?
   - What actions would make good objectives?

4. **Map game flow**
   - How does game initialize?
   - How do levels/scenes load?
   - When does gameplay actually begin?
   - How does gameplay end?
   - How can LudeoSelected interrupt any state?

5. **Find integration points**
   - Where to initialize SDK?
   - Where to activate Game Session?
   - Where to open/close Rooms?
   - Where to begin/end GameplaySession?

**Output:** Completed research document (save as `GAME_ANALYSIS.md`)

**Validation Checkpoint:**
- [ ] I can explain the game's architecture
- [ ] I have a complete object inventory
- [ ] I know all gameplay actions
- [ ] I've identified all integration points
- [ ] I understand game flow and state management

---

### Stage 0 Continued: Build System Setup

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md` (keep in context)
- `04-BUILD-INTEGRATION.md`
- `03-SDK-FUNDAMENTALS.md` (reference)

**Integration Steps (each requires user confirmation):**

#### Step 0.1: Verify Prerequisites
**Agent action:** Analyze and report
- Check if Ludeo SDK exists in expected location
- Identify build system (CMake, VS, Makefile, Unity, Unreal)
- Locate main build configuration file
- Identify target executable/library name
- Report findings to user

**User confirms:** Prerequisites verified OR provides corrections

---

#### Step 0.2: Create Ludeo Directory Structure
**Agent action:** Create folders
- Create `src/core/ludeo/` (or game-appropriate path)
- Verify SDK location in `external/ludeo/LudeoCoreSDK_X_X_X/`

**Preview:** Show directory structure to be created  
**User confirms:** Proceed OR adjust paths

---

#### Step 0.3: Create LudeoConfig.h
**Agent action:** Generate configuration header
- Create `src/core/ludeo/LudeoConfig.h`
- Define `LUDEO_SDK_ENABLED` macro with fallback
- Define helper macros (`LUDEO_CODE`, `LUDEO_INCLUDE`)
- Provide fallback types for SDK-disabled builds
- Adapt logging macros to game's logging system

**Preview:** Show complete file contents (150-200 lines)  
**User confirms:** Create file OR request modifications

---

#### Step 0.4: Add SDK Option to Build System
**Agent action:** Modify build configuration (CMake example)
- Add `option(LUDEO_SDK_ENABLED ...)` near top of CMakeLists.txt
- Set SDK version and paths
- Add platform-specific configuration
- Add path verification

**Preview:** Show diff of CMakeLists.txt changes (~50 lines added)  
**User confirms:** Apply changes OR adjust configuration

---

#### Step 0.5: Configure Target with SDK
**Agent action:** Link SDK to game target
- Add `target_compile_definitions` for LUDEO_SDK_ENABLED
- Add `target_include_directories` for SDK headers
- Add `target_link_libraries` for SDK libraries
- Add post-build command to copy DLLs/SOs

**Preview:** Show target configuration changes (~30 lines)  
**User confirms:** Apply changes

---

#### Step 0.6: Test Compilation (SDK Enabled)
**Agent action:** Propose build command
- Show command: `cmake .. -DLUDEO_SDK_ENABLED=ON`
- Ask user to run build OR agent runs if possible

**User confirms:** Build succeeded OR reports errors

---

#### Step 0.7: Test Compilation (SDK Disabled)
**Agent action:** Propose build command
- Show command: `cmake .. -DLUDEO_SDK_ENABLED=OFF`
- Ask user to run build OR agent runs if possible

**User confirms:** Build succeeded OR reports errors

---

**Stage 0 Complete When:**
- [ ] All 7 steps completed and confirmed
- [ ] Project compiles with `LUDEO_SDK_ENABLED=1`
- [ ] Project compiles with `LUDEO_SDK_ENABLED=0`
- [ ] No linker errors
- [ ] SDK DLLs copied to output directory

---

### Phase 1: SDK Lifecycle (23 Steps)

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md` (keep in context)
- `05-LIFECYCLE-MANAGEMENT.md`
- `03-SDK-FUNDAMENTALS.md` (reference)

**Integration Steps (each requires user confirmation):**

#### Step 1.1: Analyze Game Entry Points
**Agent action:** Analyze and report
- Locate game initialization function (main.cpp, Game::Init, etc.)
- Locate game loop / update function
- Locate game shutdown function
- Identify singleton/manager pattern used in game
- Report findings and propose integration approach

**User confirms:** Approach verified OR provides corrections

---

#### Step 1.2: Create LudeoManager Header
**Agent action:** Generate complete header
- Create `src/core/ludeo/LudeoManager.h`
- Define singleton pattern (matching game's conventions)
- Declare member variables for SDK handles (session, room, gameplay session, DataWriter)
- Declare lifecycle method declarations:
  - `Initialize()`, `ActivateSession()`, `Tick()`, `Shutdown()`
  - `OpenRoom()`, `AddPlayer()`, `BeginGameplaySession()`
  - `EndGameplaySession()`, `RemovePlayer()`, `CloseRoom()`
- Declare callback methods (static)
- Declare getter methods for handles
- Add documentation comments

**Preview:** Show complete LudeoManager.h (~150-200 lines)  
**User confirms:** Create file OR request modifications

---

#### Step 1.3: Implement Initialize() Method
**Agent action:** Generate Initialize() implementation
- Create `src/core/ludeo/LudeoManager.cpp`
- Implement `Initialize()` method:
  - Call `ludeo_Initialize()`
  - Call `ludeo_Session_Create()`
  - Set up error handling
  - Add logging

**Preview:** Show Initialize() implementation (~60-80 lines)  
**User confirms:** Create implementation OR request changes

---

#### Step 1.4: Implement ActivateSession() Method
**Agent action:** Generate ActivateSession() implementation
- Implement `ActivateSession()` method:
  - Set up `LudeoSessionActivateParams`
  - Get window handle (platform-specific)
  - Set API key, game version, platform URL
  - Call `ludeo_Session_Activate()` with callback
  - Implement `OnSessionActivatedCallback()`

**Preview:** Show ActivateSession() implementation (~80-100 lines)  
**User confirms:** Add implementation OR request changes

---

#### Step 1.5: Implement Tick() Method
**Agent action:** Generate Tick() implementation
- Implement `Tick()` method:
  - Call `ludeo_Tick()` to process SDK callbacks
  - Add guard checks for SDK enabled
  - Add error handling

**Preview:** Show Tick() implementation (~15-20 lines)  
**User confirms:** Add implementation

---

#### Step 1.6: Implement Shutdown() Method
**Agent action:** Generate Shutdown() implementation
- Implement `Shutdown()` method:
  - Release session handle
  - Call `ludeo_Shutdown()`
  - Clean up resources
  - Add logging

**Preview:** Show Shutdown() implementation (~30-40 lines)  
**User confirms:** Add implementation

---

#### Step 1.7: Register LudeoSelected Notification
**Agent action:** Add LudeoSelected handling
- Implement `RegisterLudeoSelectedNotification()` method
- Implement `OnLudeoSelectedCallback()` static callback
- Store notification ID for cleanup
- Add placeholder for actual handling (Phase 4 - Restoration)

**Preview:** Show notification registration code (~50-60 lines)  
**User confirms:** Add implementation

---

#### Step 1.8: Hook SDK Initialize into Game Init
**Agent action:** Modify game initialization
- Locate game initialization function
- Add `#include "core/ludeo/LudeoConfig.h"`
- Add `#if LUDEO_SDK_ENABLED` guard
- Add `LudeoManager::Get().Initialize()` call
- Add logging

**Preview:** Show diff of game init function  
**User confirms:** Apply changes OR adjust placement

---

#### Step 1.9: Hook SDK ActivateSession into Game Init
**Agent action:** Add session activation
- In game initialization (after Initialize)
- Add `LudeoManager::Get().ActivateSession()` call
- Ensure proper error handling

**Preview:** Show diff with ActivateSession() call  
**User confirms:** Apply changes

---

#### Step 1.10: Hook SDK Tick into Game Loop
**Agent action:** Modify game loop
- Locate game update/loop function
- Add `#if LUDEO_SDK_ENABLED` guard
- Add `LudeoManager::Get().Tick()` call
- Ensure called every frame

**Preview:** Show diff of game loop function  
**User confirms:** Apply changes OR adjust placement

---

#### Step 1.11: Hook SDK Shutdown into Game Cleanup
**Agent action:** Modify game shutdown
- Locate game shutdown/cleanup function
- Add `#if LUDEO_SDK_ENABLED` guard
- Add `LudeoManager::Get().Shutdown()` call
- Ensure called before final cleanup

**Preview:** Show diff of game shutdown function  
**User confirms:** Apply changes

---

#### Step 1.12: Test SDK Initialization
**Agent action:** Propose test run
- Build and run game
- Check logs for specific messages:
  - `"[Ludeo] SDK initialized successfully"` or similar
  - `"[Ludeo] Session created successfully"`
  - `"[Ludeo] Session activation started"`
  - Callback log: `"[Ludeo] Session activated successfully"` or error code
- Verify no error codes in logs
- Verify game runs normally

**Verification checklist:**
- [ ] Log shows SDK initialization
- [ ] Log shows session creation
- [ ] Log shows session activation callback success
- [ ] No error codes in logs
- [ ] Game runs without crashes

**User confirms:** Test passed OR reports errors/missing logs

---

#### Step 1.13: Analyze Game Flow
**Agent action:** Analyze and report
- Locate level/scene loading functions
- Identify when level starts loading vs when gameplay actually begins
- Locate level unload / gameplay end functions
- Document game flow: Load → Ready → Play → End → Unload
- Report findings

**User confirms:** Flow understood OR provides corrections

---

#### Step 1.14: Add Gameplay Session Member Variables
**Agent action:** Update LudeoManager.h
- Add `LudeoHRoom m_room_handle`
- Add `LudeoHGameplaySession m_gameplay_session_handle`
- Add `LudeoHDataWriter m_data_writer`
- Add `LudeoHPlayer m_player_handle`
- Add `bool m_gameplay_session_active` flag

**Preview:** Show header additions (~12 lines)  
**User confirms:** Add members

---

#### Step 1.15: Implement OpenRoom() Method
**Agent action:** Add OpenRoom() implementation
- Implement `OpenRoom()` method in LudeoManager.cpp:
  - Set up `LudeoSessionOpenRoomParams`
  - Set room configuration (room name, etc.)
  - Call `ludeo_Session_OpenRoom()` with callback
  - Implement `OnRoomOpenedCallback()`
  - Store room handle and DataWriter handle

**Preview:** Show OpenRoom() implementation (~70-90 lines)  
**User confirms:** Add implementation OR request changes

---

#### Step 1.16: Implement AddPlayer() Method
**Agent action:** Add AddPlayer() implementation
- Implement `AddPlayer()` method:
  - Set up `LudeoRoomAddPlayerParams`
  - Set player info (player ID, name, etc.)
  - Call `ludeo_Room_AddPlayer()` with callback
  - Implement `OnPlayerAddedCallback()`
  - Store GameplaySession handle

**Preview:** Show AddPlayer() implementation (~60-80 lines)  
**User confirms:** Add implementation

---

#### Step 1.17: Implement BeginGameplaySession() Method
**Agent action:** Add BeginGameplaySession() implementation
- Implement `BeginGameplaySession()` method:
  - Set up `LudeoGameplaySessionBeginParams`
  - Call `ludeo_GameplaySession_Begin()` with callback
  - Implement `OnGameplaySessionBeginCallback()`
  - Set active flag

**Preview:** Show BeginGameplaySession() implementation (~50-60 lines)  
**User confirms:** Add implementation

---

#### Step 1.18: Implement EndGameplaySession() Method
**Agent action:** Add EndGameplaySession() implementation
- Implement `EndGameplaySession()` method:
  - Call `ludeo_GameplaySession_End()` with callback
  - Implement `OnGameplaySessionEndCallback()`
  - Clear active flag

**Preview:** Show EndGameplaySession() implementation (~40-50 lines)  
**User confirms:** Add implementation

---

#### Step 1.19: Implement CloseRoom() Method
**Agent action:** Add CloseRoom() implementation
- Implement `CloseRoom()` method:
  - Call `ludeo_Room_Close()` with callback
  - Implement `OnRoomClosedCallback()`
  - Clear room handle and DataWriter handle

**Preview:** Show CloseRoom() implementation (~40-50 lines)  
**User confirms:** Add implementation

---

#### Step 1.20: Hook OpenRoom into Level Load Start
**Agent action:** Modify level loading code
- Locate level/scene load start function
- Add `#if LUDEO_SDK_ENABLED` guard
- Add `LudeoManager::Get().OpenRoom()` call
- Pass level/scene identifier
- Add logging

**Preview:** Show diff of level load function  
**User confirms:** Apply changes OR adjust placement

---

#### Step 1.21: Hook AddPlayer and BeginGameplaySession
**Agent action:** Modify gameplay start code
- In `OnRoomOpenedCallback()`, call `LudeoManager::Get().AddPlayer()`
- In `OnPlayerAddedCallback()`, set `player_added = true` and call `TryBeginGameplaySession()`
- In `OnRoomReadyCallback()`, set `room_ready = true` and call `TryBeginGameplaySession()`
- `TryBeginGameplaySession()` checks BOTH conditions before calling `BeginGameplaySession()`
- **CRITICAL:** `BeginGameplaySession()` must only be called when both player added AND RoomReady received
- Add logging

**Preview:** Show callback chain implementation with dual-condition check  
**User confirms:** Apply changes

---

#### Step 1.22: Hook EndGameplaySession, RemovePlayer and CloseRoom into Gameplay End
**Agent action:** Modify gameplay end code
- Locate gameplay end function (level complete, player death, etc.)
- Add `#if LUDEO_SDK_ENABLED` guard
- Call `LudeoManager::Get().EndGameplaySession()`
- In `OnGameplaySessionEndCallback()`, call `LudeoManager::Get().RemovePlayer()`
- In `OnPlayerRemovedCallback()`, call `LudeoManager::Get().CloseRoom()`
- Ensure proper callback sequencing
- Add logging

**Preview:** Show callback chain implementation  
**User confirms:** Apply changes

---

#### Step 1.23: Test Gameplay Session Flow
**Agent action:** Propose test run
- Build and run game
- Load a level
- Check logs for specific messages in order:
  - `"[Ludeo] Opening room for level: [level_name]"`
  - `"[Ludeo] Room opened successfully, DataWriter obtained"`
  - `"[Ludeo] Adding player to room"`
  - `"[Ludeo] Player added successfully, GameplaySession handle obtained"`
  - `"[Ludeo] Beginning GameplaySession"`
  - `"[Ludeo] GameplaySession begun successfully - tracking active"`
- Play briefly, then end gameplay
- Check logs for cleanup messages:
  - `"[Ludeo] Ending GameplaySession"`
  - `"[Ludeo] GameplaySession ended successfully"`
  - `"[Ludeo] Removing player from room"`
  - `"[Ludeo] Player removed successfully"`
  - `"[Ludeo] Closing room"`
  - `"[Ludeo] Room closed successfully"`
- Verify no error codes in logs

**Verification checklist:**
- [ ] All startup logs appear in correct order
- [ ] DataWriter handle is non-null in logs
- [ ] GameplaySession tracking active flag set
- [ ] All cleanup logs appear in correct order
- [ ] No error codes or warnings
- [ ] Game plays normally

**User confirms:** Test passed OR reports errors/missing logs

---

**Phase 1 Complete When:**
- [ ] All 23 steps completed and confirmed
- [ ] SDK initializes without errors
- [ ] Game Session activates (verified in logs)
- [ ] Tick runs every frame (can add counter log every 60 frames)
- [ ] Room opens when level loads (verified in logs)
- [ ] Player added successfully (verified in logs)
- [ ] GameplaySession begins when gameplay starts (verified in logs)
- [ ] GameplaySession ends when gameplay ends (verified in logs)
- [ ] Player removed successfully (verified in logs)
- [ ] Room closes properly (verified in logs)
- [ ] SDK shuts down cleanly (verified in logs)
- [ ] No SDK errors in any logs

---

### Phase 2: Code Patterns and Macros

> **Note:** Each macro and helper requires separate proposal and user confirmation.

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md` (keep in context)
- `08-CODE-PATTERNS.md`
- `03-SDK-FUNDAMENTALS.md` (reference)

**Your tasks:**
1. Create `LudeoCaptureMacros.h`
2. Implement RAII ObjectScope helper
3. Implement type-safe capture functions
4. Create capture macros (LUDEO_CAPTURE_FLOAT, etc.)
5. Create action macro (LUDEO_ACTION)
6. Test macros compile to no-op when SDK disabled

**Code to generate:**
- `src/core/ludeo/LudeoCaptureMacros.h`

**Validation Checkpoint:**
- [ ] Macros compile with SDK enabled
- [ ] Macros compile to no-op with SDK disabled
- [ ] RAII ensures context cleanup
- [ ] Type-safe capture functions work

---

### Phase 3: Object Tracking

> **Note:** Each object type requires separate tracking implementation with user confirmation. Expect 20-30+ individual propose-confirm cycles for this phase.

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md` (keep in context)
- `06-TRACKING-PATTERNS.md`
- `08-CODE-PATTERNS.md` (reference)

**Your tasks:**
1. Add `LudeoObjectId` member to game objects
2. Implement `RegisterWithLudeo()` for each object type
3. Implement `UnregisterFromLudeo()` for each object type
4. Add capture macros to property setters
5. Track environment metadata (level, camera, world)
6. Implement ID mapping (LudeoObjectId ↔ game IDs)
7. Register all objects on gameplay start
8. Identify and implement gameplay actions
9. Add LUDEO_ACTION calls at action trigger points
10. Implement pause/resume tracking
11. Identify and handle non-ludeoable areas

**Code modifications:**
- Every game object class (add tracking)
- Object managers (integrate registration)
- Property setters (add capture macros)
- Game events (add action macros)
- Pause/cutscene handlers (pause tracking)

**Validation Checkpoint:**
- [ ] All object types register correctly
- [ ] Properties tracked via macros
- [ ] Environment metadata tracked
- [ ] Actions fire for key events (kills, pickups, objectives)
- [ ] Actions documented in research
- [ ] Tracking pauses during game pause
- [ ] Tracking pauses during cutscenes
- [ ] Non-ludeoable areas don't track
- [ ] Object destruction tracked
- [ ] SDK logs show tracking activity

---

### Phase 4: State Restoration

> **Note:** Restoration logic is complex. Each restoration function requires careful review and confirmation.

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md` (keep in context)
- `07-RESTORATION-PATTERNS.md`
- `06-TRACKING-PATTERNS.md` (reference)

**Your tasks:**
1. Create `LudeoStateAdapter` class
2. Implement LudeoSelected handler
3. Implement Ludeo data fetch callback
4. Implement two-pass restoration:
   - Pass 1: Create all objects
   - Pass 2: Restore properties
5. Implement environment restoration
6. Implement "wait for player" flow
7. Register player ready callback
8. Handle LudeoSelected from any game state
9. Implement graceful interruption of current activity

**Code to generate:**
- `src/core/ludeo/LudeoStateAdapter.h`
- `src/core/ludeo/LudeoStateAdapter.cpp`

**Code modifications:**
- `LudeoManager` - add restoration handlers
- Game state machine - handle LudeoSelected interrupts

**Validation Checkpoint:**
- [ ] LudeoSelected notification received
- [ ] DataReader obtained
- [ ] Correct level loads
- [ ] All objects restored (two-pass)
- [ ] Properties match original
- [ ] Environment restored
- [ ] Game pauses after restoration
- [ ] Player ready callback works
- [ ] Gameplay starts after player input
- [ ] LudeoSelected works from any game state

---

### Phase 5: Testing and Validation

> **Note:** Testing is primarily user-driven. Agent assists with test setup and analysis.

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md`
- `10-TESTING-VALIDATION.md`
- `99-QUICK-REFERENCE.md` (reference)

**Your tasks:**
1. Run through all test checklists
2. Verify SDK lifecycle
3. Test object tracking
4. Test action firing
5. Test pause/resume
6. Test restoration flow
7. Test LudeoSelected from multiple states
8. Test wait-for-player flow
9. Test error handling
10. Review code against checklist

**Validation Checkpoint:**
- [ ] All tests in testing document pass
- [ ] Code review checklist complete
- [ ] Expected log output matches
- [ ] No crashes or errors
- [ ] Graceful degradation works

---

## 4. Context Management Strategy

### What to Keep in Context

**Always loaded (mandatory):**
- `00-CRITICAL-REQUIREMENTS.md` (~15 KB)

**Load based on current stage/phase:**
- Stage 0 (Prep): `02-RESEARCH-TEMPLATE.md`
- Stage 0 (Build): `04-BUILD-INTEGRATION.md` + `03-SDK-FUNDAMENTALS.md`
- Phase 1: `05-LIFECYCLE-MANAGEMENT.md` + `03-SDK-FUNDAMENTALS.md`
- Phase 2: `08-CODE-PATTERNS.md` + `03-SDK-FUNDAMENTALS.md`
- Phase 3: `06-TRACKING-PATTERNS.md` + `08-CODE-PATTERNS.md`
- Phase 4: `07-RESTORATION-PATTERNS.md` + `06-TRACKING-PATTERNS.md`
- Phase 5: `10-TESTING-VALIDATION.md` + `99-QUICK-REFERENCE.md`

**Never load all at once** - Maximum 3-4 files per phase

### When to Reload Files

Reload a file when:
- Moving to a new phase
- Following a cross-reference
- Debugging an issue in that area
- Validating implementation against requirements

### When to Drop Files

Drop a file from context when:
- Moving to a different phase
- Context window getting full
- Information no longer relevant to current task

---

## 5. Research-First Approach

### Why Research First?

**DON'T:** Jump straight to code generation  
**DO:** Complete research template first

**Reasons:**
1. Avoids rework - understand game fully before coding
2. Identifies edge cases early
3. Ensures complete tracking - won't miss objects
4. Finds best integration points
5. Documents actions for objectives/scoring

### How to Research

**Step 1: Read the game's existing code**
- Start with main.cpp / game entry point
- Follow initialization flow
- Map out state machines
- Identify managers and singletons

**Step 2: Search for key patterns**
```
Search for: "new ", "delete ", "Create", "Destroy", "Spawn"
Purpose: Find object creation/destruction

Search for: "Update(", "Tick(", "Step("
Purpose: Find game loop

Search for: "SetHealth", "SetPosition", "SetOwner"
Purpose: Find property setters to instrument

Search for: "OnKilled", "OnDamage", "OnCollect", "OnComplete"
Purpose: Find action trigger points
```

**Step 3: Document everything**
- Complete every section of research template
- Create tables for object inventory
- Create tables for action inventory
- Diagram game flow
- Note threading model

**Step 4: Identify gaps**
- What data is missing?
- What objects have no clear creation pattern?
- What relationships are unclear?
- What actions might we miss?

---

## 6. Decision Framework

### "Should I track this object?"
```
Is it visible to the player?
├─ Yes → Track it
└─ No → Does it affect gameplay?
    ├─ Yes → Track it
    └─ No → Skip it

Exception: UI elements generally not tracked unless they affect gameplay
```

### "Is this an action or continuous state?"
```
Does it happen once at a moment in time?
├─ Yes → It's an ACTION (use LUDEO_ACTION)
│   Examples: Kill, Pickup, Jump, Objective Complete
│
└─ No → It's CONTINUOUS STATE (use LUDEO_CAPTURE_*)
    Examples: Health, Position, Velocity, Rotation
```

### "Should tracking pause here?"
```
Is this a cutscene, tutorial, or menu?
├─ Yes → Pause tracking
│
├─ Is gameplay continuing in the background?
│   ├─ Yes → Continue tracking
│   └─ No → Pause tracking
│
└─ Is the player actively playing?
    ├─ Yes → Continue tracking
    └─ No → Pause tracking
```

### "Which restoration pass does this belong to?"
```
Does this object reference other objects?
├─ No → Pass 1 (creation)
│   Examples: Basic position, type, ID
│
└─ Yes → Pass 2 (properties)
    Examples: owner_id, parent_id, target_id, attachment_id
```

---

## 7. Code Generation Principles

### Macro-First Philosophy

**Always prefer macros over raw SDK calls in game code.**

```cpp
// ❌ Bad: Raw SDK calls scattered in game code
void Enemy::SetHealth(float health) {
    m_health = health;
#if LUDEO_SDK_ENABLED
    // ... 10 lines of SDK boilerplate ...
#endif
}

// ✅ Good: Clean macro
void Enemy::SetHealth(float health) {
    m_health = health;
    LUDEO_CAPTURE_FLOAT(this, "enemy", "health", health);
}
```

### Naming Conventions

| Type | Convention | Examples |
|------|------------|----------|
| Variables | `snake_case` | `m_ludeo_object_id`, `data_writer` |
| Functions | `PascalCase` | `RegisterWithLudeo()`, `BeginGameplay()` |
| Attributes | `snake_case` | `"health"`, `"position"`, `"owner_id"` |
| Object types | `snake_case` | `"player"`, `"enemy"`, `"projectile"` |
| Actions | `PascalCase` | `"Kill"`, `"Headshot"`, `"CollectCoin"` |

→ **For SDK patterns (error handling, callbacks, logging):** See [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md)

---

## 8. Common Pitfalls to Avoid

> **⚠️ All critical requirements are documented in [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md)**

### Quick Checklist

Before moving between phases, verify you haven't fallen into these traps:

| Pitfall | Quick Fix |
|---------|-----------|
| Missing `#if LUDEO_SDK_ENABLED` guards | All SDK code must be wrapped (CR-001) |
| Single-pass restoration | Use two passes: create objects, then properties (CR-009) |
| Missing actions | Every gameplay event needs `LUDEO_ACTION()` (CR-006) |
| Not pausing after restoration | Must wait for PlayerReady callback (CR-010) |
| Ignoring async operation results | Wait for callbacks, don't treat as sync (CR-005) |
| Missing `LeaveObject()` calls | Always pair with `EnterObject()` - use RAII (CR-003) |

|| **Calling AddPlayer from game code** | **AddPlayer called FROM OnRoomOpened callback only** |

→ **See:** [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) for full details and code examples

---

### ❌ Common Mistake #1: Calling Async Operations Sequentially

**THE MISTAKE:** Treating the callback chain as if it were synchronous game code.

**Wrong Implementation:**
```cpp
// ❌ INCORRECT - In game's startmap() function
void StartMap(const char* mapName) {
    // Load map...
    
    ludeo_mgr.OpenRoom(mapName);      // Async - returns immediately
    ludeo_mgr.AddPlayer(playerId);    // ❌ WRONG! Room not actually open yet!
    
    // Continue loading...
}
```

**Why This Fails:**
- `OpenRoom()` is **async** - it returns immediately before the room is actually open
- `AddPlayer()` requires an open room - calling it immediately will fail
- The SDK callbacks haven't fired yet when you call AddPlayer

**Correct Implementation:**
```cpp
// ✅ CORRECT - Game code only calls OpenRoom
void StartMap(const char* mapName) {
    // Load map...
    
    ludeo_mgr.OpenRoom(mapName);  // Triggers async operation
    
    // Continue loading...
    // AddPlayer will be called automatically from callback
}

// ✅ CORRECT - SDK callback handler (in LudeoManager)
void OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data) {
    if (data->resultCode == LudeoResult::Success) {
        m_room_handle = data->room;
        m_data_writer = data->dataWriter;
        
        // NOW call AddPlayer - room is confirmed open
        AddPlayer(m_player_id);  // Called from HERE
    }
}
```

**The Rule:**
- **🎮 Game code** calls: `OpenRoom()` only (when level loading starts)
- **📞 SDK callbacks** call: `AddPlayer()`, `BeginGameplaySession()`
- The callbacks drive the flow, not game events

**How to Identify This in Your Plan:**
1. Look for AddPlayer() in game code integration points - it shouldn't be there
2. AddPlayer() should only appear in OnRoomOpenedCallback implementation
3. BeginGameplaySession() should only appear in TryBeginGameplaySession() helper (called from OnPlayerAdded + OnRoomReady callbacks)

→ **See:** [05-LIFECYCLE-MANAGEMENT.md Section 6](./05-LIFECYCLE-MANAGEMENT.md#6-gameplay-session-management) for complete callback chain

---

## 9. Checkpoints and Validation

### After Each Phase

Run the validation checkpoint at the end of each phase section (see Phase descriptions above).

### Before Moving to Next Phase

Don't proceed until:
- [ ] All checkpoints in current phase pass
- [ ] Code compiles without errors
- [ ] Code compiles with SDK disabled
- [ ] Logs show expected behavior

### When Stuck

1. Load `11-TROUBLESHOOTING.md`
2. Find your error/symptom
3. Follow diagnostic steps
4. Load relevant implementation file if needed

---

## 10. When to Ask for Help

### Ask for Clarification When:

1. **Game architecture is unclear**
   - "I can't find where objects are created"
   - "I don't understand the threading model"
   - "The state machine is complex"

2. **SDK behavior is unexpected**
   - "Callback never fires"
   - "Return values always fail"
   - "Objects don't restore correctly"

3. **Integration point is ambiguous**
   - "When exactly does gameplay begin?"
   - "Should I track during loading?"
   - "What counts as non-ludeoable?"

4. **Requirements conflict**
   - "Game requires X but SDK requires Y"
   - "Performance budget too tight"
   - "Threading model incompatible"

### Provide Context When Asking:

Always include:
- Current phase you're in
- What you've tried
- Error messages / logs
- Relevant code snippets
- What you expected vs what happened

---

## 11. Success Indicators

### You're On Track When:

✅ Research template is complete and detailed  
✅ Every phase checkpoint passes  
✅ Code compiles both with/without SDK  
✅ Logs show expected SDK lifecycle  
✅ Objects register and track correctly  
✅ Actions fire at appropriate moments  
✅ Restoration recreates game state accurately  
✅ Player can capture and play Ludeos  
✅ Game remains stable with SDK errors  

### Final Validation:

1. Capture a gameplay moment (create Ludeo)
2. Exit to menu
3. Play the Ludeo (LudeoSelected)
4. Game should:
   - Load correct level
   - Restore all objects
   - Restore environment
   - Pause and wait for player
   - Play correctly after player input
   - Actions work for objectives/scoring

---

## 📚 Quick Reference Links

**Critical Reading:**
- [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Must-know rules
- [00-INDEX.md](./00-INDEX.md) - Navigation

**Phase-Specific:**
- [02-RESEARCH-TEMPLATE.md](./02-RESEARCH-TEMPLATE.md) - Game analysis
- [04-BUILD-INTEGRATION.md](./04-BUILD-INTEGRATION.md) - Build setup
- [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) - SDK lifecycle
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Object tracking & actions
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - State restoration
- [08-CODE-PATTERNS.md](./08-CODE-PATTERNS.md) - Macros & patterns

**Support:**
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) - When stuck
- [99-QUICK-REFERENCE.md](./99-QUICK-REFERENCE.md) - Quick lookups

---

**Remember:** Research first, code second. Validate constantly. Ask for help when stuck.

**Next Step:** Complete [02-RESEARCH-TEMPLATE.md](./02-RESEARCH-TEMPLATE.md) before writing any code.