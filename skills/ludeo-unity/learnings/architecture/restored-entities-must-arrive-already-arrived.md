---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game reveal a newly spawned entity at the END of a timed arrival sequence - a dissolve, a fade-in, a spawn animation, an emerge-from-the-ground - rather than at the moment it is created? If so, a restore that spawns entities and then holds the world still will leave them present, correctly placed, correctly valued, and invisible."
sanitized: true
---

# A restored entity has to be placed already-arrived, not spawned

Spawn-from-data restoration re-creates entities through the game's own spawn path, which is
usually right: the entity gets its components, its network identity and its callbacks. But the
*visual* arrival is often a separate, timed sequence, and its last step is what actually reveals
the object:

```
show the mesh
start the dissolve / fade / spawn animation
await (dissolve has finished)      <-- timed, driven by the game's own clock
set visible
```

A restore does two things that break this: it spawns the entities, and then it **holds the world
still** — frozen, or at zero time scale — while it waits for the player to start the moment. The
arrival sequence is driven by that same clock, so it never advances past the await. Every restored
entity ends up present, at the right position, with the right health and the right references, and
invisible.

## Why it survives the checks you already have

It passes everything a position check asks. In the run that found this, the layer's own validation
reported *the enemy count intact, worst positional drift under a metre, no entity missing* — and a
third of them could not be seen. Placement validation confirms an object is where you put it; it
says nothing about whether the player can see it. The integrator noticed only because the entities
in front of them appeared while the ones out of view did not.

The one machine-readable hint was a stale state flag: entities still parked in the arrival branch
of their behaviour tree carried an arrival/dying flag that the recording said should be clear. That
flag disagreeing with the recording is a *symptom* of an unfinished arrival, not a value the
restore failed to write.

## What to do

At the point of restoring an entity, **complete the arrival instead of playing it**:

- snap the reveal effect straight to its finished value (most engines' effect controllers have an
  internal "finish now" step already - expose it rather than reimplementing the interpolation);
- set the entity's "arrival finished" flag;
- set it visible;
- show the mesh/renderers directly, rather than waiting for the sequence to do it.

The moment being restored is mid-fight. Nothing in it arrived a second ago, so no arrival should
play at all.

## Check for it explicitly

Add visibility to the per-entity restore check, ahead of the value comparisons, because it is the
failure that hides every other one:

> `entity 'X' is present but NOT VISIBLE [visible False, arrival finished False, dissolve 0.87]`

Print the arrival state alongside *any* per-entity complaint. It is what separates "the restore
wrote the wrong value" from "the entity never finished arriving" - two failures that otherwise
produce identical-looking wrong flags.
