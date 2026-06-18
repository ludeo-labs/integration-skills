---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: 0
question: "Does this team track build artifacts (Binaries/, Intermediate UHT files) in VCS? Check `svn status` / `p4 opened` after your first editor build — if previously-tracked DLLs/PDBs/generated headers show as modified, you are on a tracked-binaries project and integration commits must exclude them."
sanitized: true
---

# Tracked-binaries projects: keep rebuilt artifacts of unrelated code OUT of integration commits

## Precondition

The game team commits build artifacts to VCS (common on SVN and Perforce teams so
artists/designers don't compile). Detect: after your first editor build, `svn status`
shows tracked `Binaries/*.dll/.pdb` and `Intermediate/.../Inc/...` (UHT generated) files
as Modified — not untracked.

## The Mistake

Building the editor target (to compile the BP Inspector plugin) brought the ENTIRE
editor target up to date — UBT relinked every code plugin in the project and re-ran UHT.
Relinked DLLs/PDBs always differ (embedded timestamps/build GUIDs), and UHT output
differed from what was committed (last committer used a slightly different engine/UHT
build). ~70 rebuilt artifacts of UNRELATED plugins and game modules showed as Modified
and were committed with the integration's first branch commit "to keep the branch
self-consistent."

The client reviewed the branch history and immediately asked: *"what are these files
doing in the integration branch? why are they changed?"* — the commit looked like the
integration had touched a Steam plugin it had nothing to do with.

## Why It's Wrong

1. **Diff noise destroys reviewability** — the integration's actual changes drown in
   binary churn; the client cannot tell what the integration really touched.
2. **Binary merge conflicts forever** — on a long-lived branch, every trunk→branch sync
   merge hits unresolvable binary conflicts on any artifact trunk also rebuilt (binaries
   can't be text-merged; each one is a manual resolve).
3. **It's not even needed** — the unrelated trunk-built binaries remain perfectly valid
   for the branch when the only source change is a new self-contained plugin.

## The Rule

Integration commits contain ONLY integration-owned files: the integration state dir,
Ludeo-owned plugins (source + their own artifacts if team convention tracks them), the
`.uproject` edit, and deliberate game-source modifications. Before EVERY commit on a
tracked-binaries project, group pending changes by top-level directory and revert
rebuilt artifacts of anything the integration does not own.

## Cleanup (if already committed)

Scoped reverse-merge per unrelated subtree — works without touching integration files:

```
svn update                       # merge needs a uniform-revision working copy (E195020 otherwise)
svn merge -c -<badRev> ^/branches/<branch>/<subtree> <wc>/<subtree>   # per subtree
svn commit -m "Revert unrelated rebuilt artifacts to trunk content"
```

(Perforce equivalent: `p4 revert` before submit; or `p4 copy` the depot revision back.)

## Bonus quirk

`svn merge` into a just-committed working copy fails with `E195020: Cannot merge into
mixed-revision working copy` — after a commit only committed files advance their
revision. Run `svn update` first; it's required before any merge.
