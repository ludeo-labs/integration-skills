# Phase 6 · Task 1 — Map Game Actions (Unity)

> **Single-task subagent brief.** Dispatched by the phase-6 orchestrator (`6-actions-orchestrator.md`).
> Find where Ludeo **actions** (`SendAction`) should fire — locations + names, **no code** (that's task 2)
> — produce `GAME_ACTIONS_MAP.md`, and return a short summary + the artifact path. **You do not run the
> human approval gate** — the orchestrator surfaces the map to the user. You run in isolated context —
> your inputs are the files in §2.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade · `[Unity]` = engine API.

## 1. Goal / Purpose

Analyze the Unity game to find where Ludeo actions should fire, based on the game's genre and its discrete
gameplay events, and **filter for signal** (drop tracked state, high-frequency noise, no-value beats).
Produce `ludeo-integration-plan/GAME_ACTIONS_MAP.md`: each kept action named from the player's perspective,
mapped to `file:line`, scoped (player vs global) — **plus the non-gameplay boundary/pause actions** the
backend uses to exclude non-ludeoable windows. Output is human-approved before task 2 inserts code.

## 2. Inputs (Input Contract)

- [ ] **Phase 2** → `ludeo-integration-plan/CODE_MAP.json` (game name + structure — the source to search).
- [ ] **Phase 3** → `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` — carries the **non-ludeoable
      boundary-action mappings** (enter → `StartNoneLudeable`, exit → `StopNoneLudeable`) discovered from
      `CODE_MAP.non_ludeoable_candidates`. **Do not re-scan for these** — read them from here.
- [ ] **Recommended:** `ludeo-integration-plan/TDD_<GameName>.md` — its **Actions** section (the capture
      strategy already agreed).
- [ ] Context files read (relative to this brief):
  - `ludeo-integration-docs/game-patterns/INDEX.md` — the genre/structural pattern index.
  - Genre pattern file(s) — loaded dynamically in Step 2.

> **Phase 5 is done** (the player flow is proven) — actions are enrichment on a working capture/replay
> loop. This task adds nothing the loop depends on; it only maps emit points.

## 3. Steps

### Step 1: Read CODE_MAP, extract the game
Read `CODE_MAP.json`. Extract `project_summary.game_name`, `core_classes`, `event_systems`, `object_model`,
`session_boundaries`, and the script roots to search.

### Step 2: Determine genre + structural axis
1. **Genre** — web search `"<game_name>" game genre`. If that fails (unreleased / internal), surface to
   the orchestrator: *"I couldn't determine the genre for `<game_name>`. What genre is it?"*
2. Read `game-patterns/INDEX.md`.
3. **Check the structural axis first.** If `CODE_MAP.session_boundaries` has the sub-structure
   `{ model, start_sites[], exit_sites[], pause_overlay[] }` (open-world / streaming / sandbox /
   state-machine-driven — no per-level scenes), load `game-patterns/open-world.md` **in addition** to the
   genre file(s). It is **structural** — one run = one Gameplay Session, so actions **accumulate across the
   whole live run** rather than resetting per level. The genre file still supplies the action catalog.
4. Load the matching genre file(s). Hybrid games: load multiple and merge their catalogs + keywords. If no
   genre file exists, tell the orchestrator and proceed with a broad search across common genres: combat
   (kill, death, damage, score), collection (pickup, collect, loot), progression (objective, complete,
   quest, levelUp, win, lose), crafting/building (craft, build, gather).

### Step 3: Search the Unity codebase for action patterns
Using the genre file's **search keywords** + the Unity idioms, grep the script roots. Gameplay events
surface as:
- **Event handlers** — `On*`/`Handle*` methods, C# `event`/`Action` invocations, `UnityEvent.Invoke`.
- **Physics callbacks** — `OnTriggerEnter`/`OnCollisionEnter` (kills, pickups, checkpoints).
- **Discrete state transitions** — a death/score/level-complete branch inside a method.

Filter out engine/UI/rendering internals, utility helpers, **getters/setters of continuous state** (that's
tracking), and **high-frequency input/movement** (jump/dash/sprint/crouch, move-and-attack orders, clicks)
unless it's a scored mechanic. You want *meaningful event fired*, not *value changed* and not *button
pressed* — apply the keep test (§5).

### Step 4: Map findings to Ludeo actions
For each gameplay-event site:
1. Match it against the genre **action catalog** (candidates, not a checklist — many entries are state/noise).
2. Assign a Ludeo action name (**PascalCase**, **player's perspective** — these become `LudeoActionKeys`
   constants in task 2).
3. Assess objective + scoring potential.
4. **Run the keep test** (§5). If it's tracked **state**, **high-frequency noise**, or **no-value**, do
   **not** add it to the action list — record it in the **Dropped** table with the reason.
5. **Establish the scope** (§5 "Attribute correctly"):
   - **Global / match-scoped** (`RaceStart`, `MatchWin`, `WaveComplete`, `ObjectiveComplete`)? Mark
     **`global`** — capture once, **no** guard.
   - **Player-scoped**? Confirm the player is actor (`Kill`) or subject (`Death`). If the site can fire for
     **non-player actors** (a shared `OnEnemyKilled(killer, …)`), still map it but append
     **`⚠ needs player-guard: <condition>`** so task 2 wraps the `SendAction`.
   - **A different individual's** personal action (enemy-vs-enemy)? Drop it (NPC state, not an action).
6. If it passes and is gameplay-relevant but uncataloged, add it as a game-specific action.

Also flag **gaps**: cataloged actions you did *not* find in code — "Expected `<ActionName>` for this genre
but found no matching code. Manual review recommended."

### Step 5 was the keep test + scope rules — see §5 (Patterns) below.

### Step 6: Pull in the non-gameplay boundary/pause actions
Read the non-ludeoable boundary-action mappings from `SDK_INTEGRATION_POINTS.json` (phase 3) and add a
**Non-Gameplay Actions** section to the map (don't re-scan):
- **Non-ludeoable areas** (shops, NPC dialogue, tutorials, safe zones, in-game menus) — enter site →
  `StartNoneLudeable`, exit site → `StopNoneLudeable`. Tracking keeps running; the **backend** excludes the
  window via a one-time platform global-trigger mapping (task 2 documents it). Flag any candidate **missing
  a clear exit** (a dangling `StartNoneLudeable` never re-enables capture).
- **Capture-hygiene pause / cutscene** (a true sim freeze the game initiates, distinct from the SDK overlay
  pause) — `PauseLudeo` / `ResumeLudeo`. Identify the enter/exit sites if present; if none exist, note it.

These use the **standard names** (already seeded in `LudeoActionKeys` in phase 3). They are session/area
events — **not** player-guarded. Like all actions, task 2 emits them in **both** flows.

### Step 7: Produce output
Write `ludeo-integration-plan/GAME_ACTIONS_MAP.md` (schema in §6). Tag confidence per action
(`high`/`medium`/`low`). Return the artifact path + a summary to the orchestrator; **do not run a human
review** — the orchestrator surfaces it for approval.

## 4. Questions to ask the human

Surface to the orchestrator; don't guess:
- **Genre**, if the web search fails.
- A candidate that's **plausibly state or noise** where the keep test is genuinely ambiguous (bias: drop).
- A player-scoped site that can fire for **non-player actors** — confirm the player-guard condition.
- A **non-ludeoable area with no clear exit site** — a dangling `StartNoneLudeable` would never re-enable capture.

## 5. Patterns to apply

### What an "action" is — and what to leave out
A discrete, meaningful gameplay beat a Ludeo would care about: it advances an **objective**, **scores**, or
marks a **notable moment** (`Kill`, `LapComplete`, `BossKill`, `ObjectiveComplete`). `SendAction` `[SDK]`
is parameterless and fires in **both** the creator and play flows (task 2).

**Capturing the wrong things actively hurts the Ludeo.** Every `SendAction` is recorded; high-frequency,
low-value calls **bloat the file and bury the moments that matter**. This phase is a **filter**, not a
transcription. Drop a candidate when:

| Reject reason | What it looks like | Do instead |
|---|---|---|
| **It's state, not an event** | A value per-tick capture already records: current weapon, equipped gear, ammo/health/XP **totals**, is-sprinting/crouched/drifting | Track it as an attribute (phase 5). Don't mirror tracked state as an action. |
| **High-frequency input / mechanical noise** | Fires many times/sec with no objective or score: `Jump`, `Dash`, `Sprint`, `Crouch`, `Reload`, `WeaponSwitch`, RTS `MoveOrder`/`GroupSelect`, raw clicks | Drop — noise, never a highlight beat, bloats the file. |
| **No Ludeo value** | No objective, no scoring, not a memorable one-shot beat — pure flavor | Drop. |

**The keep test (per candidate): _is this a beat a viewer or objective would care about?_**
- **Yes → keep it, even if it fires often** (`Kill` in a horde shooter, `ResourceGathered` toward "gather
  50 wood", `LapComplete`). Frequency only condemns an action with **no** objective/scoring value.
- **No → drop it**, and record *why* (state / noise / no-value) so the call is reviewable.

> **Bias: signal-first, not keep-everything.** A useful action missed here is cheap to add later; a noisy
> Ludeo is expensive to clean and degrades *every* highlight. When a candidate is plausibly state or noise,
> **default to dropping it.**

> **Milestones still count even when related state is tracked.** Keep `Death` (is-alive is tracked, but
> death is a major beat), `LevelUp`, `BossKill`. The state-reject rule targets actions that merely *mirror*
> a continuously-tracked value (`GainXP`, `Equip`).

### Attribute correctly — player-scoped vs. global
`SendAction` is bound to the **room's player** (task 2). Most actions are **player-scoped**: something the
player **did** (`Kill`) or that **happened to the player** (`Death`/`TookDamage`). An enemy killing another
enemy is **not** the player's action — at most it's NPC state (phase 5). Map a player-scoped action only
where the player is actor/subject; if the site fires for *any* actor (a shared `OnEnemyKilled(killer, …)`),
still map it but flag **`⚠ needs player-guard`** so task 2 guards on the player.

Some actions are **global / match-scoped** — they belong to the whole session and apply regardless of who
triggered them: `RaceStart`, `RaceFinish`, `RoundWin`, `MatchWin`, `WaveComplete`, `ObjectiveComplete`,
`DayPassed`. **Valid actions** — capture them **once** when the event fires, **no** player-actor guard.
Mark them **`global`** so task 2 knows not to guard them.

**No single player avatar?** (RTS, god game, multi-unit, spectator) — "the player" is the controlling
**side/faction**. Player-scoped actions attribute to player-**owned** units / player-**issued** events
(`UnitKill` when *your* unit scores it; an enemy's kill is `UnitLost`); global actions apply as-is. If a
game has no controllable side at all, flag it.

- **Player-perspective naming** — name from what the player did/experienced.
- **Match genre-catalog names where they exist** (no canonical platform action-name reference exists yet);
  game-specific actions are expected for the rest.
- **Actions are discrete events**, not continuous state (that's tracking — phase 5).
- **PascalCase** names (become `LudeoActionKeys`).
- **Gaps are information**, not errors.

## 6. Output Contract

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/GAME_ACTIONS_MAP.md` | Approved action map that task 2 implements |

```markdown
# Game Actions Map — <GameName>

**Genre:** <genre(s)>   **Patterns used:** <genre file(s)> [+ open-world.md if structural]
**Actions kept:** X   **Dropped (state/noise/no-value):** D   **Non-gameplay actions:** N   **Gaps:** Y

## Actions by Category

### Combat
| Action Name | Description | Source (class.method) | File:Line | Confidence | Objective Potential | Scoring Potential |
|---|---|---|---|---|---|---|
| Kill | Player kills an enemy. ⚠ needs player-guard: `killer == localPlayer` (OnEnemyKilled fires for any killer) | CombatManager.OnEnemyKilled | Assets/Scripts/Combat/CombatManager.cs:245 | high | Kill 10 enemies | 100 pts |
| Headshot | Kill via headshot | CombatManager.OnEnemyKilled (headshot branch) | …:252 | high | Get 5 headshots | +50 |

### [Other Categories…]

## Non-Gameplay Actions (from SDK_INTEGRATION_POINTS.json — phase 3)
| Action | Trigger | Site (file:line) | Scope | Notes |
|---|---|---|---|---|
| StartNoneLudeable | Enter shop | ShopUI.Open | session/area | platform global-trigger excludes window; needs matching StopNoneLudeable |
| StopNoneLudeable | Exit shop | ShopUI.Close | session/area | closes the window |
| PauseLudeo | Cutscene begins | CutsceneMgr.Play | session | capture-hygiene; NOT the SDK overlay pause |
| ResumeLudeo | Cutscene ends | CutsceneMgr.End | session | |

## Gaps
| Expected Action | Reason |
|---|---|
| MultiKill | No multi-kill detection found. Manual review recommended. |

## Dropped (not captured — would bloat the Ludeo)
| Candidate | Where found | Reason | Handled by |
|---|---|---|---|
| Jump | PlayerMovement.Jump | high-frequency noise, no objective/score | (nothing — or an `airborne` attribute if a moment needs it) |
| Reload | Weapon.Reload | mechanical noise; ammo is tracked state | attribute: ammo count (phase 5) |
| Equip | Inventory.Equip | state, not an event | attribute: equipped item id (phase 5) |
```

The Dropped table makes the filter **reviewable** — the integrator can promote any row back to an action.
**Confidence:** `high` = clear match; `medium` = indirect naming; `low` = possible, needs manual review.

## 7. ✅ Success Criteria

**Guideline phase-6 criteria this task produces:**
- [ ] **Action list mapped to `file:line` emit points** — every kept action with its source + line.
- [ ] **Actions named from the player's perspective** (PascalCase).
- [ ] **Matched to reference action names where they exist** — genre-catalog names + the standard
      non-gameplay names; game-specific actions for the rest.

**Skill-specific additions:**
- [ ] Keep test applied — tracked state / high-frequency noise / no-value recorded in the **Dropped** table.
- [ ] Each action scoped — **player** (with a guard condition where a site fires for any actor) or **global**.
- [ ] The **Non-Gameplay Actions** section filled from `SDK_INTEGRATION_POINTS.json` — every
      `StartNoneLudeable` has a matching `StopNoneLudeable` (no dangling); pause-hygiene sites noted.
- [ ] Gaps recorded as information; confidence tagged per action.

## 8. Common Mistakes

- **Writing code / running anything** — this is mapping only; task 2 inserts `SendAction`.
- **Transcribing instead of filtering** — keeping jump/dash/reload/equip bloats the Ludeo (drop them).
- **Mapping a continuous value as an action** (`GainXP`, `Equip`) — that's tracked state (phase 5).
- **Crediting the player with non-player actions** — flag the player-guard for shared kill handlers.
- **Dropping global/match events** because "the player didn't personally cause them" — they frame the moment.
- **Re-scanning for non-ludeoable boundaries** — read them from `SDK_INTEGRATION_POINTS.json` (phase 3).
- **A `StartNoneLudeable` with no exit** — leaves capture suppressed for the rest of the run.

## Related / Next

- Phase 2 (`2-map-game-code.md`) — produces `CODE_MAP.json`. Phase 3 — produced the non-ludeoable mappings.
- **Next (orchestrator):** surface `GAME_ACTIONS_MAP.md` for human approval, then dispatch task 2
  (`6b-implement-game-actions.md`) to insert the `SendAction` calls.
