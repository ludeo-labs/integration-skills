---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "6,8"
question: "Can anything other than the player kill enemies - environment hazards, allies summoned by destructibles, kill planes, damage ticks - while the game's kill event fires only on player-attributed deaths?"
sanitized: true
---

# A replayed moment's goal needs every death credited, not just the player's

The moment's goal derives from the creator's recorded Kill actions, and the replay's enemy
population is finite. So every enemy the ENVIRONMENT finishes during playback is a kill the
player can never earn back - the goal becomes arithmetically unreachable while every
game-side system stays green (rooms clear, waves advance, nothing errors). In one game a
destructible object released an allied creature that killed enemies; a destruction-heavy
replay ran 17 kills short with no fault anywhere. Falls to the game's kill plane behaved
the same: silently deleted, sometimes silently credited to nobody.

The trap: the game's kill hook (the one phase 6 wires `SendAction` into) usually lives on
a stats/attribution path that only fires when the damage source resolves to a player.
Deaths with any other source never reach it.

**The fix pattern:**

- Hook the game's single death choke point - the state-machine entry that fires exactly
  once per death regardless of cause - and forward every death to the Ludeo layer.
- Judge one frame later: the player-attribution path runs in the same frame as the death
  and order between the two is not guaranteed. A death still uncredited on the next frame
  is a fact.
- Exactly-once: player-attributed kills mark a per-life credited set (route the existing
  kill hook through the controller so it marks before sending); the unattributed sweep
  skips marked ids; clear an id when its pooled instance despawns, and clear the whole set
  when a gameplay bracket begins.
- Gate on the play-flow flag (see the flow-switch learning) so capture and live play are
  untouched - the creator's goal must keep meaning "kills the creator personally made."

Symmetric warning: the creator side has the same asymmetry (their environment kills are
uncredited too), which is exactly why the replay must credit rather than the capture -
crediting during capture would inflate every new goal instead.
