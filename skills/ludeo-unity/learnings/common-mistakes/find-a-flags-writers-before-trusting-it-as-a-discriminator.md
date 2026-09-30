---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 4,5
question: "About to tell one kind of entity from another by reading a field on it - an enum like enemyType, an isBoss/isElite bool, a category tag? Grep for that field's WRITERS first. If the only assignment in the whole project is its own initialiser, it is authored per-prefab, it may never have been filled in, and nothing at runtime may even read it. A census built on it returns a true number that answers the wrong question."
sanitized: true
---

# A flag with no runtime writer is not a discriminator — check its writers before you count with it

A gate was added to settle one claim: that a special entity (a boss) was already covered by the
existing per-entity bucket, because it comes out of the same pre-instantiated pool as everything else.
The census counted, at runtime, how many indexed actors had `enemyType == Boss`.

**It returned zero of 723.** That was written up as "the special entity is not in the tracked cast",
the plan's main claim was marked refuted, and a new work item was opened to find out where the entity
really comes from.

All of it was wrong, and the number was correct.

## What the number actually meant

Tracing the spawn path end to end showed the entity *is* in the cast — instantiated at level build by
the ordinary spawner, sitting disabled in the shared pool, on a spawn point under a spawner the index
walks. Three greps then explained the zero:

1. **The field has no runtime writer.** The only assignment to `enemyType` in the entire project is its
   own declaration initialiser, `= EnemyType.Normal`. It is authored per-prefab and nothing ever sets
   it in code.
2. **Nothing in the feature reads it either.** The fight manager, the fight and the wave classes never
   mention it. The entity's own health bar — the most visible "this is a boss" behaviour in the game —
   runs off a *different* authored flag.
3. So the entity works end to end, bar and all, with the flag left at its default. Whoever authored
   that prefab simply never set it, and nothing ever complained, because nothing depends on it.

The census was a true measurement of a field the game does not use.

## Why this is worse than a gate that cannot fail

A gate that cannot fail is silent. **This one spoke, confidently, in the failing direction**, and a
false negative on a coverage question is expensive: it invents work that does not exist and casts doubt
on a conclusion that was right. It also passes every review that asks "can this test fail?" — it can,
it did, and the result was still meaningless.

## The habit

**Before using any field as a discriminator, find its writers.**

```
grep -rn "\.theField\s*=" Assets --include=*.cs     # who assigns it?
grep -rn "\.theField\b"   Assets --include=*.cs     # who reads it?
```

- **No writers** → it is authored data. It may be unset on the very instance you care about, and you
  cannot read the authored value from a binary prefab. Do not count with it.
- **No readers either** → it is vestigial. Its value tells you nothing about behaviour, because nothing
  behaves differently.
- **The feature you care about reads a *different* field** → that is your discriminator, or a clue to
  where the real one is.

## The corrected census, and what it returned

Swapping the flag test for a content-driven address match settled it in one run:

```
enemy slots indexed=723; the boss encounter names [<boss prefab>];
matched in the tracked cast=1 -> slot 1164 '<boss prefab>'
    enemyType=Normal  bossBar=True  active=False;
recycler queues: <boss prefab> ready=1;
(the old enemyType==Boss test would have counted 0)
```

The entity was there all along, on a known slot, disabled in the recycler — and the authored flag the
first census trusted was sitting at its default on the very instance it was meant to identify, while a
*different* authored flag (the one driving the health bar) was correctly set. **Print both the new
answer and the old one**, as that last line does: it puts the contradiction in the run artifact instead
of in somebody's head, and it is what makes the correction reviewable later.

## What to use instead

Prefer something **derived from the data that drives the feature**, not from a label on the entity. In
this case the encounter that summons the boss names the prefab it wants, and the spawner stamps that
name onto every instance it creates, so the reliable test was:

> does this actor's address / original prefab name appear in the boss encounter group's enemy pool?

Public end to end, data-driven, needs no hardcoded name, and it works on maps nobody has looked at —
because it asks *"is this the entity the content says is the boss"* rather than *"did somebody tick a
box on this prefab"*.

Related: [[a-degenerate-subject-makes-a-passing-restore-test-prove-nothing]] — same family. That one is
a gate that cannot fail; this one is a gate that fails for a reason unconnected to the question. The
shared root is that a verdict is worthless until you can say what it is measuring.
Also [[walk-the-accessor-chain-before-scoping-a-game-code-edit]], which is the same "check before you
conclude" move applied to accessors instead of flags.
