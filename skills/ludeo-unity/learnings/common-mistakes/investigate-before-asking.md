---
category: common-mistakes
tier: universal
phase: "1,2,3,4,5,6,7,8"
sourceGame: TPSSample
question: null
sanitized: true
---

# Do the work before you speak — never ask what the repo answers, never assert what you haven't checked

Two failure modes, one root cause: producing output where investigation belonged.

- **Asking** what the codebase, SDK source, or docs already answer → §1.
- **Asserting** what you have not verified — including repeating this skill's own prose as
  fact → §2.

---

## §1 — Never ask what the repo already answers

Every phase brief has a **"Questions to ask the human"** section. It is a list of things
that are *not inferable*, not a script to read out. Treating it as a script produces long
question lists whose answers were one grep away, and it reads as the agent outsourcing its
own work.

**The rule: before asking anything, try to answer it from the codebase, the installed SDK
package source, or the live docs. Ask only what genuinely cannot be resolved that way.**

## Observed failures (all from a single phase-1 run)

| Asked | Should have |
|---|---|
| "Does the game have boss encounters, and how are the fights structured?" | Grepped for an `isBoss` flag and boss-arena prefabs — found a first-class boss flag with its own scoring tier plus fog-gated arena assets, in one search |
| "What are these uncommitted files — stash, commit, or discard?" | Run `git diff --stat` and classified them (re-serialized assets, regenerated font atlases) before involving anyone |
| "Please confirm the project compiles and plays as-is" | Run the compile headlessly and asked only about the *play* half — see [[agent-can-run-unity-compile-gates-headlessly]] |
| "Which scripted sequences need suppressing during restore?" | Grepped for countdown/timer classes and the pre-gameplay UI pages |

In each case the human's reply was some form of *"go find out yourself"* — correctly.

## What still deserves a question

Investigating first is not the same as never asking. Ask when the answer is:

- **A product decision** — which build/slice to target, what a good highlight moment is,
  the launch model. Not inferable from code, and guessing wrongly costs whole phases.
- **A secret or external credential** — API keys, user ids, environment names.
- **External system state** — Studio Lab environment config, creator entitlement, backend
  settings. Not visible from the repo at all.
- **Something requiring eyes on the running game** — "does it still play", "does the
  restored moment look right". Genuinely unautomatable.
- **A non-reversible choice with real cost** — vendoring a very large binary into git
  history, rewriting shared history, anything that is painful to undo.

## How to ask, when you do ask

- **Batch** the genuinely-unanswerable questions instead of drip-feeding them across turns.
- **Bring the evidence you already gathered** so the human is deciding, not researching.
- **Say what you checked**, so they know the question survived investigation.
- **State a recommendation and a default**, so silence still lets work continue.

## Anti-pattern: asking to look diligent

A long question list is not thoroughness — it is unbilled work handed to the human, and it
front-loads friction onto the part of the engagement where trust is being established. The
same list, minus everything the repo answers, is usually two or three real questions.

---

## §2 — Never assert what you haven't checked

The same discipline, pointed at your own output. Three specific traps, all observed:

**Repeating this skill's prose as verified fact.** The workflow files are guidance written
against a particular SDK version, not ground truth about the engine. The claim "the agent
cannot see the Unity Console" was repeated to a client — while `Debug.Log` output from an
`-executeMethod` run sat in a log file already read that same session. **When a workflow
file makes a capability claim, test it before passing it on.**

**Recommending without checking the recommendation against the skill's own warnings.** A
PlayMode lifecycle-test harness was proposed as the top automation priority. Phase 1 Step 4
forbids auto-firing SDK init in the Editor — the harness is exactly that, on a loop. The
skill contained the counter-argument the whole time. **Before recommending, grep the skill
for warnings about the thing you are recommending.**

**Repeating a workflow's stated fact about the installed package.** Menu-item names, method
names, and file layouts drift between SDK versions. Read the installed package, then state
what is there. (Observed: docs naming a menu item the package does not ship.)

### Cheap checks that would have caught each

| Claim about | Check |
|---|---|
| An agent capability ("can't see X", "can't run Y") | Try it once. One command settles it. |
| SDK API, menu item, or file layout | Grep the **installed package**, not the workflow text. |
| A recommendation's safety | Grep the skill for warnings naming that mechanism. |
| Anything version-dependent | Compare the workflow's pinned version to the installed one. |

### Say which is which

When you cannot verify something, label it — "the docs say X; I have not tested it" — rather
than laundering it into a flat assertion. A reviewer can challenge a labelled assumption. A
flat assertion has to be caught, and catching it is work you handed them.
