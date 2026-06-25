# Phase 2 · Task 1 — Map SDK Integration Points (Unity)

> **Single-task subagent brief.** Dispatched by the phase-2 orchestrator
> (`2-lifecycle-orchestrator.md`). Do exactly this one task, produce the §6 artifact, and return a
> short summary + the artifact path. You run in isolated context — your inputs are the files in §2.
> **Entry: only via the orchestrator.** This is task 1 of 5 in phase 2 (SDK lifecycle), not a phase of
> its own — never open or run it standalone.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade
> ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Read `CODE_MAP.json` and map each game hook to a Ludeo `[SDK]` call or a `[Layer]` façade method —
**locations only, no code**. Output `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`: where init/
activate, room-open, per-frame sampling, every gameplay exit, session release, and the non-ludeoable
boundary actions will go.

## 2. Inputs (Input Contract)

- [ ] `ludeo-integration-plan/CODE_MAP.json` (phase 1) — the **only** source; do **not** re-scan game code.
- [ ] Context files read:
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-003 (callbacks), CR-005 (no SDK tick),
    CR-007 (all exit paths), CR-009 (callback-driven ops).
  - `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` — the callback flow + scene mapping.
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — exact `[SDK]` signatures.
  - **If `CODE_MAP.session_boundaries` has the `{ model, start_sites[], exit_sites[], pause_overlay[] }`
    sub-structure** (open-world / streaming / sandbox / state-machine-driven), also read
    `ludeo-integration-docs/game-patterns/open-world.md` — doctrine for which `start_sites[]` binds
    `OpenRoom` and which `exit_sites[]` become `End`/`Abort`.

## 3. Steps

1. Read the context files, then `CODE_MAP.json`.
2. Use `entry_points`, `lifecycle_hooks`, `session_boundaries`, `object_model`, and
   `non_ludeoable_candidates` to pick the best location for each integration point in §5's table.
2b. **Bind `OpenRoom` to the convergent signal, not a named entry.** Static analysis makes a method that
   *reads* like the run entry (e.g. a `StartNewGame` menu handler) look canonical — but real games reach
   live gameplay through **several** paths (new-game, resume/continue, load-save, an **Editor/debug
   auto-enter or session-override**, NPC/scripted bypasses). Enumerate **all** of them from `CODE_MAP`
   (cross-check `entry_points` against the per-run authority phase 1 flagged — a Fusion/`GameState`
   machine, a `runState` field, etc.), then bind `OpenRoom` to the **one runtime point every path
   converges on** (the transition into the in-game/"Ongoing" state). The binding must be **idempotent**
   — that convergent signal can re-fire (per-scene re-spawns within one run), so guard on
   "room already open" and open once per run; `End`/`Abort` clears the guard so the next run re-triggers.
2c. **Trace `Activate`/consent ordering for the chosen bind point.** `Activate` and the first
   `ConsentUpdated` `[SDK]` are **async** and may land **after** the gameplay scene loads. An `OpenRoom`
   that fires at run-start before consent is known **silently no-ops** (the flow switch is still
   disabled) — no room, no `RoomReady`, no overlay, no error. Flag this in `warnings` and note the fix:
   record capture intent and (re)fire `OpenRoom` from the `ConsentUpdated` callback (`unity/CONSENT-AND-OVERLAY.md` §1).
3. **Map the non-ludeoable areas.** For each entry in `CODE_MAP.non_ludeoable_candidates`, emit a
   boundary-action mapping: enter site → `StartNoneLudeable`, exit site → `StopNoneLudeable`
   (`[SDK]` `SendAction`). These fire in-session (tracking keeps running); the backend excludes the
   window via a one-time platform global-trigger mapping (noted for phases 6–7). Flag any candidate
   missing a clear exit (a dangling non-ludeoable never re-enables capture).
