---
category: architecture
tier: universal
sourceGame: multiple
phase: 4
question: null
sanitized: true
---

# Two kinds of Player-Flow suppression — state-clobbering (gate it) vs flow-blocking (undo it)

## The distinction

Player Flow suppresses game behavior that would interfere with a restored replay. But "suppress"
means two different things, and conflating them is a recurring bug. For **everything** you plan to
suppress in Player Flow, first classify it:

- **State-clobbering** — code that **writes / overwrites** state that restore will apply: the
  game's default level-start spawns, applying default loadouts, fresh-load `BeginPlay` init, a live
  spawn trigger, per-tick state writes. Restore lays down captured state; if this runs it stamps
  default values on top. **Fix: gate the write on `bIsPlayerFlow`.** Not running it is exactly right —
  there is no side effect to clean up. Only state-*writing* should be gated (`audit-all-isplayerflow-guards`).

- **Flow-blocking** — code that **holds the replay from proceeding**: a non-ludeoable overlay that
  pauses the game, an intro / loading gate that locks input, a "press to start" menu that awaits a
  click, a warmup phase that won't hand over control. **Fix: drive its dismiss / undo explicitly.**
  You cannot merely gate it "off" — its side effect (the pause, the input lock, the widget) is
  already latched, and the code path that would normally clear it is the same path you skipped. Gating
  it off leaves the game **stuck**.

## The mistake

Treating all suppression as "gate it off with a `bIsPlayerFlow` check." That is correct for
clobbering, and **wrong for blocking**: skipping the block-*setup* while the block is (or will be)
active leaves a pause that never unpauses, an input lock that never releases, or an overlay that
never dismisses. The replay hangs, and it looks like a restore failure.

```cpp
// State-clobbering — gating off is complete
void ADefaultSpawner::OnLevelStart() { if (bIsPlayerFlow) return; SpawnDefaults(); }

// Flow-blocking — gating off is NOT enough; you must undo the effect
// WRONG: skip the overlay's setup → its pause is still applied elsewhere → game frozen
// RIGHT: let it run, then replicate its dismiss so the pause/input-lock is actually cleared
NonLudeoableOverlay->ForceDismissForPlayerFlow();   // undoes the pause + input lock it applied
```

## The decision, per suppressed item

Ask: **does this CLOBBER restored state, or BLOCK the flow?**
- Clobber → gate the write on `bIsPlayerFlow`.
- Block → let the effect resolve and drive its dismiss / undo (replicate the normal teardown), or
  never let it engage in the first place *and* clear anything it already latched.

An item can be both (a warmup phase writes default state *and* holds control) — handle both halves.

## Related learnings

- `audit-all-isplayerflow-guards.md` — only state-*writing* gets gated; the clobbering side of this split.
- `no-writable-objects-in-player-flow.md`, `destroy-default-spawns-before-restoring-tracked.md`,
  `gate-spawn-trigger-not-primitive-in-player-flow.md` — clobbering cases.
- `suppress-nonludeoable-overlay-in-player-flow-by-replicating-its-dismiss.md` — the canonical
  flow-blocking case: dismissing the overlay's pause "is not only cosmetic — it can be required for
  the replay to proceed."
- `scene-compose-during-restore-is-local-overlay-artifact.md` — the inverse caution: don't over-suppress
  presentation for a non-bug.
