---
category: save-systems
tier: universal
sourceGame: VoyagerV2
phase: 5
question: null
sanitized: true
---

# SaveGameToSlot Also Requires SaveGame-Flagged Properties

Even when using the game's native save interface (BPI_SaveGame) to populate a USaveGame object, `SaveGameToSlot()` serializes the USaveGame using UPROPERTY-based serialization. If the USaveGame's Blueprint properties don't have the SaveGame flag checked, only metadata (LUDEO_SAVE_GAME_TO_SLOT_STATE_ID) is written — no actual game data.

This means the ENTIRE Ludeo save pipeline (SaveWorld, SaveGameToSlot, WritableObject.WriteData with property filters) relies on UPROPERTY serialization. For Blueprint-only games where properties don't have SaveGame flags, ALL automated serialization approaches fail.

**The only approach that works for these games is manual WritableObject.WriteData calls** where you explicitly read values via reflection (FindPropertyByName, ContainerPtrToValuePtr) and write them with named attributes.

Also: calling SaveGameToSlot every tick creates a NEW writable object each call. Should be called once or use a mechanism that updates the same object.
