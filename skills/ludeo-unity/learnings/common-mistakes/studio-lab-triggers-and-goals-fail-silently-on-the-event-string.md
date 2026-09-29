---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 6
question: "Setting up or checking Global Triggers, goals or constraints in Studio Lab? Read the FIRST column of each row — that is the event string the game must send, character for character. And check that every event you need has been sent by the game at least once, or it cannot be selected at all."
sanitized: true
---

# Studio Lab triggers and goals fail silently on the event string

Two traps in the platform-side configuration, both with **no error anywhere** — the game sends its
actions, the log shows them, and the platform simply does nothing with them.

## 1. In the Global Triggers list, the first column is the trigger event, not a label

A trigger row has three fields: a free-text **Description**, the **Trigger event** (the action string the
platform listens for) and the **Actionable event** (what Ludeo then does: pause, resume, non-Ludeoable
start/end, end). The list view shows the **Trigger event in its first column**.

In one integration the action strings were renamed in code (to the documented underscore spelling). The
four trigger rows were then edited by typing the new strings into the **Description** field — the first
column still held the old names. For weeks the game sent the new names, the platform listened for the old
ones: the clock never stopped on a pause and cutscenes were never excluded.

- **When checking a setup, read the first column** and compare it with the exact strings in code.
- After renaming an action in code, **re-create** the trigger rows against the new event; editing the
  description changes nothing.
- A goal or constraint built on a name the game no longer sends can never complete — delete stale action
  names so nobody builds on them.

## 2. An action only becomes selectable after the game has sent it once

The platform learns action names from the game: the SDK registers each new name on its **first** emit.
Until a recorded run has actually produced an action, it does not exist in Studio Lab and no goal,
constraint or trigger can be built on it.

- Plan a short **"fire every action once"** run before the Studio Lab configuration session: finish a
  level, die, pick up each item type, open each kind of door, trigger each boss beat.
- Actions tied to rare events (level complete, a boss beat) are the ones that stay missing — call them out
  to the integrator explicitly, with the controls needed to reach them.

Goals and constraints are also **relative to the creator's own run** ("more than the creator's value"),
not absolute — name them so creators are not misled (a "take no damage" constraint means "no more than
the creator took").
