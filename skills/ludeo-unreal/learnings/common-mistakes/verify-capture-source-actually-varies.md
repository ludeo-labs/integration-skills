---
category: common-mistakes
tier: universal
sourceGame: TacticsGame
phase: 5
question: null
sanitized: true
---

# Verify every captured attribute actually VARIES with the gameplay it represents — move the thing, capture twice, diff

## The trap

A capture source can be syntactically perfect and semantically dead. TacticsGame
captured `Unit->GetActorTransform()` as the unit position. It compiled, wrote
plausible coordinates every tick, read back identically, and passed every
restore-vs-data check — **and it was a constant.** In that toolkit the unit logic
actor never physically moves: movement updates the unit's `GridIndex` and moves the
separate puppet actor; the logic actor sits at its spawn spot forever (it even has a
`FarOffGridLocation` property — the design never intended it to be near the action).
Every capture therefore recorded the battle-START formation regardless of play.

Four replay-debugging rounds (puppet linkage, transform layering, cadence) happened
on top of this dead source before a PerTick capture exposed it: the same unit showed
`GridIndex` moved but `Transform` byte-identical to the start tile across captures.

## Why no instrument caught it

Restore validation compares the world against the captured data — and faithfully
confirms a perfect restore *of the wrong constant*. Self-consistent garbage. Only a
**data-vs-gameplay** comparison can catch a dead source.

## The rule

For every attribute in the capture schema, before trusting it: **change the gameplay
state it represents, capture again, and confirm the attribute changed.**
Operationally, right after the Creator write path first works:

1. Play: move an entity, spend a resource, take damage — one gameplay change per
   schema attribute family.
2. Capture two snapshots (or grab the Ludeo JSON twice) bracketing the change.
3. Diff. Any attribute that did NOT change when its gameplay did is a dead source —
   find the real one (often a parallel actor/layer: visual puppet vs logic actor,
   animate-layer copy vs logic copy, modified-instance vs original asset).

This is the capture-side sibling of the dump-and-diff workflow
([[dump-and-diff-workflow-for-state-discovery]]): there it discovers which fields
drive behavior; here it proves your chosen fields actually carry the behavior.

## Second corollary: audit the LEAF class, not the base you happened to inspect

The same integration later found the schema missing ALL of the game's subclass combat
state (armor, weapon-loaded flags, ammo type, per-battle objective item) — because the entity
schema had been built from the marketplace toolkit's BASE class dump (`BP_Unit`),
while the game's units are actually a SUBCLASS (`BP_Unit_Sub`, +44 variables).
The miss surfaced only when a cloud replay showed a full armor bar on a nearly-dead
unit. Rule: for every tracked entity, dump the **actual runtime leaf class** (and its
full BP parent chain), then split its variables into placement-constants (skip) vs
battle-dynamic (capture). A base-class dump is never the schema source.

## Toolkit-specific corollary

In logic/visual split architectures (toolkit "puppet" patterns, server-logic +
client-presentation), default assumption: **the logic actor's transform is suspect.**
Position truth is usually the grid/board index; pose truth is the visual actor.
Capture the index for logic restore and the VISUAL actor's transform for pose —
and never write the logic actor's transform on restore if live play never does.
