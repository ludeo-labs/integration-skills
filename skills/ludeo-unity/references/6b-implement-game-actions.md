# Phase 6 · Task 2 — Implement Game Actions (Unity)

> **Single-task subagent brief.** Dispatched by the phase-6 orchestrator (`6-actions-orchestrator.md`).
> Insert `SendAction` calls (gameplay + non-gameplay) at the mapped sites, routed through the `[Layer]`
> façade, and document the one-time platform global-trigger mapping — then return a summary + the files
> you created/edited. **You do not run the human-gated compile/play** — the orchestrator plays the game
> and reads the log (emission is log-only evidence). You run in isolated context — your inputs are the
> files in §2. Follow **propose → confirm → execute** for each edit.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Turn the approved `GAME_ACTIONS_MAP.md` into wired `SendAction` calls: add the `LudeoActionKeys` constants,
insert each kept gameplay action at its `file:line` (player-guarded or global per the map), emit the
**non-gameplay standard actions** (`StartNoneLudeable`/`StopNoneLudeable` at non-ludeoable boundaries,
`PauseLudeo`/`ResumeLudeo` for every pause, SDK-requested included), and document the **one-time platform global-trigger
mapping**. Every call fires in **both** the Creator (capture) and Player (restore) flows.

## 2. Inputs (Input Contract)

- [ ] **Task 1** → `ludeo-integration-plan/GAME_ACTIONS_MAP.md`, **approved** by the user (kept actions +
      Dropped table + Non-Gameplay Actions section).
- [ ] **Phase 3** → `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` — the non-ludeoable boundary-action
      sites (enter/exit file:line) to emit `StartNoneLudeable`/`StopNoneLudeable` at.
- [ ] **Phase 3** → the `[Layer]` exists (`LudeoController.SendAction` façade + the `LudeoActionKeys`
      scaffold, seeded with the standard non-gameplay names) and `SetGameplayerId` is wired.
- [ ] Context files read (relative to this brief):
  - `ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md` — the `[Layer]` `LudeoController.SendAction` +
    `LudeoActionKeys`.
  - `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the `[SDK]` `LudeoPlayer.SendAction(string)`
    signature.
  - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (runtime disable), CR-007.

## How `SendAction` works in Unity (read before inserting)

- **One argument, no `playerId`.** `[SDK]` `LudeoPlayer.SendAction(string action)` is bound to the
  room's player already — there is **no** `playerId` parameter and no DataWriter handle (unlike the C++
  API). Call sites pass only the action name. **The player binding is set once via `SetGameplayerId`
  `[Layer]` (phase 3), whose id MUST match the id passed to `AddPlayer`** — that is the guideline's
  "player-id matches the id passed to AddPlayer." If they diverge, actions attribute to the wrong player.
- **Actions fire in BOTH flows — never gate on `IsInLudeoFlow`.** The play flow re-fires the same sites so
  the SDK can score the Ludeo's win/fail during playback. Only **state writes** (`WriteData`, phase 5)
  are creator-only; **action writes are not.** The façade's `isGameplayActive` gate is the *only* gate.
- **Guard player-scoped actions; fire global ones as-is.** A **player-scoped** action (`Kill`, `Death`) at a
  site that triggers for *any* actor (a shared `OnEnemyKilled`, an NPC-vs-NPC kill) **credits the player
  with something they didn't do** and re-fires wrongly in the play flow — guard on the player being
  actor/subject (task 1 flags these `⚠ needs player-guard`). **Global / match-scoped** actions (`MatchWin`,
  `WaveComplete`, `ObjectiveComplete`) fire once at the event, **no guard**.
- **Always go through the façade.** Call `[Layer]` `LudeoController.Instance.SendAction(name)`, not the raw
  `[SDK]` method — it guards on `isGameplayActive` and routes to the dummy when disabled (no per-site session
  check needed).
- **No `#if` guard at call sites.** CR-001 disable is **runtime** (the dummy no-ops). Add `#if LUDEO_SDK …
  #endif` **only** if the project uses the optional define to ship a build that excludes the package
  entirely (rare — `unity/UPM-INSTALL-AND-DEFINES.md §4`).

