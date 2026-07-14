---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

The deferred activation retry pattern must guard against stacking multiple tickers. If `OnSessionActivated` receives a failure and starts an `FTSTicker` retry, and the retry also fails (e.g., same parameter error), the callback fires again and starts ANOTHER ticker. This creates an infinite loop of activation attempts — every frame, forever.

**Prevention:** Check `DeferredActivationTickerHandle.IsValid()` before creating a new ticker:

```cpp
if (!DeferredActivationTickerHandle.IsValid())
{
    DeferredActivationTickerHandle = FTSTicker::GetCoreTicker().AddTicker(...);
}
```

The implementation guidance in phase-02 Section 7.4 (class skeletons) should include this guard in the `OnSessionActivated` failure path. The skeleton currently creates a new ticker unconditionally on every failure, which is the exact bug pattern.
