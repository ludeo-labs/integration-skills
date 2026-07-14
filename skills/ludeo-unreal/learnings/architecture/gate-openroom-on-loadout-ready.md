---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "Does the game async-load the player's loadout (weapons, cosmetic mesh, abilities) after the level loads? If yes, find the 'loadout-ready' signal (accessor + delegate) and gate OpenRoom on it."
sanitized: true
---

# Gate `OpenRoom` on loadout-loaded before calling it in Player Flow

## Precondition

This applies when:
- The game async-loads player loadout assets (weapons, cosmetic meshes, GAS ability granters) after the level itself loads.
- The level Blueprint's action-phase handler defers gameplay dialog, objective spawns, or other "ready" work until after loadout is loaded.
- Loading takes enough time (~1–2 s) that a user can reach and click the Ludeo "play" button before it completes.

## Symptom

Player Flow restores state, pawns are in position, but:
- Briefing voiceover still plays (even with a dialog-manager mute in place).
- Weapon equip delayed or missing on spawn.
- Cosmetic transition animates visibly instead of being instant.

User reports: "if I wait a few seconds before clicking play, it works."

## Root cause

Our Player Flow calls `OpenRoom` based on pawn-exists, but the loadout hasn't finished async-loading yet. Level BP defers its `PlayDialog(briefing)` until loadout is ready. By the time loadout loads and the BP fires `PlayDialog`, `TryBeginGameplay` has already completed, `ResumeAfterLudeoBoot` has flipped `bCanPlayDialogs = true`, and the dialog gate no longer blocks anything.

## Fix

Before calling `TryOpenRoom`, wait for the "loadout loaded" signal on the local player state. Two cases:

1. **Already loaded** — proceed immediately (with a small settle buffer for mesh LODs).
2. **Not yet loaded** — bind to the delegate, add a safety timeout in case the load never completes. Proceed on either signal.

Pattern (adapt class names per game):

```cpp
APlayerStateBase* PS = Cast<APlayerStateBase>(PC->PlayerState);
auto ScheduleProceed = [this]() { /* N-frame buffer → pause → TryOpenRoom */ };

if (!PS || PS->IsLoadoutLoaded())
{
    ScheduleProceed();
}
else
{
    TSharedPtr<FDelegateHandle> Handle = MakeShared<FDelegateHandle>();
    TSharedPtr<bool> Done = MakeShared<bool>(false);
    *Handle = PS->OnLoadoutLoadedDelegate.AddLambda(/* once-guarded, calls ScheduleProceed */);
    FTicker::GetCoreTicker().AddTicker(/* 5s safety timeout with same once-guard */, 5.0f);
}
```

## Why this is safe for the SDK

The Ludeo SDK does nothing until `OpenRoom` + `AddPlayer` are called. Delaying `OpenRoom` on the game side costs nothing on the SDK side. The SDK is still waiting for us.

## Questions to answer per new game

- What class holds loadout-load state? Usually the `PlayerState` subclass, but could be a GAS `AbilitySystemComponent` or a loadout manager subsystem.
- What's the public accessor? `IsLoadoutLoaded()`? `IsReady()`? `HasEquippedLoadout()`?
- What's the delegate? `OnLoadoutLoadedDelegate`? `OnLoadoutReady`?
- Are there secondary async loads (cosmetic mesh, weapon mesh) that lag behind the primary loadout-loaded signal? If so, add a short fixed buffer (~30 frames) after the delegate fires.

## Related

- `dont-pause-during-async-load-waits.md` — the wait window must be UNPAUSED.
- `use-ignore-input-during-player-flow-wait.md` — how to keep the player from interacting during the unpaused wait.
- `dialog-mute-window-must-bracket-all-deferred-triggers.md` — the reason gating OpenRoom matters for dialog-mute to work.