## 3. Steps

### Step 1: Read the action map
Read `GAME_ACTIONS_MAP.md`. Extract each **kept** gameplay action (name, source class.method, file:line,
confidence, scope/guard) and the **Non-Gameplay Actions** section. **Skip `low` confidence** — flag for
manual review. **Do not implement anything from the Dropped table** — those were filtered out on purpose;
if the user wants one back, they promote it in the map first.

### Step 2: Add the action-name constants
Open `LudeoActionKeys` (scaffolded in phase 3, seeded with the standard non-gameplay names). Add a
`const string` per mapped gameplay action (PascalCase value); confirm the non-gameplay names are present:
```csharp
public static class LudeoActionKeys
{
    public const string Kill = "Kill", Headshot = "Headshot", CollectCoin = "CollectCoin";
    // standard non-gameplay (seeded in phase 3 — confirm present):
    public const string StartNoneLudeable = "StartNoneLudeable", StopNoneLudeable = "StopNoneLudeable";
    public const string PauseLudeo = "PauseLudeo", ResumeLudeo = "ResumeLudeo";
}
```
Call sites reference the constant, never a string literal.

### Step 3: Insert the gameplay calls (propose → confirm → execute)
For each high/medium-confidence action: read the source method, find the point **after** the triggering
logic, and propose:
```csharp
// after the kill is finalized:
LudeoController.Instance.SendAction(LudeoActionKeys.Kill);   // [Layer] → [SDK] SendAction
```
**Rules:**
- Place the call **after** the triggering logic, never before.
- Inside conditional branches, place it in the relevant branch (e.g. the headshot branch).
- Add `using` for the namespace holding `LudeoController`/`LudeoActionKeys` if the file lacks it.
- **No `#if` guard** (see above) unless the optional exclude-package define is in use.

### Step 4: Player-guard and switch/case edge cases

**Multiple actions in one method — with the player-guard** (the method fires for *any* killer):
```csharp
void OnEnemyKilled(GameObject killer, GameObject victim, bool headshot)
{
    // … existing game logic …
    if (killer == m_localPlayer)   // [Unity] player-as-actor guard — only the player's kills are the player's action
    {
        LudeoController.Instance.SendAction(LudeoActionKeys.Kill);
        if (headshot) LudeoController.Instance.SendAction(LudeoActionKeys.Headshot);
    }
}
```
(`m_localPlayer` is whatever the site already has to identify the captured player — the player object, its
id matched against the `SetGameplayerId` value from phase 3, a `CompareTag("Player")`, etc.)

**Inside a switch/case** (e.g. pickup type):
```csharp
case ItemType.Coin:
    // … existing logic …
    LudeoController.Instance.SendAction(LudeoActionKeys.CollectCoin);
    break;
```

