# Phase 04 — Tracking & Restore (slice)

## 1. Goal / Purpose

Implement state tracking (write side) AND Player Flow restoration (read side) for the **curated
slice only**. This phase produces a working end-to-end integration: Creator Flow captures state
per-tick; Player Flow restores and replays it. The approved object→attribute table from Phase 03
is the primary input — nothing is re-discovered here.

**Deliverables:**
- WritableObject registration and per-frame state writing (Creator Flow)
- DataReader state restoration and entity reconstruction (Player Flow)
- LudeoSelected callback → state restoration → gameplay resume
- Integrator-confirmed end-to-end playback (human verifies positions restore)

### Output Contract

```
Produces:
  tddSection3: markdown          — State Tracking + Player Flow section in TDD
  creatorFlowWorking: bool       — State writes during gameplay, visible in highlight inspector
  playerFlowWorking: bool        — NOT stubs. Actual read/apply code:
                                    ApplyPlayerState() restores position/health/weapon
                                    ApplyBotStates() restores AI position/state
                                    Player Flow playback shows entities at correct positions
  decisions[]: Decision[]        — Appended to integration.json
```

**CRITICAL:** `playerFlowWorking` means FUNCTIONAL code, not stubs. `ApplyPlayerState()
{ /* Phase 8 */ }` is NOT acceptable. Phase 04 is NOT complete until Player Flow playback
actually restores entity positions.

---

## 2. Inputs (Input Contract)

**Required from Phase 03:**
- Integrator-approved object→attribute table (entity types, strategies, properties, typed/blob)
- `.ludeo/export-check.md` — any missing `GAMENAME_API` exports resolved before code is written
- `integration.json → curatedSlice.restorationApproach` — reconciliation or manual

**Required from prior phases:**
- `.ludeo/integration.json` with Phase 03 complete
- Plugin scaffold from Phase 02 (subsystem + component, ActivateSession working)
- Active room with at least one player added (Phase 02 lifecycle)

**From CODE_MAP (`.ludeo/code-map.json`):**
- `entity_types` — all actor/pawn/object classes identified in Phase 01
- `lifecycle_hooks` — where gameplay begins (for knowing when to start tracking)
- `event_systems` — delegates and message buses (for entity spawn/destroy events)

**From intake (wired into the pre-flight checklist at §7):**
- `intake.entityTiers.P0` — every P0 entity must have a registration path
- `intake.visiblePlayerState.firstFrameRequired` — must have a restoration path planned
- `intake.dynamicPhaseMetadata.phaseEnums` — phase enums that change during slice
- `intake.playbackUXBar.gatesToSuppressInPlayerFlow` — gates to suppress (briefing VO, etc.)
- `intake.captureTimingRules.roomOpenTrigger` / `roomCloseTrigger`
- `intake.eventDrivenScriptedSystems` — Group 5 trail + loadBearing subsystems

---

## 3. Steps

### 3.1 Add State Tracking to Existing Component

Extend the `ULudeoIntegrationComponent` from Phase 02 — do NOT create a new component.

Add to the component header:
```cpp
// Tracked entity info
struct FTrackedEntityInfo
{
    FLudeoWritableObject WritableObj;
    FString ObjectTypeName;
    bool bTrackTransform = true;
    // Additional flags per entity type — generated based on integrator's choices
};

// State tracking
TMap<TWeakObjectPtr<AActor>, FTrackedEntityInfo> TrackedEntities;

void RegisterTrackedEntities();
void UnregisterTrackedEntities();
void RegisterEntity(AActor* Entity, const FString& ObjectTypeName, bool bBindToPlayer = false);
void UnregisterEntity(AActor* Entity);
void WriteTrackedState();

// Reconstruction
void ReadAndApplyState(const FLudeoReadableObject& ReadableObj, AActor* TargetActor, const FTrackedEntityInfo& Info);

// Entity filtering — the skill generates this based on analysis
bool ShouldTrackEntity(const AActor* Actor) const;
```

Note: The map key is `AActor*` not `APawn*` — not all tracked entities are pawns (doors,
vehicles, game state objects).

### 3.2 Registration Timing

Register objects AFTER BeginGameplay is confirmed (the N-way gate from Phase 02 has passed):

```
BeginGameplay → RegisterTrackedObjects → start writing in Tick
EndGameplay → UnregisterTrackedObjects → stop writing
```

### 3.3 Cleanup

When the room closes or a tracked NPC dies/despawns:
- Call `RoomWriter.DestroyObject()` for that object
- Remove from the tracking map
- Hook into death/destroy delegates for automatic cleanup

### 3.4 Creator Flow: WritableObject Registration + Per-Tick Write

Implement §5.1 and §5.2 patterns. Compile. Verify writes appear in logs (or highlight
inspector).

### 3.5 Player Flow: LudeoSelected → GetLudeo → ServerTravel

Wire the `LudeoSelected` callback (§5.6). Read GameMetadata. Travel to the curated slice map.
Compile.

### 3.6 Player Flow: Detect Pending Ludeo → Read State → Apply to Entities

In `BeginPlay`, detect pending Ludeo. Read and apply state using the read-side patterns (§5.4,
§5.5). Compile.

### 3.7 End-to-End Verification (Human Test — HARD GATE)

Ask the human to capture a highlight and play it back. Confirm entity positions restore.
See §3.13 for the exact test script. Do NOT mark Phase 04 complete until this passes.

### 3.8 Mandatory Execution Order (STOP)

**Do NOT implement Creator Flow and Player Flow as separate "phases" that can be deferred.** They are both required for Phase 04 completion. Implement them in this exact sequence:

1. **Creator Flow** — WritableObject registration + per-tick state writing → compile → verify writes in logs
2. **Player Flow subsystem** — LudeoSelected callback → GetLudeo → read GameMetadata → ServerTravel → compile
3. **Player Flow component** — detect pending Ludeo in BeginPlay → read state → apply to entities → compile
4. **End-to-end test** — human captures highlight → plays it back → confirms entity positions restore
5. **ONLY THEN** → Phase 05

