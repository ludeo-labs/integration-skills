---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: 6
question: "Is a room/area-cleared action derived from a lock or state change (Locked -> Unlocked/Resolved), and can a player death or respawn reset or reopen that lock?"
sanitized: true
---

# A death that reopens a room lock is not a "room cleared"

`RoomCleared` was sent when a room's state went from Locked to Unlocked/Resolved. In a recording run one room fired
it 0.04 s after `Death`, and again ~1.5 min later when the player really cleared it: the death sequence resets the
room and opens its lock on the way. The log gave it away — the action landed inside the "no Ludeo here" death stretch.

Fix: ignore lock openings while the game is in its death/respawn/restart states (keep recording the new state, so the
real clear after the respawn still counts), and log the skip so it can be seen at the gate. Test it by dying inside a
locked room during the phase-6 recording run.

The same check applies to any action derived from a state edge rather than from the player's own act: ask what else
can drive that edge (death, restart, restore, cutscene).
