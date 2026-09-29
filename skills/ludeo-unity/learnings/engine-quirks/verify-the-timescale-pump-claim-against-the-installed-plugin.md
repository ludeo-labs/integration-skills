---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "About to skip the Player-Flow pause because 'timeScale 0 stops the plugin's notification pump'? Open the installed plugin and find where it calls Tick(). If it ticks from LateUpdate, timeScale 0 does NOT stop it — only FixedUpdate stops — and you are about to drop a pause the docs require in four places."
sanitized: true
---

# The "timeScale 0 stops the notification pump" rule is version-dependent — check where the plugin ticks

There is a `universal`-tier learning in this corpus saying: never hold `Time.timeScale = 0` across an
SDK wait, because the plugin's notification pump stops and the callback never arrives. It was written
from a real observation — five minutes of total log silence, process alive, no error.

**In plugin 4.3.2 that precondition does not hold.** The pump runs from `LateUpdate`:

```csharp
// LudeoUnityManager.cs
private void LateUpdate()
{
    m_ludeoManager.Tick();
    m_mediaCaptureService.UpdateFrames(Time.unscaledDeltaTime);
}
```

Unity does not stop `LateUpdate` at `timeScale == 0` — it only stops `FixedUpdate` (and scales
`Time.deltaTime`). Media frames explicitly use `unscaledDeltaTime`. So a freeze across a wait is safe
on this version, and the observed five-minute silence must have come from an earlier plugin that ticked
from `Update`/`FixedUpdate`, or from a different cause entirely.

## Why getting this backwards is expensive

The Player-Flow pause is not optional decoration. The docs require it in four places — the flow is
*restore → settle → **pause** → wait for RoomReady → resume → BeginGameplay* — because **RoomReady is
the viewer connecting**, which can be minutes away. Drop the pause and everything the integration did
not explicitly suppress keeps running at full speed in the meantime: physics, trigger volumes, moving
platforms, hazards, scripted cameras, run timers. The state you carefully restored and verified decays
before anyone sees it, and the decay looks like a restore bug rather than a missing pause.

On the integration where this happened the plan even quoted the learning as justification, and the
reviewing agent confirmed it — from the learning's body, not from the plugin. Two agents agreed on an
unverified precondition.

## The check, and the nuance that makes the freeze safe anyway

```
grep -rn "Tick()" <plugin>/Runtime/ | grep -iE "Update|LateUpdate|FixedUpdate"
```

- ticks from `LateUpdate` → `timeScale = 0` is safe across an SDK wait.
- ticks from `FixedUpdate` → it is not; the original learning applies as written.
- ticks from `Update` → safe (Update runs at `timeScale = 0`), but verify nothing inside the tick path
  depends on scaled time.

And whichever way it goes, the docs already supply the ordering that removes most of the risk:

> After restoring game state in Player Flow, let the game run for a few iterations of your game loop
> **before** pausing. Pausing immediately after restore can cause missing updates.

So a settle of real frames between the apply and the freeze is prescribed, not a workaround — the
`CharacterController` and any `NavMeshAgent` need running frames to accept a teleport. Keep the settle,
then freeze.

## The transferable rule

**A `universal` tier tag is a claim about preconditions, not a promise about every SDK version.** When a
learning's precondition is a statement about *what the installed library does*, it is checkable in
seconds against the source you already have on disk — so check it, especially when the conclusion is to
*skip* something the official docs require. Cite the file and line in the plan, not the learning.

Related: [[timescale-zero-stops-the-sdk-notification-pump]] — the original observation, still correct for
whatever version produced it; this learning is the precondition check it needs, not a retraction.
And [[ask-what-your-check-cannot-see]] — reading the learning's body told us what was observed once, and
could never have told us what this plugin does.
