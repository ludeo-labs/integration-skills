---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: 4
question: "Procedural world, and you're about to plan capturing each room's resolved world transform? First check whether the room's transform is DERIVED from the content selection (a fixed coordinate→world mapping) or ROLLED independently (connector alignment + offsets). If derived, seed replay reproduces placement and the whole placement capture is unnecessary."
sanitized: true
---

# When placement is derived from the layout, seed replay reproduces it — don't capture room transforms

`procedural-world.md` §3 makes a strong, correct case for treating **placement** as its own
generation input: the room's world transform is rolled *independently of* which room it is
(entrance/exit connector alignment plus a per-transition offset), so reproducing *which* content
does not reproduce *where it sits*, and every absolute entity position you captured restores into
the void. The file's advice is to capture each room's resolved transform and replay it at the
placement seam.

That advice assumes a specific mechanism — **placement rolled from its own random stream**. It is
not the only way generated worlds place their content, and when the mechanism is different the
advice inverts.

## The other mechanism: placement as a pure function of the layout

Some generators don't roll placement at all. They assign each room a **grid coordinate** as part
of the layout decision, then map coordinate → world transform through a **fixed linear formula**
(coordinate multiplied by a room-size constant from the generation config). Placement is then a
*derived value*, not an independent roll:

```csharp
// synthetic illustration of the shape
gridX = Mathf.RoundToInt(worldPos.x / roomSize.x);
gridY = Mathf.RoundToInt(worldPos.z / roomSize.y);
// …and the inverse when placing
```

If the layout graph is reproduced (same seed → same coordinate per room) and the mapping is a
constant-driven formula, then **placement is reproduced for free**. Capturing per-room transforms
would store values you are about to recompute identically anyway — pure cost, and a second copy of
the truth that can drift from it.

## Distinguishing the two — the question to ask the placement code

> **Is the room's world transform computed from the room's *layout identity*, or from a roll that
> happens at placement time?**

Read the placement seam and classify what feeds the transform:

| Feeds the transform | Regime | Action |
|---|---|---|
| grid coordinate / index from the layout + constants from config | **derived** | do **not** capture transforms; re-drive the generator from the seed |
| connector index picks, per-transition offsets, jitter, any RNG call at placement | **rolled** | capture resolved transforms per `procedural-world.md` §3 and replay them at the seam |
| a runtime origin shift / floating-origin rebase | **frame-nondeterministic regardless** | capture relative to a reconstructed frame; this trips even authored worlds |

Check the third row separately and by grep — an origin-rebasing system defeats derived placement
even when the generator itself is perfectly deterministic. A clean negative result there is worth
recording.

## Two conditions the "derived" answer still rests on

Deciding "derived" is not the end of it. It converts the placement question into a **determinism**
question, and that debt is real:

1. **The layout graph itself must be exactly reproducible from the captured seeds.** Confirm the
   generator re-seeds its PRNG immediately before generating (so a variable number of earlier draws
   can't shift the sequence) and that every consumer of that stream goes through the same seeded
   accessor. A generator that draws from the *global* engine RNG for any layout decision has broken
   this without saying so.
2. **Capture every seed the generation path consumes, not just "the seed."** A primary seed plus a
   secondary roll is a very common shape, and replaying only the primary reproduces a different
   world.

And it is verified, not assumed: prove the round-trip at the first restore gate. The failure mode
is quiet — an early capture (before much of the level exists) restores perfectly while a deep one
lands in the void — so verify **from a deep state**, not from the start of a level.

## Why this is worth stating

The placement capture is not a small feature. It means a per-room object type, a key per room, a
capture path, and an injection point at the generator's placement seam that has to be found and
gated. Concluding it is unnecessary — **on evidence, in one focused read of the placement code** —
removes an entire object type from the plan before any of it is built. The reverse mistake, assuming
"derived" because the world *looks* grid-like without reading the mapping, is the expensive one, so
cite the mapping code in the census when you make the call.

Related: [[find-the-studio-s-own-repro-tooling-first]] — a studio repro tool that teleports to
absolute captured coordinates after a seed replay is direct empirical evidence that placement is
derived, and it's evidence the studio already validated against real bug reports.
