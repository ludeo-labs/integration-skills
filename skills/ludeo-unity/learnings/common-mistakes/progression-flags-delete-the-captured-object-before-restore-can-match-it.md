---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Does the game destroy or skip-spawn any entity at scene load based on a PERSISTED progression flag (permanent death, chest opened, event fired, one-shot consumed) — and does the restore reload that scene against the VIEWER's save?"
sanitized: true
---

# A viewer's own progression can DELETE the captured entity during scene assembly — normalize the existence flags before the load, never in the apply

Every restore plan reasons about attributes: what was captured, what setter writes it back, what happens
when a `ReadData` returns `false`. That reasoning silently assumes **the object exists to write to**.

In a game with any kind of permanent progression, it may not. The pattern is a self-destruct in the
entity's own init, gated on a persisted flag:

```csharp
void Start()
{
    // ... normal init, and only THEN:
    if (m_PermanentDeath && Progression.IsPermanentlyDead(this))
    {
        Destroy(gameObject);   // before any register hook, before any restore pass
        return;
    }
    RegisterForCapture(this);  // never reached
}
```

Restore reloads the captured level, so this runs against the **viewer's** save, not the creator's. A
Ludeo capturing a live boss then restores into an **empty arena**. The same flag usually also disarms the
trigger volume that would have armed the encounter, so even the fight's activation is gone.

**The failure is silent in every channel a restore normally reports through.** There is no missing key
(the bucket entry is fine), no missing attribute, no reference that fails to resolve. The only symptom is
an "unmatched bucket entry" warning — which is *also* what a legitimate content difference produces, so a
plan that already tolerates that warning will tolerate this one. The human report is "the boss wasn't
there."

## Why the fix cannot live in Pass 1 or Pass 2

The destroy happens in `Start()` **during scene assembly**. Both restore passes run at room-ready, after
assembly. **Any per-object fix is structurally too late** — there is no object left to fix. The only
window is between the selection-time hook that starts the scene load and the load itself, which is
exactly where the restore layer already is. That means no flow re-wiring: the seam you need is the one
you already own.

## Two mechanisms, and only one of them works

1. **Write the flag "off" into the save's in-memory layer before the load.** Attractive because the
   save API is usually public and it needs no game edit. **Check the read first.** In the observed
   project the read was `persisted[key] || inProgress[key]` — a two-tier lookup where the runtime tier
   can only *add*. Writing `false` into the runtime tier **cannot override a `true` in the persisted
   tier**, which is precisely the case that breaks. This option can add deaths and never undo one.
2. **Gate the read.** One in-method check at the top of the progression query, consulting the layer
   first. Read-only, so it cannot corrupt the player's file at all, and — the reason it is worth a game
   edit — the query is usually a **single funnel** that every progression namespace routes through, so
   one site covers the eight call sites you would otherwise have to patch individually, including the
   subclasses that re-implement `Start()` inline and would each need their own.

## What the layer should answer with

The cheap, correct answer needs **no new capture attribute**: for a key naming an entity that is present
in the restore buckets, answer "not consumed" — the creator demonstrably had it. Every other key falls
through to the game's own read, unchanged. This works when the progression key and your stable entity key
share a prefix, which they usually do, because both are built from `{scene}/{objectName}`.

It leaves one stated divergence: an entity the *creator* had consumed but the viewer has not still
appears, because it has no bucket entry. **Do not close that by deleting scene objects with no bucket
entry** — "absent from the buckets" also means "capture missed it", and that shortcut silently deletes
real entities. Capture the creator's flag set as its own attribute if the divergence matters, and price
it honestly: it is a capture-schema change, it re-invalidates every existing Ludeo, and it usually lands
on the *world* objectType, which an earlier wave already confirmed.

## The second half nobody notices: the replay WRITES these flags too

The same progression write fires when the **viewer** kills that entity *during the replay*. A save-
suppression guard keyed on "is a Ludeo playing" keeps it out of the file while the replay runs — and then
the replay ends, the guard lifts, and the runtime flag is still sitting there for the next legitimate
save to promote. Same shape as re-unlocking the creator's skill tree: it needs the same **undo ledger**,
recording only the keys this replay created and removing them on End/Abort.

This half is not new to the wave that discovers it. If the earlier wave already restored entities that
can be killed, it has been leaking since then.

## The generalization

**Any state that decides whether an object EXISTS is a restore-flow concern with a pre-load deadline, not
an attribute.** Phase-4 censuses routinely mark progression flags "exclude — cross-run progression, not
part of this moment", and that disposition is correct *as an attribute* and wrong *as a conclusion*.
Sort the excluded flags once more, by a different question: does this flag gate object **existence** or
object **state**? Existence-gating flags go on the restore-flow list with a note saying which hook has to
neutralize them, and the check that finds them is a grep for the flag's read method, not for its writes.
