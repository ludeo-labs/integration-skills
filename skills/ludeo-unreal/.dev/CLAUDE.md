# CLAUDE.md — Ludeo AI Integration Skill

## What This Repo Is

This repo builds a **Claude Code skill** (`SKILL.md`) that guides developers through Ludeo SDK integration into game codebases. The skill uses a **curated-first approach** — scoping the initial integration to a specific gameplay slice for a 48-hour MVP, then expanding in later stages.

**Current status:** Skill structure complete through Stage 4. Tested on Lyra (Stages 0-2) and ActionRoguelike (Stage 3). 47 learnings accumulated. Iterating on reference quality based on real integration feedback.

## Key Documents

- `Docs/Ludeo_AI_Integration_Skill_Project_Spec.md` — Full technical specification (source of truth)
- `Docs/Ludeo_AI_Integration_Skill_Project_Spec_Addendum.md` — Learnings from integration-automation + Lyra PR pattern classification
- `Docs/Lyra_Integration_PR_Learnings.md` — Three-tier pattern analysis from Lyra PR review (universal / generalizable / game-specific)

## Reference Material

### Lyra Integration (`Docs/References/Lyra/`)

Gold standard for what a completed UE integration looks like:

| File | Content | Relevant Stages |
|------|---------|-----------------|
| `LUDEO_UE_INTEGRATION_SPEC.md` | General UE SDK integration spec (1,209 lines) | All stages |
| `Lyra_Ludeo_Architecture_TDD.md` | Lyra-specific system design — Subsystem + Component, 3-way gate (634 lines) | All stages |
| `Lyra_Ludeo_Lifecycle_Map.md` | SDK call → code location mapping + sequence diagrams (292 lines) | All stages (quick reference) |
| `Ludeo_Tracked_Data.md` | Actions, state objects, Player Flow reconstruction (124 lines) | Stages 4-7 |
| `SDK_Skill_TDD_Comparison_Report.md` | Validation report — what a prior skill attempt got right/wrong (413 lines) | Quality validation |

### Prior Project (`Docs/References/integration-automation/`)

