---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: 5
question: "Does the game create any tracked entities (pre-spawned waves, pre-placed enemies, warm pools) BEFORE the capture segment opens - e.g. during level build, which finishes before gameplay starts?"
sanitized: true
---

# Pool hooks alone miss entities that predate the capture

Registering pooled entities through spawn/despawn hooks is the right seam - but hooks only
see events that happen **while the capture exists**. This game pre-spawned each room's
first enemy wave during level construction, before the capture segment opened. Result: a
recording carried 49 of the 104 enemies actually alive, and the missing set included the
very room the player was fighting in at the restore point.

The failure is quiet and *partial*, which makes it treacherous: rooms whose async
pre-spawn happened to finish after capture start DID register (their counts matched
perfectly), so spot checks pass while half the world is missing. Which rooms make it in
depends on module streaming order - i.e. it varies run to run.

## The rule

At capture start (or world-ready, whichever is later), **sweep the game's own registry of
live entities** - every spawn manager's alive list, the pool's active set, whatever the
game itself uses for bookkeeping - and run each through the same registration path the
hooks use (make registration idempotent so the sweep and the hooks compose). The hooks
then cover everything born after.

Cross-check that proves it worked: compare the number of captured entity objects against
the game's own alive counts (this game's encounter objects recorded `GetAliveNpcCount` per
room - captured NPCs per room must match it). That comparison is what exposed the gap
here, from the platform's stored snapshot alone, before anyone read a line of code.
