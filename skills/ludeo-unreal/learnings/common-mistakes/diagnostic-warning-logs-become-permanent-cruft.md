---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 6
question: null
sanitized: true
---

# Diagnostic Warning logs become permanent cruft if you don't budget their removal

## The mistake

When hunting a bug, agents (and humans) add `UE_LOG(..., Warning, ...)` instrumentation at suspect call sites — high-volume so the signal can't be missed. The instrumentation surfaces the bug, the bug gets fixed, the logs survive in the next commit. Over time this accumulates into permanent log spam that obscures signal in **future** investigations.

Reference-game example: a vehicle Player Flow commit (deterministic RNG + spline-array capture + diagnostics) added 7 `#if LUDEO_OFFLINE_MODE` Warning blocks to `CheckSpawnVehicle` + `SetPhase` — ~75 lines including a 50-line nested per-vehicle / per-path predicate breakdown. The two bugs the logs surfaced (predicate filter rejecting paths because `EnabledVehicleSplines` was empty, RNG non-determinism) were fixed in the same commit. The logs then spammed every level session log without helping with the next-up investigation (Case C — silent drop between roll-success and `TrySpawnVehicle`), which lives at **different call sites**. Cleanup landed in the immediate follow-up commit (-81 lines).

## Why the rationalization fails

The commit message claimed the logs "will surface the next layer of silent drops when investigation resumes". That's almost never true:

- The next bug almost always lives at a different call site than the previous one. Old logs don't reach there.
- The next bug almost always needs different field combinations in the log. Old log payloads don't match.
- Even when the same site is involved, the relevant signal is buried under spam from rolls/retries/predicate-checks the previous bug demanded but the new one doesn't.
- The cost of fresh, targeted logs at the new site (10-20 lines, focused) is lower than the cost of grepping through old spam to find new signal.

## The rule

**When a diagnostic log surfaces its bug, delete it in the same PR as the fix.** If the log is at a Verbose / VeryVerbose level and is genuinely cheap, it can stay — those don't hit production logs by default. Warning-level diagnostic logs gated by `LUDEO_OFFLINE_MODE` always run during integration testing and always pollute future investigations.

If you genuinely think the same instrumentation will help a future investigation: write it down (as a TODO or in `integration.json` → `knownIssues`) but **don't keep the code in tree**. The next investigation will re-derive better logs in less time than parsing accumulated cruft.

## Heuristic for what to keep vs. drop

Keep:
- One-shot summary logs that fire once per lifecycle event (room open/close, snapshot apply, restore complete).
- Restoration logs that record the actual outcome (count of entities restored, RNG state set, gates re-applied).
- Error-level logs for invariant violations.

Drop:
- Hot-path Warning logs: per-tick checks, per-roll outcomes, per-filter rejections.
- Per-element loops that print state for every entry of a TArray / TMap on every iteration (the 50-line nested breakdown was this).
- "Phase changed" / "entered state X" logs when a `Log`-level dev log already prints the same thing.

## Cross-reference

- `common-mistakes/never-claim-verified-without-runtime-test.md` — diagnostic logs are the agent's runtime-test substitute; once they've done their job, they have no further role.
