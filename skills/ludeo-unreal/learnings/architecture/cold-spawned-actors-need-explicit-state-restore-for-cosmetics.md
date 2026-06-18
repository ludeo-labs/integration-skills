---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: "Does this actor have a state-driven cosmetic event (`BP_OnStateChanged`-style)? If yes: capture the state, restore it via a public setter post-spawn so the BP cosmetic chain runs."
sanitized: true
---

# Cold-spawned actors don't replay through their interaction lifecycle — restore state-driven cosmetics explicitly

## Precondition

The integration spawns actors at replay time via `SpawnActor` / `SpawnEntityFromClassPath` from a captured `ClassPath` + `Transform`. The actor renders correctly during normal gameplay, but on replay it appears invisible, in default visual state, or otherwise wrong — even though the actor exists at the right position.

## The Pattern

Many UE actors have a runtime state property (an enum like `ECurrentBurnState`, `ECameraState`, `EDoorState`) that drives a `BP_OnStateChanged(OldState, NewState, bDoCosmetics)` `BlueprintImplementableEvent`. The Blueprint child class implements this event to:
- Show / hide the mesh
- Spawn / destroy VFX
- Play sounds
- Adjust collision

In normal gameplay the state transitions through interaction:
- Player presses `E` → C++ `Activate()` / `Ignite()` → `SetState(NewState)` → multicast → `OnStateChanged()` → `BP_OnStateChanged()` → cosmetics applied.

At capture time, the actor was in a non-default state (e.g., `Burning`). At replay time, you cold-spawn the actor — `BeginPlay` runs, state defaults to `Inactive` or similar, no interaction triggers fire, `BP_OnStateChanged` never fires, cosmetics never apply, mesh stays hidden.

## Concrete examples (ActionGame)

`ADeployableDeviceActor` has `EDeviceBurnState` (Inactive / Unlit / Burning / CriticalBurning / FlashOver / Completed). The device mesh + flame VFX only render in `Burning`+ states via `BP_OnStateChanged`. Cold-spawn lands at `Inactive`/`Unlit` — no visual.

Same family of issue with `ASecurityCameraActor::CameraState`, `UDestructibleComponent` damage pools, `ACosmeticDestructionActor::bIsActive`.

## The Rule

**For every captured-and-respawned actor, identify its state-driven cosmetic property and restore it explicitly post-spawn.** Pattern:

```cpp
// Capture side
if (IsThisActorClass(Actor))
{
    uint8 StateRaw = static_cast<uint8>(Actor->GetCurrentState());
    Obj.WriteData(LudeoAttr::SomeState, StateRaw);
}

// Restore side
AActor* Spawned = SpawnEntityFromClassPath(ClassPath, Xform);
if (Spawned && IsThisActorClass(Spawned))
{
    uint8 StateRaw = 0;
    Obj.ReadData(LudeoAttr::SomeState, StateRaw);
    Cast<TheClass>(Spawned)->Ludeo_SetState(static_cast<TheStateEnum>(StateRaw));
}
```

The `Ludeo_SetState` is your engine-side public proxy for the protected `SetState`. This is the same pattern as other state-restore wrappers we've added (`Ludeo_SetBurnState`, `Ludeo_ApplyDamagePools`, etc.). Per-method `GAME_API` export required (see `minimalapi-doesnt-export-methods.md`).

The setter MUST trigger the `BP_OnStateChanged` callback chain. Don't bypass by writing the property field directly — the BP cosmetic event is what makes things visible.

## Detection before release

For every actor type you capture+spawn:

1. Read the C++ class header. Look for state-enum properties that are `Replicated` or have `OnRep_X` callbacks.
2. Look for `BlueprintImplementableEvent`s named `BP_OnStateChanged` / `BP_OnX` / `BP_OnY`. These are BP cosmetic hooks.
3. If you find them: capture the state, expose a public state setter (gated by your integration flag), restore on replay.

If you find none: the actor's visuals are likely in its default state OR depend on components that get init'd at construction — cold-spawn is fine.

## Anti-pattern

- Spawning a cold actor and assuming the BP will figure out its initial visuals. It will figure out the *default* visuals, which is typically `Inactive`/`Hidden`/`Off`.
- Writing the state property field directly via reflection without firing the OnRep / SetState chain. The field changes but no broadcast = no cosmetic update.
- Trying to trigger the interaction itself on replay (e.g., simulating an `Ignite` press) — fragile, may double-fire side effects, ordering problems with player state.

## Cross-reference

- `registerentity-must-write-initial-attributes.md` — pairs with this on the write side for the registration-window crash.
- `onrep-invariants-must-be-preserved-by-restore.md` — when calling the OnRep yourself, watch for invariants.
- `expose-hook-via-multicast-not-ufunction.md` — same engine-edit pattern (add a `Ludeo_*` proxy for a protected method).
- `minimalapi-doesnt-export-methods.md` — the new public method needs `GAME_API` per-method export.
