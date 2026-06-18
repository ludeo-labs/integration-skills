---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# Systematically scan ALL replicated properties before finalizing entity property lists

## Problem

During Phase 3 property discovery, the agent cherry-picked "obvious" properties (Transform, Health, DefeatState, Stance, bIsAlive) and missed `bIsSpecialModeActive` — a replicated property on `APlayerStateBase` that fundamentally changes the game mode (one mode toggles to another). The human had to point it out.

The Phase 3 reference file already contains the heuristic: *"Check existing replication patterns — anything the game already replicates is likely important for playback too."* But the agent treated this as optional guidance rather than a hard requirement.

## Root Cause

The agent used **selective property discovery** (looking for properties that "seemed important") instead of **exhaustive property discovery** (scanning all replicated properties and filtering down). Selective discovery has a bias toward properties the agent already knows about (Transform, Health) and misses game-specific properties that are equally critical.

## Fix

**Make the DOREPLIFETIME scan a hard checklist item in Phase 3 analysis:**

For each tracked entity class, run:
```
grep -n "DOREPLIFETIME" <entity_class>.cpp
```

Present the **full list** of replicated properties to the human before finalizing the property set. Do not silently filter — let the human decide what's important.

**Add a "game-mode-altering states" question to Phase 3 Section 4:**
> "Are there any player-triggered states that dramatically change gameplay? (e.g., ability on/off, stealth/alerted toggle, vehicle entry, form change)"

This surfaces properties that aren't just visual — they change AI behavior, available actions, and game flow.

## How to Apply

During Phase 3 Step 3.3 (Identify Properties to Track Per Entity):
1. Grep `GetLifetimeReplicatedProps` for each tracked entity class
2. List ALL replicated properties (not just the ones that look important)
3. Present the full list to the human with your recommended subset
4. Explicitly ask: "Are there any game-mode-changing states I should track?"
