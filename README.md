# Ludeo Integration Skills

AI skills that teach your coding agent how to integrate the **Ludeo SDK** into a game — from SDK
install through action mapping, state tracking, playable-highlight (Player Flow) restoration, and
uploading the finished build to the Ludeo cloud.

This repo is the **single source of truth** for every Ludeo integration skill. Each skill follows the
[Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills) spec, so any compatible
agent can install it with [`npx skills`](https://skills.sh).

## Skills

> **Status:** the skill folders are currently empty placeholders — see [`skills/README.md`](./skills/README.md).
> The planned skill set is below.

| Skill | Engine / scope | Install (once filled in) |
| --- | --- | --- |
| `ludeo-unreal-integration` | Unreal Engine (C++/Blueprint) | `npx skills add ludeo-labs/integration-skills/skills/ludeo-unreal` |
| `ludeo-unity-integration` | Unity (C#) | `npx skills add ludeo-labs/integration-skills/skills/ludeo-unity` |
| `cloud-upload` | Validate + upload a build to the Ludeo cloud | `npx skills add ludeo-labs/integration-skills/skills/cloud-upload` |

> See [`SKILL_TREE.md`](./SKILL_TREE.md) for the full index and a keyword quick-lookup table, and
> [`AGENTS.md`](./AGENTS.md) for how an agent should pick the right skill.

## Quick start

1. Install the skill for your engine (table above).
2. Open your game project in your agent and say: *"Integrate Ludeo into my game."*
3. The skill walks the integration workflow phase by phase.
4. When the integration is done, install `cloud-upload` and say *"Upload my build to Ludeo."*

## Repository layout

```
skills/      The skills themselves (one folder per skill) — the source of truth
shared/      Engine-neutral SDK concepts both engine skills draw on
scripts/     Repo tooling: validate skills, rebuild the registry, scaffold new skills
templates/   Blueprint for authoring a new skill
docs/        Architecture + install notes
.github/     CI: validate on PR, release per skill, rebuild registry on main
```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) to add or edit a skill, and
[`RELEASING.md`](./RELEASING.md) for the per-skill release process.

## License

[Apache-2.0](./LICENSE)
