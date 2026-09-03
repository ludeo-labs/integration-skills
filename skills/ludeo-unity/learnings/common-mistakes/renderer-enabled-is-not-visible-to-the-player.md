---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,8"
question: "Are you diagnosing entities the player reports as missing or invisible, with a check that reads renderer.enabled (or any component flag)? Component state is not what the player sees - measure the player's view."
sanitized: true
---

# renderer.enabled is not "visible to the player"

An audit that counts enabled renderers will fight the human's eyes and lose. Ways an
entity is component-"rendered" yet invisible, all hit in one integration:

- **Distance/frustum culling**: the game's own culling system (a `CullingGroup` with
  distance bands and a per-entity updater) disables renderers of off-screen or distant
  entities BY DESIGN and re-enables them on approach or gaze. An audit flagging these is
  reporting the feature, not a bug - the tell is that they "heal" whenever the player
  nears. Conversely an idle enemy parked out of sight is hidden legitimately forever;
  the real defect there is the AI that parked it, not the renderer.
- **Dissolve materials**: renderer on, `_Dissolve`-style strength at full - a ghost.
- **Entombed in scenery**: renderer on, in-frustum, standing inside a collider (spawn
  placement or knockback vs geometry the creator's run had destroyed).
- And the reverse trap: enabled-flag checks that also require `activeInHierarchy` count
  differently than ones that don't; know which your check reads before quoting it.

**Measure the player's truth, not Unity's**: viewport test against the REAL camera
(`WorldToViewportPoint`, in front, within draw range), material strength, and an overlap
probe at chest height for entombment (mind that a small box cannot distinguish buried
from wall-hugging). The single most decisive instrument is a **debug beacon**: a fresh
primitive child with its own unlit material, parented to every counted-alive entity - it
lives outside every managed renderer list, the culler, and the dissolve, so "ball with
no body" = invisible, "ball in rock" = entombed, "no ball while the count says alive" =
the entity does not exist where the books claim. One run with beacons ended a week of
argument.

Also: console volume is frame time. A per-entity line every sweep tanks the Editor's
framerate and the human's patience - aggregate routine events per sweep, print anomalies
individually, and repeat a health line only when it CHANGES.
