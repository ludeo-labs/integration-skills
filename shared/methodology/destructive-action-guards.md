# Destructive Action Guards

These rules apply in every skill, in addition to the harness's own safety behavior.

## Never delete, overwrite, or recreate

- The skill's own bundled directories (`references/`, `config/`, `tools/`, `learnings/`).
- The user's source control metadata (`.git/`).
- The user's existing game source, assets, or save data — integration **adds** code; it does not
  rewrite unrelated systems.
- The integration state file (`.ludeo/integration.json`) and plan docs — append/update, never wipe.
- Committed `learnings/` entries — they are **append-only**.

## Confirm before

- Modifying build configuration, project settings, or `.gitignore` in the user's repo.
- Running any command that packages, uploads, or publishes a build (that's `cloud-upload`'s job, and it
  confirms first).
- Bulk edits across many files (state the file list and the change first).

## When a referenced bundled file is missing

If `Read` reports a skill-bundled file does not exist, that is a **skill configuration error**, not
expected behavior. Report the exact path tried and ask the human. Do not silently fall back, work
around it, or declare the file missing based on a search tool's negative result.
