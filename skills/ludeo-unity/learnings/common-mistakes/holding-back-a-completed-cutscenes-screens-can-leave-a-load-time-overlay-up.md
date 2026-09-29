---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "5"
question: "Does the restore complete already-played cutscenes by firing their step events while holding back the presentation calls (UI, sound, camera, post effects)?"
sanitized: true
---

# Holding back a completed cutscene's screens can leave a load-time overlay on screen

Completing played cutscenes at restore is right: their step events carry world changes (doors, unlocked moves).
Firing all of them at once also replays their presentation, so the restore held back calls on UI objects and on
sound, camera and post-effect types. That fixed a tutorial screen that popped up after Play.

It also broke a level nobody re-tested. That level's intro overlay (a full-screen canvas with black bars and boot
text) is **active when the scene loads**, and only the intro's own `SetActive(false)` steps hide it. Held as
"presentation", those steps never ran, so every Ludeo of that level would open behind the overlay. The level's
music was also muted at start and started only by an intro step, which the "sound" filter held. Every restore check
passed: nothing checks what is on screen.

## Fix

- Treat screens a completed cutscene switches (on **or** off) as presentation that **ends hidden**: collect the UI
  objects whose `SetActive` calls were held, and switch them off after the completion. A screen a finished cutscene
  touched is a cutscene screen; its end state in a replay is "not showing".
- Treat the level's music controller as world state, not a one-shot sound.
- Log the held calls and the screens left hidden, per cutscene, so the next level's odd case shows in the log.

## How it was found

By the whole-game re-scan before an upload (`rescan-every-level-before-the-first-cloud-upload`), which compared each
level's scene data with the restore code, not by a replay. A replay of that level after the fix logged five intro
screens that had still been on.
