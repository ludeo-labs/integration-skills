---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: "Are there any prominent visual elements (vehicles, props, environmental actors) that will be obviously missing during Player Flow playback?"
sanitized: true
---

# Track ALL visually prominent entities in the curated slice — not just "gameplay" entities

## Problem

The agent deferred vehicle tracking to Stage 6 because vehicles weren't "gameplay entities" — they don't have health, can't be killed, and aren't part of the mission objective. But the level's curated slice has parked cars and enemy vehicles on the street that are immediately visible. When Player Flow played back without them, the street looked empty and obviously wrong.

The curated slice exists to produce a **working demo in ~48 hours**. Anything visually prominent that's missing breaks the demo, regardless of whether it's a "gameplay" entity.

## Fix

During Phase 3 entity discovery, ask:

> "If I took a screenshot during gameplay and a screenshot during Player Flow playback, what would be obviously different besides the tracked entities?"

Common categories that get missed:
- **Vehicles** (traffic, security, scripted) — `AWheeledVehicleActor`, `AAerialVehicleActor`
- **Destructible props** (smashed containers, broken windows)
- **Environmental state** (lights on/off, alarm indicators)
- **Placed equipment** (deployables, trip mines, C4)

For the curated slice, if an entity type is visually prominent on the map, track it with at minimum Transform + ClassPath — even if it has no gameplay state.

## How to Apply

During Phase 3 Step 3.1 (entity discovery), after listing gameplay entities, do a visual-completeness pass:
1. What's on the street? (vehicles)
2. What's on the walls/floors? (destructible props, placed items)
3. What environmental state is visible? (doors open/closed already tracked, but lights, alarms?)
4. Ask the human: "Anything else that would look wrong if missing?"
