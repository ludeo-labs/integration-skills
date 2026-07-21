# 07 — State Restoration Patterns (Unity)

> **Purpose:** How to rebuild captured GameObject state when a Ludeo is played (the read-back, **row-for-row
> inverse of [`06-TRACKING-PATTERNS.md`](06-TRACKING-PATTERNS.md)**).
> **Audience:** AI agents planning + implementing state restoration (phases 10–11) in a Unity project.
> **Scope:** Unity + the `LudeoSDK` managed plugin. **Prerequisites:**
> [`05-LIFECYCLE-MANAGEMENT.md`](05-LIFECYCLE-MANAGEMENT.md), [`06-TRACKING-PATTERNS.md`](06-TRACKING-PATTERNS.md),
> [`00-CRITICAL-REQUIREMENTS.md`](00-CRITICAL-REQUIREMENTS.md).
> **Related:** [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md) (the layer this builds on;
> **07 owns the restore-facing additions to it**), [`unity/CONSENT-AND-OVERLAY.md`](unity/CONSENT-AND-OVERLAY.md)
> (the overlay pause/resume the restore flow runs under), [`12-SDK-API-REFERENCE.md`](12-SDK-API-REFERENCE.md).

> **Legend:** `[SDK]` = Ludeo package API (signatures in [`12-SDK-API-REFERENCE.md`](12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = a helper from [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md) (this doc adds
> the restore-side methods) · `[Unity]` = engine API.

> **This is NOT the C++ model.** There is **no `LudeoObjectId ↔ game id` map, no `id_map`, no
> `RegisterAllExistingObjects`, no pointer identity.** A Ludeo's captured state comes back as a flat
> `LudeoStateObjectRestore[]` `[SDK]` that the layer groups **by `objectType` into buckets**
> (`Dictionary<string, List<LudeoStateObjectRestore>>`). You re-create each object, read its attributes with
> `TryGetAttribute` `[SDK]` (the inverse of capture's `SetAttribute`), and re-link relationships by **your own
> stable key** (CR-014) — matched against the objects you just spawned. The two-pass discipline (CR-006)
> survives as a *concept* for reference resolution; the C++ id-map machinery does not.

---

## How to use this document

Jump to the section your task needs — you rarely need it end-to-end:

- **Planning the restore (phase 10)?** → §1 (model) + §2 (the flow) + §8/§9 (world + pre-existing). The
  plan mirrors `OBJECT_TRACKING.md`; you don't write code.
- **Wiring the restore flow (phase 11)?** → §2 (flow) + §3.1 (`LudeoRestoredData` extraction) + §10 (freeze/overlay).
- **Filling the read-back (phase 12)?** → §3.2/§3.3 (restore accessors) + §4 (two-pass) + §5 (per-type snippets) + §6 (references).
- **Things that revert if applied too early?** → §7 (deferred properties).
- **Rebuilding the world / level the replay needs?** → §8 (game-definitions restore).
- **Scene-placed objects, open-world?** → §9 (pre-existing reconciliation).
- **Freeze / resume / overlay?** → §10 (wait-for-player, CR-010/011). **Self-check?** → §11.

Phase 10 (plan) leans on §1, §2, §8, §9, §10; phase 11 (flow) on §2, §3.1, §10; phase 12 (data) on §3, §4, §5, §6, §7, §8, §9.

## Table of Contents

1. [The Restoration Model](#1-the-restoration-model)
2. [The Restore Flow (LudeoSelected → Begin)](#2-the-restore-flow-ludeoselected--begin)
3. [The Restore Layer API (additions to REFERENCE-ARCHITECTURE)](#3-the-restore-layer-api)
4. [Two-Pass Apply (CR-006, no id-map)](#4-two-pass-apply-cr-006-no-id-map)
5. [Per-Object Restore Patterns](#5-per-object-restore-patterns)
6. [Cross-Entity References](#6-cross-entity-references)
7. [Deferred Properties](#7-deferred-properties)
8. [Game-Definitions / World Restore](#8-game-definitions--world-restore)
9. [Pre-Existing-Object Reconciliation](#9-pre-existing-object-reconciliation)
10. [Wait-For-Player, Freeze & Overlay (CR-010/011)](#10-wait-for-player-freeze--overlay-cr-010011)
11. [Validation Checklist](#11-validation-checklist)

---

## 1. The Restoration Model

### 1.1 Core principle — snapshot, not replay

Restoration rebuilds the **single captured snapshot** so the player resumes from exactly that frame. It
does **not** replay a time series. A property captured `per-tick` during tracking (position, HP) is
restored as its **final value**, applied once. The SDK then records the player's *new* playthrough from
that restored start.

### 1.2 What you get back

`LudeoDataReader.GetStateObjects()` `[SDK]` returns a flat `LudeoStateObjectRestore[]` `[SDK]`. The layer
groups it **by `ObjectType`** into `LudeoStateObjectsLookup` `[Layer]`
(`Dictionary<string, List<LudeoStateObjectRestore>>`) — see §3. From there:
- **Singleton** (the player): take the bucket's single entry, `list[0]`.
- **Collection** (enemies, pickups): iterate the bucket; tell entries apart by **your own stable-key
  attribute** captured in `phase 8`/`phase 9` (`06 §4`).

`LudeoStateObjectRestore.ObjectId` `[SDK]` is an SDK-assigned `uint`, **not** your game id — never match on
it (CR-014).

### 1.3 The mirror principle

Every restore decision inverts a capture decision in `OBJECT_TRACKING.md`. Same `objectType` strings, same
`LudeoKeys` `[Layer]` constants, same stable keys. `TryGetAttribute(K.X, out var x)` `[SDK]` reads back what
`SetAttribute(K.X, x)` `[SDK]` wrote. **You cannot restore what tracking didn't capture** — a gap means the
fix is in `phase 8`/`phase 9`, not here.

### 1.4 `TryGetAttribute` returns `false` when absent or type-mismatched

For every read, decide the fallback: **keep the spawn default** (partial-/version-tolerant restore — a
feature of the attribute model, `06 §1.4`) or **treat as an error**. Do **not** fail the whole restore on
one missing optional field; **do** fail loud on a missing identity key or a missing reference target (§6).

---

## 2. The Restore Flow (LudeoSelected → Begin)

The play flow is the inverse of the creator flow. The `[Layer]` already routes it; your job is to supply
the apply step and the game hooks. End-to-end (all `[SDK]` calls async/callback-based):

```
AddNotifyLudeoSelected (player picked a Ludeo in the gallery)        [SDK]
  → GetLudeo(ludeoId)                                                [SDK]  →  LudeoDataReader
      → new LudeoRestoredData(ludeoId, reader, out ok)               [Layer] groups buckets + restores world config (§8)
      → SwitchToPlay()  (consent-gated, CR-012)                      [Layer] IsInLudeoFlow becomes true
      → InitRoom → OpenRoom(forLudeo) → AddGamePlayer                [SDK]   (CR-009 chain; LudeoPlayFlow)
      → onInitDone(isStartingInLudeoFlow: true)                      [Layer] → game loads the gameplay scene
          → APPLY: spawn-from-bucket + restore attributes (§4)        ← your code, after scene/objects exist
  → AddNotifyRoomReady                                               [SDK]
      → (sync apply) Begin → unfreeze  ·  (async apply) unfreeze → Begin  [Layer]+[Unity] CR-010 §10.1
      → BeginGameplay()                                              [Layer] SDK starts recording the new playthrough
```

### 2.1 Ordering invariants (get these wrong → corrupt or empty replay)

1. **Scene/objects must exist before apply.** Apply runs after the gameplay scene is loaded (the GameObjects
   you write into must be present).
2. **Apply before `Begin`.** `BeginGameplay()` `[Layer]` starts SDK recording — if it runs before apply, the
   SDK records the default state, not the restored one.
3. **`Begin` is gated on `RoomReady`.** Resume/`Begin` happens in the `RoomReady` `[SDK]` notification handler
   — **not** a self-built "press to start" prompt, **not** `PlayerReady` (**does not exist in this SDK**),
   **not** `ResumeGame` (that's the mid-play overlay, §10).
4. **Restored state is protected until `Begin`** (CR-010) so a running `Update`/`FixedUpdate` can't overwrite
   it before recording starts — by **freezing** (synchronous apply) or by **suppressing** input/AI (async
   apply); never unfreeze *and* leave the sim un-suppressed during apply (§10.1). **Never unfreeze before the
   apply runs** — that's live sim frames mid-restore (the BL-4 trap).
5. **The viewer never watches the level assemble.** The third begin-gate leg —
   `sceneLoaded`/`NotifySceneReadyForRestore()` (CR-009) — means the scene is **fully assembled: apply done,
   async spawns *settled*, sim *frozen-ready*** — not merely "scene activated + objects exist." Keep the
   loading cover up until then; the first frame revealed behind the (paused) overlay must be the **finished
   restored scene**, not a half-built one. Opening the room early to hide SDK latency is fine — but gate the
   *reveal* and the scene-ready leg on settle+freeze, or the player resumes onto a level still popping in (§10.1).

> **Two valid placements for "apply".** The tank applies at **scene-load** (its `ReplayLudeo` path, gated on
> `IsInLudeoFlow`) and only calls `BeginGameplay` later in the `RoomReady` handler. REFERENCE-ARCHITECTURE's
> compressed bootstrap shows apply **inside `onRoomReady`** — `ApplyRestoredState();` **then** `BeginGameplay(…)`
> with the unfreeze in `Begin`'s callback (synchronous-apply order: apply while frozen → `Begin` → unfreeze).
> Both honor §2.1 — pick whichever fits where the game loads its scene, and record the choice in
> `RESTORATION_PLAN.md`. The invariant is *scene-loaded → **apply (protected)** → unfreeze → Begin (on
> RoomReady)* — **apply is never preceded by an unfreeze** (§10.1 fixes the order for sync vs async).

### 2.2 Play-flow re-entry (tear-down) — capture→play **and replay→replay**

`LudeoSelected` can fire while a run is **already live**, by two routes that hit the same code:
1. **Mid-capture** — the player opens the gallery during a capture run.
2. **Replay→replay** — the player finishes one replay and picks a **second** Ludeo from the overlay
   **without quitting**. This is the easy one to miss: there's no scene reload, no app restart, so a
   persistent-singleton layer (`07 §10.3`) carries the first play's state straight into the second.

`HandleGetLudeoDone` is therefore **re-entrant** and must tear the prior run down **completely** before
starting the new one. A partial teardown (just `CloseRoom`) leaves the integration broken three ways on
the second play:

| Stale state not reset | Failure on the next play |
|---|---|
| Overlay/Ludeo-done **pause flag** still `true` → `timeScale = 0` | an **async** restore (coroutine/`UniTask` spawn, NavMesh warp/bake, or any awaited physics step) **deadlocks** — `FixedUpdate` never ticks at `timeScale 0` (§10.1) |
| Prior **room + gameplay session** never `Abort`+`CloseRoom`d | `InitRoom` opens a **second room over a live one**; the begin-gate can `Begin` on the **stale session** (Begin fails) |
| **gameplay-active** flag (`isGameplayActive`) never cleared | any suppression keyed on the gameplay-active flag (a `!IsGameplayActive` pre-match/spawn guard, §10.1/§9) goes false → the suppressed systems fire on the replay |

**Complete teardown** = `AbortGameplay()` `[Layer]` (abort the **session**, `StopTrackingAllLudeoStates()`,
`CloseRoom`, reset `isGameplayActive`/`m_gameplayStarted`) **+** `ResetBeginGate()` `[Layer]`
(`m_roomReady` / `m_sceneReadyForRestore` / `ludeoGameplaySession`) **+** reset both pause flags to an
unfrozen baseline (§10.3, done in `onBeginRestore`). **Start the new play ONLY in the teardown's
callback** — `Abort`/`CloseRoom` are async, so issuing them and then opening the new room synchronously
stacks a second room over the still-closing one. See the wired `HandleGetLudeoDone` in §3.3 and the
`AbortGameplay`/`ResetBeginGate` skeleton in [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md).

---

## 3. The Restore Layer API

These are the **restore-side members of the `[Layer]`** — they extend the `LudeoController` /
`ILudeoFlow` skeleton in [`unity/REFERENCE-ARCHITECTURE.md`](unity/REFERENCE-ARCHITECTURE.md) (which shows the
tracking side). Reproduce them in the game's layer; they are derived from the tank's `LudeoController.cs`,
`LudeoFlow.cs`, and `LudeoRestoredData.cs`.

### 3.1 `LudeoRestoredData` — build the buckets (and restore world config)

Constructed in `HandleGetLudeoDone` from the `LudeoDataReader`. It calls `GetStateObjects` `[SDK]` once,
groups by `ObjectType`, and (tank) also rebuilds the game definitions (§8):

```csharp
public class LudeoRestoredData                                                    // [Layer]
{
    public Guid LudeoId { get; private set; }
    public Dictionary<string, List<LudeoStateObjectRestore>> LudeoStateObjectsLookup { get; private set; }
    public LudeoTrackedDefinitions TrackedDefinitionsForLudeo { get; private set; }  // §8 world/level config

    public LudeoRestoredData(Guid ludeoId, LudeoDataReader reader, out bool isGotData)
    {
        LudeoId = ludeoId; isGotData = false;
        if (reader.GetStateObjects(out LudeoStateObjectRestore[] objects) != LudeoResult.Success) {  // [SDK]
            Debug.LogWarning("no data to restore"); return;                        // [Unity]
        }
        LudeoStateObjectsLookup = GroupByObjectType(objects);
        TrackedDefinitionsForLudeo = new LudeoTrackedDefinitions();
        LudeoRestoredGameConfig.RestoreGameDefinitionsForLudeo(LudeoStateObjectsLookup, TrackedDefinitionsForLudeo); // §8
        isGotData = true;
    }

    private static Dictionary<string, List<LudeoStateObjectRestore>> GroupByObjectType(LudeoStateObjectRestore[] objs)
    {
        var lookup = new Dictionary<string, List<LudeoStateObjectRestore>>();
        foreach (var o in objs) {
            if (!lookup.TryGetValue(o.ObjectType, out var list)) { list = new List<LudeoStateObjectRestore>(); lookup[o.ObjectType] = list; }
            list.Add(o);
        }
        return lookup;
    }
}
```

### 3.2 `LudeoPlayFlow` — bucket accessors

The play flow reads buckets out of `LudeoRestoredData`. Singletons hand back `[0]`; collections hand back the
list; there's also a pass-through overload used when the caller already holds one restore object (§4):

```csharp
public class LudeoPlayFlow : ILudeoFlow                                            // [Layer]
{
    private readonly LudeoIntegrationData m_data;
    public LudeoPlayFlow(LudeoIntegrationData data) => m_data = data;   // injected at CONSTRUCTION (REFERENCE-ARCHITECTURE)
    // NOT lazily in InitRoom: the accessors below can be called from onBeginRestore BEFORE InitRoom runs;
    // a null m_data there is the classic first-restore NullReferenceException.
    // ... InitRoom (OpenRoom for ludeo) + StoreGameDefinitions per REFERENCE-ARCHITECTURE ...

    public void RestoreLudeoStateOfObject(string objectType, Action<LudeoStateObjectRestore> onRestore)  // singleton
    {
        if (m_data.ludeoRestoredData.LudeoStateObjectsLookup.TryGetValue(objectType, out var list))
            onRestore(list[0]);
    }
    public void RestoreLudeoStateOfObject(LudeoStateObjectRestore restore, Action<LudeoStateObjectRestore> onRestore) // pass-through
        => onRestore(restore);

    public bool TryGetAllLudeoStateObjectByType(string objectType, out List<LudeoStateObjectRestore> states)  // collection
        => m_data.ludeoRestoredData.LudeoStateObjectsLookup.TryGetValue(objectType, out states);
}
```
> `LudeoCreatorFlow` and `DisabledLudeoFlow` implement all three as **no-ops** (return `false`/empty) — restore
> only happens in the play flow, and a disabled SDK restores nothing (CR-001).

### 3.3 `LudeoController` — restore-facing façade methods

Add these to the controller (the game calls only the façade). They route to the active flow:

```csharp
// singleton restore: pulls bucket[0] for objectType and invokes your apply callback
public void GetAndRestoreLudeoStateOfObject(string objectType, Action<LudeoStateObjectRestore> onRestore)  // [Layer]
    => m_switch.LudeoFlow.RestoreLudeoStateOfObject(objectType, onRestore);

// per-instance restore: you already hold a restore object (one entry of a collection bucket)
public void RestoreLudeoStateOfObject(LudeoStateObjectRestore restore, Action<LudeoStateObjectRestore> onRestore) // [Layer]
    => m_switch.LudeoFlow.RestoreLudeoStateOfObject(restore, onRestore);

// collection restore: hand back the whole bucket so the spawner can distribute entries to instances
public bool TryGetAllLudeoStateObjectByType(string objectType, out List<LudeoStateObjectRestore> states)   // [Layer]
    => m_switch.LudeoFlow.TryGetAllLudeoStateObjectByType(objectType, out states);

public LudeoTrackedDefinitions GetLudeoTrackedDefinitions()                        // [Layer] §8 restored world config
    => m_data.ludeoRestoredData.TrackedDefinitionsForLudeo;
```

And the entry-point chain (in the controller; see REFERENCE-ARCHITECTURE for the surrounding skeleton):

```csharp
private void HandleLudeoSelected(LudeoSelectedCallbackData data)                   // [SDK] notification
{
    m_data.ludeoId = data.ludeoId;
    m_data.ludeoSession.GetLudeo(data.ludeoId, HandleGetLudeoDone);                // [SDK] async
}

private void HandleGetLudeoDone(LudeoGetLudeoCallbackData data)
{
    if (data.resultCode != LudeoResult.Success) { Debug.LogError($"GetLudeo: {data.resultCode}"); return; }  // [Unity]
    m_data.ludeoPlayerId = data.ludeoDataReader.PlayerId;                          // [SDK]

    // RE-ENTRANT: a capture OR a previous replay may still be live (§2.2). Tear it down COMPLETELY
    // (Abort session + StopTracking + CloseRoom + reset isGameplayActive/m_gameplayStarted) and start
    // the new play ONLY in the async teardown callback — never synchronously after issuing Abort/CloseRoom.
    if (m_gameplayStarted || m_data.ludeoRoom != null) AbortGameplay(SwitchToLudeoPlay);  // [Layer]
    else                                               SwitchToLudeoPlay();

    void SwitchToLudeoPlay()
    {
        ResetBeginGate();                            // [Layer] re-arm m_roomReady / m_sceneReadyForRestore / ludeoGameplaySession
        if (!m_switch.SwitchToPlay()) return;        // [Layer] consent gate (CR-012)
        m_data.ludeoRestoredData = new LudeoRestoredData(m_data.ludeoId, data.ludeoDataReader, out bool ok);  // §3.1
        if (!ok) { m_onLudeoFailure("no Ludeo data"); return; }
        m_onBeginRestore?.Invoke();                  // [Layer] selection-time: start scene load + suppress intros + RESET BOTH PAUSE FLAGS
                                                     // to an unfrozen baseline (§10.3), BEFORE the room opens.
                                                     // Safe to read restore buckets here: the play flow holds m_data from construction (§3.2).
        m_switch.LudeoFlow.InitRoom(m_data);         // [Layer] OpenRoom(forLudeo) → AddGamePlayer → onInitDone
    }
}
```

---

## 4. Two-Pass Apply (CR-006, no id-map)

CR-006 mandates two passes **so reference graphs survive spawn order**. With no SDK id-map, you build your
own key map from the stable-key attribute you captured.

- **Pass 1 — Create:** for each `objectType` bucket, spawn a type-only instance via the game's spawn
  function, read its **stable-key attribute** (`TryGetAttribute`), and add `keyMap[stableKey] = instance`.
  Singletons need no key (bucket `[0]` → the one instance).
- **Pass 2 — Apply + Resolve:** read non-reference attributes → setters; resolve reference attributes by
  looking the captured target key up in `keyMap`.

`keyMap` (`Dictionary<yourKey, GameObject>` `[Unity]`) is **per-Ludeo**, discarded after restore. If the
spawn graph has ordering needs (player before per-player UI), split Pass 1 into **1a (foundational)** /
**1b (dependent)**.

> **⚠️ A matched/persistent instance carries the PRIOR run's state — reset it before you apply.** Pass 1
> *spawns* fresh, so a new instance starts zero-initialized; but a **singleton** or a **scene-placed object you
> matched** (§9) is **never re-instantiated** — it's the same live object from the previous capture/replay.
> Apply only overwrites the fields you captured-and-reapply, so **every gameplay field you did NOT capture
> leaks across runs**: inventory/ammo, score & kill counts, active buffs/debuffs & status effects, ability
> cooldowns, combo/charge meters, animator/`Rigidbody` residue, equipped-weapon, dead/respawning flags — **and
> everything *visually* relevant that rides on the same persistent objects**: HUD/score readouts, world-space
> damage-number / VFX pools, active particle emitters, trail/decal residue, screen-shake, post-processing
> (vignette/bloom left on from a prior run). A scene reload clears scene-local visuals; anything parented to a
> `DontDestroyOnLoad` canvas/manager survives it. The **player singleton** (`DontDestroyOnLoad` / `static
> Instance` / a reference held on a `ScriptableObject` or manager that survives scene loads) is the canonical
> offender — its `Awake`/`Start` zero-init ran once, runs long ago. **Reset the matched/singleton instance to a
> clean baseline first** — call the game's own new-game/respawn reset (or null/zero the runtime fields and clear
> the persistent visuals by hand) **at the top of its restore apply** — *then* layer the captured snapshot on
> top. You own the reset that `Instantiate` would have given a fresh spawn for
> free. This is distinct from the integration-layer singleton's stale *pause flags* (§10.3) — same root cause
> (persistent state across runs), different victim (the **game's** player object vs the **layer's** flags).

> **Whole-pass vs per-instance.** When a *spawner* owns a collection, the cleanest shape (tank) is: pull the
> whole bucket once with `TryGetAllLudeoStateObjectByType` `[Layer]`, then for each spawned instance hand it
> its matching `LudeoStateObjectRestore` and **apply it from the restore driver's own call stack** with
> `RestoreLudeoStateOfObject(restore, cb)` `[Layer]`. A singleton just calls
> `GetAndRestoreLudeoStateOfObject(objectType, cb)` `[Layer]`.
>
> **⚠️ Apply synchronously from the driver — never defer to the spawned object's `Awake`/`Start`/`OnEnable`.**
> It is tempting to stash the entry on the instance (`SetLudeoRestoreState(r)`) and let the object pull-and-apply
> later from its own setup callback. **Don't.** Two reasons: (1) **Unity does not guarantee `Start()` (and can
> defer/skip `OnEnable`) for objects `Instantiate`d during a scene load/unload transition** — which is exactly
> the restore path (the captured scene loads while the old one unloads). The dropped-`Start` instance then never
> receives its state and sits frozen at its spawn defaults. This bites the **2nd+ replay in one session** hardest
> (the reload happens inside the same window); the first replay can mask it. (2) Self-application fires in
> nondeterministic order, so it cannot honor the two-pass contract (Pass 2 must run **after all** of Pass 1 for
> reference resolution, §6). The restore driver must **own** both passes. Do the create + state activation in a
> callback Unity *does* run synchronously at instantiation (`Awake`), and the **state apply** in the driver's
> Pass-2 sweep. Make the apply **idempotent** so that if a lifecycle callback does fire late and re-applies, it's
> harmless.

```csharp
// SINGLETON (player): inside its spawn/setup, in the play flow                    [Layer]
LudeoController.Instance.GetAndRestoreLudeoStateOfObject(LudeoPlayerKeys.OBJECT_NAME, RestoreLudeoState);

// COLLECTION (enemies): the spawner pulls the bucket, spawns type-only, and applies EACH ENTRY ITSELF —
// synchronously, in this loop. Do NOT stash the entry and wait for the instance's Start()/OnEnable (dropped
// on scene-transition spawns — see the callout above).
LudeoController.Instance.TryGetAllLudeoStateObjectByType(enemyObjectType, out List<LudeoStateObjectRestore> bucket); // [Layer]
for (int i = 0; i < bucket.Count; ++i) {
    EnemyController e = SpawnEnemy(/* type-only */);          // Pass 1: create (Awake activates it)   [Unity]
    LudeoController.Instance.RestoreLudeoStateOfObject(       // Pass 2: apply NOW, in the driver's call stack
        bucket[i], e.RestoreLudeoState);                     // [Layer] — e.RestoreLudeoState is idempotent
}
// Cross-entity reference rows resolve in a SEPARATE Pass-2 sweep, after every bucket's Pass 1 is done (§6).
```

> **Missing-key policy:** a Pass-2 `keyMap` miss is a **Pass-1 bug — fail loud, never substitute null** (§6).
> A missing *optional attribute* (`TryGetAttribute` → `false`) just keeps the spawn default (§1.4).

---

## 5. Per-Object Restore Patterns

Each is the `RestoreLudeoState(LudeoStateObjectRestore r)` callback — the **inverse of the `06 §10`
`OnStateDataUpdate` lambda**. Same `LudeoKeys` `[Layer]` constants. Read with `TryGetAttribute` `[SDK]`, then
write to the live object `[Unity]`.

```csharp
// 5.1 Player (singleton — bucket[0], no key)                                       [Layer] inverse of 06 §10.1
void RestoreLudeoState(LudeoStateObjectRestore r) {
    ResetToBaseline();                                       // [Unity] FIRST — the singleton kept the prior run's
                                                             // state (§4 callout); clear inventory/buffs/score/
                                                             // cooldowns/status AND residual visuals (HUD, VFX,
                                                             // post-fx) so unrestored fields don't leak in.
    r.TryGetAttribute(K.Position, out Vector3 pos);          // [SDK]
    r.TryGetAttribute(K.Rotation, out Quaternion rot);
    r.TryGetAttribute(K.Speed,    out float speed);
    r.TryGetAttribute(K.HP,       out int hp);
    transform.position = pos;  transform.rotation = rot;     // [Unity]
    m_currentSpeed = speed;    m_player.UpdateCurrentHP(hp);
    // r.TryGetAttribute(K.Velocity, ...) → DEFER to §7 (set after the Rigidbody is live)
}

// 5.2 Enemy (collection — entry handed in via SetLudeoRestoreState)               inverse of 06 §10.2
void RestoreLudeoState(LudeoStateObjectRestore r) {
    r.TryGetAttribute(K.RunId, out int runId);    keyMap[runId] = gameObject;       // Pass 1 key (§4/§6)
    r.TryGetAttribute(K.Position, out Vector3 pos);
    r.TryGetAttribute(K.HP, out int hp);
    r.TryGetAttribute(K.AiState, out int ai);
    transform.position = pos;  m_hp = hp;  m_aiState = (AiState)ai;
    // r.TryGetAttribute(K.TargetId, out int targetId) → resolve in Pass 2 via keyMap (§6)
}

// 5.3 Pickup / interactive                                                         inverse of 06 §10.3
void RestoreLudeoState(LudeoStateObjectRestore r) {
    r.TryGetAttribute(K.IsAvailable, out bool available);
    SetAvailable(available);     // "consumed" is a restored state, not a skipped spawn
}

// 5.4 Door / switch                                                                inverse of 06 §10.4
void RestoreLudeoState(LudeoStateObjectRestore r) {
    r.TryGetAttribute(K.IsOpen, out bool open);
    r.TryGetAttribute(K.OpenProgress, out float p);
    ApplyDoorState(open, p);     // restore mid-animation pose if the replay can pause there
}

// 5.5 Camera / viewpoint (singleton — bucket[0])                                    inverse of 06 §10.6
void RestoreLudeoState(LudeoStateObjectRestore r) {
    r.TryGetAttribute(K.CamPitch, out float pitch);
    r.TryGetAttribute(K.CamYaw, out float yaw);
    r.TryGetAttribute(K.OrbitDistance, out float dist);
    m_rig.SetAngles(pitch, yaw);  m_rig.SetDistance(dist);   // [Unity] rig control state, not the derived transform
    m_rig.SnapToTarget();        // [Unity] SNAP — no smoothing/lerp this frame, or the view eases in from a default (§7)
}
```

> **⚠️ Snap the camera to the captured view — never let a follow/`SmoothDamp` rig ease into it.** The
> viewpoint is the *first thing the viewer sees*, so a rig that spawns at a default orientation and
> `SmoothDamp`s toward its target over the next second means the replay **opens on the wrong view and slides
> into place** — visibly wrong even when every object is correctly restored. Restore the rig's control state
> (pitch/yaw/distance from `06 §10.6`) and force it to its final pose in one frame (disable smoothing for
> that frame, or call the rig's snap/teleport path) **before `Begin`**, while frozen (§10). This is the same
> "first frame must be the finished scene" invariant as §2.1(5), applied to the camera.

---

## 6. Cross-Entity References

The capture side stored the **target's stable key**, never a reference (`06 §4`). Restore resolves it in
**Pass 2** against `keyMap`:

```csharp
// Pass 1 populated: keyMap[capturedKey] = spawnedGameObject  (every collection entry)
// Pass 2:
r.TryGetAttribute(LudeoWeaponKeys.OwnerId, out int ownerKey);     // [SDK] the captured target key
if (keyMap.TryGetValue(ownerKey, out GameObject owner))           // [Unity]
    m_owner = owner.GetComponent<TankPlayer>();
else
    Debug.LogError($"restore: OwnerId {ownerKey} not in keyMap — Pass 1 bug");  // [Unity] FAIL LOUD
```

**Fail loud on a missing key** — a Pass-2 miss means Pass 1 didn't spawn/register that object; substituting
`null` produces a silently broken replay (enemy targets nothing, weapon orphaned). Every reference row in
`OBJECT_TRACKING.md`'s Cross-Entity References table must have a resolution step here.

---

## 7. Deferred Properties

Some values **revert or no-op if applied at spawn** because the subsystem that owns them isn't online yet.
Apply them **after Pass 2, before `Begin`**, in a recorded order:

| Property | Why it must defer | Apply after |
|---|---|---|
| `Rigidbody.velocity` / `angularVelocity` `[Unity]` | body inactive at spawn; first `FixedUpdate` can zero it | physics body active, before first sim step |
| `Animator` state / normalized time `[Unity]` | overwritten by the entry-state transition | `Animator` enabled + past entry |
| `NavMeshAgent` position/path `[Unity]` | must be on the NavMesh (use `Warp`) | agent placed on NavMesh |
| Ability / cooldown timers | a `Start`/`OnEnable` re-initializer resets them | re-initializers have run |
| Camera follow/look rig (smoothing) `[Unity]` | a `SmoothDamp`/lerp `LateUpdate` eases from the default toward target over several frames | player placed; snap the rig to the captured pitch/yaw/distance (§5.5), no smoothing that frame |

If deferred properties depend on each other, record the **queue order** in `RESTORATION_PLAN.md` — don't
infer it at runtime. The freeze (§10) holds until these are applied, so the player never sees the pre-defer
frame.

> **Note the dual hazard of `Start`/`OnEnable`.** Here the danger is a re-initializer that *runs* and clobbers
> a restored value (defer past it). The **opposite** danger — `Start()` that *doesn't run* for a
> scene-transition spawn, so an apply hung off it never fires — is why the apply itself must be driver-driven,
> not self-applied from a lifecycle callback (§4 callout).

---

## 8. Game-Definitions / World Restore

A replay must rebuild **the world the capture happened in** before (or alongside) spawning entities: level
layout, spawn definitions, world/environment state (time-of-day, weather, audio, world flags). The pattern:

- **Capture (creator):** store the level/config + world state as their **own state object(s)** — a singleton
  "definitions" `objectType`, optionally with **nested `LudeoStateComponent`** `[SDK]` scopes for sub-structs
  (`CreateOrGetStateComponent`). The tank does this in `LudeoController.StoreGameConfig` → `StoreGameDefinitions`
  `[Layer]` (creator flow only).
- **Restore (play):** `LudeoRestoredData` (§3.1) rebuilds it into `TrackedDefinitionsForLudeo` `[Layer]` by
  reading those buckets back (`TryGetAttribute` on the singleton + nested `LudeoStateComponentRestore` `[SDK]`,
  iterating per-type buckets for spawn lists). The game reads it via `GetLudeoTrackedDefinitions()` `[Layer]`
  and uses it to drive spawning — the play flow's `ReplayLudeo` equivalent of the creator's `StartLevel`.

```csharp
// play-flow spawn driver (inverse of the creator's level-start):                  [Layer]
LudeoTrackedDefinitions defs = LudeoController.Instance.GetLudeoTrackedDefinitions();
SpawnLevel(defs.gameConfig, defs.levelIdx);   // rebuild obstacles/level from restored config
SetMusic(defs.gameMusic);                     // (RE)START the captured track — the game's own scene-start music is suppressed during restore (callout below)
// then spawn + restore entities (§4) into that rebuilt world
```

**Ordering:** restore world/environment state **after** entities when a world flag could despawn or alter a
just-spawned entity; restore **level/spawn definitions before** entities (you need them to know *what* to
spawn). State the order in the plan. **Exclusion list:** UI history, local prefs/settings, graphics options —
don't restore them; record why.

> **⚠️ Restore the soundtrack explicitly — the game won't start it for you.** Games normally kick off level
> music from scene-start / `Start()` / `OnEnable`, and restore **suppresses exactly that class of
> start-of-run logic** (`10-plan-state-restoration.md` Step 3, gated on `IsInLudeoFlow`) so it can't clobber
> restored state. The side effect: the classic state restores perfectly but **the soundtrack never starts**
> — the reported "state restores but music doesn't" bug. So the world/definitions restore must **(re)start
> the captured track itself** (`SetMusic(defs.gameMusic)` above), reading the **active-track id** captured
> on the definitions/world singleton (§8 capture). Make it **idempotent** — don't stack a second track if
> one is already playing.
> - **Presence, not position.** Perfect reconstruction here only needs the *right track playing* —
>   restarting it **from the top is fine**. Resuming at the captured `AudioSource.time` is a **separate,
>   time-driven-only** concern (§10.5 / time-base-continuity, `06 §1.2`); don't conflate the two.
> - **Required for completeness on every integration, but NOT load-bearing.** The moment isn't *visibly*
>   wrong without it on the first frame, so assign its capture to a **later wave (2+)**, never Wave 1
>   (`8-map-game-objects.md` Step A5) — and do **not** drop it just because it's deferred.

> **⚠️ The world-identity key is restore step 1 — fail loud, and distinguish two failures.** Rebuilding the
> world needs the captured **world/level identity** (scene name, level index, chunk/room/seed — `phase 9`'s
> first capture requirement, *not* a phase-10/11 afterthought; restoration's very first step depends on it).
> When it's **absent or empty**, that is almost always **version skew** — the Ludeo was captured by a build
> *before* the identity attribute existed (capture re-samples every tick, so a fresh capture on the current
> build fixes it). When the key is **present but resolves to nothing** ("chunk 'X' not found"), that's a
> genuine resolver/content bug. **Emit a different message for each** so a stale-data re-capture isn't
> mistaken for a code bug:
> ```csharp
> r.TryGetAttribute(K.WorldId, out string worldId);                                   // [SDK]
> if (string.IsNullOrEmpty(worldId))
>     Debug.LogError("[Ludeo] restore: empty world-identity key — Ludeo predates the WorldId capture; RE-CAPTURE on the current build"); // [Unity]
> else if (!TryResolveWorld(worldId, out var world))
>     Debug.LogError($"[Ludeo] restore: world '{worldId}' not found — resolver/content bug, not version skew");
> ```
> **Corollary — you can only restore what capture wrote (§1.3).** Adding *or renaming* any capture attribute
> in `phase 9`/`10`/`11` **invalidates every previously captured Ludeo** for that attribute — there is no
> migration. After a capture-schema change, **re-capture** before testing restore.

> **Open-world / streaming:** the "definitions" are the persistent-world seed/region, not a level index. Re-bind
> entities by **persistent world id** across stream cycles and restore only the loaded neighborhood
> (`game-patterns/open-world-tracking.md`).

> **Procedural / non-deterministic assembly** (roguelike / procedural dungeon / wave-survival —
> `game-patterns/procedural-world.md`): the scene is a **container** and **loading it re-rolls content**.
> Restoring "definitions" here means **re-driving the generator from the captured `RunMetadata`** — the
> selection id (chunk/room/seed), sub-roll id (encounter/wave-set), progress cursor (wave/depth),
> scaling counter (combat level), **and — when the generator rolls the world *transform* (connector
> alignment + per-transition offset), not just the content — the resolved per-room placement (transforms
> / connector indices)** — and **suppressing the re-roll** so the builder reproduces the captured
> assembly instead of rolling fresh. The clean mechanism is the same `IsInLudeoFlow` `[Layer]` gate used
> for pre-match suppression: under it, `RandomChunk`/`GetEncounterByLevel`/wave-rolls **and the
> connector/placement roll** return the captured value. **Placement is a distinct layer:** suppress the
> layout/content roll and the room still lands at a fresh world transform unless you also replay its
> captured placement, so the absolute entity positions you restore via the two-pass point into the void.
> Restore the scaling counter **before** any post-restore spawn, and assemble the container **before**
> the two-pass entity restore (§4). "Load the scene" alone is **not** restoration for these games.

---

## 9. Pre-Existing-Object Reconciliation

A freshly loaded scene is **not empty** — editor-placed objects and `Awake`/`Start`-spawned content already
exist (the mirror of `06 §6` batch registration). For each batch-registered type, decide per entity:

- **Match** the captured bucket entry to the scene-placed instance by stable key, then apply properties — for
  objects the scene always places (the player start, fixed turrets, scripted props). **Don't double-spawn**, and
  **reset the matched instance to a clean baseline before applying** (§4 callout): unlike a Pass-1 spawn it was
  never re-instantiated, so any field you don't reapply (inventory, buffs, cooldowns, score, status flags — plus
  residual HUD/VFX/post-processing visuals) carries over from the prior run. A persistent **player singleton**
  (`DontDestroyOnLoad`/`static`) is the worst case — it survives even the scene reload.
- **Spawn** fresh from the bucket — for objects created dynamically during the captured run (enemies the
  spawner made, pickups dropped).

Specify the match key and the hook where matching runs relative to scene load (e.g. `OnSceneLoaded` `[Unity]`).
**Skip-when-not-in-play is automatic** — this whole path runs only because `IsInLudeoFlow` is `true`; the
creator flow uses `06 §6` batch *registration* instead.

> **⚠️ A live spawn *trigger* firing during play-forward re-creates what you restored.** Match-vs-spawn
> covers objects present at scene-load; it does nothing about the game's own spawner firing **after** the
> restore point. As the replay plays forward and the game re-enters a populating state — "combat started",
> a wave start, an elimination/aggro refill, a room-enter repopulate — that trigger spawns a **fresh** group
> **on top of** the live entities you restored (duplicates, wrong counts). **Gate the *trigger*** on
> `IsInLudeoFlow`; **never gate the spawn *primitive*** (`AIManager.Spawn` / the per-enemy `Instantiate`) —
> restore's Pass 1 calls it to place the restored entities, so gating the primitive breaks restore itself.
> *Trigger = the decision to populate; primitive = the low-level spawn.* **And distinguish re-create from
> advance:** suppress the trigger that re-fires the **already-restored** wave; a spawner that **advances**
> to the *next* wave from the restored cursor (`game-patterns/procedural-world.md §5`) is legitimate
> continuation — keep it. For a Ludeo that captures one bounded encounter, gating the wave triggers for the
> whole play flow is the simple correct choice; where the replay plays through later waves, gate only the
> re-create trigger.

> **⚠️ Restore invariants, not just objects — the ungated primitive replays its bookkeeping too.** The
> spawn primitive you were just told to keep ungated does more than place an object: the game's
> `Spawn` / inventory-add / door-open path also maintains **derived aggregates** that live on a *manager*,
> not on any tracked object — an alive-enemy tally, a remaining-objectives counter, a spawn budget. Pass 1
> calls that primitive **once per restored entity**, so each such side effect **replays N times**; and any
> creator step you *suppressed* (§10.1) may have been the very thing that **reset** that aggregate (its
> self-heal), which now nothing runs. Both drift the same counter in opposite directions — and a counter is
> invisible, so the replay *looks* perfect on the first frame while its win/lose condition is silently
> unreachable. **Don't try to make N incremental side effects sum correctly.** After reconstruction,
> **recompute each derived aggregate from ground truth** — e.g. `numEnemiesRemaining = count of restored
> still-killable entities` — rather than trusting the primitive's per-call accounting. This is the
> aggregate-level analogue of the §4 baseline reset: §4 recovers *per-object* state a fresh `Instantiate`
> would have zeroed; this recovers *manager-level* state the borrowed/suppressed flow would have maintained.
> **Count the right subset:** games overload one pipeline (structures, minions, props all as
> `EnemyController`), so a classification flag (`isStructure`, `IsMinion` — captured, or read off the
> restored `EnemyType`/bucket) must travel with any count the restore recomputes, or the recomputed total is
> wrong too. (Audit this for *any* borrowed path, not just spawn: whatever reconstruction re-drives, list its
> side effects and ask whether the snapshot already accounts for them or you're double-applying.)

---

## 10. Wait-For-Player, Freeze & Overlay (CR-010/011)

### 10.1 Freeze vs suppress during restore (CR-010)

The goal: nothing the player or AI does — and no live `Update`/`FixedUpdate` `[Unity]` — may overwrite the
restored snapshot before `Begin` starts recording. There are **two distinct mechanisms** that achieve this,
and choosing the wrong one for an **async** apply *deadlocks the restore*:

- **Freeze** — `Time.timeScale = 0f` `[Unity]`. Stops `Update` *and* `FixedUpdate`. Cheap, total, and the
  right guard around a **fully synchronous** apply (spawn + scalar writes all complete in one frame, no
  awaits). Unfreeze in the `RoomReady`/`Begin` path.
- **Suppress** — keep `timeScale = 1` but turn **off the things that mutate state**: player input, AI tick
  trees, cinematics/encounter-start, default-spawn teleports — all gated on `IsInLudeoFlow` `[Layer]` (the
  same seam §9 and `phase 11 Step 5` use). The sim runs (so `FixedUpdate`, coroutines, `UniTask` complete)
  but nothing drives the restored objects off their captured values.

> **⚠️ `Time.timeScale = 0f` does NOT run `FixedUpdate`.** If your apply **awaits a physics step**
> (`await WaitForFixedUpdate`), spawns via a **coroutine / `UniTask` / async registration**, or warps/bakes a
> **`NavMeshAgent`**, freezing the whole apply means those awaits **never resolve — the restore hangs forever**
> (not a crash; a silent deadlock). A synchronous apply doesn't hit this; an async one does. Know which yours is.

**The two apply shapes:**

| Apply is… | Mechanism | Order |
|---|---|---|
| **Fully synchronous** (`Instantiate` + setters, no awaits) | **Freeze** the whole apply | freeze (held from load) → apply → `Begin` → **unfreeze** |
| **Async** (awaits a physics step, coroutine/`UniTask` spawn, NavMesh warp/bake) | **Suppress** during create, **narrow freeze** for the scalar write | **suppress** + unfreeze → async spawn/reposition → **narrow freeze** → write scalar snapshot (HP, flags, AI vars — no awaits) → **unfreeze** → `Begin` |

The hybrid (async) order in full: **unfrozen-but-suppressed spawn/reposition → narrow synchronous freeze
around the no-await scalar snapshot write → unfreeze → `Begin`**. Here **suppression — not the freeze — is the
overwrite guard**; the narrow freeze only makes the multi-field scalar write atomic (no frame interleaves it).
Suppression holds until `Begin`, then lifts so the player drives the restored state.

> The tank's **structural freeze** is a third shape of the same idea: entities spawned **paused** and gameplay
> not "on" until `SetGameOn` runs from `RoomReady → BeginGameplay`. It's a form of suppression — the objects
> exist but don't tick — so it's async-safe.

> **⚠️ Settling is *visible*, not only a correctness concern.** §10.1 above treats async spawns as an
> *overwrite* hazard (suppress vs freeze). They are also a **presentation** hazard: an async apply streams
> spawns in over several frames, so if `NotifySceneReadyForRestore()` fires on "scene activated" the
> begin-gate releases and the player **resumes while entities are still popping in** — they watch the level
> assemble. Await the async spawns to completion (then the narrow scalar freeze) **before** signaling
> scene-ready, and keep the scene covered until then, so the paused overlay's background and the first
> interactive frame show the finished scene, not its assembly (§2.1 invariant 5).

### 10.2 Resume = `RoomReady → Begin`

```csharp
private void HandleLudeoRoomReady(/* LudeoSessionRoomReadyCallbackData */)          // [SDK] notification
{
    if (LudeoController.Instance.IsInLudeoFlow)                                      // [Layer] play flow only
        LudeoController.Instance.BeginGameplay(ResumeAndUnfreeze);                   // [Layer] → SDK records from restored state
}
```
`Begin` runs **after** apply (§2.1). For a synchronous apply, unfreeze in `Begin`'s callback
(`ResumeAndUnfreeze`); for an async apply, the apply itself already unfroze (§10.1) and `Begin` follows. Not
`ResumeGame`, not `PlayerReady` (doesn't exist), not a custom prompt.

### 10.3 Mid-play overlay (CR-011) — separate flag

While the player has the overlay open *during* playback, `AddNotifyPauseGame`/`AddNotifyResumeGame` `[SDK]`
freeze/resume the sim. Track the **CR-010 restore freeze and the CR-011 overlay pause on two separate flags**
(engine paused iff *either* set) — one shared flag lets a mid-play `ResumeGame` unfreeze a restore, or
`RoomReady` cancel a player-opened overlay. `AddNotifyReturnToMainMenu` `[SDK]` is a **CR-007 exit** (stop
tracking + `CloseRoom` + load menu). Full detail in
[`unity/CONSENT-AND-OVERLAY.md`](unity/CONSENT-AND-OVERLAY.md).

> **Reset both pause flags at the start of every restore — not only at bootstrap.** Two separate flags only
> work if both *start* `false` each run. When the layer is a persistent singleton (`ScriptableObject` service
> / `DontDestroyOnLoad` / `static`), its fields persist across Editor playmode sessions **and across replays
> within one session**, so a pause flag left `true` (e.g. the overlay / Ludeo-done `PauseGame` fired with no
> matching `ResumeGame` before the run ended) carries in and silently holds `timeScale = 0`. A *bootstrap*
> reset misses the replay→replay case (§2.2): a second play re-enters restore without re-running bootstrap —
> **and a shipped build's process restart doesn't save you, because no restart happens between replays.** So
> reset both flags + re-apply the unfrozen baseline at the **start of every restore** (in `onBeginRestore`),
> in addition to the bootstrap reset. See [`unity/CONSENT-AND-OVERLAY.md`](unity/CONSENT-AND-OVERLAY.md) §3.

### 10.4 "Restored Ludeo has dead input" — check three independent gates

When a restored Ludeo loads the scene, restores entities, and `Begin`s — but the player can't move or act —
it **looks like blocked input, and usually isn't.** Three independent gates each present identically; check
all three, not just the obvious one:

1. **Global input-enabled flag** `[Layer]`/`[Unity]` — restore suppresses input during the flow (§10.1). If
   the scene-load path's `EnableInput()` was skipped for the restored player, re-enable it at `Begin`.
2. **Per-entity control locks** `[Layer]` — restore typically (re)activates the player with controls
   disabled (e.g. `enableControls:false`) so it can't drive itself off the snapshot before `Begin`. Re-enable
   the movement *and* non-movement control handlers when gameplay starts.
3. **`Time.timeScale`** `[Unity]` — a frozen sim presents *exactly* like dead input: events may even be
   delivered, but nothing advances. A stale CR-011 pause flag (§10.3) or an unbalanced CR-010 freeze leaves
   `timeScale = 0` after restore. Log the resolved pause state at the unfreeze point to confirm.

A useful confirmation signature: after the restore unfreeze, log the inputs to the pause decision
(`restoreFreeze`, `overlayPause`, resulting `timeScale`). If `timeScale = 0` with `overlayPause = true` but
**no** `PauseGame`/`ResumeGame` callback fired this run, the flag is inherited stale state (§10.3), not
anything this run set.

---

## 11. Validation Checklist

**Flow & ordering**
- [ ] Restore is wired as `LudeoSelected → GetLudeo → LudeoRestoredData → OpenRoom(forLudeo) → AddGamePlayer → apply → RoomReady → Begin`.
- [ ] Scene/objects exist before apply; apply before `Begin`; `Begin` gated on `RoomReady` (§2.1).
- [ ] Play-flow re-entry (mid-capture **and replay→replay**) **completely** tears the prior run down
      first — `AbortGameplay` (session abort + stop tracking + close room + reset gameplay-active) +
      `ResetBeginGate` + reset both pause flags — and starts the new play **only in the teardown callback** (§2.2).

**Identity & two-pass**
- [ ] No SDK id-map / `ObjectId` matching — buckets + your stable key (CR-014); singletons `[0]`, collections keyed.
- [ ] Pass 1 spawns type-only + builds `keyMap`; Pass 2 applies attributes + resolves references.
- [ ] Matched/singleton instances (player) reset to a clean baseline before apply — gameplay **and** persistent
      visuals (HUD/VFX/post-fx) — so uncaptured state from the prior run doesn't leak in (§4/§9 callouts).
- [ ] Apply is driven **synchronously from the restore driver**, not deferred to a spawned object's
      `Start`/`OnEnable` (dropped for scene-transition spawns → frozen-at-default 2nd-replay bug, §4). Apply is idempotent.
- [ ] Missing reference key → **fail loud**; missing optional attribute → keep default (§1.4/§6).

**Coverage (the mirror)**
- [ ] Every entity/property in `OBJECT_TRACKING.md` has a `RestoreLudeoState` read using the **same `LudeoKeys`** + `objectType`.
- [ ] Cross-Entity References table fully resolved in Pass 2 (§6).
- [ ] Deferred properties applied after Pass 2, before `Begin`, in recorded order (§7).
- [ ] **If** camera view state was captured (`06 §10.6` — independently-controllable view): restored to the
      captured pitch/yaw/distance and **snapped** (no smoothing/lerp) so the first frame opens on the captured
      view, not a default the rig eases out of (§5.5/§7). (Fixed / player-derived cameras capture nothing here.)
- [ ] World/level definitions restored to drive spawning; environment after entities; exclusion list recorded (§8).
- [ ] Scene-placed objects reconciled match-vs-spawn — no double-spawn (§9).
- [ ] **Derived aggregates recomputed from ground truth** after reconstruction (alive-enemy tally, objective
      counter, spawn budget) — not trusted to sum from the ungated primitive's per-call side effects; the
      count uses the right subset (classification flags travel with it) (§9).

**Freeze & overlay**
- [ ] Restored state protected during apply (CR-010): **synchronous apply → freeze whole apply**; **async
      apply (awaits a physics step / coroutine / `UniTask` / NavMesh warp) → suppress via `IsInLudeoFlow` +
      narrow freeze only for the scalar write** — never `timeScale = 0` around an awaited spawn (deadlock, §10.1).
- [ ] Apply is never preceded by an unfreeze (no live frames mid-restore); resume via `RoomReady → Begin`,
      not `ResumeGame`/`PlayerReady`.
- [ ] CR-010 freeze and CR-011 overlay pause on separate flags (§10.3).

---

## Calls used in this doc

**`[SDK]`** (authority: [`12-SDK-API-REFERENCE.md`](12-SDK-API-REFERENCE.md)):
`LudeoSession.{GetLudeo, AddNotifyLudeoSelected, AddNotifyRoomReady, AddNotifyPauseGame, AddNotifyResumeGame,
AddNotifyReturnToMainMenu}` · `LudeoDataReader.GetStateObjects` · `LudeoStateObjectRestore.{TryGetAttribute,
ObjectType, ObjectId, CreateOrGetStateComponent}` · `LudeoStateComponentRestore.TryGetAttribute` ·
`LudeoRoom.{OpenRoom, AddGamePlayer, CloseRoom}` · `LudeoGameplaySession.Begin`. Restore reads mirror the
capture-side `LudeoStateObject.SetAttribute`.

**`[Layer]`** (REFERENCE-ARCHITECTURE + the restore additions in §3):
`LudeoController.{GetAndRestoreLudeoStateOfObject, RestoreLudeoStateOfObject, TryGetAllLudeoStateObjectByType,
GetLudeoTrackedDefinitions, BeginGameplay, IsInLudeoFlow, OpenLudeoGallery}` · `LudeoFlowSwitch.{SwitchToPlay,
SetFlags}` · `ILudeoFlow`/`LudeoPlayFlow.{RestoreLudeoStateOfObject (both overloads),
TryGetAllLudeoStateObjectByType, StoreGameDefinitions}` · `LudeoRestoredData` (`LudeoStateObjectsLookup`,
`TrackedDefinitionsForLudeo`) · `LudeoRestoredGameConfig.RestoreGameDefinitionsForLudeo` ·
`LudeoTrackedDefinitions`.

**`[Unity]`:** `Time.timeScale` · `Instantiate` · `Transform`/`Vector3`/`Quaternion` · `Rigidbody` ·
`Animator` · `NavMeshAgent.Warp` · `SceneManager` · `Debug.LogError`/`LogWarning`.

---

**Next steps:** plan the restore with [`../10-plan-state-restoration.md`](../10-plan-state-restoration.md)
(mirror `OBJECT_TRACKING.md` → `RESTORATION_PLAN.md`), then wire the flow with
[`../11-implement-restoration-flow.md`](../11-implement-restoration-flow.md) (the SDK-orchestration half) and
fill the data read-back with
[`../12-implement-state-reconstruction.md`](../12-implement-state-reconstruction.md) (the row-for-row inverse
of the `phase 9` capture).
