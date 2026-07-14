---
category: save-systems
tier: universal
sourceGame: VoyagerV2
phase: 8
question: null
sanitized: true
---

# SaveWorld "definitive failure" was precondition-specific, not universal

In Stage 3, SaveWorld was tested 5 ways and all failed. The conclusion was recorded as "Manual approach is the ONLY option" (tier: universal). This was wrong — it should have been tier: generalizable with precondition "BP variables lack SaveGame flags."

The actual failure modes:
1. AllProperty filter → crash on unsupported property types (universal — can't use AllProperty)
2. CPF_SaveGame filter → empty results (PRECONDITION: no flags set)
3. PropertyName with component refs → crash (universal — cross-refs to unregistered objects)
4. PropertyName value-only → empty (properties on components, not actor)
5. SaveGameToSlot → only metadata (PRECONDITION: USaveGame BP vars also lack flags)

Mode 2 is fixable: set SaveGame flags programmatically via `bp_inspector.py set-savegame`. Once flags are set, the CPF_SaveGame filter should find them.

**Meta-learning:** "All approaches failed" conclusions from empirical tests should always record the preconditions that held during testing. A future change in preconditions (like programmatic flag setting) can invalidate the conclusion.
