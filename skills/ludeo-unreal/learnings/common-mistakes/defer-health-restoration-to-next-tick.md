---
category: common-mistakes
tier: generalizable
sourceGame: ActionRoguelike
phase: 5
question: "Does the game's OnHealthChanged handler create widgets, access mesh components, or interact with subsystems that may not be ready during early initialization?"
sanitized: true
---

# Defer Player Flow health restoration to next tick

Applying health changes synchronously during `ApplyPlayerFlowState()` (called from `TryBeginGameplay()`) can crash if the game's `OnHealthChanged` handler accesses components that aren't fully initialized yet — such as widget creation (`CreateWidget`), mesh overlay materials (`GetMesh()->SetCustomPrimitiveDataFloat`), or AI perception (`UAISense_Damage::ReportDamageEvent`).

**Crash example (ActionRoguelike):**
```
TryBeginGameplay() → ApplyPlayerFlowState() → ApplyAttributeChange() →
BroadcastAttributeChanged() → OnHealthAttributeChanged() → CRASH
  (CreateWidget on unready viewport, GetMesh on uninitialized mesh, etc.)
```

**Fix (matches Lyra pattern):** Defer health application to the next tick:
```cpp
TWeakObjectPtr<URogueActionComponent> WeakComp = ActionComp;
FAttributeModification DeferredMod = Mod;
GetWorld()->GetTimerManager().SetTimerForNextTick([WeakComp, DeferredMod]()
{
    if (auto* Comp = WeakComp.Get())
    {
        Comp->ApplyAttributeChange(DeferredMod);
    }
});
```

**Key points:**
- Use `TWeakObjectPtr` for the component reference — the actor could be destroyed between frames
- Copy the modification struct by value into the lambda capture
- Apply position/rotation synchronously (TeleportTo is safe) — only defer health/attribute changes
- The Lyra reference integration uses this exact pattern via `OnAbilitySystemInitialized_RegisterAndCall` + `SetTimerForNextTick`

**How to apply:** During Stage 3 Player Flow implementation, always defer health/attribute restoration to the next tick. Check the game's `OnHealthChanged` / `OnAttributeChanged` handlers for any operations that require fully initialized components.
