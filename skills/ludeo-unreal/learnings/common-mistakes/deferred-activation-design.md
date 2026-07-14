---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

The deferred activation retry must be gated BEFORE calling `Session->Activate()`, not in the `OnSessionActivated` callback. The correct pattern:

1. In `ActivateSession()`: check window handle validity first. If null, start a ticker to retry later. Return without calling Activate.
2. In `TryActivateSession()` (ticker): check window handle. If still null, keep ticking. If valid, call `ActivateSession()` and stop the ticker.
3. In `OnSessionActivated()`: if success, proceed. If failure, log and stop — do NOT start a retry ticker here.

The WRONG pattern (which causes infinite loops): call `Activate()` unconditionally, then in the failure callback start a retry ticker. This retries on ALL failures (including parameter errors like missing API key), not just window-handle failures.

**Rule:** The phase-02 skeleton must implement the check-before-activate pattern, not the retry-on-failure pattern.
