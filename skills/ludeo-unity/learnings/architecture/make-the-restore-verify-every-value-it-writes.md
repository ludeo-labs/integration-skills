---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
---

# Make the restore verify every value it writes, and report it itself

The restore is the only code that holds both halves of the answer at the same instant: the value it
has just read out of the Ludeo, and the place in the game it is about to write that value to. So
the cheapest possible verification is to register, at each apply site, *what to expect* and *how to
read it back* — then evaluate the whole list at fixed checkpoints. One extra line where a value is
applied buys a machine-checked restore.

This replaces asking a person "does the replay look right?", which is slow, unrepeatable, and blind
to everything that is invisible on screen: derived counters, wave progress, door flags, clocks.
It generalizes [[validate-placement-after-restore]] from positions to the whole restored set.

## What NOT to build

The tempting version is: re-run the capture writers against the restored world and diff the result
against what was recorded. Reject it. That verifies capture and restore agree — which nobody
doubts, because *we know what we are writing* — and it costs a refactor of every writer. It also
answers a question the integrator never asked: whether the SDK stored the values correctly.

The question that matters is narrower: **after we set a value, is the game still holding it?**

## The one rule that makes it real

The read-back must go to **live game state**, never to a copy of what was written. A check that
reads back its own variable passes even when the game has quietly replaced the value — and that is
exactly the failure worth catching. The first bug this ever caught was the game's own spawn
handshake teleporting the player a second after the restore put them somewhere else.

## Shape

Keep the surface tiny. Four entry points and a few comparison helpers:

```csharp
Reset();                                             // at the start of every apply
Expect(group, Func<string?> check);                  // null = right, else the complaint
ExpectPosition(group, label, expected, Func<Vector3?> live, tolerance);
Report(when);                                        // evaluate and log
```

- `Expect` returns a **complaint string**, not a bool, so the message names the thing and both
  values and needs no second lookup table: `"door 3 of room 'X' being open should be True, is False"`.
- Comparison helpers (`Diff` for bool/int/float/double/string) return `null` when correct, so an
  apply site chains several with `??` and the first real complaint wins.
- `ExpectPosition` is separate because distance is worth reporting *even when everything passes* —
  "worst drift 0.98m" is how a slow regression shows up before it becomes a failure.
- One composite check per entity, not one per field. Six lines about the same door tell you no more
  than the first one does.

## Check at two moments, not one

1. **After the settle** — did the apply take, and did the settle's own simulation undo any of it?
2. **At the player's click** — the wait before this is unbounded, because it is a person deciding
   to press Play. This is what catches anything that re-placed or rewrote the moment while it sat
   there.

Identical counts at both checkpoints is itself a diagnosis: the fault is in the apply, not in
something overwriting afterwards.

## Let legitimately-moving values move

A check that cries wolf gets ignored, so encode what is allowed to change:

- **exact** for ints, bools, strings, and any scheduled/threshold value;
- **tolerance** for floats and positions (entities may take a few steps during a settle; a player
  should not move at all, so their tolerance is much tighter than an entity's);
- **clock semantics** for running timers: they may advance by up to the settle's duration, but must
  never go backwards or jump. A clock reset to zero is what a second level-entry sequence running
  over the top of the moment looks like.

## Report so it stays readable

Per group: one line when clean (`"Doors OK after the settle: 24 checked"`), and on failure a count
plus the first few offenders named in full. **Also print a per-kind tally** — collapse each
complaint to its shape by dropping the quoted subject, so `"31 of 80 wrong"` is followed by
`"31x entity is present but NOT VISIBLE"`. Without the tally, a cap of five named offenders leaves
"are all 31 the same problem?" unanswerable from the log, which is precisely the question you have
the moment it fires.

## Check what the restore WRITES, never what the game DERIVES

The first false alarm this produced was not a tolerance set too tight. It was a check on a value the
game recomputes continuously.

An enemy's aggro target looked like restorable state — the capture recorded who each enemy was
chasing, and the restore wrote it back — so it got a check. It reported 25 of 80 enemies as
"having lost the player they were chasing", and every one of those was correct game behaviour: the
aggro handler re-derives the target from line of sight on every update, taking whatever the eye can
see and clearing it to null when the eye sees nothing. An enemy in another room *should* have no
target, and re-acquires one the instant it sees the player.

Before adding a check, ask **who owns this value between now and the checkpoint**:

- **The restore owns it** — a health value, a door flag, a clock, a position. Check it.
- **A live system recomputes it** — line of sight, pathfinding targets, animation state, anything
  derived from geometry the restore has already reproduced. Do not check it. It will disagree, it
  will be right to disagree, and the noise will bury the real findings.
- **Another system owns it and will overwrite what you wrote** — this is the interesting third case,
  and it is a *restore* bug rather than a check bug. Write to the owner instead of to the field. In
  this integration a behaviour-tree node copied the tree's shared variable onto the entity after the
  restore had set the entity's field; the fix was to set the tree variable the node copies *from*.

The rule of thumb: a value worth checking is one that nothing but the restore should have touched.

## Order the checks so the hiding failure comes first

Within an entity, test **visibility before values**. An entity can be present, correctly placed and
at exactly the right health, and still be something the player cannot see — and every value check
on it is meaningless until that is ruled out. Print the arrival/visibility state alongside *any*
per-entity complaint (see
[[restored-entities-must-arrive-already-arrived]]).

## Cost

Development only. Put `[Conditional("DEVELOPMENT_BUILD")]` and `[Conditional("UNITY_EDITOR")]` on
every entry point, so a release player has neither the calls nor the delegates they would have
allocated. Registration is a few hundred closures per restore in a dev build, once.

## Why it is worth the hour

On its first run against a real replay it reported nine groups clean and found a real defect in the
tenth — one that a human had eyeballed as correct the run before, because the broken entities were
the ones behind him. Placement validation had reported that same restore as fine: the entities were
all present and within a metre. They were simply invisible.
