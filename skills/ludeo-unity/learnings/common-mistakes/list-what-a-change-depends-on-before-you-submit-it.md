---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "1,3,5,6,7,8"
question: "Is the integration split across several pending changelists (or local commits) on a depot the studio shares? Before submitting any of them, list what that change depends on that is NOT in it — the SDK package, earlier phases, files never added, edited project files — and submit in dependency order."
sanitized: true
---

# List what a change depends on before you submit it

Splitting an integration into one pending changelist per phase looks tidy, but a submit sends only the
changelist selected; the depot knows nothing about the others. Submitting the newest phase first
inverts the dependency order.

## What it cost

The phase 5 changelist was submitted on its own to the studio's shared development line. It compiled
only against work that was not in the depot: the vendored SDK package and phases 0–3 were still
pending, 31 of the integration's own source files had never been added, and the assembly references
and game-code hooks had been edited but never opened. The shared line did not compile for the whole
studio until four more submits the same day, one of which touched files teammates had open. Four days
later the work moved to a private branch, and the next day 605 files were backed out of the shared
line — about five hours of recovery in all, plus a standing rule that nothing is submitted without two
explicit orders from the integrator.

## Before any submit

1. **List what the change depends on that is not in it**: the SDK package, earlier phases'
   changelists, new files (`p4 reconcile -n -a`), and edited project files such as assembly definitions
   (`p4 reconcile -n -e`) — see [[an-edit-perforce-was-never-told-about-is-invisible-to-it]].
2. **Check older pending changelists** (`p4 changes -s pending`, `p4 opened`) and submit in dependency
   order: the SDK first, then the phases in order.
3. **Check who else has the files open.** Shared game files often need a resolve.
4. **Show the integrator the changelist number, its full file list, the target branch and what it
   depends on** before anything is submitted. On a shared depot, the gap between "ready" and "submit"
   is where this check happens.
5. **Prefer a private branch for integration work from day one**, and merge down before copying up.
6. **After a submit, prove the depot is whole**: a reconcile that finds nothing left, and ideally a
   compile against a clean sync. "Every referenced file is in the depot" is not the same as "it builds".
