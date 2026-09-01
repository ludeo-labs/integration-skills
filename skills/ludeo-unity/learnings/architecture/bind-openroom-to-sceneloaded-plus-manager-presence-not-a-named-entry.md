---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "In a level-based Unity game, are you binding the creator OpenRoom to a game entry method (a level-select handler, a level manager's Start) or to a build-index list - and have you accounted for the developer's Editor direct-play loop, which bypasses every game entry method?"
sanitized: true
---

# Bind the creator `OpenRoom` to `SceneManager.sceneLoaded` + a manager-presence test, not to a named entry or a build index

Step 2b of the integration-points brief says to bind `OpenRoom` to "the one runtime point every path
converges on". In a **level-based** Unity game that convergent point is not a method at all — it is
*"a gameplay scene became active"*. Binding it that way collapses the whole enumeration into one hook and
costs **zero game-file edits**.

```csharp
// [Layer], subscribed from [RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]
SceneManager.sceneLoaded += (scene, mode) =>
{
    var manager = Object.FindObjectOfType<LevelManager>();   // the per-level gameplay manager
    if (manager == null) { OnNonGameplaySceneActive(); return; }

    // per-level install goes HERE (see below), then:
    RecordCaptureIntentAndTryOpenRoom();
};
```

## Three reasons this beats the obvious alternatives

**1. It is the only bind that covers Editor direct-play — the developer's normal loop.** Opening a level
scene and pressing Play runs *no* game entry method: no menu handler, no level-select click, no loader
coroutine. In the source integration six game-code paths reached live gameplay and all six were covered
by a named-entry bind, but the seventh — the one the integrator would exercise dozens of times a day —
was not. `sceneLoaded` covers it, and because the layer subscribes from `BeforeSceneLoad` it also fires
for the **very first scene of the run**, which is exactly the direct-play case.

**2. Classify the scene by MANAGER PRESENCE, not by build index or name.** A build-index list (or an
index range like `index >= 2`) is brittle in a way that bites hard: in the source project three level
entries had been **blanked out of the build settings**, so the indices the game's own loader hard-coded
no longer matched anything, and they would shift again once the entries were restored. `FindObjectOfType`
of the per-level gameplay manager is the *semantic* test — that manager only exists where gameplay
exists (it dereferences the save system and the player in its own `Awake`/`Start`, so it would throw in a
menu scene). It also survives levels being added, removed, or re-ordered.

> Corollary for the whole integration: once you know indices are unreliable, stop using them everywhere.
> Load the menu **by name**, capture the restore target as a scene **name**, and keep the only index
> arithmetic in the End-vs-Abort destination test — where it is comparing the loader's own argument
> against `SceneManager.GetActiveScene().buildIndex`, so it stays self-consistent whatever the indices are.

**3. `sceneLoaded` is also the correct moment for every per-level install.** It fires **after** the new
scene's `Awake`/`OnEnable` and **before** its `Start`. So in one handler you can, with no game edit:

- `FindObjectOfType` the per-level manager and `AddListener` to its **public `UnityEvent`** for the win
  condition (a zero-edit `End` hook — check the event is invoked from exactly one, already one-shot site);
- re-acquire the controls-gate aggregator the span machine needs, whose collected list is rebuilt per
  level (see [[span-machine-off-the-controls-gate-aggregate-when-there-is-no-state-enum]]);
- take the per-run control hold *before* any game `Start` code can hand the player control.

Because each scene brings a fresh manager instance, the `UnityEvent` listener never stacks — but still
`RemoveListener` on the previous instance when you swap, or a `DontDestroyOnLoad` layer accumulates
subscriptions to destroyed objects.

## It does not remove the consent race — pair it with intent-recording

A scene-activation bind fires *earlier* than a menu-driven one, which makes the
`OpenRoom`-before-`ConsentUpdated` window **more** likely, not less: Editor direct-play has no menu wait
at all. So the handler must only **record intent** (`wantCapture = true`) and attempt a guarded open; the
real open is re-fired from the consent callback once `canCreateLudeo` is known. Without that the call
no-ops against a still-`Disabled` flow switch — no room, no `RoomReady`, no overlay, no error.

## Guard set the bind needs

`TryOpenCreatorRoom()` is called from at least three places (scene activation, the consent callback, and
the async-teardown callback of [[async-abort-outruns-the-next-runs-openroom-intent]]), so it must be
idempotent on all of: `isInLudeo` (the restore flow owns its own room), `wantCapture`, readiness resolved,
room-already-open **or** open-in-flight, and gameplay-already-begun.
