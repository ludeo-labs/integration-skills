> **UE CAVEAT:** Replace generic references with UE-specific concepts: `AGameModeBase`, `AGameStateBase`, `APlayerController`, `UGameInstanceSubsystem`. Use UE level streaming instead of generic scene management.

---

# 02A-RESEARCH-ARCHITECTURE.md - Game Architecture Research

> **Purpose:** Analyze game architecture to identify SDK lifecycle integration points  
> **For:** Lifecycle Agent - finding where to initialize, tick, and manage sessions  
> **Prerequisites:** None - this is the starting point

**Last Updated:** December 2025

---

## 📋 **Instructions**

Complete this questionnaire to identify:
- Where to initialize and shutdown the SDK
- Where to call `ludeo_Tick()` every frame
- Where to activate Game Session
- Where to open/close Rooms
- Where to begin/end Gameplay Sessions

**Output:** Create `GAME_ANALYSIS_ARCHITECTURE.md` with your findings.

---

## 🎮 **SECTION 1: Game Overview**

### Basic Information

**Game Name:**  
**Genre:**  
**Platform(s):**  
**Engine/Framework:**  
**Language(s):**  
**Build System:**  

**Single-player, Multiplayer, or Hybrid:**  
**Estimated Codebase Size (lines):**  
**Key Dependencies:**  

---

## 🏗️ **SECTION 2: Game Architecture**

### 2.1 Game Loop and Entry Point

**Main entry point file:**  
**Game loop location:**  
**Approximate frame rate/tick rate:**  

**Game loop structure:**
```cpp
// Pseudo-code or actual code snippet
while (game_running) {
    // Input handling?
    // Update logic?
    // Rendering?
    // Where would SDK Tick() go?
}
```

**Where should `ludeo_Tick()` be called?**  
File:  
Function:  
Line (approximate):  

---

### 2.2 Initialization and Shutdown

**Game initialization function(s):**  
**Where does initialization happen?** (file:line)  

**What gets initialized?** (in order)
1. 
2. 
3. 

**Where should SDK `Initialize()` be called?**  
File:  
Function:  
Line (approximate):  

**Game shutdown function(s):**  
**Where does cleanup happen?** (file:line)  

**Where should SDK `Shutdown()` be called?**  
File:  
Function:  
Line (approximate):  

---

### 2.3 State Machine

**Does the game use a state machine?** [ ] Yes [ ] No

**If yes, where is it implemented?**  

**What states exist?** (Document ALL states)

| State Name | Description | Entry Function | Exit Function |
|------------|-------------|----------------|---------------|
| MainMenu | Main menu screen | | |
| Loading | Level/Match loading | | |
| Playing | Active gameplay | | |
| Paused | Game paused | | |
| GameOver | End screen | | |
| | | | |

**State transition diagram:**
```
[Draw ASCII state diagram if possible]
MainMenu → Loading → Playing → GameOver → MainMenu
                       ↓
                     Paused
```

---

### 2.4 Multiplayer Architecture (if applicable)

**Is this a multiplayer game?** [ ] Yes [ ] No

**If yes:**

**Network architecture:** [ ] Client-Server [ ] Peer-to-Peer [ ] Dedicated Servers [ ] Other:

**Which machine is authoritative for game state?**  
[ ] Server [ ] Client [ ] Hybrid (specify):

**Which side should perform SDK tracking?**  
[ ] Server only [ ] Client only [ ] Both [ ] Per-player

**Which side should perform restoration?**  
[ ] Server [ ] All clients [ ] Other:

---

## 🎬 **SECTION 3: Game Flow and Session Management**

### 3.1 Scene/Level Management

**What system manages scenes/levels?**  
[ ] Unity SceneManager  
[ ] Unreal Level Streaming  
[ ] Custom system (describe):

**Scene/Level loading function(s):**  
**File/Class:**  

**How are levels identified?**  
[ ] String ID [ ] Enum [ ] Index [ ] File path [ ] Other:

**Example level identifier:**  

---

### 3.2 Critical Integration Points

Answer with specific **file:function:line** references:

---

**Q: Where should Game Session be activated?**  
**A:** When game loads (during initialization)  
**Location:**  

---

**Q: Where should Room be opened?**  
**A:** When level/scene starts loading  
**Location:**  

---

**Q: Where should Player be added to Room?**  
**A:** After Room opens (in OnRoomOpenedCallback)  
**Location:**  

---

**Q: Where should GameplaySession begin?**  
**A:** When gameplay actually starts (after loading completes, after Room Ready)  
**Location:**  

---

**Q: Where should GameplaySession end?**  
**A:** When gameplay ends (player dies, level completes, etc.)  
**Location:**  

---

**Q: Where should Player be removed from Room?**  
**A:** After GameplaySession ends (in OnGameplaySessionEndCallback)  
**Location:**  

---

**Q: Where should Room be closed?**  
**A:** After all players removed (in OnPlayerRemovedCallback)  
**Location:**  

---

### 3.3 External Launch Parameters

**Can the game accept launch parameters?** [ ] Yes [ ] No

**If yes, how?**  
[ ] Command line arguments  
[ ] Deep links (URL scheme)  
[ ] Config file  
[ ] Other:

**Where are launch parameters parsed?**  
File:  
Function:  

**Can we add a parameter for LudeoSelected?** [ ] Yes [ ] No

---

### 3.4 LudeoSelected Interrupt Handling

> **Remember:** LudeoSelected can happen AT ANY TIME - menu, gameplay, loading, cutscene, etc.

**Current game state when LudeoSelected might fire:**

| State | How to Interrupt | How to Clean Up |
|-------|------------------|-----------------|
| MainMenu | | Minimal cleanup |
| Loading | Cancel loading? | |
| Playing | End gameplay session | |
| Paused | Close pause menu | |
| Cutscene | Skip/abort cutscene | |
| | | |

**Can the game interrupt current activity from ANY state?** [ ] Yes [ ] No [ ] Needs implementation

**If needs implementation, what's required?**  

---

### 3.5 Wait for Player Flow

**After restoration, can the game pause and wait?** [ ] Yes [ ] No

**Where is game simulation paused/unpaused?**  
Pause function:  
Unpause function:  

**Does the game have a "press to start" or "ready" screen?** [ ] Yes [ ] No

**If yes, where is it implemented?**  

**Where would we hook the SDK PlayerReady callback?**  

---

## ✅ **Architecture Research Checklist**

Before moving to implementation:

- [ ] Game loop location identified
- [ ] `ludeo_Tick()` placement identified
- [ ] Initialization point identified
- [ ] Shutdown point identified
- [ ] State machine documented (if exists)
- [ ] All critical integration points have file:function:line references
- [ ] LudeoSelected interrupt handling planned
- [ ] Wait-for-player flow planned

---

## 🔗 **Related Documentation**

- [../05-LIFECYCLE-MANAGEMENT.md](../05-LIFECYCLE-MANAGEMENT.md) - SDK lifecycle implementation details
- [../03-SDK-FUNDAMENTALS.md](../03-SDK-FUNDAMENTALS.md) - Core SDK concepts
- [../00-CRITICAL-REQUIREMENTS.md](../00-CRITICAL-REQUIREMENTS.md) - Mandatory rules

---

**Next:** After completing architecture research, proceed to lifecycle implementation using [../05-LIFECYCLE-MANAGEMENT.md](../05-LIFECYCLE-MANAGEMENT.md)