SDK documentation and research templates from a prior engine-agnostic integration automation project. **Read the README in that folder first** — it explains critical UE caveats (macro-based patterns do not apply to UE's plugin architecture).

## Skill Authoring Conventions

This project produces a Claude Code skill. Follow these conventions:

- **SKILL.md** is the main entry point with YAML frontmatter (`name` and `description` fields, max 1024 chars total)
- `description` starts with "Use when..." — triggering conditions only, never a workflow summary
- **Progressive disclosure:** SKILL.md body stays under 500 lines; heavy reference content goes in `references/` and is loaded on demand per stage
- Reference files are organized per integration phase (e.g., `phase-01-architecture-tdd.md`)
- Use `examples/` for annotated real integrations, `learnings/` for corrections

## Directory Layout

```
├── SKILL.md                           # Orchestrator — stage flow, curated workflow
├── references/
│   ├── phase-01-architecture-tdd.md   # Curated analysis, slice selection, focused CODE_MAP
│   ├── phase-02-lifecycle.md          # Template-driven plugin scaffold
│   ├── phase-03-basic-state.md        # Curated state tracking + Player Flow
│   ├── phase-04-significant-actions.md # Curated actions (Kill/Death + slice-specific)
│   ├── phase-05-non-gameplay.md       # Non-ludeoable areas, pause/resume, map transitions, segment marking
│   ├── phase-06-enrichment.md         # (not yet built)
│   ├── phase-07-player-flow.md        # (not yet built)
│   └── templates/
│       └── plugin-scaffold-guide.md   # Universal plugin template with variable substitution
├── learnings/                         # 47+ corrections from Lyra, ActionRoguelike, FPSKit
│   ├── architecture/                  # 6 learnings
│   ├── save-systems/                  # (empty)
│   ├── common-mistakes/               # 31 learnings
│   └── engine-quirks/                 # 7 learnings
├── tools/
│   └── SetupLudeoEnv.ps1
├── scripts/
│   └── sync-learnings.sh             # Syncs learnings from installed skill to this repo
└── config/
    └── sdk-sources.json
```

## Core Integration Principles

These are non-negotiable rules the skill must enforce:

1. **Curated-first** — Human picks (with AI guidance) a specific gameplay slice. Stages 1-4 scope all work to that slice for a 48h MVP. Stages 5-7 expand to full game coverage.
2. **Plugin/component architecture** — All Ludeo code centralized in a separate plugin. Minimal core game modifications. Plugin is enabled/disabled as a unit (not `#ifdef` guards — UHT doesn't support `UCLASS`/`UPROPERTY` inside custom preprocessor blocks). Game code uses `StaticLoadClass` for zero compile-time dependency.
3. **Living documentation** — Post-implementation documentation grows incrementally per stage. Records what was done, key decisions, and deviations.
4. **Human-in-the-loop** — Quick plan approval before implementation. Stage 1 (Curated Analysis) is the critical gate — no code before human approval.
5. **Self-learning** — Corrections recorded in `learnings/` (append-only, never delete). Loaded dynamically into context per stage.
6. **Save system classification** — Each game classified into one of three groups, which drives the integration strategy:
   - Group 1 (Full Save): Leverage existing save system
   - Group 2 (Checkpoint-Only): Extend checkpoint system for arbitrary save points
   - Group 3 (No Save): Build state capture from scratch (AI adds most value here)
7. **Hard gates** — API export verification produces artifact before code. Pre-flight checklists at top of every implementation section. Functional completeness check before marking stages done.

## Per-Stage Flow

Every stage follows this cycle:

1. AI analyzes codebase per the stage's reference file
2. AI presents plan in chat — what to implement, which hook points, key decisions
3. Human gives quick approval or corrections
4. AI implements, runs compile-fix loop
5. AI writes post-implementation documentation to `.ludeo/tdd/integration-tdd.md`
6. AI captures corrections as learnings

## V1 Constraints

- **Engine:** Unreal Engine (4.x / 5.x) only
- **Game types:** FPS / Action (includes TPS)
- **Save systems:** All three groups
- **Agent strategy:** Single agent, sequential stages (multi-agent is a future optimization)

## Validation Games

- **Lyra** — Baseline. Stages 0-2 tested. Completed integration exists as reference. Skill should match or exceed quality.
- **ActionRoguelike** — Simple UE game. Stage 3 tested — exposed GameMetadata and scoped guard gaps (now fixed).
- **FPSGameStarterKit** — Ludeo sample game with complete integration. Used as reference for curated slice patterns.
- **VoyagerTPS** — Complex TPS with abilities/AI. Used for curated slice selection heuristic validation (not yet integrated).
- **RefGame** — Challenge. Historically difficult integration. Proves genuine value. Not yet attempted.

## Pattern Classification: Universal vs Game-Specific

Not all patterns from the Lyra integration apply to other games. See `Docs/Lyra_Integration_PR_Learnings.md` for the full analysis. Key distinction:

- **Universal** (use directly): Subsystem + Component split, dynamic component loading, 3-way gate, deferred activation, scoped guards, teardown chain, API key resolution
- **Generalizable** (ask the human): Write frequency, event deduplication, deferred property application, entity matching, non-gameplay phase handling, pause detection, action discovery, state object granularity, **SaveWorld vs manual writable objects** (see decision matrix in learnings doc — analyze serialization compatibility, state size, and session length before recommending)
- **Game-specific** (example only): Lyra's action set, GAS health deferral, QuickBar inventory, bot AI observables

## When to Ask the Human

The skill should **infer from code analysis** when possible:
- Event systems (grep for delegate declarations, message subsystems)
- Phase/state machines (state enums, phase managers, game mode states)
- Save systems (SaveGame classes, serialization, checkpoints)
- Entity types (pawn classes, character classes, AI controllers)

The skill should **ask the human** when:
- Multiple valid approaches exist (write frequency, dedup strategy)
- Game-specific domain knowledge is needed ("what counts as a significant action?")
- Code analysis is ambiguous ("is this delegate the right hook point?")
- Performance tradeoffs require judgment (state size vs update frequency)
- Ordering/timing dependencies aren't obvious from code (deferred health, phase skipping)

## Available MCP Servers

- `sdk-docs` — Ludeo SDK documentation and API reference
- `ludeo-context` — Company knowledge base, integration templates, QA workflows, repo context

## Related Skills

- `sdk-docs-integration` — Existing skill for SDK integration guidance (covers Unity, Unreal, proprietary C++)
