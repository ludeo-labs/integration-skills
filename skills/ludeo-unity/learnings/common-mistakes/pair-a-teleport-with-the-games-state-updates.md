---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Before calling a game's low-level teleport/placement method from the restore, read the game's OWN call sites of that method: do they pair it with sibling state updates (room membership, spatial index registration, camera notification)? Replicate the full pair, or you move the body and leave the record behind."
sanitized: true
---

# A game's teleport has siblings — moving the body without the record desyncs the server state

The restore called the game's public teleport method to place the player at the recorded spot.
Position: correct. But the game's OWN call sites of that method never call it alone — the composite
teleport path around it also:

- registers the destination room with the **spatial index** before the move (without it, spatial
  queries silently fail to find the player — nothing errors);
- updates the server-side **room membership** record ("which room is this player in") that every
  room query reads — encounters, wave counters, room-cleared checks all ask "which players are in
  this module" against that record, not against transform positions.

Calling the bare teleport moved the body and left the record pointing at the previous room: the
player physically stands in the restored room while the server counts them elsewhere — a class of
bug that produces no error and surfaces later as encounters not triggering or clearing wrongly.

Also verify the sync layer can't reject the move (the integration owner's explicit warning:
"make sure the game doesn't have an internal state server that will reject you trying to move the
player"). Read the teleport's implementation for its authority model: here, client-authoritative
mode teleported via an RPC to the owning client, and server-authoritative mode wrote the transform
and forced a resync — both safe for a self-hosted replay. A game with server-side position
reconciliation would need the move issued through its authoritative path instead.

The rule: **never call the lowest-level placement primitive you can find — mirror the game's own
composite teleport path**, sibling updates included, in the same order.
