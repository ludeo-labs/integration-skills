---
category: architecture
tier: universal
sourceGame: TPSSample
phase: 5
question: null
sanitized: true
---

# The restore point is the clip START, not the capture click

When a creator marks a moment, the clip covers a fixed window that **ends** at the click
(60 seconds in the observed configuration). The platform builds the moment's restorable
state **at the start of that window**: base state plus the captured event stream cut at the
clip's start time. Objects whose first write comes after the cut are absent; objects whose
delete event precedes the cut are removed.

## Why it matters

A creator who marks a moment shortly after a fight begins produces a Ludeo whose restore
point **predates the fight**. The restore will correctly put back zero enemies — the state
at clip start had none — and the fight is expected to happen during forward play, driven
by the game's own triggers. This is faithful behavior, not a capture or restore defect.

Observed concretely: a moment marked ~60s after entering a combat room restored 49 world
objects and **zero** enemies, because the first enemy's first attribute write landed 12
seconds *after* clip start. A sibling moment marked a minute later carried 49 enemy
objects plus 22 deletions. Both were exactly right for their clip-start instants. A prior
session had misattributed the empty restore to "the capture ended in the player's death" —
wrong; where the capture *ends* is irrelevant to what the moment restores.

## Consequences for the integration

- **Restore must tolerate a pre-event state.** Anything the game populates via triggers
  (encounter waves, scripted sequences) may be captured *not yet started*. Restore must
  distinguish "in progress — put it back" from "not yet triggered — leave it alone so the
  game runs it forward" (capture the started flag; see the companion common-mistakes
  learning on global replay gates).
- **Test moments must be marked late enough.** To verify entity restore, the entities must
  already exist at clip start — i.e. mark the moment after the fight has been running
  longer than the clip length.
- **"Zero restored" is diagnosable from data, not speculation.** The platform stores, per
  highlight, the built state snapshot, the event CSV, and a deleted-objects list. Reading
  the snapshot answers "was it captured?" in one step and cleanly splits capture-side from
  restore-side bugs. Ask the platform team (or the snapshot service's storage) for the
  highlight's files before hunting a restore bug the data may already exonerate.
