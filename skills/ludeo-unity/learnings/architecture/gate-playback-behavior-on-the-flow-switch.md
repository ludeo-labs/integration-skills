---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5,6"
question: "Are you adding behavior that must run only during playback of a moment (or only during capture)? Gate it on the flow switch's explicit play-vs-create state, never on inferred leftovers."
sanitized: true
---

# Gate playback-only behavior on the flow switch, not on inferred state

The reference architecture already carries the authoritative replay-vs-creator signal:
`LudeoFlowSwitch.SwitchToPlay()` sets the in-Ludeo flag when a LudeoId is selected, and
`SwitchToCreate()` clears it (the Unreal integrations call the same idea `m_IsReplay`).
Any playback-only behavior - crediting unattributed deaths, re-asserting clocks, skipping
arrival flourishes - must gate on that flag.

Two tempting proxies that are WRONG:

- **A kept restore reference** (`m_lastRestore != null`): the controller may hold the last
  restore object indefinitely; a creator session started after a replay in the same app
  run still sees it non-null. Object liveness is not mode.
- **A "gameplay started" flag**: the recording bracket begins in CREATOR mode too - the
  begin-gameplay callback fires for both flows, so that flag alone says "a bracket is
  open," not "this is playback."

The safe shape: `if (!IsInLudeoFlow || !gameplayStarted) return;` - the explicit flow flag
carries the mode, the bracket flag carries the timing - plus clearing any per-moment
bookkeeping (queues, credited sets) at the begin-gameplay callback so nothing staged in
one bracket can leak into the next, whatever mode it was.

When the human asks "is this replay-only?", the answer must trace to the flow switch
assignments, not to a chain of inferences - during this integration the inferred gate
survived three reviews before the question exposed it.
