# File Access Rules

When a skill references files inside its **own** directory (`references/`, `config/`, `tools/`,
`learnings/`), **always use the Read tool with the full absolute path** constructed from the skill base
directory. Do **not** use Glob or other search tools — the paths are known.

Example: to read `config/sdk-sources.json`, call `Read("<skill-base-dir>/config/sdk-sources.json")`.

If `Read` returns "file does not exist" for a file these instructions reference, treat it as a skill
configuration error (see [destructive-action-guards](./destructive-action-guards.md) → "When a
referenced bundled file is missing"). Report the exact path and ask the human; never infer absence from
a search tool's negative result.

Files **inside the user's game project** (source, assets, save data) are discovered normally with Glob /
Grep / Read — those rules apply only to the skill's own bundled content.
