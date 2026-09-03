---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Does the getter you capture return a value the game has ALREADY combined (magnitude times sign, local plus offset, base times multiplier), while the setter you restore through re-applies the same factor? The round trip is then exact in the default case and wrong in every other one — the case the mechanic exists for."
sanitized: true
---

# A capture/restore pair can be exact in the default case and inverted in the interesting one

The signature mechanic of this game is flipping gravity. The capture read the game's gravity getter;
the restore wrote through the game's gravity setter. Symmetrical by inspection, verified by play,
shipped.

It was wrong. The getter returns a field the game stores as `magnitude * sense`, and the setter does
`Change(value * sense)` — **applying the sense a second time**:

| captured state | stored value | restored value |
|---|---|---|
| upright, sense `+1`, magnitude 30 | `+30` | `+30 * +1 = +30` ✅ |
| upside-down, sense `-1`, magnitude 30 | `-30` | `-30 * -1 = +30` ❌ inverted |

Captured upright it is harmless, which is why it survives casual testing — and the failing case is
*exactly* the mechanic the census flagged as the one a wrong restore ruins. The value is applied
straight to the rigidbody, so this is real physics, not a cosmetic pose.

## The fix, and the general rule

Store the **unsigned component** and leave the setter as the single place the sign is applied. One
rule, one owner:

> Find the one place the game combines the parts, and make sure exactly one side of the round trip
> crosses it.

## How to find these before a player does

**Validate the chain end to end instead of trusting the pair.** Read the getter's implementation and
the setter's implementation in the same sitting, and write down what each does to the raw field.
Symmetry of *names* (`GetX`/`SetX`) says nothing; two functions written years apart by different
people routinely disagree about whose job a factor is. The same review pass caught three more:

- an accessor named for *lives* that actually sets *health*, so the restore needed a differently
  named setter for the count it meant;
- the setter early-returns while a zero-gravity mode is active, and that mode is not captured, so a
  Ludeo taken during it restores with the wrong fall speed (recorded as a known gap rather than
  fixed blind);
- ordering constraints that are load-bearing and invisible: the sense must be restored *before* the
  magnitude, and a checkpoint setter snapshots the **live** camera zoom, so the captured zoom has to
  be written after it. Pin both with a comment naming the dependency, or the next edit will reorder
  them.

## Changing what a captured field means invalidates existing Ludeos

There is no migration. When the fix changes a field's meaning — unsigned instead of signed — every
previously captured Ludeo is stale **for that field**, and a test against an old one measures the old
bug. Say so in the commit and re-capture, deliberately exercising the non-default case.
