---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5,6"
question: "Are you running an orchestrated phase (3, 5 or 6) where a subagent has surfaced a question for the human?"
sanitized: true
---

# Relaying a subagent's question is not exempt from investigate-before-asking

The orchestrator briefs say the orchestrator *"relays whatever a subagent surfaces — it does
not invent its own"*. Read literally, that turns the orchestrator into a pipe, and it collides
head-on with [[investigate-before-asking]]. **Relay is not a licence to skip verification.** The
subagent worked in isolated context, on one brief; the orchestrator holds the state file, the
glossary and the prior phases' decisions — it is the *only* place a bad question can be caught.

## What this looked like

A phase-3 subagent surfaced: *"level→level: is an intermediate level a finished moment? Not
inferable from code — it's a product call. Recommend End; default to End."*

The orchestrator relayed it. In relaying, it added its own framing — "this decides how many
playable clips a run can produce" — which contradicted the engagement's own glossary (the
platform decides how many clips a captured stretch yields, not the game). The integrator
rejected the question outright.

Two separate failures, and the second is the dangerous one:

1. **Not verified.** The question was answerable: `EndGameplay` vs `AbortGameplay` means "keep
   this capture or discard it". The player completed the level and chose to continue, so it is
   kept. No human needed. The subagent even supplied the right default.
2. **Amplified while being translated.** Trying to make an API-level detail read as a product
   decision, the orchestrator invented a rationale it had not checked. Translating for the
   integrator is mandated — but a translation that adds an unverified claim is worse than the
   jargon it replaced, because the integrator now has to catch it.

## The gate to apply before relaying any subagent question

1. **Can I answer it?** Check the state file, glossary, prior decisions, the installed SDK
   source, the live docs. The orchestrator has context the subagent did not.
2. **Is the subagent's own recommended default obviously correct?** If it is, take it, record
   the decision with its rationale, and tell the integrator what you decided — don't ask.
3. **Does the question survive its own vocabulary?** If it contains a word the integrator owns
   (see [[moment-is-the-integrators-word-do-not-redefine-it]]), re-derive what is actually being
   asked before it goes anywhere near a human.
4. **Am I adding a rationale I have not verified?** Every clause added during translation is a
   new assertion, and [[investigate-before-asking]] §2 applies to it in full.

Only what survives all four is a real question. In the observed case, nothing did.

## Why this matters more in an orchestrated phase

Batching questions is already the rule. But subagent-surfaced questions arrive *pre-formed and
plausible*, carrying the authority of work the orchestrator did not watch. That is exactly the
condition under which an unverified claim gets passed to the client with a straight face. The
orchestrator's value is not routing — it is being the last reader who holds the whole picture.
