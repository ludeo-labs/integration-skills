---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the HUD rebuild itself asynchronously on level load (clear-and-recreate of map tiles, markers, widgets), while the things it displays are revealed by ONE-SHOT calls (a door drawn on room entry, an enemy dot switched on at spawn)? In a replay the reveals fire while the rebuild is mid-flight and die with the old widgets. Re-assert every reveal from a tick until it has provably landed on the LIVE widget."
sanitized: true
---

# One-shot UI reveals lose races against HUD rebuilds

Minimap-style HUDs are rebuilt on level load: clear every tile and marker, wait (often on scaled
time), re-create everything switched off. The game's reveals — a door marker drawn when a room is
entered, an enemy dot switched on by a spawn-time tree node — are one-shot, and normal play
sequences them safely: the rebuild finishes during the loading screen, reveals come later, from
player actions.

A replay reveals during the rebuild. The call succeeds — on a widget that is about to be
destroyed. Three separate symptoms in one integration came from this single race: revealed rooms
losing their door markers, second-replay tiles drawn on the previous dungeon's still-registered
widgets, and enemy dots that never appeared.

## The pattern that fixed all three

**Re-assert until provably landed.** Keep every reveal on a pending list; each tick, re-run the
reveal and remove it only when a landed-condition holds against the live object — not a flag that
outlives the rebuild:

- the registry's widget for this key EXISTS,
- and it is bound to THIS level's object (identity check — a same-index widget from the previous
  level passes every other test),
- and the data the reveal draws from has arrived (a SyncList can be empty on the client while the
  server's copy is full).

Two adjacent traps found the same way: a marker's fallback reveal was structurally dead for one
entity class (its module id is never set, so the "is this module visible" gate never passed), and
positions were anchored to a "current module" that only door-crossings update — a restored player
never crosses one, so everything drew off-mask a whole level away. Anchors the HUD derives from
player traversal must be asserted explicitly by the restore.
