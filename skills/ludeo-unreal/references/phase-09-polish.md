# Phase 09 — Polish & Fix Bugs

## 1. Goal / Purpose

This phase runs **after Phase 8 (Expansion)** and is where the integration is marked complete.
It raises restore fidelity for the gaps that remain once enrichment (Phase 7) widened the tracked
set, and addresses any bugs that surfaced during earlier phases. Core Player Flow restore (universal
backbone — subsystem reads → pending structs → ServerTravel → component applies after an N-way gate
→ teleport/setter onto the spawned pawn) lives in `references/phase-05-tracking-restore.md`; this
phase covers the POLISH-level work on top of that: deferred-property application, two-pass
reconstruction refinements, animation/cosmetic timing, and architecture-branch-specific fidelity.

**The polish techniques differ by the game's architecture.** There is no single "Phase 9 approach."
A heavily-replicated game restores by firing OnRep cascades; a GAS game restores attributes through
GameplayEffects; a BP-component game pokes sub-component properties by reflection; a SaveWorld game
lets the SDK reconcile and only hand-restores what the SaveGame filter can't carry. **Pick the
branch that matches the game** (§5.0) and apply it — applying the wrong branch's machinery (e.g.
OnRep cascades on a GAS game) wastes effort and can crash.

> **Scope of "timing" in Phase 9 is COSMETIC only.** Restore timing that affects *playability* —
> gating the restore on a startup choreography / animation queue / staged state machine so the
> player lands in a controllable state — is **core, and belongs in Phase 5** (see
> `references/phase-05-tracking-restore.md` §5.4 and
> `learnings/architecture/restore-timing-can-be-core-not-polish.md`). Phase 9 timing covers
> cosmetic sequencing only: deferred application when a handler touches a not-yet-ready subsystem,
> ordering a restore ahead of the engine's equip/loadout pipeline so the visible result is clean.
> If a timing problem makes the slice *unplayable* (empty ability bar, wedged input, nondeterministic
> control loss), it is a Phase 5 bug — do not carry it here as polish.

**Deliverables (those relevant to the chosen branch):**
- Architecture identified and the matching restore branch implemented to full fidelity
- Deferred application where handlers touch not-yet-ready subsystems
- Restore sequenced ahead of the engine's natural equip/loadout pipeline
- Default-spawn cleanup before restoring tracked/cold-spawned entities
- Known bugs from prior phases fixed
- Updated TDD and `integration.json` marked COMPLETE

---

## 2. Inputs (Input Contract)

Before starting this phase, verify:

- [ ] Phase 5 Player Flow read side is **functional, not stubbed** — position/rotation already
  restore for the curated slice, verified by an actual playback test (not compile success). Phase 9
  polishes working restoration; it does not implement it from scratch.
- [ ] Phase 7 enrichment compiles cleanly (plugin-disabled and plugin-enabled builds pass).
- [ ] The game's **restore architecture is identified** (§3.1) and recorded in `integration.json`.
- [ ] A captured Ludeo on the test map exists so restore can be exercised end to end.
- [ ] If `packagingTarget` is `packaged`/`cloud-build`: a shipping build path is ready —
  timing-sensitive restores (equip races, async loadout) behave differently than editor PIE.

```
Required:
  tddSections1-6: markdown   — Prior TDD sections (.ludeo/tdd/integration-tdd.md)
  workingPlugin: files        — Plugin from Phases 3-7 (Phase-4 Player Flow read side functional)
  restorationApproach: enum   — integration.json → curatedSlice.restorationApproach (reconciliation|manual)
  trackedDataPlan: markdown   — Phase 7A plan, incl. per-property "how to restore" notes
  codeMap: json               — .ludeo/code-map.json

Optional:
  sdkDocs: MCP               — sdk-docs MCP (DataReader / SaveSystem API details)
  bpGraphReport: json        — .ludeo/bp-graph-report.json (BP cosmetic-event flow)
```

---

## 3. Steps

### STOP — Pre-Flight Checklist

- [ ] Phase 5 Player Flow read side is functional (verified by playback, not compile).
- [ ] Restore architecture identified (§3.1) and recorded in `integration.json`.
- [ ] Branch-specific analysis done (Pattern 1/2 for §5.A; ASC/attribute access for §5.B; sub-component map for §5.C; filter + handler plan for §5.D).
- [ ] A captured Ludeo on the test map is available.
- [ ] If `packaged`/`cloud-build`: a shipping build path is ready for timing-sensitive restores.

