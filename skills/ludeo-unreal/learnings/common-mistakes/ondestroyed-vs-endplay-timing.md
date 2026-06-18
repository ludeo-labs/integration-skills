---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 5
question: null
sanitized: true
---

# OnDestroyed may not fire before component EndPlay

When detecting player death via the pawn's OnDestroyed delegate, the delegate may never fire if:
- The pawn has SetLifeSpan(5.0f) on death (stays alive for 5s)
- The game exits or map changes before the lifespan expires
- The component's EndPlay (safety net) fires before OnDestroyed

**For Kill detection on AI:** OnDestroyed works well — AI entities are destroyed immediately on death (corpse system replaces them).

**For Death detection on player:** OnDestroyed is unreliable. Prefer checking health <= 0 in the per-tick WritePlayerState, or use the health attribute delegate if it works cross-module. OnDestroyed can serve as a backup.
