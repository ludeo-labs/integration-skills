---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does a restore step put something back by calling the game's own 'start this' / 'accept this' / 'spawn this' entry point, rather than by writing fields? That is usually the right choice — but the call does everything it normally does, including placing objects that other buckets have already restored. Check what else it moves before deciding where it runs in the order."
sanitized: true
---

# Driving the game's own accept path inherits everything that path places

## The shape

Restoring a side objective by writing the manager's fields skips a dozen sibling updates: quest
registration, HUD text, counters, part spawning. So the right call is the game's own accept path —
the objective manager's "accept this objective" method — and the reasoning is sound.

What the reasoning missed is that the accept path **also spawns and places the objective's props**,
because that is what accepting means. And on this game, one objective type's props own a creature:
a summoning prop that owns the miniboss it calls in. That creature lives in the *enemy* bucket, was
restored from the clip three steps earlier, and the accept path silently moved it 68 m.

Measured: 39 named threats, all correct at the end of the enemy pass; two of them — both minibosses
owned by that objective type — moved by the objectives step, nothing else touched.

## Why it survives review

Every individual decision is defensible, which is what makes it hard to see:

- The enemy pass is early because fight cursors must precede it, and that ordering is real.
- The objectives step is late because it borrows a cursor an earlier step writes, also real.
- Using the game's accept path is right, for all the reasons above.

The fault is in a dependency **nobody wrote down**, because it only exists for one objective type on
one map: the accept path owns the placement of entities another bucket also owns. Step order
documented as "what this must follow" does not capture "what this must not run after".

## What to do

**Ask of every restore step that calls into the game: what does this place?** Not what does it
restore — what does it *touch*. An accept path, a spawn call and a level-start call all place things
by definition. If any of them overlaps a bucket you restore elsewhere, the two have an ordering
relationship even if neither reads the other's data.

Then pick the narrow fix. Here: re-assert **position only** for the affected entities after the
owning step, reusing data the restore already retains. Rejected alternatives and why:

- *Move the whole entity pass after the owning step* — that pass also restores health, allegiance and
  presence, which the accept path can read. Widening the fix widens the risk.
- *Stop the game's accept path from placing things* — that makes the objective behave differently in
  a replay than in a live run, which is the opposite of the product.

Re-asserting after the owning step is not a workaround for a failed write. The write is correct and
lands; the ordering is what is wrong, and re-asserting is how you express "this step owns placement,
and my value is the one that must win afterwards".

**Guard the re-assert on what the clip said, not on what is convenient.** Only entities the clip had
*on the field* get put back. An entity the clip recorded as parked belongs to its fight until the
fight sends it in, and holding it to a recorded position fights the game — the same trap as
[[a-check-that-returns-pass-for-not-applicable-launders-absence-of-evidence]], where treating an
inapplicable case as applicable manufactures a result.

## Related

- [[a-drift-number-cannot-tell-a-missing-write-from-an-overwritten-one]] — the instrument that found
  this, and why the obvious check could not.
- [[write-restored-state-to-whoever-owns-it]] — the same ownership question, asked at write time rather
  than at ordering time.
