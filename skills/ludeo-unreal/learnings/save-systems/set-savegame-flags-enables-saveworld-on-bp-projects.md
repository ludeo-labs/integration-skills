---
category: save-systems
tier: generalizable
sourceGame: VoyagerV2
phase: 7
question: "Does this BP-only project have 0 SaveGame flags on gameplay variables? If yes, use the LudeoBPInspector C++ plugin + set-savegame to flag key value properties programmatically. This may enable SaveWorld where it was previously ruled out."
sanitized: true
---

# set-savegame can enable SaveWorld on BP-only projects

> **⚠ PROVISIONAL (as of 2026-05-28):** This is a half-verified finding. SaveGame flags were set successfully, but the SaveWorld serialization itself was **never confirmed** to work end-to-end (see Status below). Treat the "Implication" section as a hypothesis, not a proven path — do not choose SaveWorld over manual WriteData on the strength of this learning alone. Verify on the target project first.

## Precondition
BP-only project where SaveWorld previously failed because no variables had the SaveGame flag (CPF_SaveGame filter produced empty results).

## The Discovery

The `bp_inspector.py set-savegame` command (backed by the LudeoBPInspector C++ plugin) can programmatically set the SaveGame flag on specific BP variables. This modifies the .uasset files on disk.

In VoyagerV2: 0/740 variables had SaveGame → set 13 flags on value properties (Health, MaxHealth, IsAlive, EnergyValue, MaxEnergyValue, XPTotal, XPLevel, Armor, GoldCount, MedkitCount, GrenadeCount, IsFiringPressed, IsSwitchingWeapons) → 13/740 flagged.

## Critical: Only flag VALUE properties

The Stage 3 SaveWorld crash was caused by object reference properties (HealthComp → WeaponComp cross-refs) being traversed into unregistered objects. Only flag:
- float/double (Health, Armor, Energy)
- int (XPTotal, GoldCount, GrenadeCount)
- bool (IsAlive, IsFiringPressed)

Do NOT flag:
- Object references (HealthComp, WeaponComp, etc.)
- Delegates (OnHealthChanged, OnXPAdded)
- Arrays of objects
- TMap with object values

## Status
Flags successfully set. SaveWorld experiment with CPF_SaveGame filter pending — need to verify it actually serializes the flagged component properties without crashing.

## Implication
If SaveWorld works with flagged value properties, it replaces manual per-entity WritableObject.WriteData code for all entities that have SaveGame-flagged components (including destructibles, companions, AI — any actor with HealthComp gets health tracking for free).
