---
category: architecture
tier: universal
sourceGame: VoyagerV2
phase: 4
question: null
sanitized: true
---

Player Flow must SPAWN entities that don't exist at level start, not defer restoration. Wave-spawned enemies, dynamically placed turrets, and other transient entities must be reconstructed by calling SpawnActor with the correct Blueprint class.

**Pattern for spawning from Ludeo data:**
1. Store ClassPath (Actor->GetClass()->GetPathName()) during Creator Flow write
2. During Player Flow read, use StaticLoadClass(AActor::StaticClass(), nullptr, *ClassPath)
3. Fallback for older data: FindBlueprintClassByName using TObjectIterator<UClass>
4. SpawnActor at the captured position/rotation
5. Apply health/state via reflection

**Match existing before spawning:** First try to match by ClassName against existing level actors. Only spawn new if no match found. Use closest-distance matching when multiple actors of the same class exist.

**Skip dead entities:** If Health <= 0, don't spawn — they were dead at capture time.
