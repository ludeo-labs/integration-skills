# VCS Contract — Subversion (SVN)

Implementation of the VCS contract for SVN. Loaded when `integration.json → vcs.type == "svn"`. See `README.md` for the operation list and `detect_vcs`.

State recorded in `integration.json → vcs.svn`:
```json
"svn": {
  "url": "<working copy URL, e.g. .../trunk or .../branches/ludeo-integration>",
  "repositoryRoot": "<server repo root>",
  "workingCopyRevision": 0,
  "branchPlan": "deferred | ^/branches/ludeo-integration",
  "commitPolicy": "no commits until branch | normal"
}
```

## The delivery model — a permanent branch, NEVER reintegrated

**The Ludeo integration lives on its own long-lived branch and is never merged back to trunk.** The branch *is* the deliverable. This inverts the textbook SVN reintegrate-and-delete flow — do not propose merging the integration into trunk, and do not delete the branch after "delivery".

- **trunk → branch sync merges: yes, periodically.** In the branch working copy: `svn merge ^/trunk` then commit. SVN 1.8+ `svn:mergeinfo` tracks what's merged, so a bare `svn merge ^/trunk` picks up only new trunk changes. Small frequent syncs (weekly, or before each phase) beat one giant merge — teams keep editing the same `.uproject`/Config files.
- **branch → trunk: never.** Confirm the model with the human at engagement start, but this is the default for Ludeo integrations.

## `create_isolation(name)`

**SVN branch creation is a SERVER-SIDE COMMIT** — unlike git (local, free), `svn copy` writes to the client's repository immediately. Therefore it is **human-gated and deferrable**: until the human approves the branch, do all work locally in the existing working copy and commit nothing (see commit policy below).

When the human approves:

```bash
svn update                                              # branch from current trunk HEAD
svn copy ^/trunk ^/branches/ludeo-integration -m "Branch for Ludeo SDK integration"   # add --parents if branches/ is missing
svn switch ^/branches/ludeo-integration                 # in the project working copy
```

`^/` is repo-root shorthand. **`svn switch` preserves uncommitted local modifications** — work done while the branch was deferred (`.uproject` edit, `.ludeo/`, deployed tools) carries over; nothing is lost or redone. Follow the team's branch layout if it differs (check `svn ls ^/branches` — existing long-lived branches show the convention).

**Commit policy while deferred:** nothing gets `svn add`-ed or committed, but track what the integration touches (`svn status` shows tracked edits and unversioned additions) so the first branch commit is complete.

**First commit hygiene:**
- Mirror the team's `svn:ignore` convention (`svn propget svn:ignore <existing-dir>`) onto new plugin dirs — never commit `Binaries/` or `Intermediate/`.
- Exclude `.ludeo/downloads/` (SDK zips don't belong in the repo; the extracted plugin source does).
- The first commit with the extracted SDK (~4 GB) is slow even on a LAN — expected, not stuck.

## `acquire_component(name, dest)`

Same sources and methods as `git.md` `acquire_component` (release zip via authenticated `gh`, see `config/sdk-sources.json`), extracted into `Plugins/LudeoUESDK`. SVN has no submodules; the zip-and-commit path is the default.

**Optional vendor-branch pattern** (offer when SDK version churn is expected): drop each SDK release at `^/vendor/LudeoUESDK/<version>` and `svn copy` it into the branch's `Plugins/`. An SDK upgrade is then a tracked copy/merge instead of a multi-GB delete-and-re-add. Extra ceremony — skip if the team prefers replacing the folder in place.

## `ensure_editable(path)`

**No-op.** SVN working copies are writable by default (unlike p4). Sole exception: files carrying the `svn:needs-lock` property — if a write fails read-only, check `svn proplist -v <file>` and `svn lock` it.

## `open_review(summary)`

SVN has no native PR. The review unit is the branch's revision range — `svn log --stop-on-copy ^/branches/ludeo-integration` for the commit list, `svn diff -r <start>:<HEAD>` for the content. How the team actually reviews is team-specific: **ask the human** at the first Step 8 and record the answer.

## `guard_destructive`

Never run an irreversible SVN command on a single failed check. Treat as destructive and never run speculatively:

`svn revert -R` (irreversible — no reflog/stash; unversioned work is simply lost) · `svn cleanup --remove-unversioned` · `svn switch` (rewrites the working copy) · `svn rm` against a server URL · `rm -rf`

`L` (locked) markers in `svn status` usually mean an operation is **in progress or was interrupted** — never run `svn cleanup` while another process may still be working in the copy; confirm nothing is running first.

This is a **client's server**: every `svn copy`/`commit`/`rm` against a URL writes to it immediately. Verify with read-only commands (`svn info`, `svn status`, `svn ls`) before every server write.
