---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does your restore verify a value by comparing what the CLIP recorded against what is live after the settle? Then that check reports the same number in two situations that need opposite fixes — the restore never wrote the value, and the restore wrote it correctly and something later overwrote it. Sample three times (recorded, right after the restore's own write, end of pass) before acting on a drift figure."
sanitized: true
---

# A drift number cannot tell a missing write from an overwritten one

## What happened

A miniboss came back in the wrong place. The restore's own check said:

```
[Ludeo] enemies after the settle: 2 of 973 wrong, worst drift 68.12m (<miniboss prefab> on slot 1519).
```

That line is produced by `ExpectPosition(subject, recordedPosition, () => ai.transform.position)`
— **the clip's value against the live transform**. The apply's own write is not in it.

So 68.12m is consistent with all of:

1. the apply never reached `ApplyPlacement` for that slot;
2. `ApplyPlacement` ran and the teleport silently did not take (a disabled `NavMeshAgent`, an
   actor off the navmesh, a physics move that needs a physics step that a frozen world never runs);
3. `ApplyPlacement` ran, took, and a later step in the same pass moved the creature;
4. the creature was moved after the pass, during the deferred stage or the settle.

Each of those has a different fix, and the drift number distinguishes none of them. Three sessions
were spent arguing about which one it was from that single figure, including two wrong diagnoses
stated to the integrator with confidence.

## Why it is easy to get wrong

The check *feels* like it is verifying the restore, because the restore is what it is testing. It
is not. It verifies the **outcome**, which is the right thing to verify for a gate and the wrong
thing to reason from when the outcome is bad. A gate answers "is the frame right"; debugging needs
"which write won".

The trap is sharpened when the wrong value is stable across runs. Determinism reads as "something
computed this deliberately" and invites a search for the computation — but a write that never
happened is also perfectly deterministic, because the object simply keeps the position the world
build gave it.

## What to do instead

Take **three** samples per subject, not one:

- the recorded value;
- the live value **immediately after the restore's own write**, before anything else in the pass
  can touch it;
- the live value at the end of the pass (and again after the settle, which the drift check
  already gives you).

Then the verdict is mechanical:

| samples | verdict |
|---|---|
| after-write ≠ recorded | write did not take — look at the setter, not at other systems |
| after-write = recorded, end-of-pass ≠ after-write | a later step in the same pass overwrote it |
| end-of-pass = recorded, post-settle ≠ recorded | a live system moved it; the settle or deferred stage owns it |

The cost is a few lines and one run. The alternative is repeated confident guesses at a call graph.

## How it actually resolved

Two runs, no further guessing. The first sampled at the end of every restore step and printed only
movement:

```
39 named threats: all standing where the clip recorded them at the END of the enemy pass.
slot 1519  placed (72.9, -16.0)  ->  after map-event cursors  ->  (143.2, -34.4)   72.7m
```

The second narrowed inside that step, bracketing each sub-call:

```
slot 1519  ->  <accept side objective>   ->  45.4m
           ->  rest of the objectives step ->  another 28.7m
```

Cause: the restore's side-objective step drives the game's own accept path, which **places the
objective's props** — and one objective type's props own a miniboss that an earlier pass had already
positioned from the clip. Case (3) in the list above; see
[[driving-the-games-own-accept-path-inherits-everything-it-places]].

**Print only movement, never every sample.** Forty creatures times a dozen steps is five hundred
lines, and the one that matters is invisible in it. A creature that never moves is not evidence; a
creature that moves names the step that moved it. The "nothing moved" case still prints one line, so
silence is never ambiguous.

Two further things the same instrument revealed for free, neither of which was being looked for:

- **The overwriting path was unseeded.** Same clip, same seed, consecutive runs put the creature at
  `(118.0, -20.6)` and `(212.0, -12.4)`. That matched the integrator's report of "a random position,
  different every play" and confirmed the mechanism rather than merely the location.
- **A second creature was moved by the same call and should be left alone.** Its fight was unstarted
  and the clip recorded it parked, so re-asserting its position would fight the game. Only a trace
  that reports every mover, rather than the one being investigated, distinguishes those.

## The related trap that this one hides behind

A landmark resolves a disagreement that two values cannot. Here the clip had the player at
`(73.6, -13.5)` and the miniboss at `(139.6, -28.5)` — 68m apart — while the integrator was certain
they had been adjacent. Two values, one of them wrong, no way to tell which from the pair alone.
Measuring a **third** object with a known relationship to both — the objective prop the integrator had
been standing at — settled it in one reading: the prop was 6m from the player, so the player's value was
sound and the creature's was the anomaly.

When a recorded value contradicts a human's memory, look for the object whose position the story
constrains, rather than re-arguing the two values you already have.

## See also

- [[a-check-that-returns-pass-for-not-applicable-launders-absence-of-evidence]]
- [[a-void-returning-game-call-can-still-be-asynchronous]] — candidates (2) and (4) above are usually
  this.
