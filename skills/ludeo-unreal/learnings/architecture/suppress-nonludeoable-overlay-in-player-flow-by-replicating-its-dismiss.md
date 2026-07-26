---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 3
question: "Does the game show a load-progress / intro / 'tip' overlay on level entry that appears in cloud replays (and often PAUSES the game while up)? If you want it gone in Player Flow, dismiss it the way its own Continue/close does — find the widget, fire its parameter-less dismiss delegate, RemoveFromParent, and unpause — rather than trying to prevent it from being created."
sanitized: true
---

# Suppress a non-ludeoable load/intro overlay in Player Flow by replicating its own dismiss

## Precondition

A level-entry overlay (load-progress screen, intro/briefing, "tip of the day") shows when the
playable level loads. It appears in **cloud replays** (real cold packaged load on the streamer makes
it visible; local fast/warm/PIE loads skip past it), it's unwanted in a Ludeo, and it commonly
**pauses the game** while up (`SetGamePaused`). You want it gone for Player-Flow replays.

## Why not "prevent it from showing"

The create/show site is usually buried in a data-driven UI/HUD manager and hard to pin (forward BP
graph tools can't always find it). You don't need it. The overlay is a known widget class, so in
Player Flow you can **dismiss it after it appears** — robust regardless of who showed it.

## The pattern

In the Player-Flow wait loop (each poll while waiting for the battle/level to set up), find the
overlay instance and do **exactly what its Continue/close button does**:

```cpp
for (TObjectIterator<UUserWidget> It; It; ++It)
{
    if (It->GetWorld() != World || !IsClassDerivedFrom(It->GetClass(), TEXT("WBP_<Overlay>_C")))
        continue;
    BroadcastMulticastDelegateNoParams(*It, TEXT("OnContinueClick")); // replicate the button (param-less)
    It->RemoveFromParent();                                            // remove the widget
}
if (bRemovedAny && World->IsPaused())
    UGameplayStatics::SetGamePaused(World, false);                     // it paused the game — undo it
```

Three parts matter:
1. **Replicate the dismiss, don't just hide it.** Firing the overlay's own param-less dismiss
   delegate (broadcast it via reflection — guarded to *only* fire if the signature has no params, so
   you can't pass a mismatched frame) lets the game's own continue/proceed logic run. `RemoveFromParent`
   is the visual backstop.
2. **Undo the pause.** These overlays usually `SetGamePaused(true)`. If you only remove the widget,
   the game can stay paused — which **stalls a Player-Flow restore that waits *unpaused* for setup**.
   So this isn't only cosmetic; it can be required for the replay to proceed.
3. **Do it in the wait loop**, so it's killed the moment it appears (it can show before your component
   even exists, or persist waiting for a click).

Gate the whole thing on `bIsPlayerFlow` — the overlay is part of the real player's experience during
Creator capture; only the replay should suppress it.

## How to identify the overlay (when you don't know which widget)

The on-screen text maps straight to the owning widget via the localization `.po` files: grep the
exact text the user saw (e.g. a tip line) in `Content/Localization/.../Game.po`; the `SourceLocation`
field names the widget path. Faster and surer than booting the editor to hunt BP graphs.

## Cross-reference

- `architecture/zero-arg-bind-to-bp-event-dispatcher-via-reflection.md` — the bind counterpart; this
  uses the *broadcast* counterpart (`BroadcastMulticastDelegateNoParams`, param-guarded).
- `architecture/pause-menu-non-ludeoable.md` / non-ludeoable handling — same family of concern.
