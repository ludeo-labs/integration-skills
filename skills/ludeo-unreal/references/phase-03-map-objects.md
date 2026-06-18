# Phase 03 — Map Game Objects (slice)

## 1. Goal / Purpose

Identify and catalogue every game object and attribute the integration will track — for the
**curated slice only**. This phase produces an object→attribute table (discovery artefact) that
Phase 04 implements. No code is written here; the output is a confirmed, integrator-approved
specification.

**Deliverables:**
- Entity list for the curated slice (player + slice-relevant AI/objects), confirmed by integrator
- Object → attribute table with tracking strategy and typed-attribute choices per entity
- Blob-use justifications (if any)
- Coverage cross-checked against `references/game-patterns/<genre>.md` + `common.md`

---

## 2. Inputs (Input Contract)

**Required from prior phases:**
- `.ludeo/integration.json` with `currentPhase: 3`, Phase 02 completed
- Plugin scaffold from Phase 02 (subsystem + component, ActivateSession working)
- Active room with at least one player added (Phase 02 lifecycle)

**From CODE_MAP (`.ludeo/code-map.json`):**
- `entity_types` — all actor/pawn/object classes identified in Phase 01
- `lifecycle_hooks` — where gameplay begins (for knowing when to start tracking)
- `event_systems` — delegates and message buses (for entity spawn/destroy events)

**From intake:**
- `integration.json → curatedSlice` — which map/scenario defines the slice scope
- `integration.json → intake.entityTiers.P0` — priority-zero entities that must be tracked
- `integration.json → intake.visiblePlayerState.firstFrameRequired` — what must be visible
  on the first frame of Player Flow playback (used to drive property selection)

---

## 3. Steps

**Scope:** Only analyze entities and properties relevant to the **curated slice** (from
`integration.json → curatedSlice`). Full entity discovery across all maps is deferred to
Phase 06 (enrichment).

### 3.1 Discover Curated Slice Entity Types

Identify entities that appear in the curated slice's map/scenario. Focus on what matters for
that specific gameplay moment — not everything in the game.

| Entity Category | How to Find | Examples |
|----------------|-------------|---------|
| Player-controlled | Grep for `DefaultPawnClass`, `APlayerController::GetPawn`, possessed pawns | FPS character, racing car, RTS commander unit |
| AI-controlled | Grep for `AAIController` subclasses, behavior tree usage, `AIPerceptionComponent` | Enemy soldiers, patrol guards, boss NPCs |
| Vehicles | Grep for `UVehicleMovementComponent`, `AWheeledVehiclePawn`, vehicle classes | Cars, tanks, aircraft, mounts |
| Projectiles | Grep for `AProjectile`, `UProjectileMovementComponent`, spawned bullet/missile classes | Rockets, grenades, arrows |
| Interactables | Grep for interaction interfaces (`IInteractable`, `UInteractionComponent`), `bHidden` toggles | Doors, switches, elevators, destructibles |
| Collectibles/pickups | Grep for pickup classes, item spawners, objective item drops | Weapons, ammo boxes, health packs |
| Game-state objects | Grep for `AGameState` properties, objective actors, zone/territory actors | Capture points, payload carts, score zones |
| RTS/strategy units | Grep for unit classes, squad managers, formation systems | Infantry, buildings, turrets |

### 3.2 Classify Entities by Tracking Strategy

For each discovered entity type, classify:

| Strategy | When | What to Track | Write Frequency |
|----------|------|--------------|-----------------|
| **Persistent** | Always alive during gameplay (player, game state) | Transform + key properties every frame | Per-tick or delta threshold |
| **Transient** | Spawns and despawns (NPCs, projectiles, pickups) | Spawn event + transform while alive + despawn event | Per-tick while alive |
| **Static-but-stateful** | Doesn't move but changes state (doors, switches) | State changes only (open/closed, on/off) | On state change event |

### 3.3 Identify Properties to Track Per Entity

For each entity type, discover trackable properties:

