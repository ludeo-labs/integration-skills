---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 4,5,6
question: "About to follow a file:line reference recorded in an EARLIER phase's artifact (CODE_MAP, integration points, a TDD)? Check whether a later phase edited that file. Phase 3 inserts hooks into exactly the game files phase 2 indexed by line, so every reference below an insertion silently points somewhere else — and the shift is not uniform, so you cannot correct it with an offset either."
sanitized: true
---

# A CODE_MAP line reference goes stale the moment you edit the file it points into

Phase 2 records the game's structure as `file:line` coordinates. Phase 3 then edits game files to
install the lifecycle hooks. Nothing reconciles the two, so by the time phase 4 opens `CODE_MAP.json`
a large fraction of its line numbers no longer point at what they claim.

This is not a rare accident — it is **structural to the workflow's own ordering**. The files phase 3
edits are, by construction, the highest-value files phase 2 indexed: the central event hub, the flow
manager, the pause UI, the debug menu. Those are precisely the entries later phases follow most.

## What it looks like

On one integration, 54 of the artifact's references pointed into the four files the lifecycle work had
touched. Sampling three of them:

| The artifact claimed | What was actually on that line |
|---|---|
| the enemy-registration event | an unrelated UI event declared 12 lines earlier |
| the orb-spawn method | a bare `else` |
| the scene-teardown method | a closing brace |

Every one of those is a plausible-looking place to land. None of them errors. You read the wrong code,
form a wrong belief about the game, and carry it into a capture or restore design.

## Why an offset does not save you

The tempting fix — "phase 3 added N lines, subtract N" — is wrong, because the hooks are inserted at
**several different points** in a file, so the shift is a step function, not a constant. On the same
integration the central hub had drifted **+12** at its event-declaration block and the flow manager
**+61** at its scene-load seam. Applying either number globally would have moved correct references off
target while leaving others wrong.

## The rule

**Re-locate by symbol, never by number.** When you need a reference from an earlier artifact:

1. Take the *name* the entry claims — the method, event, field, or class.
2. Find its declaration in the current working copy.
3. Use that line. If the entry carries no name you can search for, treat the reference as unverified and
   read the surrounding region before trusting it.

This is cheap enough to automate. A pass that walks the artifact, extracts each entry's claimed
identifier, and re-greps for its declaration will resolve the large majority mechanically; the residue
is call sites (rather than declarations) and entries whose description names no symbol, and those are
few enough to check by hand.

Three things worth doing when you repair them:

- **Keep the old value** (e.g. a `_lineRepairedFrom` field) — it is the evidence that the entry moved,
  and it distinguishes "verified correct" from "never checked".
- **Log the repair** in the artifact's own corrections log, so the next reader knows the file was
  audited and when.
- **Check the file, not just the line.** The same audit surfaced an entry pointing at the wrong *file*
  entirely — a lock/unlock pair attributed to the event hub when both live on the flow manager. A
  by-symbol search finds this; a by-offset correction cannot, because it never questions the path.

## Where this bites hardest

The worst case is a multi-thousand-line "god" class — common in this genre, where one singleton owns
most of the game's events. In a file that large, a wrong line still lands you inside real, related-looking
code, so nothing signals the error. In a 200-line file you would notice immediately.

## Do this before the phase, not during it

Audit the references **at the start** of any phase that consumes an earlier artifact, as a batch, rather
than discovering staleness one reference at a time while reasoning about something else. Finding it
mid-task means you have already read some unknown number of wrong lines without knowing which.

Related: [[investigate-before-asking]] — same instinct, one level down: verify the coordinate before you
trust what you read at it. And [[a-green-compile-does-not-prove-your-edit-compiled]] — another case where
an artifact's claim and the live code had quietly diverged.
