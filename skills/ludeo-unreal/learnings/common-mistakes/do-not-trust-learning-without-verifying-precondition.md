---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 3
question: null
sanitized: true
---

# Learnings have preconditions — verify them before applying

## The Mistake

Applied the learning `bp-only-project-ubt-auto-targets.md` verbatim to FPSGameStarterKit ("Do NOT create Source/ for BP-only projects") without verifying its precondition. That learning was derived from VoyagerV2, where CommonUI was enabled and triggered UBT to auto-generate `.Target.cs` files. FPSGameStarterKit has no such auto-trigger plugin, so the learning's advice was actively wrong — no Source/ meant no game target compilation and broken packaging.

## What Went Wrong

1. Read the learning's conclusion ("Do NOT create Source/")
2. Did NOT read the body carefully enough to notice the precondition ("when CommonUI or other plugins auto-generate targets")
3. Applied the rule to a project where the precondition didn't hold
4. Shipped a broken package; spent cycles debugging symptoms instead of revisiting the assumption

## Prevention

**Every learning has an implicit scope.** Before applying a learning:

1. Read the full body, not just the title or summary
2. Identify the **precondition** — what must be true for the advice to apply?
3. **Verify the precondition holds in the current project** (grep for the trigger plugin, check for auto-generated artifacts, read config)
4. If the precondition is ambiguous, treat the learning as a hypothesis and test it empirically before building on it

**Red flag:** If a learning says "always" or "never" without qualifications, be suspicious. Engineering rules rarely have no exceptions. Check the source-game context in the frontmatter — a learning from a specific game may not generalize.

## Process Change

When writing new learnings:
- State the precondition **in the first sentence of the body**, not buried in the middle
- Add a "when this applies" / "when this does NOT apply" section for any generalizable learning
- Cross-reference contradicting learnings explicitly
