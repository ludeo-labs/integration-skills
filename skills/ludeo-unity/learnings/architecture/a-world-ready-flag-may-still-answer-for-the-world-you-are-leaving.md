---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does your restore flow poll a game-owned 'world/level is ready' flag to know when to restore? Find out what CLEARS it. If it is cleared by the loader or generator rather than by the load REQUEST, it still answers for the level you are leaving, and your gate passes on frame one whenever a level was already loaded."
sanitized: true
---

# A "world is ready" flag may still be answering for the world you are leaving

The replay flow needs one signal: *the recorded level now exists, so the moment can be rebuilt into
it.* Scene-loaded is not that signal — content streams in over many frames — so the natural move is
to poll the game's own readiness state. In this game that was a level-manager singleton exposing
`IsLoading` (a spawn-queue counter) and a boolean `IsSetupFinished`. Both looked authoritative.

`IsSetupFinished` is set true when the level finishes assembling. The trap is what sets it **false**:
not the load request, but a line near the top of the generator's start-of-build coroutine — which
runs only *after* the new scene is up and generation actually begins. Between "restore asks for the
level" and "the generator starts", the flag still holds the previous level's answer.

## Why this is worse than it sounds

It does not fail loudly. It fails by **succeeding at the wrong time**:

- **A level was already loaded** → flag is still `true` → the gate passes on the first frame after
  the load is requested. The layer freezes, opens the room and restores into the world it is in the
  middle of leaving. Looks like the flow works. It does not.
- **Cold start, no level yet** → flag is `false` and nothing has run to set it → the gate waits.

So the two cases disagree, and the *broken* one is the one that looks healthy. Ours spent a whole
session reading this as "replay only works if you play a level first, so it must need a live session"
— a plausible, entirely wrong causal story built on a false positive.

## The fix

Wait in two stages, and treat the flag as an **edge**, not a level:

1. wait until the flag reads `false` — the game admitting the old world is gone;
2. only then wait for it to read `true` (plus whatever loading counter it pairs with).

That needs no game-code change and no new game state. Note it also makes the wait honest on a cold
start, where stage 1 is satisfied immediately.

The alternative — have the integration write `false` itself before booting — was rejected: it means
the layer mutating state the game owns, and it hides the same bug from the game's own tooling, which
polls the same flag.

## The general rule

Any game-owned readiness boolean you poll across a level transition needs the same question asked:
**what clears it, and does that happen before or after the thing I am waiting for?** A flag reset by
the producer rather than by the request is a flag that lies for the whole duration you care about.
Level-scoped is not the same as edge-safe.

Related: see the learning on bounding this wait — a two-stage gate that stalls with no timeout and
no log is just as unreadable as the false positive it replaced.
