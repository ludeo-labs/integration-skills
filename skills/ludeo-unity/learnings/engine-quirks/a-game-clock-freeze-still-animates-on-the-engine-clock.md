---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game run its own clock (a GameTime with per-system scales, deltas built from unscaledDeltaTime)? Then freezing that clock stops LOGIC but not PRESENTATION - animators, particles, engine physics and tree ticks run on Unity's clock and keep playing - and freezing Unity's clock stops presentation but not logic. A convincing pre-play hold needs both, engaged in the right order."
sanitized: true
---

# A game-clock freeze still animates on the engine clock

A game with its own time system (network-synced scales, deltas derived from
`Time.unscaledDeltaTime`) splits the world across two clocks. Freezing the game clock parks
movement, waves and damage — checkpoint positions confirmed nothing moved — yet the held moment
visibly played: idle animations, attack wind-ups, particles, because those run on Unity's clock,
which such games deliberately never scale.

Zeroing `Time.timeScale` as well makes the picture still, but it is the more dangerous half:

- **Engine physics dies with it** — including `OnTriggerEnter` volumes. If room entry, encounter
  starts, or pickups are physics triggers, a Unity-clock freeze that leaks into gameplay reads as
  "nothing spawns anywhere" while every script-driven system (player movement, script-stepped
  combat casts, the game clock itself) carries on looking normal. Diagnosing that took a full
  build-test cycle because everything that still worked was script-driven.
- **Scaled-time async pipelines stall** — `UniTask.Delay`-style waits advance on scaled deltas,
  so any of the game's setup/init tasks still in flight never finish under the hold.

## The ordering that works

1. Let the level build and ALL its async setup drain on a running engine clock.
2. Freeze the game clock for the restore; run the settle on real frames.
3. Only then zero the engine clock, gated on the game's own setup-idle signal.
4. Release unconditionally the moment gameplay begins — belt-and-braces it in the begin-play
   callback and every abort path, and trace both transitions so a leak cannot hide.
