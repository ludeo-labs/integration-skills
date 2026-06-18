---
category: common-mistakes
tier: generalizable
sourceGame: EndlessFPS
phase: 2
question: "Before hooking a fix to an SDK callback (OnPauseGameRequested, OnResumeGameRequested, etc.), have you confirmed it actually FIRES in the scenario you're targeting? Add an entry-log to the handler and grep the log for it — don't assume."
sanitized: true
---

# Confirm an SDK callback actually fires before building a fix on it

## What happened

To make the Ludeo overlay's "Play Moment" button clickable, the first fix released the mouse inside `OnPauseGameRequested`, on the assumption that the SDK pauses the game (fires that callback) when it shows the interactive overlay. It didn't work — and the reason was that `OnPauseGameRequested` **never fired**: grepping the run log showed **0 occurrences** of both `OnPauseGameRequested` and `OnResumeGameRequested`. The handler was dead code; the SDK was managing overlay input internally (`LudeoBlockGameMouseInput`). A whole implement-build-test cycle was spent on a callback that never ran.

## The rule

Before you hook behavior to an SDK callback, **prove it fires in the exact scenario** you're targeting:

1. Make sure the handler logs on entry (e.g. `UE_LOG(... "OnPauseGameRequested ...")`).
2. Reproduce the scenario, then `grep -c` the log for that line.
3. If it's 0, the callback isn't your hook — find the real signal (read the SDK's own overlay/session log lines; the SDK often narrates what it's doing — e.g. `LudeoBlockGameMouseInput`, `swapScreen 'PrePlayScreen'`).

This is a 30-second check that prevents building (and shipping) a fix wired to an event that never arrives. Especially important with the Ludeo SDK, where some behaviors (overlay input, overlay screens) are handled **internally** and are visible in the SDK log but are **not** surfaced as UE delegates.

## Corollary

The SDK's own log is the source of truth for "what fired and when." When a callback-based fix doesn't work, read the SDK log around the moment of interest before assuming your code is wrong — the event you expected may simply not exist as a callback.