### 3.1 Identify the restore architecture (the branch selector)

This is the first and most important Phase-8 question. Where does the game's gameplay-critical
state live, and how is it normally written? Classify into one (sometimes two) of:

| Architecture | Tell-tale signs | Branch |
|--------------|------------------|--------|
| **Replicated / event-driven state machines** | State in `UPROPERTY(ReplicatedUsing=OnRep_X)`; level-placed actors with `BP_OnStateChanged`-style cascades; runtime state reached via events/transitions | §5.A |
| **GAS** | `UAbilitySystemComponent`, `UAttributeSet`, Health/attributes are read-only outside GameplayEffects; abilities granted at spawn | §5.B |
| **BP-component** | Blueprint-only; gameplay state on dynamically-added BP sub-components (`HealthComp`, `WeaponComp`); no C++ gameplay classes; SaveWorld returns empty (component refs unreachable) | §5.C |
| **SaveWorld / reconciliation** | State on `ACharacter`/engine classes with `UPROPERTY(SaveGame)` or BP SaveGame-flagged vars; `restorationApproach: reconciliation` | §5.D |

A game can span two (e.g. ActionGame is both replicated **and** GAS). Implement each relevant
branch. Cross-check `references/reference-sample-catalog.md` — a sample match names the
architecture directly.

### 3.2 Classify actors Pattern 1 vs Pattern 2 (replicated branch)

