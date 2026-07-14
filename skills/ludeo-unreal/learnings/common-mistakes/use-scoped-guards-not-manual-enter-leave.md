---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 5
question: null
sanitized: true
---

# Use FScopedLudeoDataReadWriteEnterObjectGuard instead of manual EnterObject/LeaveObject

The SDK provides `FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject>` (RAII pattern) to ensure `EnterObject()`/`LeaveObject()` calls are always balanced, even on early returns or exceptions. The Lyra reference uses this pattern exclusively.

**Wrong pattern:**
```cpp
if (WritableObj->EnterObject())
{
    WritableObj->WriteData("Location", Actor->GetActorLocation());
    // If something fails here, LeaveObject() might not be called
    WritableObj->LeaveObject();
}
```

**Correct pattern:**
```cpp
{
    const FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> Guard(*WritableObj);
    WritableObj->WriteData("Location", Actor->GetActorLocation());
} // LeaveObject called automatically by destructor
```

**Required include:** `#include "LudeoUESDK/LudeoScopedGuard.h"`

**How to apply:** When generating state tracking code in any stage, always use the scoped guard pattern. Never generate manual `EnterObject()`/`LeaveObject()` pairs.
