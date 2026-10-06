---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 2
question: "Did you find a record/replay, autotest or repro framework in the codebase and start planning capture/restore gates around it? Before you do: is the manager class abstract, and does a concrete subclass actually exist in THIS title?"
sanitized: true
---

# A studio framework can be fully present in source and still have no live implementation

[[find-the-studio-s-own-repro-tooling-first]] is right that a studio's own repro tooling is the highest-value
artifact in the mapping phase. It does not say how to check the tooling is **alive**, and on a shared
codebase that check is the whole thing.

Observed: a project carried a complete-looking deterministic **input record/replay framework** — a manager
with `StartRecording`/`StopRecording`/`StartReplay`/`StopReplay`, a fixed global random seed pushed into
the game's RNG so a replay reproduces the same run, a serialized waypoint format, a rich action library
(move, attack, interact, GUI button press, menu, assert, wait-for-scene), developer console commands
bound to all of it, and a CI entry point that deserialized its results XML. Every signal said "use this to
drive the capture and replay gates."

**It could not run.** The manager was `abstract`; `Instance` is assigned in the concrete subclass's
`Awake`; and **no concrete subclass existed anywhere in the project.** The console commands would have
dereferenced a null `Instance`. Two further tells, both visible once looked for: no recorded data existed
anywhere on disk, and the one gameplay-side call into the framework had been **commented out** in the
player controller.

The framework had been inherited from a sibling title sharing the codebase. The source was real; the
wiring for *this* title was not.

## The check, before planning anything around such a framework

1. **Is the entry class abstract or an interface?** If so, find the concrete subclass — by type, not by
   filename. No subclass means no `Instance`, and every static API on it is a null dereference.
2. **Where is `Instance` assigned, and does that object exist in a shipped scene or prefab?** A singleton
   assigned in `Awake` is only alive if something instantiates it.
3. **Does any recorded/serialized data exist on disk?** A replay system nobody has recorded with is a
   system nobody has run.
4. **Are the gameplay-side call sites live, or commented out / behind a define the shipping target
   disables?** (See [[verify-the-define-fence-before-citing-a-hook]] for the define case.)

## Why this matters more than a wasted afternoon

A record/replay system, if live, legitimately collapses the dominant cost of phase 5: every wave's gate
needs a human to play a run and capture, every wave invalidates the previous capture, and a deterministic
replay makes that repeatable and unattended. Because the payoff is so large it is tempting to write it
into the plan the moment the API surface is found. **Costing it as "reuse what exists" when it is really
"write a concrete implementation and prove it drives this game's input" is a large estimation error in the
direction that hurts** — it lands as a discovered blocker mid-phase rather than a scoped decision up front.

## Cost it in tiers, because the abstract members are the cheap part

The instinct is to measure the gap by the unimplemented members — here, two. That badly understates it.
Separate three questions:

1. **Does it run?** The abstract members plus a spawn point. Genuinely small.
2. **Does it CAPTURE?** Check who constructs the action objects during recording. On the project above the
   answer was *nobody*: the base class auto-recorded scene changes and nothing else, and no game code
   anywhere referenced the recording flag. Every real action would need a hook at its origin in the
   game's input/UI/AI code — the expensive part, and on a Ludeo engagement it means editing game files
   the integration had so far kept at zero.
3. **What determinism does it actually give?** Read the actions before assuming "same inputs, same run".
   These were *goal-based bot commands* ("move to point", "kill actor N") with position tolerances,
   rotating retries, per-action timeouts, a skip-after-N-failures policy, and a **5x replay timescale**.
   That reproduces approximately the same run, which is right for a soak/perf test — its actual purpose —
   and is not the frame-level fidelity a capture/restore gate is being sold on.

**Check for an active conflict with the integration, too.** This framework forced a fixed global debug
seed that overrode *every* generator's own seed — including the world generator whose seed the Ludeo
capture records as a generation input. Running a capture under it would have stored a seed that did not
drive generation. It also swapped in a dummy serializer and cleared save data on start.

Reviving such a framework may still be right, but it is a build with its own verification. Surface it as
a costed option in tiers, never as a free lever.
