---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# FTSTicker::FDelegateHandle is scoped in UE 5.7

In UE 5.7, `FTSTicker::GetCoreTicker().AddTicker()` returns `FTSTicker::FDelegateHandle`, not the global `FDelegateHandle`. Storing the result in `FDelegateHandle` causes:

```
error C2679: binary '=': no operator found which takes a right-hand operand of type 'FTSTicker::FDelegateHandle'
```

**Fix:** Declare ticker handles as `FTSTicker::FDelegateHandle`:
```cpp
// WRONG:
FDelegateHandle SDKTickerHandle;

// CORRECT:
FTSTicker::FDelegateHandle SDKTickerHandle;
```

Requires `#include "Containers/Ticker.h"` in the header file.
