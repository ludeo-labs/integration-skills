---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# FLudeoSessionOnActivatedDelegate has 3 params, not 2

`FLudeoSessionOnActivatedDelegate` is declared as:
```cpp
DECLARE_DELEGATE_ThreeParams(
    FLudeoSessionOnActivatedDelegate,
    const FLudeoResult&,        // Result
    const FLudeoSessionHandle&, // SessionHandle
    const bool                  // bIsLudeoSelected
);
```

The third param `bIsLudeoSelected` indicates whether a Ludeo was already selected at activation time (e.g., from a launch argument). Missing this param causes a delegate signature mismatch compile error.

**Fix:** Always include all three parameters in the callback handler:
```cpp
void OnSessionActivated(const FLudeoResult& Result, const FLudeoSessionHandle& InSessionHandle, const bool bIsLudeoSelected);
```
