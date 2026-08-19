---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 6
question: "About to emit the Pause/Resume span pair from the game's pause primitive? Read EVERY call site first — a symmetric-looking pause function is commonly also used as a terminal freeze (death, level end) that nothing ever resumes, and one such emit leaves the objective timer stopped for the rest of the run."
sanitized: true
---

# A pause primitive with terminal callers leaves your span open forever

The game had one obvious pause function that everything funnels through, so the Pause/Resume pair
went there. A playtest produced **one Pause and no Resume**, and the objective timer stayed stopped
for the rest of the run.

The function was overloaded in practice: the pause menu used it symmetrically, but the death handler
and the level-end handler used it as a **terminal freeze that is never resumed** — the level reload
just resets the flag. Emitting from the primitive therefore emitted an open span with no closer.

**Read every call site of a pause primitive before wiring a span to it**, and classify each as
symmetric or terminal. Put the pair on the call site that is genuinely a pause and genuinely
symmetric — here, the live pause manager's own `Pause()`/`UnPause()` — not on the shared primitive
underneath.

## Two windows, two meanings, and they are mutually exclusive

The same log line exposed a design contradiction: the death screen was emitting **both** span pairs
at once. They mean opposite things to the backend:

- **non-ludeoable** — the objective timer keeps running and the span's data is kept;
- **pause** — the timer stops and nothing is saved for the span.

One window cannot be both. Decide per window which it is (a death video is non-ludeoable) and emit
exactly one pair.

## Three more things that bit on the same work

- **Two implementations of the same system.** The game had two pause classes; the pair was wired to
  the legacy one, which the input binding never reaches, so nothing emitted at all. Find the live
  one by tracing from the input poll, not by grepping the class name — and remove the emit from the
  dead one so it cannot double-fire later.
- **Close both spans at the level-return hook.** Additive death/cutscene loads bypass the game's
  pre-load method, so the normal exit-time close never runs on those paths. Being back in a live
  playable level means neither span can still be in effect.
- **Guard the close on the frame number, not a boolean.** Two different windows close at the same
  hook: one opened frames earlier (death) and one opened in the same frame (cutscene, because the
  level controller's init runs before the hook inside one scene-loaded pass). A plain
  "already opened" flag fixes one case by breaking the other. Related:
  [[per-frame-open-needs-a-closed-latch]].

## Read the same log line twice before believing it

A single Pause in the log was reported as "the pause works". It had come from the **replay ending** —
the SDK sends its freeze on completion, which the overlay handler correctly turns into a Pause emit.
The key press itself had produced nothing. When one log line has two possible producers, attribute
it before concluding: here a genuine pause is distinguishable by the *absence* of the session-end
and freeze lines immediately before it.
