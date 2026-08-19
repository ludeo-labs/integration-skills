---
category: engine-quirks
tier: universal
sourceGame: PlatformerSample
phase: 5
question: "Does your restore freeze the game with Time.timeScale = 0 at any point BEFORE an SDK callback you are still waiting for (RoomReady, AddPlayer, BeginGameplay)? The plugin's notification pump stops at timeScale 0 and the callback never arrives."
sanitized: true
---

# Freezing with timeScale 0 stops the plugin's notification pump — the callback you are waiting for never arrives

The restore design said: freeze the game as soon as a Ludeo is selected, so nothing simulates before
the captured state is applied. Implemented literally, `Time.timeScale = 0` went on early — and the
begin gate never completed:

```
five minutes of total log silence, process alive, no error of any kind
```

At `timeScale 0` the Unity plugin's own notification pump stops running, so `RoomReady` is never
delivered. The gate was waiting for a callback the SDK could no longer hand it. Nothing logs,
nothing throws, and the process looks healthy — this is the most expensive shape of bug to diagnose
from the outside, and it is pure self-inflicted deadlock.

## The rule

**Never hold timeScale at 0 across an SDK wait.** Put the freeze *inside* the callback that begins
the apply, not before it:

```
LudeoSelected  -> load the captured level (game running)
RoomReady      -> freeze, apply synchronously, unfreeze
```

Because the apply is synchronous, the frozen window is one frame, and nothing simulates between the
freeze and the restored values landing. See [[settle-the-rebuilt-moment-before-the-wait]] for what
must happen *after* the apply — a rebuilt moment needs real frames before it can be held.

## The same trap from the other direction

A freeze arbiter that saves "the current timeScale" to restore later will save **0** if it is
entered while the game is already hard-paused, then faithfully restore 0 and leave the replay
frozen with nothing left to release it. Observed when the Ludeo gallery was reached through the
game's own pause menu, which is the normal way in:

```
RoomReady -> Begin (restoring=True, timeScale=0)
gameplay begun; restore freeze released (timeScale=0)
```

Two defences, and the first is the real fix:

1. **Clear the game's pause through the game's own resume path** as part of the pre-restore purge.
   A restore has to land in a running game, and un-pausing is the game's job, not the arbiter's.
2. **Refuse to resume into `timeScale <= 0` and warn.** Know the game's legitimate range first —
   this one has an accessibility game-speed setting living in `0.5..1`, so 0 is never a valid
   running scale. Any other path that leaves it at 0 would otherwise present as the same silent
   hang.
