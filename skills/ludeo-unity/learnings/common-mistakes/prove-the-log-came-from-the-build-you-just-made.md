---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "1,3,5,6,7"
question: "Are you about to read a runtime log to judge a change you just built? A player build takes minutes and rewrites the previous player in place, so a run launched during that window exercises the OLD binary - and its log looks like a perfectly good pass."
sanitized: true
---

# Prove the log came from the build you just made

A player build here takes about four to six minutes and overwrites the previous player in place.
If anyone launches the game during that window they get the old binary, and nothing about the
resulting log says so. It parses, it has the expected shape, and it can read as a clean pass of the
very change it does not contain.

That happened: a log was handed over as the first test of new verification code, and it showed the
integration working. It was the previous build. The new checks had never run.

## The check that catches it

Before reading anything else in a fresh log, **search it for a string only the new code can print**
— and search for a string only the *old* code could print. Both answers matter:

- new string present, old string absent → this is the new binary, read on;
- old string present → this run predates the change, stop and re-run.

It costs one grep and it is the difference between a real result and a confident wrong one.

## The stronger version, for a change with no new log line

When the change adds no distinctive output, search the **built assembly** rather than the log.
Compiled string literals are in there, and so are type and method names:

- a literal you added → should be present;
- a literal or method name you deleted → should be absent.

This also catches the other failure in the same family: trusting a build's exit code. A batchmode
build whose `-executeMethod` threw can still exit `0` and print "Exiting batchmode successfully".
Confirm the build's own success line, then confirm the artifact contains the change. See
[[a-green-compile-does-not-prove-your-edit-compiled]], which is the compile-time twin of this.

## Also: do not launch into a build in progress

Say explicitly when a build is running and when it has finished. A run started against a
half-written player folder is not just stale, it is undefined - the process loads whichever files
happened to be there. Wait for the build's success line before anyone launches.
