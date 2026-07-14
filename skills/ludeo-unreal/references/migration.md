# Migration — upgrade `.ludeo/integration.json` to the current phase model

Run this when `.ludeo/integration.json` predates the current schema. Two historical shifts are covered:
the original **stage → phase** rename (schemaVersion 2), and the **phase renumber to 1-indexed**
(schemaVersion 3, where old phase `N` became `N+1` and phase 0 "Setup + Intake" became phase 1
"Know Your Game"). Detect the old schema, then rewrite it in place. This is a one-shot upgrade — once
`schemaVersion: 3` is set, this file is not needed again for that project.

## Detect (old-version signs)

- **PRIMARY:** `schemaVersion` is missing, or below `3`.
- **FALLBACK** (files predating `schemaVersion`): a `currentStage` key (instead of `currentPhase`), any
  `stage`-named field, **or a 0-indexed `currentPhase`** — a `currentPhase: 0` or a `phases` block keyed
  from `0` means a pre-`3` (0-indexed) file.

If `schemaVersion` is `3` and `currentPhase` is 1-indexed, no migration is needed — proceed normally.

## Mapping to the current (1-indexed) phase model

Pick the row matching what the old file carries.

**A) Old `schemaVersion: 2` (0-indexed `currentPhase`) — a pure `+1` shift:**

| Old phase (0-indexed) | New phase (1-indexed) |
|---|---|
| 0 Setup+Intake | 1 Know Your Game |
| 1 Mapping | 2 |
| 2 Lifecycle | 3 |
| 3 Map Objects | 4 |
| 4 Tracking & Restore | 5 |
| 5 Actions | 6 |
| 6 Verification & Cloud | 7 |
| 7 Expansion | 8 |
| 8 Polish | 9 |

Add 1 to `currentPhase`, to every `phases` block **key**, and to every `phase` field in
`decisions[]` / `findings[]`.

**B) Very old (`currentStage`, pre-`schemaVersion`) — stage → new 1-indexed phase directly:**

| Old stage | New phase (1-indexed) |
|---|---|
| 0 | 1 |
| 1 | 2 |
| 2 | 3 |
| 5 | 3 (non-gameplay merged into lifecycle) |
| 3 | 4 (if state tracking not yet done) **or** 5 (if state write/restore was underway) |
| 4 | 6 |
| 6 / 6a / 6b | 8 |
| 7 | 9 |

## Rewrite steps

1. **Advance value.** If the old current stage/phase was **`completed`**, the corresponding new phase(s)
   are complete; set `currentPhase` to the next phase to do. Note the case-B split: a **completed old
   Stage 3** means the new Phases **4 and 5** are both complete → set `currentPhase: 6`.
2. If the old value was **`in_progress`**, set `currentPhase` to the **earliest** new phase in its
   split so no work is skipped — e.g. an in-progress old Stage 3 → `currentPhase: 4`; an in-progress
   0-indexed `currentPhase: 4` → `currentPhase: 5`.
3. **Rename / remap keys.** `currentStage` → `currentPhase`; rename any other `stage`-keyed field to
   `phase`; remap every phase number (keys and values) per the table above.
4. **Stamp the schema.** Set `schemaVersion: 3`.
5. **Preserve everything else.** Leave all other `.ludeo/` content untouched — `tdd/`, `decisions[]`,
   `findings[]`, `curatedSlice`, `vcs`, `sdkSetup`, `packagingTarget`, tool deployments, etc.
6. **Record the migration.** Append a one-line note to `integration.json → decisions[]` (e.g.
   "Migrated phase schema to v3 (1-indexed) on <date>").

After rewriting, continue the per-session flow normally using the 1-indexed `currentPhase`.