| Property Type | How to Find | Relevance |
|--------------|-------------|-----------|
| Transform (position + rotation) | `GetActorTransform()`, `GetActorLocation()` | Universal — needed for all moving entities |
| Health/damage state | Grep for health attributes, `UAbilitySystemComponent`, damage events, `HealthComponent` | Visual: shows damage/death |
| Equipped item/weapon | Grep for weapon classes, equipment components, inventory slots | Context: what the player is using |
| Animation/visual state | Anim montages, state machine states, `bIsCrouching`, `bIsAiming` | Visual: posture and actions |
| Alive/visible | `bHidden`, `IsPendingKillPending()`, death state, respawn logic | Critical: don't track dead/hidden entities |
| AI state (for bots/NPCs) | Grep for AI controller properties: focus target, movement status, behavior tree state, perceived enemies | Player Flow: meaningful bot behavior during playback |
| Game-mode-altering states | Grep for player-triggered mode switches: ability on/off, stealth/combat toggle, vehicle entry/exit, ability activations, stance changes | Critical: these change gameplay fundamentally, not just visually |
| Game-specific state | Score, ammo, objectives, capture progress, resource counts | Context: game progression |

#### DOREPLIFETIME Scan (HARD CHECKLIST — not a heuristic)

For each tracked entity class, **grep `GetLifetimeReplicatedProps`** and extract the FULL list
of replicated properties. Present this complete list to the human before finalizing the property
set. Do NOT cherry-pick "obvious" properties from code exploration — the scan is the discovery
mechanism.

```
# For each tracked class:
grep -A 50 "GetLifetimeReplicatedProps" <class>.cpp
# Extract all DOREPLIFETIME / DOREPLIFETIME_CONDITION entries
```

Why: The agent consistently picks familiar properties (Health, Transform) and skips non-obvious
ones that are replicated for a reason. Properties like `bIsAbilityActive` (special mode),
`bIsInVehicle` (vehicle entry), or `CurrentPhase` (game phase) are replicated because they
matter — and they'll be missed without a systematic scan.

**Blueprint-only projects:** Use the **BP Inspector tool** (see SKILL.md → Available Tools) to
discover BP variable names, types, defaults, replication flags, and components. This replaces
guesswork and runtime property dumps. If the BP Inspector report doesn't exist, fall back to a
diagnostic property dump on first entity registration using `TFieldIterator<FProperty>`.

**Setting SaveGame flags:** After the human approves the curated variable list for state
tracking, use `RunBPInspector.bat set-savegame` to flag each variable headlessly. Re-run
`inspect` to verify. Do NOT create console commands or ask the human to manually check boxes.

### 3.4 Discover Entity Lifecycle Events

For transient entities, find the spawn/despawn hooks:

| What | How |
|------|-----|
| Spawn events | Grep for `SpawnActor`, `OnActorSpawned` delegate, spawner classes, pool managers |
| Death/destroy | Grep for `Destroy()`, `OnDestroyed` delegate, death handlers, `EndPlay` |
| Visibility changes | Grep for `SetActorHiddenInGame`, `bHidden` modification |
| Possession/control changes | `OnPossessedPawnChanged`, `OnNewPawn` delegates |

These hooks are needed in Phase 04 to register/unregister WritableObjects for transient entities.

### 3.5 Verify Module API Exports

For every game class method the plugin will call, verify it has the module's API export macro
(e.g., `LYRAGAME_API`). Methods without it cause unresolved external symbol linker errors.

Record any missing exports in `.ludeo/export-check.md` — they must be patched before Phase 04
implementation begins.

---

## 4. Questions to Ask the Human

Present curated slice entity discovery (from 3.1–3.3) as a table. **Keep it lean — these are
the only entities we need for the MVP.**

1. **"Here are the entities I found in the curated slice [map name]. Confirm this list for
   tracking:"** — Present the table. Default: player + AI enemies for FPS/TPS. The integrator
   trims or adds.

2. **"For each, here are ALL replicated properties (from DOREPLIFETIME scan). Transform is
   always included. Which additional properties matter for playback?"** — Present the FULL
   replicated property list from Section 3.3, not a cherry-picked subset. Let the human trim.

3. **"Are there any player-triggered states that dramatically change gameplay? (e.g., ability
   on/off, stealth/combat toggle, vehicle entry, ability mode switches)"** — These often appear
   as replicated booleans/enums and are easy to miss. If the human identifies any, add them to
   the tracked property set.

4. **"Does the curated slice have a warmup/countdown phase before gameplay starts?"** — If yes,
   Player Flow (Phase 04) must skip it. Gather how the phase system handles skipping.

