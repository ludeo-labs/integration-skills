---
category: common-mistakes
tier: universal
sourceGame: CoopShooter
phase: 4
question: null
sanitized: true
---

# Continuous input/telemetry is writable-object STATE, not actions — classify the data before picking the SDK primitive

## The mistake
Asked to "track all key presses and mouse movement" into a Ludeo recording, the
agent emitted every input as a name-only Ludeo **action**
(`SendAction` / `ludeo_DataWriter_SendAction`) — `KeyDown_W`, `MouseMove_Left`,
etc. — instead of writing it as **state attributes on a writable object**
(`WriteData` / `ludeo_DataWriter_SetXXX`), the same way position / health /
transform are already tracked per tick.

## Why it's wrong
- **Actions and state are different channels with different jobs.** Actions are
  discrete, player-attributed, goal-relevant timeline markers used for
  highlight/goal matching (Studio Labs / LudeoAI). Flooding that channel with
  hundreds of raw input markers per session pollutes goal matching.
  Writable-object attributes are sampled state captured into the snapshot — that
  is where tracking / telemetry data belongs.
- **The API misfit was a stop sign that got rationalized.** `SendAction` is
  name-only (just `playerId` + an action-name string — no value payload). A
  continuous/analog value like a mouse delta cannot be represented, so the agent
  encoded direction into the action *name* and discarded magnitude (throttled,
  bucketed to `MouseMove_Left/Right/Up/Down`). When the chosen primitive cannot
  represent the data, that means it is the WRONG primitive — not a problem to
  engineer around.
- **An English word matched the wrong SDK concept.** "A key press is an action"
  in plain language is not a Ludeo "action." The mechanism was chosen by
  name-matching instead of by the nature of the data.
- **The process amplified the error.** Once the spec locked "actions," every
  downstream review validated "actions implemented correctly" — none asked
  "should this be actions at all," because the mechanism was presented as
  settled.

## The rule
Before choosing how to record anything, classify the data:
- **Discrete + goal-relevant + happens at a point in time** (a kill, an objective
  completed, a phase change) → **action** (`SendAction`).
- **Sampled over time / continuous / "what is true right now"** (position,
  velocity, health, held inputs, mouse delta) → **writable-object attribute**
  (`WriteData` / `SetXXX`), written per tick like every other tracked field.

Input — held keys, and especially mouse movement — is sampled state. Track it
exactly like position: a writable object (or attributes on the player object)
updated each tick. If the action API cannot carry the value, stop and
re-classify; never encode the value into the action name.

## How to apply on future integrations
When the human says "track / record X," first ask: is X a discrete goal-event,
or continuous state? Present the two genuinely different mechanisms (action vs.
writable-object attribute) as the design choice with a recommendation — never
offer variants of one mechanism as if the mechanism were already decided. Find
the existing per-tick state writer (the code that writes `Transform`) and add the
new field there.
