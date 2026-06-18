---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 2
question: null
sanitized: true
---

# UActorComponent has no GetGameInstance()

When using `UActorComponent` as the base class for `ULudeoGameStateComponent` (instead of `UGameStateComponent` from ModularGameplay), `GetGameInstance()` is not available.

**Wrong:**
```cpp
ULudeoSessionSubsystem* Sub = GetGameInstance()->GetSubsystem<ULudeoSessionSubsystem>();
```

**Correct:**
```cpp
ULudeoSessionSubsystem* Sub = UGameplayStatics::GetGameInstance(this)->GetSubsystem<ULudeoSessionSubsystem>();
```

Requires `#include "Kismet/GameplayStatics.h"`.
