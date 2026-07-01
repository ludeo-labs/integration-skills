---
category: architecture
tier: generalizable
sourceGame: StoryPuzzleGame
phase: 4
question: "Can the player walk into a streamed sub-area (a memory, a polaroid scene, a sub-level loaded on a trigger) that is part of the slice's coverage but is NOT auto-loaded when the restore map boots? If yes, capture which sublevels are loaded+visible and re-stream them before applying the player transform."
sanitized: true
---

# Re-stream capture-time sublevels before applying the player transform (or the player restores into the void)

## Precondition
The game streams sub-areas into a persistent world on a trigger (memories, polaroid scenes,
set-pieces, "enter the building" sublevels) — not just the one slice level that auto-streams when
the restore map boots. The player can be standing inside one of these when they press capture.

## Symptom
A capture taken inside the streamed sub-area **fails to load**: the player falls through the floor
/ lands in black void, while captures taken in the always-loaded slice area restore fine. The
exported Ludeo looks correct (all tracked actors present, valid `MapName`), which sends you hunting
for a serialization bug that isn't there.

## How to spot it in the data (fast)
Compare the **player's captured `Transform.Y` (or X)** to the tracked level actors'. If the player
is tens or hundreds of thousands of units away from every tracked actor, they were in a *different*
sublevel placed at a far authored offset — not a corrupt transform. (LDL: player `Y≈212,583`, all
office actors `Y≈0` → the player was in a memory sublevel, "the park".)

## Root cause
Player Flow travels to the host map, which auto-streams only the **primary** slice level. The
readiness gate passes (primary-level actors exist), then the restore `SetActorTransform`s the player
to coordinates inside a sublevel that was **never streamed in on this boot**. The geometry/collision
isn't there → void.

## Fix — capture what's loaded, re-stream it, THEN place the player
1. **Write side (on GameMetadata, per-tick):** record the **asset package paths** of every
   memory/set-piece streaming level that is `IsLevelLoaded() && IsLevelVisible()` right now
   (`UWorld::GetStreamingLevels()` → `GetWorldAssetPackageName()`), filtered to the known
   sub-area set. Empty for primary-area captures. **This is a schema change — version-gate the read.**
2. **Read side:** after the primary-level readiness gate, **peek** that attribute (version-gated so
   old captures don't hard-assert on the missing FString). If non-empty, stream each sublevel with
   the game's own loader (`ULevelStreamingDynamic::LoadLevelInstanceBySoftObjectPtr`, zero offset, no
   anchor teleport), **wait until every one is `IsLevelVisible()`** (tick poll + a timeout failsafe),
   and only THEN run the state apply. The player transform now lands on real geometry.

Capturing the actually-loaded sublevels is strictly better than inferring them from a progression
flag (e.g. a StoryActor `bHasSetPieceLoaded` enum) — it reproduces exactly what the player saw, and
naturally unifies set-piece and free-roam-sub-area restore through one mechanism. Keep setting the
progression flag on restore so the scripted system doesn't re-fire its VO/transition, but drive the
*streaming* off the captured loaded-sublevel list.

Offset caveat: this assumes the sub-area umaps author their actors at final world coords (loaded at
zero offset). If the game streams them at a runtime offset, capture and reapply the
`ULevelStreaming::LevelTransform` too. Verify by watching the first replayed frame.

See [[gate-player-flow-on-streamed-level-not-pawn]] (the sibling readiness-gate lesson) and
[[progression-trails-vs-snapshot-state]].
