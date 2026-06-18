---
name: engine-restore-helper-fires-bp-suppresses-one-shots
description: Don't call the engine's live-play setter (SetState/Activate/etc.) during Player Flow restore. Add a dedicated Ludeo_Restore* helper that fires the BP visual cascade with bIsInitialStateChange=true (or skips it entirely + destroys the actor when the visual depends on damage-event context).
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# Engine restore helpers must skip damage-event one-shots

Game actors typically expose a single state-change function (e.g. `SetState`, `Activate`, `BreakGlass`) that does double duty in live play:

1. **Updates internal state** (`bIsActive=true`, `State=Breached`, etc.).
2. **Fires one-shot live-play effects** — open/breach/close sounds, AI-noise hooks gated on `!bIsInitialStateChange`, dynamic-multicast broadcasts to BP listeners, particle/debris that depend on a damage-event's impulse + instigator.

Calling that same function from the Ludeo plugin during Player Flow restore is wrong in **two opposite ways** at the same time:

- **The one-shot effects fire when they shouldn't.** A breach sound playing 60s after the original breach is noise pollution. AI-noise hooks raise alarms retroactively. Dynamic broadcasts re-trigger BP listeners that already think the match is past that beat.
- **The visual cascade fails to fire when it should** — when the visual destruction is keyed to the damage event's impulse + BP context (smashed cosmetics scatter under the bullet's force, BP_OnActivated reads damage params), there is no live impulse on replay. The internal flag flips but the mesh just sits there. The actor becomes "internally broken but visually intact" — players can't re-trigger it.

## The pattern: add a dedicated `Ludeo_Restore*` helper

Gate the helper behind `LUDEO_OFFLINE_MODE`. Two shapes depending on whether the visual cascade can survive without damage-event context:

### Shape A — reuse the state-change internals with `bIsInitialStateChange=true`

When the engine has an `OnStateChangedInternal(OldState, bIsInitialStateChange, bIsLocallyInstigated)` (or equivalent) and the BP visual cascade keys off the `bIsInitialStateChange` flag to suppress sounds/dynamic-broadcasts/AI-noise, **route the helper through that flag**. The visual mesh swap, navlinks, collision changes, acoustic portals still fire; the one-shots stay quiet.

```cpp
// AGateActor.h
#if LUDEO_OFFLINE_MODE
void Ludeo_RestoreState(EGateState NewState);
#endif

// AGateActor.cpp
#if LUDEO_OFFLINE_MODE
void AGateActor::Ludeo_RestoreState(EGateState NewState)
{
    if (State == NewState) return;
    const EGateState OldState = State;
    State = NewState;
    OnStateChangedInternal(OldState, /*bIsInitialStateChange=*/true, /*bIsLocallyInstigated=*/false);
}
#endif
```

The reflection-write alternative (set the `State` byte via FProperty + skip the cascade entirely) was the original Phase 5 ActionGame shape. It worked for the data but left gate actors in "limbo" — internal `State=Breached` but the mesh stayed in its closed pose because `BP_OnStateChanged` never fired. Don't use the reflection shortcut when the engine already gives you the initial-state-change pathway.

### Shape B — skip the BP entirely + `Destroy()` (or hide) the actor

When the visual destruction is impulse-driven (e.g. `CosmeticDestructionActor::Activate()` only "works" visually because a bullet impulse was applied to the mesh's physics body in the same frame), there is no way to retroactively replay the visual. The cleanest replay is to match the **end state** of live play — for most destructible cosmetics, that's "actor gone" once the debris ring buffer rotates them out a few seconds later.

```cpp
// ACosmeticDestructionActor.h
#if LUDEO_OFFLINE_MODE
GAME_API void Ludeo_RestoreBroken();
#endif

// ACosmeticDestructionActor.cpp
#if LUDEO_OFFLINE_MODE
void ACosmeticDestructionActor::Ludeo_RestoreBroken()
{
    if (bIsActive) return;
    bIsActive = true;
    OnTakePointDamage.RemoveAll(this);
    OnGameTakeOverlapDamage.RemoveAll(this);
    // Skip OnActivated() BP and the physics-debris path. Both rely on the
    // damage event (impulse vector, instigator, damage-context particles)
    // which has no counterpart on replay. Match the end-state instead.
    Destroy();
}
#endif
```

Calling `Activate()` directly here is the trap. The actor goes through `SetMobility(Movable) + SetSimulatePhysics(true)` but has zero velocity → mesh just sits in place. Damage delegates are unbound so the player can't re-break it. Half-broken, half-not. `Destroy()` matches what the player sees a few seconds into live play anyway (the `DebrisActorsBuffer` rotates broken cosmetics out within seconds).

## How to choose between the two shapes

Look at the engine's existing state-change function. Is the cascade gated by an `initial-state-change` style flag that already suppresses one-shots? → Shape A. Does the visual cascade fundamentally require the damage event's impulse / instigator / hit-result? → Shape B (or hide the mesh + disable collision if outright destroying the actor is too coarse for your game).

## Per-method `GAME_API` (or your game's equivalent) export

If the actor's class is `UCLASS(MinimalAPI)`, the class only exports `StaticClass()`. The helper method needs the per-method export so the plugin can link to it. If the class is already fully exported (`class GAME_API AFoo`), don't add the per-method export — it triggers MSVC C2487 "redundant DLL interface" on some compilers.

The same applies to any getter the plugin needs to call from the capture side (e.g. `GetCurrentState()` becomes `GAME_API ESomeState GetCurrentState() const;`).

## How we got here

ActionGame hit this twice in close succession on the same Phase 5 work:

1. **Gate actors (windows + doors)** — restored via reflection-write on the `State` byte. Bytes matched capture but the BP visual cascade never fired. User saw "gates in limbo" — internally breached but visually closed.
2. **Cosmetic destruction actors** — restored via `Found->Activate()` (the live-play function). Cosmetics with `bDestroyWhenActivated=true` cleaned up correctly (the destroy path doesn't depend on impulse). Cosmetics without it (most of them) ended up "internally active, visually intact" because they switched to physics-simulation with zero velocity. User saw "half broken, half not broken" — and the unbroken ones couldn't be re-broken because damage delegates were unbound.

Both fixed by adding the helper per the patterns above. Same root cause: live-play state-change functions are coupled to live-play one-shot effects in ways that don't replay.

## Cross-references

- `learnings/common-mistakes/direct-field-assignment-bypasses-setter-side-effects.md` — the opposite failure mode (reflection-writing bypassed too much).
- `learnings/common-mistakes/one-writable-per-uobject-key.md` — when adding a separate writable per-aspect (e.g. a container actor + its destructible component), use distinct UObject keys.
- `learnings/common-mistakes/minimalapi-doesnt-export-methods.md` — per-method export rules for plugin-callable helpers.
