---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "1,3,5,6"
question: "Are you driving the Unity Editor through an agent/MCP bridge that COMPILES a C# snippet on every call (e.g. a RunCommand-style tool)? If so, every such call made while play mode is live forces an assembly reload mid-play — treat the bridge as stopped-mode-only and drive play mode from inside the game instead. And only believe play mode has stopped on a signal the current run created (its own result file, or a human saying so) — log markers that look like play-exit recur once per run."
sanitized: true
---

# An MCP editor bridge compiles on every call — so it cannot drive play mode

A `RunCommand`-style MCP tool ("compile and execute a C# script in the Editor") is enormously
useful: it reaches game statics directly, reads live objects, and reports `error CS` lines back.
It makes the compile half of every gate agent-verifiable. See
[[agent-can-run-unity-compile-gates-headlessly]] for the gate-splitting argument this extends.

**But it compiles an assembly every single call.** Calling it while play mode is running asks
Unity for a hot reload in the middle of a live session. Observed on a large HDRP project: a
sequence of in-play bridge calls ended in `Hotreload` + `PostProcessAllAssets` immediately
before the Editor froze and had to be killed.

## The rule

**The bridge is a stopped-mode tool.** Use it to inspect, to compile-check, and to *start* a run.
Never call it between the moment play mode begins and the moment it ends.

## What replaces in-play bridge calls

Drive the run **from inside the game**, and let the filesystem be the interface:

```
agent → (bridge, stopped)  write job.json + open boot scene + EnterPlaymode()
game → [RuntimeInitializeOnLoadMethod] spawns a runner iff job.json exists
runner → consumes the job, runs the scenario as a coroutine, writes result.json, exits play mode
agent → reads result.json off disk (no bridge call at all) + the log after exit
```

Four properties make this strictly better than snippet-driven automation:

- **No mid-play compiles**, so the failure above cannot occur.
- **Consume the job file at run start**, not at the end — a run that dies must not re-trigger on
  the next play session.
- The same runner works under `-batchmode` and **in a built player**, which is where a lifecycle
  harness belongs anyway ([[agent-can-run-unity-compile-gates-headlessly]] argues this on separate
  grounds: a player process exits per run and cannot poison the Editor).
- Evidence is a **file the agent reads directly**, not log text it has to parse out of a stream.

## Knowing play mode stopped needs a signal you created

The rule is easy to keep right up to the moment you *believe* play mode has ended. Then you call the
bridge in good conscience, and it forces a hot reload into a live session anyway. That happened on a
second integration and killed the Editor: a mid-play compile, a ten-second domain reload, every static
wiped, per-frame `NullReferenceException` out of the game's own update manager, the log growing from
4 MB to 112 MB in two minutes, then a crash dump.

The mistake was made earlier and looked harmless. The harness had a per-run flag for whether the
scenario exits play mode when it finishes, and for this run it was set to **false** so a human could
look around the restored world. That removed the only deterministic "play has stopped" signal. From then
on the only way to know was inference, and every marker available is **per-run, not per-session**: a
session-release line, the Editor reloading its backup scene on play exit — one of each per run, so after
two runs there are two, and the second is not evidence the *current* one ended. The log going quiet is
indistinguishable from an unfocused Editor throttling itself.

**Only act on a stop signal you deliberately created for this run**, in order of preference:

1. **Let the run exit play mode itself** and treat the result file it writes on the way out as the
   signal. This is the default; do not give it up casually.
2. **When a human needs the session left running, the human owns the stop.** Ask them to say when they
   are done. Do not infer it.
3. If you must probe, probe something that **cannot be true of a previous run** — a marker the current
   run writes with its own id — never a category of line that recurs.

The durable question behind any "never do X while Y" rule is not *do I remember the rule* but **what
would tell me Y is false, and could that same thing have been true five minutes ago?** If it could, it
is a coincidence, not a signal. The costs are lopsided: waiting when play has already stopped costs a
round trip; calling the bridge when it has not costs the session, and sometimes the Editor.

## Also worth knowing about such bridges

- **Any error-level log emitted during execution can be reported as tool failure**, even when the
  command did exactly what you asked. Read the returned logs, not just the success flag — and never
  emit `LogError` from harness code for an expected condition.
- **Touching a reflection-scanning game registry outside play mode runs its constructors.** A cheat
  registry that instantiates every command type on first access logged input-subsystem errors when
  poked from a stopped Editor. Harmless, but it pollutes gate evidence — only touch such registries
  in play mode.
- **A modal dialog raised from a bridge call hangs the bridge** with no timeout you control. Before
  opening a scene from automation, check every open scene's `isDirty` and refuse rather than let
  Unity raise a save prompt.
