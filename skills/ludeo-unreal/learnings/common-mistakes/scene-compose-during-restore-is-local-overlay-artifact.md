---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: 4
question: null
sanitized: true
---

# "Watching the scene compose" during restore is a LOCAL overlay artifact — not a cloud bug

## What you see (locally)

When you test Player-Flow restore on your **own machine**, you can watch the level assemble
behind the freeze/pause before gameplay begins: actors popping in, async spawns settling, the
world composing itself. It looks like the viewer would see an ugly "level building" moment, and
the instinct is to add a reveal cover — hold a loading screen / black overlay until the world is
fully settled, then reveal.

## Why that fix is wrong

**Pausing during Player Flow is correct and sufficient.** The visible composition is a
**local-only artifact of how the overlay renders**: on a local run the Ludeo overlay draws
in-engine, so your screen shows the in-progress world while it assembles.

On a real **cloud** run the viewer sees **nothing until `AddPlayer`** connects the video feed.
The world composes *before* any frame is streamed to the viewer — the cloud video gate already
hides exactly what you were worried about. There is nothing to cover.

Adding reveal-cover machinery is a **speculative mitigation for a non-bug** — and speculative
mitigations are forbidden before a root cause is confirmed (they distort Ludeo fidelity and paper
over real lifecycle issues). This one "fixes" a problem the cloud flow does not have.

## The correct model

- **Local run:** overlay renders in-engine → you see composition. Expected. Ignore it.
- **Cloud run:** no frame reaches the viewer until the video feed connects at `AddPlayer` /
  viewer-connected `OnRoomReady`. Composition happens off-screen.
- The lifecycle is: **pause → restore → settle → begin gameplay.** The pause holds the sim; the
  cloud video gate hides the assembly. No extra reveal cover.

## When it IS a real bug

If gameplay actually **begins** (unpaused, `BeginGameplay` fired) while the world is still
assembling — entities in the void, actors falling through, wrong counts — that is a genuine
begin-gate / settle-timing problem. Fix the **gate legs** (room-ready ∧ player-added ∧
world-settled), not the presentation. Don't confuse "I can see it compose locally" with "it
begins too early."

## Related learnings

- `onroomready-is-the-viewer-connected-gate.md` — the viewer only connects at the room-ready /
  player-added convergence; before that nothing is streamed.
- `speculative-mitigations-distort-ludeo-fidelity.md` — the general rule this instance falls under.
- `pause-before-player-flow-room.md` — pausing during restore is the intended mechanism.
