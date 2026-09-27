---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "1,2,3,4,5,6,7,8"
question: "Are general workflow skills installed alongside this one — a brainstorming/design skill, a systematic-debugging skill, a Unity CLI/Editor skill? Then load them at the points below instead of improvising those workflows inside this skill's phases."
sanitized: true
---

# Load the helper skills for design, debugging and Editor work

This skill covers the Ludeo integration itself. It says little about how to design a change, how to
debug one, or how to drive the Unity Editor from an agent, and those are where most of the time went
on a large integration. General skills for all three are often installed alongside this one, and they
were under-used: across 65 sessions the agent loaded a systematic-debugging skill 19 times and a
brainstorming skill 4 times, and a Unity CLI skill once on its own (the integrator invoked it three more
times). Meanwhile the most expensive recurring mistakes were exactly what those skills guard against:
naming a cause before measuring it, presenting designs not checked against the process, and misusing
the Editor bridge.

## When to load which

| Moment | Skill |
|---|---|
| Before designing a capture or restore bucket, a wave plan, a data-name scheme, or any plan the integrator will approve | a brainstorming / design skill |
| Before proposing a fix for any bug, failed gate or unexpected log line | a systematic-debugging skill |
| Before Editor, bridge, package or build work | a Unity CLI / Editor skill |

In Claude Code these ship as, for example, the `superpowers` plugin's brainstorming and
systematic-debugging skills and the `unity:unity-cli` skill.

## A caveat on the Unity CLI

The `unity` command-line tool talks to a running Editor over its own channel, which needs an extra
Unity package (`com.unity.pipeline`). Without it, the CLI's status table is empty whether or not the
agent's Editor bridge is healthy. Do not read an empty table as "the Editor is down"; use the bridge's
own diagnostics for live state — see [[an-mcp-editor-bridge-compiles-every-call-never-during-play-mode]].
