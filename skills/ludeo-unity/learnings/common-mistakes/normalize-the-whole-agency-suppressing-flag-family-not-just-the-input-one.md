---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Does the game suppress player agency during scripted sequences with MORE THAN ONE flag (an input-disable, a game-state enum, a movement-only/no-combat mode) — and does the restore normalize ALL of them, or only the obvious input one?"
sanitized: true
---

# Normalize the whole family of agency-suppressing flags — a restore that misses one ships an unwinnable Ludeo that looks perfect

Every restore plan learns to force the input-disable flag off, because a captured
`InputsDisabled = true` produces a replay the viewer cannot move at all — indistinguishable from a hung
restore, and impossible to miss at a gate.

**The trap is that games suppress agency with a FAMILY of flags, not one.** A scripted sequence
(intro, tutorial, guided walk, scene transition) typically sets several at once from one helper:

```csharp
// the game's scripted-sequence helper — all three, together
SetState(State.Cinematics);          // game-state enum
player.DisableInputs();              // total input lock
player.EnableMovementOnly();         // walk, but no combat  ← the one that gets missed
```

Miss the movement-only member and you get the **worst-presenting failure mode in the whole
integration**: the replay looks completely healthy. Correct scene, correct position, `timeScale = 1`,
control granted, zero errors, the viewer walks around normally — and **cannot attack, block, dodge, dash
or shoot**, because that one flag gates offence while leaving locomotion alone. In the observed case an
enemy killed the viewer while they had no way to answer, and the only symptom was a human saying "I
couldn't attack." Nothing in the log looked wrong; the bucket arithmetic was perfect.

With a kill-based action set, such a Ludeo is also **unscoreable** — the primary action can never fire.

## The check

Find the game's scripted-sequence helper and read **every** flag it sets, then confirm the restore
normalizes each one. Grep the offence entry points for their guard conditions and work backwards:

```
AttackBecomesPressed        # then read the FULL condition on each hit
```

In the observed project the melee guard was `input.AttackPressed && skills.HasMeleeSkill &&
!player.IsMovementOnlyEnabled()` — three terms, two of them captured attributes. A restore plan that
only reasoned about the input flag had no reason to look at the other two.

**Normalize the whole family, on the same doctrine:** a stretch where the player cannot fight is a
non-ludeoable window by definition, so it is never a playable moment — force the flag off whatever was
captured, and log a warning so the normalization is visible in the report.

## Log the ABILITY gates too, or you cannot diagnose it

"The viewer cannot attack" has two causes that are **visually identical** and only one is a bug:

1. the restore dropped or wrongly applied a suppression flag — **our defect**;
2. the capture was taken **before the creator had earned the ability** (early-game moment, ability-gated
   combat) — a faithful restore with nothing to fix.

Log the ability booleans on every restore (`Knife=… Bow=… ClimbAttack=…`), with an explicit marker when
the one that gates basic attack is false. Without that line the two causes are indistinguishable and the
investigation restarts from zero every time. This is the same instrumentation-first move that settles
"wrong scene" disputes — see
[[dramatized-kills-open-a-non-ludeoable-span-before-the-action-fires]] for the other case where only a
runtime log could separate a real defect from correct-but-surprising behaviour.

## Where it surfaces

Often **not** at the restore gate, where the tester's own save happens to have every ability and the
capture was mid-combat. It surfaced here at the *actions* gate, when a replay of an early-game capture
was used to prove actions fire in the player flow. Expect it from any capture taken inside a scripted
sequence — which is exactly where an inexperienced creator marks their first moment.
