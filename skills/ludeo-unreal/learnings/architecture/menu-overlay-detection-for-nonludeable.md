---
category: architecture
tier: generalizable
sourceGame: Lyra
phase: 3
question: "Does this game use CommonUI's UPrimaryGameLayout with activatable widget layers for its menu system?"
sanitized: true
---

# Menu overlay detection is required for the pause trigger to fire

Tick-polling `GetWorld()->IsPaused()` alone will NOT trigger the pause actions because multiplayer game modes typically don't pause via standard UE pause. The game needs an explicit mechanism to detect when a menu overlay opens and FORCE the pause.

**In Lyra (and CommonUI-based games):** Poll the UI layer system each tick:
```cpp
UPrimaryGameLayout* RootLayout = UPrimaryGameLayout::GetPrimaryGameLayout(LP);
UCommonActivatableWidgetContainerBase* MenuLayer =
    RootLayout->GetLayerWidget(FGameplayTag::RequestGameplayTag(TEXT("UI.Layer.Menu")));
bMenuOpen = (MenuLayer->GetActiveWidget() != nullptr);
```

When `bMenuOpen` transitions true → call `SetGamePaused(true)` (or the game's own pause mechanism). This causes the polled pause signal to flip on the next tick, which sends **`PauseLudeo`** via the pause detection code — the action that actually stops the Ludeo objective timer. An ESC menu is a *pause*, so it takes the Pause/Resume trigger type in **either flow**, not `StartNoneLudeable` (that type keeps the timer running — phase 03 §5.9.1).

**Requires:** `CommonGame` and `CommonUI` module dependencies in Build.cs.

**Without this:** the SDK's `OnPauseGameRequested` fires only for SDK-initiated pauses (the Player Flow overlay), so game-initiated pauses are invisible to the integration and the objective timer keeps counting down through every ESC menu. Note the converse too: if the game never flips the polled signal at all, the detector also misses the *SDK's* pause — then send the action from the request handler and let `bTriggerSpanOpen` keep it to one report.
