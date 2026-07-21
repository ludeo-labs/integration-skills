---
name: ludeo-unity-integration
description: Integrate the Ludeo SDK into a Unity (C#) game using the Ludeo Unity plugin. Sets up the package install + scripting defines, wires the SDK lifecycle through MonoBehaviour/scene flow, maps and implements game actions, maps and tracks GameObjects as attributes, restores state for playable Ludeos, and verifies the integration. Use when the user asks to integrate, install, add, set up, or wire up Ludeo into their Unity game.
metadata.version: 1.1.0
---

# Ludeo SDK Integration for Unity

**Skill version:** 1.1.0 · Compare against the [latest release](https://github.com/ludeo-labs/integration-skills/releases/latest) to confirm your installed copy is current. If older, run `npx skills update ludeo-labs/integration-skills/skills/ludeo-unity` (then start a fresh agent session — `SKILL.md` is cached per session).

This skill walks the agent through integrating the Ludeo SDK into a **Unity** game using the
**Ludeo Unity plugin** (the managed `LudeoSDK` C# API), from package install through action mapping,
object tracking, state restoration, and runtime verification.

> **This is the Unity-specific skill.** For C++/proprietary engines, use `ludeo-unreal-integration`
> instead. The two share the same workflow methodology; everything here is expressed in Unity/C#
> idioms (MonoBehaviour lifecycle, scenes, prefabs, the `LudeoSDK` managed API).

> **Recommend a frontier model before starting.** Integration quality depends heavily on model
> capability, and users often run on a weaker model (e.g. Sonnet). At the **start of the integration**,
> recommend the user switch to **Opus 4.8** (or an equivalent frontier model) before proceeding.

## When to use

Activate this skill when the user says any of:

- "Integrate Ludeo into my Unity game"
- "Set up the Ludeo SDK in Unity"
- "Add Ludeo action tracking" (Unity project)
- "Build my Unity game with the Ludeo SDK"
- "Wire up the Ludeo lifecycle in Unity"

If the project is **not** Unity (no `Assets/`, `ProjectSettings/`, `Packages/manifest.json`, or
`.asmdef`/`.unity` files), stop and point the user at the engine-appropriate skill.

## Read this first

**Do not apply C++/main-loop assumptions to a Unity project** — they will send you looking for
things that don't exist (a `main`, a game-authored loop, a build script) and miss the things that
do (scenes, MonoBehaviour callbacks, prefabs, an installed package). The full Unity structural model
and the codebase-scan search patterns live in **phase 1** (`references/1-map-game-code.md`); each
later phase bakes in the Unity reality it needs.

Review **`references/ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`** before phase 0 — the
mandatory rules, recalibrated for the C# wrapper.

This skill has an **institutional memory** in `learnings/` — sanitized corrections from prior
integrations. **Load the relevant learnings at the start of every phase, and capture new ones the
moment you discover them.** See **[Learnings](#learnings)** below for the load/capture discipline; it
is not optional.

## Workflow

The integration is a sequential workflow, now sequenced by the **8-phase guideline order** (the table's
**Phase** column), not the legacy file numbers (renumbering is deferred).
The order is: **0** install + intake → **1** map code → **2** SDK lifecycle → **3** map objects → **4**
tracking & restore (an **iterative wave loop** that turns a capture into a playable Ludeo — Wave 1 = the
restorable spine, then widen) → **5** actions → **6** validate + upload. Note **actions (phase 5) run AFTER
tracking & restore (phase 4)** per the guideline — the player flow is proven (Wave 1 restores) before action
enrichment. Always start at phase 0 unless the user says they've completed earlier phases.
Complete one phase at a time and confirm with the user before advancing.

**Phases 2, 4, and 5 are orchestrated.** Each is one logical guideline phase made of single-task briefs,
run by a thin orchestrator that dispatches one **subagent per task** (Agent tool) and passes artifacts by
file — so the user experiences each as a single phase.
- **Phase 2** ("plan & implement the SDK lifecycle") follows `references/2-lifecycle-orchestrator.md`:
  tasks 1–4 run automatically, the compile+run gate is surfaced to the human.
- **Phase 4** ("tracking & restore") follows `references/9-tracking-restore-orchestrator.md` and runs as an
  **iterative wave loop**: phase 3 produces a *census + wave plan*, and phase 4 implements it **one wave at
  a time** — per wave: deep-scope (task 0) → capture (task 1) → restore-plan (task 2) → reconstruction (task
  4), with the restore-**flow** (task 3) built **once in Wave 1**. **Wave 1** proves the full capture→replay
  round-trip on the *restorable spine + must-have set*; each later wave widens the tracked set. **Every**
  sub-task ends in a human gate the orchestrator runs (the agent can't see the Console, and the
  capture/replay gates require the human to capture/play a Ludeo); on a failed gate it re-dispatches a fix
  subagent with the logs — re-opening an **earlier wave** if the failure traces to its state.
- **Phase 5** ("actions") follows `references/6-actions-orchestrator.md`: map → implement, then one human
  compile+log gate (each action must emit in **both** the Creator and Player flow).

| Phase | File | Purpose |
| --- | --- | --- |
| 0 | `references/0-build-game-with-sdk.md` | **Download the latest plugin release** (`github.com/ludeo-labs/unity-plugin-releases`) + install the UPM package, set scripting defines + `LudeoSettings`, baseline + SDK-enabled compile, run **intake** (incl. game-level save-system classification) |
| 1 | `references/1-map-game-code.md` | Produce CODE_MAP of the Unity project (scenes, MonoBehaviours, prefabs, managers) |
| **2** | **`references/2-lifecycle-orchestrator.md`** | **SDK lifecycle (orchestrated) — dispatches the five briefs below as subagents; plans the restoration entry point + Non-Gameplay Handling** |
| 2 · task 1 | `references/2-find-sdk-integration-points.md` | Map each game-event → `[SDK]`/`[Layer]` call site |
| 2 · task 2 | `references/2b-create-tdd.md` | Produce Technical Design Document (architecture, strategy, risks) |
| 2 · task 3 | `references/3-plan-sdk-lifecycle.md` | Plan the LudeoController layer + notification registration + non-gameplay emissions |
| 2 · task 4 | `references/4-implement-sdk-lifecycle.md` | Implement the LudeoController/Flow/SessionManager layer + wire hooks |
| 2 · task 5 | `references/5-compile-and-fix.md` | Compile in the Editor (defines on and off), fix, confirm the capture overlay — **human-gated** |
| 2c | `references/2c-classify-save-system.md` | *Superseded:* game-level save classification moved to phase 0 intake; per-entity matrix to phase 8. Pending retirement. |
| **3** | `references/8-map-game-objects.md` | **Guideline phase 3 — CENSUS + wave plan (Part A):** enumerate every trackable object **type**, flag load-bearing ones, assign **waves** (Wave 1 = restorable spine + must-have set). Holds the **Part B** deep-scope procedure phase 4 runs per wave. No deep detail or code here |
| **4** | **`references/9-tracking-restore-orchestrator.md`** | **Tracking & restore (orchestrated, iterative WAVE LOOP) — implements the wave plan one wave at a time; dispatches the briefs below as subagents; owns a human gate per sub-task, per wave** |
| 4 · task 0 | `references/9a-deep-scope-wave.md` | **Per wave:** deep-scope this wave's types (runs phase-3 Part B) → append `## Entity` rows to `OBJECT_TRACKING.md` |
| 4 · task 1 | `references/9-implement-object-tracking.md` | **Per wave (additive):** wire `ILudeoStateHandler` registration & per-tick attribute capture for this wave's types |
| 4 · task 2 | `references/10-plan-state-restoration.md` | **Per wave (append):** plan the restoration (objectType buckets, two-pass) for this wave → `RESTORATION_PLAN.md` |
| 4 · task 3 | `references/11-implement-restoration-flow.md` | **ONCE (Wave 1 only):** implement the restore **flow**: `LudeoSelected`→`GetLudeo`→play flow, freeze/overlay, `RoomReady`→`Begin`, the `ApplyRestoredState()` stub |
| 4 · task 4 | `references/12-implement-state-reconstruction.md` | **Per wave (additive buckets):** fill `ApplyRestoredState()` for this wave — two-pass spawn-from-bucket apply, references, deferred props, environment |
| **5** | **`references/6-actions-orchestrator.md`** | **Actions (orchestrated) — dispatches the two briefs below as subagents; runs after phase 4 (player flow proven); one human compile+log gate** |
| 5 · task 1 | `references/6-map-game-actions.md` | Find action points in game code (player-perspective; incl. the non-gameplay standard actions planned in phase 2) |
| 5 · task 2 | `references/7-implement-game-actions.md` | Insert `SendAction` calls (gameplay + non-gameplay) + document the one-time platform global-trigger mapping |
| **6** | `references/13-upload-build.md` | **Guideline phase 6** — validate the release build (`validate-build`) + prep & upload it to the Ludeo platform with the `ludeo` CLI, then poll status until `ready` |

## Important rules

- **One phase at a time.** Get user confirmation before advancing to the next phase.
- **Every code-writing phase ends with a recompile + run gate (hard requirement).** The files that edit
  `.cs` (`4`, `7`, `9`, `11`, `12`) each end by requiring the integrator to (1) focus the Editor to
  recompile clean and (2) play the game to confirm it still runs. Unity recompiles on focus, so "compile"
  is a per-phase reality, not a one-time milestone. **For the orchestrated phases (2, 4, and 5) the
  orchestrator runs these gates** — it dispatches the codegen subagent (which does not compile), then
  surfaces the recompile/play gate to the human and re-dispatches a fix subagent with the logs on failure.
  The agent reads `Editor.log`/`Player.log` where it can but cannot truly verify either step — beyond the
  log it relies on the integrator's word. Do not advance until they confirm both (or explicitly skip). The
  compile-and-fix loop + `error CS` table live in `phase 5`; the gate cites it rather than repeating it.
- **Unity mental model first.** Internalize the "Read this first" model above (and phase 1's "How a
  Unity game is structured") before phase 0, and treat every search/instruction through it.
- **Track objects as attributes by default, not blobs.** The SDK supports both; Ludeo strongly
  prefers attribute integrations. When mapping and tracking objects (phases 3–4), capture discrete
  typed attributes (`SetAttribute(name, int/float/bool/string/Vector3/Quaternion)`) by default and
  do **not** ask the user which to use. Use blob/`byte[]` storage only when the user explicitly asks
  or an entity is genuinely opaque — see `06-TRACKING-PATTERNS.md`.
- **The SDK ticks itself.** The plugin instantiates a `LudeoUnityManager` that drives the SDK Tick.
  Do **not** wire SDK Tick into an Update loop. The game only drives its own `UpdateStateObjects()`
  attribute-sampling cadence.
- **Prefer the Ludeo layer; edit few game files when you can (a preference, not a hard rule).**
  **Integration correctness comes first** — never contort the integration, skip a needed hook, or fight the
  game's architecture just to avoid touching game code. That said, when there's a clean choice, keep logic
  in the game's Ludeo integration folder (the `[Layer]` classes — `unity/REFERENCE-ARCHITECTURE.md`) and
  keep edits to the game's own source small and mechanical (ideally a single façade call or event
  subscription). Fewer, smaller game-file edits make the integration easier to review, isolate, and remove
  — strive for it, but let correctness win whenever the two pull apart.
- **Disabling Ludeo is primarily a runtime concern, not conditional compilation.** Once the package
  is installed it is auto-referenced (no asmdef wiring needed). Route all SDK use through interfaces
  so that consent-off / uninitialized states fall back to `Dummy*`/`Disabled*` implementations and
  the game plays normally. A scripting define (e.g. `LUDEO_SDK`) is **optional** — only if you must
  ship builds that exclude the SDK package entirely.
- **Never claim SDK behavior without checking the docs.** Search the `sdk-docs` MCP server (see
  *MCP configuration* below) or read the bundled `references/ludeo-integration-docs/`. If neither
  covers it, say what you're unsure about rather than guessing.
- **Paths inside workflow files are relative to the workflow file itself.** A workflow at
  `references/N-*.md` says `ludeo-integration-docs/<file>.md` to reach the docs folder.
- **The agent writes outputs into the game's Unity project**, not into this skill. For example,
  `ludeo-integration-plan/CODE_MAP.json` is created at the Unity project root.
- **Fresh session recommended.** Each phase produces a lot of context. If a phase has been running
  long, suggest the user start a fresh agent session for the next phase.

## Learnings

`learnings/` is the skill's institutional memory: sanitized corrections from prior integrations,
organized into `architecture/`, `common-mistakes/`, `engine-quirks/` (Unity/C# quirks), and
`save-systems/`. Each file is one lesson with frontmatter (`category`, `tier`, `sourceGame`, `phase`,
`question`, `sanitized`).

### Load — at the start of every phase

The corpus grows with every integration; reading every file each phase burns the context the phase's
real work needs. Load it **index-first**:

1. **Read `learnings/INDEX.md` in full.** One line per learning: `path | tier | phase | hook`. The hook
   is the learning's precondition question (or its title when it has none). An index line is a
   **pointer, not the lesson** — never cite or apply a learning from its index line alone.
2. **Read the full body of every entry whose `phase` matches the current phase**, regardless of tier.
   Phase tags are conservative, so this is the floor, not the whole job.
3. **Scan every other hook against what you know about this project** (menu-gated or boots straight to
   gameplay? pooled objects? no save system? blob vs. attribute tracking?) and read the body of anything
   plausibly relevant. **Err toward reading** — a body read is cheap; wrongly skipping a learning is how
   integrations break.
4. **Re-query the index mid-phase.** When you hit a new topic (consent/overlay, restore ordering, pooled
   spawns, action emission…), grep the index for it and read the matches before improvising.
5. **Cross-check completeness:** compare the index's `Total:` count against
   `Glob(pattern: "**/*.md", path: "<skill-base-dir>/learnings")` (glob from the learnings dir directly —
   a `learnings/**` prefix fails on Windows; subtract `INDEX.md` itself). If files exist that the index
   misses, read them too — the index is stale; regenerate it (`node scripts/generate-learnings-index.mjs`)
   or append the missing lines by hand.

**Tier semantics (STRICT):** `universal` = applies to **every** Unity Ludeo integration with **no**
preconditions. `generalizable` = applies only when a stated precondition holds (the `question` field is
that precondition — verify it in *this* project before applying). `game-specific` = tied to one game;
do not reuse across games.

**Before citing any learning in a decision:** read the full body, identify its precondition, and
**verify it holds here with concrete evidence** (files read, questions answered, tests run). If the
precondition can't be verified, the learning does not apply — don't cite it. A conclusion that is
absolute ("the ONLY way", "NEVER do X") yet tagged `universal` is a red flag — check whether it should
be `generalizable` first.

### Capture — on discovery, not at phase end

**Learnings are append-only.** Add new files under `learnings/{category}/`; never delete or overwrite an
existing one without explicit human approval. Write the learning **before continuing** whenever: a fix
took more than one attempt or the root cause wasn't what you assumed; the SDK/engine/environment behaved
differently than the docs implied; the human corrected you; or you found a non-obvious precondition,
ordering requirement, or exact API signature. Deferring loses the specifics that make it reusable.

1. **Categorize** (`architecture` / `common-mistakes` / `engine-quirks` / `save-systems`) and **classify
   the tier** (see semantics above).
2. **Write `learnings/{category}/<slug>.md`** with frontmatter:
   ```yaml
   ---
   category: common-mistakes
   tier: generalizable
   sourceGame: FPSSample      # abstract codename only — see config/learning-policy.json
   phase: 4
   question: "..."            # the precondition to re-check on future integrations (null if universal)
   sanitized: true            # attest you ran the sanitization checklist
   ---
   ```
3. **Register it in the index:** run `node scripts/generate-learnings-index.mjs` (or append the line to
   `learnings/INDEX.md` by hand in the same format if you can't run node). The Load step reads the index
   first — a learning missing from it is invisible to future phases.
4. **Sanitize before saving — mandatory.** Learnings are read on future integrations *for other clients*;
   anything client-specific that survives leaks one client's code to every other client. Capture the
   transferable pattern, never the client's payload: `sourceGame` must be an allowlisted abstract
   codename, client namespaces/`.asmdef`/class names become neutral role-based names, and Ludeo SDK +
   stock Unity identifiers stay verbatim. **The test:** could a reader name the client, or copy-paste
   something that's theirs? If yes, it is not sanitized. This applies to **every committed file**, not
   just `learnings/`. **Full rule + checklist: `references/learning-sanitization.md` — read it before
   writing any learning.** `scripts/validate-skill.mjs` enforces the structural parts (codename
   allowlist, index freshness, client-identifier guard).

## Reference material

- `references/learning-sanitization.md` — how to write a learning without leaking client IP (pattern,
  not payload); the pre-save checklist. `config/learning-policy.json` holds the codename allowlist.
- `references/ludeo-integration-docs/` — primary integration guides (build, lifecycle, tracking,
  restoration, API reference, research templates, game-pattern playbooks), all Unity/C#.
- `references/ludeo-integration-docs/unity/` — Unity-specific material:
  - `REFERENCE-ARCHITECTURE.md` — the prescribed integration layer (`LudeoController` /
    `LudeoFlowSwitch` / `LudeoGameplaySessionManager` / `ILudeoStateHandler` / `LudeoKeys`).
  - `UPM-INSTALL-AND-DEFINES.md` — install paths, scripting defines, the dummy-impl pattern.
  - `LAUNCH-AND-READINESS.md` — launch models (menu-gated vs. boot-straight-to-gameplay) + the
    SDK-readiness gate that replaces the menu's implicit Activate/consent wait.
  - `CONSENT-AND-OVERLAY.md` — consent gating, gallery, pause/resume overlay notifications.
  - `READING-UNITY-LOGS.md` — locating and reading `Editor.log` / `Player.log` for the compile/run gates.

## MCP configuration

The skill's primary, always-current source of SDK detail is the **`sdk-docs`** MCP server — it
**searches the Ludeo SDK documentation** (API reference, method signatures, callback chains; Unity/C#
included). It ships with the skill (`config/mcp_config.template.json`) and runs on the integrator's
machine. Set it up once, before doing any SDK work.

> **If `sdk-docs` is not already connected**, wire it up from the bundled template, then continue. It
> is hosted (HTTP) at `https://ludeo-mcps-sdk-docs.ludeo.com/mcp` and needs an `X-User-Name` header
> set to your Ludeo username (the local-part of your Ludeo email, e.g. `jane.doe`) — it identifies the
> caller.
> - **Claude Code:** copy the `sdk-docs` entry from `<skill-base-dir>/config/mcp_config.template.json`
>   into the project's `.mcp.json` (or run `claude mcp add`), set `X-User-Name` to your Ludeo username,
>   then start a fresh session so the server connects.
> - **Other agents:** add the same entry to your runtime's MCP config.
> - If you cannot connect it, tell the user and fall back to the bundled
>   `references/ludeo-integration-docs/` — but **say so explicitly**, since the bundled copy can drift
>   from the live SDK.

| Server | Hosted endpoint | Purpose | Fallback |
|--------|-----------------|---------|----------|
| `sdk-docs` | `https://ludeo-mcps-sdk-docs.ludeo.com/mcp` (HTTP, `X-User-Name` header) | **Search the Ludeo SDK documentation** | Bundled `references/ludeo-integration-docs/` |
| `ludeo-context` | `https://mcp-ludeo-context-internal.ludeo.com/mcp` (HTTP, bearer token) | Company knowledge, QA workflows, repo context | Proceed without; analysis quality may be reduced |

## Start here

Read `references/0-build-game-with-sdk.md` and follow it. (Phase 1 establishes the full Unity
structural model and search patterns once you reach codebase mapping.)

