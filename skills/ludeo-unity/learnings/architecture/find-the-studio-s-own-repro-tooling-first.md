---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: 2
question: "Does this game generate its world at runtime (procedural / seeded), or otherwise have a QA 'reproduce this exact run' need? If so, search for the studio's own snapshot/repro dev tool BEFORE designing capture or restore."
sanitized: true
---

# Before designing capture/restore for a generated world, go find the studio's own repro tool

A studio that ships runtime-generated content almost always builds an internal
**"reproduce this exact run"** tool — QA cannot file a useful bug report against a
world that no longer exists. That tool is usually a dev-only snapshot: dump some
state to JSON/clipboard, reload, re-apply.

**That tool is the single highest-value artifact in the whole mapping phase**, and it
is easy to walk straight past because it lives in a debug/util folder, not in the
gameplay code you are mapping.

## Why it matters more than it looks

Finding it collapses the riskiest unknowns of phases 4–5 from *assumed* to *proven*:

1. **It enumerates the real generation inputs.** Not "the seed" — the *actual set*.
   Typically a primary seed plus a secondary roll, a theme/biome selector, a
   difficulty, a progress cursor, and a scaling counter. Deriving that set yourself
   from the generator is slow and easy to get incomplete; the studio already did it
   and validated it against real bug repros.
2. **It proves reproducibility empirically.** You no longer have to argue that the
   world can be regenerated deterministically — the studio depends on it daily.
3. **It hands you the correct restore ORDER**, which is the part teams get wrong.
   The order observed was: wait for the player to exist → world/seed → progression
   and loadout → collections (inventory/buffs) → **absolute position applied LAST**.
   That is the CR-006 two-pass ordering, already validated on this codebase.
4. **It reveals non-obvious re-registration steps.** The one found here: after
   teleporting to a restored position, the destination world-chunk had to be
   explicitly re-registered with the game's spatial index or spatial queries silently
   missed the player. Nothing in the generator hints at that. A from-scratch
   restore implementation would have shipped that bug and then chased it for hours.

## How to search for it

Grep the whole project — not just the gameplay roots — for:

`snapshot` · `repro` · `WriteSnapshot` / `ReadSnapshot` · `dump` · `seed` ·
`debug` + `json` · a dev/test UI page · `GUIUtility.systemCopyBuffer`

The clipboard call is a strong tell: repro tools copy to clipboard so QA can paste
into a ticket. Also check any `Util`, `Debug`, `Dev`, or `Testing` folder and any
dev-only UI page class.

## Two cautions

**Do not call it from Ludeo code.** It is dev-tool code — file I/O, clipboard I/O,
often fenced behind an editor/dev-tools define that the shipping target disables (see
[[verify-the-define-fence-before-citing-a-hook]]). **Port the ordering and the field
list; do not invoke the implementation.**

**Check what it does NOT cover.** These tools restore the *player and the world*,
because that is what reproduces a bug. They typically ignore AI/enemy population
state, container opened-state, in-flight projectiles, and boss phase — exactly the
things a *playable* moment needs. Treat its field list as a validated **Wave 1 floor**,
not as the complete tracking set. Waves 2+ are still yours to design.

## The generalization

A generated world is not the only trigger. Any game with a QA-visible
"reproduce this run" problem tends to grow this tooling. When it exists, it is
prior art written by people who know the codebase better than you will during the
engagement — read it before proposing your own design.
