---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: 5
question: "Does the restore spawn BOTH physics-settling entities (corpses/ragdolls/debris that need fall time) AND mobile AI (that wanders during any unpaused frame)? If so, stagger: physics entities first with a long settle, mobile AI last, just before the pause."
sanitized: true
---
# Staggered restore: spawn physics-settling entities first, mobile AI last — their settle needs conflict

## Precondition
The Player-Flow restore runs **unpaused** (it must — spawning/anim/physics need ticking), then pauses
for OpenRoom/RoomReady. The restored set contains both:
- **physics-settling entities** — corpses/ragdolls (see
  [[captured-dead-entities-restore-as-corpses-via-death-path]]), debris, anything gravity must place;
- **mobile AI** — live enemies whose controllers start pathing the moment they spawn.

## The conflict
These two groups want opposite settle windows, and a single window cannot serve both:
- A **short** settle (a few frames) pauses before ragdolls land → the moment's first frame shows
  bodies frozen **mid-collapse, floating**.
- A **long** settle (~1.5s, enough for ragdolls to rest) gives live AI that whole window to walk off
  their captured positions → entities drift meters before the pause.

## The pattern
Stagger the spawns so each group gets exactly the window it needs:
1. **Restore** — apply player state, spawn the physics-settling entities NOW; hold the live AI's
   restore data in a pending list (do not spawn them yet).
2. **Physics settle** — ~1.5s at 60fps (frame-counted: budget for the slowest platform — a
   frame-counted window spans 2x the wall-clock at 30fps, which is fine here; more settle is safer).
3. **Spawn the live AI** from the pending list at their exact captured transforms, give them only the
   original short init settle (a few frames), then pause → OpenRoom.

With no physics entities in the capture, skip straight to the original single-stage behavior.

Result: ragdolls rest on the floor AND live AI is within centimeters of its captured spot at the
moment's first frame. Verified on cloud: all entities present, maxOff <= 1.7cm, live-entity drift
eliminated (vs ~meters with the single long window).

## Why not freeze the AI instead?
Freezing/time-dilating the live AI during a long settle re-introduces the gameplay-altering band-aid
pattern ([[speculative-mitigations-distort-ludeo-fidelity]]) — and the reference integrations don't
manipulate AI on restore. Ordering the spawns is strictly cleaner: nothing about the game's behavior
is altered, only WHEN each entity enters the world during the (already-artificial) restore window.
