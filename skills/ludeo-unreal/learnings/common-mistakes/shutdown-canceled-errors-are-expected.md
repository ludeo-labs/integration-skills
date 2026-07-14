---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 3
question: null
sanitized: true
---

# LudeoResult::Canceled errors during shutdown are expected — not bugs

When the game exits without completing the full async teardown chain (EndGameplay → RemovePlayer → CloseRoom → Session Release), the SDK logs errors like:

```
[Ludeo] Core: Error: ludeo_GameplaySession_End failed with LudeoResult::Canceled
[Ludeo] Session: Error: Session0:T7_SessionDestroyTask: Finished with LudeoResult::Canceled
[Ludeo] Core: Error: ludeo_Room_Close failed with LudeoResult::Canceled
```

These are expected when the game shuts down while async operations are still in flight. The SDK cancels pending operations during shutdown.

**When to ignore:** During normal game exit or crash scenarios.
**When to investigate:** If `Canceled` appears during active gameplay (not shutdown), it indicates the teardown chain was triggered prematurely.

**How to apply:** When triaging SDK log errors, filter out `LudeoResult::Canceled` errors that appear in the final log entries (near game exit). Focus on errors during active gameplay instead.
