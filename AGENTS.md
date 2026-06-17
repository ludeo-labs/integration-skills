# AGENTS.md — How to use the Ludeo Integration Skills

This file orients an AI coding agent. Read it first, then load the one skill that matches the project.

## What is Ludeo?

Ludeo turns gameplay moments into **playable highlights**: a Ludeo captures game state during play
(the *Creator* flow) and later restores that state so another player can drop straight into the moment
(the *Player* flow). Integration means wiring the **Ludeo SDK** into a game so it (a) captures the
right state and actions, and (b) can restore them.

Two SDK concepts you must get right before anything else — read these:

- [`shared/sdk-concepts/player-flow-is-snapshot-restore.md`](./shared/sdk-concepts/player-flow-is-snapshot-restore.md)
  — Player Flow is **snapshot-restore, not frame-by-frame replay**.
- [`shared/sdk-concepts/room-vs-highlight.md`](./shared/sdk-concepts/room-vs-highlight.md)
  — a **Room is not a Highlight**.

## Pick the right skill (engine detection)

Detect the engine from the project, in this priority order, then install + run that skill:

| If the project has… | Engine | Skill |
| --- | --- | --- |
| `*.uproject`, `Source/`, `*.Build.cs` | **Unreal Engine** | `ludeo-unreal-integration` |
| `Assets/`, `ProjectSettings/`, `Packages/manifest.json`, `*.unity`/`*.asmdef` | **Unity** | `ludeo-unity-integration` |
| Neither, but you're packaging a finished build to ship | — | `cloud-upload` |

If both Unreal and Unity markers somehow appear, ask the user which engine is authoritative — do not
guess. If neither appears and the task is integration (not upload), stop and tell the user no
supported engine was detected.

## Ground rules (engine-neutral)

**Never claim SDK behavior without checking documentation first.** Query the `sdk-docs` MCP server
(see [`.mcp.json`](./.mcp.json)) or the skill's bundled `references/`. If neither covers it, tell the
user what you're unsure about rather than guessing.
