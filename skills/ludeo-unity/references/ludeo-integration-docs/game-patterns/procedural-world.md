# Procedural / Non-Deterministic-Assembly Pattern (Unity)

> **Applies to:** roguelikes / roguelites (Hades-, Dead Cells-, Slay the Spire-, Risk of Rain-,
> Enter the Gungeon-likes), procedural dungeon crawlers, wave/horde survival, daily-seed runs — any
> Unity game where a run's world is **assembled at load from data + RNG** rather than authored into a
> fixed `.unity` scene. The defining trait: **the scene is a container; the run-specific content is
> generated/selected at runtime** (ScriptableObject chunks/rooms, prefab pools, a seed).
>
> **Load when:** capturing "which scene/level" would **not** be enough to relocate the captured moment,
> because loading that scene yields an empty/default container and the generator **re-rolls** content
> (layout, encounter, waves) on load. Signals in `CODE_MAP`: a level/run *builder* or *pool*
> (`LevelSelectionPool`, `ChunkPool`, room lists), `Random`/seed use at level load, content defined as
> ScriptableObjects assembled at runtime, a per-run difficulty/depth counter.
>
> **This is a structural pattern, not a genre pattern.** Like [`open-world.md`](./open-world.md) it is
> about *world lifecycle and identity*, not an action/object catalog. It is **orthogonal**: a game can
> be procedural **and** level-based (most roguelikes) or procedural **and** streaming. Load it *in
> addition to* the genre file(s) and, when the world streams, alongside the open-world files.

> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)) · `[Layer]` = prescribed façade
> ([`../unity/REFERENCE-ARCHITECTURE.md`](../unity/REFERENCE-ARCHITECTURE.md)) · `[Unity]` = engine API.

---

## 1. The trap: scene ≠ content, and load is non-deterministic

A level-based game's scene **is** its content — reload the scene and the same world comes back. A
procedural game's scene is a **container** that gets populated at runtime from data and a random
stream. Three consequences break the naïve "capture the scene index" instinct, and all three must be
fixed on the **capture side** — *you can't restore what tracking never wrote*:

| Naïve capture | Why it fails on restore |
|---|---|
| **Scene/level index only** (`LevelSceneIndex`) | Reloading that scene loads an **empty/default container**, not the chunk/room/layout the player was in. You can't restore what you can't relocate. |
| *(even capturing the chunk/room id)* | Loading the chunk **re-rolls** its content — a fresh `RandomEncounter` / random wave set / random layout. The remaining fight won't match what the player faced. Load is **not idempotent** w.r.t. content. |
| *(scene/chunk, but nothing about progression)* | The reload **resets run-scaling counters** (combat level → 0, depth, difficulty tier). Anything that spawns *after* the restore point is mis-scaled. |

The reframe: a Ludeo captures **one assembled moment**. To rebuild it you must capture the
**generation inputs** that *identify and reproduce* that assembly — not the container it happened to
live in. This is the same forward pointer as [`07-RESTORATION-PATTERNS.md §8`](../07-RESTORATION-PATTERNS.md)
(game-definitions / world restore); §8 is the *restore mechanism*, this file adds the *recognition* and
the *determinism discipline* §8 assumes you already have.

## 2. Session boundary: one run = one Gameplay Session

The boundary rule is the roguelike instance of [`open-world.md §1`](./open-world.md): **one live run =
one `LudeoGameplaySession`**, regardless of how many chunks/rooms/floors it stitches together.

| Event | Boundary? | Why |
|---|---|---|
| Run starts (new run from the hub/menu) | ✅ Start | First live frame of the run → `OpenRoom` |
| Player death / run lost (permadeath) | ✅ End | Run is over → `End` |
| Abandon run → back to hub/menu | ✅ End | → `Abort` |
| Walk through a portal / enter next chunk/room/floor | ❌ | Same run, generator assembles the next segment |
| Re-roll / shop / reward screen between segments | ❌ | Same run, modal step |

Walking between chunks is **not** a boundary — it is the within-run analogue of streaming a new cell.
The Gameplay Session spans the whole run. (Bind `OpenRoom`, gate sampling, and pause exactly as
[`open-world.md §3–§5`](./open-world.md) prescribe.)

### 2.1 The decisive question: how many rooms are live at once?

This single fact decides whether the single-container world-restore ([`07 §8`](../07-RESTORATION-PATTERNS.md))
is enough, or whether you've crossed into open-world territory. Answer it from `CODE_MAP` (does the
builder keep **one** active chunk, or assemble/keep **many**?) and record it in `OBJECT_TRACKING.md`.

- **Single active room/chunk** — one segment is live at a time; walking a portal **replaces** it, and
  previous rooms are gone and non-navigable (the classic "corridor of rooms"; the §6 worked model). The
  captured moment is **one container**. Capture the active chunk + sub-roll + cursor (§3); restore
  rebuilds that one chunk (`07 §8` + §5). The rooms you left don't exist anymore, so there is nothing to
  reconstruct — the player's accumulated run state (upgrades, deck) rides along as normal player-entity
  attributes (`06`/`07`). **`07 §8` is sufficient.**
