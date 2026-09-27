---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "4,5"
question: "Is any attribute NAME built from a value that changes during play — a wave or level index, a learned skill or item id, a pool slot or queue position, a live object's name? Then every session mints new names in a list the platform keeps per game version and never shrinks. Name only from closed sets that ship with the build, and put the runtime value in the value."
sanitized: true
---

# The data-name list only grows within a game version

The platform keeps one list of attribute **names** per game version. It is append-only: a name sent
once stays for the life of that version, and every unseen name rewrites the whole list. Deleting the
code that wrote a name stops new ones; it does not shrink the list. Renaming an attribute registers a
second name rather than migrating the first. A name's type is fixed by the first write that registers
it, and a later write of another type is refused silently and permanently (see
[[a-widened-int-is-a-silently-rejected-write]]).

## What it cost

An integration encoded runtime values into names: a wave index, a learned skill id, a pool queue
position. 94% of the names had been invented by somebody playing. Fifteen days in, the list for the
game version held 18,491 names (1.9 MB) and the platform stopped accepting updates inside the SDK's
timeout. The SDK then retried every ~11 s indefinitely — about 170 backend errors an hour from one PC —
and those attributes were never recorded at all. A platform engineer's alert caught it; nothing in the
integration did.

The only escape was a new `gameVersion`. The redesign that followed took the schema from 2,213 real
names to 684, and a regression from that cleanup surfaced a week later.

The worst family had no ceiling at all: it was keyed by a live object's display name, so every caster
and target pair minted a permanent name.

## The rule

**The attribute path is the schema; runtime values go in the value.**

- A name keyed by a **closed set that ships with the build** — an enum, a fixed slot list, the authored
  resource types — registers once and is fine.
- Anything that **varies with play** becomes its own object type with fixed attribute names — one
  object per wave, per learned skill, per pooled enemy — carrying the index or id as a value.
- For a profile-wide list of ids, see [[a-profile-wide-id-list-is-a-bitmask-not-an-attribute-per-id]].

## Measure it

- Count **real names**, not declared format strings. One report said "279 attributes" while the
  backend held 18,491, because it counted a family like `wave{0}.*` once.
- Record the count at every schema change, and warn past a budget (the redesign used 1,000).
- Look at the widest families first: any family whose count grows with playtime is the bug.
- Grep the SDK log for `Expected type X but client specified Y`. A type mismatch is refused silently and
  permanently, so it has to be searched for — with the SDK's data log switched on (see
  [[a-widened-int-is-a-silently-rejected-write]]).
- A sweep taken right after capture opens measures a floor: families keyed by list position (active
  effects, areas entered, used spawn points) have had no time to grow. Measure again after a long run.
