---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 4
question: null
sanitized: true
---

# Missing GameMetadata writable object silently breaks Ludeo creation

If the `GameMetadata` writable object is not created during Creator Flow, highlights will record successfully but **cannot be converted into Ludeos**. The failure is silent — there are no SDK errors, no log warnings, and the overlay shows the highlight was captured. The problem only surfaces when a user tries to create a Ludeo from the highlight in Studio Labs.

**Root cause:** The backend requires `MapName` from the GameMetadata object to know which map to load for the Ludeo. Without it, the Ludeo cannot be created.

**Why this was missed:** The existing learning (`architecture/game-metadata-writable-object-required.md`) frames GameMetadata as needed for Player Flow map travel. But the real impact is more fundamental — without it, **Ludeo creation itself fails**, not just Player Flow. The learning should have been loaded during Stage 3 state tracking implementation, and the skill should have flagged its absence during compile-fix.

**How to apply:** During Stage 3 implementation, verify that `CreateWritableObjects()` creates a `"GameMetadata"` writable object BEFORE any entity objects. Add a compile-time or runtime check — if `GameMetadataObject` is not set after `CreateWritableObjects()`, log an error. This is not optional metadata; it is a hard requirement for Ludeo creation.

**Detection:** If a user reports "highlights record but can't create Ludeos," check for a missing GameMetadata object first.
