---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: 5
question: "Which actions beyond Kill + Death does the curated slice support? Check for: weapon pickup, ability activation, accolades/streaks."
sanitized: true
---

# Standard FPS/TPS action set is 5-6 actions, not 2-3

The skill says Kill + Death are "non-negotiable minimum" but stopping there produces a bare integration. The reference Lyra integration tracks 6 actions:

| Action | Source | Why |
|--------|--------|-----|
| Kill | Elimination message (Instigator) | Core metric |
| Death | Elimination message (Target) | Core metric |
| Assist | Assist message (Instigator) | Team play metric |
| WeaponPickup | Inventory changed message | Shows player adapting loadout |
| AbilityActivation | Ability activated event (e.g., Dash) | Shows skill usage |
| Accolade | Accolade message (multi-kills, streaks) | Highlight-worthy moments |

**The AI should ask the integrator to confirm the full action set**, not just validate Kill + Death and stop. Present the standard 5-6 actions as the recommended set with the option to trim.
