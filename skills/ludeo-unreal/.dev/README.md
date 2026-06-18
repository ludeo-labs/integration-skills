# `.dev/` — Internal maintainer content

Everything in this directory is **internal-only**. It is not part of the installable skill payload — end users running `npx skills add ludeo-labs/unreal-integration-skill` do not get it.

## Layout

| Path                          | What it is                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Docs/`                       | Project spec, addendum, Lyra PR learnings — the documents that informed the skill design.                                      |
| `Docs/References/Lyra/`       | The Lyra integration as a gold-standard reference: architecture TDD, lifecycle map, tracked data, UE integration spec, comparison report. |
| `Docs/References/integration-automation/` | SDK documentation and research templates from the prior engine-agnostic integration automation project.                |
| `CLAUDE.md`                   | Workspace rules used by AI coding agents when working on **this repo** (not the skill itself).                                  |
| `scripts/sync-learnings.sh`   | Helper for syncing learnings captured during real integrations back into this repo.                                            |

## Why a separate folder

`npx skills add` copies the entire repo root (minus dot-prefixed directories) into each agent's skill directory. Keeping internal docs under `.dev/` means:

- End users don't drag along 100+ MB of internal references.
- The shipped skill folder stays clean and focused on the runtime payload (`SKILL.md`, `references/`, `learnings/`, `tools/`, `config/`).
- Maintainers still have one source of truth — everything lives in the same Git history.

## Editing these files

Treat `.dev/Docs/` as living documentation: update the spec/addendum/learnings docs as the skill evolves, then write a normal Conventional Commit (e.g. `docs(spec): clarify Group 2 save flow`). `docs:` commits do not trigger a release.