If step 3 is blocked (can't apply health, can't travel to correct map, can't spawn entities), **ask the human**. Do NOT:
- Stub it with `// TODO: apply state` or `/* Phase 8 */`
- Log "deferred to testing" and move to Phase 05
- Claim "the entry point exists, it'll connect when tested"

These are the exact rationalizations that have caused this failure pattern repeatedly. Compilation does not mean Player Flow works. Stubs compile. The agent's compile-fix loop will succeed with stubs, and that success feeling will override this warning unless you follow the execution order above.

### 3.9 Pre-Flight Checklist (STOP)

Before writing any state tracking or Player Flow code, confirm:

- [ ] Phase 02 plugin compiles cleanly (both plugin-disabled and plugin-enabled builds pass)
- [ ] `.ludeo/export-check.md` is up to date — any new game classes accessed for state tracking have `GAMENAME_API`?
- [ ] Curated slice entity list confirmed by integrator (from §4 questions)
- [ ] Restoration approach decided: reconciliation or manual? (from `integration.json → curatedSlice.restorationApproach`)
- [ ] **GameMetadata writable object is planned** — MapName, BotCount, and any game-specific metadata (experience asset, difficulty, etc.) will be written at room open. Without this, Ludeo creation from highlights will fail silently.
- [ ] **Creator Flow vs Player Flow branching is planned** — `CreateWritableObjects()` and `RegisterActionListeners()` are Creator Flow ONLY. Player Flow reads state but does NOT write.

**Intake answers wired here (from `integration.json → intake`, captured at Phase 00 kickoff — see `phase-00-intake.md`):**

- [ ] **Every P0 entity from `intake.entityTiers.P0` has a WritableObject registration path planned.** Missing one = Phase 04 cannot complete. (Example: ActionGame vehicles were a P0 that the agent initially deferred as "transient.")
- [ ] **Every item in `intake.visiblePlayerState.firstFrameRequired` has a restoration path planned.** For each item (mask, weapon equipped, ammo, health bar, etc.), identify the concrete code path that applies it during Player Flow. Stubs are not acceptable. (Example: ActionGame ability state required `FBoolProperty` reflection + explicit OnRep UFunction call.)
- [ ] **Every phase enum from `intake.dynamicPhaseMetadata.phaseEnums` where `changesDuringSlice: true` is written per-tick to GameMetadata.** Every one where `mustRestore: true` has a Player Flow read-and-apply path. (Example: ActionGame MissionState/CombatPhase/IntensityScale — captures in Combat playing back as Stealth broke the demo.)
- [ ] **Every gate in `intake.playbackUXBar.gatesToSuppressInPlayerFlow` has a suppression hook planned.** For each (briefing VO, intro cinematic, warmup phase, ability-activate montage), the agent has identified where to gate it behind the Player Flow path. Not diagnosed at debug time.
- [ ] **Room open/close logic gates on `intake.captureTimingRules.roomOpenTrigger` / `roomCloseTrigger`.** Minimum-interesting-state threshold from `minimumInterestingStateThreshold` is documented in the TDD so empty/early captures aren't debugged as bugs.
- [ ] **Pause detection is planned.** Component sets `bTickEvenWhenPaused = true`. `TickComponent` polls `GetWorld()->IsPaused()` and sends `PauseLudeo` / `StartNoneLudeable` on transitions. `WriteTrackedState()` is guarded with `if (bWasPaused) return;`. See §5.8.
- [ ] **Every `trail + loadBearing` subsystem has a capture AND replay path planned.** From `intake.eventDrivenScriptedSystems` (Group 5) and/or Phase 01's `stateClassification.trail`. For each entry: the capture hook is identified (usually a delegate like `OnMilestonePassed`), the replay hook is identified (usually the game's own notifier like `NotifyClientPassedMilestone`), and both are in the Phase 04 implementation plan. Trail replay runs BEFORE snapshot state application during Player Flow. See §5.9. **Trails are Phase 04 work — not Phase 06 enrichment.** If a load-bearing trail subsystem is missing from this plan, Phase 04 is not ready.

If any item is unchecked — including missing intake fields — go back and complete it before writing code. If an intake answer is `"unknown"`, resolve it with the human now (this is the phase that gates on it).

### 3.10 Player Flow Read-Side Implementation (REQUIRED, NOT OPTIONAL)

This is NOT deferred to a later phase. Implement the read side with the same rigor as the write side:

1. **Detect Player Flow in BeginPlay** — Check `Subsystem->GetPendingLudeoID().IsEmpty()`. If non-empty, this is Player Flow.
2. **Skip pre-gameplay phases** — See §5.7. Fast-forward or suppress warmup/countdown.
3. **Pause the game** — Prevent damage/AI during restoration (see §5.4).
4. **Read GameMetadata** — Get MapName (already on correct map via ServerTravel), BotCount, etc.
5. **Read player state** — Use `ReadableObject` with scoped guards to read Transform, Health, Weapon for the player entity. Apply via `TeleportTo`, health setter (or GAS `SetNumericAttributeBase`), weapon equip.
6. **Read bot/AI states** — For each AI entity in the curated slice, read Transform + Health + AI state. Apply to spawned AI actors (wait for game's spawn system if needed — see §5.5).
7. **Unpause and BeginGameplay** — After all state is applied, unpause the game and call `BeginGameplay`.

**Each step above must produce functional code, not stubs.** If a step is blocked (e.g., can't figure out how to set health), ask the human — don't stub it.

### 3.11 Compile-Fix Protocol

Follow the same protocol from Phase 02:
- Build after each new source file (.h then .cpp)
- If you cannot compile locally, request the human to build
- Do NOT skip the compile-fix loop

### 3.12 Phase Completion Gate (STOP)

Phase 04 is NOT complete until ALL of these are true:

- [ ] **HARD GATE: Player Flow read side is IMPLEMENTED (not stubs)** — `ApplyPlayerState()` restores position/health/weapon, `ApplyBotStates()` restores AI state. Stubs (`/* Phase 8 */`) are NOT acceptable for Phase 04 completion.
- [ ] **Functional verification (human tests):** Human has run the game, captured a highlight, played it back via Player Flow, and confirmed positions restore correctly. See §3.13. Compilation alone does NOT mark Phase 04 complete.
- [ ] Creator Flow writes state during gameplay (check highlight inspector for DataWriter activity)
- [ ] GameMetadata writable object created at room open with MapName
- [ ] **First 5 seconds of Player Flow match `intake.playbackUXBar.firstFiveSecondsMustFeel`** — human confirms no unwanted VO, no equip delay beyond `maxInputLockMs`, no briefing. This is a separate check from "positions restore correctly." A Ludeo can restore state perfectly and still fail the UX bar (see ActionGame setup VO incident).
- [ ] **Game pauses when Ludeo overlay appears** — SDK triggers `OnPauseGameRequested`, game responds via discovered pause mechanism, state writing stops. Game resumes when overlay closes. Human confirms by triggering overlay during gameplay.
- [ ] **Level BP does not re-execute early-phase logic on restore.** No stale briefing/setup VO. No NPCs from earlier phases re-spawning. No tutorial/first-time prompts firing mid-gameplay. If any of these surface, a progression trail was missed — go back to §5.9. This is the signal that `trail + loadBearing` systems have been captured and replayed correctly.
- [ ] **Capture is NOT gated on room close** — highlights are captured with the room OPEN, during gameplay. Do NOT require the human to play to match end or close the room before capturing.

### 3.13 Functional Verification (HARD GATE — after compile passes)

Compilation is necessary but NOT sufficient. After the compile-fix loop passes, **ask the human to run these tests** (the agent cannot run the game):

Tell the human:
> "Phase 04 code compiles. Before we can mark this phase complete, please run these verification steps and report results:
> 1. **Creator Flow:** Play the curated slice. Check logs for DataWriter activity (or use highlight inspector). Is state being written?
> 2. **Capture:** Press F9 **mid-gameplay, while the room is open** — the highlight is created with the room still open. You do NOT need to play to battle/match end or close the room for a highlight to be created.
> 3. **Player Flow:** Play back the highlight. Does the player spawn at the correct position (not default spawn point)? Is health restored? Are AI entities present and positioned?
> 4. Report back what worked and what didn't."

**Capture is NOT gated on room close.** One highlight = one room cycle as a *design* rule (`learnings/common-mistakes/room-is-not-highlight.md`), but capturing a highlight happens with the room OPEN, during gameplay. Agents repeatedly write "play to the end so the room closes, then capture" into test checklists — that is wrong. Playing through to room close is a *separate* room-close-path test, not how you capture.

**Do NOT mark Phase 04 complete until the human confirms Player Flow restores positions.** If they report issues, debug the read side before proceeding.

---

## 4. Questions to Ask the Human

1. **"Does the curated slice have a warmup/countdown phase before gameplay starts? If so,
   Player Flow should skip it."** — The answer is always "yes, skip it" for Player Flow.

2. **"How does the game's phase system handle phase skipping? Can we call
   `StartPhase(Playing)` directly, or does warmup need to complete first?"** — Determines
   implementation approach (§5.7).

3. **"What UI/HUD elements appear during warmup that would look wrong during Player Flow?"**
   — Identifies what needs to be suppressed.

4. **"Does health restoration go through GAS, or is it a direct property setter?"** — GAS
   health requires `SetNumericAttributeBase()` or a gameplay effect; this can't be stubbed.

5. **"Does the curated slice pre-populate inventory, or are items acquired during play?"** —
   If acquired during play, a fresh Player Flow spawn starts with an EMPTY inventory; you must
   re-create each item via the game's own add-item function (see §5.4).

---

## 5. Patterns to Apply

### 5.1 WritableObject Registration (Generic Pattern)

#### Mandatory First Object: GameMetadata

Before registering any entities, create a **GameMetadata** writable object at room open time.
This stores the context Player Flow needs to reconstruct the scene (which map, which experience,
bot count, etc.):

```cpp
// Created at room open — BEFORE entity registration.
// ObjectType MUST be a class path, or left empty to default to the anchor object's class —
// NEVER a custom label like "GameMetadata". A non-class-path ObjectType crashes the
// SaveGameManager read path in Player Flow. ObjectType is a shared CATEGORY (all objects of a
// class share it), not a per-instance id. See learnings/common-mistakes/objecttype-must-be-class-path.md
// and objecttype-is-shared-category-not-instance-id.md.
FLudeoRoomWriterCreateObjectParameters MetaParams;
MetaParams.Object = GameState;     // anchor — GameMetadata data lives on the GameState object
// MetaParams.ObjectTypeName left empty → defaults to GameState's class path (correct)
FLudeoWritableObject GameMetadataObj = RoomWriter.CreateObject(MetaParams).GetValue();
GameMetadataObj.WriteData("SchemaVersion", CurrentSchemaVersion); // MANDATORY first write — see §5.10
GameMetadataObj.WriteData("MapName", GetWorld()->GetMapName());
GameMetadataObj.WriteData("BotCount", NumBots);
// Game-specific: experience asset, game mode name, difficulty, etc.
```

Without GameMetadata, Player Flow doesn't know which map to `ServerTravel` to. This is required
for every integration. The `SchemaVersion` attribute is also mandatory from the very first build
— see §5.10.

#### Entity Registration

Register tracked entities with the RoomWriter after BeginGameplay. The pattern is the same
regardless of entity type — only the `ObjectTypeName` and the discovery method change:

```cpp
// Generic entity registration — call for each tracked entity type
FLudeoWritableObject RegisterEntity(
    const FLudeoRoomWriter& RoomWriter,
    UObject* Entity,
    const FString& ObjectTypeName,
    const FString* PlayerID = nullptr) // non-null for player-owned entities
{
    FLudeoRoomWriterCreateObjectParameters Params;
    Params.Object = Entity;
    Params.ObjectTypeName = *ObjectTypeName;

    auto Result = RoomWriter.CreateObject(Params);
    if (Result.IsSuccessful())
    {
        FLudeoWritableObject WritableObj = Result.GetValue();
        // Do NOT call BindPlayer here. BindPlayer is PER-FRAME and must be scoped INSIDE the
        // EnterObject guard on every write (see §5.2). A one-time BindPlayer at registration is
        // the ActionRoguelike bug — the bind does not persist across the per-write EnterObject
        // scope. The caller records PlayerID + bIsPlayerOwned into FTrackedEntityInfo so the
        // write loop can apply FScopedWritableObjectBindPlayerGuard each tick. See
        // learnings/common-mistakes/bindplayer-must-be-per-frame-scoped.md and
        // bindplayer-requires-enterobject-scope.md.
        return WritableObj;
    }
    // Handle failure...
}
```

**Registration flow after BeginGameplay:**
1. Register player entity (always — `BindPlayer` required)
2. Iterate existing entities of each tracked type (using `TActorIterator<T>` or game-specific
   queries)
3. Bind to spawn delegates for transient entities (so newly spawned ones get registered
   automatically)
4. **Catch already-existing entities** — iterate before binding the delegate (same pattern as
   Phase 02 player registration)

**Non-Character entities:** Not all tracked entities are `ACharacter`. Turrets, vehicles,
deployables, and interactable objects are `AActor` subclasses. In `OnActorSpawned` handlers,
check for non-Character tracked entity types BEFORE any `Cast<ACharacter>` early return. During
Player Flow spawning, do not require `Cast<ACharacter>` to succeed — keep non-Character actors.

### 5.2 Per-Frame State Writing (Generic Pattern)

**IMPORTANT: State writing is Creator Flow ONLY.** Guard `CreateWritableObjects()`,
`WriteTrackedState()`, and `RegisterActionListeners()` with `if (!bIsPlayerFlow)`. During Player
Flow, the integration reads state — it does NOT write. Creating writable objects during playback
will corrupt the session.

The write loop iterates all registered entities and writes their tracked properties. **Use RAII
scoped guards** — never manual `EnterObject()`/`LeaveObject()`:

```cpp
#include "LudeoUESDK/LudeoScopedGuard.h"

void ULudeoIntegrationComponent::WriteTrackedState()
{
    if (bIsPlayerFlow) return; // Creator Flow only

    for (auto& [Entity, TrackedInfo] : TrackedEntities)
    {
        if (!Entity.IsValid()) continue;

        AActor* Actor = Cast<AActor>(Entity.Get());
        if (!Actor) continue;

        // RAII scoped guard — automatically calls EnterObject/LeaveObject
        FScopedLudeoDataReadWriteEnterObjectGuard ObjectGuard(TrackedInfo.WritableObj);
        if (!ObjectGuard.IsValid()) continue;

        // For player-owned entities: scoped BindPlayer guard (per-frame, not one-time)
        TOptional<FScopedWritableObjectBindPlayerGuard> PlayerGuard;
        if (TrackedInfo.bIsPlayerOwned)
        {
            PlayerGuard.Emplace(TrackedInfo.WritableObj, TCHAR_TO_UTF8(*TrackedInfo.PlayerID));
        }

        // Transform — always written for moving entities
        if (TrackedInfo.bTrackTransform)
        {
            TrackedInfo.WritableObj.WriteData("Transform", Actor->GetActorTransform());
        }

        // Additional properties — game-specific, determined by integrator
        // The skill generates these based on the entity/property table from Phase 03
        // Example: TrackedInfo.WritableObj.WriteData("Health", GetHealth(Actor));
    }
    // Scoped guards automatically call LeaveObject when destroyed
}
```

**Key patterns:**
- **Always use `FScopedLudeoDataReadWriteEnterObjectGuard`** (RAII) — never manual
  `EnterObject()`/`LeaveObject()`. The scoped guard is exception-safe and prevents orphaned
  state.
- **Use `FScopedWritableObjectBindPlayerGuard`** per-frame for player-owned entities — not a
  one-time `BindPlayer()` call at registration. The scoped guard binds the player context for
  the duration of the write.
- **Guard writes with `if (bIsPlayerFlow) return`** — Creator Flow only.

### 5.3 Write Frequency Strategy

**For MVP (phases 1–4): default to writing every tick.** Call `WriteTrackedState()` in
`TickComponent`. For real-time genres this is the right default — do not optimize write
frequency during MVP; it adds complexity for minimal benefit on a curated slice. Frequency
*optimization* (delta threshold, every-N-frames) is deferred to Phase 06 (Enrichment).

**Cadence is a design axis, not a constant — make it a swappable policy.** Some genres are
materially better served by a non-per-tick cadence (e.g. turn-based games, where a turn-boundary
cadence lands restore on the agreed turn-start semantics). Even when you default to per-tick, put
the *decision* behind a single predicate + config key (e.g. `bShouldWriteThisFrame()` gated on
`WriteCadenceMode`) rather than hardcoding `every tick`, so the team can change it without
touching the write loop. **Cadence changes do not invalidate old Ludeos** — the attribute
*schema* is unchanged, only how often you sample it, so no re-record and no schema bump (see
§5.10).

> **Any non-per-tick cadence requires watching the replay immediately after the first capture
> — a mandatory gate, not optional.** Restore-vs-data self-checks stay GREEN even when the
> cadence captures the wrong *thing*: e.g. a turn-boundary cadence in a tactics game can record
> battle-start formation while the video shows mid-turn movement, so the replay looks completely
> broken while every instrument reads correct. If you see green instruments + a wrong scene,
> compare data-vs-video FIRST. See
> `learnings/architecture/turn-boundary-quantized-write-cadence.md`.

### 5.4 Player Flow Restoration (Read Side — REQUIRED)

Player Flow is required for the end-to-end demo. DataReader mirrors DataWriter — read the same
properties using identical attribute names.

**IMPORTANT: Player Flow restore timing depends on how the game applies state.** There are two
models — pick by what your restore actually relies on:

- **GAS / physics / spawn-tick games:** apply restored state while the game is RUNNING, because
  attribute ticking, physics, and spawn systems need the game ticking to process it; after state
  settles (wait a frame if needed), THEN pause, open the room, AddPlayer, and wait for RoomReady.
- **BP-only direct-reflection games (the common case here):** pause/lock-first — apply the
  restore before the game runs visibly. Follow the ordered sequence in the next block.

Either way, the pause protects the window between "state ready" and "room ready" — without it,
AI attacks the player before the room is configured. Resume when BeginGameplay fires. See
`learnings/architecture/pause-before-player-flow-room.md`.

**Restructure the Phase-02 room-open for Player Flow — do not reuse its timing verbatim.** In
Phase 02 the Creator opens the room at the GameState component's `BeginPlay`. If Player Flow
reuses that timing, the Ludeo overlay appears *before* anything is restored. The SDK does nothing
until `OpenRoom`, so delaying it is free — gate it. Player Flow order:

1. Wait for readiness (pawn possessed; the world/level actually ready — see the streamed-sublevel
   note if your slice streams its level).
2. **Lock input** during the wait — do not pause; pausing can stall async level streaming (see
   [[dont-pause-during-async-load-waits]]).
3. Apply the restore (state + entities).
4. Let the state settle.
5. **Then** pause, **then** `OpenRoom` + `AddPlayer` + RoomReady.
6. `BeginGameplay`, then unpause.

Set `bTickEvenWhenPaused = true` on the component so the readiness/settle poll keeps running
while paused, and put a **failsafe-resume on every error path** — after you pause, a missed
unpause freezes the game permanently.

The "apply-while-running → settle → then pause" variant is the **exception** for games whose
restore relies on GAS attribute ticking or physics-velocity settling; gate it on "does restore
depend on OnRep/GAS ticking or physics?" For BP-only games with direct reflection writes,
pause/lock-first is the default.

**If the curated slice's map streams its gameplay level (a loading-screen / root-streaming
setup):** readiness and room-open ordering need extra care — gate readiness on the streamed
gameplay level being loaded+visible (NOT pawn-possessed, which fires before the sublevel streams
on these maps), keep the wait unpaused, and verify the possessed pawn is the real game pawn, not
a loading-screen placeholder. Session-activation timing can mask this in Creator Flow, so test in
Player Flow specifically. Full detection signals and the gating sequence:
[[gate-player-flow-on-streamed-level-not-pawn]].

**Restore timing can be CORE playability, not Phase-07 polish — handle it in Phase 04.** Does
the game run a startup choreography after its gameplay-active signal — a queued animation layer,
staged state machine, intro sequence, or any "settling" the engine plays before the player has
real control? If yes, restoring into the *middle* of that choreography produces nondeterministic,
demo-breaking failures (intermittent empty ability bar, wedged input) that **data correctness
cannot fix** — and they reproduce only sometimes, so they read as flaky, not as a timing bug.
Gate the restore on the choreography's completion using the game's OWN idle/ready signals (not a
fixed delay), **in Phase 04**. Do not defer this to Phase 07 as "timing polish" — Phase 07
timing is cosmetic only; core-playability timing is Phase 04. See
`learnings/architecture/restore-timing-can-be-core-not-polish.md`.

**Write-side dual — capture-window gating.** The platform's restore point follows the user's
TRIM, not the capture press, so **every captured frame must be a valid restore point**. The
write-side counterpart of restore-timing is therefore to write only in player-actionable,
nothing-animating moments (skip frames mid-choreography / mid-transition), so a trim onto any
captured frame lands somewhere restorable.

**Restoration approach** (from `integration.json → curatedSlice.restorationApproach`):
- **Reconciliation** (Group 1 save systems): Use SaveWorld + property filters. The UE save
  system handles most restoration automatically. You configure which actors/properties to save
  via `FLudeoSaveGameActorData`. See FPSGameStarterKit reference.
- **Manual** (Group 2-3 or serialization blockers): Read each property from DataReader, apply to
  spawned entities directly. More code but more control.

**GAS-based games (health restoration):** If the game uses Gameplay Ability System, health cannot
be set via a simple property setter — it's a gameplay attribute. Use
`UAbilitySystemComponent::SetNumericAttributeBase()` or apply a gameplay effect. Health
restoration may need to be **deferred** until GAS is initialized on the target actor, which can
happen after `BeginPlay`.

**Loadout / inventory restore: reconstruct, don't assume the items exist.** First determine
whether the curated slice **pre-populates** the inventory (e.g. a fixed loadout granted at spawn)
or whether items are acquired during play. If they're acquired during play, a fresh Player Flow
spawn starts with an EMPTY inventory, and reflection-setting a "quantity" on items that aren't
there silently no-ops. Capture the FULL inventory at Creator time and, on restore, **re-create
each item via the game's own add-item function** (find its exact parameter pins with
`inspect-func-sigs`), then set quantities and re-equip the captured weapon. This is
event-driven reconstruction (see [[bp-state-machine-vs-property-driven-init]]) — do not
reflection-set state onto objects the game has not created yet.

