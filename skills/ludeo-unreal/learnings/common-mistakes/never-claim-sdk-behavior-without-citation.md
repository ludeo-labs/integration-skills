---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 2
question: null
sanitized: true
---

# Never claim SDK behavior without citing a reference file or MCP doc query

## The Mistake

When asked about Player Flow AI restoration during Stage 1, the agent invented a "puppet mode" mechanism — disabling AI controllers and overriding transforms each frame — without reading any SDK documentation. It presented this fabrication with confidence because it sounded plausible from a general game development perspective. The fabricated mechanism does not exist in the Ludeo SDK.

## The Rule

**Before making ANY claim about how the Ludeo SDK works, the agent MUST cite one of:**

1. A specific section in a `references/phase-*.md` file (e.g., "Phase 03 Section 5.4")
2. A file in `references/sdk-reference/` (read via the Read tool)
3. A response from the `sdk-docs` MCP server (if available)
4. A learning file in `learnings/` that documents verified SDK behavior

**If none of these sources confirm the claimed behavior, the agent MUST say "I don't know how this works in the Ludeo SDK — let me check the documentation" and then read the relevant reference file before answering.**

## What This Covers

- How Player Flow restoration works
- How WritableObject/ReadableObject API works
- How rooms, sessions, highlights, and players interact
- What callbacks/delegates the SDK provides
- What parameters SDK methods accept
- What the SDK does vs. what the integration code must do

## What This Does NOT Cover

- General UE4/UE5 engine behavior (OK to use general knowledge)
- Game-specific architecture (OK to infer from code analysis)
- Integration design patterns (OK if they only use documented SDK APIs)

## How to Apply

When the agent is about to describe SDK behavior:

1. **Stop.** Is this claim based on something I read, or something I'm inferring?
2. **If inferring:** Read the relevant reference file first. Phase 03 for state/Player Flow, Phase 02 for lifecycle, Phase 04 for actions, etc.
3. **If the reference doesn't cover it:** Use `sdk-docs` MCP or ask the human. Do NOT fill the gap with invention.
4. **When writing the answer:** Include the citation inline — e.g., "Per Phase 03 Section 5.4, Player Flow restores a scene snapshot..."

## Why This Matters

Fabricated SDK behavior wastes integration time, erodes trust, and can lead to architectural decisions built on false premises. A wrong design discovered in Stage 3 (implementation) costs far more than saying "I don't know" in Stage 1 (analysis). The human is the domain expert on the Ludeo SDK — defer to them when uncertain.
