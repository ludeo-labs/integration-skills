---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "7,8"
question: "Does the game have levels, worlds, regions or modes that the replay tests so far never touched? Then re-scan every one of them against the capture/restore code before the first cloud upload."
sanitized: true
---

# Re-scan every part of the game before the first cloud upload

By the upload, the integration had a phase-4 census of every trackable type (with per-level counts), and the replay
had been proven end to end — but only on two of twenty levels. The census read "correct after Wave 1" for most
levels. A re-scan of **all** levels right before the upload, done against the **code** rather than the plan, found:

- **A bug in already-shipped restore code.** Restoring a level element onto its recorded sequence step cleared the
  element's "wait for first activation" state, so traps that had not started yet at the Ludeo's moment started
  immediately (most of one level's moving traps). The capture also wrote "waiting" and "running step 0" the same way,
  so the restore could not have known. The two tested Ludeos happened to start after those traps were running.
- **A whole object class the census missed.** Destructibles (breakable walls, destroyed turrets) were captured and
  restored as "resolved" — silently, without the event that hides them — so they came back visible and solid. In one
  level that blocks the only way forward.
- **Severity the census underrated.** "Moving platforms restart from their start pose" was really "come back moving
  the wrong way", which is lethal over a kill floor.
- **State that lives only in a running coroutine** (a wave counter of a survive sequence, an exit counter) — restart
  on restore, in levels the plan listed as fine.

## How to run the re-scan (what worked)

- **Scope by the title's structure:** one subagent per world / region / mode, run in parallel, read-only.
- **Enumerate what is really there:** scene YAML + every prefab it instantiates (nested), script GUIDs resolved via
  `.cs.meta`. A small script beats reading scenes by eye.
- **Ground truth is the capture/restore code, not the docs.** Classify each stateful type as covered now (verified in
  code) / planned (which wave) / **missed**.
- **One verdict per level:** OK / Partial (plays, something visibly off — say what) / Broken, plus what a Ludeo
  starting mid-level there would show wrong, and any mechanic that lacks an action.
- **Include cutscene and "resolved" replays:** re-applying end states can re-fire screens, sounds and tweens.

## What to do with the result

The gaps rarely block the *cloud* test itself (auth, streaming, input, overlay pause, load time): upload, and test on
the levels rated OK, while the found bugs are fixed first and the planned waves follow. Record the verdict table in
the plan so creators and QA know which areas make reliable Ludeos; a cheap stopgap for Broken areas is a "no Ludeo
here" stretch until their wave lands.

## Note (2026-09-26): the re-scan before a later upload paid off again

Before the second upload (bosses and a batch of moving traps added), the re-scan found three issues that no replay
had shown, one of them introduced by an earlier fix: a cutscene filter left one level's intro overlay on screen in
every Ludeo (`holding-back-a-completed-cutscenes-screens-can-leave-a-load-time-overlay-up`), plus two settle
problems (`the-settle-is-live-so-clear-what-it-spawns-and-hold-what-chases`). Re-scan before **every** upload that
widens coverage, and pair it with a scripted replay of the confirmed Ludeos
(`replay-every-confirmed-ludeo-as-a-regression-gate-before-upload`).
