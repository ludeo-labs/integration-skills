---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 4
question: "Is a census type on your list because the genre checklist demands it and a matching class/counter exists in the codebase — rather than because you proved the mechanic is live in the SHIPPING prefabs and scenes?"
sanitized: true
---

# The genre checklist tells you what to look for, not what exists — prove a type is live before flagging it

`game-patterns/<genre>.md §3` is a **validation** checklist, and the phase-4 instruction to *"when in doubt,
track"* makes over-tracking cheap and under-tracking expensive. Both are right. But there is a third
outcome that is neither: a type that the checklist demands, that has a real class and real fields in the
repo, and that **is not live in the game that ships**. Tracking it is not cheap over-tracking — it is a
Wave-1 row, a stable-key prerequisite, and a Part-B field sweep spent on something that can never change at
runtime, plus a load-bearing flag that quietly misrepresents what the moment needs.

Three distinct tells surfaced in one census, each defeating a different kind of evidence:

## 1. The class exists but is hosted nowhere

A leveling/XP system with a full public API and change events, and a dialogue-interaction controller with
live call sites in other scripts — **both hosted in zero prefabs and zero scenes**. Grepping the *scripts*
finds them; grepping the *content* does not.

```
for each candidate class:
    guid  = its .meta guid
    hosts = every .prefab and .unity containing "m_Script: {fileID: 11500000, guid: <guid>"
    if hosts is empty  ->  unreachable; exclude with evidence
```

Note the trap inside the trap: another script *calling into* the dead component is not evidence of life —
`GetComponent<T>()` returning null is silent, so those call sites are dead code too. (A prior learning
covers the mirror image: a component that IS live but invisible to a scene grep because it lives in a
prefab — [[prefab-composed-levels-hide-their-managers-from-scene-greps]]. Run *both* checks; they answer
different questions.)

## 2. A baked inspector flag disables the mechanic

The checklist's "ammo (current + reserve)" row had a matching resource counter, a consumption site, and
world pickups placed in three levels. It is still dead, because the shipping player prefab has
`infiniteAmmo: 1` serialized, and the consumption site is inside `if (!infiniteAmmo)`. **The flag's value
lives in the prefab YAML, not in code** — reading the C# alone tells you the mechanic exists; reading the
prefab tells you it is off.

## 3. The counter is never incremented

The same counter had exactly one write in the whole project: a decrement. No pickup path ever raised it.
Grepping the identifier and finding several hits *feels* like confirmation; classifying those hits by
**direction** is what settles it.

> Grep for a resource's **increment**, not for its name. A resource with only decrements — or only reads —
> is not a resource.

## What to do with a type that fails any of these

**Exclude it, in the census table, with the evidence inline** — the host sweep result, the baked flag value,
or the "no increment anywhere" finding. Do not silently omit it: a reviewer comparing your census against
the genre checklist will read a missing row as an oversight, and the next agent will re-add it. An explicit
`exclude — unreachable / static (flag baked off) / dead counter` row with its proof is the artifact that
makes the next pass cheap.

Also **do not fix it.** A hosted-nowhere subsystem and a baked-off mechanic are the game team's decisions or
their pre-existing dead code; report them as findings and keep the integration off them. What matters for
the integration is only that nothing gets mapped onto them — no state, no actions.

## The generalization

**Reachability is part of the census, not a detail of the deep scope.** For every candidate type, answer
"is this live in the shipping content?" *before* assigning a load-bearing flag and a wave — using the
content (prefabs, scenes, serialized flag values) as the source of truth, not the scripts. Three cheap
checks — *hosted anywhere? · shipping config flag? · ever incremented?* — and each one has produced a
different false positive.
