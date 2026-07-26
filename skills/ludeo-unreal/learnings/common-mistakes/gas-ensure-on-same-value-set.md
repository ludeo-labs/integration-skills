---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "Does the game's attribute set have ensure/check guards on value-unchanged callbacks?"
sanitized: true
---

# SetNumericAttributeBase triggers ensure when setting to the same value

## Problem

Calling `UAbilitySystemComponent::SetNumericAttributeBase(Attribute, Value)` when the attribute already has that value triggers `ensure(Data.OldValue != Data.NewValue)` in the game team's `UGamePawnAttributeSet`. The ensure fires because GAS broadcasts `OnAttributeChangeData` even when the value didn't actually change, and the game team's handler asserts this shouldn't happen ("expensive no-op").

In Player Flow, this fires when restoring Health/Armor to the same value the character already has at spawn (e.g., Armor = 0 when no armor is equipped).

## Fix

Before calling `SetNumericAttributeBase`, read the current value and skip if it matches:

```cpp
float CurValue = ASC->GetNumericAttribute(Attribute);
if (!FMath::IsNearlyEqual(CurValue, TargetValue))
{
    ASC->SetNumericAttributeBase(Attribute, TargetValue);
}
```

## How to Apply

In any Player Flow health/attribute restoration code, always check current value before setting. This applies to any game that overrides `PostGameplayEffectExecute` or registers `OnAttributeChange` callbacks with same-value guards.
