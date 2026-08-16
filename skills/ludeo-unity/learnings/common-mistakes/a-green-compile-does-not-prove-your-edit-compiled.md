---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5,6"
question: "Are you adding a member to an existing GAME file (an accessor so the layer can read private state, a hook call)? Before trusting the compile gate that follows, confirm the insertion point is LIVE code — an addition nothing references yet compiles clean even inside a commented-out or fenced region."
sanitized: true
---

# A green compile gate does not prove your edit compiled

The compile gate is the agent's main self-verification. It has a blind spot that is easy to walk
into and hard to notice, because the failure looks exactly like success:

> **Code that nothing references yet, added to a region that is not compiled, produces a clean
> compile.** The gate goes green. The member does not exist.

## What this looked like

The player's free-look camera angles were private, so the integration could not read them. The fix
was a small public accessor added to the file that declared those fields. Compile gate: **0 errors,
assembly rebuilt, clean.**

The next compile — the one that actually *used* the accessor — failed with
`'Player' does not contain a definition for 'CameraLook'`.

The file was dead. Its entire body, a `partial class` declaration and ~220 lines, sat inside a
`/* … */` block comment. A second, live copy of that camera logic existed under a different class in
a nearby folder, and that was the one the game actually ran. The accessor had been added to a
comment.

Nothing about the first compile hinted at this. The log even showed the file being imported.

## Why the ordering hides it

There are two compiles, and only the second one can catch it:

| Compile | What it contains | Result |
|---|---|---|
| after adding the accessor | a *definition* nobody calls | **passes**, whether or not the region is live |
| after writing the code that *calls* it | a definition **and** a reference | fails loudly if the definition isn't real |

If you gate-check between those two steps and report the first as verified, you have reported a
verification that could not have failed. That is worse than not checking — it launders an unknown
into a stated fact.

## The check — cheap, before you edit

Before adding a member to an unfamiliar game file, confirm the insertion point is live code:

- **Block comments.** `grep -n '/\*\|\*/'` the file. A `/*` near the top with the matching `*/` at
  the bottom means the whole file is inert. Files get commented out wholesale during refactors and
  the `.cs` stays in the project, importing normally.
- **Preprocessor fences.** `#if UNITY_EDITOR`, `#if false`, or a build define that is off in the
  target configuration. Same effect, and this one can differ between the Editor and the shipping
  build — see [[verify-the-define-fence-before-citing-a-hook]].
- **A duplicate live implementation.** The strongest tell that a file is dead is finding the same
  responsibility implemented somewhere else. If a grep for the field name returns two classes,
  find out which one the game constructs before editing either.

## The general rule

**Verify against the thing that would fail, not the thing that would pass.** A definition proves
nothing on its own; a *reference to it* proves it exists. When the two land in separate steps, treat
the first compile as "nothing broke" and not as "the change works" — and say so in those words when
reporting it.

The same shape recurs anywhere a check cannot fail: an assertion with no subject, a test with no
call site, a hook added to a path that never runs. Ask what the observation would look like if the
change were absent. If the answer is "identical", it is not evidence.

Related: [[investigate-before-asking]] §2 — never assert what you have not checked; this is the
version where the check itself was hollow.
