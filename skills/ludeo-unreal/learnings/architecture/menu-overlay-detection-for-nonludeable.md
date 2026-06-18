---
category: architecture
tier: generalizable
sourceGame: Lyra
phase: 2
question: "Does this game use CommonUI's UPrimaryGameLayout with activatable widget layers for its menu system?"
sanitized: true
---

# Menu overlay detection is required for NoneLudeable actions

Tick-polling `GetWorld()->IsPaused()` alone will NOT trigger `StartNoneLudeable`/`StopNoneLudeable` because multiplayer game modes typically don't pause via standard UE pause. The game needs an explicit mechanism to detect when a menu overlay opens and FORCE the pause.

**In Lyra (and CommonUI-based games):** Poll the UI layer system each tick:
```cpp
UPrimaryGameLayout* RootLayout = UPrimaryGameLayout::GetPrimaryGameLayout(LP);
UCommonActivatableWidgetContainerBase* MenuLayer =
    RootLayout->GetLayerWidget(FGameplayTag::RequestGameplayTag(TEXT("UI.Layer.Menu")));
bMenuOpen = (MenuLayer->GetActiveWidget() != nullptr);
```

When `bMenuOpen` transitions true → call `SetGamePaused(true)`. This causes `IsPaused()` to return true on the next tick, which triggers the `StartNoneLudeable` action via the pause detection code.

**Requires:** `CommonGame` and `CommonUI` module dependencies in Build.cs.

**Without this:** The SDK callbacks (`OnPauseGameRequested`) only fire for SDK-initiated pauses (Player Flow overlay). Game-initiated pauses (ESC menu) are invisible to the integration.
