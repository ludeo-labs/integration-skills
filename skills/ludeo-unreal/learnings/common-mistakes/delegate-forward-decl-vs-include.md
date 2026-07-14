---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# DECLARE_DELEGATE types cannot be forward-declared as structs

A delegate declared with `DECLARE_DELEGATE_OneParam(FOnRoomTeardownComplete, bool)` generates a type that is NOT a plain struct. Forward-declaring it as `struct FOnRoomTeardownComplete;` causes:

```
error C2371: 'FOnRoomTeardownComplete': redefinition; different basic types
error C2079: 'TeardownCallback' uses undefined struct 'FOnRoomTeardownComplete'
```

**Fix:** Include the header that defines the delegate, don't forward-declare it:
```cpp
// WRONG:
struct FOnRoomTeardownComplete;  // Forward declaration fails

// CORRECT:
#include "LudeoSessionSubsystem.h"  // Where DECLARE_DELEGATE is
```
