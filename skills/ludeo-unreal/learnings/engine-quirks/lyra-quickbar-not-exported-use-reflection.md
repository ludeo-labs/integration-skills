---
category: engine-quirks
tier: game-specific
sourceGame: Lyra
phase: 5
question: "Is the game's weapon/equipment component exported with the module API macro?"
sanitized: true
---

# ULyraQuickBarComponent is not exported — access ActiveSlotIndex via reflection

`ULyraQuickBarComponent` (on the PlayerController) does not have `LYRAGAME_API`. Calling its methods from a plugin DLL causes linker errors. Since we don't own this class, adding the export macro requires a core game modification.

**Alternative for MVP:** Access `ActiveSlotIndex` via UE reflection, avoiding the need to export the class:

```cpp
if (UActorComponent* QuickBarComp = Controller->FindComponentByClass(
    StaticLoadClass(UActorComponent::StaticClass(), nullptr, TEXT("/Script/LyraGame.LyraQuickBarComponent"))))
{
    if (FIntProperty* SlotProp = FindFProperty<FIntProperty>(QuickBarComp->GetClass(), TEXT("ActiveSlotIndex")))
    {
        int32 ActiveSlot = SlotProp->GetPropertyValue_InContainer(QuickBarComp);
        WritableObj.WriteData("ActiveWeaponSlot", ActiveSlot);
    }
}
```

This uses `StaticLoadClass` (zero compile-time coupling) + `FindFProperty` (UE property reflection). Works without any core game modifications. For full weapon asset path tracking, export the class in Stage 6.
