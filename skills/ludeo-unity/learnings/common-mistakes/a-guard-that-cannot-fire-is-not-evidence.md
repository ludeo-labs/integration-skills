---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5"
question: "Are you citing the ABSENCE of an error line as proof a code path got past a guard? Check the guard can actually fire at all — a singleton accessor that lazily CREATES its instance never returns null, so the null check beneath it is dead code."
sanitized: true
---

# A guard that cannot fire is not evidence

Diagnosing a replay that stopped part-way, the reasoning was: "the boot function logs an error and
returns if the level manager is missing; no such line is in the log; therefore it got past that
point." Every clause is true and the conclusion is worthless — the guard **cannot fire**.

The game's singleton base class lazily constructs its instance in the property getter: if the static
backing field is null it creates a `GameObject`, marks it `DontDestroyOnLoad`, adds the component and
returns it. `Instance` is therefore *never* null, and every `if (Instance == null)` written against
it is dead code. Worse, the manager was in no shipping scene at all, so on a cold start **our own
call was what brought it into existence.**

## Two costs, and the second is the expensive one

1. The dead branch itself — harmless, just noise.
2. **A whole session of reasoning anchored on it.** "Neither guard fired" was recorded as positive
   evidence, narrowing the search to everything *after* that point, when the guard had never been
   capable of saying anything either way.

## What to do instead

- Before treating a missing log line as evidence, **read the guard's condition and confirm it is
  reachable.** Cheapest possible check; skipping it invalidates everything downstream.
- Prefer **positive** breadcrumbs to negative inference. A trace that fires on the way through tells
  you the path ran. An error that did not fire tells you almost nothing — it may be unreachable,
  the code may never have been called, or the build may predate the line.
- Not every singleton in a codebase shares a base class. Here, one base auto-created (its null check
  dead) while another was a plain static assigned in `OnEnable` (its null check genuinely load-bearing).
  Check the specific base type, not the naming convention.

This is the same family as *a green compile does not prove your edit compiled*: an absent signal
being read as a present one.
