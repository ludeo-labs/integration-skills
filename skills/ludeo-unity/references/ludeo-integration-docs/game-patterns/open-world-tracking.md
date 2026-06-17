# Open-World / Streaming-World Tracking (Unity)

> **Applies to:** the same games as [`open-world.md`](./open-world.md) — streaming worlds with no
> per-level scenes (open-world RPGs, sandbox/survival, MMOs). That file decides *when* a Gameplay
> Session begins/ends; **this file decides *what* a streaming world captures and how identity survives
> streaming.**
>
> **Load when:** you're mapping/implementing object tracking (phases 8–9) for a game where the world
> **streams in and out** (terrain, cells, chunks, Addressables) instead of loading discrete levels.
>
> **Prerequisites:** [`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md) (the engine-wide data
> model — handler model, bucket identity, the decision guide). This file is the open-world *delta* on
> top of `06`, not a replacement.

> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)) · `[Layer]` = prescribed façade
> ([`../unity/REFERENCE-ARCHITECTURE.md`](../unity/REFERENCE-ARCHITECTURE.md)) · `[Unity]` = engine API.

---

## 1. The core problem: the world is never fully loaded

In a level-based game, "the world" is the loaded scene — everything trackable is present at once. A
streaming world is different: at any instant only the **neighborhood around the player** is resident;
the rest is on disk, in a save record, or not yet generated. So "track all world objects" is both
impossible (most aren't loaded) and wrong (you'd try to capture a 100-hour save).

The reframe that makes this tractable: **Ludeo captures a *moment*, replayed from the player's
perspective.** A replay reconstructs the **live neighborhood as it was at capture**, not the entire
world. That single fact bounds the tracked set to *what is streamed in and gameplay-relevant right
now* — which is exactly the set the §6/§2 hooks of `06` already see. You do **not** need to reach into
unloaded cells.

## 2. The cardinal rule: presence ≠ existence

The most common open-world tracking bug is treating **stream-out as despawn**. They are not the same,
and conflating them corrupts the replay:

| Event | What it means | `06` action |
|---|---|---|
| Object **streamed out** / culled / LOD-dropped / cell unloaded | Still exists in the world; just not resident near the player | **Keep the handler if it can re-enter the captured neighborhood; otherwise stop sampling it, do not treat as destroyed.** Never key off this as "dead." |
| Object **destroyed in gameplay** (killed, consumed, mined, looted) | Gone from the world | `StopTrackingLudeoState` `[Layer]`, *or* keep a handler and capture a `IsDestroyed`/`IsConsumed` **state flag** (see `06 §9.4`) |

> **`OnDestroy` `[Unity]` fires for both.** When a cell unloads, Unity destroys the GameObjects in
> it — that calls your `OnDestroy`, which (per `06 §3.3`) calls `StopTrackingLudeoState`. That is the
> trap: a streamed-out NPC is **not** dead, but its `OnDestroy` ran. **Distinguish the two at the
> despawn hook** — gate the `StopTracking` on a real "removed from world" signal (death/consume/destroy
> event, or a `WorldRemoved` vs `Unloaded` flag the streamer exposes), not on `OnDestroy` alone.
> Mishandling this makes the replay drop objects that should still be there.

**Practical consequence:** in a streaming world, prefer to drive register/unregister from the game's
**world/persistence layer** (the system that knows "this NPC died" vs "this cell unloaded"), not from
MonoBehaviour `OnDestroy`. See §4.

## 3. What to track in a streaming world

Apply `06 §9` (the decision guide) to the **currently-loaded, gameplay-relevant** set, plus these
open-world-specific objectTypes that level-based games rarely need:

| Trackable | Why it matters in a streaming world | objectType shape |
|---|---|---|
| **Live entities near the player** | The neighborhood the replay reconstructs (NPCs, creatures, vehicles, dropped items) | per-entity, collection bucket + your stable key (`06 §4`) |
| **World/global state** | Time-of-day, weather, global event flags, faction/world simulation state — visible and affects the moment | one `WorldState` singleton objectType |
| **Per-cell / per-chunk mutations** | Opened chests, killed-and-not-respawned NPCs, placed/removed blocks, structures — the *deltas* from the base world | one objectType per mutation kind, keyed by cell/chunk id + content id (§4) — **scope to deltas the moment needs, not the whole save (§5)** |
| **Player run/world metadata** | World seed (if gameplay-deterministic), current region/cell id, game-time | part of the player or a `RunMetadata` objectType |

Decorative streamed scenery (terrain meshes, foliage, props with no gameplay state) is **skip** — same
as `06 §9.4`. Track the *state* the world shows, not the streamed geometry.

## 4. Identity across stream cycles

This is `06 §4` (no ID map; bucket + your own stable key, CR-014) with a sharper edge: in a streaming
world the **same logical object is destroyed and recreated repeatedly** as it streams out and back in.

- `GetInstanceID()` `[Unity]` and references are **doubly useless** here — they change every stream
  cycle, not just every run. Never capture them.
- Use the game's **persistent world id**: a cell/region id + a content/instance id the streamer
  already uses to re-place the object on reload. Most streaming engines have one (it's how the save
  system re-spawns the right NPC in the right spot) — find it via the save-system read (`06 §2.5`).
- **Relationships** (an NPC's home cell, a follower's owner) capture the target's persistent world id,
  resolved two-pass at restore (`06 §4`, CR-006).

## 5. Scope to the moment, not the save

A streaming world's save file can be enormous. **Do not mirror the save into Ludeo.** The replay only
needs what reconstructs *this captured moment from the player's view*:

- **In-scope:** the loaded neighborhood + world/global state + the cell mutations the player can
  observe or that affect nearby gameplay.
- **Out-of-scope:** mutations in cells the player isn't in and can't affect during the captured moment;
  full quest logs, the entire map's discovery state, inventory of NPCs three regions away.

When unsure whether a far-away mutation matters, apply `06 §9.2`: is it visible during *this* moment,
or does it influence a tracked object *now*? If neither, it's out of scope for the capture even though
the save records it. Record the in/out cut in `OBJECT_TRACKING.md`.

## 6. Sampling and the stream

The `06 §3.2` sampler (`UpdateStateObjects()` `[Layer]`, gated on `m_gameplayActive && !IsInLudeoFlow`)
is unchanged. Two open-world notes:

- **Only resident objects sample.** A streamed-out object's handler (if you kept it, §2) has nothing
  live to read — either it was unregistered at world-removal, or you skip its lambda while non-resident.
  Don't fabricate values for unloaded objects; their last captured value stands.
- **Batch registration at gameplay start (`06 §6`) registers only what's loaded then.** As the world
  streams more in, those newcomers register at *their* stream-in hook (treat stream-in like a spawn —
  `06 §2.2`/§5), still guarded on `!IsInLudeoFlow`. There is no "register the whole world" step.

## 7. Restoration interaction (forward pointer)

On play flow, the world is rebuilt from the Ludeo, then streamed around the restored player. The
restore (`07`, phase 12) recreates the captured neighborhood and world/cell state from buckets; the
game's **load-save plumbing** is the natural vehicle (a Ludeo is "a save from elsewhere" —
[`open-world.md §6`](./open-world.md)). Objects that stream in *after* restore are normal live spawns
in the play flow → **not** tracked (capture is creator-only, `06 §3` rule box). Capture the
persistent world ids in §4 precisely so restore can re-place objects into the right cells.

## 8. Worked mapping — Daggerfall Unity

| Trackable | Game source `[Unity]`/game | objectType / key |
|---|---|---|
| Player | `PlayerEntity` (stats, position, current region/cell) | `Player` singleton + region/cell id as attributes |
| Loaded NPCs / enemies | `DaggerfallEntityBehaviour` instances in the resident cells | `Npc` collection, key = save-link id (not `GetInstanceID`) |
| Loot / dropped items | `DaggerfallLootContainer` (opened?, contents) | `Loot` collection, key = container persistent id |
| World/global state | `DaggerfallUnity.Instance.WorldTime` (game-time), weather manager | `WorldState` singleton (time, weather, season) |
| Cell mutations | discovered/looted/killed flags in the save record for resident cells | `CellDelta` collection, key = cell id + content id |

The streamer (`StreamingWorld`) destroying cell GameObjects on unload is the §2 trap: gate `Npc`/`Loot`
unregister on death/removal events, **not** on the `OnDestroy` that streaming triggers.

## 9. After this file

Back to [`06-TRACKING-PATTERNS.md §9`](../06-TRACKING-PATTERNS.md) (decision guide) to finalize the
per-type tracked set, and the genre file(s) the game blends for the action catalog + genre checklist
(via [`INDEX.md`](./INDEX.md)). This file only added the **streaming delta**: presence ≠ existence,
world/cell objectTypes, persistent-world-id identity, and scope-to-the-moment.

---

## Calls used in this doc

**`[SDK]`** (authority: [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)):
`LudeoStateObject.SetAttribute` / `DestroyStateObject` (via the `[Layer]` handler) — no open-world-only
SDK surface; this is a usage pattern over the `06` model.

**`[Layer]`** (from [`../unity/REFERENCE-ARCHITECTURE.md`](../unity/REFERENCE-ARCHITECTURE.md)):
`LudeoController.{StartTrackingLudeoState, StopTrackingLudeoState, UpdateStateObjects, IsInLudeoFlow}`.

**`[Unity]`:** MonoBehaviour `OnDestroy`/`Update` · `GetInstanceID` (named as a **don't-use**) ·
game-specific streaming / save / world-time systems.
