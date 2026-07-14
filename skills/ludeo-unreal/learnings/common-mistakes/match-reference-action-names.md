---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 8
question: "What exact action names does Studio Labs expect? Have you named actions from the player's perspective (DoubleKill, not ElimChain)? Are actions and context separated (Kill + DamageType, not Kill_Rifle)?"
sanitized: true
---

# Name actions from the player's perspective, not the code's perspective

## The Mistake

The agent invented action naming conventions from C++ code structure:
- `ElimChain` (class name) instead of `DoubleKill` (what players say)
- `Kill_Rifle` (merged action + context) instead of `Kill` + `GameplayEffect.DamageType.Weapon.Rifle` (separate signals)
- `ElimStreak` instead of `KillStreak5`, `KillStreak10`

It also missed ALL GAS ability actions (Dash, Grenade, Melee, Reload, WeaponFire, ADS) despite the 6A tag audit finding every `Ability.Type.Action.*` tag — because:
1. It searched for delegate broadcasts (wrong mechanism for GAS abilities)
2. It didn't convert tag audit findings into action candidates
3. The 6A plan became a ceiling instead of a floor

## Rules

1. **Name from the player's perspective.** "Double kill" not "elim chain."
2. **Actions and context are SEPARATE.** `Kill` is always `Kill`. Damage type is a separate action with the full tag path. Do NOT merge into `Kill_Rifle`.
3. **Every `Ability.Type.Action.*` tag from the tag audit is a candidate action.** Hook via `AbilityActivatedCallbacks` on the player's ASC — not delegates or message subsystem.
4. **Accolades → human-readable names.** `UElimChainProcessor` → `DoubleKill`, `TripleKill`. `UElimStreakProcessor` → `KillStreak5`, `KillStreak10`.
5. **Present exact action name strings for human approval** before implementing. One question catches all naming issues.
6. **Query `ludeo-context` MCP** for QA event naming conventions if available.

## What was missed and why

| Tag from 6A audit | Action name | Why missed |
|-------------------|-------------|-----------|
| Ability.Type.Action.Dash | Dash | Searched for delegates, not AbilityActivatedCallbacks |
| Ability.Type.Action.Grenade | Grenade | Same |
| Ability.Type.Action.Melee | Melee | Same |
| Ability.Type.Action.Reload | Reload | Same |
| Ability.Type.Action.WeaponFire | WeaponFire | Same |
| Ability.Type.Action.ADS | ADS | Same |
| GameplayEffect.DamageType.* | (context, not action) | Merged into Kill instead of sent separately |

The tag audit found all of these. The bridge from "tags found" to "actions to implement" was missing in the reference file. Now added as Section 3.3 CRITICAL note + Section 3.6 Step 4a GAS row + Section 5.3.1 code pattern.
