# Open-World / Streaming-World Tracking (Unreal)

> **Applies to:** the same games as [`open-world.md`](references/game-patterns/open-world.md) — streaming
> worlds with no per-level scenes (open-world RPGs, sandbox/survival, MMOs). That file decides *when*
> a Gameplay Session begins and ends; **this file decides *what* a streaming world captures and how
> identity survives streaming.**
>
> **Load when:** you are mapping or implementing object tracking (the enrichment phase — see
> `references/phase-07-expansion.md`)
> for a game where the world **streams in and out** — World Partition cells, `ULevelStreaming`
> sub-levels, or procedural chunks — instead of loading discrete maps.
>
> **Prerequisites:** `references/phase-04-tracking-restore.md` (the curated-slice tracking model —
> WritableObject registration, the `bGameplayActive` sampler gate, the DataReader restore path). This
> file is the open-world *delta* on top of that baseline, not a replacement.

---

## 1. The core problem: the world is never fully loaded

In a level-based game, "the world" is the loaded map — everything trackable is present at once. A
streaming world is different: at any instant only the **neighborhood around the player** is resident;
the rest is on disk, in a save record, or not yet generated. So "track all world objects" is both
impossible (most are not loaded) and wrong (you would attempt to capture a 100-hour save).

The reframe that makes this tractable: **Ludeo captures a *moment*, replayed from the player's
perspective.** A replay reconstructs the **live neighborhood as it was at capture**, not the entire
world. That single fact bounds the tracked set to *what is streamed in and gameplay-relevant right
now* — which is exactly the set the per-type entity discovery in the enrichment phase already sees.
You do **not** need to reach into unloaded cells.

## 2. The cardinal rule: presence ≠ existence

The most common open-world tracking bug is treating **stream-out as despawn**. They are not the same,
and conflating them corrupts the replay:

| Event | What it means | Action |
|---|---|---|
| Actor **streamed out** / culled / World Partition cell unloaded / `ULevelStreaming` sublevel unloaded | Still exists in the world; just not resident near the player | **Keep the tracking record if the actor can re-enter the captured neighborhood; otherwise stop sampling it — do not treat as destroyed.** Never key off this event as "dead." |
| Actor **destroyed in gameplay** (killed, consumed, mined, looted, removed by game logic) | Gone from the world | Call `RoomWriter.DestroyObject()` on its WritableObject (per `references/phase-04-tracking-restore.md` §7.3), *or* keep the record and capture an `IsDestroyed`/`IsConsumed` **state flag** while the actor was still loaded. |

> **`EndPlay` / `Destroyed` fires for both.** When a World Partition cell unloads or a `ULevelStreaming`
> sublevel is removed, Unreal calls `EndPlay` and then `OnDestroyed` on every `AActor` in it — exactly
> as if the actor were destroyed. Your tracking cleanup (registered via `OnDestroyed`, per
> `references/phase-04-tracking-restore.md` §7.3) will run. That is the trap: a streamed-out NPC is
> **not** dead, but its `OnDestroyed` fired. **Distinguish the two at the despawn hook** — gate the
> DestroyObject call on a real "removed from world" signal (death event, consume delegate, an explicit
> `WorldRemoved` vs `Unloaded` flag the streaming or persistence layer exposes), not on `OnDestroyed`
> alone. Mishandling this makes the replay drop objects that should still be there.