For the §5.A branch, classify each tracked actor: **Pattern 1** (property-driven init —
`BeginPlay` reads its UPROPERTYs; restore pre-BeginPlay) vs **Pattern 2** (event-driven state
machine — UPROPERTYs written by transitions but don't drive them; needs the cascade fired).
Diagnostic: *does this state live in a UPROPERTY the BP reads at init, or in a runtime state
machine?* See `learnings/architecture/pre-vs-post-beginplay-restore-timing.md`.

### 3.3 Inventory OnRep handlers (replicated branch)

For each tracked `UPROPERTY(ReplicatedUsing=OnRep_X)`: confirm the `OnRep_<PropName>` UFUNCTION
exists (`Grep "OnRep_"`); read its body for invariants (`check()`s, refs to non-replicated members,
`Old`-param diffs); check the class's `BeginPlay` for a native non-default-state handler
(→ exclusion list).

### 3.4 Identify cold-spawned actors

For each actor the integration spawns at replay (`SpawnActor`/`SpawnEntityFromClassPath`): does it
have a state-driven `BP_OnStateChanged` cosmetic hook? If yes, a cold spawn lands in default visual
state — plan a setter-based state restore (§5.A.4 / §5.C.4).

### 3.5 Identify the natural equip / loadout / cosmetic pipeline

Does the engine auto-equip a loadout / attach cosmetics after pawn spawn/possession? If yes,
restore must be sequenced relative to it (§5.E.2). This bug is editor-invisible and only shows in
shipping.

### 3.6 Version / schema handling

If Phase 7A added a `SchemaVersion` GameMetadata attribute, read it during reconstruction and
branch/skip gracefully on mismatch.

### 3.7 Implementation order

Within the chosen branch, implement smallest verifiable unit first, compile-test each:
1. The core apply mechanism for one entity/attribute → verify it restores.
2. Extend to all tracked entities/attributes for the branch.
3. Deferred application + restore-before-natural-flow ordering.
4. Cold-spawn / default-spawn cleanup (if applicable).
5. Shipping test for any timing-sensitive restore.

Each step is a compile-test unit. Do not batch.

### 3.8 Compile-Fix Protocol

Standard hard gate (SKILL.md Step 6): build plugin-disabled then plugin-enabled; first error → fix
→ rebuild, ≤10 iterations; build after each new source file. Any new public proxy method
(`Ludeo_SetState`, attribute accessor, etc.) needs the per-method module API export macro —
`MinimalAPI` on the class does not export methods.

### 3.9 Verification Checklist (HARD GATE — human-run)

Compilation proves nothing about restore fidelity. Present this to the human and wait for results:

- [ ] Branch-appropriate state restores to the captured snapshot (replicated: cascades fired, no
  limbo state; GAS: attributes/abilities/loadout match and HUD reflects them; BP-component: every
  read field is applied, no silent gaps; SaveWorld: reconciled actors correct, manual supplements
  applied).
- [ ] No crash during restore (deferral correct for the branch).
- [ ] Cold-spawned/respawned actors show correct state/cosmetics, no duplicates.
- [ ] Player equip/cosmetic state survives the engine's natural flow — **verified in a shipping
  build** where timing matters.
- [ ] Actions still fire in Player Flow (re-run the `bIsPlayerFlow` audit).

---

## 4. Questions to Ask the Human

**Keep it lean.** Ask only when:

1. **Architecture ambiguity:** "Gameplay state for [X] appears to live in [GAS attributes / BP sub-components / replicated UPROPERTYs] — confirm so I pick the right restore approach?"
2. **Visual-fidelity tradeoff** (replicated branch): "Actor [X] restores functionally but a BP animation gate (`bIsInitialStateChange`) leaves the visual at the map default — acceptable, or a hard requirement?"
3. **GAS restore semantics:** "Restoring [Health/attribute] needs a GameplayEffect, not a direct write. Is there an exported effect/initializer I should use, or do I set the base value via `SetNumericAttributeBase`?"
4. **Engine setter availability:** "Restoring [equip slot/cosmetic] via reflection loses the shipping equip race. Is a timing-aware engine setter exported (e.g. `SetCurrentEquippableIndex`, `AddWeapon`)?"

---

## 5. Patterns to Apply

### 5.0 Restore-approach selection

Use the §3.1 table to pick the branch(es). The branches below are **alternatives**, not a sequence
— implement the one(s) matching the game. §5.E concerns apply to all. Real-game references for each
branch are in `references/reference-sample-catalog.md`.

---

### 5.A Branch — Replicated / event-driven state machines

*Reference: ActionGame (a heavily-replicated AAA shooter). This is the deepest branch because event-driven state needs the cascade fired, not just the value written.*

#### 5.A.1 Two-pass reconstruction

Split restoration along UE's world-init boundary:

```
Pass 1 — Pre-BeginPlay (FWorldDelegates::OnWorldInitializedActors, gated on Player Flow + captured-map match):
  • Reflection-write captured UPROPERTYs via FProperty::ImportText.
  • Pattern 1 actors are now correct — their BeginPlay reads these values.
  • QUEUE (do not fire) OnRep calls for Pattern 2 actors.

Pass 2 — Post-BeginPlay (FTicker polling World->HasBegunPlay()):
  • Flush queued OnReps to fire cascades (visuals, anim, derived state).
```

A pre-BeginPlay write is the cleanest restore — the BP initializes *from* it. But cascade-firing
handlers assume a live, post-BeginPlay world and crash if fired too early (§5.A.3). See
`learnings/architecture/pre-vs-post-beginplay-restore-timing.md`.

#### 5.A.2 OnRep-driven cascade

Don't write per-class BeginPlay adapters. UE already solved "I just received state X, sync up" for
multiplayer late-join: every `UPROPERTY(ReplicatedUsing=OnRep_X)` has an author-written
`OnRep_X(OldValue)` that drives the cascade. Reuse that path — `ImportText` the value, snapshot
the old value (POD only), and queue `OnRep_<PropName>` to fire via `ProcessEvent` with the old
value as the parameter.

```cpp
bool ApplyCapturedProperty(AActor* Actor, FProperty* Prop, const FString& ExportedValue)
{
    uint8 OldBuf[64] = {};
    const bool bHasOld = IsPodForOnRep(Prop) && Prop->ElementSize <= sizeof(OldBuf);
    if (bHasOld) FMemory::Memcpy(OldBuf, Prop->ContainerPtrToValuePtr<void>(Actor), Prop->ElementSize);

    void* Addr = Prop->ContainerPtrToValuePtr<void>(Actor);
    if (!Prop->ImportText(*ExportedValue, Addr, PPF_None, Actor)) return false;

    if (bHasOld && !IsClassExcludedFromOnRep(Actor->GetClass()))
        if (UFunction* Fn = Actor->GetClass()->FindFunctionByName(*FString::Printf(TEXT("OnRep_%s"), *Prop->GetName())))
            QueueOnRep(Actor, Fn, OldBuf, Prop->ElementSize);   // flush in Pass 2
    return true;
}
```

Universal mechanism (no per-class adapter list), faithful to the game team's design, no
"early-exit-if-equal" bug. See `learnings/architecture/onrep-based-restoration-pattern.md`.
**Preserve OnRep invariants** — when the OnRep `check()`s array shape or diffs against `Old`, copy
mutable fields per-element and pass a pre-edit snapshot; don't reshape or pass `Old == New`. See
`learnings/architecture/onrep-invariants-must-be-preserved-by-restore.md`.

#### 5.A.3 Deferred OnRep flush

Defer firing to `World->HasBegunPlay()`. Pre-BeginPlay the world is mid-transition (player
controller is still the menu controller, game/mission state uninitialized); OnReps that touch those
`CastChecked` and crash. Queue during Pass 1, flush via an **`FTicker`** that polls
`HasBegunPlay()` (FTicker keeps firing while paused; `FTimerManager` does not). Non-POD OnReps
(FString/Array/Map) are skipped — an accepted fidelity gap. See
`learnings/engine-quirks/defer-onrep-to-post-beginplay.md`.

#### 5.A.4 Cold-spawn cosmetic restore

For captured-and-respawned actors with a `BP_OnStateChanged` cosmetic chain, restore the state
through a **public setter** (`Ludeo_SetState` proxy for the protected `SetState`) so the BP
cosmetic event fires. Don't write the property field directly (no broadcast → mesh/VFX stay
default). See
`learnings/architecture/cold-spawned-actors-need-explicit-state-restore-for-cosmetics.md`.

