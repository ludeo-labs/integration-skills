---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 4,5
question: "About to enumerate an entity's field surface from the components on its GameObject? Check what those components INHERIT. The skill tells you to sweep sideways (other components, managers, ScriptableObjects) but not upward, and a shared character base class is where health, status effects and i-frames usually live."
sanitized: true
---

# Sweep the base class, not just the sibling components

The completeness rule for an entity's field surface is well known: the entity is not the one class the
census names, it is the whole subsystem — every component on the GameObject plus the managers and
ScriptableObjects holding its state. That rule is stated **sideways**. It says nothing about **upward**,
and inheritance is where the most load-bearing state tends to sit.

On one integration the player's anchor was a ~6,400-line status class, so the sweep looked
comprehensive by any reasonable eyeball test: dozens of files, hundreds of fields, several manager
singletons folded in. Then the class declaration turned out to read:

```csharp
// neutral illustration of the shape
public class PlayerStatus : CharacterStatus { ... }
public class EnemyStatus  : CharacterStatus { ... }
```

The **base** class held:

- current / max health and the secondary resource
- current cooldown and cooldown max
- ~25 runtime state booleans — stunned, dead, dodging, deflecting, post-hit-invulnerable, mid-parry,
  frozen, enraged
- the invulnerability-frame counter
- the run's temp-upgrade multipliers

In other words: **the entity had no health in its field surface**, and the tally still passed. That is
the exact failure the completeness rule exists to prevent, reached through a door the rule does not
mention.

## Why it is easy to miss and hard to notice

- A very large anchor class is *reassuring*. Nobody suspects an under-scoped sweep when the file is
  thousands of lines long.
- The tally makes it worse, not better. `N = C + D + X` is auditable only in its numerator; a wrong
  **denominator** produces a confident, complete-looking, wrong answer.
- It is a **shared** base, so the same omission silently hits every character type at once — player and
  enemies both — rather than showing up as one odd entity.
- Nothing fails at compile or capture time. It surfaces as a replay where characters come back at
  default health with every status effect cleared, which reads as a restore bug rather than a plan gap.

## The rule

When fixing what the entity *is*, walk **two axes**:

| Axis | What to enumerate |
|---|---|
| **sideways** | other components on the GameObject and its children; the managers / singletons / data assets holding this entity's state |
| **upward** | the anchor class's **base chain**, to the engine's own base type — and each base's own fields |

Mechanically: read the class declaration line for `: SomeBase` before you enumerate anything, and repeat
until the base is the engine's component type. Cheap, and it is the only step that would have caught this.

Two things that make the omission visible if you missed it:

- **Sanity-check the surface against the genre, not the count.** A combat entity whose swept fields
  contain no health, no death flag and no invulnerability window is under-scoped no matter how many
  fields it has. Ask "is the obvious thing in here?" rather than "is N big enough?"
- **Watch for shared bases across entity types.** If two entities in the census name different anchor
  classes but behave alike (both take damage, both die), they very likely share a base — and it will be
  in neither of their anchor rows.

## A tooling note

A field extractor that filters to class-level declarations by brace depth is worth writing once — it
keeps local variables out of the count and makes the denominator reproducible. Point it at a file list,
and make **the file list** the reviewed artifact: the bug is almost never in the parsing, it is in which
files you handed it.

Related: [[investigate-before-asking]] — read the declaration before enumerating from it.
