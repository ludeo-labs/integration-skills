---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does your replay gate its begin on the SDK's RoomReady - the platform connecting a user, i.e. someone pressing Play on the pre-play screen? Then no automated run can get past 'restored and waiting', and every fault that only shows once the game RUNS needs a human. Add a fenced test hook that takes the same path RoomReady takes."
sanitized: true
---

# Stand in for the Play click, so a harness can replay a clip with nobody at the keyboard

In the Player Flow the game restores the moment, holds it still, and waits for `RoomReady` - the
platform saying a user is connected, which in practice is a person pressing Play on the pre-play
screen. Everything before that is automatable and was: the harness could boot, select a clip, watch
the world rebuild, watch the restore apply and settle, and read the layer's own checks. Then it sat
there, because nothing presses Play.

That gap is exactly where the first real fault lived. Every check passed at "restored and waiting".
The fault - an already-accepted objective re-offered behind an undismissable screen - only existed
once the game ran, and only a human could get it to run.

## The hook

One method on the controller, taking the same path the real notification takes:

```csharp
#if UNITY_EDITOR || DEVELOPMENT_BUILD || LUDEO_AGENT
public void AgentSimulateRoomReady()
{
    m_roomReady = true;
    TryBeginAfterRoomReady();     // the real handler's body, minus the SDK callback data
}
#endif
```

Fenced so a shipped player has no such door. Because it enters the real begin gate, everything
downstream is exercised as it would be for a player: the other legs of the gate (player added, scene
ready, restore applied), the unfreeze, the input release, and the SDK's own `BeginGameplay`.

**What it does not do** is tell the platform a user is connected. Whether the SDK accepts a begin in
that state was an open question - here it did, gameplay went active on the same frame and the SDK's
own `GameplayBegin` fired. Treat that as measured for this SDK version, not guaranteed.

## The scenario around it

Wait for the layer's "restore applied" flag → call the hook → wait for "gameplay active" → then
**sample the running game once a second** for the things only a running game gets wrong:

| Watch | Because |
|---|---|
| run clock advances, never retreats | a retreat is a second level-entry running over the moment |
| time scale not stuck at 0 | the freeze was not lifted, or something re-took it |
| input not still suppressed | the release did not happen |
| reward / modal screens, **with their type and the moment they open** | a screen in the first couple of seconds the clip did not have open is a re-offer; one arriving later is the running game earning it |
| enemies on the field, player position and health | is it actually a fight |

Write the table to disk, judge only the regressions (the first row's fault class, and a screen at
t≈0), and *note* the rest. The first pass of this harness failed a run for a reward screen that
opened 13 seconds in - which was the game legitimately handing out the next one. A harness that
cannot tell "re-offered" from "earned" fails every replay that works.

## What it cannot do

Click. A screen that opens is recorded, not dismissed, so time holds from there and the observation
window ends on a paused game. Whether the screen's button is *clickable* - the integrator's actual
complaint - still needs a person once. Say so in the report rather than implying the harness covered
it.
