---
category: save-systems
tier: universal
sourceGame: VoyagerV2
phase: 8
question: "Are the game's SaveGame-flagged properties on BP components (HealthComp, EnergyComp) or directly on the actor class?"
sanitized: true
---

## SaveWorld Cannot Reach Properties Inside BP Components

### Problem

SaveWorld with CPF_SaveGame filter only writes properties it can *reach* through the object hierarchy. For BP-component-based architectures where gameplay state lives in nested components (HealthComp.Health, EnergyComp.EnergyValue, StatsComp.XPTotal), SaveWorld cannot capture these properties even with CPF_SaveGame flags set on both the component variables AND the component references.

### Evidence (VoyagerV2, 3 attempts)

**Attempt 1 — Flag component variables only:**
- Set CPF_SaveGame on 13 value properties (Health, MaxHealth, IsAlive, etc.) inside 5 BP components
- Added ACharacter + CPF_SaveGame spec to SaveGameManager
- Result: SaveWorld ran without crash but wrote ZERO component-level attributes
- Cause: Component *reference* properties on ACharacter (HealthComp, EnergyComp as UObject*) don't have CPF_SaveGame → traversal stops at actor level

**Attempt 2 — Flag component references + add UActorComponent spec:**
- Extended SetSaveGameFlag() to handle SCS component properties via GeneratedClass->FindPropertyByName()
- Set CPF_SaveGame on 5 component reference properties (HealthComp, EnergyComp, StatsComp, InventoryComp, WeaponComp)
- Added UActorComponent::StaticClass() spec entry so discovered components have a matching handler
- Result: Still wrote ZERO component attributes in packaged build
- Cause: FProperty::SetPropertyFlags() on compiled GeneratedClass doesn't persist — SCS component properties are serialized from SCS node metadata, not compiled FProperty flags. The flags existed in the editor session but were lost during cook/package.

**Attempt 3 — Player Flow assertion:**
- Even if component data had been written, Player Flow hit an assertion during RestoreWorld

### Why FPSGameStarterKit Works

FPSGameStarterKit's SaveGame-flagged properties (`isDead`, `HealthCurrent`, `EquippedWeapon`) are defined **directly on the character BP class** as regular BP variables (in `NewVariables`), not inside nested component objects. SaveWorld's ACharacter spec directly reaches these properties without needing to traverse component references.

### Precondition Check

**If a game stores gameplay state in BP components (HealthComp.Health rather than Character.Health), SaveWorld cannot capture those properties.** Use manual WritableObject.WriteData with reflection helpers instead.

### Approaches That Failed

1. Setting CPF_SaveGame on component value properties (necessary but not sufficient)
2. Setting CPF_SaveGame on component reference properties via FProperty::SetPropertyFlags (doesn't persist in packaged build)
3. Adding UActorComponent spec entry (correct approach IF refs were flagged, but refs can't be persistently flagged for SCS components)

### What Works

Manual reflection via `WritableObject.WriteData()` with `FindComponentByNameSubstring()` + `CastField<FDoubleProperty/FIntProperty/FBoolProperty>()`. This bypasses SaveWorld entirely and writes each property individually.
