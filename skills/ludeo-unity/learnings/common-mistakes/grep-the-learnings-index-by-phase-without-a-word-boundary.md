---
category: common-mistakes
tier: universal
sourceGame: ActionAdventureSample
phase: 1,2,3,4,5,6,7,8
question: null
sanitized: true
---

# Grepping `learnings/INDEX.md` by phase: `\b` never sits between `p` and the digit

The Load step says "read every entry whose `phase` matches the current phase". An index line
looks like `| generalizable | p3 |` or `| p1,3,7 |`, so the obvious regex is something like
`p[0-9,]*\b3\b`. **That pattern silently misses every `p3`-only entry**: `\b` is a boundary
between a word character and a non-word character, and `p` and `3` are both word characters, so
`p\b3` can never match. It still matches `p1,3` (comma before the 3), which is exactly what makes
the bug invisible — the grep returns *some* results, so it looks like it worked.

Observed on one integration: the phase-2 grep returned only the four universal
`p1,2,3,4,5,6,7,8` entries and the agent concluded "only universal learnings apply to phase 2".
Six phase-2-only learnings existed. The same pattern would have hidden ~30 phase-3 entries.

## Pattern that works

```
grep -E '\| p([0-9]+,)*3(,|\s)' learnings/INDEX.md
```

`([0-9]+,)*` eats any earlier phases, `3` is the phase, and `(,|\s)` requires the digit to be
followed by a comma or whitespace — so it matches `p3 `, `p1,3 `, `p3,5 ` and rejects `p13 `.

## Positive control

Before trusting the count, grep for a learning you *know* carries the phase (e.g. pick one line
from the index by eye) and confirm the pattern returns it. This is the
[[ask-what-your-check-cannot-see]] discipline applied to the very first tool call of a phase.
