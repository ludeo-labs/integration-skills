---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5,7"
question: "Does your world rebuild need something that only exists once the front end is up (a live level object, a scene-loading manager)? Then find out WHEN the clip arrives relative to that, and hold the rebuild rather than logging and returning — because every cloud startup optimisation you make moves the selection to the wrong side of that race."
sanitized: true
---

# Speeding up boot for the cloud breaks the restore that "already worked"

The restore's first step is to rebuild the recorded world, and it needs a way to change scene. On
this project there were two, and neither exists at app start: the live level object (only inside a
level) and the front end's scene loader (a scene component that assigns its static in `Awake`). The
code handled the third case honestly enough — it logged *"the clip was selected too early in boot"*
and returned.

That branch had never fired. Every local replay put the selection at about **15 s** after launch,
comfortably after the boot screens finished and the menu came up. The restore looked robust.

It was not robust; it was **lucky**. The clip is handed over at session activation, which happens
during boot, so where the selection lands relative to the front end is a race — and nothing in the
integration owned it.

## The trap: the cloud work makes the race worse, not better

Ludeo's cloud guidance is a startup-time optimisation programme — remove splash screens, remove
intro videos, skip menus, reach gameplay as fast as possible. Every item on it moves the selection
**earlier relative to the front end**. Removing a ~10 s warning screen and two intro videos took
boot from "slow enough to be safe" to "fast enough to lose", and the failure mode is the worst kind:
the replay silently does nothing, with one line in the log explaining it to nobody.

So the ordering matters. **Fix the race before, or in the same pass as, the boot speedups** — not
after, and never as a phase-8 tidy-up. Discovering it on a cloud machine costs a build, an upload
and a test session per attempt.

## The fix

Turn the "cannot do it yet" branch into a wait, in the layer:

```csharp
// predicate mirrors the rebuild's OWN two branches, so it cannot drift from them
public static bool CanRebuildWorldNow
    => LiveLevel.Instance != null
       || Object.FindFirstObjectByType<FrontEndSceneLoader>() != null;
```

```csharp
if (!CanRebuildWorldNow) {
    // poll: neither branch announces itself — both are scene components that
    // assign their static in their own Awake
    while (!CanRebuildWorldNow && Time.realtimeSinceStartup < deadline)
        yield return new WaitForSecondsRealtime(0.25f);
    if (!CanRebuildWorldNow) { /* say boot failed, not the restore */ yield break; }
}
BeginWorldRebuild(setup);
```

Three things to get right:

- **Bound the wait against the platform, not a guess.** Studio Lab's non-preloaded-Ludeo load
  timeout governs how long the backend waits after selection (120 s by default), and the world load
  itself was measured at ~25 s here. 45 s for reaching the front end leaves the load its room. An
  unbounded wait just relocates the silent failure.
- **Poll, don't subscribe.** Neither object raises anything when it appears. Every quarter second is
  plenty and keeps the scene walk cheap.
- **Keep the original refusal as the backstop.** The predicate mirrors the rebuild's branches; if
  they ever diverge, the rebuild's own log line is still there to say so.
- **Blame the right thing in the timeout message.** "Boot never reached a point where the world
  could be rebuilt" sends the reader to the boot sequence. "Restore failed" sends them to the
  restore, which is where they will waste the afternoon.

Related: [[a-guard-that-cannot-fire-is-not-evidence]] — here the inverse, a guard that fires
correctly but whose *branch* had never been exercised, so nobody knew it was load-bearing.
