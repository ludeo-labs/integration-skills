---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "4,5"
question: "Have you concluded the world does not stream, and therefore that OnDisable / the manager's Remove call is a safe unregister hook? Check what else disables an object during normal play — occlusion culling, wave queuing and death-recycling all call the same disable path, and only one of them means 'gone'."
sanitized: true
---

# "Nothing streams out" does not make `OnDisable` a safe unregister hook

[[several-rooms-live-does-not-mean-the-world-streams]] establishes that a generated-all-at-once world is
neither the single-room nor the streaming regime, and that recording the negative result ("nothing
streams out") saves later phases from re-opening the question. That is right, and the negative result
here was clean: the visibility culler was commented out in its entirety, no unload path in the level
builder runs during play, scene unloads happen only for cutscenes, and asset handles are released only at
map teardown.

The trap is what you conclude *next*. "The world never unloads" reads as "objects only disappear when they
really die", which makes the object's own `OnDisable` — or the central registry's `Remove` call — look
like a safe place to stop tracking. It isn't, and the reason has nothing to do with streaming.

## Three different things call the same disable path

In the game observed, the actor base class hooked Unity's enable/disable callbacks straight onto the
central registry:

```csharp
// synthetic illustration of the shape
protected override void OnEnableInternal()  { registry.AddActor(this); }
protected override void OnDisableInternal() { registry.RemoveActor(this, keepAsHidden: true); }
```

`RemoveActor(..., keepAsHidden: true)` does not mean the actor is gone — it moves it from the active list
into a *hidden* list it will come back from. Three unrelated systems drive that path during ordinary play:

| What disabled it | Does it mean "gone"? |
|---|---|
| Occlusion / distance culling | no — it returns when it is on screen again |
| The wave spawner parking an enemy that has not been sent in yet | no — it will be enabled and teleported in |
| The death-recycler holding a corpse before reviving it for reuse | no — it is coming back as a fresh enemy |
| The object genuinely leaving the world | **yes** |

Only the last one is an unregister. Hooking the disable callback makes tracked objects blink out of the
captured state every time they go off-camera.

## Find the real removal signal

It exists, and it is a different method. Here it was a `RemoveFromScene()` on the actor base that
deactivated the object, called the registry with the *other* flag (`keepAsHidden: false`, moving it to a
despawned list), fired a "removed from scene" delegate, and returned the object to the pool. That
delegate, or that method, is the hook.

**The test to apply**, regardless of engine or architecture: for each path that disables or unregisters an
object, ask *can this same object come back without being re-created?* If yes, it is presence, not
existence — treat it exactly like a stream-out and do not unregister.

## Why this is worth its own note

The streaming-world guidance already carries "presence ≠ existence", but it is filed under *streaming*,
so the moment you correctly rule streaming out you stop reading it. The distinction is not a property of
streaming — it is a property of any world where objects are pooled, culled, or queued, which is most of
them. A non-streaming verdict narrows the machinery you need (no stream-in hooks, no persistent world ids
surviving an unload); it does **not** license the naive unregister.

Record both results in the census next to each other: the streams-in/out column is `no`, *and* the
unregister hook is the explicit removal method rather than the disable callback, with the reason. A
reviewer who sees only the first will assume the second was chosen carelessly.
