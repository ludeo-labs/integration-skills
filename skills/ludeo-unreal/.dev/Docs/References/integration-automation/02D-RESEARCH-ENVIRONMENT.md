> **UE CAVEAT:** For Unreal Engine: use Sequencer for cutscene handling, `APlayerCameraManager` or `UCameraComponent` for cameras, `AWorldSettings::SetGamePaused()` for pause systems.

---

# 02D-RESEARCH-ENVIRONMENT.md - Environment & Context Research

> **Purpose:** Document environment state, non-ludeoable areas, and pause handling  
> **For:** Restoration Agent - implementing state restoration and context management  
> **Prerequisites:** Architecture research complete (02A)

**Last Updated:** December 2025

---

## 📋 **Instructions**

Complete this questionnaire to identify:
- Level/environment metadata to track
- Areas where tracking should be disabled
- Pause and resume handling

**Output:** Create `GAME_ANALYSIS_ENVIRONMENT.md` with your findings.

---

## 🌍 **SECTION 7: Environment and Metadata**

### 7.1 Level/Scene Data

**How are levels represented?**  
[ ] Scene files  
[ ] Level class  
[ ] Config files  
[ ] Procedurally generated  
[ ] Other:

**What data defines a level?**

| Data | Type | Example | How Retrieved |
|------|------|---------|---------------|
| Level ID | string | "level_01" | LevelManager::GetCurrentID() |
| Level Name | string | "Forest Level" | LevelManager::GetCurrentName() |
| Difficulty | int | 2 (0-4) | GameManager::GetDifficulty() |
| Game Mode | enum | Survival | GameManager::GetMode() |
| Seed (if procedural) | uint64 | 12345 | WorldGen::GetSeed() |
| | | | |

**Are levels loaded dynamically or pre-loaded?**  

**What metadata is needed to restore the correct level?**
1. 
2. 
3. 

---

### 7.2 Camera System

**Camera type:**  
[ ] First-person  
[ ] Third-person  
[ ] Top-down  
[ ] Side-scrolling  
[ ] Multiple cameras  
[ ] Other:

**Camera properties to track:**

| Property | Type | Getter Function | Track? |
|----------|------|-----------------|--------|
| position | Vec3 | Camera::GetPosition() | Yes |
| rotation | Quat | Camera::GetRotation() | Yes |
| fov | float | Camera::GetFOV() | Maybe |
| target | Vec3 | Camera::GetTarget() | Maybe |
| mode | enum | Camera::GetMode() | If multiple modes |
| | | | |

**Where is camera state updated?**  

---

### 7.3 World State

**What defines world/environment state?**

| State Component | Type | Track? | Getter Function |
|----------------|------|--------|-----------------|
| Game time / elapsed | float | Yes | GameTime::GetElapsed() |
| Is paused | bool | No (don't restore as paused) | GameManager::IsPaused() |
| Weather type | enum | Maybe | WeatherSystem::GetWeather() |
| Time of day | float | Maybe | DayNightCycle::GetTime() |
| Music state | enum | Maybe | AudioManager::GetMusicState() |
| Random seed | uint64 | If determinism needed | Random::GetSeed() |
| | | | |

**Environmental objects that change state:**

| Object Type | States | How to Track |
|-------------|--------|--------------|
| Doors | open/closed | Track as object attribute |
| Destructibles | intact/destroyed | Track existence or attribute |
| Switches | on/off | Track as object attribute |
| | | |

---

### 7.4 Audio/Music (Optional)

**Does audio/music state affect gameplay experience?** [ ] Yes [ ] No

**If yes:**

| Audio Element | Why Important | How to Track |
|---------------|---------------|--------------|
| Music track | Sets mood | AudioManager::GetCurrentTrack() |
| Combat intensity | Dynamic music | AudioManager::GetIntensity() |
| | | |

---

## ⏸️ **SECTION 8: Non-Ludeoable Areas & Pause Handling**

### 8.1 Non-Ludeoable Areas

**Are there areas/sections that should NOT be captured as Ludeos?**

| Area Type | Why Not Ludeoable | How to Detect |
|-----------|-------------------|---------------|
| Tutorial | Teaching, not playing | Level ID == "tutorial" |
| Main Menu | Not gameplay | GameState == MainMenu |
| Lobby | Waiting, not playing | GameState == Lobby |
| Loading Screen | Technical transition | IsLoading() |
| Cutscene | Passive viewing | CutsceneManager::IsPlaying() |
| Safe Zone | No combat allowed | Area::IsSafeZone() |
| Shop/Inventory | Menu, not action | UIState == Shop |
| | | |

**Function to check if currently in ludeoable area:**
```cpp
bool IsLudeoableArea() {
    // How to implement this check?
}
```

---

### 8.2 Cutscenes

**Does the game have cutscenes?** [ ] Yes [ ] No

**If yes:**

**How are cutscenes triggered?**  
Function/Event:  

**Cutscene start function:**  
**Cutscene end function:**  

**Should cutscenes pause Ludeo tracking?** [ ] Yes [ ] No

**Should cutscenes be skipped during restoration?** [ ] Yes [ ] No

**How to skip cutscenes programmatically:**  

---

### 8.3 Pause and Resume Tracking

**What events cause gameplay to pause?**  
[ ] Pause menu  
[ ] Phone call / loss of focus  
[ ] Alt-Tab / minimize  
[ ] Dialogue / conversation  
[ ] Inventory screen  
[ ] Map screen  
[ ] Orders/build queue  
[ ] Other:

**How to detect when game is truly paused vs just UI overlay?**  
Check:  

**Should Ludeo tracking pause when game pauses?** [ ] Yes [ ] No

**Pause tracking hook:**  
Function:  
File:  

**Resume tracking hook:**  
Function:  
File:  

---

### 8.4 Tracking State Decision Tree

```
Is game paused?
├─ Yes → Pause tracking
│
└─ No → Is in cutscene?
    ├─ Yes → Pause tracking
    │
    └─ No → Is in non-ludeoable area?
        ├─ Yes → Don't track (or end session)
        │
        └─ No → Track normally
```

---

### 8.5 Restoration Context

**When restoring a Ludeo, what environment setup is needed?**

1. Load correct level: `LevelManager::Load(level_id)`
2. Set difficulty: `GameManager::SetDifficulty(difficulty)`
3. Set game mode: `GameManager::SetMode(mode)`
4. Set time of day: (if applicable)
5. Set weather: (if applicable)
6. Skip intro/cutscene: (if applicable)
7. Other:

**Order matters?** [ ] Yes [ ] No

**If yes, correct order:**
1. 
2. 
3. 

---

## ✅ **Environment Research Checklist**

Before moving to implementation:

- [ ] Level metadata documented
- [ ] Camera properties identified
- [ ] World state components listed
- [ ] Non-ludeoable areas identified
- [ ] Detection method for each non-ludeoable area
- [ ] Cutscene handling planned
- [ ] Pause/resume hooks identified
- [ ] Restoration context requirements documented

---

## 🔗 **Related Documentation**

- [../07-RESTORATION-PATTERNS.md](../07-RESTORATION-PATTERNS.md) - Restoration implementation
- [../06-TRACKING-PATTERNS.md](../06-TRACKING-PATTERNS.md) - Pause tracking (Section 8.6)
- [../00-CRITICAL-REQUIREMENTS.md](../00-CRITICAL-REQUIREMENTS.md) - Mandatory rules

---

**Next:** After completing environment research, proceed to restoration implementation using [../07-RESTORATION-PATTERNS.md](../07-RESTORATION-PATTERNS.md)

