---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# Close any open pause / non-ludeoable span before EndGameplay

If the match ends while a span is still open, send its **end** action before calling `EndGameplay`. Otherwise the recording carries a dangling start marker with no matching end — and for a pause span, the objective timer stays stopped for the rest of the run.

Close whichever span is actually open, by its own trigger type (phase 03 §5.9.1) — a **pause** closes with `ResumeLudeo` in either flow, **not** with `StopNoneLudeable`, which is the non-ludeoable-area type and leaves the timer running:

```cpp
// In EndGameplay(), BEFORE bGameplayActive flips (the send bails on !bGameplayActive):
if (bTriggerSpanOpen && RoomHandle is valid)
{
    SendAction("ResumeLudeo");        // pause span — either flow
    bTriggerSpanOpen = false;
}
if (bNonLudeoableSpanOpen && RoomHandle is valid)
{
    SendAction("StopNoneLudeable");   // non-ludeoable area span — separate call site, separate flag
    bNonLudeoableSpanOpen = false;
}
bWasPausedLastFrame = false;
bMenuOverlayOpen    = false;
```

Order matters: both sends bail on `!bGameplayActive`, so run this before that flag flips. Also reset the span flags (and `bMenuOverlayOpen`) here so nothing carries into the next match — a span flag left `true` makes the next run's first pause hit the idempotency guard and never get reported.
