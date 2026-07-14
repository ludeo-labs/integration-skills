---
category: architecture
tier: generalizable
sourceGame: CoopShooter
phase: 5
question: "Are your manually-written attributes not showing up in the captured/exported ludeo data? Put them on a dedicated writable object instead of riding an existing entity object."
sanitized: true
---

# Track auxiliary telemetry on its own dedicated writable object, not as ad-hoc attributes on an existing entity object

## Precondition
You added custom per-tick attributes by writing them onto an existing tracked
entity object (e.g. the player character object), and they do **not** appear in
the captured / exported ludeo data — even though that object's other attributes
(Transform, etc.) do.

## What happened
Input telemetry was first written as extra `WriteData` attributes on the player
character writable object, inside the per-character state writer. The captured
`ludeo.json` showed `Transform` / `Health` / `ClassPath` on the character objects
and the singleton GameMetadata object's attributes — but **none** of the
manually-added per-character attributes (the new input attrs, and even existing
ones like an equip-index / mask-on flag). Moving the data to a **dedicated
writable object** (its own `ObjectType`, created once like the GameMetadata
object and written each tick) made it appear immediately.

## The rule
Auxiliary telemetry / tracking streams that are not part of an entity's
restore-state should live on their **own dedicated writable object**, created
once (mirror the existing singleton metadata object: `CreateObject` with a stable
key, store the handle, `WriteData` each tick, `DestroyObject` on teardown). Do not
bolt ad-hoc attributes onto an existing gameplay entity object and assume they
surface — give the data its own object with its own `ObjectType`.

Two practical reasons this is better regardless:
- **It surfaced** in the exported data when the per-entity attrs did not.
- **Key it on a distinct UObject.** One writable per UObject key — key the new
  object on the component (or another stable, distinct object), not on a UObject
  already used for another writable, or the objects collide.

## Also watch
A dedicated object also lets you drop entity-specific write gates. The first
attempt additionally gated the per-character write on `IsLocallyControlled()`,
which was false for the tracked pawn and silently skipped the write — a second,
independent reason nothing landed. A dedicated singleton object needs no such
gate.