- **Several rooms live or navigable** — a connected floor generated up-front, back-tracking through
  cleared rooms, adjacent rooms streamed in, or line-of-sight across rooms. Now "the world" is a **set of
  chunks in a layout**, not one container, and previously-visited rooms carry **mutation deltas** (chests
  opened, enemies dead, doors unlocked) the replay must show. This is **procedural ∩ open-world**;
  `07 §8`'s singleton-definitions restore is **not** sufficient. Additionally load
  [`open-world-tracking.md`](./open-world-tracking.md) and capture, beyond §3:
  - the **layout / connectivity** — the full set of reachable chunk ids + how they connect (or a
    whole-layout seed, if §4 says seed-capture is safe), so restore reproduces the navigable graph, not
    just the current room;
  - **per-room mutation deltas** as a `ChunkDelta` collection objectType keyed by chunk id + content id
    (`open-world-tracking.md §3`), **scoped to the reachable/relevant set, not the whole run**
    (`open-world-tracking.md §5`);
  - identity that survives a room streaming out and back (`open-world-tracking.md §4`).

  **When unsure, assume multi-room and scope down** — under-capturing the layout silently breaks
  back-tracking in the replay (the player walks back through a portal into an empty/default room).

## 3. What to capture: the generation inputs, as stable keys

Add **one singleton `RunMetadata`** (a/k/a "world definition") `objectType` capturing the inputs that
reproduce the assembled moment. This is the §8 "definitions" object, specialized for procedural
assembly. Capture **stable asset names / values** — never instance IDs, scene indices, or list
positions (CR-014; a Ludeo replays in a **different process/build** where in-memory references and even
load order are meaningless). Four input kinds:

| Input kind | What it is | Examples | Capture as |
|---|---|---|---|
| **Selection identity** | *which* content was assembled | chunk/room/biome id; the run **seed** (if seed-deterministic) | stable asset name (`ChunkId`) or the seed `int`/`string` |
| **Sub-roll identity** | the nested rolls the loader **re-rolls** on load | encounter id, enemy-wave-set id, modifier/affix ids | stable asset name (`EncounterSettingsId`) |
| **Progress cursor** | *how far into* the assembled segment | wave index, room/floor depth, step count | `int` (`WaveIndex`, `Depth`) |
| **Scaling counter** | run-scaling the reload resets | combat level, difficulty tier, ascension, heat | `int`/`float` (`CombatLevel`) |

