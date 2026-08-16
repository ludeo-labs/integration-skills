---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Has the restore's output ever been verified by the LAYER itself, rather than by a human watching the replay? If not, add placement validation before debugging anything else about replay fidelity — it converts 'the moment looks wrong' into a named offender with coordinates."
sanitized: true
---

# Validate placement from the layer — the restore announcing its own failures beats watching for them

Suggested by the integration owner after a run where the moment visibly started in the wrong
place: have the layer verify, at fixed checkpoints, that everything the restore placed is still
where it was put — and say so either way.

What to record at apply time:

- the player's restored position;
- every enemy placed, paired with its restored position (cleared and rebuilt per apply).

When to check — twice, because the two windows have different overwriters:

1. **After the settle** — catches the apply itself failing and anything the settle's simulation
   did (a spawner trigger repopulating, physics ejecting something from geometry).
2. **At Begin (the player's click)** — the wait between settle and click can be minutes; this
   catches anything that re-placed entities during it (the class that actually bit here: the
   game's own spawn handshake teleporting the player to the level start).

How to report:

- Player: one trace line with the distance when OK; a loud warning with BOTH positions when
  beyond ~1.5m — "something re-placed the player after the restore".
- Enemies: one summary line — count present, worst drift, how many beyond tolerance, how many
  GONE (despawned/returned to pool) — plus individually named offenders, capped (~5) to avoid
  spam. Tolerance ~3m: the settle lets enemies take footsteps by design; the check hunts
  wholesale re-placement, not walking.

Why it pays for itself immediately: the first fully-working run printed
`Player placement OK: 0.00m` and `58 enemies, worst drift 1.59m` — turning "did the restore
actually hold?" from a human judgment into two log lines, and any future regression into a named
offender with coordinates instead of a vague "it looked wrong".
