---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 4,5
question: "About to rule out a candidate stable key because its value was decided at runtime — a rolled spawn position, a random pick, anything non-deterministic? That is the wrong test. A key has to be unique and unchanging WITHIN the recording; it does not have to be reproducible on the replaying machine, because it is written down and carried along, not recomputed."
sanitized: true
---

# A stable key has to travel, not be recomputed

`CR-014` bans `GetInstanceID()` and object references as keys, and the reason given is that they are
not stable across processes. That reason is easy to over-generalise into: *the key must be something
the replaying machine can arrive at independently.* It must not. The key is **captured as a value and
transmitted inside the Ludeo**; the replaying process reads it, it does not derive it.

The two properties a key actually needs:

1. **Unique** within its `objectType` bucket for the recording.
2. **Unchanging** for the entity's lifetime, so a per-tick diff addresses the same object each tick and
   cross-entity references still resolve at restore.

Nothing about reproducibility appears in that list. `GetInstanceID()` fails **(2)** in the only sense
that matters — its value is a handle whose meaning evaporates outside the process that minted it. A
recorded *number* does not have that problem, however it was originally chosen.

## The failure this produced

A run-based game had two enemy populations: hand-placed ones authored into the level, and ones a
spawner created at runtime. The authored population had an obvious key — the game recorded each
enemy's starting position, and authored coordinates are identical every run.

The spawner's enemies were then declared unkeyable, because *where they appeared was itself a random
roll*, and a **blocking prerequisite** was raised: change game code to stamp every spawned enemy with
a run-local id.

All of it was wrong, in two layers:

- **The test was wrong.** The spawn position, once rolled, was recorded and never changed again. It
  was unique and it was stable for the entity's life. That is a key. That it could not be *predicted*
  on another machine is irrelevant — it is not predicted, it is read out of the capture.
- **The premise was wrong too, and one method read would have shown it.** The game's own
  registration path wrote a starting-position record for **every** enemy it registered — and the
  spawner fired exactly that path. The "missing" data had been there all along. The claim had been
  made without reading the body of the method that would have had to be doing it.

## Two rules worth keeping

> **Before ruling a candidate key out for being runtime-determined, ask which of the two properties it
> actually fails.** Usually the honest answer is "neither" and the objection was about reproducibility,
> which was never a requirement.

> **Before declaring anything BLOCKING — especially when the remedy is an edit to game code — read the
> method that would already have to be doing it.** A blocking claim is the most expensive kind to get
> wrong: it stalls the phase and it buys a game-code change that did not need to exist. The integrator
> here caught it by simply not believing the claim: *"what do you mean they can't be identified? we do
> not have a name for them or class path or prefab?"*

## The residual risk that IS real

Uniqueness deserves an actual check rather than an assumption. A position-derived key collides if two
entities can be born at the same spot — a spawn-point pool that refills after being consumed, or two
authored entities placed at identical coordinates. Detect the collision at registration and append an
ordinal. That stays entirely inside the integration layer, which is the point: the cheap fix and the
expensive one differ by whether you touched the game.

Related: [[investigate-before-asking]].
