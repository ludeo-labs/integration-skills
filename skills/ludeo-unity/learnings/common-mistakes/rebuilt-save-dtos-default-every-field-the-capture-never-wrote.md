---
category: common-mistakes
tier: generalizable
sourceGame: IdleSample
phase: "5,8"
question: "Does any restore module rebuild a game save object (new XSaveData { ... }) from captured attributes and hand it to the game's own load method, and has the game's code changed since that module was written (merge, update, patch)?"
sanitized: true
---

# A rebuilt save DTO silently defaults every field the capture never wrote

Restoring through the game's own `LoadFromSaveData(new XSaveData{…})` is the right pattern. But a field
added to `XSaveData` after the module was written is restored at its C# default, and the round-trip test
cannot see it: the capture never wrote it, the verify never checks it, drift is 0. One merge of the
shipped game into the integration branch brought dozens of new save fields across several modules.

## After any game update

1. **Diff** every save DTO class and load method the modules touch between the old and new revision.
2. **Classify each new field:** capture (persistent, or shapes the moment), skip (short-lived), or
   derived (the load recomputes it; then make sure your fresh DTO does not zero something the game set
   on scene load that a later re-assert pass would wipe).
3. **Re-check** reset paths your restore relies on, mechanics that changed (a counter that became
   derived), and fixture ids the update deleted. Fixtures silently drop to fewer written values, so
   compare the per-module written counts before and after the update; a big drop is a stale fixture,
   not a pass.
4. **Re-measure the attribute-name budget**; updates push it up.

Related: [[check-the-integration-branch-base-against-the-shipped-game]].
