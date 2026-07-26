---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 8
question: null
sanitized: true
---

# GAS CapturedSourceTags includes GE asset tags — not just actor tags

In `GameplayEffect.cpp` line 1683 during FGameplayEffectSpec initialization:

```cpp
CapturedSourceTags.GetSpecTags().AppendTags(Def->GetAssetTags());
```

This means `CapturedSourceTags.GetAggregatedTags()` (which becomes `InstigatorTags` in FLyraVerbMessage) contains BOTH:
- The source actor's gameplay tags (from ASC)
- The GameplayEffect definition's own asset tags (e.g., `GameplayEffect.DamageType.Rifle`)

When looking for DamageType in an elimination message, check `InstigatorTags` — the data is already there. No core game modification needed to populate it. The GE asset tags (configured in Blueprint) are automatically captured into the spec's source tags by the engine.
