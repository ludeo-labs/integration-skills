---
name: ludeo-trimmer-trims-state-and-video-together
description: The Ludeo platform trimmer trims BOTH video and the captured data stream. The state-restore point on replay matches the trim point — never claim or assume "trim only affects video, state snapshot is at room-close."
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Don't claim the trimmer is video-only

## The rule

The Ludeo platform's user-facing trimmer trims **both the rendered video and the captured data stream**. When the user trims a Ludeo to a sub-range and the player flow restores state, the state matches the trim point — same moment as the first frame of the trimmed video.

**Never tell a user:** "the snapshot is one moment at room-close and the trim only affects the video, so a player-position mismatch is expected." This is wrong. The SDK uses continuous delta tracking; the trim selects which delta-stream point gets restored.

## How the failure presents in diagnosis

A user reports "the player isn't where I trimmed the Ludeo to" or "the combat state in replay doesn't match where I cut the clip." The agent looks at the captured `ludeo.json`, sees the captured `Combat snapshot Phase=0`, and concludes "the cloud picked a pre-combat snapshot, the trim is video-only." This conclusion is **wrong** and misdirects the investigation:

- It blames the platform / trim feature for what is almost always an integration or backend bug.
- It tells the user "this is expected" when the user knows from product experience that it isn't.
- It wastes a debugging session that could have been a 30-minute code review.

## What to investigate instead

When replay state doesn't match the user's trim point:

1. **Integration capture path** — are we writing per-tick state every tick during Creator Flow? If a per-tick attr stops updating, the trim point reads stale data.
2. **SDK delta serialization** — is the SDK actually persisting the delta stream up to the trim point, or is it truncating? Confirm with the SDK team if state at trim is wrong despite confirmed per-tick writes.
3. **Backend slicing** — is the cloud-side trim slicing the data stream correctly? If yes per the SDK team, the bug is upstream of the cloud.
4. **Backend snapshot delivery** — verify the SDK reader's `FLudeoObjectInformationCollection` matches what was captured at the trim moment, not what existed at room close.

Bisection between integration and backend: revert to a known-good integration commit, capture+replay with the same user actions, see if the trim point restores correctly. If it does → integration bug. If it doesn't → backend / SDK bug.

## How we got here

ActionGame Phase 5 (2026-05-14). User reported "player not where we trimmed to, enemy vehicles missing, combat state wrong" on replay. The agent (me) misread the captured snapshot's `Phase=0 ProgIdx=-1 VehReqs=0` as "the cloud picked an early snapshot, trim is video-only." The user corrected: trimmer trims both streams — that's not how it works. The right next step was bisection (revert integration, retry, isolate code vs backend), which is what the user directed. Skill learning written so the wrong claim doesn't surface again.

## Cross-references

- `learnings/common-mistakes/no-puppet-mode-ludeo-is-snapshot-restore.md` — adjacent platform-behavior rule (state is snapshot-restore not frame-replay), which is correct.
- Personal memory `ludeo_trimmer_behavior.md` — same correction recorded under the user's project memory for fast recall in this codebase.
