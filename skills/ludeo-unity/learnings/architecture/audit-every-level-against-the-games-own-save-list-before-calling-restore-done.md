---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 4,5
question: "About to call the restore 'done' while later waves (puzzles, doors, chests, platforms, pickups) are still deferred? Enumerate every implementor of the game's own save interface, map which levels contain each one (resolving nested prefabs), and diff that against what you capture — otherwise QA will find the gaps one level-specific mechanic at a time."
sanitized: true
---

# Audit every level against the game's own save list before calling the restore done

## What happened

The first restore wave (player, enemies, companions, pickups, run counters) passed its gate, and the
integration moved on with the rest of the census parked in "later" waves. QA then found the gaps **one at
a time, each in a different level**: a floor button whose door came back shut, a picked-up key that was
back on the ground with an empty HUD slot, a one-shot power-up that fired the normal attack. Each was a
full report → diagnose → fix → build → re-record round trip. All three were objects the census had
already listed — as deferred. **A deferred wave is a silent gap**, and nothing in the moment tells the
viewer or the tester which wave a mechanic belongs to.

## The check — run it before declaring a restore complete

**1. Take the game team's own list of what is stateful.** If the game has a save system with a
per-object save interface (a `CaptureState()` / `RestoreState(object)` pair or similar), list every class
that implements it. That list is the studio's own answer to "what must survive a reload" — it beats any
census you derive by reading fields. Diff it against what you capture.

**2. Map it level by level, resolving nested prefabs.** Grepping a scene for a script's GUID misses every
instance that lives inside a prefab (the scene only stores the prefab reference). Counting per-instance
overrides in the scene YAML has the opposite bug: a prefab with nested children gets credited once per
child — one real integration over-counted enemies ~6× this way. The reliable count is:

```
count(script, scene) = direct components in the scene file
                     + Σ over prefab instances in the scene: count(script, that prefab), recursively
```

Build the prefab→(scripts, child prefabs) map once from every `.prefab` file, then walk each scene.
**Validate it against one number measured at runtime** (e.g. the enemy count your capture census logs)
before trusting the rest of the table. In the source integration it matched runtime exactly in 12 of 13
levels; the 13th was explained by enemies spawned later in waves.

**3. List every script present in a level that your census never names.** Most will be visual, audio, UI
or ambient — dismiss them explicitly. Read the handful that are not.

**4. Rank what is left by what a viewer notices,** not by census order: rewards that can be taken twice
(opened chests closed again), progress that silently resets (half-solved puzzles, activated switches), paths
that close again (a burned obstacle that grows back), and clips that start *on* something moving
(platforms, rafts) are the first to be reported.

## The save interface is also the cheapest restore primitive

- `RestoreState(object)` is public and usually accepts the **serialized form** the save file uses (often a
  JSON object it converts itself). Hand it a synthesized payload containing only the flag you need —
  e.g. `{ "isOpen": true }` — and the game runs its **own load path**: the sound is skipped, the side
  effects are the ones the game itself chose. Zero game-source edits.
- `CaptureState()` gives read access to **private** flags without reflection or accessors. It allocates, so
  query an object only until its (latched) state is recorded, then stop.
- Read what the game's own restore *also* touches. A held-key flag was being restored correctly, but the
  HUD slot that shows it is drawn only by the pickup path — the viewer saw no key. The picked-up key object
  was also still in the world. Mirror every visible effect of the save's load, not just the flag.

## Not sufficient on its own

The save list misses state the game never persisted. The one-shot power-up above was a single public
bool on a player-owned component, armed by a respawning pickup — **not** in the save system, because the
game never saves mid-power-up. After the save-list diff, also sweep public mutable fields on
**player-owned** components that a pickup or trigger writes.

## Adding coverage without breaking recorded moments

Where the meaning fits, put a new object kind into an **existing** id ledger (a pressed floor button is "a
door that is open"; a picked-up key is "a collected pickup") instead of adding an attribute — the recording
format does not change and every previously captured moment still loads. When a new attribute is
unavoidable, read it as **optional** (absent = leave the authored default) so old moments degrade instead
of failing. Old moments still lack the new information: say so, and ask for fresh recordings to test.

Related: [[game-own-save-key-builder-is-a-ready-made-stable-key]],
[[level-reset-registry-is-census-batch-iterator-and-reset-seam]],
[[check-what-actually-ships-before-scoping-per-entity-work]].
