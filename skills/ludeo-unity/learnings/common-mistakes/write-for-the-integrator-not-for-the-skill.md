---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
---

# Write for the integrator, not for the skill — they never agreed to learn our vocabulary

Every phase brief, requirement doc and artifact schema in this skill is written in a
private dialect: numbered requirement IDs, "Room", "Wave 1", "two-pass", "attribute
capture", "non-ludeoable", "readiness gate", "Creator/Player flow", plus per-engagement
issue tags. It is efficient **between agent phases**. It is meaningless to the person
paying for the integration.

Reporting progress in that dialect reads as evasive even when the work underneath is
good — and the integrator cannot check your reasoning, which is the entire point of
reporting.

## What this looked like

A phase-2 summary cited a bare requirement ID as justification for a restore strategy.
The integrator's response, twice:

> *"what the fuck is CR-006? what are they supposed to mean to me?"*

The second push-back came **after** a partial fix that expanded only that one ID —
because the rest of the message was still dense with `Room`, `Wave 1`, issue tags and
phase numbers used as nouns. **Expanding the specific term you were challenged on is
not the fix.** The whole register was wrong.

## The rule

**Say the thing. Never make the reader resolve a token.**

An internal ID may appear in a JSON artifact for traceability, but it must always
carry its meaning inline, and it should almost never appear in chat.

| Don't write | Write |
|---|---|
| "a Ludeo" | "a short playable clip someone can drop into" |
| "OpenRoom / CloseRoom" | "start recording when the run begins, stop when it ends" |
| "CR-006 two-pass restore" | "rebuild the level first, then put the objects back into it" |
| "Wave 1" | "the first slice we get working end-to-end" |
| "capture as attributes" | "record each enemy's position and health" |
| "non-ludeoable segment" | "a stretch we don't want recorded, like the shop" |
| "the readiness gate" | "waiting until the SDK is ready before the game starts" |
| "phase 5 will handle it" | "the step where we make a saved moment replay" |

## Test before sending

> Would a competent Unity developer who has **never heard of this SDK** understand
> every sentence, and be able to disagree with the reasoning?

If a sentence only parses for someone who has read the reference docs, rewrite it.
Jargon that survives is jargon you defined in the same breath.

## Why it is worth the extra words

The integrator is the one who knows their codebase. Their disagreement is the main
error-correction available during an engagement — a wrong assumption caught by them in
one sentence would otherwise cost whole phases. Vocabulary they can't parse silences
exactly the review you most need. Plain language is not a courtesy; it keeps the
technical feedback loop open.

Related: [[investigate-before-asking]] — the same instinct pointed at a different
output. Do the work, then report it in language the reader already has.