5. **Write frequency: default to every tick** for MVP. Do NOT ask unless the human raised
   performance concerns.

---

## 5. Patterns to Apply

### 5.1 Entity-Type Classification Table (Output Format)

Produce this table for integrator approval before Phase 04 begins:

```
| Entity Type      | Class               | Strategy             | Properties to Track                    | Typed vs Blob |
|------------------|---------------------|----------------------|----------------------------------------|--------------|
| Player Character | AMyPlayerCharacter  | Persistent           | Transform, Health, EquippedWeapon      | Typed         |
| AI Enemy         | AMyEnemyCharacter   | Transient            | Transform, Health, IsAlive             | Typed         |
| Door             | AMyDoor             | Static-but-stateful  | IsOpen                                 | Typed         |
| ...              | ...                 | ...                  | ...                                    | ...           |
```

### 5.2 Typed Attributes vs Blob

**Default to typed attributes.** Use SDK-native types (`FTransform`, `float`, `bool`, `int32`,
`FString`) for every attribute where the type is known at capture time. The SDK reads these back
by name; typed attributes are schema-validated, diffable, and compatible with version-gating
(see Phase 04 §5.10).

**Blob** (raw byte buffers) is justified ONLY when the value is genuinely opaque at capture
time — e.g., a proprietary compressed save-game blob whose internal schema is maintained by
external tooling and cannot be broken into named fields. If you are considering blob for
convenience (to avoid enumerating fields), that is not a valid justification; enumerate the
fields.

Document every blob decision in the table with the justification column filled in.

### 5.3 Cross-Checking Against Genre Tracking Checklist

After producing the object→attribute table, load the matching
`references/game-patterns/<genre>.md` **Tracking Checklist** and `references/game-patterns/common.md`.
Check every entry on both lists against the produced table:

- If a checklist item is covered → mark it covered.
- If a checklist item is absent → flag it for the integrator. It may be intentionally deferred
  (fine, note it) or genuinely missed (add it).

The matching genre checklist is a state-coverage validation list for the curated slice here; the
full-game pass is in `references/phase-07-expansion.md`.

---

## 6. Output Contract

```
Produces:
  objectAttributeTable: markdown   — Entity → attribute table, approved by integrator,
                                     with strategy + typed/blob column
  exportCheckMd: updated           — Any missing GAMENAME_API exports recorded for Phase 04
  decisions[]: Decision[]          — Appended to integration.json (which entities, which attrs,
                                     which strategy, restoration approach)
  phase03Complete: bool            — true only after integrator approves the table
```

This phase produces NO code. Phase 04 consumes the approved table as its primary input.

---

## 7. ✅ Success Criteria

- [ ] Object → attribute table produced (for the curated slice)
- [ ] Typed attributes chosen by default
- [ ] Blob use (if any) justified as genuinely opaque
- [ ] Coverage cross-checked against the matching `references/game-patterns/<genre>.md` + `common.md`

---

## 8. Common Mistakes

### 8.1 Cherry-picking "obvious" properties instead of running the DOREPLIFETIME scan

Agents consistently pick Transform and Health and skip everything else. The DOREPLIFETIME scan
is mandatory — run it and present the full list. Properties like `bIsAbilityActive`,
`bIsInVehicle`, and `CurrentPhase` are replicated for a reason and will break playback if missed.

### 8.2 Scoping discovery too broadly

This phase covers the **curated slice only**. Do not discover entities from all maps, all game
modes, or all possible scenarios. Full discovery is Phase 06 (enrichment).

### 8.3 Tracking everything visible

Not everything needs tracking. Ambient NPCs, decorative particles, background vehicles, and
entities far from the player don't contribute to meaningful playback. Use the entity
classification from Section 3.2 and confirm with the integrator.

### 8.4 Choosing blob for convenience

Blob attributes hide schema problems and break version-gating. Default to typed. Only use blob
when the value is provably opaque to the integration layer.

### 8.5 Deferring export-check to Phase 04

Module API export gaps discovered late block compilation. Identify them here in Phase 03 and
record them so Phase 04 can start with a clean build.

### 8.6 Skipping genre tracking checklist cross-check

The genre checklist exists because integrators reliably miss genre-specific state (e.g., ability
cooldowns in action games, ammo types in shooters, objective progress in objective-based modes).
The cross-check is not optional.