#### 5.A.5 Exclusion list

Some classes have their own BeginPlay non-default-state handler (e.g. a security camera that calls
`SetCameraState` when non-default). Firing OnRep on top double-cascades and can crash. Maintain a
`TSet<FString>` of excluded class names, walked up the superclass chain.

---

### 5.B Branch — GAS (Gameplay Ability System)

*Reference: Lyra, ActionRoguelike. This is the most common real Phase-8 gap — GAS games routinely defer attribute restore to Phase 9 because attributes can't be written directly.*

#### 5.B.1 Attributes need GameplayEffects, not property writes

GAS attributes (Health, Armor, etc.) live in an `UAttributeSet` and are **read-only outside the
GameplayEffect pipeline**. Reflection-writing `Health` is meaningless and won't replicate or fire
`OnAttributeChanged`. Restore one of two ways:

- **`SetNumericAttributeBase`** on the ASC for a direct base-value set (when you have access and
  don't need the GE side effects):
  ```cpp
  if (!FMath::IsNearlyEqual(ASC->GetNumericAttribute(UMyAttributeSet::GetHealthAttribute()), Captured.Health))
      ASC->SetNumericAttributeBase(UMyAttributeSet::GetHealthAttribute(), Captured.Health);
  ```
- **Apply a GameplayEffect** (an exported "init/restore" GE with SetByCaller magnitudes) when the
  game's design requires the effect's hooks to run.

For chunk/quantized attributes (e.g. armor stored in discrete chunks), use the game's
**initializer** (`InitArmor(...)`) rather than `SetNumericAttributeBase` — a raw base set can trip
a synchronous `OnArmorReplenish`/ensure. Use the game's chunk-armor initializer (an `InitArmor`-style
setter) rather than `SetNumericAttributeBase` in that case.

#### 5.B.2 Defer to ASC init / next tick

The ASC and its attribute sets may not be ready when restore first runs, and `OnHealthChanged`
handlers often create widgets / touch mesh overlays / report to AI perception. Defer attribute
application:

- Wait for ASC initialization (`OnAbilitySystemInitialized_RegisterAndCall` in Lyra-derived games),
  then
- Apply on the **next tick** (`SetTimerForNextTick`) with a `TWeakObjectPtr` to the component and
  a by-value copy of the modification.

Apply position/rotation synchronously (TeleportTo is safe); defer only attributes. See
`learnings/common-mistakes/defer-health-restoration-to-next-tick.md`.

#### 5.B.3 Ability & loadout re-grant

A captured snapshot includes which abilities/weapons the player had. On restore, the pawn spawns
with the *default* loadout. Re-grant captured abilities and re-equip the captured weapon through
the game's own grant/equip path (ability spec grant, or the equipment manager's equip function) —
not by writing a "current slot" UPROPERTY. This is the work GAS games defer to Phase 9.

#### 5.B.4 What "done" looks like for GAS

Health/attributes match the snapshot after one tick (no crash), abilities/loadout match, and the
HUD reflects restored values (because the GE/`SetNumericAttributeBase` path fired the proper
change notifications — a raw write would not have).

---

### 5.C Branch — BP-component

*Reference: VoyagerTPS/V2 (Blueprint-only, state on nested sub-components). SaveWorld returns empty here because traversal stops at the actor and never descends into SCS-created sub-components.*

#### 5.C.1 Reflection write into sub-components by name