### Step 5: Emit the non-gameplay standard actions
From the map's **Non-Gameplay Actions** section + `SDK_INTEGRATION_POINTS.json`:
- **Non-ludeoable areas** — at the **enter** site emit `StartNoneLudeable`, at the **exit** site emit
  `StopNoneLudeable`. Tracking keeps running; these mark the window for backend exclusion (Step 6). Fire in
  **both** flows (no player guard — it's a session/area event). **Ensure every `StartNoneLudeable` has a
  reachable `StopNoneLudeable` on all exit paths** — a dangling open span leaves capture suppressed for the
  rest of the run (mirror of the CR-007 "no dangling on EndGameplay" rule).
- **Pause/resume** — at **every** pause emit `PauseLudeo`, at its end emit `ResumeLudeo`. This is what stops
  the **Ludeo objective timer**; freezing the simulation does not, so without it the clock drains through
  every pause. "Every" means the **player's ESC / pause menu**, cutscenes, dialogue, loading screens, focus
  loss — **and the SDK's own `PauseGameRequested`** (wired in phase 3/5), whose handler must reach this same
  emit. Wire it at the game's **pause primitive** (the one function every pause path funnels through), not at
  the ESC key.
  - **Emit once per transition.** If both the `PauseGameRequested` handler and the pause primitive emit, the
    pause is reported twice — route the handler *through* the primitive and guard it with a span flag.
  - **The action does nothing until it's mapped** to a Pause/Resume **Global Trigger** in Studio Lab (Step 6).
    An unmapped or mismatched string is silently ignored: the log shows the action, the timer keeps running.
  - `PauseLudeo` ≠ `StartNoneLudeable`: pause/resume **stops** the timer and the backend saves nothing;
    non-ludeoable **keeps** the timer running and the backend keeps the data. Wire **both** pairs.
  - **If phase 2 recorded no pause primitive, do not build one.** Emit at whatever freeze the game does have
    (including the one the `PauseGameRequested` handler performs for the overlay) and skip the rest — never add
    a pause menu, keybinding, or freeze path the game didn't have. If it can't freeze at all, emit nothing here
    and say so in your summary.

```csharp
// non-ludeoable area boundary (e.g. shop):
void OpenShop()  { /* … */ LudeoController.Instance.SendAction(LudeoActionKeys.StartNoneLudeable); }  // [Layer]
void CloseShop() { /* … */ LudeoController.Instance.SendAction(LudeoActionKeys.StopNoneLudeable); }   // also on every early-exit path

// pause/resume — at the game's pause primitive; EVERY pause path funnels here,
// including the SDK's PauseGameRequested handler. Guard with m_ludeoPauseSpanOpen so a
// pause arriving via two paths reports once: full form in
// ludeo-integration-docs/unity/CONSENT-AND-OVERLAY.md §3.2.
void PauseGame()  { /* … existing freeze … */   /* if span open, return */ SendAction(LudeoActionKeys.PauseLudeo); }
void ResumeGame() { /* … existing unfreeze … */ /* if span closed, return */ SendAction(LudeoActionKeys.ResumeLudeo); }
```

### Step 6: Tell the user to create the Global Triggers (out-of-code, required)
Both pairs are ordinary `SendAction` strings — **not SDK constants**. They do nothing until a matching **Global
Trigger exists** on the platform. A missing or misnamed trigger drops the action **silently**: no error, the
action still shows in the log, the timer keeps counting. You have no Studio Lab access, so don't just note it —
**tell the user, verbatim, that it's required and yours to hand over**:
> *"**Needed on the Ludeo platform — I can't do this.** In Studio Lab → your environment → Global Triggers,
> create (or confirm) a **Pause/Resume** trigger starting on `PauseLudeo` and ending on `ResumeLudeo`, and a
> **Non-Ludeoable Area** trigger starting on `StartNoneLudeable` and ending on `StopNoneLudeable`. Names must
> match exactly — that's what the code emits. Until both exist, pauses won't stop the player's clock and
> non-ludeoable areas won't be excluded, with nothing in any log to say so."*

> **`ludeo-mcp` server:** if a tool for global triggers is in [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md)'s
> table by the time you read this, use it (a **write** — confirm first) instead of handing the step over.
> Otherwise the message above stands.

> **Open cross-skill item:** whether `StartNoneLudeable`/`StopNoneLudeable`
> is one generic start/stop pair for all non-ludeoable areas or needs per-area names is a platform
> global-trigger semantics question for the platform owner. Use the single generic pair by default; flag it
> if the game has several distinct non-ludeoable areas the backend must distinguish.

### Step 7: Self-check, then hand back (no compile/play here)
You do **not** run the human-gated compile/play — the orchestrator does. Statically self-check against §7's
pre-handoff criteria, then return a summary + files created/edited + the platform global-trigger action item
+ any skipped (low-confidence) actions. **The runtime gate (recompile clean + each action emits in the log
in BOTH flows + correct attribution) is the orchestrator's** — emission can't be verified from this isolated
context.

## 4. Questions to ask the human

Surface to the orchestrator; don't guess:
- A **player-guard condition** the map flagged but the site doesn't make obvious (how to identify the player).
- A **non-ludeoable area whose exit path is unclear** — adding the `StopNoneLudeable` on all exits is required.
- A site where placing the call **after** the triggering logic isn't obvious (async/coroutine completion).

## 5. Patterns to apply

- **Actions fire in BOTH the creator AND play flows.** Never gate `SendAction` behind `IsInLudeoFlow` / an
  "are we replaying?" check — the #1 actions bug. Only **state writes** are creator-only.
- **Attribute to the player.** Where the map says `⚠ needs player-guard`, wrap the `SendAction` in the
  player-actor/subject check; the guard surrounds only the Ludeo call. `SetGameplayerId` (phase 3) must
  match the `AddPlayer` id.
- **Global/match-scoped actions fire once, unguarded.**
- **Route through the façade**, not raw `[SDK]` — keeps CR-001/CR-007 satisfiable; no per-site session check.
- **No `#if` guard at call sites** (CR-001 runtime).
- **Don't modify game logic** — only add the `SendAction` call (and its player-guard wrapper). Place it
  **after** the triggering logic. Propose each change before applying it.
- **No dangling non-ludeoable span** — every `StartNoneLudeable` is closed on every exit path.

## 6. Output Contract

- `LudeoActionKeys` filled with a constant per mapped gameplay action (non-gameplay names confirmed present).
- `SendAction` call sites inserted (gameplay — guarded/global per the map; non-gameplay boundary + pause),
  routed through the façade, with backups for edited game files.
- The **platform global-trigger mapping** action item documented for the integrator.
- A report: constants added (count); actions implemented X/Y; non-gameplay actions wired; low-confidence
  skipped (Z) with a per-action table (Action · File · class.method · Status); the global-trigger note;
  ready for the orchestrator's compile+log gate.
- **No compile / play performed** — that's the orchestrator's human gate.

## 7. ✅ Success Criteria

**Guideline phase-6 criteria this task feeds** (verified at the orchestrator's gate, not here):
- [ ] **Actions emit at runtime in Creator flow** and **in Player flow** — confirmed in the log.
- [ ] **player-id matches the id passed to `AddPlayer`** (via `SetGameplayerId`) — correct attribution.
- [ ] **Emission verified in logs.**

**Skill-specific pre-handoff criteria (satisfy before returning):**
- [ ] A `LudeoActionKeys` constant exists for every implemented action; call sites use constants, not literals.
- [ ] Every high/medium-confidence kept action inserted **after** its triggering logic; low-confidence skipped.
- [ ] Player-scoped actions with `⚠ needs player-guard` wrapped in the player-actor/subject check; global
      actions fired unguarded.
- [ ] **Nothing** from the Dropped table implemented.
- [ ] `StartNoneLudeable`/`StopNoneLudeable` emitted at the boundary sites with **no dangling open span**;
      `PauseLudeo`/`ResumeLudeo` at **every** pause — the player's menu, cutscenes/loading, **and the SDK's
      `PauseGameRequested`** (its freeze does not stop the objective timer). Once per transition.
- [ ] **No** `SendAction` gated on `IsInLudeoFlow`; all calls route through the `[Layer]` façade; no `#if` guard.
- [ ] The platform global-trigger mapping documented as a one-time out-of-code step; backups for edited files.

## 8. Common Mistakes

- **Compiling / playing here** — the orchestrator owns the (human-gated) compile + emission verification.
- **Gating `SendAction` on `IsInLudeoFlow`** — actions must fire in **both** flows.
- **Crediting the player with non-player actions** — missing the player-guard on a shared kill handler.
- **Implementing Dropped-table candidates** — re-introduces the bloat phase-6 task 1 filtered out.
- **Forgetting the non-gameplay emissions** or the **platform global-trigger** step.
- **A `StartNoneLudeable` with no `StopNoneLudeable`** on some exit path — capture stays suppressed.
- **Calling raw `[SDK]` `SendAction`** instead of the façade, or adding a `#if` guard at call sites.

## Related / Next

- Task 1 (`6a-map-game-actions.md`) — produces `GAME_ACTIONS_MAP.md`, the map this task implements.
- Phase 3 (`3-lifecycle-orchestrator.md`) — planned the non-gameplay standard actions emitted here; wired
  `SetGameplayerId` + the overlay pause (distinct from `PauseLudeo`).
- **Next (orchestrator):** run the phase-6 gate (recompile clean + each action emits in the log in **both**
  flows + correct attribution). When it passes, proceed to **phase 7** (validate the release build + upload
  it to the Ludeo platform).