For manual restoration, use RAII scoped guards (same as write side):

```cpp
void ULudeoIntegrationComponent::ReadAndApplyState(
    const FLudeoReadableObject& ReadableObj,
    AActor* TargetActor,
    const FTrackedEntityInfo& TrackedInfo)
{
    if (!TargetActor) return;

    // RAII scoped guard — same pattern as write side
    FScopedLudeoDataReadWriteEnterObjectGuard ObjectGuard(ReadableObj);
    if (!ObjectGuard.IsValid()) return;

    // Transform — for moving entities
    if (TrackedInfo.bTrackTransform)
    {
        FTransform Transform;
        if (ReadableObj.ReadData("Transform", Transform))
        {
            TargetActor->SetActorTransform(Transform);
        }
    }

    // Additional properties — mirror what was written
    // The skill generates read calls matching the write calls from 5.2
}
// Scoped guard automatically calls LeaveObject
```

### 5.5 Entity Spawn Handling During Reconstruction

For curated slice entities, handle reconstruction based on persistence:

| Entity Type | Reconstruction Strategy |
|-------------|------------------------|
| **Persistent** (player, game state) | Always exists — apply state directly |
| **Level-placed** (static enemies, doors, switches) | Always exists in level — match and apply state directly |
| **Game-spawned** (wave AI, scripted encounters) | If the game's spawn system runs during Player Flow, wait for it and apply state when entity appears. If not (wave system doesn't trigger), **spawn manually** — see below. |
| **Player-placed** (turrets, deployables) | Spawn manually during Player Flow — these only exist because the player created them |
| **Event-spawned** (projectiles, pickups) | Skip for MVP — defer to Phase 07 |