Gameplay state lives on dynamically-added BP sub-components (`HealthComp_C`, `WeaponComp_C`), not
on the actor. Restore by locating the component, then writing the property via reflection:

```cpp
UActorComponent* Comp = FindComponentByNameSubstring(Actor, TEXT("HealthComp"));
if (Comp)
    if (FProperty* P = Comp->GetClass()->FindPropertyByName(TEXT("Health")))
        WriteNumericProperty(Comp, P, Captured.Health);   // ContainerPtrToValuePtr write
```

#### 5.C.2 BP "float" is `FDoubleProperty`

In UE5 a Blueprint "float" variable is a `FDoubleProperty`, not `FFloatProperty`. The write helper
must try double first and fall back to float (mirror on the read side). See
`learnings/common-mistakes/bp-health-is-double-not-float.md`.

#### 5.C.3 Fire setters / complete read-but-unapplied fields

A bare reflection poke is **silent** — no OnRep, no BP event fires, so derived/visual state won't
update. Where the component exposes a setter or BP event, drive it. The Phase-8 fidelity work is
often **completing fields that were read but never applied** (e.g. Energy and CurrentWeapon are
commonly captured and read into pending structs but not written back) — audit the read side against
the apply side and close every gap.

#### 5.C.4 Cold-spawn via ClassPath, match-then-spawn

For entities not present at replay, match an existing level actor first (by class/distance), then
cold-spawn from the captured `ClassPath` via `StaticLoadClass` (with a name-based fallback) only
when no match. Restore state on the spawned actor by the same reflection writes, and fire any
cosmetic setter (§5.A.4).

---

### 5.D Branch — SaveWorld / reconciliation

*Reference: FPSGameStarterKit. Here the SDK does most of the apply work; the integration's job shrinks to filter + handler selection + a few manual supplements.*

#### 5.D.1 RestoreWorld + property filter

When properties carry the SaveGame flag (C++ `UPROPERTY(SaveGame)` or BP SaveGame-flagged vars),
the SDK's `RestoreWorld` deserializes them straight onto matched actors — you write **no**
per-property apply code for the flagged set. Build an `FLudeoLoadGameSpecification` with a
`CPF_SaveGame` property filter and call `RestoreWorld(*Ludeo, ObjectMap)`. The OnRep/two-pass
machinery of §5.A is **moot** here.

#### 5.D.2 Handler selection: Reconcile vs Purge

The real complexity is actor identity. Choose the load handler per class:
- **ReconcileByUniqueInstance** for unique actors (the possessed player, GameState) — matches the
  existing instance and loads into it. The player **must** use Reconcile; a Purge handler can call
  `BeginLoad` before `GetObject` and destroy the possessed pawn.
- **PurgeActor** for multi-instance actors (AI) — destroys existing instances and respawns them
  from the Ludeo, then the SDK restores their flagged properties.

#### 5.D.3 Manual supplements for what SaveGame can't carry

Some values fall outside the SaveGame filter and need manual restore after `RestoreWorld`:
- **Transform** — `RelativeLocation` lacks the SaveGame flag and nested FVector struct filtering
  breaks; capture transform as a native type and
  `SetActorTransform(..., ETeleportType::TeleportPhysics)`.
- **UObject-ref inventory (weapons)** — object refs crash SaveWorld; capture class-path strings,
  `SpawnActor` each, then drive the game's **own** loadout functions via `ProcessEvent`
  (`AddWeapon`, then `SelectWeapon`/`EquipWeapon`). This "re-drive the natural loadout path" is
  the SaveWorld-game equivalent of restoration.

---

### 5.E Shared concerns (apply to any branch)

#### 5.E.1 Deferred application
Anything whose handler touches not-yet-ready subsystems (GAS attributes, OnReps reading
game/player state, health handlers creating widgets) must be deferred — to `HasBegunPlay()`
(FTicker, survives pause) or the next tick (`SetTimerForNextTick`). Position/rotation can apply
synchronously.

#### 5.E.2 Restore-before-natural-flow
If the engine has a natural equip/loadout/cosmetic pipeline, run restore **immediately** when the
pawn is ready so it wins the race; move "let the world settle" cleanup to **after** restore +
unpause. A pre-restore deferral looks fine in editor (loadouts pre-cached) but loses the race in
shipping (async load). Prefer a timing-aware engine setter over reflection pokes. **Test packaged.**
See `learnings/architecture/restore-must-precede-natural-equip-flow.md`. (SaveWorld games instead
restore *through* the natural loadout path via `ProcessEvent` — §5.D.3.)

