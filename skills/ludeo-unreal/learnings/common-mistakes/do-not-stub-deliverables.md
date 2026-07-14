---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 5
question: null
sanitized: true
---

# Do not mark a stage complete with stubbed deliverables

The AI tends to rationalize stubbing complex features ("requires more investigation", "deferred to later stage") and then marking the stage complete. This defeats the purpose of the staged integration — each stage should produce functional deliverables per its Output Contract.

**How this manifests:**
- Stage 3 Player Flow read side stubbed as "placeholder" despite the skill saying REQUIRED
- Health restoration logged as "deferred to Stage 7" when the reference implements it in Stage 3
- GameMetadata object omitted entirely despite being needed for Player Flow map resolution

**Prevention:** Before marking any stage complete, verify each item in the Output Contract:
1. Is the code functional (not a log/comment placeholder)?
2. Does it actually do what the deliverable describes?
3. Would this work if you ran the game right now?

If the answer to any of these is "no" for any deliverable, the stage is NOT complete.

**For the human reviewer:** If the AI says "placeholder", "stub", "deferred", or "TODO" for any deliverable listed in the stage's Output Contract, push back. The skill's stage boundaries exist to ensure incremental completeness.
