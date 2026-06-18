# VCS Contract

The skill supports three version-control systems: **git/GitHub**, **Subversion (SVN)**, and **Perforce (p4)**. This directory abstracts every VCS-specific operation behind a small contract so the phase logic stays VCS-agnostic. Phase 0 detects the VCS once; every later phase calls operations **by name** and consults the matching implementation file.

- `git.md` — git/GitHub implementation of each operation.
- `svn.md` — Subversion implementation (permanent-branch delivery model; branch creation is a server-side commit).
- `p4.md` — Perforce implementation (MCP-primary, with raw-CLI fallback).

## How this is used

1. **Phase 0** runs `detect_vcs` (below), records `integration.json → vcs.type`, then loads the matching file (`git.md`, `svn.md`, or `p4.md`).
2. **Every later session**, the Per-Session Flow reads `vcs.type` from `integration.json` and loads the matching file **before any file write**.
3. Phase logic never hardcodes `git` or `p4` — it invokes the named operations and the loaded file supplies the commands.

## The operations

| Operation | When | Intent |
|-----------|------|--------|
| `detect_vcs` | Phase 0, first | Decide git vs p4 and record it |
| `create_isolation(name)` | Phase 0 | Make an isolated place for the work (branch / stream / changelist) |
| `acquire_component(name, dest)` | Phase 0 SDK setup | Get the LudeoUESDK plugin and the C SDK into the project |
| `ensure_editable(path)` | **before every Write/Edit** | Guarantee the file can be written and is tracked |
| `open_review(summary)` | Step 8 | Put the work up for human review |
| `guard_destructive` | always | Never run an irreversible VCS command on a single failed check |

## `detect_vcs` (runs before either file loads)

Decide by **where the code lives** (v1 is single-VCS — see below):

1. **git first.** If the project is a git work tree AND git tracks the `.uproject`:
   ```bash
   git -C "<project>" rev-parse --is-inside-work-tree   # true?
   git -C "<project>" ls-files --error-unmatch "<GameName>.uproject"   # tracked?
   ```
   Both succeed → `vcs.type = "git"`.
2. **else svn.** If a `.svn` directory exists at the project root AND `svn info` succeeds there:
   ```bash
   Test-Path "<project>/.svn"        # working copy marker?
   svn info "<project>"              # reports URL, repo root, revision?
   ```
   Both succeed → `vcs.type = "svn"` (record URL, repository root, working-copy revision).
3. **else p4.** If `p4 info` succeeds, its `Client root` is an ancestor of the project, AND the `.uproject` maps into the depot:
   ```bash
   p4 info                       # Client root covers the project?
   p4 where "<GameName>.uproject"   # resolves to a depot path?
   ```
   All succeed → `vcs.type = "p4"`.
4. **Multiple or none → ask the human.** Don't guess.

Record `vcs.type` (and the git/p4 details each file specifies) in `integration.json → vcs`.

**v1 scope:** a single VCS, keyed off where the **code** lives. A project whose *code* is in git but whose *content* is in p4 is treated as **git** (e.g. Lyra-in-git carries no content in VCS at all). No mixed-mode handling in v1.

## Always-in-force rule (Perforce)

`p4.md`'s `ensure_editable` is not a one-time step — a p4 workspace is **read-only by default**, so the harness Write/Edit tools fail on any tracked file until it is opened for edit. When `vcs.type == "p4"`, you MUST `ensure_editable` before **every** Write/Edit to a workspace file, for the whole integration. SKILL.md carries a short always-loaded reminder of this; `p4.md` has the mechanics.
