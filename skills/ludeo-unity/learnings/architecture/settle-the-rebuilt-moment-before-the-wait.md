---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
---

# Settle the rebuilt moment: apply frozen, run half a second with input off, freeze again

After the restore applies, the world must sit frozen behind the pre-play screen until the player
clicks Play (see the RoomReady learning). But a freshly rebuilt moment cannot simply be frozen
where it stands: the player teleport and the pooled enemies both need real simulation frames to
take — a character controller held at time-scale zero can swallow a teleport, and pooled objects
finish coming up over a frame or two. The Unreal reference integrations state the same rule from
their side: "the movement component needs the game running to handle the teleport."

The sequence, per the integration owner (proven across the Unreal integrations, now confirmed in
Unity):

```
level built + native spawn done
  → freeze
  → apply the restored state          (while held - nothing can overwrite it)
  → SETTLE: let time run ~0.5s        (teleport lands, enemies finish coming up)
      - input stays suppressed        (the player must not act during the settle)
  → freeze again
  → open room + add player → wait for the click
```

Implementation notes:

- The freeze controller needs an explicit settle mode: time scale released, input suppression
  kept, and the per-frame reassert skipping the time-scale write while settling. Ending the
  settle — or the freeze being released for any reason — re-freezes / clears the mode.
- 0.5s wall-clock was sufficient; the Unreal reference uses the same order of magnitude.
- Enemies acting for half a second means small drift from their captured spots is NORMAL. Any
  placement validation run after the settle needs a tolerance (a few meters), not equality.
- Expect the game's frozen state to surface engine noise: script-driven `Physics.Simulate` with a
  zero step spams warnings every fixed update (see the engine-quirks learning).
