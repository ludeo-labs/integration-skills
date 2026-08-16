---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "3,5"
question: null
sanitized: true
---

# In the player flow, RoomReady IS the player's "Play Moment" click — the whole flow hangs off that

The docs describe `RoomReady` as a room-lifecycle event and even warn against building a
"press to start" prompt. For the player flow that is exactly backwards, and building on the wrong
reading cost this integration several full days of misdiagnosis. The contract, stated by the
integration owner and matching ~10 shipped Unreal integrations:

```
LudeoSelected  (pushed by the platform — there is no in-game picking step)
  → GetLudeo, read the recorded world setup
  → load the recorded level          (the game's own transitions — see the entry-flow learning)
  → apply the restored state, settle, freeze     (see the settle learning)
  → OpenRoom + AddPlayer
  → WAIT, FROZEN — unbounded. The player is reading the pre-play screen.
  → the player clicks "Play Moment"  →  THAT is when RoomReady fires
  → BeginGameplay, unfreeze in Begin's callback
```

Consequences that are easy to get wrong:

- **RoomReady can arrive minutes after AddPlayer.** Any timeout armed on "room open → RoomReady"
  will false-fire; bound only the open+add-player leg (cancel the timer when the player is added)
  and leave the click wait unbounded.
- **There is no other SDK event for the click.** The Unity wrapper delivers eight notifications;
  none is "play confirmed". RoomReady is that notification. Anything the game must do "when the
  player presses play" goes in the RoomReady handler.
- **Everything must already be in place when the click lands** — level built, moment applied,
  world frozen. The click is a starting gun, not a preparation trigger.
- **Begin first, then unfreeze in Begin's callback** — recording must be live before the first
  moving frame.

Overlay event map (from the overlay's own logs; useful when diagnosing "the screen appeared at the
wrong time"): the pre-play screen's *content* (goals, time limit) is bound to the platform's
`gameplays.gameplay-ready`, which carries the roomId and therefore cannot exist before
OpenRoom+AddPlayer; clicks before it are dropped with "no roomId yet". The screen's *visibility*
was observed bound to `LudeoSelected` itself (before the game's callback even runs) — at the time
of writing that is an overlay-side defect against the intended room+player trigger, not something
the game can influence.
