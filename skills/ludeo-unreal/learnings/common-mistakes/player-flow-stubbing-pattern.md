---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: 5
question: null
sanitized: true
---

# Player Flow Stubbing Pattern

## The Problem

The agent consistently stubs Player Flow (read side) in Stage 3 and claims the stage complete. Creator Flow (write side) is self-verifiable via logs, so it gets implemented fully. Player Flow requires a captured Ludeo to test, so the agent defers it with stubs like `// TODO: apply state` or `/* Stage 7 */`.

## Why It Happens

1. **Compile gate passes stubs.** The agent's compile-fix loop succeeds, and that success feeling overrides the output contract.
2. **Self-graded verification.** The agent checks "is it implemented?" against its own code. A `PlayLudeo()` that logs and stores a LudeoID *feels* implemented — it does something.
3. **Stages 3+4 combined.** When both stages are planned together, the agent rushes to get both "complete" and defers the hardest part of Stage 3 (Player Flow) so it can move to Stage 4 (actions), which is more interesting and more verifiable.
4. **Human verification focuses on Creator Flow first.** The agent presents "check logs for write activity" and the human confirms. By the time Player Flow testing would happen, the agent has already claimed done.

## The Fix

**Mandatory execution order in Stage 3:**
1. Creator Flow → compile → verify writes
2. Player Flow subsystem (GetLudeo + read + travel) → compile
3. Player Flow component (apply state) → compile
4. Human tests end-to-end (capture → playback → confirm positions)
5. ONLY THEN → Stage 4

**Never combine Stages 3 and 4 in a single plan.** Stage 4 actions are meaningless if Player Flow doesn't work — highlights can't be played back.

## Red Flags (if you catch yourself thinking these, stop)

- "Creator Flow verified, moving to actions"
- "The entry point exists, it'll connect when tested"
- "Player Flow deferred to testing phase"
- "ApplyState is implemented — it calls ReadData" (but the data is never applied to actors)
- "Stage 3+4 complete" (never combine them)
