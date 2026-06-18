---
category: common-mistakes
tier: generalizable
sourceGame: VoyagerV2
phase: 4
question: "Does this game have non-Character tracked entities (turrets, vehicles, deployables)? If so, OnActorSpawned must check for them BEFORE the Cast<ACharacter> early return, and SpawnActor during Player Flow must not require Cast<ACharacter> to succeed."
sanitized: true
---

When tracking non-ACharacter actors (turrets, deployables, vehicles):

1. **OnActorSpawned handler**: Check for non-Character entities BEFORE the `Cast<ACharacter>` early return. Otherwise the handler bails before reaching the detection code:
```cpp
void OnActorSpawned(AActor* SpawnedActor)
{
    // Check turrets FIRST — they are AActor, not ACharacter
    if (ClassName.Contains("TurretMinigun")) { ... return; }
    
    // THEN check for ACharacter
    ACharacter* Character = Cast<ACharacter>(SpawnedActor);
    if (!Character) return;  // Would skip turrets if checked first
    ...
}
```

2. **Player Flow spawning**: When spawning from Ludeo data, don't `Destroy()` actors that fail `Cast<ACharacter>`. Turrets spawn as AActor — keep them, they're already at the correct position from SpawnActor params.

3. **Ability vs physical actor**: Some games spawn an ability actor (e.g., `BP_AbilityTurretCompanion`) which then spawns the physical turret (e.g., `BP_TurretMinigunCompanion`). Only track the physical turret — the ability actor has position (0,0,0).
