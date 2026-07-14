---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 3
question: null
sanitized: true
---

# Never claim "verified" or "complete" based on compilation alone

Compilation proves the code builds. It does not prove it works. After compile-fix passes:

1. Present the runtime testing checklist to the human
2. Wait for the human to test and report results
3. Only mark the stage complete after the human confirms

**Wrong:** "Stage 5 is fully verified — both UBT compile and full BuildCookRun package pass cleanly."
**Right:** "Compile and package passed. Here's the testing checklist — please run the game and verify: [list]. I'll update the TDD after you confirm."

This applies to every stage, not just Stage 5. The skill's Step 7 "Functional completeness check" requires runtime evidence, not just build success.
