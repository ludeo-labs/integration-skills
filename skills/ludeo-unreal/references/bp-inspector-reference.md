# BP Inspector — Report Field Reference

Companion to the command table in SKILL.md → Available Tools. This file documents the JSON shapes the inspector writes so report-consuming steps know what to expect.

## Invocation

**Invoke `RunBPInspector.bat` from PowerShell, not the Bash tool / `cmd.exe`.** Git Bash rewrites a `/Game/...` asset-path argument into a Windows path (`C:/Program Files/Git/Game/...`); the inspector can't resolve it and **silently falls back to a stale default BP**, so you get a clean-looking report for the wrong asset. See [[git-bash-expands-game-paths]] (its `MSYS_NO_PATHCONV=1` fix applies if you must go through Bash).

## `bp-inspection-report.json` (from `inspect`)

Per Blueprint:
- `path` — asset path (e.g., `/Game/Blueprints/BP_CharacterBase`)
- `parentClass` — native C++ parent (`Character`, `Pawn`, `GameModeBase`, etc.)
- `variables[]` — name, type, saveGame, replicated, defaultValue, propertyFlags
- `components[]` — componentName, componentClass, isRootComponent (plugin only)

## `bp-graph-report.json` (from `graph`)

Per Blueprint:
- `functions[]` — name, inputPins, outputPins, isCustomEvent
- `events[]` — name, isCustomEvent, eventClass
- `callGraphs{}` — keyed by function/event name, each is an ordered array of nodes: nodeName, nodeClass, nodeTitle, calledFunction, nodeIndex

## Other reports

- `path-inspection.json` (from `inspect-path`) — per-BP full dump: `parent`, `variables[]` (name/type/saveGame/default), `components[]`, `functions[]`, `events[]`. With `--resolve-inherited`, variables include base-class-declared entries.
- `level-inspection.json` (from `inspect-level`) — `level`, `totalActors`, `classHistogram` (sorted desc), `focusActors[]` (class, name, location, `bpProps` = BP-defined variables with current values).
- `func-sigs.json` (from `inspect-func-sigs`) — per-BP `functions[]` with `in`/`out` pin signature strings.

## Finding which widget shows an on-screen string (`.po` trick)

The inspector's commands are **forward-only** — they can't answer "what shows this text / what references this widget." To find the widget behind a string you see on screen, grep the exact text in the localization catalog `Content/Localization/<lang>/Game.po`; the entry's `SourceLocation` field names the owning widget's asset path (and any data-table source the string comes from). Far faster than booting the editor to hunt BP graphs.

## Known gaps / future enhancements

- **No reverse-reference lookup.** `graph-function` / `inspect-path` are forward-only; they can't answer "what CREATES or references this widget/asset." A reverse-reference command (UE `AssetRegistry.get_referencers`) would close this — until then, use the `.po` trick above for widgets, or the editor's Reference Viewer.
- **MCP tool wrapper** for structured tool calls instead of batch file invocation.
