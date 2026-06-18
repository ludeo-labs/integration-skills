---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 5
question: null
sanitized: true
---

# FNativeGameplayTag cross-module linker error

When a plugin DLL references `FNativeGameplayTag` variables declared with `UE_DECLARE_GAMEPLAY_TAG_EXTERN` in the game module, you get unresolved external symbol linker errors. The tags are not DLL-exported.

**Wrong (causes LNK2001):**
```cpp
#include "SharedGameplayTags.h"
ActionComp->GetAttributeValue(SharedGameplayTags::Attribute_Health);
```

**Correct — use lazy-init RequestGameplayTag:**
```cpp
namespace LudeoTags
{
    static FGameplayTag GetHealthTag()
    {
        static FGameplayTag Tag = FGameplayTag::RequestGameplayTag(TEXT("Attribute.Health"));
        return Tag;
    }
}
// Usage:
ActionComp->GetAttributeValue(LudeoTags::GetHealthTag());
```

This matches the skill's guidance in Section 3.2.1 about using lazy-init tag helpers. The actual tag string ("Attribute.Health") must match the `UE_DEFINE_GAMEPLAY_TAG` definition.
