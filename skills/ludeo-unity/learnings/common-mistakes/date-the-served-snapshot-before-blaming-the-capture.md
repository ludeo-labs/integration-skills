---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5,7"
question: "Report that the replay starts 'slightly behind' where the moment shows? Before touching the capture code, DATE the served snapshot against the level's authored start values — and check whether anyone ever called the room writer's send-interval setter."
sanitized: true
---

# "The restore starts a few steps back" — date the snapshot before debugging the writer

Reported symptom: on every replay the player is a few steps behind where the moment shows, most
visible when the moment is near the level start, where "behind" means off the left edge of the
screen. The obvious reading — a one-frame lag in the position write — is wrong, and chasing it
wastes the session.

**Date the snapshot instead.** Three independent restored fields, read off one restore log line,
answered it:

| field | restored | means |
|---|---|---|
| level elapsed time | `0.0s` | the run's first second |
| coin counter | `0` | nothing collected yet |
| player position | `(135.67, 7.77)` | the level's authored spawn is `(135.8, 11)` — the spawn, after landing |

Not a lag. The served state was the **opening state of the capture run**. A moment captured a few
seconds in therefore looks like "a few steps back"; a moment captured a minute in would be
unrecognisable. The same signature explains an older report on the same integration that a
restored health value "always starts at maximum".

## Two things to check, in this order

1. **Does the layer even register?** In one run there was no `capture registered` line and no
   capture heartbeat at all — nothing was tracked, so freshness was moot. A run whose room opens
   while an intro cutscene is on top can leave the level before it ever becomes playable.
2. **Did anyone set the writer's send interval?** `LudeoRoomWriter.SetSendSettings(uint
   sendIntervalMs)` tunes how often captured data is flushed to the backend. Nothing in the
   integration called it, so the SDK's default batching applied — and whatever the backend holds
   when a highlight is marked is at most one batch old. Set it explicitly at room open and log the
   returned `LudeoResult`; the SDK may clamp it, and the true rate is still bounded by the SDK's
   internal tick.

## Two dead ends, recorded so the next integration skips them

- The SDK logs `No callback has been registered to SnapshotRequest` at activation, which reads like
  the missing hook. **`snapshot` appears nowhere in the plugin's C#** (169 files) — only inside the
  native DLLs. It is not exposed to Unity and cannot be answered from game code.
- A per-second capture heartbeat is worth its cost *only if it logs values you can match against
  the restore*. Ours logged health and counters but not position, so the position claim could not
  be dated from the capture side at all — add position, and prefer a timestamp the restore can
  echo back.

## Keep the log

`-logFile run.log` **truncates on every launch**. The comparison log from the run before a crash
was lost that way. Copy the log aside before relaunching, or launch with a timestamped path.
