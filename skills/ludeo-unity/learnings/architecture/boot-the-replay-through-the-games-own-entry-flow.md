---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game initialize the player through an entry flow (hub/lobby scene, spawn handshake, countdown) before gameplay levels? If the replay boot loads the level any other way, every skipped step of that flow is a latent failure — and the restore must run AFTER the flow completes, never instead of it."
sanitized: true
---

# Boot the replay through the game's own entry flow — and restore AFTER it, never instead of it

The replay needs the recorded level loaded. The tempting shortcut — set the target level and load
it directly — produced a new failure every run, each one layer deeper, because the game initializes
its player through an entry flow (hub scene → gameplay scene) that the shortcut skipped:

1. Hosting the session-creation scene over a live session tore the host down mid-frame; the
   re-host crashed spawning the player.
2. Booting the level cold left the "level set up" flag permanently false — it is raised by a
   client scene-loaded handshake that only the real entry flow completes.
3. The directly-booted player was **half-built**: its weapon object never existed, so the first
   restored equipment write crashed inside the game's own appearance-rebuild callback.

Two patches were tried and were both wrong:

- **Faking the flag** (calling the join method from the layer) let the flow proceed — into crash #3.
- **Gating the spawn handshake's placement** (so it wouldn't overwrite the restored position)
  gated the entire spawn: rigidbody left kinematic, player left invisible, camera rig without
  valid state — a playing-but-black screen and thousands of "Look rotation viewing vector is zero".

The shape that works, in the integration owner's words — "technically the same flow as creation
mode, only WE trigger the load":

1. **No session up?** Host into the game's hub/lobby exactly like its own title flow. The player
   comes up whole — data, weapon, appearance — because the game built it.
2. **Enter the gameplay level through the game's own between-levels transition** (the one its hub
   uses), with the recorded seeds applied on top.
3. **Gate the restore on the game's own "level set up" flag** — i.e. the native spawn handshake
   must have COMPLETED before the moment is applied. Spawn first, moment on top. The order is then
   deterministic: nothing later re-places the player, and the restore overwrites a fully-built one.

Do not fight the entry flow's callbacks one by one — the class of "things the entry flow does" is
open-ended, and every gap you patch reveals the next. Route through it and sequence after it.

Related: the earlier learning "jumping straight into a level skips setup" predicted this class;
this is its resolution. See also the Unreal-side "skip warmup but fire its callbacks" — the same
law from the other direction, for games with a phase system clean enough to skip through.
