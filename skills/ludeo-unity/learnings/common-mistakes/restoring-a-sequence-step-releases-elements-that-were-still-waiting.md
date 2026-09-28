---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: 5
question: "Do level elements (traps, platforms, turrets) run a step sequence that can wait before its first step (a delay, or an event such as the player entering a trigger box), and does the restore put them back by jumping to a recorded step?"
sanitized: true
---

# Restoring a sequence step releases elements that were still waiting to start

Level elements ran a step sequence behind a first-activation wait (a timer, or an event like "player enters this
box"). The capture wrote an active element as `A<step>`; the restore set the active state and jumped to that step,
and the jump helper cleared every wait flag so the element would play on.

Two flaws combined:
- **The capture could not tell "waiting" from "running step 0"** — both wrote `A0`.
- **The restore always released the wait**, so every element that had not started at the Ludeo's moment started the
  instant the Ludeo began (found by a pre-upload re-scan: most of one level's path-following traps, and the rhythm
  offsets of timed platforms and turrets in others). The tested Ludeos happened to start after those traps were
  already running, so replay tests passed.

Fix shape:
- Capture a distinct token for "active, still waiting" (plus the time left on a timed wait).
- On restore, re-arm the wait (and its remaining time) instead of jumping; jump only when the element had started.
- Test with a Ludeo recorded just **before** the player trips a trigger box, not only mid-action.
