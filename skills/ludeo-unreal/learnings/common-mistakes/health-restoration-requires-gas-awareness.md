---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: 5
question: "Does the game use GAS (Gameplay Ability System) for health? If so, health cannot be set via a simple setter — it requires a gameplay effect or direct attribute modification."
sanitized: true
---

# Health restoration in GAS-based games requires deferred application

In games using UE's Gameplay Ability System (GAS), health is a gameplay attribute managed by `UAbilitySystemComponent`. You cannot set it directly via a component setter like `HealthComponent->SetHealth(value)`.

**Wrong approach (silently fails):**
```cpp
// ULyraHealthComponent has GetHealth() but no SetHealth()
// Logging "deferred" and doing nothing means health is never restored
UE_LOG(LogLudeo, Log, TEXT("Health restoration deferred"));
```

**Correct approach — deferred attribute modification:**
```cpp
void ApplyPendingHealth(APawn* Pawn, float TargetHealth)
{
    UAbilitySystemComponent* ASC = UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(Pawn);
    if (!ASC) return;

    // Wait for ASC to be initialized (may not be ready at BeginPlay)
    // Use a timer or delegate to defer if needed

    // Option 1: Direct attribute set (works for restoration)
    ASC->SetNumericAttributeBase(ULyraHealthSet::GetHealthAttribute(), TargetHealth);

    // Option 2: Apply a gameplay effect that sets health
    // More correct but more complex — use for production
}
```

**Key insight:** The ASC may not be initialized when ApplyPlayerState runs. The reference integration uses `ApplyPendingHealth()` with deferred application — it stores the target health and applies it when the ASC signals readiness.
