---
category: save-systems
tier: generalizable
sourceGame: VoyagerV2
phase: 4
question: "Does this game store gameplay state on Blueprint sub-components (HealthComp, WeaponComp, etc.) rather than as direct UPROPERTY members on the actor? If yes, SaveWorld cannot reach those properties — use the game's native save interface or manual approach instead."
sanitized: true
---

# SaveWorld Cannot Serialize Blueprint Sub-Component Properties

## The Problem

ULudeoSaveGameManager::SaveWorld() traverses UPROPERTY references on matched actors. When gameplay data lives on Blueprint sub-components (HealthComp_C, WeaponComp_C, etc.), SaveWorld hits a catch-22:

1. **AllProperty filter** → Crash at LudeoWritableObject.cpp:448 (unsupported property types)
2. **CPF_SaveGame flag filter** → Empty attributes (BP vars don't have SaveGame flag checked)
3. **PropertyName filter with component refs** → Crash at line 448 (cross-referenced components not in ObjectMap — SDK asserts when writing an object reference to an unregistered object)
4. **PropertyName filter value-only** → Empty attributes (Health/Energy/etc. are on components, not on the actor)
5. **Reading empty Ludeo objects** → Crash at LudeoScopedGuard.h:84 (ReadData for attributes that were never written)

## Root Cause

SaveWorld discovers ACharacter actors correctly (they appear in the Ludeo JSON with class paths). But gameplay properties (Health, Energy, EquippedWeapon) live on dynamically-added Blueprint components, NOT as UPROPERTY members on the actor class. SaveWorld can't reach them through property traversal because:
- Component object references crash when the referenced component isn't pre-registered as a writable object
- The SDK asserts (check(false)) instead of gracefully skipping unregistered object references

## When SaveWorld Works

- C++ actors with `UPROPERTY(SaveGame)` on gameplay properties (direct members)
- Blueprint actors where the developer checked "SaveGame" on BP variables
- Standard engine classes (PlayerState, PlayerController) — the FPSGameStarterKit sample works because it tracks these

## When SaveWorld Does NOT Work

- Blueprint component-based architecture (VoyagerV2 pattern: HealthComp, WeaponComp, etc.)
- Games with BPI_SaveGame interface (different serialization path — function calls, not property traversal)
- Games with custom serializers (FFastArraySerializer, NetDeltaSerialize)

## Recommended Alternative

For component-based BP games: use the game's native save interface (e.g., BPI_SaveGame) to collect state, then pass it to Ludeo via USaveGame + SaveGameToSlot (SDK Option 1). This leverages the game's own knowledge of where state lives.