**Manual spawning for entities that don't exist at level start:** For wave-spawned AI,
player-placed turrets, and other entities that only exist because gameplay created them, you MUST
spawn them during Player Flow. Store `ClassPath` (`Actor->GetClass()->GetPathName()`) during
Creator Flow. During Player Flow, use `StaticLoadClass` + `SpawnActor` to recreate them:

```cpp
// During Creator Flow — store class path in writable object
WritableObj.WriteData("ClassPath", Actor->GetClass()->GetPathName());

// During Player Flow — spawn from stored class path
FString ClassPath;
ReadableObj.ReadData("ClassPath", ClassPath);
UClass* ActorClass = StaticLoadClass(AActor::StaticClass(), nullptr, *ClassPath);
if (ActorClass)
{
    AActor* SpawnedActor = GetWorld()->SpawnActor<AActor>(ActorClass, &RestoredTransform);
    // Apply remaining state to SpawnedActor...
}
```

"Prefer waiting for the game's spawn system" only applies to entities the game would spawn anyway
(e.g., level-scripted encounters). For entities that require player action or wave triggers to
exist, manual spawning is required.

### 5.6 LudeoSelected Callback (Player Flow Entry Point)

The `LudeoSelected` notification fires when a Ludeo is available to play. Wire it in the
Subsystem (from Phase 02):

