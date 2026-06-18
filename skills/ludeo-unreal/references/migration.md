# Migration — upgrade `.ludeo/integration.json` to the phase model

Run this when `.ludeo/integration.json` predates the phase restructure (it was created under the older
"stage" numbering). Detect the old schema, then rewrite it in place. This is a one-shot upgrade — once
`schemaVersion: 2` is set, this file is not needed again for that project.

## Detect (old-version signs)

- **PRIMARY:** `schemaVersion` is missing, or below `2`.
- **FALLBACK** (files predating `schemaVersion`): a `currentStage` key (instead of `currentPhase`), or any
  `stage`-named field (e.g. a per-section `stage` value).

If none of these are present and `schemaVersion` is `2`, no migration is needed — proceed normally.

## Old stage → new phase mapping

| Old stage | New phase |
|---|---|
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 5 | 2 (non-gameplay merged into lifecycle) |
| 3 | 3 (if state tracking not yet done) **or** 4 (if state write/restore was underway) |
| 4 | 5 |
| 6 / 6a / 6b | 7 |
| 7 | 8 |

## Rewrite steps

1. **Advance value.** If the old `currentStage` was **`completed`**, the corresponding new phase(s) are
   complete; set `currentPhase` to the next phase to do. Note the split: a **completed old Stage 3** means
   the new Phases **3 and 4** are both complete → set `currentPhase: 5`.
2. If the old `currentStage` was **`in_progress`**, set `currentPhase` to the **earliest** new phase in its
   split so no work is skipped — e.g. an in-progress old Stage 3 → `currentPhase: 3`.
3. **Rename keys.** `currentStage` → `currentPhase`; rename any other `stage`-keyed field to `phase`
   (preserve its value, remapped per the table above if it is a phase number).
4. **Stamp the schema.** Set `schemaVersion: 2`.
5. **Preserve everything else.** Leave all other `.ludeo/` content untouched — `tdd/`, `decisions[]`,
   `findings[]`, `curatedSlice`, `vcs`, `sdkSetup`, `packagingTarget`, tool deployments, etc.
6. **Record the migration.** Append a one-line note to `integration.json → decisions[]` (e.g.
   "Migrated stage→phase schema to v2 on <date>").

After rewriting, continue the per-session flow normally using `currentPhase`.
