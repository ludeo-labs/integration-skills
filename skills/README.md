# skills/

Each subfolder is an independently installable, independently versioned
[Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills). See
[`../CONTRIBUTING.md`](../CONTRIBUTING.md) to add one (`npm run new-skill -- <name>`).

| Folder | Skill name | Status |
| --- | --- | --- |
| `ludeo-unreal/` | `ludeo-unreal-integration` | ⏳ empty placeholder — to be filled from `../../unreal-integration-skill` |
| `ludeo-unity/` | `ludeo-unity-integration` | ⏳ empty placeholder — to be filled from `../../unity-integration-skill` |
| `cloud-upload/` | `cloud-upload` | ⏳ empty placeholder — to be authored later |

All folders are currently empty placeholders (a `.gitkeep` keeps them in git). The registry only lists
folders that contain a `SKILL.md`, so `registry.json` is empty until a skill is filled in.

## Filling a skill in

Either author one in place (`npm run new-skill -- <name>` scaffolds from `../templates/skill-template`)
or move an existing skill's contents in (preserve history with `git subtree`/`git filter-repo` if you
want it). Align the skill's internal `name:` with its folder, then run:

```bash
npm run validate
npm run build-registry
```