```
OnLudeoSelected:
  → Store Ludeo data in Pending* fields
  → ServerTravel to the curated slice map
  → After map load, Component checks Pending* fields
  → If pending Ludeo exists → Player Flow path (read state, restore, begin gameplay)
  → If no pending Ludeo → Creator Flow path (normal gameplay, write state)
```

This branching (Creator vs Player flow) is the core of the end-to-end pipeline. Both paths share
the same BeginGameplay gate — the difference is whether you write or read state.

### 5.7 Player Flow Phase Skipping (Universal)

**Player Flow is NOT normal gameplay startup — it's restoring a snapshot.** Any pre-gameplay
phases (warmup, countdowns, "waiting for players") are meaningless during Player Flow and must
be skipped. This applies to ALL integrations, not just specific games.

**Why:** During Creator Flow, the game went through warmup → countdown → gameplay naturally. The
Ludeo captures state from the gameplay phase. When Player Flow restores that state, the game
tries to run warmup again — but there are no real players to wait for, and the restored state is
already post-warmup. Running warmup during Player Flow causes:
- "Waiting for Players" UI appearing while the game is paused for restoration
- Countdown timers running before state is applied
- Phase-dependent initialization overwriting restored state (e.g., health reset to default)

**Implementation approaches:**

| Approach | When to Use |
|----------|------------|
| Direct phase skip | Game's phase system supports jumping to a specific phase (call `StartPhase(Playing)` or equivalent) |
| Phase condition override | Set the warmup conditions as already-met so the phase completes instantly |
| Phase suppression | Prevent the warmup phase from activating at all during Player Flow (set `bIsPlayerFlow` before phase system initializes) |

**Key:** The Component must know it's in Player Flow **before** the game's phase system starts.
Check `Subsystem->GetPendingLudeoID()` in `BeginPlay` — if non-empty, skip or fast-forward
pre-gameplay phases.

### 5.8 Pause/Resume Detection (Required for Working Demo)

Without basic pause handling, the game keeps running while the Ludeo overlay is up at the end
of a capture or playback. State writing continues through the overlay, and the demo feels broken.
This is a Phase 04 concern — not Phase 05 polish.

**The SDK side is already wired** (Phase 02): `OnPauseGameRequested` fires when the overlay
opens, the subsystem calls the game's pause mechanism, and the game pauses. What Phase 04 adds
is **detection and action reporting** — the component must notice the pause and tell the SDK.

**Implementation:**

1. **Component constructor:** set `PrimaryComponentTick.bTickEvenWhenPaused = true` so tick
   keeps running while paused.

2. **Track pause state in `TickComponent`.** How to detect pause depends on the game's pause
   mechanism (discovered in Phase 01, recorded in `integration.json → pauseMechanism`):
```cpp
// Standard UE pause (most games):
bool bCurrentlyPaused = GetWorld()->IsPaused();

// Time-dilation-based pause (multiplayer games like Lyra):
// bool bCurrentlyPaused = GetWorld()->GetWorldSettings()->TimeDilation < 0.01f;

// Check integration.json → pauseMechanism.type to pick the right detection.

if (bCurrentlyPaused != bWasPaused)
{
    if (bCurrentlyPaused)
        HandleGamePaused();
    else
        HandleGameResumed();
    bWasPaused = bCurrentlyPaused;
}
```

3. **Send pause/resume actions** — different actions per flow:
```cpp
void HandleGamePaused()
{
    if (bIsPlayerFlow)
        SendAction("PauseLudeo");   // pauses Player Flow timers
    else
        SendAction("StartNoneLudeable");  // marks non-ludeoable segment in Creator Flow
}

void HandleGameResumed()
{
    if (bIsPlayerFlow)
        SendAction("ResumeLudeo");
    else
        SendAction("StopNoneLudeable");
}
```

4. **Guard state writing:** add `if (bWasPaused) return;` at the top of `WriteTrackedState()`.
   Don't write state while the game is paused — it's meaningless data (nothing is moving).

**Advanced pause detection** (menu overlays, map transitions, non-ludeoable area patterns) is
deferred to Phase 05. This section covers only the basic SDK-overlay-triggered pause path.

### 5.9 Progression Trail Capture (Not Just Snapshots)

Sections 5.1–5.7 cover **snapshot state** — capture current entity positions, health, phase
enums; restore them directly. This works for positions, inventories, and most current-moment
values.

