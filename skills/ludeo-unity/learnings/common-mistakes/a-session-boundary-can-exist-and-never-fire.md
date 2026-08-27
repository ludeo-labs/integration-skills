---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 2
question: "Are you recording a gameplay start/end boundary because you found a method, an event, and a subscriber for it? Check that something actually CALLS the firer - a fully wired boundary can still be dead code, and the wiring is what makes it look alive."
sanitized: true
---

# A session boundary can exist, be subscribed to, and still never fire

While mapping a run-based game, the end-of-run boundary looked settled in one pass.
The central gameplay controller had:

- an `EndGameplay()` method that flipped the "gameplay is running" flag off,
- a `FireGameplayEnd()` wrapper with the usual null check,
- an `OnGameplayEnd` event,
- and a flow manager that **subscribed to it in `OnEnable` and unsubscribed in
  `OnDisable`**, with a handler that set the post-game flag.

Four independent signals all saying "this is the end boundary." It went into the
map as one.

It was dead. `EndGameplay()` had **zero callers anywhere in the project**. It was
the only caller of the fire wrapper, so the event never fired, the subscriber's
handler never ran, and the "gameplay is running" flag — set true at run start —
**never returned to false for the lifetime of the process**.

## Why the wiring fooled the search

Every heuristic that normally confirms a hook was present. A subscriber is
usually strong evidence: someone wired it up, so something must raise it. But
subscription proves only that a developer *expected* the event. Handlers outlive
the call sites that once fed them — a refactor removes the caller, the event goes
quiet, and nothing breaks loudly because the handler simply stops running.

The failure is silent in exactly the wrong direction. An integration that hooks
this boundary compiles, runs, and reports nothing at the end of a run — and the
"gameplay is running" flag it trusted reads true forever.

## The check

When recording ANY lifecycle boundary, walk **one more hop** than feels necessary:

1. Find the event. 2. Find the `Fire*`/`Raise*` wrapper. 3. **Find the callers of
that wrapper.** 4. **Find the callers of _those_.** Stop only when you reach a
site that real gameplay reaches — an input handler, a collision, a state
transition, a UI button.

A one-line grep settles it: search the whole project for the method name and count
hits that are **not** the declaration. Zero non-declaration hits means dead code,
no matter how convincing the surrounding wiring looks.

Do this for the per-frame gate too. The same controller gated its `FixedUpdate`
event on that stuck flag — so the gate was permanently open, which looks identical
to "correctly open" until a run ends.

## What to do when the boundary is dead

**Record it as work to ADD, not a hook to use.** In this game the real end-of-run
signals turned out to be elsewhere entirely: the player-death notification raised
from the character's status component, the return-to-hub call, and the
return-to-menu scene load. Note also what *isn't* there — this project had **no
`OnApplicationQuit` handler anywhere**, so closing the window was an unhandled
exit path the integration had to add from scratch.

Write the dead boundary into the map explicitly with its evidence ("zero callers,
verified by project-wide grep"), so the next phase does not rediscover it or,
worse, quietly depend on it.

Related: [[a-green-compile-does-not-prove-your-edit-compiled]] — same family of
error, where code that looks live isn't. And [[investigate-before-asking]] §2 —
the extra grep hop is the check that turns an assumption into a fact.
