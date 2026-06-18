---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 2
question: "Does the game have a multi-step async boot flow (state machine, metadata fetch, loadout setup) that runs between GameInstance::Init and the main menu appearing?"
sanitized: true
---

# SDK activation HTTP traffic can starve the game's async boot chain

## Precondition

This applies when:
- The game has a multi-step asynchronous boot flow (e.g., state machine: SubsystemInit → Login → FetchMetadata → SetupLoadout → ShowMainMenu)
- The boot flow relies on async callbacks (asset loads, delegate chains) firing between frames
- `ludeo_Tick()` runs on the game thread and processes SDK HTTP responses synchronously

## Problem

`ludeo_Tick()` processes ALL pending HTTP responses and fires their callbacks on the game thread. During SDK activation, the sequence is: `auth → config (19KB JSON) → attributes → actions → SessionActivateComplete`. Each step involves an HTTP request.

If any of these requests are slow or the backend marks them as "blockers" (the SDK config has `isBlocker: true` on several actions like `SessionActivateComplete`), `ludeo_Tick()` can hold the game thread for seconds at a time.

In ActionGame, the game's boot flow depends on async delegate chains (e.g., `SetPlayerLoadout → OnSetupCharacterLoadoutsDone`) that fire on the next frame. If `ludeo_Tick()` starves the game thread during the frame where those callbacks should fire, the boot chain stalls and the loading screen hangs indefinitely.

## Evidence

ActionGame log showed:
- `ludeo_Tick` running at 0.035 ticks/sec during boot (1 tick per 28 seconds)  
- SDK processing 19KB config JSON, then attributes, then actions — all within those rare ticks
- Game's `OnSetupCharacterLoadoutsDone` callback never firing (starved by SDK work)
- Result: permanent "Getting ready..." loading screen

The Lyra reference integration has the same activation pattern (also in `Initialize()`) but Lyra's boot flow is simpler — no multi-step state machine with async delegate chains that can be starved.

## Mitigation Options

1. **Filter component attachment** (implemented): Don't attach the Ludeo component to non-gameplay worlds (MainMenu, lobby). This prevents room open + state tracking from running during boot, which was the primary source of SDK HTTP traffic during the boot window. See `component-attaches-to-all-gamestate-including-menu.md`.

2. **Defer activation** (alternative): Move `ActivateSession()` to fire after the main menu is fully loaded, rather than during `GameInstanceSubsystem::Initialize()`. Listen for a state machine state change or a "menu ready" delegate.

3. **SDK-side fix** (ideal): The SDK should not block the game thread during `ludeo_Tick()`. Blocker actions should have a timeout-per-tick limit so the game thread isn't held for more than a few milliseconds per frame.

## How to Apply

During Stage 2, after implementing the subsystem:
1. Verify the game boots to main menu with the plugin enabled
2. If boot hangs, check log for `ludeo_Tick` frequency — if < 1 tick/sec during boot, SDK is starving the game thread
3. Apply mitigation #1 first (cheapest fix), then #2 if needed
