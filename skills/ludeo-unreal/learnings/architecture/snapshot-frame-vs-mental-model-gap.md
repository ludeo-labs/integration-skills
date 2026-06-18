---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 3
question: "Which captured state is frame-local (true at the snapshot instant) vs time-cumulative (a running tally across the recording)? Cumulative state will surprise the user when the picked frame is earlier than they remember playing."
sanitized: true
---

# The user's mental model of "capture" is the full recording; the Ludeo is one frame picked from it

## Precondition

You're capturing state into `GameMetadata` or per-entity writable objects. The user plays a 3-minute slice, presses "capture", and expects their replay to match what they just played. The integration is technically correct — writes happen per tick, reads happen on restore. But the user reports "the replay is missing X" and X is something that happened mid-recording.

Before assuming the capture or restore is broken, check what **frame** the Ludeo cloud picked.

## The mental-model gap

| User thinks… | Actually… |
|---|---|
| "I captured the moment I was in heavy combat" | The cloud picked a frame a single tick of the recording — possibly minutes earlier. |
| "All my kills should replay" | Only kills that happened **before** the picked frame are in the snapshot's cumulative state. |
| "The replay should start where I stopped" | The replay starts at the cloud's chosen frame, not at the end of the recording. |

The Ludeo SDK records the full slice *and* writes snapshot attributes every tick. On replay, one tick's attributes are reinstated. "Which tick" is not the end — it's whatever the cloud's ranker picked as the most interesting moment.

## Consequences for capture design

State that's **frame-local** (true at the snapshot moment) replays faithfully regardless of which tick is picked:
- Player transform, health, armor
- Which enemies are alive right now
- Current objective state, current combat phase
- Which doors are open, which lights are on

State that's **time-cumulative** (a running tally) will surprise the user when the picked frame is earlier than expected:
- Kill count / corpse buffer
- Shot count, damage-dealt running total
- "Has the player done X yet" flags (unless you also capture the exact moment X happened)
- Loot accumulated across the session

## Design rules

1. **Prefer frame-local state.** If the game has a live list (e.g., alive enemies, active objectives, current phase), capture that directly — don't reconstruct it from a running event log.

2. **When cumulative is unavoidable, log what's being sent.** Add a Verbose log line at the snapshot tick with the cumulative counts:

   ```cpp
   UE_LOG(LogX, Verbose, TEXT("GameMetadata: Kills=%d Shots=%d"), KillCount, ShotCount);
   ```
   When the user reports "the replay shows zero kills", you can grep the capture log and see whether the picked frame actually had non-zero state.

3. **For events the user expects to see, replay them at restore time.** Rather than capturing "mission-beat happened" as a bool, capture the full trail and fire each beat's broadcast on restore so downstream systems (UI, audio, AI) behave as if they'd seen the sequence live. (See the Phase-B milestone-trail approach in ActionGame.)

4. **Tell the user which frame was picked.** Log `Phase=X Progression=Y` on restore so there's no mystery about "why does the replay look different from my memory."

## Anti-patterns

- **Blaming the SDK for picking a "bad" frame.** The cloud picks what its ranker thinks is most interesting. If your integration depends on a specific frame being picked, your integration is wrong.
- **Adding retry loops that re-check "did the frame have X"** — the frame is immutable once picked. If it doesn't have X, no amount of re-reading will produce X.
- **Capturing "will happen" state.** You can only capture what has happened up to now.

## Detection before release

On replay, log the restored snapshot's key identifying values:

```
Combat restored: Phase=1 Progression=1.00 Intensity=0.00
Combat snapshot restored: 154 bytes, Phase=1 TotalAI=0 ProgIdx=3
```

When the user reports a mismatch, these lines tell you *which frame* was actually picked before you go hunting for bugs in the reader/writer code.

## Cross-reference

- `dead-bodies-need-kill-time-capture.md` — even with a correct kill-time buffer, a picked early frame will have an empty buffer.
- `room-is-not-highlight.md` — foundational SDK model learning.
- `no-puppet-mode-ludeo-is-snapshot-restore.md` — replay is snapshot+run, not frame replay.
