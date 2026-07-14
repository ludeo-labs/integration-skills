---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 1
question: "Has your Steam user been added to the game's environment in Studio Labs?"
sanitized: true
---

# Steam user must be added to the Studio Labs environment for Ludeo creation

If the Steam user used during session activation is not added to the game's environment in Studio Labs, Ludeo creation from highlights will **silently fail**. No SDK error is produced — the creation just doesn't work.

**Symptoms:**
- Highlights capture successfully (video uploads, no SDK errors)
- `canCreateLudeo=true` in consent callback
- SDK logs show no errors
- But creating a Ludeo from the highlight in Creator Lab silently fails

**Root cause:** The Steam user ID (used during authentication) must be registered in the game's Studio Labs environment. Without this, the backend rejects the Ludeo creation silently.

**How to fix:** In Studio Labs → Environments → select your environment → add the Steam user.

**How to apply:** During Stage 0 setup, always ask: "Has your Steam user been added to the game's environment in Studio Labs?" This should be part of the pre-flight checklist before any testing.

**Why this is hard to diagnose:** Every code-level indicator shows success — session activation succeeds, consent shows CanCreate=1, highlights capture with video, SDK logs are clean. The failure is entirely on the backend side with no feedback to the SDK.
