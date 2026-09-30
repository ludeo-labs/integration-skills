---
category: common-mistakes
tier: universal
sourceGame: SurvivalSample
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
---

# Keep the phases in order, and re-anchor after every detour

The phases run in the order they do because each phase's gate is a precondition of the next: object
mapping assumes the lifecycle already opens a room, restore assumes capture already writes what it
needs, actions assume the player flow is proven. Work done out of that order is not wasted in itself,
but it leaves open gates that nobody is tracking — and the agent loses its place.

## What it looked like

On a long integration spread across dozens of sessions, work drifted out of order repeatedly: pulled
by the integrator's requests, by incidents, and by parallel sessions working different phases at once.
Each drift was reasonable in the moment. The cost showed up afterwards, as an agent that no longer
knew where to continue or what was still missing:

- the integrator had to ask whether the integration was really in phase 5, because no Ludeo was
  playable yet;
- a status audit found phase 5 about two-thirds done — the restoration plan never started, the restore
  apply still a stub, no replay ever run — after progress updates had implied more;
- a widening plan broke the skill's own phase 8 procedure in four ways, and was caught only because the
  integrator asked whether it was on track.

Each time, re-establishing the real state took longer than the detour itself.

## The habit

1. **Keep one phase tracker in the integration folder**: each phase, its status, the evidence that its
   gate passed, what is still open, and the next step. Read it at the start of every session and
   re-verify it before trusting it: notes from an earlier session can describe problems already fixed.
2. **When a request jumps ahead, say so before starting.** Name the earlier gates still open and what
   skipping them risks, then let the integrator decide. It is their call; make it an informed one.
3. **After a detour, go back to the next unfinished step**, instead of carrying on from wherever the
   detour ended.
4. **End every session with one plain line**: where the integration stands and what comes next, in
   terms the integrator can see (first capture, first replay, first cloud replay), not only phase
   numbers — see [[write-for-the-integrator-not-for-the-skill]].
