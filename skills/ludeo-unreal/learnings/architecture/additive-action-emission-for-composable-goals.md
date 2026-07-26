---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 6
question: null
sanitized: true
---

# Emit actions on multiple orthogonal axes — additive, not else-if

## The principle

Studio Labs goals (and any cloud-side action consumer) work best when actions are emitted along independent axes that the goal author can combine arbitrarily. Each gameplay event is a tuple of facts — *who*, *what*, *how*, *whom* — and each fact deserves its own action emission, not a single most-specific bucket.

Concretely: a single reference-game bullet headshot on a heavy enemy is **all of**:
- `KillEnemy` — broad bucket for "killed any enemy"
- `KillHeavy` — specific bucket for "killed a special-class enemy"
- `Headshot` — orthogonal kill-method axis

A goal designer composing "kill 5 enemies" should pick `KillEnemy`. "Kill any heavy enemy" picks `KillHeavy`. "Get 3 headshots" picks `Headshot`. The same gameplay frame fires all three; the cloud computes the goals separately. None of these is "most-specific" — they live on different axes.

## The anti-pattern

A single `else-if` chain that emits exactly one action:

```cpp
// WRONG — narrow signal, no composition
if (PawnType.MatchesTag(Tags.PawnType_Special_Heavy))      action = "KillHeavy";
else if (PawnType.MatchesTag(Tags.PawnType_Common_Civilian_Employee)) action = "KillEmployee";
else if (PawnType.MatchesTag(Tags.PawnType_Common_Civilian))         action = "KillCivilian";
else                                                                  action = "KillEnemy";
SendLudeoAction(action);
```

Problems:
- `KillEmployee` doesn't fire `KillCivilian`, so a "kill 3 civilians" goal misses Employee/Insider kills.
- `KillHeavy` doesn't fire `KillEnemy`, so a goal author can't write "kill 10 enemies" without also enumerating every special class.
- `Headshot` and victim category are on different axes but the chain forces them to the same emission slot.

## The pattern

Emit on each axis independently. Specific tags fire **alongside** the broad bucket they belong to:

```cpp
// Civilian dimension — sub-types fire BOTH the specific tag AND KillCivilian
bool bCivilianBucket = false;
if (PawnType.MatchesTag(Tags.PawnType_Common_Civilian_Employee))      { SendLudeoAction("KillEmployee"); bCivilianBucket = true; }
else if (PawnType.MatchesTag(Tags.PawnType_Common_Civilian_Insider))  { SendLudeoAction("KillInsider");  bCivilianBucket = true; }
else if (PawnType.MatchesTag(Tags.PawnType_Common_Civilian))          { bCivilianBucket = true; }
if (bCivilianBucket) SendLudeoAction("KillCivilian");
else
{
    // Special-class kills are additive on KillEnemy
    if (PawnType.MatchesTag(Tags.PawnType_Special_Heavy))     SendLudeoAction("KillHeavy");
    else if (PawnType.MatchesTag(Tags.PawnType_Special_Ambusher))   SendLudeoAction("KillAmbusher");
    // ... other specials ...
    if (!bSurrendered) SendLudeoAction("KillEnemy");
}

// Kill-method dimension — orthogonal to victim
if (bIsBullet && bIsCritical) SendLudeoAction("Headshot");
if (bIsMelee)          SendLudeoAction("Melee");
else if (bIsExplosive) SendLudeoAction("ExplosiveKill");
```

## State-based exclusions still apply

Composability does not mean "fire everything always". Some emissions are **excluded by state**, not by being on a separate axis:

- `KillEnemy` is suppressed when the victim has the surrender tag (`Character_Action_Surrendered` in ActionGame) — a surrendered hostile is not an enemy at the moment of execution.
- `KillCivilian` is not fired for hostile-type victims even when they're doing civilian-like things — it's a type bucket, not a behavior bucket.

## Cost

One extra `SendLudeoAction` call per axis per kill is cheap. The SDK action queue is light. Cloud-side dedup (when an axis fires multiple times for the same event by accident) is the integrator's responsibility, but with the additive pattern accidental dup happens at the source-code site (visible) rather than at axis collision (silent).

## When NOT to apply

- If two actions are **definitionally** the same event with two names, pick one. (E.g., don't emit both `Death` and `PlayerDied` for a single death.)
- If an axis is `(true, false)` only — like a single boolean — and the negative case has no goal value, don't emit the negative action. ("Player wasn't crouched" is not an action.)

## Detection

When designing the action set for a stage, list each meaningful gameplay event and write its tuple of facts. If your code only emits one action per event, you've collapsed the tuple. Review whether each fact deserves its own axis.

## Cross-reference

- `common-mistakes/elimination-debouncing-with-message-subsystem.md` — additive emission can amplify duplication bugs from message-subsystem rebroadcasts; verify dedup is per-axis, not per-event.
