---
category: common-mistakes
tier: generalizable
sourceGame: TopDownRogueSample
phase: "6"
question: "Is the game's 'task/quest/objective completed' event raised by an evaluate/check function that runs repeatedly (on scene load, on returning to a menu or hub, on every stat change), rather than once when the player claims it?"
sanitized: true
---

# A re-evaluated "completed" event is not a completion: hook the one-shot claim

An evaluate function that reports "this task is complete" can raise its completed event every time it
runs: at scene load, on each return to a menu or hub, after every stat change. Mapping the action to
that event sends it many times per real completion (observed: an order of magnitude more raises than
claims), including during the replay boot, where it would satisfy the Ludeo's objective before the
player moves.

## The habit

- Hook the **one-shot claim** instead: the branch that pays the reward or advances the task index.
- Keep counting the evaluate-side re-raises in the harness, so the guard is proven against a real
  subject rather than a run where the event never re-fired.
- When reading a candidate emit site, ask "how many times does this run per real occurrence?" before
  "is this the right event?".

## Related

- [[a-death-that-reopens-a-room-lock-is-not-a-room-cleared]]: another event whose name says more than
  the game state behind it.
- [[a-generated-event-enum-is-not-an-event-bus]]: check an event actually fires, and when, before
  mapping an action to it.