#### 5.E.3 Destroy default spawns before restoring
For games that cold-spawn tracked entities, destroy the level's default enemy/civilian spawns (and
sweep in-flight projectiles) **before** restoring, or replay shows duplicate AI. See
`learnings/common-mistakes/destroy-default-spawns-before-restoring-tracked.md`.

#### 5.E.4 `bIsPlayerFlow` audit
Re-run the guard audit (SKILL.md Step 7a): state-writing is Creator-only, but action listeners,
entity tracking, and spawn handlers must run in BOTH flows. Restore polish often adds entity
handling — verify it isn't guarded out of Player Flow.

---

## 6. Output Contract

Append to `.ludeo/tdd/integration-tdd.md`:

```markdown
## Phase 9: Polish & Fix Bugs

### Restore architecture
- Identified architecture(s): [replicated / GAS / BP-component / SaveWorld]
- Branch(es) implemented: [§5.A / §5.B / §5.C / §5.D]

### Branch implementation
- [Per chosen branch: key mechanism, files, hook points]
- [Replicated] Pattern 1/2 classification table; OnRep'd classes; exclusion list; pass-1/pass-2 hooks
- [GAS] attribute-restore mechanism (GE vs SetNumericAttributeBase); ASC-init/next-tick deferral; abilities/loadout re-grant
- [BP-component] sub-components written; double/float handling; fields completed (read→apply); cold-spawn matching
- [SaveWorld] property filter; Reconcile vs Purge per class; manual supplements (transform, weapons)

### Shared concerns
- Deferred applications; restore-before-natural-flow ordering (+ shipping test result); default-spawn cleanup

### Known fidelity gaps (accepted)
- [Pattern 2 visual gaps; non-POD OnReps skipped; out-of-reflection state; etc.]

### Key decisions
### Learnings captured
```

Also update `integration.json`:
- Phase 9 status → `complete`
- `curatedSlice.restorationApproach` populated
- Integration marked **COMPLETE**

---

## 7. ✅ Success Criteria

- [ ] Cosmetic/timing polish applied (animation, deferred props, camera easing)
- [ ] Known bugs from prior phases fixed
- [ ] Integration marked COMPLETE in `.ludeo/integration.json`

---

## 8. Common Mistakes

### 8.1 Architecture mismatch — applying the wrong branch
Bringing §5.A's OnRep/two-pass machinery to a GAS or SaveWorld game, or trying to
reflection-write a GAS attribute. Identify the architecture first (§3.1); each branch exists
because the others don't fit that game's state model.

### 8.2 Raw property write with no cascade (replicated/BP-component)
Writing a Pattern 2 actor's UPROPERTY or a BP component's field and assuming the visual follows.
The value changes; mesh/anim/HUD don't. Fire the cascade via OnRep (§5.A.2) or the component
setter (§5.C.3).

### 8.3 Writing a GAS attribute directly
Reflection-writing `Health` instead of `SetNumericAttributeBase` / a GameplayEffect. It won't
replicate, won't fire change notifications, and the HUD won't update (§5.B.1).

### 8.4 Firing OnRep pre-BeginPlay
Flushing queued OnReps inside `OnWorldInitializedActors`. The world is mid-transition; OnReps
touching game/player state `CastChecked` and crash. Defer to `HasBegunPlay()` (§5.A.3).

### 8.5 Synchronous attribute restore
Applying health inside `ApplyPlayerFlowState` when the handler creates widgets / touches mesh /
reports to AI before they're ready. Defer to next tick / ASC init; keep position synchronous
(§5.E.1).

### 8.6 Wrong SaveWorld handler for the player
Using a Purge handler on the unique possessed pawn — it can destroy the pawn mid-load.
Player/GameState use Reconcile; multi-instance AI use Purge (§5.D.2).

### 8.7 Pre-restore deferral that loses the shipping equip race
A "wait N seconds then restore" that works in editor but lets the engine's natural equip flow
stomp captured state in shipping. Restore immediately; move settle-cleanup to post-unpause; test
packaged (§5.E.2).

### 8.8 Leaving read-but-unapplied fields (BP-component)
Capturing and reading a field (Energy, weapon) into a pending struct but never writing it back on
restore. Audit read side vs apply side and close every gap (§5.C.3).

### 8.9 Treating Phase 9 as a substitute for Phase 5
Stubbing Phase 5 Player Flow and "deferring to Phase 9." Phase 9 polishes working restoration —
the Phase 5 hard gate prevents this.
