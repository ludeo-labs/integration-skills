---
category: engine-quirks
tier: generalizable
sourceGame: StoryPuzzleGame
phase: 4
question: "Does Player Flow (or a slice-load entry point) need to stream a sublevel that is NOT listed in the restore map's Streaming Levels? If the game reaches that sub-area via its own LoadStreamLevel* call, that call only TOGGLES already-registered sublevels — it cannot stream an unregistered one."
sanitized: true
---

# Stream an unregistered sublevel with `ULevelStreamingDynamic::LoadLevelInstanceBySoftObjectPtr`, not `LoadStreamLevel*`

## Precondition

The game loads sub-areas (memory/flashback scenes, portal/photo-triggered rooms, trigger-loaded
sublevels) as **streaming sublevels**, and you need to stream one from C++ — either to build a
slice-load entry point, or to re-stream a capture-time sublevel during Player Flow restore (see
[[restream-capture-time-sublevels-before-restore]]). The catch only bites for sublevels that are
**not registered** in the current persistent map's Streaming Levels list.

## The trap

`UGameplayStatics::LoadStreamLevel` / `LoadStreamLevelBySoftObjectPtr` (and the game's own code that
calls them) **only toggle the visibility/loaded-ness of a `ULevelStreamingLevel` that already exists
in the persistent world's `StreamingLevels` array.** If the target sublevel was never registered for
this map, the call **silently fails** with `Failed to find streaming level object associated with
'…'` — nothing streams, and any follow-up (teleport to an anchor in that sublevel, restore the
player transform onto its geometry) lands the player in **unstreamed void**.

This is easy to misdiagnose: in normal play the sub-area may load fine because *that* map registered
it, while a fresh restore map (or a different host map) did not.

## Two fixes

**A — Load it directly, registration-independent.** `ULevelStreamingDynamic::LoadLevelInstanceBySoftObjectPtr`
loads any level **regardless of whether it is registered** in the persistent map:

```cpp
bool bSucceeded = false;
ULevelStreamingDynamic* Streamed = ULevelStreamingDynamic::LoadLevelInstanceBySoftObjectPtr(
    World, SubLevelSoftPtr, /*Location=*/FVector::ZeroVector, /*Rotation=*/FRotator::ZeroRotator,
    bSucceeded);
// Then poll IsLevelVisible() (tick or OnLevelShown) before teleport/restore — load is async.
```

This is the right call for **restore restream** (zero offset, no anchor teleport — you want the
sublevel exactly where it was captured).

**B — Pre-register so the game's own `LoadStreamLevel*` resolves.** If you instead want the game's
existing streaming code to work, register a transient streaming level up front:

```cpp
ULevelStreamingDynamic* S = NewObject<ULevelStreamingDynamic>(World, ...);
S->SetWorldAssetByPackageName(FName(*PackagePath));
S->SetShouldBeLoaded(false); S->SetShouldBeVisible(false);
World->AddStreamingLevel(S);   // now the game's LoadStreamLevelBySoftObjectPtr finds it
```

Do this from a post-load hook (`FCoreUObjectDelegates::PostLoadMapWithWorld` or the game's
equivalent) so every relevant sublevel is registered before any game code tries to stream it.

## Why it matters

Both the slice-load entry point and the Player-Flow restore restream depend on this. Picking
`LoadStreamLevel*` for an unregistered sublevel produces a "player falls through the floor / world
is empty" symptom that looks like a restore-position bug but is actually a streaming bug. Streaming
is **async** either way — always gate the teleport/restore on the sublevel reporting visible (tick
poll with a timeout + failsafe), never assume it is loaded on the next line. See
[[dont-pause-during-async-load-waits]] and [[gate-player-flow-on-streamed-level-not-pawn]].
