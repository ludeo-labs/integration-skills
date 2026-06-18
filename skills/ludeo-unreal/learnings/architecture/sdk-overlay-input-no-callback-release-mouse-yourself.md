---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: 2
question: "When the Ludeo overlay shows an interactive screen (e.g. the PrePlayScreen 'Play Moment'), does OnPauseGameRequested fire? (Usually NO — verify in the log.) If the game captures the mouse (FPS: Game-Only input + hidden cursor), the GAME must release it itself, at the Player-Flow overlay window, using the game's OWN input-release path — not a one-shot SetInputMode."
sanitized: true
---

# The SDK overlay's input has no UE callback — release the mouse yourself, the game's way

## Precondition

The integration shows the interactive Ludeo overlay (e.g. the `PrePlayScreen` with its "Play Moment" button) AND the game captures the mouse during gameplay (an FPS: game-only input mode + hidden/locked cursor), and/or the game drives input/cursor through its own system rather than raw `APlayerController::SetInputMode`.

## Symptom

The Ludeo overlay is clearly visible but its buttons (e.g. "Play Moment") are **not clickable** — the game swallows the mouse. Reproduces both locally and on the cloud (locally you can alt-tab out; on the cloud you can't, so it's a hard blocker).

## Three root causes (all verified from the logs)

1. **No UE callback for the overlay's input.** `OnPauseGameRequested` / `OnResumeGameRequested` do **not** fire when the overlay appears — verified by counting log occurrences (0). The SDK manages overlay input **internally** via overlay-level events (`LudeoBlockGameMouseInput` / `LudeoSubscribeMouseInput`, carrying `GameMouseInput: 0/1` flags). These are **not** exposed as UE session delegates. So you cannot hook "overlay shown → release mouse" off a pause callback.
2. **The overlay shows during Player Flow, not in a menu/idle state.** The `PrePlayScreen` appears right after the room opens in Player Flow (in the restore/pause window). Hook the release there — not in any frontend/idle handler.
3. **A one-shot `SetInputMode` does not stick.** `SetInputMode(FInputModeGameAndUI) + SetShowMouseCursor(true)` had no effect, because the game re-asserts game-only input every frame / via its own event-driven input system.

## Fix — use the game's OWN input-release path

Find the function the game's **pause menu** calls to free the mouse (the pause menu already releases it correctly — use the BP call-graph to find it). In this game that HUD function: creates a software cursor widget, calls `SetMouseCursorWidget` on the PlayerController, and fires a `GameEvent` to the player pawn that makes it release look/move input. Invoke **that** function (via reflection / `ProcessEvent`) — it sticks because it's the path the game itself trusts. Call its inverse when real gameplay resumes.

Apply it at the **Player-Flow overlay window** (when you pause for restore / open the room — where the SDK shows the `PrePlayScreen`), and reverse it in the resume step.

```
// At the Player-Flow restore pause (PrePlayScreen is about to show):
CallGameFunction(GameHUD, "<the HUD's UI-input-enable fn>");   // the pause menu's release path
// ... + a belt-and-suspenders engine SetInputMode(GameAndUI)+ShowMouseCursor
// On gameplay resume:
CallGameFunction(GameHUD, "<the HUD's UI-input-disable fn>");
```

## Cosmetic caveat (defer until cloud-tested)

The game's own cursor-widget may render **behind** the Ludeo overlay in the editor. On the cloud the overlay has its own cursor and composites differently, so confirm on the cloud before polishing. The clean version, if needed, is to fire only the player input-release `GameEvent` **without** the game's `SetMouseCursorWidget`, so only the overlay's cursor shows.

## Related

- `verify-sdk-callback-fires-before-hooking.md` — how root cause 1 was found (and the wasted attempt avoided).
- `custom-pause-via-timedilation-not-engine-pause.md` — same theme: the game has its own input/pause systems; drive them, don't fight them with raw engine calls.
