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

### First, separate product vocabulary from our shorthand

**`Ludeo` and `Studio Lab` are product words — teach them, don't dodge them.** The
integrator is shipping a Ludeo integration; the word appears in the docs, the
dashboard, their backlog, and eventually in front of their players. **Define it once
on first use** — *"a Ludeo — a short playable clip someone can drop straight into"* —
then use it like any other term. Writing around the product name to sound friendly
just leaves them unable to read anything official.

SDK API names (`LudeoRoom`, `WriteData`, `SendAction`) are likewise legitimate when
the subject is code they will read or write. What they must not do is *replace* the
explanation: "`OpenRoom` starts capturing the run, `CloseRoom` ends it" — not a bare
`OpenRoom`. (Note what that gloss does **not** say: "recording". See the trap below.)

Everything below is the third category: **ours, not theirs.**

| Don't write | Write |
|---|---|
| "CR-006 two-pass restore" | "rebuild the level first, then put the objects back into it" |
| "Wave 1" | "the first slice we get working end-to-end" |
| "capture as attributes" | "record each enemy's position and health" |
| "non-ludeoable segment" | "a stretch we don't want recorded, like the shop" |
| "the readiness gate" | "waiting until the SDK is ready before the game starts" |
| "phase 5 will handle it" | "the step where we make a saved moment replay" |
| "SHIP-2 is still open" | "the SDK package still lives outside the repo, so a fresh clone won't build" |

## The trap: a paraphrase that dissolves the distinction

Simplifying is lossy, and the loss is invisible from inside the sentence you just
wrote. **The terms most worth simplifying are often the ones that exist precisely
because two things are easy to confuse** — so a careless plain rendering re-creates
the confusion the vocabulary was built to prevent.

**This happened while following this very learning.** An agent rendered `Room` as
"recording" in a progress summary. Two distinctions died at once:

- **"recording" implies video.** The SDK captures game *state* — positions, health,
  inventory, the generation seed — which is what makes a Ludeo *playable* rather than
  watchable. Exactly backwards.
- **It collapsed `Room` into `Ludeo`.** A Room brackets one captured gameplay segment;
  the platform *derives* Ludeos from that segment, and the game does not decide how many
  a segment yields. The skill's own notes warn that conflating the two mis-scopes phase
  3 — and the agent had read that warning **twice** in the same session, including once
  in the target repo's own state file.

The skill was not unclear. The paraphrase step is where it was lost.

**Guard:** before you replace a term, name the distinction it carries, then check your
replacement still carries it. If the term exists because of a documented confusion,
your plain version must keep the two things apart — or keep the term and define it.
**A simplification that makes a warned-against confusion easier is not a
simplification.**

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
