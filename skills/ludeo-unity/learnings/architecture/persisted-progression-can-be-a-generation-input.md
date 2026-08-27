---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: 2
question: "Procedural world, and you're planning to reproduce it by capturing the RNG seed/state? Read the generator's own entry point for reads of PERSISTED player progression - many builders drop or unlock content based on save data, so the same seed produces a different world for a different player."
sanitized: true
---

# In a procedural game, the seed may not be the only generation input — persisted progression often is one too

The determinism work on a run-based procedural game had reached a comfortable
conclusion: route every random draw through one seeded stream, capture that
stream's state as a single `uint`, and the world becomes reproducible. The shared
random helper was converted, the generator's draws all resolved to the seeded
stream, and the capture surface was genuinely one integer.

Then reading the live world-builder's opening block changed the picture. Before
rolling anything, it **filtered the level set using persisted player state**:

```csharp
// Neutral illustration of the shape - not client source
for (int i = levels.Count - 1; i >= 0; i--)
{
    bool alreadyDoneOnce = levels[i].triggerOnce
                        && SaveRead.GetString(CompletedKeyFor(levels[i])) == DoneMarker;
    bool gatedByProgress = levels[i].IsProgressionGate
                        && (SaveRead.GetInt(RunCounterKey) >= levels[i].UnlocksAtRun);

    if (alreadyDoneOnce || gatedByProgress)
        levels.RemoveAt(i);      // <-- the level set differs per player, before any roll
}
```

Three separate persisted values fed that filter: a per-level "already completed" marker, a total run counter, and a furthest-progress cursor.

**So the same seed does not produce the same world.** It produces the same world
*for the same progression state*. Replay a clip on a fresh profile, or on a
profile further along, and the generator is rolling against a different candidate
set — the stream is identical and the output is not.

## Why this is easy to miss

The determinism investigation naturally scopes itself to *randomness*: find the
`Random` calls, find the reseeds, route them through one stream. That scope is
correct and it is incomplete. A generator's inputs are **everything it reads
before it decides**, and non-random inputs never show up in a search for random
ones.

It is also easy to mis-file. The progression keys look like *save data* — the
thing you restore — rather than *generation inputs* — the thing you must match
before the world is even built. They are both, and the generation role comes
first in the ordering.

## The check

At the phase-2 mapping stage, open the **live** builder entry point (confirm which
overload is live — these classes often carry several, with the real one selected
by a config flag) and read from the top until the first roll. Everything it reads
before that point is a generation input. Look specifically for:

- save/prefs reads (`GetInt` / `GetString` / a save façade)
- progression counters, unlock gates, "already seen/completed" markers
- difficulty or new-game-plus tier
- authored data assets selected by an index that itself comes from save state

Record them **alongside** the seed in the map's generation-input list, and say
plainly that the seed alone is insufficient. Then phase 4/5 can decide whether to
capture those values, or to pin the replay profile so they cannot drift.

Related: [[seed-replay-only-reproduces-what-the-seeded-stream-draws]] — the
neighbouring failure, where the stream itself is incomplete. This one is the
opposite direction: the stream is *complete* and still not sufficient.
