---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 2
question: "Within the chosen mission, can a Ludeo capture happen at any time during play, or is it constrained to a specific phase/window? If 'any time', the slice is a FULL-MISSION coverage commitment — every time-varying piece of world state must round-trip regardless of capture point."
sanitized: true
---

# Curated slice is a coverage commitment, not a temporal window

## Precondition

The Ludeo capture moment is **non-deterministic within the chosen mission** — the default Creator-flow behavior. The player can hit "create Ludeo" whenever, and replay must work from that exact moment. If your integration explicitly constrains capture to a fixed phase (e.g. "only during boss fight"), this learning does not apply — narrow the slice differently.

## The mistake

Treating "curated slice" as "pick a 30s–2min highlight window and optimize for that one window." The downstream effects:

- Entity list becomes aspirational (e.g. 10 categories declared, 4 actually implemented).
- Restoration logic only works for the imagined moment; capture from a different point produces broken playback.
- Action coverage is dense in the imagined phase, sparse elsewhere.
- Stage gates pass on the imagined moment but field-test failures appear later.

## The rule

A slice is a **coverage commitment over the full mission timeline**:

- One map + one game-mode.
- Round-trip fidelity for every time-varying piece of world state, regardless of capture point.
- Entity list is a **closed spec** — every entry has a filter, writer, and restore handler by the end of state-tracking work. Aspirational entries are not allowed in the slice declaration.
- Action stream fires across **every phase** of the mission, not just the imagined highlight phase.

If the resulting coverage is too large for the timebox, **narrow the mission scope** (smaller map, simpler mode), do **not** narrow the temporal window inside the chosen mission.

## How to apply

During Stage 1 slice selection:

1. Pick the mission scope (map + game-mode).
2. Walk the mission timeline. List every distinct gameplay phase (intro / setup / objective / combat / escape / etc.).
3. For each phase: enumerate which entities are visible-or-active and which actions fire.
4. Union those sets → that's the slice's coverage commitment.
5. Validate every entry in the union has implementation-level commitment by end of Stage 3 (state) and Stage 4 (actions).
6. If the union exceeds the timebox: swap mission scope, not slice scope.

## Anti-pattern signals

- Entity list contains items with no plan for who reads/writes them ("we'll get to it later").
- Slice description is a narrative ("classic objective run — stealth entry, action beat, extraction") rather than a coverage scope.
- Action set is sparse during early/late mission phases but dense in the middle.
- Restoration is only ever tested from the canonical highlight moment, never from a randomly chosen capture point during the mission.

## Cross-reference

- `track-all-visible-entities-for-curated-slice.md` — visual completeness pass within the committed coverage.
