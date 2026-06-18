---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 7
question: null
sanitized: true
---

# Use FGameplayTagContainer::Filter() — not iterate-and-break

When a tag container has multiple tags under the same parent (e.g., `GameplayEffect.DamageType.Basic` AND `GameplayEffect.DamageType.Rifle`), iterating with `break` on the first match picks whichever tag comes first in the container — usually the wrong one.

**Wrong:**
```cpp
for (const FGameplayTag& Tag : Payload.InstigatorTags)
{
    if (Tag.ToString().Contains("DamageType"))
    {
        ReportAction(KillerID, TagStr);
        break; // Always picks Basic because it comes first
    }
}
```

**Right:**
```cpp
static const FGameplayTag DamageTypeParent = FGameplayTag::RequestGameplayTag(TEXT("GameplayEffect.DamageType"));
FGameplayTagContainer DamageTypeTags = Payload.InstigatorTags.Filter(FGameplayTagContainer(DamageTypeParent));
for (const FGameplayTag& DamageTag : DamageTypeTags)
{
    ReportAction(KillerID, DamageTag.GetTagName().ToString());
}
```

`Filter()` returns ALL matching child tags. Sending all of them is correct — the consumer decides which to use.
