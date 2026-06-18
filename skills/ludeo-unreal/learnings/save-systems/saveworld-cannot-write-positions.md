---
category: save-systems
tier: universal
sourceGame: FPSGameStarterKit
phase: 4
question: null
sanitized: true
---

# SaveWorld cannot write actor positions — use manual WritableObject.WriteData("Transform") supplement

## The Problem

`ULudeoSaveGameManager::SaveWorld()` with a CPF_SaveGame or PropertyName filter **cannot** write position data (RelativeLocation, RelativeRotation on USceneComponent). Three approaches were tried and all failed:

### Approach 1: CPF_SaveGame filter only
`USceneComponent::RelativeLocation` and `RelativeRotation` do NOT have the `CPF_SaveGame` flag. They have `EditAnywhere, BlueprintReadOnly, ReplicatedUsing=OnRep_Transform`. SaveWorld never touches them.

### Approach 2: PropertyName filter with "RootComponent"
Adding `RootComponent` to the property name filter makes SaveWorld traverse into the `USceneComponent`. But when it writes `RelativeLocation` (an `FVector` struct property), it calls `PropertyFilter.GetStructPropertyFilter()` which returns the same name filter. Inside `FVector`, the fields are `X`, `Y`, `Z` — which don't match "RelativeLocation" → empty struct written → empty attributes.

This is because `ULudeoObjectPropertyData::GetStructPropertyFilter` returns `*this` — the same filter. The old SDK (`FLudeoObjectPropertyFilter`) had separate `MatchingPropertyFlagFilter` + `MatchingPropertyNameFilter` + `MatchingPropertyClassFilter` with OR logic that could handle nested structs. The new SDK's `ULudeoObjectPropertyData` doesn't distinguish between outer and inner filters.

### Approach 3: Register USceneComponent as writable object
Adding a `USceneComponent` entry to `FLudeoSaveGameSpecification` creates CapsuleComponent objects in the Ludeo JSON with `"attributes": []`. On restore, `FLudeoObjectTypeDictionary::GetClass("/Script/Engine.CapsuleComponent")` resolves to the class, but the empty attributes cause `RestoreWorld` to fail (`IsRestoreWorldSuccessful()` assertion).

## The Fix: Hybrid SaveWorld + Manual Transform

Keep SaveWorld for gameplay properties (Health, isDead — works fine with CPF_SaveGame). After each `SaveWorld()` tick, manually write Transform on each tracked actor:

```cpp
// After SaveGameManager->SaveWorld(*Room):
for (const auto& Pair : SaveGameManager->GetObjectMap())
{
    const AActor* Actor = Cast<AActor>(Pair.Key);
    if (!Actor) continue;
    
    const FLudeoWritableObject& WritableObj = Pair.Value;
    FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> Guard(WritableObj);
    if (!Guard.HasEnteredObject()) continue;
    
    WritableObj.WriteData("Transform", Actor->GetActorTransform());
    
    if (const APawn* Pawn = Cast<APawn>(Actor))
    {
        if (const AController* C = Pawn->GetController())
            WritableObj.WriteData("ControlRotation", C->GetControlRotation());
    }
}
```

On restore, iterate the ObjectMap from RestoreWorld and manually read `Transform`/`ControlRotation` + apply via `SetActorTransform` / `SetControlRotation`. Use `ExistAttribute("Transform")` before `ReadData` to avoid assert on missing attributes.

## Why Direct WriteData Works

`WritableObject.WriteData("Transform", FTransform)` uses the SDK's native struct serializer (LudeoTransform) — NOT the property filter system. It writes the FTransform's components (Rotation, Translation, Scale3D) as nested attributes. This bypasses the broken `GetStructPropertyFilter` path entirely.
