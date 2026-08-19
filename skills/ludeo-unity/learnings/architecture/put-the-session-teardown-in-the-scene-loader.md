---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "Is your run teardown hooked to the game's 'before I load the next scene' method? Grep for direct calls to the scene LOADER — every caller that skips that method is an exit path with no teardown, and a DontDestroyOnLoad singleton's OnDestroy will not save you."
sanitized: true
---

# Hook the scene loader, not the game's pre-load method — and know which exits skip it

The game had an obvious choke point: a `BeforeLoadScene()` method that stops music, banks played
time and clears input, called by the level-loading wrapper. The teardown went there, with a
comment claiming it "runs before EVERY scene change".

It did not. Three exits called the scene **loader** directly instead of going through the wrapper:
the game-over screen's exit to the menu, a demo-end path, and a cutscene exit. Measured from a real
run log, after a game over:

```
1349  action: Death                     <- player out of lives
1352  AWAKE LEVEL <death screen>        (additive)
1363  AWAKE LEVEL <menu>                <- room STILL OPEN
1747  gameplay session ended -> CloseRoom   <- only when the next level was picked, minutes later
```

The room outlived the run by the whole time the player sat in the menu.

## The backstop that is not one

The layer also called the teardown from the game's global-state singleton `OnDestroy`, commented as
a "backstop for paths that skip a scene change". That singleton carried a persistence component
(`DontDestroyOnLoad`), so **its `OnDestroy` only ever runs at application quit** — it is a quit
backstop, not a scene-change one. The log proves persistence directly: one instance reported
`old <menu> vs new <level>`, i.e. it saw both scenes.

Before trusting any `OnDestroy` as a teardown site, confirm the object is actually destroyed by a
scene load. In a game with a persistent state singleton, it is not.

## The shape that holds

Put the hook where **every** single-mode load must pass — inside the loader's own async/sync load
entry points — and leave the additive loads alone (death screens and cutscenes load additively over
a live level; those are non-ludeable spans, not session boundaries).

Two consequences to handle:

1. **The hook now fires twice** on paths that also go through the pre-load method. `CloseRoom` is
   async, so the room reference lingers non-null for a few frames after the first teardown and the
   naive `if (!started && room == null) return` guard does not catch the second call — it will
   End/Abort an already-ended session. Add an explicit "teardown done" flag, cleared when the next
   run requests its room.
2. **Not every load is an exit.** A reload of the same level (death with lives left, or a retry)
   is the same run continuing; if the product wants the room to survive it, discriminate at the
   loader — the reload entry point is the signal — and on that path drop the tracked objects and
   re-arm registration instead of ending the session, because every tracked object dies with the
   scene.
