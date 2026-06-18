---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

# UGameFrameworkComponent::GetGameInstance() requires template parameter

`UGameFrameworkComponent::GetGameInstance()` (base class of `UGameStateComponent`) is a template method. Calling it without a template argument causes:

```
error C2672: 'UGameFrameworkComponent::GetGameInstance': no matching overloaded function found
note: could not deduce template argument for 'T'
```

**Fix:** Always specify the template parameter:
```cpp
// WRONG:
UGameInstance* GI = GetGameInstance();

// CORRECT:
UGameInstance* GI = GetGameInstance<UGameInstance>();
```
