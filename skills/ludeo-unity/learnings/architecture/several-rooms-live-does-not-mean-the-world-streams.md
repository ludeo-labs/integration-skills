---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: 4
question: "Is the game procedural with several rooms/areas live and navigable at once? Before importing the open-world/streaming tracking delta, check separately whether the world actually streams OUT — 'multi-room' and 'streaming' are two different facts, and a generated-all-at-once world is neither branch."
sanitized: true
---

# "Several rooms live" is not the same fact as "the world streams"

`procedural-world.md` §2.1 asks the decisive structural question — how many rooms are live at
once — and offers two branches:

- **single active room** → the single-container world restore is enough;
- **several rooms live or navigable** → "this is procedural ∩ open-world", so additionally load
  `open-world-tracking.md`.

Read quickly, the second branch reads as *multi-room ⇒ streaming*. It isn't. There is a third
regime the branch text doesn't name, and it is common in generated dungeon crawlers:

> **The whole level is generated and instantiated up front, and then nothing ever streams out.**

Several rooms are live and navigable — so the multi-room half applies — but no object is ever
unloaded, so the streaming half does not.

## Why conflating them costs you both ways

The two halves of `open-world-tracking.md` are independently switchable, and getting either
wrong is expensive in a different direction:

| Half | If you wrongly **include** it | If you wrongly **exclude** it |
|---|---|---|
| **Per-room mutation deltas** (cleared flags, doors, looted containers) | harmless — slightly larger capture | the player back-tracks in the replay and walks into a default-state room |
| **Streaming machinery** (stream-in/out hooks, "presence ≠ existence", gating unregister on a real removal signal, persistent world ids that survive a stream cycle) | you plan and write hooks for lifecycle events that never fire, and hunt for a "removed from world vs unloaded" distinction the engine code doesn't draw | in a genuinely streaming world, objects vanish from the replay |

So the streaming half is the one that punishes a false positive. Importing it into a
generate-all-up-front world produces a census full of stream-in/stream-out columns that are all
"n/a", and sends you looking for a world/persistence layer that doesn't exist.

## The check — two questions, not one

At the census, answer them **separately** and record both:

1. **How many rooms/areas are live and navigable at once?** → decides whether you need per-room
   mutation deltas and layout/connectivity.
2. **Does anything ever get unloaded while the session is still live?** → decides whether you
   need any streaming machinery at all.

Question 2 is answered from the level builder, not from the fact that content arrives through
an async/addressable loader. **An async, rate-limited loader is not streaming.** A builder that
enqueues every room's instantiation and drains the queue over several frames looks superficially
like streaming — content appears progressively, there's a load-complete flag to wait on — but it
is a one-way fill. The tell: find the *unload* side. If there is no per-room unload, release, or
cull-to-disk path that runs during play, the world does not stream, however asynchronously it
arrived.

## Record the negative result, don't just omit it

Write the "nothing streams out" finding into the census explicitly, with the evidence, and put a
`no` in every type's streams-in/out column. A reviewer who sees the column blank cannot tell
whether it was investigated and found not to apply, or forgotten — and this is exactly the
question that later phases will otherwise re-open once per wave.

The async loader still matters for a different reason: it sets the **readiness signal** the
restore's create-everything pass must wait on. Gate on the builder's own
"loading finished + setup finished" flags rather than on scene activation, and never on a
fixed delay.

Related: [[find-the-studio-s-own-repro-tooling-first]] — the same phase, the same instinct of
checking what the codebase actually does before importing a doctrine wholesale.
