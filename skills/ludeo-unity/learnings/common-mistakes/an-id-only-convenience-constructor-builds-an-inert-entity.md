---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 4
question: "Did you find a public add/apply path that takes a lightweight data object built from an id (a guid, a name, a type enum) rather than the authored asset, and conclude the restore can therefore skip resolving the asset? Read that constructor's BODY before you plan around it."
sanitized: true
---

# An id-only convenience constructor builds an inert entity

Restoring buffs/debuffs (or any authored, data-driven entity) usually looks blocked on the same
thing: the capture stored an asset **id**, and nothing in the game maps an id back to the asset. The
tempting escape is a public add path that does not need the asset at all — here, an
`AddEffect(EffectData, ...)` overload plus an `EffectData(string guid, float duration, bool infinite)`
constructor. Capture already stored exactly those three values, so it reads like a free win.

**Read the constructor body.** The id-only overload existed to build a *throwaway* instance for an
internal system, and it assigned only the three parameters. Every field that makes the entity
mechanically real — the attribute/modifier list, keywords, stacking rules, presentation — was left at
its default, and in this codebase the modifier list was populated *only* in the sibling constructor
that takes the authored asset. An entity added through the id-only path therefore shows an icon,
ticks its duration down and expires on schedule while **changing no stats at all**.

That failure is worse than the blocker it was meant to route around, because it is invisible: the
replay looks right, the self-checks pass (the entity IS in the list, with the right id and time
remaining), and only the numbers are wrong.

**And it may not even stay quiet.** In this codebase the entity's own "is this permanent" test
dereferenced the authored asset, so a hollow instance threw on the first frame after the replay
resumed. An id-only instance is not merely a weaker version of the real one — it is a shape the
rest of the system was never written to receive, so expect null dereferences in whatever reads
fields the lightweight constructor never set.

## What to do instead

Decide between the two routes that actually carry the payload:

1. **Resolve the authored asset**, then use the full constructor. Even with no global id→asset
   registry, there is often a path through something the restore already rebuilds: capture the
   entity's **source** (the skill/item/ability that applied it), and walk that source's public
   asset-typed fields matching on id. Check first how much of the population that covers — sources
   outside the modelled set (items, curses, global constants) will not be reachable this way.
2. **Widen capture** to serialize the modifier list itself, then populate it after construction.
   Covers every source, but adds real capture surface and rebuilds a shape the game never builds.

## The general rule

A constructor overload is not an API contract — it is whatever its body assigns. When a
lightweight/convenience overload lets you skip a resolution step the "proper" path performs, assume
it exists to serve some *other* caller with different needs, and diff the two bodies field by field
before treating them as interchangeable. Related: [[write-restored-state-to-whoever-owns-it]] and
[[make-the-restore-verify-every-value-it-writes]] — a value-level read-back would NOT have caught
this one, because the values it writes are the values it reads back.
