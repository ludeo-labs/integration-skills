---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 8
question: "Does the game have multiple distinct game modes/experiences? Has the agent mapped ALL modes before diving into entity discovery?"
sanitized: true
---

# Phase 6A Discovery Gaps Found During Lyra Simulation

Seven issues discovered when running Phase 6A on Lyra:

## 1. No Game Mode Discovery Step
The analysis checklist jumps straight to entity types. Agent should map ALL experiences/game modes first, then discover entities per mode. Without this, modes like Control Points and TopDownArena get missed entirely.

## 2. Premature Presentation of Partial Results
Agent showed entity tables before finishing actions, scoring, and abilities. The human had to prompt for missing items. Skill must enforce: complete ALL checklist items before presenting anything.

## 3. Missing Action Enrichment Concept
Skill talks about discovering NEW actions but doesn't mention enriching EXISTING ones. Kill already works — but adding weapon/method context from InstigatorTags/ContextTags makes it much more valuable.

## 4. Blueprint-Heavy Games Under-Discovered
C++-focused grep patterns miss BP-driven features. Key discovery: gameplay tag config files (e.g., ShooterCoreTags.ini) are a goldmine — they reveal scoring, accolades, dash, ADS, weapon ammo, all in one place.

## 5. No Match State / Timer Guidance
Match time, round state, score limits — universal concepts not called out in property discovery. Has "Score/Points" greps but nothing about timers or win conditions.

## 6. Mode-Conditional Architecture Not Addressed
Skill assumes one set of entities/actions for the whole game. Games with fundamentally different modes (shooter vs. bomberman) need mode-aware registration. This is an architectural decision for 6A.

## 7. Curated Slice Bias Persists
Even though the reference says "full game," the mental model from Stages 1-4 anchors to the curated slice. Needs explicit break: "Forget the curated slice."
