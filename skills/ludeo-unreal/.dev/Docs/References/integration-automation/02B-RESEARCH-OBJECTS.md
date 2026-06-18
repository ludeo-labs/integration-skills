# 02B-RESEARCH-OBJECTS.md - Object Inventory Research

> **Purpose:** Document all game objects and their attributes for SDK tracking  
> **For:** Tracking Agent - implementing object registration and state capture  
> **Prerequisites:** Architecture research complete (02A)

**Last Updated:** December 2025

---

## 📋 **Instructions**

Complete this questionnaire to identify:
- Every object type that affects gameplay
- How objects are created and destroyed
- What attributes each object has
- How objects reference each other

**Output:** Create `GAME_ANALYSIS_OBJECTS.md` with your findings.

---

## 🎯 **SECTION 4: Object Inventory**

### 4.1 Complete Object Type List

> **Goal:** Document EVERY object type that affects gameplay experience

| Object Type | Description | Game Impact | Must Track? | Creation Pattern | Manager/Factory |
|-------------|-------------|-------------|-------------|------------------|-----------------|
| Player | Main character | High | Yes | | |
| Enemy | Hostile NPC | High | Yes | | |
| Projectile | Bullets/missiles | Medium | Yes | | |
| Pickup | Items to collect | Medium | Yes | | |
| Weapon | Equippable weapon | High | Yes | | |
| Vehicle | Drivable vehicle | High | Yes | | |
| Door | Interactive door | Low | Maybe | | |
| Trigger | Event trigger | Medium | Maybe | | |
| | | | | | |

**Decision Framework:**
```
Is it visible to the player?
├─ Yes → Track it
└─ No → Does it affect gameplay?
    ├─ Yes → Track it
    └─ No → Skip it

Exception: UI elements generally not tracked unless they affect gameplay
```

**Total object types identified:** _____

---

### 4.2 Object Creation Patterns

**How are objects created?**

| Pattern | Used? | Examples | Manager Class |
|---------|-------|----------|---------------|
| `new` keyword | [ ] Yes | | |
| Factory function | [ ] Yes | | |
| Object pool | [ ] Yes | | |
| Manager class | [ ] Yes | | |
| Spawn function | [ ] Yes | | |
| Other: | [ ] Yes | | |

**Is there a central entity registry?** [ ] Yes [ ] No

**If yes, where:**  

**Where should we hook object registration with Ludeo?**  
Creation hook:  
Destruction hook:  

---

### 4.3 Object Identification System

**How are objects identified?**  
[ ] UniqueID (uint64)  
[ ] GUID (string)  
[ ] Index (int)  
[ ] Pointer address (⚠️ BAD for Ludeo - not stable!)  
[ ] Name string  
[ ] Other:

**Are IDs stable across sessions?** [ ] Yes [ ] No

**If no, how will we create stable IDs for Ludeo?**  
Strategy:  

**Example object ID:**  

---

### 4.4 Object Lifecycle

**When are objects created relative to gameplay start?**  
[ ] During level load (before gameplay)  
[ ] Dynamically during gameplay  
[ ] Both

**When are objects fully initialized?**  
[ ] In constructor  
[ ] In separate Init() function  
[ ] Asynchronously  
[ ] Other:

**How are objects destroyed?**  
[ ] `delete` keyword  
[ ] Destroy() function  
[ ] Returned to pool  
[ ] Manager cleanup  
[ ] Other:

**Is there object pooling?** [ ] Yes [ ] No

**If yes, how does pooling affect Ludeo tracking?**  
- When object returned to pool:  
- When object reused from pool:  

---

## 📊 **SECTION 5: Object Attribute Inventory**

### 5.1 Attribute Documentation Template

For EACH major object type, document all trackable attributes:

---

#### Player Object

| Attribute | Type | Description | Update Frequency | Setter Function |
|-----------|------|-------------|------------------|-----------------|
| position | Vec3 | World position | Every frame | SetPosition() |
| rotation | Quat | Orientation | Every frame | SetRotation() |
| velocity | Vec3 | Movement velocity | Every frame | SetVelocity() |
| health | float | Current HP | On damage/heal | SetHealth() |
| max_health | float | Maximum HP | Rarely | SetMaxHealth() |
| is_dead | bool | Death state | On death | SetDead() |
| score | int32 | Player score | On score change | AddScore() |
| player_id | uint64 | Unique ID | On creation | - |
| team_id | int32 | Team assignment | Rarely | SetTeam() |
| | | | | |

---

#### Enemy Object

| Attribute | Type | Description | Update Frequency | Setter Function |
|-----------|------|-------------|------------------|-----------------|
| position | Vec3 | World position | Every frame | |
| rotation | Quat | Orientation | Every frame | |
| health | float | Current HP | On damage | |
| enemy_type | string | Type identifier | On creation | |
| ai_state | enum | Current AI state | On state change | |
| target_id | uint64 | Current target | On target change | |
| | | | | |

---

#### [Object Type 3]

| Attribute | Type | Description | Update Frequency | Setter Function |
|-----------|------|-------------|------------------|-----------------|
| | | | | |

---

**(Repeat for ALL object types from Section 4.1)**

---

### 5.2 Relationship Attributes

**Which objects reference other objects?**

| Object Type | References | Attribute Name | Reference Type |
|-------------|------------|----------------|----------------|
| Weapon | Owner (Player) | owner_id | uint64 |
| Projectile | Shooter (Player) | shooter_id | uint64 |
| AI Entity | Target (Player) | target_id | uint64 |
| Vehicle | Driver (Player) | driver_id | uint64 |
| Child Object | Parent | parent_id | uint64 |
| | | | |

**How will we resolve these references during restoration?**  
Strategy: Two-pass restoration
- Pass 1: Create all objects (store LudeoObjectId → GameObjectId mapping)
- Pass 2: Resolve references using mapping

---

### 5.3 Attribute Naming Conventions

Use consistent naming for SDK attributes:

| Game Concept | SDK Attribute Name |
|--------------|-------------------|
| Position | `position` |
| Rotation | `rotation` |
| Health | `health` |
| Maximum Health | `max_health` |
| Is Dead | `is_dead` |
| Owner reference | `owner_id` |
| Type identifier | `type` or `[object]_type` |

---

## ✅ **Object Research Checklist**

Before moving to tracking implementation:

- [ ] All object types identified
- [ ] Creation/destruction patterns documented
- [ ] Object ID system documented (stable IDs!)
- [ ] All attributes for each object type listed
- [ ] Setter functions identified for each attribute
- [ ] Relationship attributes identified
- [ ] Reference resolution strategy planned

---

## 🔗 **Related Documentation**

- [../06-TRACKING-PATTERNS.md](../06-TRACKING-PATTERNS.md) - Tracking implementation details
- [../08-CODE-PATTERNS.md](../08-CODE-PATTERNS.md) - Capture macros and helpers
- [../00-CRITICAL-REQUIREMENTS.md](../00-CRITICAL-REQUIREMENTS.md) - Mandatory rules

---

**Next:** After completing object research, proceed to tracking implementation using [../06-TRACKING-PATTERNS.md](../06-TRACKING-PATTERNS.md)