It does NOT work for **progression trails** — state that the game's scripted systems track as a
sequence of past events. If Phase 01's "What breaks on restore?" diagnostic classified any
subsystem as `trail + loadBearing` — or if the intake's Group 5 (`intake.eventDrivenScriptedSystems`)
identified mission/objective/milestone systems that drive scripted level logic — those systems
need trail capture in Phase 04. Not Phase 06.

**Why snapshots fail:** If you capture "current milestone = 5" and restore it at time 0, the
level blueprint still believes the mission is at t=0. It re-queues setup-phase VO, spawns NPCs
for phases that have already completed, re-fires tutorial prompts, and corrupts the experience.
The scripted systems respond to *what has happened*, not to *a scalar value*.

**Trail capture pattern:**

1. **During Creator Flow** — hook the game's "event happened" delegate (e.g.,
   `OnMilestonePassedDelegate`, `OnObjectiveCompleted`) and append each event to a time-ordered
   array attribute on GameMetadata:

```cpp
void OnMilestonePassed(FGameplayTag MilestoneTag, float GameTimeSeconds)
{
    if (bIsPlayerFlow) return;  // Creator Flow only

    FScopedLudeoDataReadWriteEnterObjectGuard Guard(GameMetadataWritableObj);
    if (!Guard.IsValid()) return;

    // Append to a growing "MilestoneTrail" array
    MilestoneTrail.Add({MilestoneTag.ToString(), GameTimeSeconds});
    GameMetadataWritableObj.WriteData("MilestoneTrail", MilestoneTrail);
}
```

2. **During Player Flow** — read the trail and replay it by calling the game's own notifier
   function for each entry, in captured order, BEFORE applying snapshot state:

```cpp
void ApplyProgressionTrail(const FLudeoReadableObject& GameMetadataReader)
{
    TArray<FMilestoneEntry> Trail;
    GameMetadataReader.ReadData("MilestoneTrail", Trail);

    for (const FMilestoneEntry& Entry : Trail)
    {
        // Call the game's own notifier — same path as if it happened naturally
        UMissionDirector::NotifyClientPassedMilestone(Entry.Tag);
    }
    // Scripted systems now believe the mission has reached the captured point
    // Proceed to apply snapshot state (positions, health, etc.) on top
}
```

