---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: 5
question: "Does the replay rebuild the world through the game's normal level-build path, and does that path populate it (pre-spawned waves, default enemies, loot) on its own?"
sanitized: true
---

# The replay world comes pre-populated - reconcile, don't add

A restore that rebuilds the level through the game's own construction path inherits
everything that path does - including populating rooms with their default entities. This
game's level build pre-spawns each room's first enemy wave, **dormant and invisible**
until the room's trigger runs. The restore then spawned the captured enemies on top and
removed nothing.

What that looked like: cleared rooms "haunted" by invisible dormant enemies the game's
counters reported as alive; a room's count at 22 when the recording said 20; kill-ratio
wave logic computed against polluted totals, so encounters resolved after half the
expected kills. None of it visible on screen - only count checks caught it.

## The rule

Restore is a **reconciliation** between two populations, not an insertion:

- For state restored as in-progress (a fight the recording shows running): **clear the
  world-build population first** (return it to the pool via the game's own release path),
  then place the captured entities. Wipe the manager's bookkeeping lists too - dead and
  alive - or counts stay polluted.
- For state the recording shows untouched (a room never triggered): **keep the world's own
  population and skip its captured twins** - they are the same entities, captured dormant.
  (With seeded spawn rolls, the world's own roll reproduces the recorded composition.)
- Watch for the game's own list bugs while doing this - here, hand-placed enemies were
  double-added to the alive list, so a naive per-entry release would double-release.

Verification that catches regressions on both sides: check each manager's alive count
against the recording's, and register a check that untouched rooms stay untriggered at
every checkpoint.
