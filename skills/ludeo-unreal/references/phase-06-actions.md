# Phase 06 — Actions

## 1. Goal / Purpose

Hook into the curated slice's gameplay events and report them as Ludeo actions via `SendAction`. Actions are the significant gameplay moments (kills, deaths, ability uses, objectives) that drive highlight generation and scoring in Studio Labs.

**Deliverables:**
- Action discovery for the curated slice (which events to track)
- SendAction implementation for each discovered action
- Integrator-confirmed action list
- F9 capture produces a highlight with visible actions in Studio Labs

---

## 2. Inputs (Input Contract)

```
Required:
  tddSections1-3: markdown  — Prior TDD sections (.ludeo/tdd/integration-tdd.md)
  codeMap: json              — .ludeo/code-map.json (event systems from Phase 2)
  curatedSlice: object       — integration.json → curatedSlice (entities, preliminary actions)
  workingPlugin: files       — Plugin from Phases 3-5 with lifecycle + state tracking

Optional:
  ludeoContext: MCP          — ludeo-context MCP server (QA event lists)
  sdkDocs: MCP              — sdk-docs MCP server (SendAction API details)
```

Before starting this phase, verify:

- [ ] Phase 5 completed — state tracking + Player Flow working for curated slice
- [ ] Plugin compiles with state tracking code
- [ ] CODE_MAP has `event_systems` populated (from Phase 2)
- [ ] `curatedSlice.actions` has preliminary action list (from Phase 2 analysis)

---

## 3. Steps

**Scope:** Only discover actions relevant to the **curated slice**. Full game-wide action discovery is deferred to Phase 8 (Expansion).

### 3.1 Minimum and Recommended Actions

Every FPS/TPS integration needs at minimum **Kill + Death**. But stopping at the minimum produces thin highlights. The recommended set for FPS/TPS games:

| Action | When It Fires | Priority | Why |
|--------|--------------|----------|-----|
| Kill | Player kills an enemy | **Required** | Core engagement metric, scoring |
| Death | Player dies | **Required** | Failure state, highlight boundary |
| Assist | Player assists in a kill | Recommended | Team play, shared moments |
| WeaponPickup | Player picks up a weapon/item | Recommended | Loadout context for playback |
| AbilityActivation | Player uses a special ability | Recommended | Skill expression, highlight moments |
| Accolade | Player earns an in-game accolade/medal | Recommended | Achievement moments |

For the curated slice, implement **Required + whichever Recommended actions have existing game events**. Don't create new game events for MVP — only hook into what already fires.

**Genre action catalog.** Load the matching `references/game-patterns/<genre>.md` (via `references/game-patterns/INDEX.md`) and use its Actions Catalog as the discovery shopping list. **For the MVP curated slice, implement only catalog actions whose game events already fire inside the slice** — do not add new game events for the MVP. The full catalog applies at Phase 8 expansion.

### 3.2 Discover Curated Slice Actions

Grep for events that fire during the curated slice's gameplay:

| What | How |
|------|-----|
| Kill/death events | `Grep("(OnKill\|OnDeath\|OnEliminated\|OnDied\|Damage.*Fatal\|Killed)", glob: "*.h")` |
| Ability/skill use | `Grep("(AbilityActivated\|OnAbilityUsed\|CastAbility\|UseAbility\|ActivateAbility)", glob: "*.h")` |
| Pickup/collection | `Grep("(OnPickup\|OnCollected\|OnItemPickedUp\|CollectItem)", glob: "*.h")` |
| Objective events | `Grep("(ObjectiveComplete\|ObjectiveProgress\|MissionComplete\|WaveComplete)", glob: "*.h")` |
| Weapon events | `Grep("(OnFire\|OnShoot\|WeaponFired\|OnWeaponSwap)", glob: "*.h")` |

**Filter for the curated slice:** If the action only fires in maps/modes not part of the slice, skip it for now.

### 3.3 Check Event System Type

From the CODE_MAP `event_systems`, determine how to hook into events:

| Event System | How to Hook |
|-------------|-------------|
| **Multicast delegates** | `AddDynamic` / `AddUObject` binding in Component |
| **GameplayMessageSubsystem** | `RegisterListener` with gameplay tag filter |
| **BP event dispatcher** (dynamic multicast) | Bind a **zero-arg `UFUNCTION`** to it via reflection — you don't need the delegate's param signature when you only need to know the event fired (see [[zero-arg-bind-to-bp-event-dispatcher-via-reflection]]) |
| **Custom event bus** | Follow the game's subscription pattern |
| **Direct function calls** | Override virtual function or wrap existing call |

### 3.4 Map Actions to SendAction Calls

For each confirmed action, define the SendAction parameters:

| Action Name | Player ID Source | Trigger Event | Additional Data |
|-------------|-----------------|---------------|-----------------|
| Kill | Killer's PlayerID | [delegate/event] | victim type (optional) |
| Death | Dead player's PlayerID | [delegate/event] | killer info (optional) |
| [SliceAction1] | [source] | [event] | [data] |

### 3.5 STOP — Pre-Flight Checklist

Before writing any action reporting code, confirm:

- [ ] Phase 5 compiles cleanly with state tracking + Player Flow code
- [ ] `.ludeo/export-check.md` is up to date — any new delegates/methods for action hooks have `GAMENAME_API`?
- [ ] Action list confirmed by integrator (from Section 4 questions)
- [ ] Event hook points identified for each action (delegate type, class, method name)

If any item is unchecked, go back and complete it before writing code.

### 3.6 Add Action Reporting to Existing Component

Extend the `ULudeoIntegrationComponent` from Phases 3-4 — do NOT create new classes.

Add to the component:
- `ReportAction(PlayerId, ActionName)` — generic action sender
- Per-action handler methods (one per tracked action)
- Event binding in `RegisterTrackedEntities` or after BeginGameplay

### 3.7 Binding Timing

Bind to action events AFTER BeginGameplay (same gate as state tracking). Unbind in EndGameplay cleanup.

### 3.8 Compile-Fix Protocol

Same as prior phases. Build after adding action handling code. If you cannot compile locally, request the human to build.

---

## 4. Questions to Ask the Human

**Keep it lean — 1-2 questions max.**

1. **"Here are the actions I found for [curated slice map]. Confirm this list:"** — Present the action table from 3.4. The integrator approves or adjusts. Default recommendation: Kill + Death + 1-2 slice-specific actions.
2. **Only if event hookpoint is ambiguous:** "I found multiple events that could represent [action]. Which one fires at the right time?"

---

## 5. Patterns to Apply

### 5.1 SendAction Pattern

**IMPORTANT: Actions must fire in BOTH Creator and Player Flow.** The SDK evaluates Ludeo scoring rules (goals, constraints) using actions during replay. Only state WRITING is Creator-only — action SENDING works in both flows. Do NOT guard `RegisterActionListeners()` with `if (bIsPlayerFlow) return`.

**Deduplication note:** For games using `UGameplayMessageSubsystem` or similar broadcast systems, the same gameplay event (e.g., elimination) may be delivered to multiple listeners, causing duplicate `SendAction` calls. If you observe duplicate actions in Studio Labs, add a timestamp-based dedup guard (e.g., ignore duplicate Kill actions for the same victim within 0.5s). Don't add dedup proactively — only if duplicates are observed.

Actions are reported through the RoomWriter. The pattern is identical for all action types:

```cpp
void ULudeoIntegrationComponent::ReportAction(const FString& PlayerId, const FString& ActionName)
{
    FLudeoRoom* Room = GetActiveRoom();
    if (!Room || !bGameplayActive) return;

    FLudeoRoomWriter RoomWriter = Room->GetRoomWriter();

    // FLudeoRoomWriterSendActionParameters: FString PlayerID, FName ActionName
    FLudeoRoomWriterSendActionParameters Params;
    Params.PlayerID = PlayerId;
    Params.ActionName = FName(*ActionName);

    RoomWriter.SendAction(Params);
}
```

