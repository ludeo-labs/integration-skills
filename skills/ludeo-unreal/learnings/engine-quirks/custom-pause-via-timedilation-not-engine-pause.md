---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 2
question: "How does this game pause? Does its pause function call UGameplayStatics::SetGamePaused, or a custom path (per-actor CustomTimeDilation=0, AWorldSettings::PauserPlayerState, or just a bool flag)? If custom, World->IsPaused() will NOT detect it — read the game's own pause signal for non-ludeoable segment marking."
sanitized: true
---

# A game's "pause" may not be engine pause — World->IsPaused() can miss it

## Precondition

The game implements its own pause instead of (or in addition to) `UGameplayStatics::SetGamePaused`. Verify before relying on `World->IsPaused()` for Stage 5 segment detection. This holds whenever the pause function does NOT call the engine pause API.

## What happens

`phase-05` §5.2 suggests polling `GetWorld()->IsPaused()` to detect game-initiated pauses (ESC menu). But some games freeze gameplay **without** engine pause:

- Setting `CustomTimeDilation = 0.0` on tagged/relevant actors and a `bool` "paused" flag (the case here — confirmed via the BP call-graph: the pause function sets the flag, broadcasts a "paused-changed" delegate, then iterates actors-of-class / actors-with-tag and zeroes their `CustomTimeDilation`; it never calls `SetGamePaused`).
- Setting `AWorldSettings::PauserPlayerState` via a custom network-aware path (see the companion learning for a controller-driven variant).

In all of these, `GetWorld()->IsPaused()` returns **false** while the game is, to the player, paused. A Stage 5 pause-segment detector built only on `IsPaused()` silently never fires `StartNoneLudeable`/`PauseLudeo` for the ESC menu.

## How to confirm + what to do

1. Find how ESC / the pause menu actually pauses. Run the BP call-graph on the game's pause function (or grep the player controller / game-state hierarchy for `SetPause`, `PauserPlayerState`, `PausedPreferred`, `CustomTimeDilation`, a `bPaused`/`Paused` flag).
2. If it's a custom path, detect the game's **own** pause signal, not `World->IsPaused()`. When the pause flag lives on a class you already reach (here the flag is on the game-state Blueprint, which is the component's owner), read it directly via reflection:

```cpp
bool bGamePaused = false;
LudeoReflect::GetBool(GetOwner(), TEXT("Paused"), bGamePaused);   // game-state's own flag
```
3. OR the engine pause path (SDK overlay / Player Flow restore uses `SetGamePaused`). A robust detector OR's both:

```cpp
bool IsInNonGameplaySegment() const
{
    if (GetWorld() && GetWorld()->IsPaused()) return true;        // SDK overlay / engine pause
    bool bGamePaused = false;
    if (LudeoReflect::GetBool(GetOwner(), TEXT("Paused"), bGamePaused) && bGamePaused) return true; // custom pause
    // ... plus any HUD-overlay signal (see hud-active-screen-enum-as-nongameplay-signal)
    return false;
}
```

## Side effect worth noting

Because a `CustomTimeDilation` pause leaves the world ticking (only the dilated actors freeze), your component keeps ticking at normal rate during it — which is actually convenient for catching the resume edge. But it also means a poll loop that skips work "only when `World->IsPaused()`" will keep running during the custom pause; gate those on the game's pause signal too.

## Related

- `actiongame-uses-setpausedpreferred-not-setgamepaused.md` — a different custom-pause mechanism (controller `SetPausedPreferred` → `PauserPlayerState`). Same lesson: find the authoritative pause path; don't assume engine pause.
- `hud-active-screen-enum-as-nongameplay-signal.md` — complementary signal for UI overlays (inventory/menus).
