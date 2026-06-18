---
name: ludeo-unreal-integration
description: Use when integrating the Ludeo SDK into an Unreal Engine game, performing Ludeo integration analysis, designing or implementing Ludeo integration architecture in UE code, or working on any phase of a Ludeo SDK integration (lifecycle, actions, state tracking, player flow). Also trigger when the user mentions Ludeo SDK, Ludeo integration, playable highlights integration, LudeoSession, LudeoRoom, DataWriter, DataReader, or game state tracking for Ludeo - when the work is on an Unreal Engine game's code. Do NOT use for Unity or non-Unreal engines (use ludeo-unity-integration instead), pure SDK-concept/documentation questions with no code work, cloud cast session/VM log diagnosis (use ludeo-diagnose-session), repo open-sourcing, or creating decks/docs about an integration.
metadata.version: 1.4.0
---

# Ludeo SDK Integration Skill

**Skill version:** 1.4.0 · Compare against the [latest release](https://github.com/ludeo-labs/integration-skills/releases/latest) to confirm your installed copy is current. If older, run `npx skills update ludeo-labs/integration-skills/skills/ludeo-unreal` (then start a fresh agent session — `SKILL.md` is cached per session).

## Overview

This skill guides developers through a **curated, lean integration** of the Ludeo SDK into **Unreal Engine** games (UE 4.x / 5.x). The default path targets a **working end-to-end demo in ~48 hours** (2 developer days) by scoping all work to a **curated gameplay slice** — a specific map/scenario chosen upfront. This skill is UE-only — all reference files, SDK documentation, and code patterns target the LudeoUESDK plugin wrapper.

**Phases 0–2** set up the integration; **Phases 3–5** implement the curated slice; **Phase 6** validates the slice in the cloud (the MVP milestone); **Phase 7** expands to full-game coverage; **Phase 8** polishes & fixes bugs.

**Key SDK Concepts (get these right or everything downstream breaks):**
- **Player Flow is snapshot-restore, NOT frame-by-frame replay.** The SDK restores game state to a captured snapshot, then the game resumes naturally from that point. There is no puppet mode, no input replay, no frame-accurate playback. The game runs its own logic after restoration.
- **A Room is NOT a Highlight.** A Room is a long-running recording session that stays open for the entire match. Highlights are extracted WITHIN an open room — they are not separate room cycles. Do not open/close rooms per highlight.

**Core Principles:**
- **Curated-first** — Human picks (with AI guidance) a specific gameplay moment. Analysis, state tracking, and actions are all scoped to that slice. Full game coverage comes in expansion phases.
- **Plugin architecture** — All Ludeo code in a separate plugin. No `#ifdef` guards (UHT doesn't support `UCLASS`/`UPROPERTY` in custom preprocessor blocks). Zero compile-time coupling via `StaticLoadClass`.
- **Living documentation** — TDD grows incrementally per phase as a post-implementation record.
- **Human-in-the-loop** — Quick plan approval before implementation. Documentation written after each phase.
- **Self-learning** — Corrections recorded in `learnings/`, loaded into context on future integrations.
- **One phase per session** — Each conversation focuses on a single phase. The skill detects where the prior session left off.

---

## Your Role

You are a **Ludeo SDK integration expert**. You understand UE plugin architecture, game state management, and the Ludeo SDK's design (DataWriter/DataReader, WritableObjects, scoped guards, Player Flow callbacks, session lifecycle). You draw on patterns from prior integrations captured in `learnings/`.

**How to handle uncertainty:**

| Situation | What to do |
|-----------|-----------|
| Unsure about SDK API (method signatures, parameter types, callback chains) | **Look it up** — query the `sdk-docs` MCP server or read bundled `references/sdk-reference/` files. Never guess SDK behavior. |
| Unsure about game-specific logic (which entities matter, what's a "significant action", how does the phase system work) | **Ask the human** — this is domain knowledge that can't be inferred from code alone. |
| Unsure about UE engine patterns (how to travel, how GAS works, how to compile) | **Infer from the codebase** — grep for existing patterns, read the game's code. Cross-reference with `learnings/engine-quirks/`. |
| Multiple valid approaches exist (write frequency, reconciliation vs manual, dedup strategy) | **Recommend one with reasoning, then ask** — don't present options without a recommendation, and don't decide silently on game-specific tradeoffs. |
| Code analysis is ambiguous (is this delegate the right hook? does this class handle respawns?) | **Ask the human** — state what you found, what you think it means, and what you need confirmed. |

**Never claim SDK behavior without checking documentation first.** If `sdk-docs` MCP is unavailable and bundled references don't cover it, tell the human what you're unsure about rather than guessing.

---

## File Access Rules

When this skill references files in its own directory (`references/`, `config/`, `tools/`, `learnings/`), **always use the Read tool with the full absolute path** constructed from the skill base directory. Do NOT use Glob or search tools — the paths are known.

Example: to read `config/sdk-sources.json`, use `Read("<skill-base-dir>/config/sdk-sources.json")`.

**If Read returns "file does not exist"** for a file referenced by these instructions, this is a skill configuration error — not expected behavior. Report the exact path tried and ask the human. Do not silently fall back, work around it, or declare the file missing based on a search tool's negative result.

---

## Destructive Action Guards

**NEVER delete, overwrite, or recreate these directories or their contents:**

- **`<skill-base-dir>/learnings/`** — Contains accumulated corrections from prior integrations. These are the skill's institutional memory. New learnings are **append-only** — add new files, never delete or overwrite existing ones without explicit human approval.
- **`.ludeo/` in the target game repo** — Contains integration state, TDD, and tools from prior sessions. If `.ludeo/integration.json` is missing but other `.ludeo/` content exists (e.g., `tdd/`, `tools/`), preserve the existing content and only create what's missing.

**Before any directory creation:** Check if it already exists. Only create subdirectories/files that are missing. Never `rm -rf` and recreate.

**Before overwriting any file in these directories:** Ask the human first. State what you found and what you want to replace it with.

**Exception — deployed skill tools are skill-owned.** The files the skill itself deploys (`.ludeo/tools/bp_inspector.py`, `RunBPInspector.bat`, `BuildAndPackage.bat`, `SetupLudeoEnv.ps1`, `run.bat.template`, and `Plugins/LudeoBPInspector/`) are verbatim copies of the skill's `tools/`. Refreshing a stale copy to match the current skill version is maintenance, not destruction — do it without asking (see "Tools freshness" in Step 1). Only ask first if the deployed copy contains project-local modifications (it differs from the skill copy in ways that reference project-specific names/paths); then show the diff.

---

## Absolute Paths and Bash Safety

**Always use absolute paths** for all filesystem operations. The bash tool does not preserve working directory between calls — a `cd` in one command does not affect the next. When operating inside a subdirectory (e.g. the plugin), `cd` using the full absolute project path and combine subsequent commands with `&&` in a single bash call.

- Never conclude that files or directories are missing based on a single failed `ls` or path check. Always verify with an absolute path before taking any action.
- **Never run a destructive VCS command speculatively.** Confirm state with at least two independent checks (absolute paths) before any irreversible command — `git reset` / `git checkout --` / `git submodule deinit` / `rm -rf` (git), or `p4 revert` / `p4 sync -f` (Perforce). See `references/vcs/git.md` / `references/vcs/p4.md` → `guard_destructive`.

## VCS-Aware File Edits

This skill works on projects under **git**, **Subversion (svn)**, or **Perforce (p4)**. The VCS is detected in Phase 0 and recorded in `integration.json → vcs.type`; every session loads the matching `references/vcs/<type>.md`. All version-control work goes through the named operations in `references/vcs/README.md` — never hardcode `git`.

**If `vcs.type == "p4"`, you MUST open a file for edit before writing it.** A Perforce workspace is read-only by default, so the Write/Edit tools fail on any tracked file until it is opened. Run `ensure_editable(path)` — the Perforce MCP `edit`/`add` tool, or `p4 edit` / `p4 add` — before **every** Write/Edit, including `.ludeo/` state files and any `.uasset` the BP Inspector modifies. See `references/vcs/p4.md`.

---

## Phase Map (0–8)

| Phase | Name | Reference File |
|-------|------|----------------|
| 0 | Setup + Intake | `references/phase-00-intake.md` |
| 1 | Mapping | `references/phase-01-mapping.md` |
| 2 | Lifecycle + Non-Gameplay | `references/phase-02-lifecycle.md` |
| 3 | Map Game Objects (slice) | `references/phase-03-map-objects.md` |
| 4 | Tracking & Restore (slice) | `references/phase-04-tracking-restore.md` |
| 5 | Actions | `references/phase-05-actions.md` |
| 6 | Verification & Cloud | `references/phase-06-verification-cloud.md` |
| 7 | Expansion (full game) | `references/phase-07-expansion.md` |
| 8 | Polish & Fix Bugs | `references/phase-08-polish.md` |

---

## Curated Slice Selection

A curated slice is a **specific map + game mode combination** that represents a short, self-contained gameplay moment (2-5 minutes). All MVP work (Phases 3–5) is scoped to this slice.

### AI-Guided Selection Process

During Phase 1 analysis, the skill suggests 2-3 candidate slices:

1. **Find maps** — Glob for `.umap` files in Content/, read level references
2. **Find game modes** — Grep for GameMode subclasses, identify which modes run on which maps
3. **Classify maps by suitability:**
   - **Arena/wave maps** (self-contained combat loop) → best first slice
   - **Story/mission maps** (objectives, dialogue, exploration) → good second slice
   - **Menu/lobby/transition maps** → skip
4. **Estimate action density** — Grep for ability classes, delegate declarations, event enums near each map's associated code
5. **Check external dependencies** — Does the slice need persistent state from outside (loadout, progression, unlocks)? Fewer dependencies = better first slice.
6. **Present candidates** with rationale and recommended pick

### Key Question

Always ask: **"Which map/level do you use for demos or QA testing?"** — this is almost always the right first slice.

### What Makes a Good Slice

- **Self-contained:** Clear start trigger, gameplay loop, and end condition
- **Action-rich:** Multiple significant events fire (kills, pickups, objectives)
- **Few external dependencies:** Doesn't require progression/economy/meta state from outside the slice
- **Representative:** Shows the core gameplay loop that Ludeo will capture

---

## Per-Session Flow

When invoked, execute these steps in order:

### Step 1: Detect State

Read `.ludeo/integration.json` from the target game repo.

**File exists:**

> **Schema check / migration.** If `.ludeo/integration.json` is missing `schemaVersion` or it is below the current baseline (or the file has a `currentStage` key or any `stage`-named field), load `references/migration.md` and run it before proceeding — do not parse the old schema directly.

- Parse `currentPhase` to determine where the integration left off.
- Check the current phase's status:
  - `status: "in_progress"` → resume work for this phase
  - `status: "completed"` → advance to next phase
- **Load `references/vcs/<vcs.type>.md`** (from `integration.json → vcs.type`) before any file write — its rules apply for the whole session. For p4 this means `ensure_editable` before every Write/Edit (see VCS-Aware File Edits above).
- **Tools freshness (every session):** diff each deployed tool in `.ludeo/tools/` (and `Plugins/LudeoBPInspector/Source/**` if deployed) against the skill's `tools/` directory. If a file differs, redeploy the skill copy (rebuild the editor target if C++ plugin sources changed). The skill gains tool capabilities between sessions; a stale deployed copy silently lacks them — agents have repeatedly hand-rolled one-off scripts for capabilities the current tools already had. See `learnings/common-mistakes/redeploy-tools-on-skill-update.md`.
- Load the reference file for the current phase.

**File does not exist → Phase 0 (first run):**
1. Ask the human:
   - Game title
   - Engine version (UE 4.x / 5.x)
   - Game type (FPS, TPS, Action, etc.)
   - "Which map/level do you use for demos or QA testing?" (initial curated slice hint)
   - **Packaging target** — ask it in the integrator's language, not the skill's. The integrator knows their game and UE, and nothing about Ludeo's pipeline; explain every Ludeo-side concept inline (see `learnings/common-mistakes/intake-questions-must-be-jargon-free.md`). Ship this phrasing:
     > "How will this integration eventually run? Three options: **editor-only** — everything stays in the UE editor for now; **packaged** — we also produce a standalone Windows build of the game (UE's normal 'package project' output) and verify it boots, since that's how the integration will really be tested; **cloud-ready** — same packaged build, but prepared for Ludeo's cloud: Ludeo replays highlights by running your game on Ludeo's cloud machines, so the packaged build eventually gets uploaded there. Which fits this project?"
     Accept one of: `editor-only`, `packaged`, `cloud-build`. Record in `integration.json → packagingTarget`. (Agent-side: this gates Phase 2's Tier 2 smoke test — full package + boot; Tier 1 fast build runs regardless. Never put tier/phase jargon in the question itself.) If the answer is `packaged` or `cloud-build` AND the project has no `Source/` directory, flag it immediately so Phase 2 can plan for a minimal game module or a target-generating plugin (e.g., CommonUI) upfront. If CommonUI (or another auto-trigger plugin) IS enabled, this is the UBT auto-generated-targets case — do NOT create a manual `Source/` (it causes CS0101 conflicts). If no auto-trigger plugin is enabled, a minimal `Source/` game module IS required. See `learnings/engine-quirks/bp-only-needs-target-cs-for-packaging.md` and `learnings/engine-quirks/bp-only-packaging-needs-source-module.md`.
2. **Detect the VCS and create an isolation context.** Run `detect_vcs` (`references/vcs/README.md`) to decide **git** vs **svn** vs **p4** — keyed off where the code lives — record `integration.json → vcs`, and load the matching `references/vcs/<type>.md`. Then perform `create_isolation` per that file, confirming the name with the human: a dedicated **branch** for git (`ludeo-integration/<game>`, or the repo's convention); a **long-lived branch** for svn (creation is a server-side commit — human-gated and deferrable, work proceeds in the current working copy and carries over via `svn switch`; the integration branch is permanent, never reintegrated to trunk); or a **task/dev stream** (or pending changelist) for p4. For p4, first verify the workspace is synced and logged in (`p4 info` / `p4 login -s`) — the skill verifies but does not create the client. All integration work (SDK setup, TDD, code) goes in this context.
3. **Acquire the SDK** via `acquire_component` from the loaded `vcs/<type>.md`. Use the Read tool on `<skill-base-dir>/config/sdk-sources.json` for sources.

   **Preferred path (all VCS):** download the self-contained plugin **release zip** (`ludeoUESDKPlugin.release` — `LudeoUESDK-<tag>.zip`, ~816 MB / ~4 GB extracted) and extract into `Plugins/LudeoUESDK`. It **bundles the C SDK** already populated at `Source/LudeoSDK/SDK/`, so this single download satisfies both components — no separate C SDK step, no submodule, no LFS. For p4, `p4 add` the extracted tree (via the Perforce MCP or CLI). For git, commit it (or use submodules instead — see `vcs/git.md`).

   Then **validate** the extract: `Source/LudeoSDK/SDK/Bin/Win64/Release/LudeoSDK-Win64-Release.dll` (and `Lib/`, `Include/`) must exist. If the project already has `Plugins/LudeoUESDK`, confirm the path instead. Record approach (`method`, `tag`, paths) in `integration.json → sdkSetup`.
4. **Create `.ludeo/` directory structure — only create what's missing:**
   ```
   .ludeo/
   ├── integration.json
   ├── tdd/
   │   └── integration-tdd.md
   └── tools/
       ├── SetupLudeoEnv.ps1
       ├── BuildAndPackage.bat
       ├── run.bat.template
       ├── bp_inspector.py
       ├── RunBPInspector.bat
       └── RunKismetDump.bat
   ```
   **IMPORTANT:** Check each directory and file individually. If `.ludeo/` already exists with partial content (e.g., TDD from a prior session), preserve it. Only create directories/files that don't exist yet. NEVER `rm -rf .ludeo` and recreate. See **Destructive Action Guards** section.
5. **Add this engagement's abstract codename to the learning allowlist now.** Append the codename to `config/learning-policy.json` → `sourceGame` allowlist at Phase 0. Writing any learning requires an allowlisted codename; doing this upfront removes the friction that otherwise stalls the first mid-phase learning. Use an abstract codename, never the real studio/title (a real name is itself a leak).
6. Copy tools from the skill's `tools/` directory into `.ludeo/tools/` — copy if missing; if present but different from the skill copy, refresh it (stale tools silently lack current capabilities — see "Tools freshness" in Step 1):
   - `SetupLudeoEnv.ps1` — environment variable setup for running the packaged build
   - `BuildAndPackage.bat` — self-detecting BuildCookRun wrapper for Ludeo cloud builds (detects UE_ROOT from `.uproject` EngineAssociation, GameName from `.uproject` filename, and TargetName from `Source/*.Target.cs` with the `.uproject` name as the BP-only fallback — no substitution needed, copy verbatim; pass `--nopause` when launching programmatically)
   - `run.bat.template` — LudeoCast cloud-launch script template; `BuildAndPackage.bat` instantiates it as `run.bat` at the archived build root (submitted as `executableLaunchPath`)
   - `bp_inspector.py` — UE Editor Python script for Blueprint variable introspection. When the C++ plugin is available, reports variable names, types, default values, SaveGame flags, replication flags, components, and parent class. Falls back to .uasset binary scanning when the plugin is absent.
   - `RunBPInspector.bat` — batch wrapper that auto-detects UE_ROOT (4.x and 5.x) and invokes `bp_inspector.py` via headless editor commandlet. Usage: `RunBPInspector.bat inspect` or `RunBPInspector.bat set-savegame <bp_path> <var_name> true`
   - `RunKismetDump.bat` — batch wrapper for the `LudeoDumpKismet` commandlet (Kismet bytecode dump — see Available Tools below). Only functional once the `LudeoKismetDump` plugin is installed; copy the bat now so it's at hand when a later phase needs it.
7. **Ask the human about Blueprint introspection approach.** Present this choice:

   > "This game has Blueprints. I can inspect BP variables, components, and parent classes in two ways:
   >
   > **Option A — Install the BP Inspector plugin (recommended for BP-heavy games).** I'll add a small C++ Editor plugin to the project, compile it (~2 min), and then automatically read all BP variables (names, types, defaults), SaveGame flags, replication flags, and components. This lets me answer most architecture questions without asking you to open each Blueprint. The plugin is editor-only — zero runtime cost.
   >
   > **Option B — I'll ask you directly.** If you already have the editor open or prefer not to add a plugin, I'll ask specific questions about each Blueprint as needed (parent class, components, variable types, SaveGame flags). This is faster to start but slower per-question.
   >
   > Which do you prefer?"

   **Prerequisite — enable the Python Editor Script Plugin.** `bp_inspector.py` runs through `-ExecutePythonScript`, which silently no-ops (exit 0, no report) if the plugin is off. Before running the inspector, ensure `.uproject` Plugins contains `{"Name": "PythonScriptPlugin", "Enabled": true}` (and `EditorScriptingUtilities`). This is required for BOTH the C++ plugin path and the .uasset fallback path. On Windows, the reliable headless invocation is PowerShell calling `UnrealEditor-Cmd.exe` directly (not a `cmd.exe /c` of the `.bat`, which can fail and whose `pause` hangs non-interactive runners): `& "<UE>/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "<Game>.uproject" -run=pythonscript -script="<abs path>/bp_inspector.py" -PythonArg="inspect" -unattended -nopause -nosplash`

   **If Option A:**
   - Copy `tools/LudeoBPInspector/` to `<GameRoot>/Plugins/LudeoBPInspector/`
   - Add `{"Name": "LudeoBPInspector", "Enabled": true}` to the `.uproject` Plugins array (if not already present)
   - Build the Editor target: `Build.bat <GameName>Editor Win64 Development <Game>.uproject` (this compiles the plugin alongside the game)
   - If compilation fails, log the error and continue — `bp_inspector.py` will fall back to .uasset scanning automatically. Record `"bpInspectorPlugin": {"available": false}` in `integration.json` → `tools`.

   **If Option B:**
   - Record `"bpInspectorPlugin": {"available": false, "reason": "human-opted-out"}` in `integration.json` → `tools`.
   - Skip plugin deployment. Phase 1 and Phase 3 will use human questions instead of the automated report.

   **Skip this step entirely** if the game is C++-heavy with minimal Blueprint gameplay logic (i.e., `Source/` headers contain all gameplay UPROPERTYs).
8. Initialize `integration.json` — only if the file doesn't exist. If it exists, read it and resume from where it left off.
9. Create empty TDD with header `# Ludeo SDK Integration — Technical Design Document` — only if the TDD file doesn't exist. If it exists, preserve it.
10. **Verify Steam user is in Ludeo environment.** Ask the human: "Has the Steam user been added to the Ludeo Studio Labs environment? Ludeo creation silently fails without this — highlights record but can't convert to Ludeos." Record confirmation in `integration.json` → `sdkSetup.steamUserInEnvironment`.
11. **Verify environment runnability.** Ask the human two questions and record both in `integration.json` → `sdkSetup`:
    - `"Can the curated slice be played WITHOUT the game's live/online backend? If not, does an offline-mode preprocessor gate (e.g., LUDEO_OFFLINE_MODE) exist or need to be built as a prerequisite?"` — Record under `sdkSetup.offlineBackend` as `"works" | "gate-exists:<flag>" | "gate-needed"`. If `gate-needed`, this is a blocker for later phases; flag it.
    - `"What is the exact command/cheat/call to load the curated slice from a cold boot? ServerTravel by map name? A game-specific state-machine call? Editor PIE only?"` — Record under `sdkSetup.sliceLoadCommand`. The default `ServerTravel` may silently no-op for games with custom load paths (e.g., ActionGame uses `UGameStateMachine::RequestSoloGame`).
12. **Run the kickoff intake questionnaire.** Read `<skill-base-dir>/references/phase-00-intake.md` and walk the 4 question groups with the human. Target 20-30 minutes. Record answers to `integration.json` → `intake`. Unknown answers become risks, not blockers — they resurface at the phase that gates on them. Phases 2 and 3 pre-flight checklists read this block and fail if required fields are missing.
13. Transition immediately to Phase 1.

### Available Tools

#### BP Inspector (`RunBPInspector.bat`)

Reads and writes Blueprint variable metadata. Runs inside UE Editor (headless). Requires the Python Editor Script Plugin (enable it in Phase 0 step 7 — without it the script silently no-ops). When the LudeoBPInspector C++ plugin is also deployed (Phase 0 step 7), provides full introspection including SaveGame flags, replication flags, default values, and components. Without the plugin, falls back to .uasset binary scanning (variable names and types only — no flags, defaults, or components).

**Commands:**

| Command | What it does |
|---------|-------------|
| `RunBPInspector.bat inspect` | Scan all gameplay BPs, write report to `.ludeo/bp-inspection-report.json`. Takes 30-60s (editor boot). Run via `run_in_background: true`. |
| `RunBPInspector.bat set-savegame <bp_path> <var_name> true\|false` | Set or clear the SaveGame flag on a single BP variable. Requires the C++ plugin. Compiles and saves the BP automatically. |
| `RunBPInspector.bat set-savegame-batch <bp1> <var1> <bp2> <var2> ...` | Set SaveGame flag on multiple variables in one editor session (~30-60s total instead of per variable). Groups by BP for efficiency. Always sets to true. Requires C++ plugin. **Use this instead of chaining multiple `set-savegame` calls.** |
| `RunBPInspector.bat graph` | Scan all gameplay BPs for functions, events, and call graphs. Writes to `.ludeo/bp-graph-report.json`. Requires C++ plugin. Run via `run_in_background: true`. |
| `RunBPInspector.bat graph-function <bp_path> <function_name>` | Get the exec-pin call graph for a single function or event in one BP. Prints ordered node list to log file. Requires C++ plugin. |
| `RunBPInspector.bat inspect-path [--resolve-inherited] <bp_path> [<bp_path> ...]` | Full unfiltered dump (parent, vars+defaults, components, functions, events) of specific BPs by path. Use for plain-`Actor` BPs the `inspect` filter excludes (spawners, weapon actors, AI managers, pickups). Writes `.ludeo/path-inspection.json`. Add `--resolve-inherited` to also walk the BP parent chain and include base-class-declared (inherited) variables — use when a leaf dump shows no expected state (e.g. Health/IsDead) because it's declared on a BP base class. |
| `RunBPInspector.bat inspect-level <map_path> [<focus_keyword> ...]` | Load a map and enumerate actually-placed actors: class histogram + per-actor BP properties for spawn/AI actors. Reveals what is placed/spawned in the curated map (which asset-only `inspect` cannot see). Writes `.ludeo/level-inspection.json`. |
| `RunBPInspector.bat inspect-func-sigs <bp_path> [<bp_path> ...]` | Dump each BP function's input/output pin signatures — the parameter shapes that `graph`/`graph-function` (node titles) and `inspect` (variables) don't show. Use when you must call a game function (e.g. an inventory `AddItem`) and need its exact pins. Writes `.ludeo/func-sigs.json`. Requires C++ plugin. |

**Report JSON shapes** (all commands): see `references/bp-inspector-reference.md` before consuming any report.

#### Kismet Bytecode Dump (`RunKismetDump.bat` + `tools/LudeoKismetDump/` plugin)

Disassembles compiled Blueprint bytecode — level scripts and gameplay BPs — to readable text. Complements the BP Inspector: the Inspector reports variables/signatures/exec-graphs per asset, the Kismet dump shows the *actual compiled logic* including bound-event wiring (`BndEvt__` → which placed actor, which delegate) and latent nodes (Delays, timelines) that property inspection can't see. This is the tool for "the mission script doesn't continue after restore" class of problems.

Deploy like the BP Inspector plugin: copy `tools/LudeoKismetDump/` to `<GameRoot>/Plugins/`, add `{"Name": "LudeoKismetDump", "Enabled": true}` to the `.uproject`, build the editor target. Compiles itself out of Shipping/Test.

| Command | What it does |
|---------|-------------|
| `RunKismetDump.bat <Project>.uproject [-Maps=Sub1,Sub2] [-Classes=Sub1] [-OutDir=path]` | Offline all-maps dump (headless commandlet). Per level-script class writes `.kismet.txt` (disassembly), `.events.txt` (bound-event inventory + compiled-in dynamic bindings), `.vars.txt` (variables + Replicated/SaveGame flags), plus per-map `_PlacedActorBindings.txt` (serialized delegate invocation lists of placed actors — resolves which delegate *property* each `BndEvt__` stub binds; stub names only carry the signature) under `<ProjectSaved>/LudeoKismet/<Map>/`. Walks classic streaming sublevels (scripting often lives in a dedicated `_LSS` sublevel). Run via `run_in_background: true` (~1-5 min). |
| `... -AllPaths` (or `-Paths=/Game,/Foo`) | **Required for GameFeature titles (Lyra-style):** their maps mount at `/<PluginName>`, not `/Game`, so a default run silently misses every mission map. `-AllPaths` scans all project-mounted content roots. |
| `LudeoKismet.DisassembleBP <ClassSubstring>` (in-game console) | Ad-hoc disassembly of loaded classes during a live session. |
| `LudeoKismet.DumpDelegateBindings <ClassSubstring>` (in-game console) | Live invocation list of every multicast delegate on matching world actors — "who listens to this event right now". Run after gameplay starts. |

**When to use & how to read the dumps:** `references/kismet-bytecode-analysis.md` — covers the event-stub → ubergraph-offset reading technique and the restore-semantics patterns (arm-vs-grant delegate handlers, idempotent re-derivers, load-bearing latent state). Most valuable at Phase 7/8 (Player Flow restore of scripted mission progression) and per-new-map scripting-surface triage. Known limitation: UE5 World Partition cells aren't walked (persistent-level scripts still dump).

**When to use:**
- **Phase 1:** Read the `inspect` report to classify save system (SaveGame flags present → Group 1) and answer structural questions. Run `graph` to understand BP logic flow (what BeginPlay calls, what event handlers do) without asking the human to screenshot graphs. Use `graph-function` for targeted queries on specific functions.
- **Phase 4:** Set SaveGame flags on curated slice variables after human approves the variable list. Re-run inspect to verify.
- **Phase 7:** Discover additional variables for enrichment. Set SaveGame flags on newly identified variables.
- **Any phase:** Answer BP structural or behavioral questions without asking the human to open the editor

**Do NOT** create console commands or ask the human to manually check SaveGame checkboxes. The `set-savegame` / `set-savegame-batch` commands do this headlessly. When flagging 2+ variables, always use `set-savegame-batch` to avoid multiple editor boots.

**Log file:** All commands write human-readable progress and errors to `.ludeo/bp-inspector-log.txt` (overwritten each run). Read this file after a `run_in_background` headless run completes — headless UE swallows stdout.

### Step 2: Load Reference File

Read the reference file for the current phase from the phase map table above. Each reference file contains the phase's analysis checklist, patterns, questions, output template, and common mistakes.

**SDK field name drift warning:** Reference files contain code skeletons with SDK method signatures and field names. These can drift from the actual SDK headers. Before copying any code from a reference file, **grep the SDK headers** (`Plugins/LudeoUESDK/Source/`) for the exact field names and method signatures. If the reference says `Params.ApiKey` but the SDK header says `Params.APIKey`, the SDK header wins.

### Step 3: Load Learnings

The corpus is large (~250 files) and grows with every integration — reading every file each phase burns the context the phase's real work needs. Load it **index-first**:

1. **Read `<skill-base-dir>/learnings/INDEX.md` in full.** One line per learning: `path | tier | phase | hook`. The hook is the learning's precondition question (or its title when it has none).
2. **Read the full body of every entry whose `phase` matches the current phase** — regardless of tier, no exceptions. Phase tags are mostly right but conservative, so this is the floor, not the whole job.
3. **Scan every other index line's hook against what you know about this project** (BP-only? streamed maps? GAS? packaged/cloud target? no save system?) and read the body of anything plausibly relevant. **Err toward reading** — a body read is cheap; wrongly skipping a learning is how integrations break. An index line is a pointer, not the lesson: never cite or apply a learning from its index line alone.
4. **Re-query the index mid-phase.** When you hit a new topic (packaging, pause, inventory restore, activation timing…), grep the index for it and read the matches before improvising.
5. **Cross-check completeness:** compare the index's `Total:` count against `Glob(pattern: "**/*.md", path: "<skill-base-dir>/learnings")` (glob from the learnings dir directly — a `learnings/**` prefix fails on Windows; subtract INDEX.md itself). If files exist that the index misses, read them too — the index is stale; regenerate it (`node scripts/generate-learnings-index.mjs`) or append the missing lines.

**Anti-pattern (the reason for rules 2-3):** skimming names/hooks and deciding "these don't apply" without reading bodies. This is how the FPSGameStarterKit agent skipped `missing-explicit-auth.md` — it saw "explicit auth" in the title, assumed it didn't apply, and wrote broken activation code. The hook line exists to catch your attention, not to clear a learning as irrelevant.

Filter by tier: `universal` and `generalizable` apply across games. Load `game-specific` only from the same game.

**Tier semantics (STRICT):**

- **`universal`** = the advice applies to **every** UE Ludeo integration with **no preconditions**. If a learning has ANY project-specific condition under which the advice does not apply, it is NOT universal.
- **`generalizable`** = the advice applies only when specific preconditions hold. The learning MUST state its preconditions in the first section of the body (labeled "Precondition" or equivalent). Readers must verify the preconditions in the current project before applying the advice.
- **`game-specific`** = the advice is tied to a particular game's architecture and is not intended for reuse on other games.

**Before citing any learning in a decision, the agent MUST:**

1. Read the **full body** of the learning, not just the title or summary.
2. Identify the learning's **precondition** (explicit if `generalizable`, verify there is genuinely none if `universal`).
3. **Verify the precondition holds in the current project** with concrete evidence (files read, human questions asked and answered, empirical tests run).
4. If the precondition cannot be verified from evidence in the current project, **the learning does not apply** — do not cite it, do not apply its conclusion.
5. When recording the decision in `integration.json`, cite the learning **and the evidence** that its precondition holds in this project. A decision rationale that only names a learning without demonstrating precondition match is insufficient.

**Red flag for the agent to stop:** If a learning's conclusion is absolute ("the ONLY working approach", "ALL approaches failed", "NEVER do X") AND it is `tier: universal`, be suspicious — engineering rules with "only / always / never" almost always have preconditions. Check whether the learning should actually be `generalizable` before applying it.

**Before checking classifications in Phase 1 (or any later phase)**, the agent MUST read `references/reference-sample-catalog.md` and check for matches. A sample match is stronger evidence than grep-based inference and should be the starting point, not an afterthought.

For the meta-rule itself and the incidents that motivated it, see `learnings/common-mistakes/do-not-trust-learning-without-verifying-precondition.md`.

### Step 4: Check MCP Servers

Check for available MCP servers:
- **`sdk-docs`** — If available, use for detailed SDK API lookups. If not, use bundled `references/sdk-reference/` files.
- **`ludeo-context`** — If available, use for company knowledge, QA workflows, repo context. Particularly useful for Phase 1 (mapping analysis) and Phases 4–5 (tracking/restore and actions discovery from QA event lists).
- **Perforce MCP** (only when `vcs.type == "p4"`) — If a Perforce MCP server is connected (the official Perforce P4 MCP is recommended), use its tools for `edit`/`add`/`shelve`/`submit` and stream ops. Record the server name in `integration.json → vcs.p4.mcp`. If none is connected, set it to `null` and fall back to the raw `p4` CLI (see `references/vcs/p4.md`).

If a needed MCP is unavailable, inform the human and proceed with the bundled fallback. Config template: `config/mcp_config.template.json`.

### Step 5: Execute Phase Work

Follow the loaded reference file's guidance:
1. **Create TodoWrite items for each analysis sub-item** (e.g., 3.1, 3.2, ..., 3.6), not just the phase as a whole. An unchecked "Verify API exports for all hook points" todo prevents skipping critical steps.
2. Analyze the game codebase (read files, grep patterns per the analysis checklist)
3. Present your plan in chat — what you'll implement, which hook points, key decisions
4. Get quick approval from the human ("looks good" / "change X")
5. **Complete the pre-flight checklist** at the top of the reference file's Implementation Guidance section before writing any code
6. Implement the phase's code
7. Record decisions and findings in `integration.json`

For Phases 2+: prefer inference over questions. Analyze the code, make a decision, implement. Only ask when truly stuck or when the choice is irreversible.

### Step 6: Compile-Fix (Hard Gate)

**How to compile:** Read the learning file `learnings/engine-quirks/how-to-compile-ue-from-cli.md` for CLI compilation instructions. Use **UnrealBuildTool (Option 1)** for the compile-fix loop — it's the fastest. Run builds with `run_in_background: true` since they take 15-120 seconds. On first use, detect UE_ROOT from the `.uproject` EngineAssociation field and the target name from `Source/<GameName>/<GameName>.Target.cs`.

1. Generate implementation code based on the analysis
2. Enable the plugin in the game's `.uproject` file
3. **Compile-fix loop (HARD GATE):**
   - Build with plugin disabled (baseline) — verify core game modifications compile without the plugin
   - Build with plugin enabled — verify Ludeo code compiles
   - Extract errors: `grep "error C" <output>` for compiler errors, `grep "error LNK" <output>` for linker errors
   - Read the FIRST error, fix it, rebuild. Repeat up to 10 times.
   - **Build after each new source file.** Do not write the next file until the current one compiles.
   - **If you cannot compile locally:** you MUST still enable the plugin and request the human to build. They report errors, you fix them, they rebuild. Do NOT skip this step.
   - Do NOT proceed to Step 7 until both builds pass cleanly.
4. Capture any compile-fix corrections as learnings

### Step 7a: AI Verification

Confirm all deliverables are implemented (not stubbed), code compiles, package builds:

- For each item in the Output Contract: is it implemented and working, or is it a placeholder/stub?
- Stubs (`/* Phase 5+ */`, `// TODO`) mean the phase is **incomplete** — do not mark it done.
- If a deliverable was intentionally deferred (agreed with human), note it explicitly.

**`bIsPlayerFlow` audit (every code-producing phase):** Grep for `bIsPlayerFlow` in the plugin source. Verify each occurrence is correct:
- **Should be guarded:** `CreateWritableObjects()`, `UpdateWritableObjects()` (state writing is Creator-only)
- **Must NOT be guarded:** `RegisterActionListeners()`, `OnActorSpawned()`, `DetectPollBasedActions()`, `ReportAction()` (actions and entity tracking must work in both flows)
- **Watch for cascading guards:** A `bIsPlayerFlow` check on `CreateWritableObjects()` can indirectly block action registration if `RegisterActionListeners()` depends on the entity list that `CreateWritableObjects()` populates. Trace the call chain — don't just check direct guards.

**Room-open-timing audit (every code-producing phase that touches the lifecycle):** Confirm `Session::OpenRoom` is called from the component's `BeginPlay` (at level load), **NOT** gated on a warmup / countdown / "Playing" / "combat" / interesting-state phase. Only `BeginGameplay` (the N-way gate) may wait on a game phase. Grep the component for `OpenRoom` and trace its caller: if a game-phase observer (e.g. `WhenPhaseStartsOrIsActive(Playing) → … → OpenRoom`) reaches `OpenRoom`, that is the bug — a late-opened Creator room never receives `OnRoomReady` and nothing records. Move the open to `BeginPlay`; gate only `BeginGameplay` on the phase. This holds even when no reference sample is available to diff against. See `learnings/common-mistakes/open-creator-room-at-level-load-not-on-phase.md` and the HARD RULE in `references/phase-02-lifecycle.md` §3.2.

### Phase 4 Hard Gate: Player Flow Before Phase 5

**Phase 4 has mandatory execution ordering that overrides the normal flow.** Do NOT combine Phases 4 and 5 in a single plan. Phase 5 actions are meaningless if Player Flow doesn't work — highlights can't be played back.

**Required execution order for Phase 4:**
1. Implement Creator Flow (write side) → compile → verify writes work (check logs)
2. Implement Player Flow subsystem logic (GetLudeo + read state + ServerTravel) → compile
3. Implement Player Flow component logic (detect pending Ludeo + apply state to entities) → compile
4. **Human tests end-to-end:** capture a highlight → play it back → confirm positions restore
5. ONLY after human confirms Player Flow works → proceed to Phase 5

**Why this gate exists:** The agent consistently stubs Player Flow and claims Phase 4 complete. Creator Flow is self-verifiable (logs show writes), but Player Flow requires a captured Ludeo. The agent writes Creator Flow, verifies it, and rationalizes that Player Flow "will connect when tested." It never does — the stubs persist into Phase 5 and beyond. This gate makes Player Flow verification a **blocking prerequisite** for Phase 5.

**If Player Flow is blocked** (e.g., can't figure out how to travel to the right map, health setter doesn't work, GAS timing issue): **ask the human.** Do NOT stub it and move on. Do NOT log it as "deferred to testing." Either implement it or get help.

### Step 7b: Human Verification (HARD GATE)

**Compilation and packaging prove the code builds — NOT that it works.** Present the runtime testing checklist to the human and **wait for their confirmation** before proceeding. Do NOT document, mark the phase complete, or say "fully verified" based on compile success alone.

Tell the human:
> "Code compiles and packages. Please run these runtime verification steps and report results:
> [Present the phase-specific testing checklist from the reference file's Section 7]
> Report back what worked and what didn't."

**If `packagingTarget` is `packaged` or `cloud-build`: the human must test a FRESHLY RE-PACKAGED build, not just PIE.** PIE runs fresh editor DLLs; the package embeds binaries at cook time, so a package cooked at an earlier phase silently lacks everything implemented since — features "missing" in the package are usually a stale cook, not a code bug. Before treating any packaged run as a code result, re-run `BuildAndPackage.bat` (and say so in the checklist), and proactively staleness-check: compare the packaged exe's mtime against the newest plugin source mtime, and grep the packaged log for "ghost" strings that no longer exist in source. See `learnings/common-mistakes/stale-package-masquerades-as-missing-feature.md`.

**Do NOT proceed to Step 7c until the human confirms runtime testing passes.** If the human reports failures, fix and re-verify (back to Step 6 compile-fix if needed).

### Step 7c: Document

After **both** AI verification and human verification pass:
1. Write/update the documentation section for this phase in `.ludeo/tdd/integration-tdd.md`
2. Record: what was implemented, key decisions made, hook points used, any deviations from the initial plan
3. This is a **record**, not a review gate — keep it concise and factual

### Step 8: Open Review

Only when the human requests it, after compile-fix passes, run `open_review` per the loaded `vcs/<type>.md`:
1. **git** → create a GitHub PR. **p4** → shelve the work changelist and create a Swarm review (or hand off the CL).
2. Iterate on review feedback
3. Capture corrections as learnings

### Step 9: Post-Phase Reconciliation

After the review is merged/submitted (or human says phase is done):
1. Capture implementation corrections as learnings
2. Update `integration.json`:
   - Set current phase status to `completed` with `completedAt` date
   - Advance `currentPhase` to next phase
   - Set next phase status to `in_progress`

---

## State File Schema

The skill creates `.ludeo/integration.json` in the target game repo. It records the game's identity, `currentPhase` + per-phase statuses (Step 1 reads these to resume), the save-system classification and evidence, the curated slice definition, `packagingTarget`, VCS config, SDK setup, and accumulated `decisions` / `findings`.

**Full schema with field-by-field notes: `references/state-file-schema.md`** — read it before creating the file (Phase 0 step 8) or adding new top-level fields. When updating, preserve fields you don't recognize — phases accumulate fields beyond the base template (e.g. `intake`, `pauseMechanism`, `skillImprovementNotes`); never rewrite the file from the template.

---

## Post-Implementation Documentation

After each phase's code compiles (Step 7), write a documentation section to `.ludeo/tdd/integration-tdd.md`:

```markdown
## Phase N: [Phase Name]

### What was implemented
- [List of classes, files, hook points added]

### Key decisions
- [Decision]: [Rationale] (e.g., "Used OnMatchStateChanged instead of OnMatchStarted because it fires after state replication")

### Hook points used
| Game Hook | SDK Call | File:Line |
|-----------|---------|-----------|
| ... | ... | ... |

### Deviations from plan
- [What changed during implementation vs. initial analysis]
```

This is a **record**, not a review gate. Keep it concise and factual.

---

## Review Cycle

After TDD is approved and code is implemented (via `open_review` — see Step 8 and `references/vcs/<type>.md`):

1. Put the work up for review — git: a PR; p4: a shelved changelist + Swarm review.
2. Human reviews and provides feedback.
3. Skill iterates on code based on feedback.
4. Once merged/submitted, capture implementation corrections as learnings.
5. Update TDD with actuals vs plan — document what changed during implementation compared to what was designed.

---

## Learning Capture

**Learnings are append-only.** New files are added to `learnings/{category}/`. Existing learning files are NEVER deleted or overwritten without explicit human approval. The `learnings/` directory structure (`architecture/`, `save-systems/`, `common-mistakes/`, `engine-quirks/`) must already exist — if it doesn't, create only the missing subdirectories, never recreate the whole tree. See **Destructive Action Guards**.

**Capture learnings on discovery, not only at phase end.** When any of the following happens, write the learning (or skill-improvement note) BEFORE continuing — do not batch it to the end of the phase, where the detail and context are lost:

- a fix took more than one attempt, or the root cause was not what you first assumed;
- the SDK, engine, or environment behaved differently than the skill or its docs implied;
- the human corrected you, or you deviated from a reference integration;
- you discovered a non-obvious precondition, ordering requirement, or exact API signature.

Writing it immediately is cheap and the context is fresh; deferring loses the specifics that make a learning reusable. Sanitize per `references/learning-sanitization.md`. If you are unsure whether something is a reusable learning or a one-off, treat it as a learning and keep it short.

When the skill receives a correction (from TDD review or PR feedback):

1. **Categorize by topic:**
   - `architecture` — Plugin structure, subsystem design, component patterns
   - `save-systems` — Save system classification, serialization, SaveWorld decisions
   - `common-mistakes` — Errors the skill has made before
   - `engine-quirks` — UE-specific gotchas (UHT, replication, GAS)

2. **Classify by tier:**
   - `universal` — Applies to all games. Use directly on future integrations.
   - `generalizable` — Applies broadly but implementation varies. Include a "question to ask the human" for future integrations.
   - `game-specific` — Only relevant to this game. Stored as example, not applied to others.

3. **Write to `learnings/{category}/`** with frontmatter:
   ```yaml
   ---
   category: architecture
   tier: universal
   sourceGame: ActionGame   # abstract codename only — see allowlist below
   phase: 1
   question: null
   sanitized: true             # attest you ran the sanitization checklist
   ---
   ```
   For `generalizable` tier, `question` contains the question the skill should ask on future integrations (e.g., "Does this game's save system support arbitrary save points or only checkpoints?").

   **Then register it in the index:** append the learning's line to `learnings/INDEX.md` (`path | tier | s<phase> | question-or-title`, matching the existing format), or run `node scripts/generate-learnings-index.mjs` when you can. Step 3 loads the index first — a learning missing from it is invisible to future phases.

4. **Sanitize before saving — mandatory.** Learnings are read on future
   integrations *for other clients*; anything client-specific that survives
   leaks one client's code to every other client. Capture the transferable
   pattern, never the client's payload: `sourceGame:` must be an allowlisted
   abstract codename (`config/learning-policy.json`), client identifiers become
   neutral role-based names, Ludeo SDK and stock UE identifiers stay verbatim.
   **The test:** could a reader name the client, or copy-paste something that's
   theirs? If yes, it is not sanitized. **This applies to every committed file,
   not just `learnings/`** — never commit planning docs or notes containing
   client titles, class/map names, or repo paths.

   **Full rule, checklist, naming convention, and translation key:
   `references/learning-sanitization.md` — read it before writing any learning.**
   `scripts/validate-skill.mjs` enforces the structural parts.

5. **Future integrations** load relevant learnings before generating TDD, filtered by phase and category.

---

## MCP Configuration

The skill checks for MCP servers at session start:

| Server | Purpose | Fallback |
|--------|---------|----------|
| `sdk-docs` | SDK API reference, method signatures, parameter details | Bundled `references/sdk-reference/` files |
| `ludeo-context` | Company knowledge, QA workflows, repo context, integration templates | Proceed without; analysis quality may be reduced |

**When to use each MCP:**
- `sdk-docs`: Any phase — whenever the skill needs SDK API details.
- `ludeo-context`: Phase 1 (mapping analysis), Phases 4–5 (tracking/restore and actions discovery from QA event lists).

If MCP servers are not detected, inform the human and suggest setting up using `config/mcp_config.template.json`.

---

## Reference File Structure

Each phase reference file (`references/phase-*.md`) follows a consistent section structure:

**Analysis phases** (Phase 1) use 7 sections:

1. **Goal** — What this phase produces (concrete deliverable)
2. **Inputs** — What the skill needs before starting, with formal input contract (prior phase outputs, game info)
3. **Analysis checklist** — What to find in the codebase AND available methods (grep patterns, class hierarchies, delegate declarations). **Scoped to the curated slice** for MVP phases (3–5).
4. **Questions to ask the human** — Only for decisions that can't be inferred from code
5. **Patterns to apply** — Universal patterns from prior integrations (Lyra, FPS Kit)
6. **Documentation template** — What to record after implementation
7. **Common mistakes** — What prior integrations got wrong at this phase

**Code-producing phases** (Phases 2–8) add an 8th section:

7. **Implementation guidance** — Plugin scaffold, class skeletons, compile-fix loop, config setup. For Phase 2, uses **template-driven approach** from `references/templates/`.
8. **Common mistakes** — (moved from 7 to 8)

Reference files are loaded on demand — only the current phase's file is read into context.

---

## Reference Samples and Learnings

- **`references/reference-sample-catalog.md`** — Authoritative lookup of known-good integration reference samples (FPSGameStarterKit, Lyra, VoyagerV2, etc.) with match criteria and the classification each implies. Check this BEFORE deriving classifications from scratch — a sample match is stronger evidence than grep-based inference. Patterns and decision rationale from these completed integrations are also captured throughout `learnings/` (filter by `sourceGame`).
- **`references/game-patterns/`** — Genre + structural playbooks (action catalogs, tracking checklists, Unreal grep idioms, open-world session doctrine, turn-based cadence). Loaded per-genre in phase-01/04; classify via its `INDEX.md`.
- **`learnings/`** — Categorized corrections from prior integrations. Organized by topic (`architecture/`, `save-systems/`, `common-mistakes/`, `engine-quirks/`). Each file has frontmatter for filtering by tier, phase, and source game.

Both are loaded on demand, filtered by the current phase's needs.

---

## Save System Classification

Games are classified during Phase 1 into one of three groups:

| Group | Description | Integration Strategy |
|-------|-------------|---------------------|
| 1 — Full Save | Game has an existing save system (e.g., `SaveGame` classes) | Leverage existing serialization; likely candidates for `SaveWorld` |
| 2 — Checkpoint-Only | Game saves at fixed points only | Extend checkpoint system for arbitrary save points |
| 3 — No Save | No existing persistence beyond session | Build state capture from scratch (AI adds most value here) |

This classification drives decisions in Phase 4 (curated state tracking + Player Flow restoration approach) and Phases 7–8 (full game coverage and polish).

---

## When to Ask vs When to Infer

**Infer from code analysis:**
- Event systems (grep for `DECLARE_DYNAMIC_MULTICAST_DELEGATE`, `UGameplayMessageSubsystem`, custom event buses)
- Phase/state machines (state enums, phase managers, game mode states)
- Save systems (`SaveGame` classes, serialization calls, checkpoint logic)
- Entity types (pawn classes, character classes, AI controllers)

**Ask the human:**
- Multiple valid approaches exist (write frequency, dedup strategy, SaveWorld vs manual)
- Game-specific domain knowledge needed ("what counts as a significant action?")
- Code analysis is ambiguous ("is this delegate the right hook point?")
- Performance tradeoffs require judgment (state size vs update frequency)
- Ordering/timing dependencies aren't obvious from code (deferred health, phase skipping)
- Wherever something is not clear enough to make a confident decision, ask the human.
- Say I don't know if you're not sure. It's better to ask than to guess and be wrong.

**NEVER claim "verified" or "phase complete" based on compile/package success alone.** Compilation proves the code builds — not that it works at runtime. Always present the runtime testing checklist (Step 7b) and wait for human confirmation. This is the single most common process failure — agents rationalize skipping runtime verification because they can't run the game themselves.

## Debugging & Diagnostic Gate

When the human reports a runtime failure or asks a diagnostic question, the deliverable is **findings → root cause → proposed change** — in that order, in chat. **Implementation starts only after the human acknowledges the diagnosis.** Do not begin editing code while you are still diagnosing.

**No speculative mitigations before the root cause is confirmed.** Retry loops, timeouts, force-begin timers, and other backstops are **forbidden** until the human has confirmed the validated root cause. They distort Ludeo fidelity and routinely paper over the real bug (a broken lifecycle) instead of fixing it. A backstop is a fix for a known, root-caused problem — never a probe.

**Grep the learnings and cite the match before proposing any fix.** The corpus already contains the common failure classes. Before proposing a fix, search `learnings/` for the symptom and state which learning matches (or that none does). In particular, on **"an SDK signal/notification is missing on a LATER room or session after the first one worked"** (e.g. `OnRoomReady` never fires on room N>1): the cause is almost always YOUR lifecycle — audit room N-1 teardown FIRST. See `learnings/common-mistakes/dont-bypass-sdk-when-your-lifecycle-is-broken.md`, `learnings/architecture/detached-teardown-for-game-initiated-travel.md`, and `learnings/architecture/onroomready-is-the-viewer-connected-gate.md` (which includes the local-run diagnosis order). Do NOT invent a structural theory ("local replay has no viewer so OnRoomReady can't fire") — `OnRoomReady` always arrives locally via the overlay.
