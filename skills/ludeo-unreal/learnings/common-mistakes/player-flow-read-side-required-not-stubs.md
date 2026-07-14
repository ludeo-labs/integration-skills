---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 5
question: null
sanitized: true
---

Player Flow read side (ApplyPlayerState, ApplyBotStates) is REQUIRED for Stage 3 completion. Stubs are NOT acceptable. The Phase 03 reference says: "This stage produces a working end-to-end integration: Creator flow captures state, Player Flow restores and replays it."

The skill's pre-flight checklist and compile-fix hard gate don't catch this because stubs compile fine. The skill needs:
1. A hard gate: "Player Flow read side is implemented (not stubs)"
2. Implementation guidance in Section 7 for the read side (not just patterns in Section 5)
3. A functional verification step after compile: "Test Player Flow by playing back a Ludeo"

This learning replaces the earlier `player-flow-read-side-required-stage3.md` with more specific guidance on what went wrong and how to prevent it.
