---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

# FGameplayTag::RequestGameplayTag cannot be used in static/global initialization

Using `RequestGameplayTag` to initialize a static or global `FGameplayTag` variable causes a runtime ensure failure:

```
Ensure condition failed: false
Requested Gameplay Tag ShooterGame.GamePhase.Playing was not found, tags must be loaded from config or registered as a native tag
```

The GameplayTags system hasn't loaded tag config files yet when static initializers run (DLL load time).

**Fix:** Use lazy initialization via a function-local static or a getter method:
```cpp
// WRONG — runs at DLL load, before tags are registered:
const FGameplayTag UMyClass::MyTag = FGameplayTag::RequestGameplayTag(FName(TEXT("My.Tag")));

// CORRECT — lazy init, first call happens at runtime when tags are loaded:
FGameplayTag UMyClass::GetMyTag() const
{
    static const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(TEXT("My.Tag")));
    return Tag;
}
```
