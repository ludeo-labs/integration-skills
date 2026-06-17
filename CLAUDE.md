# CLAUDE.md

This repository's agent guidance lives in [`AGENTS.md`](./AGENTS.md). Read it first.

Quick orientation for Claude Code specifically:

- Skills live under `skills/<name>/SKILL.md` and are installed independently via `npx skills add`.
- Engine detection + which skill to load: see [`AGENTS.md`](./AGENTS.md).
- Repo conventions for authoring/editing skills: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

When editing this repo, run `npm run validate` before committing — it lints every `SKILL.md` and
checks that the registry is up to date.
