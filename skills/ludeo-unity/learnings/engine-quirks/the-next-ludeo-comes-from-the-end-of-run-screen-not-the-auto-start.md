---
category: engine-quirks
tier: generalizable
sourceGame: IdleSample
phase: "5,7"
question: "Are you testing replay-to-replay, or the end-of-Ludeo behaviour, in a local run started with LudeoSettings autoStartInLudeo / ludeoToAutoStart?"
sanitized: true
---

# The next Ludeo comes from the end-of-run screen, not from the auto-start

**Observed on plugin 4.3.3; re-check on the installed version.** The local player flow is started with
`LudeoSettings.autoStartInLudeo` + `ludeoToAutoStart`. The plugin injects that id as `LudeoSelected` in
one place only, guarded by `LudeoManager.Instance.IsActivationCallbackWaiting`, so it fires once per
process, during activation. Nothing in the plugin produces a second local selection; any later
`LudeoSelected` comes from the backend.

## What happens when a played Ludeo ends (observed locally)

Earlier harness runs all left the replay after ~20 s, so nobody had seen this. A run that sends no input
and waits past the Ludeo's length (`durationMs` in the overlay's ready line) showed:

1. At `durationMs` the overlay logs that it intercepted `LudeoEnded`, then dispatches the end, win/lose
   and `FreezeGame` events.
2. The SDK raises **`PauseGameRequested`**, the "Ludeo is over" pause. It is **terminal**: no
   `ResumeGameRequested` follows, so your pause handling must freeze and stay frozen.
3. The overlay requests end-of-run recommendations, the "play next" Ludeos. **A second `LudeoSelected`
   is the viewer picking one of these.** `GameBackToMenuRequested` was not sent on its own.

If the recommendation service fails, the end screen has nothing to offer and the game correctly sits
frozen behind the overlay (a harness screenshot there may be black).

## How to apply

- Real local replay-to-replay needs (a) at least one other published Ludeo for the game, (b) the
  recommendation service up, and (c) a real click on a recommendation; a posted key or mouse message
  will not press an overlay button. Missing any of these, record replay-to-replay as a **cloud check**
  (phase 7).
- A harness step that re-selects through the layer (injecting a second selection) is a simulation of
  replay-to-replay, useful for the layer's re-entry path but not proof of the platform path.
- An observe-only scenario (no input after Play, watch the SDK notification lines and the overlay's
  dispatched events, screenshot on the first of each) cheaply turns guesses about the end-of-Ludeo
  sequence into a log.
- The end-of-Ludeo `PauseGameRequested` is the only locally reachable proof of the SDK-to-game pause
  direction. Check the freeze and your pause bookkeeping fired exactly once there.

See also [[room-ready-is-the-players-play-click]] and
[[stand-in-for-the-play-click-so-the-harness-can-replay-alone]].
