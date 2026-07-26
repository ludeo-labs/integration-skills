---
category: save-systems
tier: generalizable
sourceGame: VoyagerV2
phase: 4
question: "Do the game's Blueprint/USaveGame properties have the SaveGame flag checked? If NO, SDK-automated serialization (SaveWorld, SaveGameToSlot, the CPF_SaveGame filter) yields empty attributes and manual WritableObject.WriteData is required — UNLESS you set the SaveGame flags programmatically (bp_inspector.py set-savegame), which can flip this precondition. The AllProperty filter and component cross-references crash (line 448) regardless of flags."
sanitized: true
---

# Complete SaveWorld Experiment Results (VoyagerV2)

> **Correction (2026-05-28):** Originally tagged `universal` with the conclusion "manual is the ONLY option." That overstated it — see `saveworld-previous-failure-was-precondition-specific.md`. The real precondition is **BP variables lacking the SaveGame flag**; setting those flags programmatically (`bp_inspector.py set-savegame`) can make the `CPF_SaveGame` filter work. The `AllProperty` filter and component cross-reference crashes (line 448) are genuine SaveWorld limitations regardless of flags.

Tested every SDK serialization approach on a Blueprint-only game with component-based architecture **whose BP variables lacked the SaveGame flag**. Under that precondition, all automated approaches failed and manual reflection was required.

## Approaches Tested

| Approach | Result | Why |
|----------|--------|-----|
| SaveWorld + AllProperty | CRASH (line 448) | Unsupported property types on engine actors |
| SaveWorld + CPF_SaveGame flag | Empty attributes | BP vars don't have SaveGame flag |
| SaveWorld + PropertyName (value types) | Empty attributes | Properties on components, not actor |
| SaveWorld + PropertyName (with component refs) | CRASH (line 448) | Cross-referenced components not in ObjectMap |
| SaveGameToSlot via BPI_SaveGame | Only StateID metadata | USaveGame BP properties also lack SaveGame flag |
| Manual WritableObject.WriteData | **WORKS** | Explicit reflection reads values directly |

## Decision Tree for Stage 1

1. Check if game properties have SaveGame flag → If YES, SaveWorld works
2. Check if game has C++ actors with UPROPERTY(SaveGame) → If YES, SaveWorld works
3. If Blueprint-only with no SaveGame flags → use the **manual** approach, OR set the SaveGame flags programmatically first (`bp_inspector.py set-savegame`) to enable the `CPF_SaveGame` filter (see correction above)
4. The game's own save system (BPI_SaveGame) uses function calls, not UPROPERTY serialization — it's a separate path that can't be bridged to Ludeo's UPROPERTY-based system
