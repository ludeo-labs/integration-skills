---
category: common-mistakes
tier: generalizable
sourceGame: TopDownRogueSample
phase: "3"
question: "Are you gating the creator OpenRoom or BeginGameplay on a transient condition such as 'no scene fade / transition running', and does any signal you open on fire only once, possibly while that condition is false?"
sanitized: true
---

# Do not gate a lifecycle open on "no fade running"

## The mechanism

Never AND a **one-shot signal** with a **transient condition**. If the signal fires while the condition
is false, it is consumed, and there is no later edge to retry on.

The observed case: a boot-time "this scene is now shown" hook ran once, from the scene's start method,
while the scene's own fade-in was still running. The open guard also required "no transition in
progress", so it refused, and nothing ever called it again. The room never opened, and the log showed
only one refusal line.

## The habit

- **Open on the phase, level-triggered.** Evaluate "should a room be open?" from the current phase
  (gameplay is live, the play-mode scene is active) every frame or on every relevant change, and open
  when it is true. A per-frame open needs a latch so it fires once:
  [[per-frame-open-needs-a-closed-latch]].
- **Put the fade in the span machine, not the gate.** Mark fades and transitions non-ludeoable, so they
  are inside the capture but cannot be picked as a moment start:
  [[non-ludeoable-spans-as-a-state-machine-not-paired-calls]].
- When reviewing any gate, list each input as "edge" or "level". A gate that combines an edge with a
  level that can be false at that edge needs a retry, or should become level-only.
