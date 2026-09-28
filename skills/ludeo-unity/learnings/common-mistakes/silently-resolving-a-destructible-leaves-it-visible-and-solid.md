---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "4,5"
question: "Are there destructibles (breakable walls, destroyable turrets, props) whose 'destroyed' look is produced by the hit or slash event rather than by entering a resolved/destroyed state? Then a silent state restore brings them back whole."
sanitized: true
---

# Silently resolving a destructible leaves it visible and solid

Level elements were restored by setting their state (off / resolved / active) **without** their designer events, so
nothing fired twice on replay. For levers the restore also re-applied the pulled look. Destructibles got nothing: a
breakable wall disappears only through its slash event (meshes and collider off, debris, hit-stop), and resolving it
does not hide it. Captured as "resolved", restored as "resolved" — and standing, solid, in the way. The same held for
turrets destroyed by a parry.

The census had filed these under "level element state, covered", so no wave planned them; a per-level re-scan found
them across six levels, one where the wall blocks the only path.

Fix shape: a small "Ludeo replay" helper on the destructible that turns off its meshes and colliders **without** the
debris, sound or hit-stop, called when the restore sets it to resolved (same pass as the lever look). No new
captured data is needed — "resolved" already says it was destroyed.

When mapping objects, ask of every state change: *does entering the state produce the look, or does the event that
led to it?* If it is the event, a silent restore needs a look-only helper.
