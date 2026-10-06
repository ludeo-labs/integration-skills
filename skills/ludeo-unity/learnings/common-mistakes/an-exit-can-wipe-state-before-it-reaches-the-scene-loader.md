---
category: common-mistakes
tier: generalizable
sourceGame: IdleSample
phase: "2,3"
question: "Does any exit path reset or overwrite live game state (a run reset, a new-game wipe, a save import) BEFORE it calls the scene loader? Then a loader-level End/Abort hook fires after the wipe, and every sample taken in between records the wiped state into the capture."
sanitized: true
---

# An exit can wipe the state before it ever reaches the scene loader

[[put-the-session-teardown-in-the-scene-loader]] is right that the loader is the one choke point every
single-mode scene change passes through. It assumes the scene change is the *first* thing an exit does.
Several exits in one game were shaped differently:

```csharp
// synthetic shape
async void OnResetConfirmed()
{
    progression.WipeRunState();            // 1. live services reset IN PLACE: balances 0, levels 0
    save.Delete();
    await sceneLoader.Load("Title");       // 2. only now does the loader hook fire
}
```

Seen as: a run reset behind a black screen followed by a scene load, a full new-game reset, and a save
import that writes the imported state into the live services and *then* reloads. The state lives in
singletons that outlive scenes, so the wipe is visible at once, and the scene load comes one or more
awaited frames later (fades, VFX, async load).

With End/Abort only at the loader, the per-tick sampler keeps writing through that gap. The capture's
tail is a frame or several of zeroed state, or of a different save entirely. At worst an End (not an
Abort) submits a segment whose last state is not the moment the player was in.

## The check

For every exit in the map, read the exit's own method top to bottom, not just its call to the loader.
Ask: **does anything before the loader call mutate state the capture reads?** If yes:

1. Put the End/Abort call **before the mutation**, at the exit's own call site. Keep the loader hook as
   the backstop, with an "already torn down" flag so the second call is a no-op.
2. Stop sampling synchronously at that point. Ending a session is async, so the flag must stop the
   sampler now, not when the callback lands.
3. Choose End vs Abort by what the segment *is*. A deliberate reset the player chose can be a real
   ending; a save import or a wipe replaces the run and is an Abort.

Phase-2 maps tend to flag the exits they recognise as "resets" and describe the others only as scene
changes. Re-derive the list from the method bodies; here one wipe-first exit surfaced only in phase 3.

Related: [[audit-the-end-boundary-as-hard-as-the-start]],
[[ending-a-recording-is-async-do-not-shut-down-on-the-next-line]].
