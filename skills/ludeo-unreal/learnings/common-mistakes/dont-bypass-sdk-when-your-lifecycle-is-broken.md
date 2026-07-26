---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: "An SDK notification (OnRoomReady, pause/resume, etc.) worked on the first room/session but is missing on a LATER one — before bypassing the SDK, adding a timeout, or theorizing an SDK limitation"
sanitized: true
---
# Don't bypass SDK callbacks when the real bug is a broken lifecycle on your side

## What happened
ActionGame in-place Ludeo reset: after the first play, the SDK sent `PauseGameRequest` once and our handler paused correctly. On the SECOND Ludeo played via in-place reset, the SDK never broadcast `PauseGameRequest` again. The agent suggested "stop relying on the SDK's pause request, pause ourselves when we detect the overlay is open."

The user rejected this firmly. The suggestion was wrong because:
1. This SDK callback "100% works in other games" — the SDK does broadcast pause requests reliably for every overlay open.
2. If it's NOT broadcasting on our game, WE are doing something that breaks the SDK's state, not the SDK.
3. Working around the SDK via a game-side hook masks the real bug and diverges from the canonical integration pattern.

## The real bug to look for
In this case: our in-place reset called `EndGameplay()` which starts an async teardown chain (EndGameplay → RemovePlayer → CloseRoom → OnRoomClosed), but then immediately called `DestroyComponent()` — which cancels all pending SDK callbacks via WeakObjectPtr self-cancel. The old room never properly closes on the SDK side. Subsequent overlay opens route pause notifications to the zombie room instead of the new room.

Fix: await `OnRoomClosed` before destroying the component and creating the new one. Proper lifecycle, not a hack that papers over it.

## The rule
When an SDK callback works in one scenario but not another on YOUR game, assume YOU are breaking the SDK's state. Never suggest "bypass the SDK and do it ourselves" as a fix. Find what in your lifecycle / state management is wrong, and fix that.

If you're tempted to bypass an SDK mechanism:
1. First confirm the mechanism works at all in your game (it did the first time).
2. Then identify what changes between "works" and "doesn't work."
3. The change is almost always something you did (component destroyed mid-teardown, binding lost, state out of sync) — not an SDK limitation.
