---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 3
question: null
sanitized: true
---

# OnActorSpawned must track new AI in Player Flow too

The `OnActorSpawned` handler must register dynamically spawned AI entities in BOTH Creator Flow and Player Flow. In Creator Flow it creates writable objects; in Player Flow it adds to TrackedEntities for poll-based kill detection (no writable object needed).

**The bug:** `if (bIsPlayerFlow) return;` in OnActorSpawned skips all dynamically spawned enemies during Player Flow. Only the 5 pre-placed enemies (discovered at BeginGameplay via TActorIterator) get tracked. Result: kills on spawned enemies are invisible — user kills 12, only 2 detected.

**Root cause:** Conflating "state writing" (Creator Flow only) with "entity tracking for actions" (both flows). The guard was a shortcut to avoid creating writable objects in Player Flow, but it also blocked action tracking.

**Fix:** Two changes required:
1. Register the `OnActorSpawned` handler in Player Flow (it's normally set up inside `CreateWritableObjects()` which only runs in Creator Flow)
2. In `OnActorSpawned`, branch on flow type: Creator Flow calls `RegisterEntity()` (writable object); Player Flow adds a `FTrackedEntityInfo` with no writable object, just for action polling

**General principle:** Never use `bIsPlayerFlow` to guard entity discovery or action-related code paths. Only guard state writing (writable objects, UpdateWritableObjects). Every `if (bIsPlayerFlow) return;` outside of state writing code is a potential action-tracking bug. Audit all `bIsPlayerFlow` guards after each stage.
