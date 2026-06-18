---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 4
question: "Is the game turn-based AND did the team agree captures land at turn starts? If so, quantize state WRITES to turn boundaries instead of per-tick — and make the cadence a config-driven policy so it can flip to per-tick later without code surgery."
sanitized: true
---

# Turn-based games: quantize state writes to turn boundaries — as a swappable policy

## Precondition

The game is turn-based and the team agreed (record it!) that "captures are assumed to
start at the beginning of a turn" (see [[turn-based-capture-at-turn-boundaries]]).
The integration uses manual DataWriter writes (not SaveWorld).

## The pattern

The Ludeo cloud picks an arbitrary video frame; the restored state is whatever the
delta stream held at that frame. Writing per-tick therefore restores mid-move /
mid-animation states (a unit frozen mid-move, a character mid-attack-montage).
**Quantizing the writes to turn boundaries makes every possible restore land at the
most recent turn start** — enforcing the agreed capture semantics by construction,
with no cloud-side cooperation needed.

Implementation: the existing poll (e.g. 10 Hz) reads a "turn tuple" from the turn
manager — (CurrentTurn, ActiveUnitId, TurnStateName) — and rewrites ALL state objects
when the tuple changes. Unit deaths are still handled at poll time (final write +
DestroyObject), since a writable's anchor actor may be GC'd before the next boundary.

## Make the cadence swappable — don't lock the design in

The team's instinct is "start with turn-boundary but don't lock us in." Honor it
structurally: ONE write path, with a `ShouldWriteThisPoll()` predicate driven by a
config key (e.g. `[Ludeo] WriteCadence=TurnBoundary|PerTick`). Flipping cadence is
then an ini change.

**Key fact to surface to the team:** switching cadence does NOT invalidate previously
captured Ludeos — the attribute schema is identical, only write frequency differs.
Re-recording is only forced when attributes are added/removed (the SDK hard-asserts
on missing FString attributes — see [[sdk-readdata-asserts-on-missing-attribute]]).

## Side effects to design around

- The video can show a mid-turn moment while restore lands at the turn start — the
  player replays the active turn from its beginning, including re-killing a unit that
  died mid-turn in the video. This is the agreed semantics, not a bug; record it so
  QA doesn't file it.
- Camera/viewer state written at turn cadence restores the camera where it was at
  turn start, not at the picked frame. Acceptable; note it.

## COUNTER-EVIDENCE (TacticsGame, 3 debugging rounds later): validate the cadence with a real capture EARLY

The same team that agreed to turn-start captures experienced the first real replay as
**broken** ("units are not where they appear in the Ludeo") and switched to PerTick.
Mechanism: in a tactics game units may not move for whole turns (ranged combat), so the
last-boundary data can equal the BATTLE-START formation even when the video moment shows
mid-turn movement. The replay then looks like "the game just restarted" — and because the
integration's self-checks validate restore-vs-DATA, every instrument reads green while
the user sees a totally wrong scene. Three debugging rounds (puppet linkage, transform
layers) were spent before realizing the data itself was the mismatch.

Rules this adds:
1. Turn-boundary cadence is a UX decision the team cannot evaluate from a description —
   **schedule a watch-the-replay test immediately after the first capture** and expect
   the decision to flip.
2. When restore-vs-data validation is green but the user reports a wrong scene, check
   **data-vs-video** before hunting restore bugs (see
   [[snapshot-frame-vs-mental-model-gap]] — this is its cadence-amplified form).
3. The swappable-cadence design (config key) is what makes the flip a one-line change —
   keep it.
