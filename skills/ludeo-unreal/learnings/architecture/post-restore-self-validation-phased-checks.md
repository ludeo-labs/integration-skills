---
category: architecture
tier: universal
sourceGame: EndlessFPS
phase: 4
question: null
sanitized: true
---
# Validate the restore with phased self-checks in code — never sign off Player Flow on visual inspection

## The principle (a developer's words)
> "Add code to validate, after we restore, that the entities we THINK we restored are actually there
> in the right place — rather than trust visual inspection."

"Looks right" is not evidence. A restore can look plausible while silently dropping most of the
captured entities, and look wrong for a different reason than the obvious guess (a "scene looks
different" report was variously hypothesized as entity displacement, AI drift, and camera facing —
the self-check data killed all three and exposed the real cause, dropped entities, in one run).

## The pattern
After applying the restore, compare **what you asked for** against **what the world actually contains**,
at three pipeline phases, logging a per-entity delta and a one-line summary each time:

- **post-spawn** — immediately after applying. Isolates spawn-time problems (collision-adjust
  displacement, failed spawns, dropped entities).
- **post-settle** — just before the pre-RoomReady pause. Growth vs post-spawn = drift during the
  unpaused settle window (AI pathing, physics).
- **post-begin** — at BeginGameplay/unpause. This is the moment actually presented to the viewer.

What to record per restored entity: the requested transform at spawn time, then at each phase the
location delta (cm), rotation delta (deg), and existence (a weak pointer that nulls = the entity was
destroyed/GC'd). Plus, in the summary line:
- `expected` vs `present` vs `missing` — dropped/failed restores show here, not in any visual;
- a **world count of the tracked entity class** — exposes EXTRAS (game-spawned entities leaking past
  your spawner suppression). "Only new ones spawn" reads as `worldEntities >> present`.
- the **player's position AND control (camera) rotation** vs what was applied — the facing frames the
  whole moment; a drifted control rotation makes a perfectly-restored scene "look wrong". Check yaw
  and pitch separately (easier to interpret than a single angular distance).

Reset the expected-state records at the START of the restore-apply pass — before anything is applied —
not midway; a reset placed after the player apply but before entity spawning silently wipes the
player's expected values and the player line never logs (this exact ordering bug shipped once).

## Interpreting deltas
- Location tolerance ~50cm, rotation ~10deg is a good default. Location is the signal; rotation flags
  on ragdolled corpses are expected rest-pose noise, and small rotation drift on live AI (turning
  toward the player during settle frames) is usually benign.
- A delta that appears at post-spawn is a spawn problem; one that grows by post-settle is a settle
  problem; one that appears only at post-begin happened during the paused window (rare — suspect
  teleport/possession side effects).

## Cloud note
Emit these lines through a channel the cast VM's game log actually captures (OutputDebugString — plain
UE_LOG never reaches it), or you can only validate locally. The same lines then verify the restore on
a real cast session byte-for-byte against the local baseline.
