---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 3
question: null
sanitized: true
---

# Audit every bIsPlayerFlow guard — only state writing should be gated

After implementing each stage, audit every `bIsPlayerFlow` check in the component. The ONLY code paths that should be gated are:

- `CreateWritableObjects()` — no writable objects in Player Flow
- `UpdateWritableObjects()` — no state writing in Player Flow
- `RegisterEntity()` with writable object creation — Creator Flow only

Everything else must work in BOTH flows:
- `SendAction()` calls — actions are needed for scoring in Player Flow
- `OnActorSpawned` entity tracking — spawned enemies must be tracked for kill detection
- `DetectPollBasedActions()` — poll-based kill/death/weapon detection
- `RegisterActionListeners()` — action infrastructure setup
- `OnAIDestroyed()` — event-based kill detection

**Pattern to watch for:** Code that calls `SendAction` inside a `if (!bIsPlayerFlow)` block, or entity tracking gated by `if (bIsPlayerFlow) return`. These are always bugs.

**Enforcement:** At the end of each code-producing stage, grep for `bIsPlayerFlow` and verify each occurrence. If a guard is near a `SendAction` call or entity tracking, it's wrong.
