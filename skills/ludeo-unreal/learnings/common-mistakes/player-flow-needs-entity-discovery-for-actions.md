---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 6
question: null
sanitized: true
---

In Player Flow, TrackedEntities is empty because CreateWritableObjects() (which populates it) is skipped. But RegisterActionListeners() iterates TrackedEntities to initialize health polling. Result: "Monitoring 0 AI entities" — no kills detected.

**Fix:** In RegisterActionListeners, when bIsPlayerFlow is true, discover AI entities from the world using TActorIterator<ACharacter> and add them to TrackedEntities (without writable objects, just for polling):

```cpp
if (bIsPlayerFlow)
{
    for (TActorIterator<ACharacter> It(World); It; ++It)
    {
        if (Cast<AAIController>((*It)->GetController()))
        {
            FTrackedEntityInfo Info;
            Info.Actor = *It;
            Info.bIsPlayerOwned = false;
            Info.PreviousHealth = GetHealthFromActor(*It);
            TrackedEntities.Add(MoveTemp(Info));
        }
    }
}
```

**General principle:** Player Flow shares action detection infrastructure with Creator Flow, but populates it differently (world scan vs writable object registration).
