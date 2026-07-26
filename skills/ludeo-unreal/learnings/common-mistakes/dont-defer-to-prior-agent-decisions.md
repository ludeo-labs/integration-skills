---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: "When a Ludeo integration has prior-agent-added engine helpers (Ludeo_RestoreState, etc.), how much should we defer to those design decisions?"
sanitized: true
---

# Prior agents made decisions under the same constraints you do — don't anchor on their code as authoritative

## The pattern

When picking up a Ludeo integration that's been worked on by previous agents, you'll find:
- Engine-side helpers prefixed `Ludeo_*` (e.g., `Ludeo_RestoreState`, `Ludeo_CaptureSnapshot`)
- `#if LUDEO_OFFLINE_MODE` blocks scattered across game classes
- Component-side `ObjType_*` per-entity capture/restore code
- Comments like "the prior agent established this pattern because..."

The reflex is to treat these as authoritative — "the team that wrote this knew what they were doing." That reflex is wrong.

## The reality

Those engine helpers were written by an LLM agent making decisions with:
- Limited context (didn't see what would come later)
- Narrow test scope (probably only validated a few scenarios)
- Their own assumptions (which may not be your assumptions)
- The same fallibility you have

In a real example from ActionGame, the prior agent's `Ludeo_RestoreState` helpers on `AGateActor`, `AContainerActor`, and `ACosmeticDestructionActor` all had an `if (State == NewState) return;` early-exit. This made perfect sense when Phase 5 was the only writer. When Phase 7 was added and started writing the property directly via reflection BEFORE Phase 5's call, the early-exit caused the cascade to no-op silently. **The prior agent's design embedded an assumption about "single writer" that became wrong the moment the architecture extended.**

The fix wasn't to keep extending Phase 5 — it was to recognize the actual game-native mechanism (OnRep replication handlers) and use that instead. The prior agent had introduced a custom pattern that paralleled but didn't follow the game's own design.

## How to recognize this

Indicators that a prior-agent's design is suspect:
- "Custom restore helper" patterns rather than using UE-standard mechanisms (OnRep, SaveGame, etc.)
- Per-class adapter lists that keep growing
- Comments rationalizing why the helper diverges from "what UE normally does"
- Behavior that requires the helper to be the SOLE writer of the property
- `if (target == current) return;` early-exits in restoration code

Indicators that the design IS solid:
- Uses UE-standard mechanisms verbatim (calling existing setters, firing OnReps)
- Bounded scope (small enumerable set of cases handled)
- Comments explaining product knowledge (which side effects to suppress, why)
- Doesn't assume "I am the only writer"

## How to apply

When you inherit a Ludeo integration:

1. **Diff against the pristine source** — find the canonical game codebase (e.g., a vendor-provided source snapshot of the game without integration changes). Anything that differs is integration work. Distinguish "added by integration" from "native game design."
2. **Look for UE-standard mechanisms first** — does the class have OnRep handlers? SaveGame-flagged UPROPERTYs? Public setters that fire cascades? Use those.
3. **Question every per-class helper** — ask "could this be replaced by a generic mechanism?" If a class has its OWN engine helper that parallels what OnRep would do, the helper is probably the work-around, not the answer.
4. **Don't propagate prior-agent patterns to new classes** — when migrating new classes, don't add another `Ludeo_RestoreState` just because the existing ones exist. Try the standard UE mechanism first.
5. **Be honest about what's known to work vs assumed to work** — "Phase 5 ships in production" doesn't mean "Phase 5's design is correct." It means "Phase 5 has been tested in a specific scope."

## Why this matters

Anchoring on prior-agent code as authoritative leads to:
- Extending broken patterns rather than fixing the root cause
- Per-class accumulating maintenance burden
- Whack-a-mole bug cycles as new classes hit the same underlying issue
- Architectural drift away from UE-standard patterns

Treating prior-agent code as "another data point" rather than "the answer" lets you spot the systemic issue and fix it at the architectural level.

## Real example: Phase 7 OnRep pivot

The prior agent on ActionGame's Ludeo integration added `Ludeo_RestoreState` helpers across ~5 classes. Each helper called the class's cascade-firing function with `bIsInitialStateChange=true` to suppress one-shot effects on restore. The pattern was well-considered for "Phase 5 only" architecture.

When Phase 7 reflection capture was added, it started pre-writing properties before Phase 5's ticker called `Ludeo_RestoreState`. The early-exit `if (State == NewState) return;` short-circuited the cascade. State property restored correctly but visuals stayed at .umap defaults.

The original session's reaction was to add per-class BeginPlay handlers — extending the per-class pattern with a different shape. Iteration through 4 sessions of "fix per class" before recognizing the real answer: **UE has a standard mechanism for "I just received state X from elsewhere" — it's OnRep**. The game team's own engineers wrote OnRep handlers for every replicated property's transitions. The Ludeo integration should use that path, not invent a custom one.

The pivot from `Ludeo_RestoreState` → OnRep firing took ~half a session and validated on 2 classes immediately. Following the prior agent's pattern locked in extra weeks of class-by-class work.
