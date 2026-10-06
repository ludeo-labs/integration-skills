---
category: engine-quirks
tier: generalizable
sourceGame: SurvivalSample
phase: 4,5
question: "Are you relying on seed replay to reproduce a procedural world (so you can exclude placement or population from capture as 'derivable')? Before you do, check which RNG each spawn/selection call actually draws from — a file-scoped `using` alias can make `UnityEngine.Random` read exactly like the project's own seeded generator, and a folder-scoped grep will not find it. The mirror case: a call site on the project's real seeded type can still be unseeded if that instance was built with a parameterless `new()` — read each instance's constructor, not the type name."
sanitized: true
---

# Two disguises for an unseeded draw: a `using` alias, and a seeded type built with `new()`

Extends [[seed-replay-only-reproduces-what-the-seeded-stream-draws]]: that lesson says to record which
stream each load-bearing draw comes from. These are the two ways that record comes out wrong while
looking right.

## Disguise 1: a `using` alias makes the engine's global RNG look like the project's seeded one

Seed replay is the cheapest possible restore for a procedural game: capture the seed, re-run the
generator, and every tile, room and spawn slot comes back for free. It lets you mark a large amount of
world state `exclude(derivable)` instead of capturing it. That is a real and correct saving — **for
whatever actually draws from the seeded generator.**

The trap is that a C# `using` alias is file-scoped and can bind a familiar name to something else
entirely:

```csharp
using RandomGenerator = UnityEngine.Random;   // at the top of ONE file
...
int variantIndex = RandomGenerator.Range(0, _prefabPaths.Count);
```

If the project also has its own seeded `RandomGenerator` class — and a game that talks about seeds
usually does — then this line reads, at every call site, exactly like a seeded draw. It is not one. It
is the engine's global, process-wide RNG, and unless something explicitly seeds it, it produces a
different value on every launch.

In one integration this decided the population of the whole horde. Tile placement was genuinely a pure
function of the seed and reproduced perfectly. But *which enemy variant* occupied each spawn slot was
drawn through the aliased name, from the unseeded global RNG. So the same seed rebuilt the same world
with the same slots in the same places — and put **different creatures in them**.

## Why the usual searches miss it

- **A folder-scoped grep misses it.** The generator lives under a procedural-generation folder; the
  spawner that picks variants lived elsewhere. Scoping the determinism audit to the generator's folder
  looked thorough and covered the wrong half.
- **A name-based grep misses it.** Searching for the seeded generator's type name *matches* these call
  sites, because the alias reuses that exact name — so the file appears to be using the seeded
  generator, confirming the wrong conclusion instead of exposing it.
- **Reading the call site misses it.** Nothing is visible at the draw. The alias is one line at the top
  of the file, often above the namespace, hundreds of lines away.

## How to check

1. **Grep for the alias form itself** across the whole project — `using \w+ = UnityEngine.Random` — not
   just for the engine type's bare name. Do this before trusting any "derivable from the seed"
   disposition.
2. **Ask whether the engine's global RNG is seeded at all**, and where: search for the engine's
   init-state call. If the only hits are mid-gameplay, the global stream is *not* deterministic per run
   — and worse, a mid-run reseed makes even the global stream depend on whether some ability fired
   earlier, so two runs diverge from the moment it does.
3. **For each thing you want to mark derivable, name the generator it draws from.** "Derivable from the
   seed" is a claim about a specific RNG, and it should be as citable as any other row.

## What to do when you find it

Do not try to make the game deterministic. **Capture what the seed cannot reproduce.**

- Keep the seed for the half that *is* reproducible (geometry, slots, layout).
- Capture the identity of what occupies each slot — the prefab/asset name or address — as a normal
  attribute, and key entities on something the generator does not roll: a **spawn-point id assigned by
  a sequential counter over fixed-order loops** is ideal, because it survives death, culling and pool
  recycling and usually already has a public lookup.
- Treat the captured identity as a **tripwire as well as data**: if a replayed slot's occupant does not
  match what was captured, the restore has just detected non-determinism it can report rather than
  silently rendering the wrong thing.

## Disguise 2: the seeded type, constructed with `new()`

The alias grep does not catch the mirror case. Here the call site really *is* the project's own seeded
generator class — no alias, no `UnityEngine.Random`, nothing to grep for — and the draw is still
non-reproducible, because of how that particular **instance** was constructed:

```csharp
// synthetic illustration of the shape
public class RandomGenerator
{
    public RandomGenerator()           { m_rng = new System.Random(Guid.NewGuid().GetHashCode()); }
    public RandomGenerator(int seed)   { m_rng = new System.Random(seed); }
}

// ...in a manager, hundreds of lines from anything about determinism:
private RandomGenerator _randomGenerator = new();
```

Every check clears it: the type check (it is the seeded class), the alias grep (nothing aliased), and the
seeding search (which finds the *world generator's* instance being seeded properly, and it is easy to
assume one generator serves the project). On the integration this came from, placement through the world
generator was genuinely reproducible for the ~28 objects it placed; a second family of objects, spawned
by a different manager through a `new()`-constructed instance of the same class, landed somewhere
different on every launch. Marked `exclude(derivable)` from the type name, a replay would have stood them
in the wrong places with nothing in the capture able to say so.

**Check each instance, not the class.** Find every construction and read the constructor it reaches:

```bash
grep -rn "new RandomGenerator(" --include=*.cs .    # arguments visible; also check `= new();` fields
```

Sort the hits: seeded from something the capture can reproduce, or passed nothing. A parameterless
construction is a finding until you have read the default constructor. Record the verdict per instance,
naming the constructor — "draws from `_randomGenerator`, constructed with no seed, therefore
GUID-seeded", not "draws from the project's seeded RNG". The same trap exists for anything whose
determinism is a constructor argument rather than a class invariant: hash providers, shuffles, id
generators, noise functions.

## The wider lesson for the seed-replay measurement

When you verify seed replay by hand, **compare the things the seed is supposed to determine *and* the
things you assumed it determines.** A test that checks only geometry passes cheerfully while the
population differs. Check a far-from-origin landmark's transform *and* the identity of what is standing
on it.
