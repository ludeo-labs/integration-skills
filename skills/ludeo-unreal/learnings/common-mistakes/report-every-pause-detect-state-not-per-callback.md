---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---
# Send the pause trigger for every pause — detect the state change, don't wire it per callback

## What happened
The agent put `SendPauseAction()` (which calls `RoomWriter.SendAction("PauseLudeo")`) directly inside `OnPauseGameRequested` — the SDK's own callback asking the game to pause. The action itself **is** required for that pause; the problem was the wiring. Hanging it off the callback covers only SDK-initiated pauses and misses every pause the game originates (ESC menu, cutscene, loading screen, focus loss), and it double-reports if a state detector is also running.

## The action is not optional — on any environment
Freezing the game does **not** stop the Ludeo objective timer. The timer is frozen server-side only when the game's tracked pause event reaches its Studio Lab **Global Trigger** (`SendAction` → `game.events` → the trigger's `PAUSE_KEY` action → `stateManager.pause(eventTime)`). The platform does not infer the pause from having requested it, so:

- **Responding to `OnPauseGameRequested` is necessary but not sufficient.** Freeze *and* report.
- The player client's own internal `PauseLudeo` event is a different thing — a UI-layer `FREEZE_GAME` command to the game process. It does not stop the server-side clock.

## The correct pattern
Report on the **game's actual pause state change**, detected by polling the game's pause signal in `TickComponent` with `bTickEvenWhenPaused = true`. A transition detector is origin-blind, which is exactly what's wanted here: one emit covers the SDK request, the ESC menu, cutscenes, and focus loss without per-origin wiring.

- **SDK → Game:** `OnPauseGameRequested` → freeze (`SetGamePaused`, input, physics). Don't open the game's own pause menu — the overlay is already up.
- **Game → SDK:** the detector observes *paused* → sends `PauseLudeo`. Every pause, exactly once.

Guard with `bTriggerSpanOpen` so a pause observed through two paths reports once and a resume never fires without a matching start. The goal is **every pause exactly once** — not "skip the ones the SDK asked for."

Caveat: if the game pauses without flipping the signal the detector polls (custom `Paused` bool, `CustomTimeDilation`), the detector never fires and the overlay pause goes unreported — see [[custom-pause-via-timedilation-not-engine-pause]]. Then send it from the handler and suppress the duplicate.

## Phase 3 reference
§5.9.1 — the two directions, and why the freeze alone doesn't stop the clock; §5.9.2–5.9.3 — the detector and `bTriggerSpanOpen`; §5.9.4 — the request handlers; §8.30 — freezing without sending the trigger; §8.31 — reporting the same pause twice.
