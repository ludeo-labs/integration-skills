---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 4
question: "Are the curated slice's entities LEVEL-PLACED rather than runtime-spawned? Verify with inspect-level (placed-actor histogram) plus the spawner-suspect's BeginPlay call graph. If yes, Player Flow restore = match by stable actor FName + drive the game's own removal for dead units — no spawn reconstruction at all."
sanitized: true
---

# Level-placed entities make Player Flow matching trivial — verify placement before designing spawn reconstruction

## Precondition

The curated slice's gameplay entities exist in the .umap (level-placed), not spawned
at runtime. Verify with TWO checks before relying on it:

1. `RunBPInspector.bat inspect-level <slice map>` — the placed-actor histogram shows
   the entity instances (and their visual puppets) in the level package.
2. The call graph of the suspected runtime spawner's BeginPlay (`graph-function`).
   In TacticsGame the "games manager" the mode spawns at battle start turned out to
   only REGISTER already-placed units (`GetAllActorsOfClass -> AddShip`) — it spawns
   nothing. That single graph query eliminated the whole spawn-reconstruction
   problem space.

## Why it matters

A fresh map load deterministically reproduces the capture-time entity set, with
**stable actor FNames** (level-placed actor names live in the level package). So:

- **Identity** = actor `GetFName().ToString()` captured as an attribute; restore-side
  lookup is a TMap by name. Fallback for safety: match by (visual/archetype class
  path + faction) among unconsumed units.
- **Dead/absent at capture** = drive the game's own removal function on the placed
  counterpart (find it with `inspect-func-sigs`; prefer a clean `RemoveUnitFromGame`-
  style function over the animated death event). Never leave extra units standing —
  and never Destroy() raw, which skips initiative/grid-occupancy bookkeeping.
- **No SpawnActor, no ClassPath round-trip, no destroy-default-spawns sweep** —
  whole classes of restore bugs (duplicates, spawn-position drift, init-cascade
  misses) are out of scope by construction.

## Watch out

- Editor-world inspection shows PLACED actors only; runtime spawns are invisible to
  it — that's why the spawner call-graph check is mandatory, not optional.
- Keep an OnActorSpawned handler anyway (summon abilities, reinforcements): register
  new entities mid-battle in Creator flow, track-only in Player Flow.
- If the game ever adds a runtime-spawned mode for the slice, the matching layer
  needs the class-path fallback to carry the weight — keep it in from day one.
