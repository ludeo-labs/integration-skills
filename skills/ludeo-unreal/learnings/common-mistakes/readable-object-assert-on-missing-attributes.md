---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 4
question: null
sanitized: true
---

The Ludeo SDK asserts (crashes) when ReadData() is called for an attribute that doesn't exist in the Ludeo data. This includes:
- `FScopedLudeoDataReadWriteEnterObjectGuard` asserts on `EnterObject()` / `EnterComponent()` if the object/component doesn't exist
- `ReadData("AttributeName", value)` asserts if the attribute was never written

**This means you cannot read attributes from an old Ludeo after adding new attributes to the write side.** If you add a new attribute (e.g., "ClassPath", "IsAlive") to WriteAIState, all previously captured Ludeos will crash when replayed because ReadData tries to read attributes that don't exist in the old data.

**Fix:** When adding new write attributes, you must re-record a new Ludeo before testing Player Flow. There is no graceful fallback — the SDK asserts, not returns false.

**Prevention:** Document all tracked attributes and version them. If the attribute set changes, communicate to QA that old Ludeos are incompatible.
