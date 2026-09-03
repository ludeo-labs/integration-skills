---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 5
question: "Is your entity key derived from a float coordinate - a spawn point, an authored position - and matched on restore by equality or by a quantised hash? Capture and replay build their worlds independently, so those floats will not agree bit-for-bit. Match by nearest-neighbour within a tolerance instead."
sanitized: true
---

# A stable key travels correctly and still matches nothing — match by proximity, not equality

A key derived from an entity's authored position is a good key: unique within the recording,
unchanging for the entity's lifetime, and carried in the capture as a value rather than recomputed.
All of that can be true and the restore can still match **zero** entities.

The observed failure, from the diagnostic that finally printed both sides:

```
recorded enemy:            key derived from (39.10, 20.70)
rebuilt enemy [7]:         key derived from (39.10, 20.71)
```

The same enemy. X identical, Y **one centimetre** apart. The key quantised to a centimetre before
hashing, so `20.70` and `20.71` landed in different buckets and the lookup missed. The single
recorded enemy matched none of the nine in the rebuilt room, and the reconciliation — reading that as
"the recording says this room is empty" — switched the entire population off.

## Why quantising does not save you

Quantising feels like the fix for float noise, and it is the trap. It does not remove the boundary —
it *creates* one, and any value that lands near it flips depending on which build produced it. A
finer grid narrows the window; a coarser grid widens the bucket until distinct entities collide.
Neither makes equality safe, because capture and replay assemble their worlds through different code
paths (a live room build vs. a restored one), and float coordinates do not survive that
bit-identically.

## The distinction worth holding

Two different jobs get confused under the word "key":

| Job | Requirement |
|---|---|
| Identify an entity **within** one recording, tick to tick | unique + unchanging — equality is right |
| Match a recorded entity **to** a separately rebuilt world | nearest-neighbour within a tolerance |

The key itself was never wrong. The comparison was.

## The shape that works

Greedy one-to-one assignment on distance from the recorded key position:

- for each recorded entity, take the nearest **unclaimed** entity in the rebuilt world;
- accept it only within a tolerance, and claim it so nothing matches twice;
- pick the tolerance from the two scales you actually measured — here the divergence was 1 cm while
  authored enemies sit metres apart, so anything in between separates "float noise" from "a
  different entity" with room to spare.

## Two things that made this cheap to find, and one that made it expensive

- **Print both sides on mismatch.** Counts alone cannot distinguish "the room has different
  entities" from "the same entities keyed differently", and those want opposite fixes. One dump of
  recorded-keys beside rebuilt-keys ended a session of speculation.
- **Refuse to reconcile on a total mismatch.** If the recording carries entities and *none* match,
  that is an identity failure, not an empty world. Switching everything off hands back a dead room —
  strictly worse than doing nothing. Count matches before writing, and bail loudly at zero.
- What made it expensive: reading the mismatch as a *population* problem and hunting for why the
  room had the wrong enemies, when the room had exactly the right ones all along.

Related: [[a-stable-key-must-travel-not-be-recomputed]] — the complement. That one says the key does
not need to be reproducible on the replaying machine because it is carried as a value. This one is
what remains true after you accept that: the carried value still has to be *matched* against a world
someone else built.
