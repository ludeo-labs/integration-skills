---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does the replay boot a procedural level by setting a seed and loading the scene? Before trusting that, check what ELSE the front end writes before it loads - the location/biome/difficulty selection, not just the seed. Skip it and the level still loads, the seed still takes, every readiness flag still goes true, and the world comes up with ZERO actors in it."
sanitized: true
---

# A world that reports "ready" can still be completely empty

Seed replay looks like a two-line boot: set the seed, load the level, wait for the generator. The
first automated attempt did exactly that and produced a world with **nothing alive in it**, in a way
that no error, no flag and no log line reported.

The measurements, from an instrumented wait:

```
arrived@3.3s   flagsReady@6.8s   readyToSpawn@6.8s   firstSlot@never   slots=0
```

- the level scene came up;
- the generator ran, and logged the **correct** seed;
- the integration layer's own readiness predicate went true;
- **the game's own spawner-ready predicate went true too**;
- and a **300-second** wait never saw a single spawn slot appear.

Then the front end's pre-load selection call was added — the one that sets the location/biome and the
difficulty — and the same boot produced **912 populated slots**.

## Why every check passed

This is not a stale-flag false positive, and diagnosing it as one wastes the session. Every flag was
**telling the truth**: generation really had finished. It had generated an empty world, because with
no location and no difficulty selected there was nothing for it to populate.

So "the generator says it is done" and "there is a world to restore into" are different claims, and
only the first one has a flag. The readiness predicate cannot distinguish *finished* from
*finished with nothing to do* — and neither can the game's own.

## The check that catches it

**Gate on substance, not on a boolean.** Wait until the thing you actually need exists and has stopped
changing — the spawn-slot count non-zero and stable for a couple of seconds — and treat the readiness
flags as *diagnostics you record*, not as the gate. Recording the flag timings alongside the first
real slot is what turns "it didn't work" into "the flags went true at 6.8s and the first slot never
came", which is a diagnosis on the first run instead of the third.

## The general rule for booting a procedural replay

Enumerate everything the front end writes **before** it loads the level, and treat that whole set as a
precondition of the world existing — not as cosmetic setup you can fill in later:

- the seed (the obvious one, and the only one usually remembered);
- the **location / biome / level-variant selection**;
- the **difficulty and any run modifiers** — often a generation input, not a runtime multiplier;
- the character/loadout selection, and whatever flag gates the game into honouring it.

Read the front end's own "start the run" method and mirror it in order. Each of those is a value some
selection screen produced, so the restore has to supply it in the screen's place. Anything you leave
out fails silently, because the generator has no way to know a value was *omitted* rather than
*chosen*.

Related: [[boot-the-replay-through-the-games-own-entry-flow]] is the same law from the other side —
route through the flow rather than around it. A sharp corollary found in the same session: the game's
"current game" singleton was a plain scene component absent from the menu scene, so the scene-change
API the restore naturally reaches for was **null exactly where clip selection usually arrives**, and
its null check merely logged and returned. Check that the transition API you plan to call actually
exists in the scene the player will be sitting in.
