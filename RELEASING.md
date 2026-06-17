# Releasing

Each skill in `skills/<name>/` is its **own release unit** with its own `package.json`, `CHANGELOG.md`,
and `.releaserc.json`. Releases are driven by [semantic-release](https://semantic-release.gitbook.io)
from [Conventional Commits](https://www.conventionalcommits.org).

## How a release happens

1. Land a PR to `main` with conventional-commit messages scoped to a skill, e.g.
   `feat(cloud-upload): add status polling` or `fix(ludeo-unity): correct define guard`.
2. `.github/workflows/release.yml` detects which `skills/*` changed and runs semantic-release for each.
3. semantic-release computes the next version, updates the skill's `CHANGELOG.md` and `package.json`,
   tags it (`<skill-name>@<version>`), and publishes a GitHub release.
4. `.github/workflows/registry.yml` rebuilds `registry.json` + `SKILL_TREE.md` on `main`.

## Versioning rules

- `fix:` → patch · `feat:` → minor · `feat!:`/`BREAKING CHANGE:` → major.
- Bump `metadata.version` in `SKILL.md` to match the released `package.json` version — `npm run validate`
  fails if they drift.

## Tags & install pins

- Tag format: `<skill-name>@<major.minor.patch>` (e.g. `cloud-upload@1.2.0`).
- Users install latest with `npx skills add ludeo-labs/integration-skills/skills/<name>` or pin a tag.

## Manual / dry run

```bash
cd skills/<name>
npx semantic-release --dry-run
```
