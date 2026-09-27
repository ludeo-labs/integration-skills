---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "3,6"
question: "Are you reporting the pause/resume window - or a non-ludeoable window - from 'the arbitrated time scale reached zero'? Before trusting it, find out what ELSE drives that value to zero, whether every input-waiting modal actually goes through the game's pause primitive, and whether your change event fires when one zero-holding screen hands over to another."
sanitized: true
---

# A zero time scale is not the "waiting on the player" question

Reporting the pause window off "is the simulation stopped" is the obvious first move, especially in a
game that already arbitrates `Time.timeScale` through a priority/request holder — the arbiter is one
public funnel with a change event, it needs no game-file edit, and it looks like exactly the right
signal. It is not. It answers *is time stopped*, and what the backend needs to know is *is the game
waiting for the player to choose something*. On this game those two questions disagreed three
different ways, and each one is a class of bug rather than a quirk of one title.

**1. It fires when nobody is waiting.** The kill-cam and a finisher flourish both ramped the scale;
the dev free camera and a frame-stepper drove it to zero outright; so did a `time_scale 0` console
command. None of those is a player choice, and a clip's countdown should keep running through all of
them. Reporting a pause there stops the backend's clock in the middle of live gameplay.

**2. It misses the modals that matter most.** The modal-dialog class held its *own* request on the
arbiter and never called the game's pause primitive at all. So a watcher on the pause primitive never
saw a confirm dialog — and a confirm dialog is precisely the thing a replay must not be cut across.
Symmetrically, a chat window blocked all gameplay input while registering nothing with the arbiter,
so watching the clock could never have found it either.

**3. The change event goes quiet on hand-over.** An arbiter that recomputes a resolved value
short-circuits when the value does not move. A dialog opening on top of an already-paused pause menu
is 0 → 0, so no event fires; the menu closing underneath while the dialog still holds zero is 0 → 0
too. And this game's loading screen registered a *running* value at a priority above every pause, so
a real pause underneath a loading screen read as "not paused".

## What to do instead

Ask the screens, not the clock. Every input-waiting screen here was already publicly observable — a
signal, or a public property — so it cost no game-file edit:

- Poll a small ordered predicate per frame ("which screen is in the player's way, or none"). Polling
  works at zero time scale, because `Update` still runs when scaled deltas are zero.
- **Keep one latch across the whole stretch**, not one segment per screen. These windows nest and
  hand over constantly. Reporting per screen sends a resume while the player is still stuck behind
  the next modal, which is worse than not reporting at all.
- Return the *name* of the holder, not a bool. The log line "waiting on the player (a confirm
  dialog)" is what makes a mis-fire diagnosable; a bare "paused" is not.

Two traps found while writing the predicate, both likely to recur:

- **The game's own "is a blocking screen open" test is not reusable.** This one had *four* versions of
  it — a copy-pasted expression repeated at three input handlers, a "can I open a window" method, the
  pause toggle's own guard, and the pause-input gate — and they disagreed about an event-choice screen, the
  tutorial popup, the map and the dev console. Do not adopt one of them as authoritative; build the
  list from the census and note which of theirs you disagree with.
- **Prefer the latch over the widget's `activeSelf`.** The reward screen exposed both: a GUI-root
  latch, and the window's own active flag. Tabbing to a character-info panel *deactivates* the window
  while the pick is still owed, so the active flag reports the stretch as over mid-selection. Two of
  the game's convenience properties for these screens also dereferenced their static instance with no
  null check, so the sibling that checks had to be used instead of the one the game itself reaches for.

## Keep the time-scale watch, just not for this

The arbiter watch is still the honest answer to "is the simulation stopped", which the restore freeze
and any agent probe both genuinely need. Retire its *reporting* role and leave the observation in
place — and say so where it used to be wired, or the next person re-adds it.

## The related decision worth surfacing

Both trigger kinds block clip creation, and the docs separate them on two other axes: the
pause/resume pair also stops the clip's countdown but the backend saves no data for the window, while
the non-ludeoable pair keeps the countdown running and the data. A **frozen** selection screen needs
the pause pair — otherwise the replay's time budget drains while the player reads three upgrade cards
with the game stopped — but not the pause pair *alone*: the non-ludeoable pair is what stops a creator
trimming a moment's start point into the screen. Emit both, nested, from the same latch — see
[[pause-and-non-ludeoable-triggers-split-by-flow-a-real-pause-needs-both]]. Losing the pause window's
data costs nothing when the state writer writes every tracked value every tick rather than only what
changed; check that before relying on it.
