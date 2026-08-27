---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: 1,4
question: "Procedural world? Map every random source in phase 1 KYG and record WHICH STREAM each load-bearing one draws from, then confirm empirically in phase 4 by replaying ONE clip twice and diffing the world. Generators routinely draw their LAYOUT from a seeded stream and their CONTENT from the engine's global RNG - so the same seeds rebuild the same rooms filled with different things, and every downstream capture is measured against a world that is not the recorded one."
sanitized: true
---

# Seed replay reproduces only what the seeded stream draws — check the rest before you trust it

A procedural game that stores a seed invites an obvious conclusion: capture the seed, replay it,
and the world comes back. It half works, and the half that fails is silent.

The failure shape: the generator owns a properly seeded stream
(`new System.Random(mainSeed)`) and uses it for the **layout** — which rooms, in which
arrangement, at which coordinates. Then the *contents* of those rooms — props, dressing, chests
and their rarity, enemy composition, per-room decoration — are drawn from the **engine's global
RNG** (`UnityEngine.Random`), whose state at the moment of the draw depends on everything else
that has run in the process since launch.

Same seed, same rooms, **different things inside them, every single run**.

## Why it stays hidden

Every early check passes. The room layout is stable, so the map looks right, navigation works, and
the restore lands entities in rooms that exist. The instrumentation you build first — does the
player restore, do enemies restore, does the encounter resume — all reads green, because all of it
is measured **against whatever world this particular run happened to generate**.

What it produces instead is *intermittency*, and intermittency is the most expensive symptom to
chase because it invites you to blame timing. On one integration this surfaced as three separate
"bugs" over two sessions — enemies occasionally invisible, enemies occasionally falling through the
floor, an occasional missing enemy blocking completion — each investigated on its own, each
reproducible only sometimes. They were one thing: the destructible props an enemy stood on, and the
population of the encounter, were re-rolled on every replay.

The human noticed it before any log did, and not by looking for it: *"the chest in this room is not
in the same place or the same value every time. It was blue here."* A prop that a player happens to
look at twice is a better determinism test than any check that was actually written.

## Map it in phase 1, prove it in phase 4

The static half belongs in KYG, where it costs minutes: grep every random source, keep only the
sites that decide **what exists** (layout, dressing, loot, enemy composition — not footstep audio),
and record **which stream each one draws from**. That single column is the finding. A generator with
`new System.Random(seed)` for layout and `UnityEngine.Random` for contents has already told you the
answer before a line of integration code exists.

Doing this at phase 4 or later is not merely late — capture has been designed by then, and the
verdict changes what you would have captured.

## The empirical test — run it in phase 4, before trusting seed replay

Replay **one clip twice** and diff a fingerprint of the world taken at the same deterministic
instant in both (after the restore settles is a good point). Record, separately:

- the seeds actually in effect, and the physics settings, so a difference in those is ruled out;
- **count + order-independent hash** per category: modules/rooms, destructibles, entities;
- a floor probe if entities are falling — a grid of downward rays, naming holes by coordinate.

Hash with something stable across processes (FNV-1a over values rounded to a fixed precision).
`string.GetHashCode` is not guaranteed stable between runs of the same binary, which would make
every run differ and prove nothing.

Read it like this:

| Result | Meaning |
|---|---|
| layout hash matches, content hashes differ | **this learning** — content draws from the global RNG |
| everything matches | world is deterministic; a difference in behaviour is timing |
| layout hash differs | the seeds are not being applied at all — a different, larger problem |

## The fix, in the order worth doing it

1. **Seed the global stream around the generation window** — `Random.InitState(recordedSeed)`
   immediately before content generation, restoring the previous state afterwards so live gameplay
   randomness is untouched. One line, no call-site edits, covers every generator draw at once.
   Re-run the two-replay diff: if the hashes now match, done.
2. **If they still differ**, something outside the generator is drawing from the global stream
   during that window and consuming draws. Route the generator's own picks through the seeded
   stream instead (the generator usually already has one) — that is immune to anything else in the
   process. In practice the meaningful surface is small: a handful of shared weighted-pick helpers
   that the rest of the generator funnels through, not every call site in the codebase.

Do **not** start by converting every `Random.*` call site. Most are cosmetic (footstep audio, VFX
jitter) and irrelevant to replay fidelity, and the count is intimidating enough to make the real
work look bigger than it is. Find the ones that decide *what exists*.

## Related

- [[seed-replay-can-remove-the-placement-capture-entirely]] — the optimistic half of the same
  subject. That learning is correct that derived placement comes back for free **when the layout is
  reproduced**; this one is the precondition it assumes. Verify determinism before leaning on it to
  delete a capture.
- [[validate-placement-after-restore]] — placement checks measured against a re-rolled world
  produce noise that reads like a placement bug.
- [[make-the-restore-verify-every-value-it-writes]] — the same principle one level up: verify
  against the world, and make sure the world itself is the one you recorded.