**Practical consequence:** in a streaming world, prefer to drive register/unregister from the game's
**world or persistence layer** (the system that knows "this NPC died" vs "this World Partition cell
unloaded"), not solely from `OnDestroyed`. The persistence or save layer already makes this
distinction — it is the natural authority.

## 3. What to track in a streaming world

Apply the entity discovery checklist from `references/phase-07-expansion.md` §3.4 to the
**currently-loaded, gameplay-relevant** set, plus these open-world-specific objectTypes that
level-based games rarely need:

| Trackable | Why it matters in a streaming world | objectType shape |
|---|---|---|
| **Live entities near the player** | The neighborhood the replay reconstructs (NPCs, creatures, vehicles, dropped items) | per-entity, collection bucket keyed by stable persistent world id (§4 below) |
| **World / global state** | Time-of-day, weather, global event flags, faction simulation state — visible and affects the moment | one `WorldState` singleton objectType |
| **Per-cell / per-chunk mutations** | Opened chests, killed-and-not-respawned NPCs, placed or removed blocks, built structures — the *deltas* from the base world | one objectType per mutation kind, keyed by cell/chunk id + content id (§4) — **scope to deltas the moment needs, not the whole save (§5)** |
| **Player run / world metadata** | World seed (if gameplay-deterministic), current region/cell id, game-time | part of the player's writable object or a `RunMetadata` objectType on GameMetadata |

Decorative streamed scenery (terrain meshes, foliage, props with no gameplay state) is **skip** —
same as the "static or cosmetic" exclusion in `references/phase-07-expansion.md` §5.1.
Track the *state* the world shows, not the streamed geometry.

## 4. Identity across stream cycles

In a streaming world the **same logical actor is destroyed and recreated repeatedly** as it streams
out and back in.

- The `AActor` pointer, any engine-generated runtime GUID, and any object reference captured during
  one stream cycle are **doubly useless** here — they change every stream cycle, not just every run.
  Never capture them as identity keys.
- Use the game's **persistent world id**: a cell/region id plus a content/instance id the streaming
  and save system already uses to re-place the actor on reload. Most streaming engines have one — it
  is how the save system re-spawns the right NPC at the right location after the cell reloads. Find it
  via the save-system read documented in `references/phase-07-expansion.md` §3.5
  (property discovery → persistence / save layer).
- **Relationships** (an NPC's home cell, a follower's owner) capture the target's persistent world id,
  resolved in a two-pass restore at play-back time (`references/phase-04-tracking-restore.md`).

> **Separate rule — `ObjectTypeName` parameter:** `references/phase-03-map-objects.md` §5.1 states
> that the `ObjectTypeName` passed to `RoomWriter.CreateObject` must be a class path or left empty
> (defaults to the anchor object's class) — never a custom per-instance label. That rule is about the
> SDK registration parameter (a shared category), not about persistent world identity keys. Both
> rules apply in open-world tracking, but they are independent.

## 5. Scope to the moment, not the save

A streaming world's save file can be enormous. **Do not mirror the save into Ludeo.** The replay only
needs what reconstructs *this captured moment from the player's view*:

- **In-scope:** the loaded neighborhood + world/global state + the cell mutations the player can
  observe or that affect nearby gameplay.
- **Out-of-scope:** mutations in cells the player is not in and cannot affect during the captured
  moment; full quest logs; the entire map's discovery state; inventory of NPCs three regions away.

When unsure whether a far-away mutation matters, apply the relevance test from
`references/phase-07-expansion.md` §5.1: is it *visible* during this moment, or does it
*influence a tracked actor right now*? If neither, it is out of scope for the capture even though the
save records it. Record the in/out cut in the Tracked Data plan produced during the enrichment phase.

## 6. Sampling and the stream

The per-frame write loop from `references/phase-04-tracking-restore.md` §5.2 — gated on
`bGameplayActive && !bIsPlayerFlow` — is unchanged. Two open-world notes:

- **Only resident actors sample.** A streamed-out actor's WritableObject (if you kept it, §2) has
  nothing live to read — either it was unregistered at world-removal, or you skip its write while
  non-resident. Do not fabricate values for unloaded actors; their last captured value stands.
- **Batch registration at gameplay start registers only what is loaded then.** As the world streams
  more content in, those newcomers register at *their* stream-in hook — treat stream-in like a spawn
  (`BeginPlay` callback or `OnActorSpawned` delegate, depending on how the game's streaming layer
  surfaces newly loaded actors), guarded on `!bIsPlayerFlow`. There is no "register the whole world"
  step.

## 7. Restoration interaction (forward pointer)

On play flow, the world is rebuilt from the Ludeo, then streamed around the restored player. The
restore (`references/phase-08-polish.md`) recreates the captured neighborhood and world/cell
state from the saved buckets; the game's **load-save plumbing** is the natural vehicle — a Ludeo is
effectively "a save from elsewhere" (see `references/game-patterns/open-world.md` §6). Actors that
stream in *after* restore are normal live spawns in the play flow and are **not** tracked (the
`bIsPlayerFlow` Creator-only guard from `references/phase-04-tracking-restore.md` §5.2 handles this).
Capture the persistent world ids from §4 precisely so restore can re-place actors into the correct
cells.

## 8. Worked mapping — illustrative UE streaming world

*Illustrative mapping for a UE World Partition streaming world — not from a shipped integration.
Class names are representative; map them to the game's actual signals during the enrichment phase.*

| Trackable | Game source (illustrative) | objectType / key |
|---|---|---|
| Player | `ACharacter` (stats, `FTransform`, current region/cell id — game-specific: from the game's own region subsystem or derived from a World Partition runtime query, not a simple subsystem getter) | `Player` singleton + region/cell id as attributes |
| Loaded NPCs / enemies | `AAIController`-possessed pawns in resident World Partition cells | `Npc` collection, key = save-layer persistent id (not `AActor*`) |
| Loot / dropped items | Pickup `AActor` subclasses (opened?, contents) | `Loot` collection, key = container persistent id |
| World / global state | Custom world-time subsystem, weather manager `UActorComponent` | `WorldState` singleton (`FVector` sun direction, weather enum, game-time `float`) |
| Cell mutations | Discovered/looted/killed-and-not-respawned flags in the save record for resident cells | `CellDelta` collection, key = cell id + content id |

The World Partition runtime unloading resident cell actors is the §2 trap: gate `Npc`/`Loot`
unregister on death/removal events from the game's world or persistence layer, **not** on the
`OnDestroyed` delegate that streaming triggers.

## 9. After this file

Back to `references/phase-07-expansion.md` §3.4 (entity discovery) to finalize the
per-type tracked set, and to the genre file(s) the game blends for the action catalog and genre
checklist (via `references/game-patterns/`). This file only added the **streaming delta**: presence ≠
existence, world/cell objectTypes, persistent-world-id identity, and scope-to-the-moment.

---

## Mechanisms referenced in this doc

**DataWriter / WritableObject lifecycle** (authority: `references/phase-04-tracking-restore.md`):
`RoomWriter.CreateObject` / `RoomWriter.DestroyObject` / `WriteData` inside
`FScopedLudeoDataReadWriteEnterObjectGuard` — no open-world-only SDK surface; this is a usage
pattern over the baseline tracking model.

**Enrichment entity + property discovery** (`references/phase-07-expansion.md`):
§3.4 Entity Discovery · §3.5 Per-Entity State Mapping · §5.1 Entity Inventory Table (lifecycle
classification: *Streamed* = loaded/unloaded via `ULevelStreaming` or World Partition).

**Enrichment implementation** (`references/phase-07-expansion.md`):
§5.1 New Entity Writable Object Registration · §5.2 Scoped Guard for Multi-Entity Writes —
the bot registration pattern there applies equally to streamed-world NPC collections.

**Unreal Engine streaming:** World Partition cells / `ULevelStreaming` sub-levels are the streaming
primitives. Actor lifecycle during streaming: `BeginPlay` on stream-in, `EndPlay` + `OnDestroyed`
on stream-out — treat stream-out as a non-destruction event (§2 above).
