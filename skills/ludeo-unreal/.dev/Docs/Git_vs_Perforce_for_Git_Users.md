# Git vs Perforce — a quick guide for git users

For teammates comfortable with git who are about to work in a Perforce ("p4") shop — common at game studios. This covers the mental-model shifts and the day-to-day command mapping. It is not a full p4 manual.

## The one-paragraph mental model

**Git is distributed; Perforce is centralized.** In git, you have a full copy of the repo and its history locally; you commit locally and `push` when ready. In Perforce, **the server is the source of truth** and you have a *workspace* — a local mirror of a slice of the server. You don't have local history. You **check out** files (which makes them writable), edit them, and **submit** them straight to the server. There's no local commit, no rebase, and you're effectively always working against the live server.

## The five things that surprise git users

1. **Files are read-only until you check them out.** A fresh p4 workspace has every tracked file marked read-only on disk. You must `p4 edit <file>` before changing it (this makes it writable and adds it to a pending changelist), and `p4 add <file>` for brand-new files. Editors/tools that just try to write will fail with "access denied" until then.
2. **A "changelist" is not a commit.** A changelist (CL) is a bundle of pending checked-out files. `p4 submit` sends it to the server — roughly `git commit` + `git push` in one atomic step. There is no local-only commit to amend or rebase.
3. **You must `sync` to get changes.** `p4 sync` pulls the latest server state into your workspace (like `git pull`, but it just updates files — there's no merge of *your* local commits, because you don't have any).
4. **Streams are first-class branches.** Many studios use *streams* (mainline → dev → release → task). The flow is explicit: **copy up** (promote changes toward mainline) and **merge down** (take mainline changes into your stream). A **task stream** is the lightweight, throwaway analog of a git feature branch.
5. **You're normally online.** Most operations talk to the server. Offline work is awkward (it exists, but it's not the default the way git's local workflow is).

## Command cheat-sheet

| Intent | Git | Perforce |
|--------|-----|----------|
| Get the project | `git clone <url>` | set up a *workspace/client* + `p4 sync` |
| Get latest | `git pull` | `p4 sync` |
| Start editing a file | (just edit) | `p4 edit <file>` |
| Add a new file | `git add <file>` | `p4 add <file>` |
| Delete a file | `git rm <file>` | `p4 delete <file>` |
| See what changed | `git status` | `p4 opened` (checked-out) / `p4 status` (reconcile preview) |
| Commit + share | `git commit` + `git push` | `p4 submit -c <CL>` |
| Discard local changes | `git restore <file>` / `git checkout -- <file>` | `p4 revert <file>` |
| Hard reset to server | `git reset --hard` | `p4 sync -f` (force) / `p4 revert` |
| Stash WIP | `git stash` | `p4 shelve -c <CL>` |
| Feature isolation | `git checkout -b feature` | task/dev **stream**, or a numbered pending CL |
| Diff | `git diff` | `p4 diff` |
| History of a file | `git log <file>` | `p4 filelog <file>` |
| Ignore files | `.gitignore` | `.p4ignore` (may need `P4IGNORE` env set) |
| Code review | GitHub/GitLab Pull Request | **shelve** the CL + Swarm review |
| Server/identity info | `git remote -v` | `p4 info` |

## Concepts with no clean equivalent

