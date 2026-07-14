---
category: common-mistakes
tier: generalizable
sourceGame: ActionRoguelike
phase: 5
question: "Does the game's health/damage system require an instigator actor when applying attribute changes? If so, Player Flow health restoration must provide one."
sanitized: true
---

# Player Flow health restoration must set Instigator on attribute modifications

When restoring health during Player Flow via `ApplyAttributeChange` (or equivalent), the `FAttributeModification` (or game-specific equivalent) must have its `Instigator` field set. Many games' `OnHealthChanged` handlers dereference the instigator without null checks — they assume damage always has a source.

**Crash example (ActionRoguelike):**
```
ARogueAICharacter::OnHealthAttributeChanged()
  → GetTeamAttitudeTowards(*InstigatorActor)  // InstigatorActor is nullptr → CRASH
  → UAISense_Damage::ReportDamageEvent(..., InstigatorActor, ...)
```

**Fix:** Set `Instigator` to the character itself (self-instigated) when applying health changes during Player Flow:
```cpp
FAttributeModification Mod;
Mod.AttributeTag = HealthTag;
Mod.Magnitude = TargetHealth - CurrentHealth;
Mod.Instigator = Character;  // Self — prevents null dereference in handlers
```

**Why this happens:** During normal gameplay, damage always has an instigator (the attacker). Player Flow health restoration is synthetic — there is no attacker. Game code doesn't expect this case.

**How to apply:** When generating Player Flow state restoration code that modifies health/damage attributes, always check if the game's attribute modification struct has an instigator/source field. If yes, set it to the target actor itself. Also check if handlers assume non-null instigator.
