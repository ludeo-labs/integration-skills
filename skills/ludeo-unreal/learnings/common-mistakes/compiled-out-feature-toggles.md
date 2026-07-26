---
category: common-mistakes
tier: generalizable
sourceGame: ActionRoguelike
phase: 6
question: "Does the game use preprocessor feature toggles (#define USE_X 0/1) that may compile out event systems or messaging?"
sanitized: true
---

# Feature toggle defines may compile out event systems

ActionRoguelike has `#define USE_TAGMESSAGING_SYSTEM 0` in ActionRoguelike.h. The `Message_MonsterKilled` broadcast in RogueAICharacter is inside `#if USE_TAGMESSAGING_SYSTEM`, so the kill message is never sent.

**Symptom:** Messaging subsystem listener is bound but callback never fires.

**Fix:** Before hooking into any game event system, grep for `#if` / `#define` guards around the broadcast code. If the feature is toggled off, use an alternative hook (e.g., `OnDestroyed` delegate instead of a message listener).

**Prevention:** During Stage 1 analysis, check for feature toggle defines: `Grep("#define USE_", glob: "*.h")` in the game module header.
