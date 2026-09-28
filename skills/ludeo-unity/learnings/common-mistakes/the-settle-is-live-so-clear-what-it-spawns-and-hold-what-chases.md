---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "5"
question: "Does the restore run a settle window with time running (camera blend, physics settle, a second apply pass after it) while the player is only made invulnerable?"
sanitized: true
---

# The settle is live: clear what it spawns and hold what chases

The restore applies the moment, lets the game run for 0.5–3 s so cameras and physics settle (player invulnerable,
input held), then applies every value again. Values are safe: the second pass writes over what the settle moved.
Things the settle **creates or triggers once** are not:

- **Projectiles.** A turret whose restored step fires at once, and hunting ranged enemies, fire during the settle.
  Their shots are still in the air when the viewer presses Play, although the creator never faced them (shots in
  flight are not recorded at all, so none of these can be the creator's).
- **Chasing hazards.** A chasing wave restored close to the player reached the invulnerable player during the
  settle. The hit fired the hazard's own "drowned" event, whose sinking animation has no way back, so the replay had
  no visible wave for its whole length while the chase logic kept running.

## Fix

- After the settle, remove transient projectiles through the game's own removal (the one it runs on the player's
  death), before the second pass. Check each projectile type: some clear themselves on the aggro toggle, others only
  on death or a level restart.
- Hold chasing hazards paused during the settle, and write their recorded pause flag in the second pass.

## Generalization

List what the settle can **create** (spawns, projectiles, effects) or **trigger irreversibly** (one-shot
animations, damage and death events on things other than the player), not only what it can move. Invulnerability
protects the player's health, not the world's reaction to touching the player.
