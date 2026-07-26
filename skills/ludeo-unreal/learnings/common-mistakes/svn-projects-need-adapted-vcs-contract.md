---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: 1
question: "Is this project under SVN (not git or Perforce)? Check for a .svn directory at the project root and run `svn info` before assuming the git/p4 contract applies."
sanitized: true
---

# SVN projects need an adapted VCS contract (skill only ships git/p4)

## Precondition

The target game project is under Subversion. Detect with: `.svn` directory exists at the
project root AND `svn info <project>` succeeds (reports URL, working copy root, revision).

## The Situation

The skill's VCS contract (`references/vcs/`) covers **git and Perforce only**. A client
project arrived on SVN (working copy of `^/trunk`). The human's instruction was: "do not
commit anything until we branch."

## The Adaptation That Worked

Map the named VCS operations to SVN as follows:

| Operation | SVN implementation |
|-----------|-------------------|
| `detect_vcs` | `Test-Path <root>/.svn` + `svn info` (record URL, repo root, revision) |
| `ensure_editable` | **No-op.** SVN working copies are writable by default (unlike p4). Only exception: files with the `svn:needs-lock` property — check with `svn proplist` if a write fails. |
| `create_isolation` | **`svn copy ^/trunk ^/branches/<name>` is itself a SERVER-SIDE COMMIT.** Unlike git branching (local, free), creating an SVN branch writes to the repository immediately. Therefore: DEFER branch creation until the human explicitly approves, and do all work locally in the existing working copy meanwhile. Local modifications carry over via `svn switch` to the new branch later. |
| `open_review` | Team-specific (SVN has no native PR). Ask the human. |
| `guard_destructive` | Never run `svn revert -R`, `svn cleanup --remove-unversioned`, or `svn switch` on a single failed check. `svn revert` is irreversible (no reflog/stash equivalent for unversioned loss). |

**Commit policy:** until the branch exists, NOTHING gets `svn add`-ed or committed.
Track what the integration touches anyway (new untracked dirs, tracked-file edits like
the `.uproject`) so the eventual first branch commit is complete — `svn status` shows both.

## Record in integration.json

```json
"vcs": {
  "type": "svn",
  "svn": { "url": "...", "workingCopyRevision": N, "branchPlan": "deferred", "commitPolicy": "no commits until branch" }
}
```

## Breadcrumb for the skill implementor

Add `references/vcs/svn.md` implementing the table above, and extend `detect_vcs` in
`references/vcs/README.md` with the SVN probe (step between git and p4: `.svn` dir +
`svn info`). The schema's `vcs` block needs an `svn` variant.