### 5.2 Hooking into Game Events

Bind to game events in the Component's `BeginPlay` or after BeginGameplay. Example patterns:

**Delegate binding:**
```cpp
// In RegisterTrackedEntities or after BeginGameplay
GameState->OnPlayerKill.AddDynamic(this, &ThisClass::HandlePlayerKill);

void ULudeoIntegrationComponent::HandlePlayerKill(APlayerState* Killer, APlayerState* Victim)
{
    FString KillerID = GetPlayerID(Killer);
    ReportAction(KillerID, TEXT("Kill"));
}
```

**Gameplay message listener:**
```cpp
UGameplayMessageSubsystem& MsgSubsystem = UGameplayMessageSubsystem::Get(this);
MsgSubsystem.RegisterListener(TAG_Kill, this, &ThisClass::HandleKillMessage);
```

**BP event dispatcher (zero-arg reflection bind):** BP-only games often expose the moments you
want (pickup, mine placed, spotted, died) as **Blueprint event dispatchers** (a BP "Event
Dispatcher" is a dynamic multicast delegate). When you only need to know the event *fired*
(attribution is the single local player or otherwise known), you don't need the dispatcher's
parameter signature — bind a **zero-arg `UFUNCTION`** to it via reflection
(`FMulticastDelegateProperty::AddDelegate` + an `FScriptDelegate`); `ProcessEvent` uses the bound
function's own (empty) layout and ignores the broadcast payload. This is the natural hook for
discrete events that have no clean pollable signal. Bind in both flows, unbind in teardown, and
log a one-shot "bound + per-fire" line to confirm it actually broadcasts. Full helper and caveats:
[[zero-arg-bind-to-bp-event-dispatcher-via-reflection]].

### Poll-based action detection (when delegates aren't viable)

Delegate / message-subsystem hooks are the first choice. But in many BP-only games — especially with marketplace AI packs — enemies **ragdoll on death with no death delegate**, or the death signal is **named differently across enemy families** (e.g. a basic enemy vs. a boss vs. a creature). When no uniform delegate exists, detect actions by **polling**.

**Pattern:** one per-tick world iteration, run in BOTH Creator and Player Flow, gated on gameplay-active and `!IsPaused`. Rebuild the tracked-entity cache each poll so that an actor **despawning is not treated as a kill** — a kill is an observed state transition, not an actor disappearing.

- **Dual-signal death read:** prefer the explicit death **flag** (e.g. `IsDead`), fall back to `Health <= 0`. Do not assume one uniformly-named Health property across families (see [[enemy-death-signal-varies-across-families]]).
- **Per-family reachability:** a leaf variable dump can hide inherited state (a boss may show no leaf Health because it's declared on a base class). Confirm the set/clear sites with the BP **call-graph** (`graph` / `graph-function`) or `inspect-path --resolve-inherited`, not a leaf dump.
- **Additive, multi-axis emission:** emit the kill on multiple axes (the enemy type AND the weapon/how, read from the wielded item at kill time) rather than one combined name (see [[additive-action-emission-for-composable-goals]]).
- **Survived-a-hazard actions** (grab / QTE / finisher): poll the hazard's own state-flag transition, gated on player-alive, to distinguish *escaped* from *died* (see [[survival-event-action-via-state-flag-transition]]). Watch the revive edge.
- **"X used" actions (ability / item / weapon):** do **not** poll a `LastUsedX` / `CurrentX` convenience field without first confirming it's actually *written* on the use path (a BP-graph `Set` node) — such fields are often vestigial and never fire. The reliable signal is the **consumable-resource transition** the use causes: a charge consumed (count drops) or a cooldown started (timer rises) — guard against a per-turn cooldown-reduction step that only *lowers* (see [[last-used-field-not-written-poll-resource-transition]]).
- **Per-class action tokens:** when emitting a named bucket (`Destroy<UnitClass>`, `Kill<EnemyType>`) alongside the broad action, derive the token from the **actual runtime class name** (`GetClass()->GetPathName()`, resolving a puppet/visual to ITS class first) and strip **every** wrapper/family prefix (`BP_`, project wrappers, family codes). Log the derived token on the first events — a missed prefix silently yields a non-matching token while the broad action keeps firing and the build stays green (see [[per-class-action-token-strip-runtime-class-prefixes]]).

Poll-based detection must run identically in Player Flow — replayed highlights must re-emit actions (see [[actions-must-fire-in-player-flow-too]]).

### 5.3 Action Naming Convention

Use PascalCase action names matching the SDK convention:
- `Kill`, `Death`, `PickupCollected`, `AbilityUsed`, `ObjectiveComplete`
- Keep names short, descriptive, and consistent
- These names appear in Studio Labs goals/scoring configuration

### 5.4 Verifying actions on the cloud — bake in stdout diagnostics first

A Shipping cloud build strips `UE_LOG(..., Log/Verbose, ...)`, and the SDK may deliver actions
over a transport that your local HTTP-side logs never show — so a cloud `*.log` can contain
**zero** `[Ludeo]` / `SendAction` / action markers, leaving you blind to the very action you're
verifying. If an action (or any Player-Flow feature) will be confirmed on the cloud, add
`printf` + `fflush(stdout)` diagnostics for it **before the first cloud test**, not after a bug
surfaces — stdout is the channel the platform's central log collector ingests. Keep a fixed
grep-able prefix and strip the firehose once confirmed. See
[[diagnostics-to-stdout-for-cloud-logs]].

---

## 6. Output Contract

After implementation, record in `.ludeo/tdd/integration-tdd.md`:

```markdown
## Phase 6: Actions (Curated Slice)

### Actions Tracked
| Action | Event Source | Hook Type | Player ID Source |
|--------|-------------|-----------|-----------------|
| Kill | [delegate/class] | [AddDynamic/listener] | [how PlayerID is obtained] |
| Death | [delegate/class] | [hook type] | [source] |
| [SliceAction] | [source] | [hook type] | [source] |

### Event System
- Primary: [delegates / GameplayMessageSubsystem / custom]
- Hook location: [Component method that binds listeners]

### Key Decisions
- [Action selection rationale]
- [Hook point choices and alternatives considered]
```

```
Produces:
  tddSection4: markdown     — Significant Actions section appended to TDD
  actionCode: files          — SendAction calls wired to game events
  curatedSlice.actions: []   — Updated in integration.json with confirmed action list
  decisions[]: Decision[]    — Appended to integration.json
```

---

## 7. ✅ Success Criteria

- [ ] Action list mapped to `file:line` emit points
- [ ] Actions named from the player's perspective
- [ ] Matched to reference action names where they exist
- [ ] Actions emit at runtime in Creator flow
- [ ] Actions emit at runtime in Player flow
- [ ] player-id matches the id passed to AddPlayer
- [ ] Emission verified in logs

---

## 8. Common Mistakes

### 8.1 Sending Actions Before BeginGameplay
Actions sent before BeginGameplay are silently dropped. Gate all action reporting on the gameplay-active flag.

### 8.2 Wrong Player ID
`SendAction` requires the player ID string that was used in `AddPlayer`. If the IDs don't match, the action is attributed to nobody. Use the same PlayerID source throughout the integration.

### 8.3 Duplicate Actions
Some games fire kill events multiple times (once per damage source, once per game state update). If you see duplicate actions in Studio Labs, add a deduplication guard. **For MVP, don't add dedup proactively** — only add it if duplicates are observed.

### 8.4 Missing Action Names in Studio Labs
Actions only appear in Studio Labs goals/scoring if they've been reported at least once. After implementing, play through the curated slice, press F9 to capture, and verify actions appear in the Studio Labs highlight inspector.

### 8.5 Forgetting to Unbind
If action event delegates aren't unbound during cleanup, they can fire after the room is closed, causing errors. Always unbind in the same cleanup path as state tracking teardown.