**Only in Perforce (new to git users):**
- **Check-out / read-only files** — `p4 edit` / `p4 add` before writing (#1 above).
- **Workspace / client spec** — a mapping of depot paths (`//depot/Lyra/...`) to local paths, plus which files you sync.
- **Shelving** — park a changelist on the server without submitting (share WIP, hand off, or stash).
- **Streams flow** — copy-up / merge-down between mainline and child streams.

**Only in Git (gone in Perforce):**
- Local commits, `rebase`, `cherry-pick` of *local* history — there's no local commit graph to rewrite.
- `git stash` (closest p4 analog: shelving).
- Cheap fully-offline workflow.

## A feature, end to end

**Git:**
```
git checkout -b my-feature
# edit files freely
git add -A && git commit -m "..."
git push -u origin my-feature
# open a Pull Request
```

**Perforce (stream-based):**
```
# (one-time) create/switch to a task or dev stream + workspace, then:
p4 sync                      # get latest
p4 edit Source/Foo.cpp       # make existing files writable
# ...edit them...
p4 add Source/NewFile.cpp    # register new files
p4 shelve -c <CL>            # (optional) park for review in Swarm
p4 submit -c <CL>            # send the changelist to the server
```

## Gotchas checklist for git users

- [ ] Did you `p4 edit` the file before changing it? (Read-only errors = no.)
- [ ] Did you `p4 add` every new file? (Untracked files don't submit themselves.)
- [ ] Did you `p4 sync` recently? (You won't "auto-fetch" like a git fetch.)
- [ ] Are binary/generated dirs in `.p4ignore`? (`Binaries/ Intermediate/ Saved/` — same idea as `.gitignore`.)
- [ ] Don't expect local commits — a submit goes straight to the server, visible to everyone.
- [ ] Destructive ops differ: `p4 revert` discards your checkout, `p4 sync -f` force-overwrites local files. Treat both as carefully as `git reset --hard`.

## How these differences impact the Ludeo integration skill

The skill today assumes git/GitHub end to end. Here is where each Perforce difference lands, mapped to the actual skill surface (Stage 0 setup, the tools, the state file, the review cycle).

| Skill area | Git today | Perforce impact | What has to change |
|---|---|---|---|
| **VCS detection** (Phase 0) | implicit — assumes git | nothing works until we know which VCS | New Phase-0 step: `p4 info` succeeds **and** its `Client root` is an ancestor of the project → p4; else `.git` → git. Record `integration.json → vcs`. |
| **Work isolation** (Stage 0) | `git checkout -b ludeo-integration/<game>` | branches don't exist | "Create isolation context" becomes a **task/dev stream** (or a pending changelist). We encourage a branch (git) or stream (p4); most studios use streams. |
| **UE plugin acquisition** (Stage 0) | `git submodule add` LudeoUESDK | no submodule concept | Download the plugin **zip endpoint** → extract into `Plugins/LudeoUESDK` → `p4 add` the tree. |
| **C SDK acquisition** (Stage 0) | nested submodule into `Source/LudeoSDK/SDK` | same | Download zip → extract → `p4 add`. |
| **Writing any file** (every code stage + all `.ludeo/` writes) | Write/Edit just work | workspace files are **read-only by default** | Standing rule: `p4 edit <file>` (existing) or `p4 add <file>` (new) **before** every write. This is pervasive — not a one-time setup step — which is why it can't live only in Phase 0. |
| **BP Inspector `set-savegame`** (tools) | modifies `.uasset` freely | `.uasset` files are read-only | `RunBPInspector` must `p4 edit` the target `.uasset`(s) before the tool writes them, or the write fails silently/with access-denied. |
| **Ignore rules** | `.gitignore` | `.p4ignore` (already present) | Use `.p4ignore`; make sure `.ludeo/` intermediate output and plugin `Binaries/ Intermediate/ Saved/` aren't accidentally submitted. |
| **Review handoff** (Step 8 / PR cycle) | open a GitHub Pull Request | no PRs | "Open a review" becomes **shelve the changelist + Swarm review**, or hand off a numbered CL. |
| **Destructive-op guards** (Bash Safety) | never blind `git reset` / `checkout --` / `submodule deinit` | different danger commands | Restate the guard per VCS: never blind `p4 revert` / `p4 sync -f`. |
| **Absolute-paths / submodule guidance** (Bash Safety) | submodule `cd` + nested-submodule rules | no submodules | Replace with p4 workspace/client-root rules; the submodule-specific cautions don't apply. |
| **State schema** (`integration.json`) | `sdkSetup.method: submodule\|download\|existing`, `branch` | needs to record p4 context | Add `vcs: "git"\|"p4"`; for p4 record client/stream/depot path; `method` becomes `zip` for the p4 acquisition path. |
| **Build / package** (tools) | VCS-agnostic; `BuildAndPackage.bat` already passes `-noP4` | unchanged | None — the build tooling is already VCS-neutral. |

### The pervasive one: read-only files

Most of the table is Stage-0-only, but **"`p4 edit`/`p4 add` before writing"** touches *every* stage that produces a file — code, `.ludeo/` state, and the BP Inspector's `.uasset` edits. The harness's Write/Edit tools will simply error on a read-only file. So when p4 is detected, that rule has to be loaded and in force for the **whole** integration, not just setup.

### The planned shape

A thin **VCS-agnostic contract** (the named operations: *detect · create isolation context · acquire plugin · make file editable · track new file · open a review · guard destructive ops*) plus two reference files — `references/vcs/git.md` and `references/vcs/p4.md` — that implement each operation. Phase 0 detects the VCS, records it, and loads **only** the matching file; later stages call operations by name instead of hardcoding git. This is the same "thin selector + load-only-the-match" disclosure pattern proposed for the phase-07 restore branches.

### v1 scope (decided)

- **Single VCS, keyed off where the *code* lives.** Content-in-p4-but-code-in-git is treated as git (e.g. Lyra-in-git carries no content in VCS anyway). No mixed-mode in v1.
- **Encourage branch (git) / stream (p4)** for isolation.
- **Zip endpoint** URL pending; it will be added to `config/sdk-sources.json` as a per-component `downloadUrl`.
