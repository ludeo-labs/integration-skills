---
category: architecture
tier: generalizable
sourceGame: TopDownRogueSample
phase: "3,6"
question: "Are you turning UI screens (results, level select, popups, reward dialogs) into PauseLudeo/ResumeLudeo spans, and can any gameplay action be raised while one of those screens is up?"
sanitized: true
---

# When menus pause the Ludeo, defer the actions raised under them

A `PauseLudeo`/`ResumeLudeo` span stops the objective clock and event tracking, and the backend saves
nothing for a pause span (`CONSENT-AND-OVERLAY.md` §3.2: "Backend saves the span's data" is no for
pause/resume). From that, an action sent while a pause is open is inferred to fall into the stretch
the backend drops, so a goal built on it may never count. Nothing errors, and the log looks right.

Turning UI screens into pause sources makes this common:

- a reward claim sent from a popup's OK button, on the frame the popup is still open;
- a run-start action sent from a level-select Start button, before the screen has closed.

## The habit

- In the single action path, **queue any gameplay action while a pause span is open**, and send the
  queue right after `ResumeLudeo`.
- **Flush the queue in teardown** when the open span is closed, before `End` or `Abort`, so nothing
  queued is lost.
- **Never defer the span actions themselves** (`PauseLudeo`, `ResumeLudeo`, `StartNoneLudeable`,
  `StopNoneLudeable`).
- Bound the queue and count the overflow, so a stuck pause shows up as a number, not silence.

## How to apply

In an automated run, open a pausing screen, raise an action from it, close it, and check the log reads
`ResumeLudeo` before the action. At the end of every run assert that no deferred action was lost and
none was sent while paused.

Background work that keeps producing under a menu (loops on unscaled time) is a separate problem:
hold it as in [[park-unscaled-loops-at-the-commit-not-the-timer]]. For keeping UI-driven pauses from
getting stuck, see [[non-ludeoable-spans-as-a-state-machine-not-paired-calls]].
