---
category: save-systems
tier: generalizable
sourceGame: VoyagerV2
phase: 3
question: "Does this game have a save interface (e.g., BPI_SaveGame) that actors implement to serialize their own state? If yes, consider using that interface to collect state and pass to Ludeo via SaveGameToSlot (SDK Option 1) rather than SaveWorld's property traversal."
sanitized: true
---

# Use Game's Native Save Interface for State Collection

When a game has its own save system implemented via Blueprint Interfaces (e.g., BPI_SaveGame with SaveData/LoadData functions), this is the most reliable way to collect gameplay state because:

1. The game developers already solved the "where is the state" problem
2. Each actor knows how to serialize its own components (Health from HealthComp, Energy from EnergyComp, etc.)
3. It works regardless of how properties are stored (UPROPERTY, components, custom containers)
4. The save/load functions handle the game's specific data relationships

**Approach:** Call the game's save interface on each actor, collect the returned state into a USaveGame object, then use `FLudeoObjectStateManager::SaveGameToSlot()` or manual WritableObject writes to pass it to the Ludeo SDK.

This is SDK docs "Option 1: USaveGame" — using the game's existing save infrastructure as the data source.
