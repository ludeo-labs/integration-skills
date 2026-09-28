---
category: architecture
tier: generalizable
sourceGame: RoomActionSample
phase: "6,7"
question: "Are the game's actions, Pause/Resume and Non-Ludeoable spans wired and already sent once by a build, and does this session have browser control with the integrator signed in to Studio Lab?"
sanitized: true
---

# Offer to set up Studio Lab yourself with browser control (recommended) once the actions have been sent

The skill hands the platform side over as a verbatim instruction: "create the Global Triggers, I can't do this".
That was true without a browser. With browser control the agent can do all of it, and it is the step integrators
most often leave half done, because nothing fails loudly: a missing or misnamed Global Trigger drops the action
silently, the objective timer keeps running through pauses, and a goal on the wrong event just never completes.

In one integration the agent created, in the integrator's signed-in Studio Lab session: the four Global Triggers
(Pause/Resume, Non-Ludeoable start/end), a goal per gameplay action (kills, room clears, level finish, streaks,
each boss type), the constraints, and a score per action including negative ones (a dash, a death). Every item was
read back from the page after saving and written into the plan.

## When to prompt

After the phase-6 recording run has **sent every action at least once** (Studio Lab lists an event only after a
build has sent it: see `studio-lab-lists-an-action-only-after-a-build-sent-it`), ask:

> "The actions reach the backend now. Want me to set up Studio Lab for you with browser control? I'd create the
> Global Triggers, goals, constraints and scores in your environment and read each one back. (Recommended.)
> Otherwise here is the list to create by hand: ..."

Ask again when a later batch adds actions (a boss event, a streak), and before the first cloud test.

## How to do it without mistakes

- **Confirm the environment first.** Studio Lab has several (Sandbox, Playtest, Production); the environment id is
  in the page URL and in the selector at the top. Check it before every save.
- **Pick events by clicking the option, never with Enter.** The event field is a search box; Enter selected the
  first fuzzy match, which was a different event (a longer name that merely contained the typed one). Find the
  option element by its exact text and click that one.
- **Read the form back before saving.** A one-line script that lists the form's input values catches a wrong
  event, name or number before it is saved. After saving, re-read the list and compare.
- **Negative scores** are a positive value plus the Negative toggle, not a minus sign.
- **Names are short** (goal names are capped around 20 characters); match them to the score names.
- **A narrow browser pane can collapse the page** (tables and forms disappear). Widen the viewport and reload.
- **Never type credentials.** The integrator signs in; the agent only works in that session.
- Record every trigger, goal, constraint and score (name, event, value, environment) in the plan, so the next
  session or a second environment ("Copy to Environment") starts from a known list.

## What it prevents

Pause and non-ludeoable spans that silently do nothing on the cloud, goals bound to the wrong event, scores entered
in the wrong environment, and a setup nobody can reconstruct later.