**The order matters:** replay the trail FIRST, let the scripted systems advance to the captured
moment, THEN apply snapshot state. If you apply snapshot state first, the scripted systems will
fight it (e.g., level BP despawns your carefully-placed mid-mission actors because it thinks they
shouldn't exist yet).

**Rule:** If a subsystem is classified as `trail + loadBearing`, implement its trail capture AND
replay here in Phase 04. Do NOT defer to Phase 06 — Phase 06 is for broadening coverage, not
for backfilling load-bearing state. See
`learnings/architecture/progression-trails-vs-snapshot-state.md`.

### 5.10 Schema Versioning (MANDATORY from the first write)

The attribute set WILL change during iteration — a timer gets added, a dead attribute source gets
replaced, a subclass's combat state gets tracked. Real integrations go several schema versions in
a couple of days. Two failure modes bracket the un-versioned case: the SDK **asserts (crashes)**
when `ReadData` hits an attribute that wasn't recorded (§8.11), so old captures crash on replay;
over-defensively, agents then hard-reject every old capture on every change, forcing needless QA
re-record churn. Versioning is the only thing that lets you accept the captures that are still
semantically valid and reject only the ones that aren't.

**This is a mandatory pattern, not an optional consideration. Ship it from the first build.**

```cpp
// Versioning constants — keep a changelog comment per version.
static constexpr int32 CurrentSchemaVersion      = 1; // bump on attribute-set OR attribute-SEMANTICS change
static constexpr int32 MinSupportedSchemaVersion = 1; // = oldest version still SEMANTICALLY correct
// v1: initial — Transform, Health, <...>
// (when you bump: add "v2: added AbilityCooldowns; v3: replaced X source (semantics change) ...")

// WRITE — SchemaVersion is the first attribute on GameMetadata (see §5.1).
GameMetadataObj.WriteData("SchemaVersion", CurrentSchemaVersion);
```

```cpp
// READ — meta-first, version-GATED. Object order is NOT guaranteed, so read GameMetadata first.
int32 CapturedVersion = 0;
GameMetaReader.ReadData("SchemaVersion", CapturedVersion); // SchemaVersion exists in every version

if (CapturedVersion < MinSupportedSchemaVersion)
{
    // Reject cleanly — do NOT attempt to read newer attributes (they'll assert).
    UE_LOG(LogLudeo, Warning, TEXT("Ludeo schema v%d below floor v%d — re-record required"),
        CapturedVersion, MinSupportedSchemaVersion);
    return;
}

// Version-GATED reads — never probe with ExistAttribute. Gate on the captured version.
FCooldowns Cooldowns;
if (CapturedVersion >= 2) { ReadableObj.ReadData("AbilityCooldowns", Cooldowns); }
```

**Rules:**
- **SchemaVersion is the first attribute written**, on GameMetadata, from the very first build.
- **Bump on attribute-set changes OR attribute-SEMANTICS changes** — replacing what feeds an
  existing attribute is a bump even though the name is unchanged.
- **Read meta first** (object order is not guaranteed), then **gate reads on the captured
  version** — never use `ExistAttribute` probes (the assert is the failure mode you're avoiding).
- **Gate applies too, not just reads** — applying a defaulted value clobbers correct fresh-load
  values; only apply what the captured version actually carried.
- **`MinSupportedSchemaVersion` = the oldest version that is still SEMANTICALLY correct** — not
  the oldest that happens to parse. A version whose data now means something different is below
  the floor.
- **Bundle several additions into one bump**, and tell QA exactly which captures need
  re-recording when you raise the floor.

Full rationale: `learnings/architecture/capture-schema-lifecycle-management.md`.

---

## 6. Output Contract

```
Produces:
  tddSection: markdown           — Phase 4 State Tracking + Player Flow section in TDD
  creatorFlowWorking: bool       — State writes during gameplay, visible in highlight inspector
  playerFlowWorking: bool        — NOT stubs. Actual read/apply code proven by human test
  decisions[]: Decision[]        — Appended to integration.json
```

After implementation, record in `.ludeo/tdd/integration-tdd.md`:

```markdown
## Phase 4: Curated State Tracking + Player Flow

### Curated Slice
Map: [map name], Game Mode: [mode]

### Tracked Entities (curated slice only)
| Entity Type | Class | Strategy | Properties Tracked |
|-------------|-------|----------|--------------------|
| Player | [class] | Persistent | Transform, Health, ... |
| [Enemy type] | [class] | Transient | Transform, Health, IsAlive |

### Creator Flow (Write Side)
- Write frequency: every tick
- Registration: after BeginGameplay gate
- Cleanup: on entity destroy + room close

### Player Flow (Read Side)
- Restoration approach: [reconciliation | manual]
- LudeoSelected → ServerTravel → restore state → begin gameplay
- Entities restored: [which entities get state applied]

### Key Decisions
- [Restoration approach choice and rationale]
- [Which entity types are tracked and why]
- [Properties chosen per entity type]
```

---

## 7. ✅ Success Criteria

- [ ] State handlers registered; per-tick attributes captured (Creator/write side)
- [ ] Flow reaches the restore entry point on a real captured Ludeo
- [ ] Pause/overlay behavior correct
- [ ] Player Flow proven working before actions/enrichment proceed
- [ ] Captured highlight plays back and visibly restores positions/state
- [ ] Reader does NOT assert on missing attributes
- [ ] Restore verified by a human

---

## 8. Common Mistakes

### 8.1 Writing before BeginGameplay
The room writer is only valid after BeginGameplay. Writing before that silently fails or crashes.
Always gate state writing on gameplay-active state.

### 8.2 Manual EnterObject/LeaveObject Instead of Scoped Guards
Always use `FScopedLudeoDataReadWriteEnterObjectGuard` (RAII) — never manual
`EnterObject()`/`LeaveObject()`. Manual calls are error-prone (forgetting `LeaveObject` on early
return). The scoped guard is exception-safe and guaranteed to clean up. Include
`"LudeoUESDK/LudeoScopedGuard.h"`.

### 8.3 Writing every frame at full precision
For transform tracking, `FTransform` includes scale which rarely changes. If data size is a
concern, write `FVector` (location) + `FRotator` (rotation) separately and skip scale.

### 8.4 Not handling entity destruction during tracking
A tracked entity can be destroyed mid-gameplay (NPC death, projectile impact, pickup collected).
If you hold a `TWeakObjectPtr` to a destroyed actor and try to write, you get a crash. Always
check `IsValid(Actor)` before writing. Hook `OnDestroyed` for automatic cleanup.

### 8.5 Writing transforms in local space
Use `GetActorTransform()` (world space), not relative transforms. Local space transforms are
relative to the parent and meaningless for reconstruction without the parent hierarchy.

### 8.6 Not destroying writable objects on cleanup
When a tracked entity despawns or the room closes, call `RoomWriter.DestroyObject()`. Orphaned
writable objects waste memory and may cause issues during reconstruction.

### 8.7 Registering objects before the room is open
`RoomWriter.CreateObject()` requires an active room. If called before `OpenRoom` completes, it
fails. Gate registration on the BeginGameplay signal from Phase 02.

### 8.8 Tracking too many entities
Not everything needs tracking. Ambient NPCs, decorative particles, background vehicles, and
entities far from the player don't contribute to meaningful playback. Use the entity
classification from Phase 03 §3.2 and confirm with the integrator.

### 8.9 Not binding player objects
Use `FScopedWritableObjectBindPlayerGuard` per-frame in the write loop for player-owned objects
— not a one-time `BindPlayer()` at registration. The scoped guard binds the player context for
the duration of each write tick. Without it, the SDK doesn't know which player's perspective
the data belongs to.

### 8.10 SDK handle validity
SDK handle types (`FLudeoPlayerHandle`, `FLudeoRoomHandle`, etc.) have private uint64 members.
Use the implicit conversion operator to the native C handle type and compare to nullptr:
`static_cast<LudeoHGameplaySession>(Handle) == nullptr`.

### 8.11 ReadData asserts on missing attributes (version incompatibility)
The SDK **asserts** (crashes, not returns false) when `ReadData` is called for an attribute name
that doesn't exist in the recorded data. This means adding new write attributes breaks all
previously captured Ludeos — Player Flow will crash on replay. The fix is not optional: implement
the **mandatory schema versioning pattern in §5.10** from the first build (SchemaVersion written
first on GameMetadata; meta-first, version-gated reads AND applies; `MinSupportedSchemaVersion`
floor). Do NOT guard with `ExistAttribute` probes, and do NOT hard-reject every old capture on
every change — version-gating is what lets you keep the captures that are still semantically
valid. When you raise the floor, tell QA exactly which captures need re-recording.

### 8.12 Assuming all tracked entities are ACharacter
Not all tracked entities derive from `ACharacter`. Turrets, vehicles, deployables, and
interactable objects are plain `AActor` subclasses. If your `OnActorSpawned` handler does
`Cast<ACharacter>` and returns early on failure, non-Character tracked entities will never be
registered. Check for all tracked entity types before any Character-specific cast.

### 8.13 Anchoring writable objects to Pawn instead of PlayerState
When creating the Player writable object, use `PlayerState` as the UObject anchor — NOT `Pawn`.
The Pawn can be null (during respawn), destroyed (on death), or swapped (vehicle entry).
`PlayerState` persists for the entire match and survives respawns. Using Pawn as the anchor
causes the writable object to silently fail to register when the Pawn doesn't exist yet, or to
become invalid on respawn.

### 8.14 Stubbing Player Flow read side

`ApplyPlayerState() { /* TODO */ }` compiles. The compile-fix loop will succeed with stubs, and
that success feeling overrides the fact that Player Flow does nothing. Phase 04 is NOT complete
until the human has run the game, played back a captured highlight, and confirmed that entity
positions restore. Stubs are not acceptable.
