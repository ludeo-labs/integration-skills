# 06 — Object Tracking Patterns (Unity)

> **Purpose:** How to capture GameObject state for Ludeo during active gameplay (the C# data model).
> **Audience:** AI agents implementing object tracking (phases 8–9) in a Unity project.
> **Scope:** Unity + the `LudeoSDK` managed plugin. **Prerequisites:**
> [`05-LIFECYCLE-MANAGEMENT.md`](05-LIFECYCLE-MANAGEMENT.md), [`00-CRITICAL-REQUIREMENTS.md`](00-CRITICAL-REQUIREMENTS.md).
> **Related:** [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md) (the layer this builds on),
> [`07-RESTORATION-PATTERNS.md`](07-RESTORATION-PATTERNS.md) (the read-back, row-for-row inverse of capture),
> [`12-SDK-API-REFERENCE.md`](12-SDK-API-REFERENCE.md).

> **Legend:** `[SDK]` = Ludeo package API (signatures in [`12-SDK-API-REFERENCE.md`](12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = a helper from [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md) ·
> `[Unity]` = engine API.

> **This is NOT the C++ model.** There is **no `LudeoObjectId`, no bidirectional ID map, no
> `EnterObject`/`LeaveObject`, no `LUDEO_CAPTURE_*` macros, and no `#if` guards at capture sites.** A
> tracked object is a `LudeoStateObject` `[SDK]` created via `LudeoRoom.CreateStateObject`, fed by one
> `ILudeoStateHandler` `[Layer]` whose `OnStateDataUpdate` writes typed `SetAttribute` `[SDK]` values
> each sampling tick. Disable is runtime (the flow switch serves a dummy — CR-001), so capture code is
> plain C#. Identity at restore is by **objectType bucket + your own key attribute** (CR-014), never an
> SDK id.

---

## How to use this document

You rarely need this end-to-end — jump to the section your task needs:

- **Deciding what to track at all?** → §9 (the decision guide) — the highest-value section.
- **Classifying how the game spawns/owns objects before writing code?** → §2.
- **Writing the register / per-tick capture / unregister calls?** → §3 (the handler model).
- **Relationships (owner, parent, target) across capture/restore?** → §4.
- **Plugging into a spawner / manager / pool?** → §5.
- **Registering everything already alive when gameplay begins?** → §6.
- **Discrete events (kills, pickups)?** → §7 (mostly: go to `phase 7`).
- **Suspending capture during cutscenes / menus?** → §8.
- **Per-object-type snippets (player, enemy, pickup, door)?** → §10.
- **Cost / tuning?** → §11. **Self-check?** → §12.

Phase 8 (map objects) leans on §2 and §9; phase 9 (implement) on §3, §4, §5, §6, §8.

## Table of Contents

1. [Tracking Strategy Overview](#1-tracking-strategy-overview)
2. [How the Game Spawns & Owns Objects](#2-how-the-game-spawns--owns-objects)
3. [The Capture Lifecycle (handler model)](#3-the-capture-lifecycle-handler-model)
4. [Identity & References (no ID map)](#4-identity--references-no-id-map)
5. [Where Registration Plugs In](#5-where-registration-plugs-in)
6. [Batch Registration at Gameplay Start](#6-batch-registration-at-gameplay-start)
7. [Actions (Discrete Events)](#7-actions-discrete-events)
8. [Tracking State Management](#8-tracking-state-management)
9. [What to Track — Decision Guide](#9-what-to-track--decision-guide)
10. [Common Patterns by Object Type](#10-common-patterns-by-object-type)
11. [Performance Considerations](#11-performance-considerations)
12. [Validation Checklist](#12-validation-checklist)

---

## 1. Tracking Strategy Overview

### 1.1 Core principle

**Track every GameObject whose state a viewer would notice, or that another tracked object depends
on.** Ludeo replays a captured moment **perfectly from the player's perspective** — a continuous,
playable reconstruction, not a highlight reel. **The destination is always full reconstruction**, not
partial.

**Do not ask the user "do you want full state tracking?"** — that's the SDK's purpose, not a scoping
choice. Scope questions go the other way (*"is this entity/property part of the complete picture?"*)
and are answered by §9 + the genre checklists.

**Iterative wave rollout (the default delivery model — every game, not just large ones):** the
**destination** is full reconstruction, but you **get there in waves**, proving the capture↔replay
round-trip on a small set before widening. This is *delivery order*, not a fidelity compromise — you still
track everything, just not all at once.
- **Census once, up front** (`phase 3` Part A): enumerate every trackable object **type**, flag the
  **load-bearing** ones, and assign each a **wave**. Shallow enough for a real human review; complete
  enough that no subsystem is unseen.
- **Wave 1 = the restorable spine + the must-have set:** world/level identity + player + time-base/
  continuity singleton **plus the few collections the moment is visibly wrong without**. The smallest set
  that produces a *coherent* replay.
- **Then deep-scope → capture → reconstruct → verify, per wave** (`phase 4` wave loop), widening only after
  a wave's restore gate is green.
- **Guardrail — widen for breadth, never to backfill:** if a later wave reveals state an *already-confirmed*
  wave needed to read correctly, that is a miss in the **earlier** wave — fix it there and re-verify its
  gate; do not carry load-bearing state forward as "enrichment." (This is why the census flags load-bearing
  and forbids deferring it.)

When in doubt, track it — and put it in the earliest wave its load-bearing-ness demands. See
`8-map-game-objects.md` (Part A census, Part B per-wave deep-scope) and
`9-tracking-restore-orchestrator.md` (the wave loop).

### 1.2 What gets tracked

| Category | Examples | Priority |
|---|---|---|
| **Player** | Player character, stats, inventory, transform | CRITICAL |
| **Camera / viewpoint** | Camera pitch/yaw, orbit distance, free-look angle, zoom/FOV | **CRITICAL when the view is independently controllable** (mouse/free-look, manual orbit, aim, zoom) — the replay must open on that exact view; **skip a fixed camera** (static top-down/isometric — a constant, §9.3) and a **pure follow-cam derived from restored player state** (recompute it) (§9.4) |
| **NPCs / Enemies** | AI entities, health, state, transform | CRITICAL |
| **Interactive objects** | Pickups, doors, switches, vehicles | CRITICAL |
| **Projectiles** | Bullets, grenades (if persistent/visible) | IMPORTANT |
| **Environment state** | Destructibles, lighting, weather, **active soundtrack / music track id** (*which* track is playing — restore re-starts it; §8, §9.4) | IMPORTANT |
| **Time-base / continuity** | Session/music clock **position** (`AudioSource.time`), scheduler/beat index, active timers & cooldowns (remaining), in-progress sequence/wave index | **CRITICAL when the moment is time-driven** (rhythm/timed/scheduler games — without it the replay restarts the clock); otherwise IMPORTANT |
| **UI/Audio state** | HUD mode, music **intensity** (the cosmetic mixing layer — *not* which track is playing (environment, above) nor the clock position (time-base, above)) | OPTIONAL |

### 1.3 Tracking vs actions

| | **Tracking (continuous state)** | **Actions (discrete events)** |
|---|---|---|
| Nature | Ongoing, changes over time | Happens at a moment |
| API | `LudeoStateObject.SetAttribute` `[SDK]` each tick | `LudeoGameplaySession.SendAction` `[SDK]` once |
| Flow | **Capture (creator) flow only** | **Both** creator and play flow (see §7) |
| Examples | `health=75`, `position=(10,5,3)` | `"Kill"`, `"CollectCoin"` |

Both are required. Tracking is this doc; actions are `phase 7`.

### 1.4 Attributes vs blobs — default to attributes

`LudeoStateObject.SetAttribute` `[SDK]` takes typed values: `int`, `float`, `double`, `bool`,
`string`, `Vector3`, `Quaternion`, `byte[]` (see doc 12). **Default to discrete typed attributes — do
not ask the user.** The platform can read individual values (objectives/scoring/highlights key off
real state), restoration is partial- and version-tolerant, and a changed field doesn't corrupt the
rest. A `byte[]` **blob** is opaque to the platform, can only be handed back verbatim, and breaks when
the serialization format shifts.

**Only use a blob (`SetAttribute(name, byte[])`) when:** the user explicitly asks, **or** the state is
genuinely opaque/large/deeply-nested with no stable field schema (a procedural buffer, a third-party
physics blob). Prefer the narrowest blob possible; note the entity + reason in the plan. This is
distinct from how the *game* saves itself (classified game-level in `phase 0` `INTAKE.md`, per-entity in
`phase 8`) — a game that saves a
JSON/binary blob should still be tracked into Ludeo as discrete attributes by default.

---

## 2. How the Game Spawns & Owns Objects

Before writing capture code, classify how the game **creates, destroys, and mutates** trackable
GameObjects. This decides *where* the §3 calls go (the calls themselves don't change). Unity games mix
patterns; classify per subsystem.

> **⛔ DOTS / ECS is not supported.** The Ludeo SDK and its Unity plugin currently work only against
> the **GameObject / MonoBehaviour** model — `LudeoStateObject` capture assumes managed objects you
> hook from `Awake`/`Start`/`Update`/`OnDestroy`. Entities (the DOTS package — `Entity`, `IComponentData`,
> `SystemBase`/`ISystem`, Burst jobs) has **no supported integration path**. If the game's trackable
> state lives in ECS, **stop and tell the user**: the parts to be Ludeo-tracked must run as GameObjects,
> or the integration isn't currently possible. Don't try to bridge it with the §2.6 per-tick sweep —
> that fallback is for GameObject subsystems that merely lack a spawn callback, not for ECS. Hybrid
> projects (DOTS world + GameObject gameplay) can integrate the **GameObject** side only.

### 2.1 Direct `Instantiate` / `Destroy` at the spawn site
**Signs:** `Instantiate(prefab, ...)` / `Destroy(go)` scattered in gameplay code; lifecycle via
MonoBehaviour `Awake`/`OnEnable`/`Start` and `OnDestroy`.
**Register hook:** the spawn site (right after `Instantiate`), or the object's own `Start`/`OnEnable`
**once gameplay is active**. Don't register from a constructor — use Unity callbacks.
**Unregister hook:** `OnDestroy` `[Unity]`.
**Property hook:** the object samples its own fields each tick inside its `OnStateDataUpdate` (§3).

### 2.2 Central spawner / manager / factory
**Signs:** a `…Spawner`/`…Manager`/`…Factory` with a `Spawn`/`Create` method everything routes
through; it owns a list of live instances.
**Register hook:** inside `Spawn`, after the instance is built. **Cleanest integration point** — one
site covers many types. **Unregister:** the manager's `Despawn`/`Destroy`. **Batch (§6):** the manager
already owns the list. *Prefer this over patching individual classes.*

### 2.3 Object pool
**Signs:** `ObjectPool<T>`, `Get()`/`Release()`, prefabs `SetActive(false)` instead of destroyed.
**Register hook:** the **pull from pool** (`Get()` → activated), *after* the game resets the instance's
payload — a pooled object carries stale data until re-init. **Unregister:** the **return to pool**
(`Release()` / `SetActive(false)`), not `OnDestroy` (pooled objects rarely destroy).
**Pitfall:** `GetInstanceID()` is reused across pool cycles — never use it as a cross-run key (CR-014).

### 2.4 Prefab / data-driven spawn
**Signs:** one `Spawn(prefabId/ScriptableObject, …)` produces many types from data assets.
**objectType naming:** use the prefab/definition id as the Ludeo `objectType` string — restoration
looks up the same id to recreate the object. **Property hook:** follow §2.1–§2.3 for the instance.
**Pitfall:** editor-placed, runtime-spawned, and restore-spawned objects may take different paths —
instrument all.

### 2.5 Save-system as a discovery input (planning technique, not a hook)
If the game has a save system, its serializer is a ready-made inventory of "what the game considers
state." Read it (already classified game-level in `phase 0` intake) to seed the tracked set + per-type fields. **Floor,
not ceiling:** saves often skip transient state (velocity, AI perception, in-flight projectiles,
**music/scheduler clocks and mid-countdown timers/cooldowns**) that Ludeo *does* need — saves restart
the song/timer on load, a Ludeo must resume it (§9.5, Step 4.5) — and may include meta state (settings)
it should *not*.

### 2.6 Per-tick sweep (fallback)
If a subsystem exposes no spawn/despawn callback, have a manager iterate the live set each sampling
tick, diff against last frame, and register newcomers / unregister vanished ones. Last resort — most
Unity code has a real spawn site; look again before using this.

### 2.7 Manager / serializer-driven sweep (strong-save games)
**Signs:** the game has a robust **named-field save manager** (e.g. a `…StateManager` with
`GetEnemyData()`/`GetLootContainerData()`/… returning `*Data` records) keyed by a **stable persistent id**,
but exposes **no public live-GameObject enumerator** to hook. Common in open-world/RPG/sandbox games (e.g.
Daggerfall Unity).

This is **not** §2.6's blind scan of live objects — the save manager is a *curated* enumerator of exactly
what the game considers state. So a Ludeo-side manager sweeps **the game's serializer**, not the scene: each
throttled tick, call the data accessors and write **one state object per stable id**, sampling attributes
from the returned records. This is **reconciliation-as-capture** — it mirrors the game's own serializer
(confirm it's reconciliation in the `phase 8` per-entity matrix), and it's the cleanest fit when §2.2's live list isn't exposed.

Why it's attractive:
- **Zero game-code edits** — you never touch the serializable classes.
- **Stable identity for free** — the serializer's persistent id *is* your key (§4); never `GetInstanceID()`.
- **Sidesteps the streaming `OnDestroy` trap** — existence is defined by *the manager's current set*, not by
  `OnDestroy` (§3.3). An id that drops out of a sweep is "gone"; one that appears is new — no per-object
  register/unregister, no hand-guarding stream-out=death across files. (Diff sweep-to-sweep to reuse one
  handler per id rather than recreating state objects each tick.)

> ⚠️ **Floor, not ceiling — the risk this pattern's tidiness hides.** The sweep inherits **exactly** the
> serializer's scope. Save records were built to *reload between sessions* and routinely **omit transient /
> visual state a viewer notices**: precise facing/turret angle mid-action, animation/attack phase, in-flight
> projectiles or VFX, AI current-target / perception. **Diff each `*Data` record against "what a viewer sees"
> and supplement the gaps with discrete attributes on the same state object** (`§1.4`, `§2.5`). Skipping this
> is the #1 way a serializer-sweep replay goes subtly wrong (enemies snap, projectiles vanish).

Two more rules:
- **Sweep the collections only; singletons stay direct.** The player, world/run metadata, and quest state
  usually aren't in the collection accessors — hook those directly (§2.1/§2.2). The integration is a hybrid.
- **Confirm streamed-out coverage.** Check whether the accessors return objects whose cells have streamed out
  or only currently-loaded ones. Either works — loaded-only means you're scoping to the loaded neighborhood
  (correct for a Ludeo moment, see `game-patterns/open-world-tracking.md`) — but **document the scoping**
  rather than assuming the cache covers everything.
- **Cost:** the accessors allocate record arrays per sweep → throttle and skip-unchanged (§11).

**Classify, then go to §3.** The most common Unity happy path is **§2.2 (central spawner) + §2.5
(save-system input)**; strong-save games with no live enumerator use **§2.7**.

---

## 3. The Capture Lifecycle (handler model)

One tracked GameObject = one `LudeoStateObject` `[SDK]`, owned by one `ILudeoStateHandler` `[Layer]`.
You **register** through the façade, **sample** each tick, and **unregister** on despawn. All of this
goes through `LudeoController` `[Layer]`, so when the SDK is disabled the dummy makes it a no-op
(CR-001) — no `#if` needed.

> **Capture is creator-flow only — gate every register and sample on `!IsInLudeoFlow`.** Disabled is a
> no-op (the dummy manager), but **the play/restore flow uses the *real* manager** (the flow switch
> serves `m_real` for both create and play). So unlike CR-001, the play flow does **not** silently
> swallow capture: a `StartTrackingLudeoState` or `UpdateStateObjects` call left ungated will really
> `CreateStateObject`/`SetAttribute` *during a replay*, corrupting the playback room. State is
> capture-only (§7); the play flow restores objects from buckets instead (`07`). Therefore **wrap every
> registration site and the per-tick sampler in `if (!LudeoController.Instance.IsInLudeoFlow)`** — the
> same seam §6 uses for batch registration. (Actions are the exception — they fire in *both* flows; §7.)

### 3.1 Register + supply the per-tick writer
From the spawn site (or the object's `Start`, once gameplay is active):

```csharp
if (LudeoController.Instance.IsInLudeoFlow) return;   // [Layer] capture is creator-only; play restores from buckets
// objectType = LudeoPlayerKeys.OBJECT_NAME [Layer]; the lambda is OnStateDataUpdate [Layer]
m_handler = LudeoController.Instance.StartTrackingLudeoState<DefaultLudeoStateHandler>(  // [Layer]
    LudeoPlayerKeys.OBJECT_NAME,
    obj => {                                                  // obj is the LudeoStateObject [SDK]
        // identity / "static" attributes — write them too; the SDK diff-sends, so re-writing is free
        obj.SetAttribute(LudeoPlayerKeys.RunId, m_runId);     // [SDK] YOUR stable key (see §4)
        // dynamic attributes, sampled from live state:
        obj.SetAttribute(LudeoPlayerKeys.Position, transform.position);    // [SDK] Vector3 [Unity]
        obj.SetAttribute(LudeoPlayerKeys.Rotation, transform.rotation);    // [SDK] Quaternion [Unity]
        obj.SetAttribute(LudeoPlayerKeys.HP, m_hp);                        // [SDK] int
    });
```
`StartTrackingLudeoState` `[Layer]` calls `LudeoRoom.CreateStateObject(objectType, out obj)` `[SDK]`
and stores the handler in the gameplay-session manager's tracked list. It returns `null` when the SDK
is disabled — that's fine; the game keeps a handler reference only to stop it later (§3.3).

> **Atomic register + statics.** Write the object's **identity/key** attributes inside the same
> `OnStateDataUpdate` as the dynamics (above). Because the handler writes every attribute each tick and
> the SDK only sends changed values (doc 12), statics cost nothing after the first send and are
> guaranteed present. Don't split "create now, write identity later" — a registered-but-keyless object
> restores with defaults and produces duplicates/wrong identities.

### 3.2 Per-tick sampling
`LudeoController.UpdateStateObjects()` `[Layer]` loops every tracked handler and invokes its
`OnStateDataUpdate`. Drive it from a gameplay MonoBehaviour, **only while gameplay is active** (CR-005):

```csharp
// gameplay active AND creator flow — never sample during a replay (see the §3 rule box)
void Update() { if (m_gameplayActive && !LudeoController.Instance.IsInLudeoFlow) LudeoController.Instance.UpdateStateObjects(); }  // [Unity]→[Layer]
```
Do **not** wire an SDK tick — the plugin ticks itself (CR-005). Sample on a consistent cadence
(per-frame, throttled, or on-change — §11), on the **main thread** (CR-013).

### 3.3 Unregister
On despawn, stop the handler so its `LudeoStateObject` is destroyed:

```csharp
void OnDestroy() { LudeoController.Instance.StopTrackingLudeoState(m_handler); }   // [Layer] (→ DestroyStateObject [SDK])
```
`LudeoController.EndGameplay` `[Layer]` already calls `StopTrackingAllLudeoStates()` on every exit
path (CR-007), so session end cleans up everything; per-object `StopTracking` is for objects that
**leave the reconstructed world** *during* a run — but whether a death/destroy/consume *is* such a
removal is the §3.4 decision, not an automatic `StopTracking`. Both are safe no-ops when disabled.

> **Streaming worlds: `OnDestroy` ≠ "gone from the world."** If the world streams cells/chunks in and
> out, `OnDestroy` `[Unity]` also fires when a cell **unloads** — but a streamed-out object isn't dead,
> so unregistering it would drop it from the replay. Gate `StopTrackingLudeoState` on a real removal
> signal (death/consume/destroy), not on `OnDestroy` alone. See
> [`game-patterns/open-world-tracking.md`](game-patterns/open-world-tracking.md) (presence ≠ existence).

### 3.4 Terminal state — track only what the restore must reconstruct

When an object dies / is destroyed / is consumed mid-run, the question is **not** "did it end?" — it's
**"does the restored world still need this object?"** The SDK has no interest in a dead or irrelevant
object; restoration rebuilds a snapshot ([`07-RESTORATION-PATTERNS.md`](07-RESTORATION-PATTERNS.md) §1.1),
so an object earns its `LudeoStateObject` *only if it must appear in that snapshot*. Two outcomes:

- **Gone from the reconstructed world → `StopTracking` (drop).** The object no longer exists in the state
  the replay rebuilds. Its **state object is destroyed and it's simply absent at restore.** This includes
  the case where the game **replaces** it with a *different* tracked object that carries the visible residue
  — e.g. a killed enemy that the game swaps for a corpse/loot container: track the **replacement**, drop the
  enemy. Keeping the dead enemy too would **double-represent** a state the game itself never shows.
- **Still in the reconstructed world, now terminal → keep it; the terminal state *is* its restored state.**
  The object persists into the snapshot in an ended condition — rubble a destructible leaves in place, a
  consumed pickup whose object stays showing "empty/unavailable", a ragdoll that *is* the same persistent
  object. Don't `StopTracking`; just capture the terminal flag (`isDestroyed`/`isConsumed`/`isDead`) as one
  more sampled attribute. **This is the §9.4 "'Destroyed' is a state flag, not an unregister" case** — it
  applies precisely when nothing else represents the ended thing.

So the decision is **reconstruction-relevance**, and §3.3 (drop) and §9.4 (persist) are the two answers to
the *same* question, not conflicting rules. Three guards:
- **Never conflate with stream-out** (§3.3 box): a streamed-out object is still in the world — neither drop
  nor terminal-flag; leave it tracked (presence ≠ existence).
- **A dropped object must not be referenced by a survivor.** If a tracked object captured the dropped
  object's key (owner/target — §4), its restore-side resolution must fail loud, not dangle (`07 §6`); prefer
  clearing/repointing the reference at the same time you drop.
- **Under the §2.7 manager-sweep, "drop" is automatic** (the id leaves the manager's set), so to *persist* a
  terminal state you must catch the **final pre-removal sweep** — and you only do that when the game doesn't
  otherwise represent the ending. If it does (DFU's corpse container), let the id fall out and track the
  replacement.

---

## 4. Identity & References (no ID map)

**There is no bidirectional `LudeoObjectId ↔ game id` map** (the C++ `LudeoStateAdapter` does not
apply). At restore, objects come back grouped **by `objectType` bucket**
(`Dictionary<string, List<LudeoStateObjectRestore>>`); singletons take `[0]`, collections iterate (see
doc 12 + `07`). So identity is **your** responsibility:

- `GetInstanceID()` and object references are **not stable across runs** (CR-014) — never capture them.
- **Default (spawn-from-bucket):** for collections, store **your own stable key** as an attribute at
  capture (e.g. an `int` you assign per spawn, or a content/prefab id) so restore can tell entries
  apart and re-link them. For a singleton (the player) the bucket's single entry is enough.
- **Relationships** (owner, parent, target): capture the **target's stable key**, not a reference:
  ```csharp
  obj.SetAttribute(LudeoWeaponKeys.OwnerId, owner != null ? owner.RunId : -1);   // [SDK] your key, not a ref
  ```
  At restore (phase 12, two-pass per CR-006): create all objects first, then resolve `OwnerId` by
  matching the captured key against the objects you spawned.

---

## 5. Where Registration Plugs In

Map the §2 classification to the register/unregister hooks:

| Game pattern | Register at | Unregister at |
|---|---|---|
| Direct `Instantiate` (§2.1) | spawn site, or object `Start` (gameplay active) | `OnDestroy` `[Unity]` |
| Central spawner/manager (§2.2) | inside `Spawn`, after build | inside `Despawn`/`Destroy` |
| Object pool (§2.3) | on `Get()` after re-init | on `Release()` / deactivate |
| Prefab/data-driven (§2.4) | the shared `Spawn`; objectType = prefab id | the shared `Despawn` |

The body is the same everywhere: `StartTrackingLudeoState<…>(objectType, onUpdate)` `[Layer]` to
register; keep the returned handler; `StopTrackingLudeoState(handler)` `[Layer]` to unregister.
Centralize in the spawner/manager when the game has one — it keeps SDK touch-points in one place
(the spirit of CR-009 and the façade boundary).

---

## 6. Batch Registration at Gameplay Start

Objects already alive when a run begins (placed in the scene, spawned during load) must be registered
once gameplay starts — register them **after** `RoomReady`/`Begin`, and **skip when playing a Ludeo**
(the restore flow creates objects itself):

```csharp
void OnGameplayBegan()
{
    if (LudeoController.Instance.IsInLudeoFlow) return;   // [Layer] play/restore flow → objects come from buckets
    foreach (var e in EntityManager.Instance.All)         // the manager's live list (§2.2)
        e.RegisterLudeoTracking();                        // each calls StartTrackingLudeoState [Layer]
    // also register level/run metadata as its own objectType (level id, mode, seed if gameplay-relevant)
}
```
`IsInLudeoFlow` `[Layer]` is the real seam (it exists on the controller — `m_data.isInLudeo`); don't
invent an ad-hoc "is this a replay" check. Large worlds: amortize batch registration across a few
frames to avoid a one-time hitch (§11).

---

## 7. Actions (Discrete Events)

Action *discovery + filtering* (genre catalogs, naming, the keep test) is `phase 6`; *insertion* (call
sites, edge cases) is `phase 7`; the `SendAction` `[SDK]` / `LudeoController.SendAction` `[Layer]`
definitions are in [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md). This section
owns nothing new — go there. Two rules that intersect tracking:

> **Don't capture state as an action.** If a value is sampled by the per-tick capture (current weapon,
> ammo/health/resource/XP totals, is-sprinting/drifting), it's **tracking**, not an action — mirroring
> it as a `SendAction` is redundant and bloats the Ludeo. Phase 6's keep test enforces this.

> **Actions fire in BOTH flows; state is capture-only.** `SendAction` re-fires at the same sites
> during playback so the SDK can score the Ludeo's win/fail conditions — **never gate it on
> `IsInLudeoFlow`**. State writes (`SetAttribute`, the per-tick capture in §3) **are** creator-only;
> the play flow reads state back instead of writing it (see `07 §2.3`).

---

## 8. Tracking State Management

Capture should be suspended when the moment isn't real gameplay: pause menu, cutscene, tutorial/safe
zone, loading. In Unity this is simply the **sampling gate** — the game controls whether
`UpdateStateObjects()` runs:

```csharp
void Update()
{
    if (m_gameplayActive && !m_inCutscene && !m_inMenu      // [Unity] the game's own flags
        && !LudeoController.Instance.IsInLudeoFlow)          // [Layer] creator-only (§3 rule box)
        LudeoController.Instance.UpdateStateObjects();      // [Layer] — paused frames capture nothing
}
```
While the gate is closed, attributes simply aren't sampled (the last captured values stand). This is
distinct from the **overlay pause** (CR-011, `AddNotifyPauseGame` → `Time.timeScale = 0f`), which
freezes the whole sim while the Ludeo UI is up — see
[`unity/CONSENT-AND-OVERLAY.md`](unity/CONSENT-AND-OVERLAY.md). Common non-gameplay states: main menu,
lobby, loading screen, shop/inventory overlay, safe zone/hub, cutscene.

---

## 9. What to Track — Decision Guide

### 9.1 The principle
**Capture what the moment needs to PLAY FORWARD, not just what reproduces the picture.** The Ludeo is a
continuous playable reconstruction (§1.1), so "would a viewer notice this frame-1?" is the wrong single
test — much of what a run needs to continue correctly is **invisible on the first frame yet governs how
it plays on**: character stats/skills, cooldowns, quest/world flags, reputation, hidden inventory. So the
rule has two limbs: **track every object whose state a viewer would notice, OR whose state changes how the
run plays forward** (including state another tracked object depends on). Four failure modes:
1. **Over-tracking** is cheap — a slightly larger capture. It doesn't break the replay.
2. **Under-tracking visible state** → loudly broken replay (missing objects, stuck doors). Easy to catch.
3. **Under-tracking derived state** → subtly broken replay (enemy targets the wrong player, physics
   drifts). These slip through testing.
4. **Under-tracking invisible forward-play state** → the moment *looks* right on frame 1 and passes a
   behavioral restore gate, then diverges as it plays (skills/inventory/cooldowns/flags missing). The
   costliest miss, because the gate green-lights it. A viewer-centric read (§9.2) is what drops it.

> **Visibility decides PRIORITY (which wave), never INCLUSION.** Invisible forward-play state is in
> scope; if it's not load-bearing for the current wave's replay it is **deferred to a later wave with a
> reason**, not dropped. Prove inclusion structurally, not by eye: enumerate each entity's full
> state-field surface (the save-serialized fields — §2.5/§2.7 — or its runtime-mutable component fields)
> and give **every field a disposition** — `capture | defer→wave N | exclude(static/settings/derivable)`.
> This is the phase-8 Step B3 completeness gate; it catches failure mode 4, which no "does it look right"
> check can. (`settings`/meta is excluded, not captured — it leaks across Ludeos.)

**When in doubt, track.** Over-tracking's cost is measurable; under-tracking's cost is a silently
wrong replay.

### 9.2 Decision flow — a single object type
```
1. Is any instance visible during gameplay?         Yes → Track.   No → 2
2. Does its state influence a tracked object?        Yes → Track (at least the state that matters). No → 3
3. Is it referenced by a tracked object (owner/parent/target)?  Yes → Track as a reference target. No → Skip
Unsure which branch? Track it — the cost is small.
```

### 9.3 Decision flow — a single property
1. **Does its value change during gameplay?** No → skip (it's a constant).
2. **Can a viewer or another tracked object's logic notice the change?** No → skip.
3. **Is it derivable from other tracked state?** Yes → skip — *only if* restoration will actually
   derive it (e.g. world pos = parent.pos + local offset).
4. **Does it carry meaning across sessions?** A `GetInstanceID()`, reference, or array index does not —
   use a stable key instead (§4).

Track if (1) AND (2 OR 3-not-derivable) AND (4-has-meaning).

### 9.4 Starting heuristics (examples, not rules)

| Object type | Typical | Caveat |
|---|---|---|
| Player | Track | Split-screen/co-op: track all players |
| Camera / view rig | Track its **control state** (pitch/yaw, orbit distance, zoom/FOV) — §10.6 — **only when the view is independently controllable** | **Skip** if the camera is **fixed** (static top-down/isometric — a constant, §9.3) or a follow-cam **fully** determined by restored player state (recompute it). Otherwise capture the rig's angles (not just the camera's world transform) so a follow/orbit rig reconstructs the exact view; capture any *independent* freedom (free-look yaw, aim pitch, manual orbit), and restore must **snap, not ease**, to it (`07 §5`/§7) |
| AI enemy / NPC | Track | Pooled: register on pull, not on prefab construction (§2.3) |
| AI perception / target (property) | Track | Drives visible behavior; suppress dev-only debug mutations |
| Hitscan bullet (no tracer) | Skip | Kill-cam / tracer / travel-time flips this to Track |
| Grenade / ballistic projectile | Track | Capture owner key to attribute kills |
| Respawning pickup | Track | Track "available/consumed" + respawn timer |
| Static decorative prop | Skip | Check for hidden physics/destructibility first |
| Destructible | Track | "Destroyed" is a **state flag**, not an unregister — *when the wreckage stays in the world* (§3.4); if it's removed/replaced, drop it |
| Door / switch / lever | Track | Mid-animation progress matters if replay can pause |
| Particle / VFX / audio / HUD | Skip the visual | Track the **underlying state** it shows. For music that is **two separate things**: *which track is playing* (environment — **every game**, so restore can re-start it; §8) and, **only for time-driven moments**, its *clock/position* (`AudioSource.time`, §10.5). Not the waveform. |

| Property kind | Typical | Caveat |
|---|---|---|
| Position / rotation / scale | Track (`Vector3`/`Quaternion`) | Attached objects: track the attachment relationship instead. **Absolute world position is only restorable if the world's spatial frame is rebuilt identically** — for procedural / streamed / randomized layouts (or a runtime **floating-origin / origin-rebasing** shift, which trips even an **authored** world) the geometry sits at a different origin/rotation than at capture, so capture/replay the resolved placement (`game-patterns/procedural-world.md` §3 Placement, §5) or store positions relative to a stable reconstructed frame. Detected up front by phase 1's world-frame probe → `CODE_MAP.session_boundaries.world_frame` |
| Velocity | Usually track | Skip only if restoration reconstructs motion from position-over-time |
| Health / ammo / resource | Track (current, not max) | Max is usually static |
| Enum state (alive/dead, AI mode) | Track as `int` | Serialize the enum to int; document meaning |
| Inventory | Track as array of item ids | Never references to item objects |
| Cooldown / timer | Track **remaining**, not elapsed | Restore sets "time until" |
| Animation frame / blend | Usually skip (derivable) | Track if a stuck pose would look wrong |
| Reference to another object | Never as a reference | Track the target's stable key (§4) |

### 9.5 When the table is wrong
The tables are typical cases. A kill-cam game tracks hitscan bullets; a **rhythm/dance game** ignores
most position rows **but must capture the music/scheduler clock (`AudioSource.time` / `dspTime` / beat
index) as its single most critical state — without it the replay restarts the song from zero while the
world is mid-moment** (the time-base/continuity category, §1.2, Step 4.5, §10.5); a stealth game
promotes lighting/AI-perception to critical; an RTS with thousands of
units weighs granularity (track squads, not individuals); an **open-world/streaming game** scopes to
the loaded neighborhood and adds world/cell state — see
[`game-patterns/open-world-tracking.md`](game-patterns/open-world-tracking.md). When your game differs,
re-apply §9.1–§9.3 from scratch rather than patching the table.

---

## 10. Common Patterns by Object Type

Each is the `OnStateDataUpdate` lambda passed to `StartTrackingLudeoState` `[Layer]` (§3.1). Attribute
names come from a `LudeoKeys` `[Layer]` constants class so capture and restore (phase 12) stay in sync.

```csharp
// 10.1 Player (singleton — bucket[0] at restore, no per-instance key needed)
obj => {
    obj.SetAttribute(K.Position, transform.position);   // [SDK] Vector3
    obj.SetAttribute(K.Rotation, transform.rotation);   // [SDK] Quaternion
    obj.SetAttribute(K.Velocity, rb.velocity);          // [SDK] Vector3 [Unity] Rigidbody
    obj.SetAttribute(K.HP, m_hp);                        // [SDK] int
    obj.SetAttribute(K.Ammo, m_ammo);
    obj.SetAttribute(K.Score, m_score);
};

// 10.2 Enemy (collection — capture YOUR stable key so restore can tell them apart)
obj => {
    obj.SetAttribute(K.RunId, m_runId);                  // [SDK] your stable key (§4)
    obj.SetAttribute(K.Position, transform.position);
    obj.SetAttribute(K.Rotation, transform.rotation);
    obj.SetAttribute(K.HP, m_hp);
    obj.SetAttribute(K.EnemyType, (int)m_type);          // enum → int
    obj.SetAttribute(K.AiState, (int)m_aiState);
    obj.SetAttribute(K.TargetId, m_target != null ? m_target.RunId : -1);  // relationship by key
};

// 10.3 Pickup / interactive
obj => {
    obj.SetAttribute(K.Position, transform.position);
    obj.SetAttribute(K.IsAvailable, m_available);        // bool — "consumed" is a state, not an unregister
};

// 10.4 Door / switch
obj => {
    obj.SetAttribute(K.IsOpen, m_isOpen);
    obj.SetAttribute(K.IsLocked, m_isLocked);
    obj.SetAttribute(K.OpenProgress, m_openProgress);    // float 0..1 (mid-animation state)
};

// 10.5 Session / continuity (singleton — bucket[0], NOT a visible GameObject; the time-base state
// that lets the moment RESUME, not restart — register it from the run/scheduler manager, see Step 4.5)
obj => {
    obj.SetAttribute(K.MusicTime, musicSource.time);     // [SDK] float — song position; restart-from-0 bug if omitted
    obj.SetAttribute(K.BeatIndex, m_beatIndex);          // scheduler/sequence cursor
    obj.SetAttribute(K.WaveIndex, m_waveIndex);          // in-progress sequence/wave
    obj.SetAttribute(K.TimeRemaining, m_countdown);      // timers/cooldowns: REMAINING, not elapsed (§9.4)
};

// 10.6 Camera / viewpoint (singleton — bucket[0]; the exact view the moment must OPEN on). ONLY when the
// view is independently controllable — skip a fixed camera (constant) or a follow-cam fully derived from
// restored player state (§9.4). Capture the RIG'S control state, not only the derived world transform, so a
// follow/orbit rig reconstructs the view. Restore SNAPS to these (no smoothing/lerp), else the replay eases
// in from a default view (07 §5/§7).
obj => {
    obj.SetAttribute(K.CamPitch, m_rig.pitch);           // [SDK] float — look/aim pitch
    obj.SetAttribute(K.CamYaw, m_rig.yaw);               // [SDK] float — look/free-look yaw
    obj.SetAttribute(K.OrbitDistance, m_rig.distance);   // [SDK] float — third-person zoom/orbit (if the rig has it)
    obj.SetAttribute(K.Fov, cam.fieldOfView);            // [SDK] float — only if it changes (ADS/zoom)
    obj.SetAttribute(K.CamPosition, cam.transform.position);  // [SDK] Vector3 — only if the camera moves FREELY of the player (spectator/detached)
};
```

---

## 11. Performance Considerations

**Measure, don't trust this doc.** Cost varies with object count, attributes per object, sampling
cadence, and platform. The SDK **diff-sends only changed values** on its internal tick (doc 12), so
`SetAttribute` on an unchanged value is cheap — but the per-tick lambda work isn't free.

Levers, in rough order of impact:
1. **Skip-unchanged guards** for expensive reads: `if (m_hp == last) return;` — cheapest win.
2. **Throttle distant/off-screen objects** — sample every few frames; visually indistinguishable in replay.
3. **Shrink the tracked set** — re-apply §9; a surprising fraction of tracked objects contribute nothing visible.
4. **Sample non-critical state on-change**, not every frame (UI/metadata).
5. **Amortize batch registration (§6)** across frames for large worlds to avoid a start hitch.

Red flags: frame time regresses only with the SDK active (profile the hottest lambda); memory grows
with no new spawns (a despawn path skips `StopTrackingLudeoState`); a hitch at gameplay start (batch
registration not amortized) or at scene transition (mass despawn in one burst).

---

## 12. Validation Checklist

**Capture lifecycle**
- [ ] Each trackable registers via `StartTrackingLudeoState<…>(objectType, onUpdate)` `[Layer]`; the handler ref is kept.
- [ ] `OnStateDataUpdate` writes identity/key **and** dynamic attributes (statics not split off).
- [ ] `UpdateStateObjects()` `[Layer]` runs only while gameplay active, on the main thread; **no** SDK tick wired (CR-005).
- [ ] Despawn calls `StopTrackingLudeoState`; `EndGameplay` cleans up all (CR-007).

**Identity & references**
- [ ] No `GetInstanceID()` / references captured as keys; collections carry **your** stable key attribute (CR-014).
- [ ] Relationships captured as the target's key, resolved two-pass at restore (CR-006 / phase 12).

**Scope & types**
- [ ] Tracked set passes §9; attributes are typed (`Vector3`/`Quaternion`/`int`/…), blobs only where warranted (§1.4).
- [ ] Attribute names come from a `LudeoKeys` `[Layer]` class shared with restore.
- [ ] Camera/viewpoint control state captured (pitch/yaw/orbit/FOV, §10.6) **when the view is independently
      controllable** — skip a fixed camera or one fully derived from restored player state; restore snaps to
      it (`07 §5.5`).

**State & perf**
- [ ] Capture suspends in menus/cutscenes (sampling gate, §8); overlay pause handled separately (CR-011).
- [ ] Measured frame impact within budget; skip-unchanged/throttling applied where needed; no memory growth across a session.

---

## Calls used in this doc

**`[SDK]`** (authority: [`12-SDK-API-REFERENCE.md`](12-SDK-API-REFERENCE.md)):
`LudeoRoom.CreateStateObject` · `LudeoStateObject.SetAttribute` / `DestroyStateObject` ·
`LudeoGameplaySession.SendAction` (see `phase 7`).

**`[Layer]`** (from [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md)):
`LudeoController.{StartTrackingLudeoState, UpdateStateObjects, StopTrackingLudeoState, EndGameplay,
SendAction, IsInLudeoFlow}` · `ILudeoStateHandler` (`DefaultLudeoStateHandler`) ·
`ILudeoGameplaySessionManager.StopTrackingAllLudeoStates` · `LudeoKeys`/`LudeoActionKeys`.

**`[Unity]`:** `Instantiate`/`Destroy`/`OnDestroy` · MonoBehaviour `Update`/`Start` · `Transform` ·
`Vector3`/`Quaternion` · `Rigidbody`.

---

**Next steps:** tracking mapped/implemented → `phase 8` (map objects) feeds `phase 9` (implement);
then [`07-RESTORATION-PATTERNS.md`](07-RESTORATION-PATTERNS.md) restores exactly what you captured here
(Pass 2 is the row-for-row inverse of this capture).