4. Write `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (§6) — locations only, no code.

## 4. Questions to ask the human

Surface to the orchestrator; don't guess:
- A **required `CODE_MAP` section is missing** — report it rather than inventing locations.
- **Open-world/streaming:** multiple `start_sites[]`/`exit_sites[]` and `open-world.md` doesn't
  disambiguate which binds `OpenRoom` — ask which start begins a live run.
- **"Is this the only way into a live run?"** Ask it for the chosen entry, and **chase every path** —
  Editor/debug auto-enter, session-override, resume/continue, load-save, scripted/NPC bypasses. A
  "single-player only" answer resolves the **co-op client-join** case **only**; it does **not** clear
  these single-player bypasses. If any path skips the bound site, prefer the convergent signal (step 2b).

## 5. Patterns to apply

- **⚠️ Ludeo Session ≠ Gameplay Session.** `InitLudeoSession`/`Activate`/release belong at **app
  startup/shutdown** (bootstrap/init scene), never inside level start/end. `OpenRoom`…`End`/`Abort`
  is the per-moment Gameplay Session.

**What to map:**

| Integration point | Kind | When | Find in CODE_MAP |
| --- | --- | --- | --- |
| `LudeoManager.InitLudeoSession` | `[SDK]` | App startup, once | `entry_points` / bootstrap MonoBehaviour in init scene |
| register `AddNotify*` then `LudeoSession.Activate` | `[SDK]` | Right after init, before gameplay | same bootstrap site |
| `LudeoSession.OpenRoom` | `[SDK]` (via `[Layer]`) | A match/level **starts** (every start path) | `session_boundaries` (start) — **enumerate every call site that reaches live-run state**, then bind to the **convergent runtime signal they all hit** (the state-machine transition into the in-game/"Ongoing" state), **not** a plausibly-named entry method. No-per-level-scene games: `open-world.md` §3 |
| per-frame `UpdateStateObjects()` sampling | `[Layer]` | While gameplay active | a gameplay MonoBehaviour `Update` `[Unity]` |
| `LudeoGameplaySession.End` / `Abort` | `[SDK]` (via `[Layer]`) | Gameplay ends — **ALL exit paths** | `session_boundaries` (end) — no-per-level-scene games: wire **every** `exit_sites[]` (its `ludeo:` field says End vs Abort) |
| `StartNoneLudeable` / `StopNoneLudeable` | `[SDK]` `SendAction` (via `[Layer]`) | Enter/exit a mid-gameplay non-ludeoable area | `non_ludeoable_candidates[].enter` / `.exit` |
| session release | `[SDK]` | App shutdown | `OnApplicationQuit` `[Unity]` |

> **Do NOT map an SDK tick.** The plugin ticks itself via `LudeoUnityManager` (CR-005). The only
> per-frame game call is the `[Layer]` `UpdateStateObjects()` sampling site.

**Callback-driven — NOT game integration points (CR-009).** Note where the façade will wire them, but
they are not call sites picked from game code:
- `LudeoRoom.AddGamePlayer` ← fired from the `OpenRoom` callback.
- `LudeoGameplaySession.Begin` ← fired on the `RoomReady` notification (after restore, in play flow).
- `LudeoRoom.CloseRoom` ← fired after `End`/`Abort`.

## 6. Output Contract

`ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`:
```json
{
  "game_name": "<from CODE_MAP>",
  "code_map_source": "ludeo-integration-plan/CODE_MAP.json",
  "threading": "<from CODE_MAP — expect main-thread>",
  "integration_points": [
    { "call": "LudeoManager.InitLudeoSession", "kind": "SDK", "scene_or_file": "...", "class_method": "...", "line": "...", "timing": "Once at startup", "notes": "register AddNotify* then Activate here" }
  ],
  "exit_paths": [
    { "call": "LudeoGameplaySession.End|Abort", "scene_or_file": "...", "class_method": "...", "line": "...", "trigger": "level complete | death | quit-to-menu | restart | OnApplicationQuit | ReturnToMainMenu" }
  ],
  "non_ludeoable": [
    { "kind": "shop|dialogue|tutorial|safezone|cutscene", "enter": { "action": "StartNoneLudeable", "file": "...", "line": "...", "trigger": "..." }, "exit": { "action": "StopNoneLudeable", "file": "...", "line": "...", "trigger": "..." }, "platform_trigger_mapping": "one-time, out-of-code (phases 6-7)" }
  ],
  "callback_driven": {
    "note": "wired by the LudeoController façade, NOT picked from game code (CR-009)",
    "AddGamePlayer": "from OpenRoom callback", "Begin": "from RoomReady notification", "CloseRoom": "after End/Abort"
  },
  "warnings": ["<timing/threading/missing-CODE_MAP-section/dangling-non-ludeoable concerns; OpenRoom-before-consent race (2c); entry paths that skip the bound OpenRoom site (2b)>"]
}
```

## 7. ✅ Success Criteria

- [ ] **Every game-event → SDK-call mapping listed** (init/activate, OpenRoom, sampling, release).
- [ ] **`OpenRoom` bound to the convergent in-gameplay signal** (step 2b), idempotently, after
      enumerating **all** entry paths — not a single named entry; consent/`Activate` ordering traced
      (step 2c) and flagged if `OpenRoom` could fire before consent lands.
- [ ] **Every gameplay exit path** from `session_boundaries` listed as `End`/`Abort` (CR-007) — a missed
      path = no Ludeo for that scenario.
- [ ] **Every `non_ludeoable_candidates` entry mapped** to a `StartNoneLudeable`/`StopNoneLudeable`
      enter/exit pair; any missing-exit candidate flagged.
- [ ] **No SDK tick mapped** (CR-005); the only per-frame call is `UpdateStateObjects()`.
- [ ] Callback-driven ops documented as chains, **not** game call sites (CR-009).
- [ ] Locations only — no code suggested.

## 8. Common Mistakes

- **Mapping an SDK tick** — the plugin ticks itself (CR-005).
- **Missing an exit path** — `End`/`Abort` almost always needs multiple locations (CR-007).
- **Binding `OpenRoom` to a method that *reads* like the entry** (a `StartNewGame` menu handler) instead
  of the convergent in-gameplay transition — Editor auto-enter / resume / bypass paths skip it (step 2b).
- **Assuming consent is known at run-start** — `Activate`/`ConsentUpdated` are async; an `OpenRoom`
  before they land silently no-ops (step 2c).
- **Treating `AddGamePlayer`/`Begin`/`CloseRoom` as game call sites** (CR-009).
- **Guessing locations when a CODE_MAP section is missing** — report it instead.
- **Leaving a non-ludeoable area with no `StopNoneLudeable`** — capture never re-enables.
- **Suggesting code** — this task outputs locations; implementation is task 4.

## Related / Next

- **Next (orchestrator):** task 2 — `2b-create-tdd.md` (TDD from `CODE_MAP` + this artifact).
