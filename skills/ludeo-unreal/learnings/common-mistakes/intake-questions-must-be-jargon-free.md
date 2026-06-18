---
category: common-mistakes
tier: universal
sourceGame: TacticsGame
phase: 0
question: null
sanitized: true
---

# Intake questions must be jargon-free — explain Ludeo-side concepts inline

## The Mistake

Asked the Stage 0 packaging-target question close to the skill's internal phrasing:
"Will this project need to be packaged for cloud builds, distribution, or QA testing —
or is editor-only enough?" with options `editor-only` / `packaged` / `cloud-build` and a
description mentioning "Tier 2 smoke test (full package + boot)".

The integrator (a game developer, NOT a Ludeo employee) answered the question but pushed
back hard: *"where did the packed + boot smoke test come from? what do you mean by that?
what is cloud build target? imagine I am not from Ludeo, this question SUCKS."*

## Why It Matters

Stage 0 intake is often the integrator's first contact with the skill. Questions written
in the skill's internal vocabulary (Tier 1/Tier 2, cloud-build, smoke test, BuildCookRun)
read as gibberish to someone who knows UE but not Ludeo's pipeline. Each jargon term
either blocks the answer or — worse — gets answered wrong silently.

## Prevention

For every intake question, before asking:

1. **Name the audience assumption:** the reader knows their game and engine, and nothing
   about Ludeo's pipeline, stages, or tiers.
2. **Explain any Ludeo-side concept inline, in one sentence, in game-dev terms.**
   E.g. "cloud build" → "Ludeo's playback runs your game on Ludeo's cloud machines, so a
   packaged Win64 build eventually gets uploaded; this option just means we set up that
   packaging now."
3. **Never reference skill internals** (tier numbers, stage gates, reference files) in
   the question text — those are for the agent, not the human.
4. If the human pushes back on a question, answer the meta-question FIRST, plainly, then
   re-confirm their choice — and capture the phrasing fix as a learning/skill issue.

## Breadcrumb for the skill implementor

SKILL.md Stage 0 step 1's packaging question and phase-00-intake.md phrasing should ship
with the plain-language explanations built in, not rely on the agent to translate.
