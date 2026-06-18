---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# Use `SetIgnoreMoveInput` / `SetIgnoreLookInput` to gate player interaction without pausing

## The rule

When Player Flow needs the game ticking (e.g., waiting on an async load — see `dont-pause-during-async-load-waits.md`) but the player must not see/move the scene, disable input on the PlayerController instead of pausing:

```cpp
PC->SetIgnoreMoveInput(true);
PC->SetIgnoreLookInput(true);
// ... wait ...
PC->SetIgnoreMoveInput(false);
PC->SetIgnoreLookInput(false);
```

These flags are reference-counted booleans on `APlayerController` that block the corresponding input axes without affecting tick, replication, or async load pipelines.

## Symptom this fixes

User report: "I can still see the scene and move around until the overlay pulls up."

Root cause: the wait window is unpaused (correctly, so the async load can complete), but the player can move, look, and sometimes fire during that window.

## Where to enable/disable in the Player Flow sequence

- **Enable (set `true`):** right after pawn-poll succeeds, before unpausing for state apply. Pawn is possessed at that point, so `SetIgnoreMoveInput` takes effect immediately.
- **Disable (set `false`):** in `TryBeginGameplay` after the final unpause, before gameplay hands off to the player.

## Why not use pause or `DisableInput`?

- **`SetGamePaused(true)`** stops tick → blocks the async load we're waiting for (see `dont-pause-during-async-load-waits.md`).
- **`DisableInput(PC)`** is reference-counted but behaves differently — it requires the input component to have been pushed onto the input stack, and matching `EnableInput` calls. Fragile to call order.
- **`SetCinematicMode`** works too (and also hides HUD) but is heavier and affects more subsystems than needed for this specific use case.

`SetIgnoreMoveInput/LookInput` is the minimum targeted primitive for "let the game tick, stop the player from interacting."

## Edge case

If the game uses gamepad vibration or screen shake that the player can still perceive during the wait, these aren't blocked by input-ignore. Usually not worth addressing unless it's disruptive.

## Related

- `dont-pause-during-async-load-waits.md`
- `gate-openroom-on-loadout-ready.md`
