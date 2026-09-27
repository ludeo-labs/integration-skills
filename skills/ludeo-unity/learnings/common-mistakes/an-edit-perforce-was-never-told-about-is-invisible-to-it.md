---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "1,2,3,4,5,6,7,8"
question: "Is the game's source in Perforce, where files are read-only until checked out? Then clearing the read-only flag to edit leaves Perforce unaware of the change. Check files out instead, and reconcile edits as well as adds before calling any work saved."
sanitized: true
---

# An edit Perforce was never told about is invisible to it

Perforce marks unopened files read-only. An agent that hits the permission error and clears the flag
can write the file, but the file is now modified without being opened, and Perforce has no record of
the change until a reconcile finds it. `p4 sync` reporting "up to date" says nothing about such files,
because it only compares Perforce's own records — and a later sync can silently overwrite them.

## What it cost

- 31 new integration source files were never added to the depot, and a changelist submitted against
  them left the studio's shared line uncompilable (see
  [[list-what-a-change-depends-on-before-you-submit-it]]).
- An accessor block added to a game file was lost, most likely overwritten by a sync while modified but
  unopened, and came back as 11 compile errors.
- The recovery's own reconcile was **add-only**, so edited existing files — assembly references, game
  hooks — were missed a second time and had to be found with a separate edit scan.
- Five days later a routine scan still found 18 more diverged files that had never been opened,
  including one that existed nowhere in version control. It was still happening at the end.

## The habit

1. **Check files out before editing** (`p4 edit`), or ask the integrator to, rather than clearing the
   read-only bit. If the server is unreachable and you must clear it, keep a list of every file touched
   and reconcile as soon as the server is back.
2. **Before calling work saved, reconcile both ways** over every folder the integration touched —
   `p4 reconcile -n -a` for adds **and** `p4 reconcile -n -e` for edits — and put each file in a named
   changelist.
3. **Watch the Editor's own Perforce integration.** It opens files by itself, adds new files to the
   default changelist, and reopens files as fast as they are reverted. Close every Editor before revert,
   shelve or workspace-switch work.
4. **Shelve work in progress**, so a copy lives on the server. Shelving is not submitting.
