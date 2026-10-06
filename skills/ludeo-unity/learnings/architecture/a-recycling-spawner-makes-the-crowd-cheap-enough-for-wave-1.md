---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: 4
question: "Before deferring a game's main enemy/NPC population to a later wave as 'backdrop', check whether waves actually INSTANTIATE anything. If the whole cast is created once at level build and waves only enable/teleport existing instances, restoring the population is a match-and-write against objects the world rebuild already produced — cheap enough to belong in wave 1. The same check applies when a deferred type (a boss, a faction) is re-opened later: it is often already an instance of a bucket you built, plus a handful of flags."
sanitized: true
---

# If the crowd is recycled rather than spawned, restoring it is nearly free

The census's wave assignment usually treats a large enemy population as expensive: a collection type
needs a stable key, a spawn-from-bucket restore path, and per-instance capture. In a game whose curated
moment is about the *player* — "a built-up character mid-run" — the natural call is to defer the crowd to
a later wave as backdrop.

That call rests on an assumption worth testing: **that waves create enemies.**

## The pattern where they don't

In the game observed, a horde-survival roguelite:

1. The level builder generates the world from a seed.
2. A data-driven prefab spawner then instantiates **every actor the run will ever use**, into
   generated spawn points, before gameplay starts. It never destroys them.
3. A wave "spawn" is `dequeue from a per-prefab queue → enable the GameObject → teleport it into
   position`. On death the actor is disabled, pushed onto a dead queue, and a per-frame loop revives it
   and returns it to the ready queue.

So the population is a fixed cast plus two queues. Nothing is instantiated after load.

## Why that changes the wave decision

Restoring the world from its generation inputs already recreates the entire cast, at the right prefab
variants, in the right places, with the right components. What is left to restore is only *which* of them
are on the field, where, and in what condition — a **match-and-write** against objects that exist, not a
spawn-from-bucket. The two hardest parts of restoring a collection (creating the right instances, and
re-linking references to them) are already done by the world rebuild.

That flips the cost/benefit. In a horde game a clip that opens on an empty field reads as broken, so the
population is load-bearing by the census's own definition; and here it is cheap. Both point the same way:
**wave 1**. What genuinely belongs in a later wave is *per-enemy fidelity* — AI target, animation phase,
mid-attack state — not the presence of the crowd. Saying it that way preserves the "enemies are backdrop"
intent from the clip concept without shipping a first slice that looks empty.

## Two pieces of state the actor lists do not carry

If you pull the population into wave 1, capture these as well or the fight will not play forward:

- **The queues themselves.** "Which enemies are available versus cooling down after death" is not
  derivable from the live-actor lists. It is the recycler's own state.
- **The wave cursor and its countdowns.** Waves fire by comparing an authored start time against the run
  clock. Restore the clock without restoring the cursor and the spawner tries to catch up on every wave
  it thinks it missed, dumping the whole run's enemies onto the field at once. This is the
  manager-level singleton a viewer-centric sweep never finds — the same blind spot as the time-base
  singleton, and it belongs in the same wave as the crowd.

## How to tell in ten minutes

Find the wave spawner's "spawn an enemy" method and look for `Instantiate` / a pool `Get` / an
Addressables load. If instead you find an enable call and a teleport, you are in this pattern. Corroborate
by finding where the population *is* created and checking it runs at level build, and by looking for a
dead/ready queue pair on the fight manager.

## The same check, months later: re-opening a deferred type

The census assigns each type to a wave and records why. Later the integrator reverses one of those
calls — "actually, boss fights *are* in the clips people will play" — and the natural reaction is to
price it from the census row, which was written before any capture existed. That row is usually stale in
one direction: **too expensive.** The buckets built for wave 1 are generic, and a deferred "special"
entity is frequently an *instance* of one of them.

On the integration above, a boss creature and a boss encounter had been deferred as two untracked types.
Walked against the shipped capture:

| Named as missing | Where it actually was |
|---|---|
| the boss fight — waves, cursors, spawn seed, started/finished | an ordinary entry in the fight-state bucket, resolved through the fight manager's public getter like any other fight |
| the boss creature | the boss fight is registered as a **pooled** fight, so its actor comes out of the same pre-instantiated cast the enemy bucket already indexes by spawn-point id |
| the ordinary enemies the boss start sweeps off the field | the same enemy bucket, as slots recorded inactive |
| the main fight being paused by the boss start | its own fight entry's active/started flags |
| the run clock being maxed, and the arena lock | already in the run-clock bucket |

What was genuinely missing was **nine boolean-ish world flags** — an arena barrier, a pathfinder
toggle, a teleporter, a couple of modifier latches. A day's work, not a wave's.

The check:

1. **Find where the entity is instantiated.** `Instantiate` at the moment it appears → new work. A pool
   `Get`, an enable-and-teleport, or a lookup against something the level build produced → your
   existing bucket probably already holds it; confirm by finding its key.
2. **Find which manager owns its state**, and check whether that manager is already a bucket.
3. **List only what is left**, and expect flags rather than entities.
4. **Confirm it with a runtime count — and make sure the count measures the right thing.** On this
   integration the first count said the conclusion was wrong: *zero of 723* indexed actors carried the
   "this is a boss" flag. That count was itself the error — the flag is authored per prefab, has no
   runtime writer, and was never set on the boss. Re-counted by matching the encounter's own boss prefab
   name against the cast, the boss was there: one slot, disabled in the recycler, exactly as the source
   reading said ([[find-a-flags-writers-before-trusting-it-as-a-discriminator]]). Print the count on every
   run, and print what it keyed on, so a wrong discriminator is visible in the artifact.

Related: [[culling-can-look-like-despawn-in-a-world-that-never-streams]] — the same architecture makes
"gone" ambiguous, and the unregister hook has to be chosen accordingly.
