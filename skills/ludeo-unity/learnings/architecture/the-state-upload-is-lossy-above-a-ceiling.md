---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "4,5"
question: "How many objects does your capture track in the busiest level? Above roughly a hundred the state upload starts DROPPING objects silently — every CreateObject still returns Success — so scope the sweep on a logged per-type census and log a warning when the count climbs."
sanitized: true
---

# The state upload is lossy above a size ceiling, and every per-object success code still says Success

Three separate bug reports on one integration — "restore works but I see no enemies at all", "it
does not restore the collectibles I picked up", "the replay destroys things I never touched" — were
all the same cause: **the state payload was too big and the backend silently kept part of it.**

Two measured failure modes, both with a clean capture log:

```
163 objects sent  ->  upload fails, "request failed with ec 'end of stream'"
                      the stored Ludeo comes back with FOUR objects, one per objectType
163 objects sent  ->  147 stored   (Enemy 31->26, WorldObject 129->118)
 34 objects sent  ->  fine
```

All 163 `CreateObject` calls returned `Success`. **Per-object success codes prove nothing about
what the backend stored.** The ceiling is a lossy degradation, not a hard cap and not an error, so
the smaller test that passed earlier is not evidence the design scales.

## What makes it dangerous rather than merely lossy

Truncation interacts with the terminal rule ("absent from its bucket means it was destroyed before
the capture instant"). A dropped object reads as a *dead* object, so the restore destroys entities
the player never touched — roughly 5 enemies and 11 pickups per replay here, and in the
`end of stream` case every enemy in the level. See
[[an-empty-bucket-must-not-mean-everything-died]] for the rail that has to exist regardless.

## Scope on a logged census, not on intuition

Two scoping decisions were made by guessing at what dominated the sweep, and the first was simply
wrong — moving platforms were dropped to fix the truncation and it achieved nothing, because there
were barely any in that level. One log line settled it:

```
Coin:116, Leaf:6, Checkpoint:2, Shield:2, ExtraLife:1, Bonus:1, Surprise:1   (type names generalized)
```

116 of 129 world objects were one collectible type. **Log a per-type breakdown at registration**
before choosing anything to drop.

## Practical consequences for the wave plan

- **Do not track high-count collectibles individually.** Their *count* is what the player and any
  objective read, and one counter on the session singleton carries it. Where "already collected"
  matters, carry the consumed ones as one keyed string on the session object rather than one
  tracked object each — keyed by a stable identity, never as a positional mask over a roster whose
  order is not stable across the round trip.
- **Warn at the gate.** Capture now logs a warning above ~80 tracked objects, so an over-wide sweep
  surfaces during the run instead of as a truncated Ludeo three bug reports later.
- **The ceiling is unmeasured.** 34 worked, 163 did not; 80 is a guess. Say so in the plan rather
  than presenting it as a limit, and treat the payload as a budget every later wave spends from.
