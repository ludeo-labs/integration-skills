---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does part of your restore need the game to BUILD something - load an item prefab, assign a skill through a callback, instantiate from an addressable - so it cannot finish inside one synchronous apply? Then do not unfreeze to wait for it. Asset loads and yield-return-null both advance at a stopped clock; only scaled waits and the physics step do not."
sanitized: true
---

# The restore's asynchronous half waits frozen, not unfrozen

Most of a restore is writing fields, and that is one synchronous pass. But the moment it asks the
game to *build* something — resolve an item prefab, assign a skill that completes through a callback,
load anything through the engine's asset system — it has to wait, and a synchronous apply cannot.

The obvious move is to unfreeze for the waiting part. **Don't.** By the time the loadout is being
restored, several hundred entities are already standing in their recorded places. Unfreezing lets
every one of them walk, fight and die for as long as the loads take, so the moment drifts before
anyone sees it — and the placement checks then report drift that is nobody's bug.

## What actually blocks at a stopped clock, and what does not

This is the distinction the whole design rests on, and it is easy to get backwards after being
burned once by a freeze that deadlocked a load waiting on a physics step. Which Unity callbacks keep
running at a stopped clock is also what decides whether the SDK's own notification pump survives a
freeze — it depends on where the installed plugin ticks (see
[[verify-the-timescale-pump-claim-against-the-installed-plugin]]):

| Advances at `timeScale = 0` | Does **not** |
|---|---|
| asset / addressable loads and their callbacks | `WaitForSeconds` and any scaled timer |
| `yield return null` (frames still render) | `FixedUpdate`, and therefore anything gated on a physics step |
| `Time.realtimeSinceStartup` | `Time.time`-based deadlines |

The earlier deadlock was **not** caused by freezing across async work in general. It was caused by
freezing across work that waited on a *physics step*. Loads are a different animal, and conflating
the two costs you either a deadlock or a drifting moment.

## The shape

Three stages, one coroutine driving them:

```
frozen:   stage 1 - everything writable in one pass (world, entities, cursors, the basics)
frozen:   stage 2 - ask the game to build things, then WAIT (yield return null + real-time deadline)
unfreeze: settle a few real frames
frozen:   stage 3 - re-assert the values everything else feeds into
```

Stage 3 exists because derived values cannot be correct until their inputs are. Health is the usual
one: it is captured as a *percentage* of a maximum derived from level, attributes, equipment and
buffs, so it has to be written once in the ordered pass and again at the end. The game's own actor
restore writes health twice for exactly this reason — copy that rather than discovering it.

## End the wait on a signal, never on a duration

A fixed wait is wrong twice over: too short on a cold asset cache, wasted on a warm one. Use whatever
the game actually offers, and be honest about its quality:

- **A callback is an exact signal.** Count assignments up as you start them and down inside each
  callback; zero means done.
- **No callback? Watch from outside.** Poll a count the game does publish (how many items are in the
  slot you just filled) and end the wait when it has been unchanged for a handful of consecutive
  frames. "It has gone quiet" is a weaker signal than a callback and it is the actual condition you
  are waiting for.
- **Always bound it with a real-time deadline**, and on expiry log what did not arrive and *continue*.
  A replay missing one weapon is worth more than a replay that never starts. Do not extend the wait
  hoping it resolves — that turns a fidelity gap into a hang.

Report the two numbers either way: how many of each thing you asked for, and how many arrived. That
line is the whole diagnosis when a clip's character comes back underpowered.

## Cost of getting it wrong in the other direction

Counting an item restore as "one outstanding load" and never decrementing it means every replay with
equipment pays the full deadline — twenty seconds of frozen world before the player can press Play,
on every single clip, with nothing in the log saying why. Whatever you count, make sure something
actually counts it back down, or don't count it at all and poll instead.
