---
category: architecture
tier: universal
sourceGame: Lyra
phase: 4
question: null
sanitized: true
---

# GameMetadata writable object is required — not optional

Every integration needs a GameMetadata writable object created at room open (before entity objects). It stores static per-room data:
- **MapName** — which map this Ludeo was recorded on
- **ExperienceAsset** — which experience/game mode was active
- **BotCount** — how many bots were present

**Why it matters:** During Player Flow, the subsystem reads GameMetadata FIRST to determine which map to ServerTravel to. Without it, the map URL must be hardcoded — which breaks when the integration supports multiple maps.

**Pattern:**
```cpp
// In CreateWritableObjects(), BEFORE registering entity objects:
FLudeoRoomWriterCreateObjectParameters MetaParams;
MetaParams.Object = GetOwner(); // GameState as the UObject anchor
MetaParams.ObjectType = TEXT("GameMetadata");
auto Result = RoomWriter.CreateObject(MetaParams);
if (Result.IsSuccessful())
{
    FLudeoWritableObject& MetaObj = WritableObjectMap.Add(GetOwner(), Result.GetValue());
    MetaObj.EnterObject();
    MetaObj.WriteData("MapName", GetWorld()->GetMapName());
    // Write experience asset path, bot count, etc.
    MetaObj.LeaveObject();
}
```

This object is written once and never updated (static metadata).
