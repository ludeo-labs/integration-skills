---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "4,5"
question: "Are you about to capture a list of ids the game holds - unlocked content, owned items, completed objectives, seen tutorials - as a count plus one indexed attribute per entry? Measure the list's real size on a maxed-out profile first. If the universe is authored and ships with the build, a bitmask over that authored order costs a fixed handful of names instead of one per entry - but it is an ordinal encoding, so it needs a fingerprint guard."
sanitized: true
---

# A profile-wide id list is a bitmask over authored content, not an attribute per id

The count-plus-indexed pattern (`listCount`, `list{0}`) is the right default for a *bounded* collection
— a character's equipped items, a run's modifiers. It stops being right the moment the collection is
"everything this account has ever unlocked", because that grows with the authored content, not with the
run, and every index that is ever written mints an attribute name **permanently for the life of the
game version**.

## How the sizes actually came out

The integrator asked a question worth asking of any list before designing its capture: *how many of
these are there, and how many matter?* Decoding a real maxed-out profile answered both, and neither
number was the one in the notes:

| | |
|---|---|
| ids in the profile's unlock list | 436 |
| ids the game **authors** (the real universe) | **817** |
| of those, ids that can affect a live run | **162** |

The earlier plan had been written against a 7-entry sample from a barely-played profile, where one
attribute per id looked free. Against 817 it would have minted 818 names on a schema that had already
been cut from 2,213 to 684 after an earlier version reached 18,491 and **stopped accepting updates
inside the client timeout**. Same design, same code, two orders of magnitude apart in cost — and only
measurement separated them.

## The shape that works

Both the recorder and the replayer run the same build, so the authored content list is identical on
both sides. Capture *which positions* were set, 32 per int:

- 817 ids → **26 mask words + a count + a fingerprint = 28 names**, whatever any profile holds.
- The count is written separately and truthfully, so "nothing was unlocked" is distinguishable from
  "the feature never ran" — the distinction that hides broken capture for weeks otherwise.

**Do not invent the order.** Most games already have a function that walks every content array to
resolve an id (`GetContentInfo(id)` or similar); that walk *is* the game's own definition of the
universe, and anything it cannot find the game already rejects. Mirror it, and say in a comment that a
new array added there must be added here in the same place.

## The hazard, and the guard that makes it acceptable

A bitmask is an **ordinal encoding**, and a Ludeo integration usually forbids those on purpose:
difficulty, for instance, is captured as the enum *name* and never the ordinal, because authored data
can be reordered between builds and a clip is replayed in a possibly-later build. Ship one new
character and every later bit shifts — silently unlocking the wrong content in every existing clip.

So carry a **fingerprint**: a stable hash over the ordered id list, written alongside the mask. The
restore recomputes it from the live build and **declines the whole mask on a mismatch**, falling back
to whatever the game did before the feature existed. A content patch then costs old clips this feature
rather than giving them wrong answers, and the log says which happened. Without the guard the bitmask
is not a defensible design; with it, it is.

## What to check before choosing it

1. **Is the universe authored and shipped, or does it grow at runtime?** A bitmask only works for the
   former. If entries are minted by play, it is an object type, not a mask.
2. **Measure on a maxed profile**, not on a developer's fresh one, and not on the notes.
3. **Ask which subset actually affects a run.** Here it was 162 of 817 — worth knowing even if you then
   decide to carry all of it, because it tells you what a failure would look like and which ids the gate
   must assert over.
