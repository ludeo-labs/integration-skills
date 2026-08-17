---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: 5
question: "Does the game populate rooms/encounters through a start trigger (first wave, proximity, door crossing) that must still fire for fights the player reaches during a replay's forward play?"
sanitized: true
---

# A global replay gate on wave triggers starves untriggered encounters

To stop the game spawning a fresh first wave on top of restored enemies, the integration
gated the encounter start path on "a Ludeo is playing" — globally. That gate is correct
for exactly one case (an encounter restored mid-fight) and wrong for every other:

1. **An encounter not yet triggered at the restore point** (the restore point is the clip
   START, which can predate the fight — see the companion architecture learning) sits
   empty; only later waves arrive, on a timer, undersized.
2. **Every room the player enters during the replay's forward play** never spawns at all —
   the moment plays out over a dungeon that has gone inert.

Both were observed in one replay: the first room spawned late and thin (a later wave on
the wave timer, first wave suppressed), the second room spawned nothing.

## The correct shape

- **Capture whether each encounter had started** (the game's own started flag), not just
  its wave cursor. At clip start the flag is the difference between "fight in progress —
  restore it" and "player hadn't triggered it — leave it alone".
- **Restore only started encounters.** Marking a restored encounter as started makes the
  game's *own* "already started" guard block its first-wave path — no Ludeo condition
  needed in game code.
- **Delete the global gate.** Untouched encounters (not started at capture, and every room
  reached later) then start through the game's normal trigger, exactly as in the
  recording.
- A restore-side one-liner had also been marking every captured encounter "started"
  unconditionally — restoring a value the recording never held. Restore the recorded
  flag, don't synthesize it.

Cheap verification: for an encounter deliberately left untouched, register a check that it
is still *untriggered* at the restore checkpoints — leaving something alone is also a
decision the game can silently override.
