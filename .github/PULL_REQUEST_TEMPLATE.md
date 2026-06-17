<!-- Use Conventional Commits in the title, scoped to a skill: feat(cloud-upload): … -->

## What & why

<!-- What does this change and why? -->

## Skill(s) affected

- [ ] `ludeo-unreal`
- [ ] `ludeo-unity`
- [ ] `cloud-upload`
- [ ] shared / hub (no skill release)

## Checklist

- [ ] `npm run validate` passes
- [ ] `npm run build-registry` run (registry.json / SKILL_TREE.md current)
- [ ] `metadata.version` in SKILL.md matches package.json (if releasing)
- [ ] Any `learnings/` added are sanitized (no game names, secrets, or proprietary code)
- [ ] Engine-neutral content lives in `shared/`, not duplicated in the skill body
