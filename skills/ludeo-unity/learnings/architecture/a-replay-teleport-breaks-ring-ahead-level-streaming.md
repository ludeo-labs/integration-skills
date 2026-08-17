---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game prepare its level content just-in-time around the player - room setup one ring ahead, encounters configured as neighbors unlock? A replay that teleports the player breaks the streaming's ordering assumption: every room they then reach races its own late setup and loses. Prepare the WHOLE level before holding the world for the pre-play screen."
sanitized: true
---

# A replay teleport breaks ring-ahead level streaming

Games amortize level setup by streaming it just ahead of the player: the world build prepares the
first room and its neighbors, and each room the player claims prepares the next ring. The ordering
guarantee is the player's own walking pace.

A replay violates the assumption in one move: it places the player anywhere. Every room they then
walk into starts its setup only on arrival — and the room's one-shot entry trigger fires first,
finds no configuration, errors once, and leaves the room permanently dead. The observed shape was
total: an entire replay with zero spawns anywhere, from a single quiet error line per room.

## Two traps inside the fix

- **The setup pump may run on the game's own clock.** Here the setup queue only advances on
  game-time, which the restore hold freezes — so the full-level setup must be queued and drained
  in the boot window BEFORE the hold goes on, and the restore must wait on the processor's own
  idle signal before freezing.
- **Enqueue is not idempotent.** The per-module "already processed" state was only set at
  DEQUEUE, so queuing a module twice in one pass would run its setup twice — including the enemy
  pre-spawn, doubling the dormant population. Dedupe at the call site, and mirror the game's own
  skip rules and per-room type selection (pathfind-only for spawnerless and boss rooms) rather
  than inventing your own.

The generalization: any ordering guarantee the game gets for free from player locomotion —
setup streaming, trigger arming, LOD/culling state — is void after a teleport, and the restore
must re-establish it explicitly.
