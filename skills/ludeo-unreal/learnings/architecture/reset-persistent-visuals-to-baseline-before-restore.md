---
category: architecture
tier: generalizable
sourceGame: multiple
phase: 4
question: "Does the default level load leave persistent VISUAL state (decals, active VFX/particles, HUD/UI widgets, lingering post-process) that restore then layers on top of? If yes, reset those visuals to baseline in Player Flow before applying restored state."
sanitized: true
---

# Reset persistent visuals (decals / VFX / UI) to baseline before restore — Player-Flow-scoped

## Precondition

The "reset to a clean baseline before applying restored state" discipline is well established for
**entities** (destroy the game's default spawns) and **inventory** (clear defaults before
re-adding). This learning extends the same discipline to **persistent visual state**: decals,
active VFX / particle systems, HUD / UI widgets, and lingering post-process the default level
load produces before Player-Flow restore runs.

## Problem

A fresh level load paints its own visuals — blood/scorch decals from scripted intro beats, an
ambient VFX emitter, the default HUD, a full-screen intro widget. Player Flow then **applies
restored state on top** without clearing them. The result is restored visuals layered over stale
ones: doubled decals, an orphaned emitter that should not exist in the restored moment, a HUD
element showing the fresh-load value, an intro widget still up over the restored gameplay.

This is the visual analog of the duplicate-entities bug — same root cause (apply-over-default
instead of reset-then-apply), different surface.

## Fix

In the Player-Flow restore entry, **before the apply pass**, clear residual visual state to a
known baseline — scoped to `bIsPlayerFlow` so normal play is untouched:

```cpp
void ULudeoComponent::ResetVisualBaselineForPlayerFlow()
{
    if (!bIsPlayerFlow) return;

    // Decals the default load stamped
    for (TActorIterator<ADecalActor> It(World); It; ++It) It->Destroy();
    // Ambient / scripted VFX emitters
    for (TActorIterator<AAmbientEffectActor> It(World); It; ++It) It->Deactivate();
    // Fresh-load / intro widgets
    HUD->ClearTransientWidgets();
}
```

Then apply restored state; anything the moment legitimately had comes back through the normal
restore path (see `cold-spawned-actors-need-explicit-state-restore-for-cosmetics.md`).

## Scope by load-bearing vs cosmetic

- **Load-bearing residue** (a UI widget that captures input, a VFX that implies live state) →
  clear it as part of **core restore (Phase 4)**; leaving it changes behavior.
- **Purely cosmetic residue** (a stray decal, a background emitter) → can defer to **Phase 8
  polish**, but track it so it is not forgotten.

## How to apply

Player Flow (Phase 4): enumerate what the default level load leaves behind visually (decals,
persistent emitters, widgets, post-process volumes). For each, decide reset-to-baseline vs
restore-explicitly. Clear the residue before the apply pass; restore what the moment actually had
afterward.

## Related learnings

- `destroy-default-spawns-before-restoring-tracked.md` — the entity-side sibling of this pattern.
- `reconstruct-inventory-via-game-additem.md` — the inventory-side sibling (clear defaults, then re-add).
- `cold-spawned-actors-need-explicit-state-restore-for-cosmetics.md` — the *apply* side: restore state-driven cosmetics explicitly after the baseline is clean.
