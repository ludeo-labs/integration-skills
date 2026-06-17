# Contributing

## Repository model

This is a **monorepo** and the single source of truth for every Ludeo integration skill. Each skill in
`skills/<name>/` is an independently versioned, independently installable
[Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills). The hub adds the
registry/index and CI.

## Add a new skill

```bash
npm run new-skill -- <skill-name>      # scaffolds skills/<skill-name>/ from templates/skill-template
```

Then:

1. Fill in `SKILL.md` frontmatter — `name` (kebab-case, matches the folder), `description` (when to
   trigger; this is what the agent matches on), and `metadata.version`.
2. Write phase docs under `references/`, one file per phase.
3. Reference shared content instead of duplicating it (link into `shared/`).
4. Run `npm run validate`, then `npm run build-registry` to refresh `registry.json` + `SKILL_TREE.md`.

## Authoring rules

- **Frontmatter is mandatory**: `name` + `description`. The `description` decides when the skill fires —
  make it specific and trigger-oriented.
- **Don't duplicate shared guidance.** Engine-neutral content lives in `shared/`; skills link to it.
- **Engine-specific content stays in the skill body.** Only the skeleton is unified, never the idioms.
- **Learnings are append-only and sanitized.** Follow
  [`shared/learnings-policy/learning-sanitization.md`](./shared/learnings-policy/learning-sanitization.md)
  — no game names, secrets, or proprietary code in committed learnings.
- **Keep `SKILL.md` lean.** Push detail into `references/` files the agent loads on demand.

## Before you commit

```bash
npm run validate        # lint every SKILL.md (frontmatter, link resolution, size)
npm run build-registry  # regenerate registry.json + SKILL_TREE.md
npm run check           # both: validate + verify the registry is current (what CI runs)
```

CI runs `npm run check` on every PR (`.github/workflows/validate.yml`).

### Pre-commit hook

The repo ships a git pre-commit hook in `.githooks/pre-commit` that runs `npm run check`
automatically when you commit changes to `skills/`, `shared/`, `scripts/`, `templates/`, or the
generated index files. It's enabled by `core.hooksPath`, which the `prepare` npm script configures for
you on `npm install`. To enable it manually:

```bash
git config core.hooksPath .githooks
```

To bypass it for a single commit (e.g. a WIP commit), use `git commit --no-verify`.

### Secret scanning (don't commit sensitive data)

Three layers prevent credentials from being committed:

1. **`.gitignore`** keeps secret files untracked (`.env*`, `*.ludeo-cli.json`, `*.pem`/`*.key`, …).
   Keep real values in a git-ignored `*.local` / `.env` file; commit only `*.template.*` with
   `${ENV_VAR}` placeholders.
2. **Pre-commit scan** — the hook runs `npm run scan-secrets` (`scripts/scan-secrets.mjs`) on every
   commit. It scans staged content for private keys, cloud/provider tokens, JWTs, and
   `key/secret/token/password = …` assignments (including Ludeo keys), and blocks the commit on a hit.
   Placeholders (`${...}`, `REPLACE_ME`, `<your-key>`) are ignored.
3. **CI backstop** — `.github/workflows/secrets.yml` re-runs the scanner over all files and runs
   [gitleaks](https://github.com/gitleaks/gitleaks) (config in `.gitleaks.toml`) on PRs and pushes, so
   anything that bypassed the local hook is still caught.

False positive? Add `gitleaks:allow` on the line, or extend `ALLOW_PATHS` / `PLACEHOLDER` in
`scripts/scan-secrets.mjs` (and the `[allowlist]` in `.gitleaks.toml`). If you ever *do* commit a real
secret, rotate it immediately — removing it from a later commit does not remove it from history.
