---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Are you capturing an OWNER reference so the restore can re-register spawned entities with the thing that produced them — and does that owner hold MORE THAN ONE collection of spawned entities?"
sanitized: true
---

# Capturing "who owns me" is not enough — restore has to re-register into the owner's SPECIFIC collection

The standard move for restoring runtime-spawned entities is well understood: the spawner's population
counter can only be moved by incremental side effects, so restore must **recompute it from ground truth**
by re-registering each restored clone with its owner (`07 §9`). That needs an owner reference, so the
capture plan adds one attribute — `OwnerSpawnerKey` — and a matching restore seam,
`RegisterRestoredSpawn(clone)`. Both sides look complete and the plan's cross-entity table closes.

**Check how many spawned-entity collections the owner actually has.** In the observed project one boss
had three, all on or under the same GameObject:

| Collection | Lives on | What it gates |
|---|---|---|
| the continuous minion drip | the boss controller | a live cap (`count < max`) that decides whether the boss keeps spawning |
| a summon-attack state's list | a child state controller | an `AreEnemiesAlive()` test that decides whether the attack may re-fire |
| a cocoon-attack state's list | another child state controller | teardown only |

The owner index built at capture walked all three, and recorded the same thing for every hit: the owning
**enemy's** key. So at restore the layer knows a minion belongs to that boss and cannot know which of the
three lists produced it — while the seam it has to call is a **method on one specific list**. Three
approved write seams, and the data to choose between them was never captured.

## Why this is invisible until the restore is written

Capture-side the three lists are interchangeable: you are enumerating them to answer "is this entity
owned?", and any of them answering yes is a complete answer. Restore-side they are not interchangeable at
all, because each one gates different forward-play behaviour. The asymmetry only appears when you write
the `Register*` call and discover the argument has no source.

It also survives review, because the plan row reads `MinionOwnerKey → keyMap[key] → RegisterRestoredMinion`
and that sentence is true for all three seams.

## What to do about it

- **At capture (the earlier-wave guardrail):** if the owner has more than one such collection, record
  **which one** — an ordinal, or fold it into the owner key as `{ownerKey}#{listId}`. It costs one
  attribute and it is the only thing that makes the restore deterministic.
- **If the capture is already taken** (re-capturing invalidates existing Ludeos), pick a discriminator
  from data you *do* have and write it down as a stated approximation rather than a fix. In the observed
  project the entity's own class worked: only the summon-attack list can produce entities of other
  families, so those are unambiguous, and the ambiguous remainder is filed into the list carrying a live
  **cap**, because that is the only one where a wrong count changes forward play. The list with no
  counter and no cap absorbs the error harmlessly.
- **Rank the collections by consequence before choosing**, not by which seam is most convenient: a
  population cap that stalls or duplicates spawning outranks an "are any alive" latch, which outranks a
  teardown-only list.
- **Log the choice.** `minion→dripList` vs `minion→summonList` in the restore report is what lets a gate
  distinguish a mis-filed minion from a missing one.

## The generalization

**An owner reference answers "who", but a re-registration seam is a method on a *collection*.** Whenever a
restore plan resolves a reference to an owner and then calls a mutator on that owner, ask what the mutator
actually mutates and whether the owner has more than one of them. The same shape appears wherever an
entity is registered into a manager that keeps several parallel lists: pooled projectiles by pool, UI
entries by panel, agents by squad *and* by objective. Capturing the owner is the easy half; capturing the
**slot** is the half that makes restore deterministic.
