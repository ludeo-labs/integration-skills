# Installing the skills

Every skill follows the [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
spec and installs with [`npx skills`](https://skills.sh). Install only the skill(s) you need.

## By engine

```bash
# Unreal Engine project
npx skills add ludeo-labs/integration-skills/skills/ludeo-unreal

# Unity project
npx skills add ludeo-labs/integration-skills/skills/ludeo-unity
```

## Build & ship

```bash
# Validate + upload a build to the Ludeo cloud
npx skills add ludeo-labs/integration-skills/skills/cloud-upload
```

## Updating

```bash
npx skills update <skill-name>
```

`SKILL.md` is cached per agent session — after updating, start a fresh session so the new version loads.

## Pinning a version

Each skill is tagged `<skill-name>@<version>` (e.g. `cloud-upload@1.2.0`). Pin a tag when you need a
specific release; otherwise the latest published version is used.

## SDK docs MCP (recommended)

Copy [`.mcp.json`](../.mcp.json) into your agent's MCP config so the skill can look up Ludeo SDK APIs
via the `sdk-docs` server instead of guessing. Set `LUDEO_DOCS_BASE_URL` if your docs are hosted
elsewhere.