Verify chosen identifiers are **unique among the content a real run can reach** (asset names usually
are; list indices and `GetInstanceID()` are not). Capture these every tick alongside the player
(they're cheap; the SDK diff-sends — `06 §3.1`), via the creator flow's definitions store
(`LudeoCreatorFlow.StoreGameDefinitions` `[Layer]`, the §8 mechanism) or a dedicated `RunMetadata`
handler.

> These four kinds describe the **single active container** (§2.1). If several rooms are live/navigable,
> this `RunMetadata` is only the *active* room's inputs — add the **layout/connectivity** and per-room
> `ChunkDelta` objectTypes from §2.1 as well, or back-tracking restores into empty rooms.

## 4. Decide: capture the seed, or the resolved selection?

This is the [seed-vs-stored-layout](https://www.gamedeveloper.com/design/2d-procedural-generation-in-unity-with-scriptableobjects)
trade-off, restated for Ludeo. Pick per game and record it in `OBJECT_TRACKING.md`:

- **Resolved-selection** *(default for Ludeo)* — capture the **outcome** ids (chunk id, encounter id,
  wave index, combat level), i.e. the result of the rolls. Restore re-drives the generator *to those
  exact ids* and suppresses the re-roll (§5). Robust because it does **not** depend on the replaying
  build reproducing the same RNG.
- **Seed + cursor** — capture the run seed + how far in, re-seed the generator at restore, and
  fast-forward. Smallest payload, but **only valid if** generation is *fully* seeded, deterministic,
  and **version-stable across the build that replays the Ludeo**. A Ludeo plays on a different
  process/machine and possibly a later build, so a seed that silently regenerates a *different* world
  is a corrupt replay. Use only when the run is provably seed-deterministic; otherwise prefer
  resolved-selection.

> **The deciding question:** "If a different build re-runs this seed, is the output *guaranteed*
> identical?" If you can't answer yes, capture the resolved selection.

## 5. Restore delta: re-drive the generator, suppress the re-roll

Restoration is [`07 §8`](../07-RESTORATION-PATTERNS.md) (world/definitions restore) **plus** the
determinism discipline below. The captured `RunMetadata` is read back into
`LudeoTrackedDefinitions` `[Layer]` (`GetLudeoTrackedDefinitions()`); the play-flow spawn driver uses
it to assemble the world **before** the two-pass entity restore (`07 §4`). Three deltas over a
level-based restore:

1. **Re-drive the generator from captured inputs — do not let it roll.** Feed the captured selection
   id(s) into the builder so it assembles *that* chunk/room/layout, and the captured sub-roll id so the
   encounter/wave-set is *that* one, not a fresh `RandomEncounter`. The clean mechanism is the **same
   `IsInLudeoFlow` `[Layer]` gate** phase 10 uses to suppress pre-match randomness: when
   `IsInLudeoFlow`, `RandomChunk`/`GetEncounterByLevel`/wave-roll return the captured id instead of
   rolling. Reloading the scene alone is **not** restoration here — it yields the empty container.
   > **Where you inject depends on *when* the generator rolls.** If it rolls **lazily per room-entry**
   > (Cello's `RandomChunk`-at-portal), override each entry to the captured id. If it generates the
   > **whole floor up-front** (one call assembles every room), you must inject the *entire* resolved set
   > at that call — the layout/`ChunkDelta` capture from §2.1 — or capture the seed and re-seed *before*
   > the call (only if §4 says seed-capture is safe). A per-entry override can't reconstruct a
   > floor that was already fully built in one shot.
2. **Restore the scaling counter before any post-restore spawns.** Set combat level / depth / tier from
   `RunMetadata` *before* the world spawns anything, or waves after the restore point mis-scale (the
   §1 third failure).
3. **Order: assemble-from-inputs → entities → environment.** Generation inputs are *definitions* —
   restore them **before** entities (`07 §8`: you need them to know *what* to spawn). The progress
   cursor (wave index) positions the encounter; remaining entities then come back via the normal
   two-pass (`07 §4`). World/environment flags last (`07 §8` ordering).
4. **Position the cursor — don't let entering the encounter *re-spawn* the restored wave.** "Remaining
   waves match" means the spawner may **advance** to the *next* wave from the restored cursor. But the
   trigger that fires when combat/the encounter (re)starts often **repopulates the current wave wholesale**,
   stacking a fresh wave on the live enemies you just restored via two-pass. Gate that re-populate
   **trigger** on `IsInLudeoFlow` — not the spawn primitive restore uses (`07 §9`). Restore the live wave as
   a snapshot; let only genuine *advancement* run.

Everything else is standard `07`: freeze during restore (CR-010), apply before `Begin`, resume via
`RoomReady → Begin`.

## 6. Worked mapping — chunk-assembled roguelike (single active room, §2.1)

A run is a randomly-stitched sequence of `LevelChunkBase` ScriptableObjects selected by a
`LevelSelectionPool` into one reused "Biome" scene; **one chunk is live at a time** and a portal loads
the next (the previous is gone), each chunk re-rolls its encounter on load, and the reload resets the
run's combat level. This is the **single-active-room** regime — the captured moment is one container.
(If instead several rooms stayed navigable, you'd add the layout + `ChunkDelta` captures from §2.1.)

| Capture (phase 8/9) | Source `[Unity]`/game | Restore (phase 10/11) |
|---|---|---|
| `ChunkId` (selection identity) | active `LevelChunkBase` asset name | re-drive `LevelSelectionPool` to load *that* chunk under `IsInLudeoFlow`, not `RandomChunk` |
| `EncounterSettingsId` (sub-roll) | resolved `EncounterSettings` asset name | force `GetEncounterByLevel`/`RandomEncounter` to return *that* encounter under `IsInLudeoFlow` |
| `WaveIndex` (progress cursor) | current wave in the encounter | position the encounter at that wave so remaining waves match |
| `CombatLevel` (scaling counter) | run combat-level field | set before any post-restore wave spawns (reload resets it to 0) |

`RunMetadata` is a singleton (`bucket[0]`, no key). Entities currently alive in the chunk (enemies,
projectiles, pickups) are captured/restored normally per `06`/`07`; `RunMetadata` is what makes the
*container* they live in reconstructable.

## 7. After this file

Capture the generation inputs as a `RunMetadata` objectType in
[`phase 8`](../../8-map-game-objects.md)/[`phase 9`](../../9-implement-object-tracking.md) (data model:
[`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md)); plan + implement the re-drive-the-generator
restore in [`phase 10`](../../10-plan-state-restoration.md)/[`phase 12`](../../12-implement-state-reconstruction.md)
on top of [`07 §8`](../07-RESTORATION-PATTERNS.md). You still need the **action catalog** and **tracking
checklist** for whichever genre(s) the run blends (combat → `shooter.md`/`rpg.md`), via
[`INDEX.md`](./INDEX.md). If the world also streams, load the [`open-world*.md`](./open-world.md) pair too.

---

## Calls used in this doc

**`[SDK]`** (authority: [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)):
`LudeoStateObject.SetAttribute` / `LudeoStateObjectRestore.TryGetAttribute` (via the `[Layer]` handler)
— no procedural-only SDK surface; this is a usage pattern over the `06`/`07`/§8 model.

**`[Layer]`** (from [`../unity/REFERENCE-ARCHITECTURE.md`](../unity/REFERENCE-ARCHITECTURE.md)):
`LudeoController.{IsInLudeoFlow, GetLudeoTrackedDefinitions}` · `LudeoCreatorFlow.StoreGameDefinitions` ·
`LudeoTrackedDefinitions`.

**`[Unity]`:** game-specific level builder / chunk pool / RNG / run-difficulty counter (e.g.
`LevelSelectionPool`, `RandomChunk`, `GetEncounterByLevel`).
