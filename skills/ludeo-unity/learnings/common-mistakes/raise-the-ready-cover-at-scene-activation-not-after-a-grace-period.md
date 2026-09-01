---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "Are you showing the readiness-gate cover lazily - only once the control hold outlives a grace period - so that the healthy path stays invisible?"
sanitized: true
---

# Raise the ready cover **at scene activation**, not after a grace period

The tempting optimisation: the cover is only there for a stalled gate, so show it lazily — start a timer
when the control hold is taken and only cover the level if the hold outlives N seconds. That keeps the
healthy path completely invisible.

It also produces a **visible flash** the first time the gate takes longer than N: the level renders
normally, a black screen drops over an already-visible level, and then the level comes back. An
integrator reported it as *"it loads the level, then goes black, then wakes up and shows the overlay."*
That reads as a bug even though every gate decision underneath was correct.

**Raise the cover in the same handler that takes the hold** — `SceneManager.sceneLoaded`, which fires
after the new scene's `Awake`/`OnEnable` and **before its first rendered frame**. The player then sees
load → cover → level, which is indistinguishable from an ordinary loading screen, and it matches the
launch-and-readiness doctrine literally ("gameplay scene loads NOW + a 'ready' cover … release the cover
when `Begin` lands").

The lazy version's one real advantage — not covering a run that was never going to be captured — costs
nothing to keep, because the decline path is synchronous: when consent is already known to disallow
creating, the capture-declined signal fires inside the same `sceneLoaded` frame and hides the cover
before anything is rendered. Order the handler `Hold()` → `Cover.Show()` → notify, and the no-capture
case never shows a frame of cover.

That leaves the watchdog as a **pure bounded timeout** (release the hold and drop the cover after N
seconds so an offline player is never stuck), with no cover logic in it at all — simpler than the
version it replaces.

**Where the cover genuinely is longer than a beat:** an Editor direct-play, where there is no menu to
absorb the `Activate` + consent round-trip, so the cover can sit for a couple of seconds before `Begin`.
That is the honest rendering of "the player does not have control yet" and it is only the developer's
path — the shipped menu flow resolves consent long before the level loads.
