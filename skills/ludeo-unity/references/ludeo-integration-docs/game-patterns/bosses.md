# Boss Encounter Patterns (Unity)

> **Applies to:** any game with **boss / named / scripted-encounter** enemies — action, RPG, shooter,
> soulslike, roguelike, platformer, bullet-hell. A "boss" here is any enemy whose fight is a *scripted,
> stateful sequence* (phases/forms, an intro or transition cutscene, a locked arena, summoned adds, a
> unique spawn trigger), not just a high-HP mob.
> **Load when:** the intake (`phase 0`) or census (`phase 3`) says the game has bosses. Load this **in
> addition to** the genre file(s) — it is a **gameplay-structure** pattern, orthogonal to genre and to the
> world-structural files (open-world / procedural).
>
> **Legend:** `[SDK]` = Ludeo package API · `[Layer]` = prescribed façade
> (`unity/REFERENCE-ARCHITECTURE.md`) · `[Unity]` = engine API.
>
> **Status — framework, not a closed catalog.** Boss integration has real unknowns (§8). This file is the
> accumulated doctrine so far; when a game breaks it, record the case in `OBJECT_TRACKING.md` Open
> Questions and treat §8 as the growth list.

---

## 1. Why bosses are their own pattern

A boss fight is the archetypal Ludeo highlight — and the archetypal integration trap. The naive read is
"a boss is an enemy with more HP," so it gets tracked like any mob (position, health) and the replay
**looks** right on frame 1 and then **can't play through**: the boss stands inert, never enters phase 2,
the arena isn't locked, the music never cues, the adds never come.

The reason: a boss's *behavioral* state — which phase/form it's in, where it is in a scripted beat, the
arena lock, the summoned adds, the vulnerability window — is normally **established by triggers and
cutscenes that fire once** (arena entry, a cutscene's end, an HP-threshold event). Restoration is
snapshot-not-replay (`07 §1.1`): it must **not** re-fire those one-shot triggers, but it **must**
reconstruct the state they left behind. That is the whole difficulty, and it is exactly the
borrowed-path / side-effect problem (§4) applied to the most side-effect-heavy object in the game.

So a boss is **two things to track**, not one:
1. **The boss entity** — a distinct object type, flagged **`IsBoss`** so it never gets swept into the
   generic-enemy bucket or counted as one (§6, and `06 §9`). Usually a collection-of-one; capture its own
   stable key regardless (`06 §4`).
2. **The encounter / fight state** — a `SessionState`/`Continuity`-style singleton *scoped to this fight*
   (the same shape as phase 3's world/time-base singleton, mirrored per encounter): phase index, phase
   timer **remaining**, scripted cursor, arena-lock, adds-alive, music cue. **This is the load-bearing
   part integrations miss.**

---

## 2. Census & wave placement (`phase 3`)

- **A boss in the captured moment is load-bearing → Wave 1.** If the highlight is (or includes) a boss
  fight, the boss entity **and** its encounter-state singleton are load-bearing (the moment is visibly
  wrong AND unresumable without them). Do not defer either to a late wave (phase 3's load-bearing
  guardrail).
- **Record two object types**, not one: the `Boss` entity and the `<Boss>Encounter`/fight-state singleton
  (§1). The encounter singleton is easy to miss — it lives on a manager, not a visible GameObject (same
  blind spot as the time-base singleton in phase 3's census).
- **Adds/minions the boss summons are their own type** (§6), waved with the boss when they're in view at
  capture, else the next wave.
- If the boss *only* appears in moments you would never curate as a Ludeo, it may not be load-bearing at
  all — confirm against the intake's "what is a good highlight" answer before pulling it into Wave 1.

---

## 3. What to capture (boss tracking checklist)

Verify after this wave's tracking is implemented (`phase 9`). Types map to `[SDK]` `SetAttribute`
overloads. Tiered by restoration priority: **CRITICAL** (restore or the fight can't play through),
**IMPORTANT** (fidelity), **SKIP** (derived/transient — do not track, `06 §9.3`).

### Boss entity — CRITICAL
- [ ] Position, rotation (`Vector3`/`Quaternion`)
- [ ] Health / HP, and **max HP if it changes per phase**
- [ ] **Phase / form index** — the current stage of the fight. **Where this lives may not be a field you
      can read — §4.1 before you plan its capture.**
- [ ] **Phase thresholds already crossed** (`bool`/bitmask) — the re-trigger guard: without it restore
      re-fires a "drop to 50%" transition the boss is already past (the mechanism is §4.3)
- [ ] Vulnerability / stagger / armor-broken flag (`bool`) — the window the player is exploiting
- [ ] **Current attack / action** — which attack or ability is *executing right now*, and its progress.
      The moment is often the boss **mid-attack**, so this is part of the reconstructed moment, not
      transient — it lives where phase lives (§4.1) and reconstructs the same way (§4.6)
- [ ] **Locomotion / stance** — charging, airborne, burrowed/untargetable, staggered — the movement mode
      the attack/phase implies
- [ ] **Active hitboxes / damage windows** — which are live this frame (or recompute them from the
      restored attack + progress, §4.6)
- [ ] Aggro / target key (`06 §4` — the *player's* stable key, not a reference)
- [ ] Is alive/dead (`bool`)

### Encounter / fight-state singleton — CRITICAL
- [ ] **Phase timer — remaining, not elapsed** (`float`, `06 §9.4`) — enrage clocks, phase countdowns.
      Remaining is the **re-arm input** (§4.5); captured but never re-armed, it's inert.
- [ ] **Scripted-sequence cursor** — current beat/step of any scripted attack rotation or set-piece (often
      a Timeline playhead, not an `int` — §4.1)
- [ ] **Arena state** — locked/exit-sealed (`bool`), any raised barriers/hazards active
- [ ] **Adds alive** — see §6; **recompute from the restored adds, do not capture a replayed counter**
- [ ] Encounter phase of the fight itself if distinct from the boss form (intro-done / active / enrage)

### Boss music / cue — IMPORTANT
- [ ] Whether the boss track is playing + its position if the moment is rhythm/cue-sensitive
      (`06 §9.4` remaining-time clocks). Often restored as "play the boss track from the top" — acceptable
      unless the beat matters.

### Adds / summoned minions — CRITICAL if in view (own type, §6)
- [ ] Their own transform, health, `IsMinion` flag, and **owner = boss's stable key**

### SKIP (derived/transient — never track)
- Boss **health-bar UI** — derived from HP; rebuild it from restored HP (`06 §9.3`, `07 §7`).
- The **intro cutscene** — not state; §5.

> **Do not add the boss's live attack to SKIP.** The mid-attack telegraph is usually *the moment* — it is
> **captured**, not re-driven from a fresh AI decision (§4.6).

---

## 4. The hard part — behavioral state, spawn & scripted triggers

The §3 checklist quietly assumes the fight's phase is a value you can read and write, and that spawning
the boss reconstructs the fight. Both are usually false: the phase often lives somewhere you can't
`SetAttribute`, the only path that sets it fires through the trigger you're suppressing, and that trigger
started *processes*, not just state. These are the sub-problems that actually block a boss restore —
work them in this order. **§4.1–§4.3 are where most boss integrations get stuck; the checklist above
won't rescue you if you skip them.**

### 4.1 Where the fight's "phase" actually lives — find it before you plan its capture

`phaseIndex` as a plain field is the lucky case. Find where phase really lives *first*:

- **A field / FSM enum on the boss** (`currentPhase`, a state enum) — capture it directly. Easy case.
- **An Animator state machine** `[Unity]` — the phase *is* the active state; there's no field. Capture the
  layer's `AnimatorStateInfo.fullPathHash` + `normalizedTime`; restore via
  `Animator.Play(hash, layer, normalizedTime)`.
- **A Timeline / `PlayableDirector`** `[Unity]` — a scripted beat *is* `director.time`. Capture `director.time`
  (+ which `PlayableAsset`, if it swaps); restore by setting `time` then `Evaluate()`, and stop it
  auto-playing from zero (`playOnAwake = false`, or `Stop()` before seeking). See §5.
- **A behavior tree / visual-scripting / state-machine asset** — the "current node" is usually **not**
  serializable and exposes no public cursor. You need the game to surface a phase accessor, or you
  approximate with the nearest observable proxy (HP band, active animator state).
- **A running coroutine** — phase is implicit in *which coroutine is suspended, and where*. A yield point
  **cannot be serialized.** There is nothing to capture: derive phase from an observable field, or add one.

> **If phase isn't already a discrete, readable + writable value, making it one is the central work item
> of this integration** — add a small explicit `Phase` field/accessor **in the boss's own code** (the
> Ludeo layer can't faithfully observe an Animator/coroutine from outside). If you can neither find nor
> add one, record it as an Open Question at the census — it may gate whether the boss is restorable at all.

### 4.2 Restoring into a phase — you need an entry seam

There is no rewind API. Writing `hp = 40%` + `phaseIndex = 2` as attributes does **not** make the AI
*behave* like phase 2 — it sets numbers, not behavior (which attack set, movement mode, enabled hitboxes,
active adds). To actually enter phase 2 you must run the game's **phase-entry logic**:

- **A public entry point exists** (`EnterPhase(n)` / `SetPhase` / `GoToPhase`) → call it from the Ludeo
  layer, *after* the data attributes are applied.
- **None exists** → add the **smallest possible game-code seam**: a public method that enters phase N
  *without* the cinematic / announcement / summon-intro that normally precedes it. **This is the
  sanctioned exception to "prefer the Ludeo layer, minimize game edits"** — integration correctness comes
  first (SKILL.md's own rule). Keep the seam idempotent and cutscene-free, audit it for side-effects
  (§4.4), and don't let it re-spawn adds you've already restored.
- **Order:** apply the data attributes (HP, position — §3) **first**, then call the phase-entry seam so it
  doesn't clobber restored HP, and set the §4.3 guards so it doesn't immediately re-fire.

### 4.3 One-shot transition guards — restore every latch or the phase re-fires

Games make a transition one-shot with a latch:

```csharp
if (hp < 0.5f * maxHp && !m_enteredPhase2) { EnterPhase2(); m_enteredPhase2 = true; }   // [Unity]
```

Restore `hp = 40%` **without** `m_enteredPhase2 = true` and the very next damage tick (or `Update`)
re-fires `EnterPhase2()` — often every frame, so the transition stutters or the intro replays forever.
**Every latch the captured phase is already past must be captured and restored set** — this is what the
"thresholds already crossed" bitmask (§3) is *for*; it's the mechanism, not fidelity polish.

- **Find them:** grep the boss's damage handler / `Update` / phase code for one-time latches —
  `bool m_has*/m_is*/m_entered*/m_did*` paired with an `hp`/threshold comparison, and one-shot coroutine /
  `DOTween` / `UnityEvent`-removed guards. Each latch gating a transition **earlier** than the captured
  phase → restore it set.
- Missing one is invisible at capture and only shows up as a re-trigger at replay — exactly why §8 makes
  you play the moment *through* rather than eyeball frame 1.

### 4.4 The spawn trigger & its one-shot side-effects

Bosses rarely use the normal enemy spawner (`06 §2.2`). They spawn on a **one-shot trigger**: an arena
`OnTriggerEnter`, a cutscene's end, an HP-threshold on a mini-boss, a door/elevator, a wave-cleared signal.
That trigger does **much more than instantiate the boss** — it locks the arena, seals the exit, shows the
health bar, disables the checkpoint, maybe despawns trash mobs.

- **Audit the trigger's full side-effect set** before restoring. Each item is either reconstructed from
  captured state (arena locked, health bar shown) or deliberately skipped (the intro cutscene, §5).
  Missing one is the "boss is there but the arena's open" bug.
- **Guard the trigger with `!LudeoController.Instance.IsInLudeoFlow`** `[Layer]` — as the `06 §6`
  spawn/batch paths do. In the play flow the boss comes from its bucket (`07 §4` two-pass), not the trigger.
- **Restore invariants, not just the object.** If the trigger maintains manager-level bookkeeping (a
  "boss active" flag, a locked-doors set, an encounter counter), recompute it from restored ground truth —
  don't trust a replayed value or let a re-driven spawn path bump it N times.
- **Snap, don't ease** (`07 §5`, `07 §10.1`) — spawn the boss *at* its captured pose/phase; no spawn
  animation, intro dolly, or `SmoothDamp` health-bar fill easing in from a default.

### 4.5 Re-arm the ongoing processes the trigger started

The trigger doesn't only set one-shot state — it **starts ongoing processes**: the enrage-timer coroutine,
the periodic summon loop, aggro acquisition, the boss music. Suppress the trigger (§4.4) and none of them
start, so the fight **freezes** even with every value restored.

- **One-shot state** (§4.4) you set once. **Ongoing processes you must re-arm** at their captured value:
  start the enrage coroutine at the **remaining** time (§3), seed the summon loop's next-summon time +
  budget from the restored adds-alive (§6), set the boss's aggro target to the restored player (Pass 2,
  `07 §6`), start the boss track (soundtrack presence, `07 §8`).
- This is why §3 captures the timer as **remaining**: remaining is the re-arm input. Captured but never
  re-armed, it's inert.

### 4.6 The live attack — reconstruct it, don't re-roll it

The skill's goal is to drop the player into a **perfectly reconstructed moment**, and for a boss that
moment is frequently the boss *mid-attack* — the wind-up the player is dodging, the beam they're outrunning.
Restoring the boss idle in the right phase throws the moment away. So **capture the boss's live attack**,
not just its phase.

- **It lives where phase lives (§4.1).** The current attack is an Animator state + `normalizedTime`, the
  current node of an attack-selection FSM, or a mid-run attack coroutine — capture and restore it with the
  same §4.1/§4.2 mechanics (state hash + normalized time, or a `PlayAttack(id, atProgress)` seam if none is
  public). Capture the attack **id + progress** plus the boss's **locomotion/stance** (§3) so pose and
  movement match.
- **Force the captured attack — do not let selection re-roll it.** Attack choice is usually RNG, so a plain
  snapshot-not-replay restore lets the AI pick a *fresh* attack and the moment shows a different move than
  the one captured — tolerable in a generic fight, **fatal when the moment *is* that attack.** Set the boss
  into the captured attack at its captured progress; let the *next* attack re-roll naturally.
- **In-flight projectiles / AoE telegraphs / damage volumes are their own tracked objects.** A bullet-hell
  boss's moment is mostly the bullets on screen — track them as a collection (own keys, `06 §4`); for
  attacks that spawn deterministically from (attack id + progress), **recompute** them on restore instead
  of storing each. Active melee **hitboxes** follow the same rule: restore the attack at its progress and
  let hitbox enablement follow, or set the enabled set explicitly (§3).
- **Fidelity has a cost — scope it to the moment.** Frame-exact projectile positions matter for a
  bullet-hell; for a slow telegraphed slam, attack id + progress is enough. Capture to the granularity the
  highlight needs (the intake's "what is a good highlight" answer), not more.

---

## 5. Cutscenes & scripted moments

- **Do not replay the intro cutscene on restore.** A captured boss moment is almost always the *fight*,
  not the cinematic. The cutscene is a one-shot beat, not tracked state — skip it (suppress, not freeze,
  `07 §10.1`), and snap straight to the captured fight state.
- **If a scripted sequence is *active* at capture** (a scripted attack rotation, a set-piece phase), track
  its **cursor** (§3) and snap the sequence to it on restore — do not run it from step 0. When the sequence
  is a Timeline/animator, the cursor and the snap mechanics are §4.1.
- **Capturing a moment mid-cutscene is an open question** (§8) — most integrations should curate the
  playable fight, not the cinematic. If the game genuinely needs a mid-cutscene Ludeo, record it and
  escalate rather than guessing.
- Gate any cutscene/sequence *trigger* on `!IsInLudeoFlow` so the play flow never re-enters it.

---

## 6. Minions / adds — classification flags travel with the count

Boss-summoned adds are enemies, but **not every Enemy is *an* enemy** for counting purposes.

- **Track adds as their own object type** with their own stable keys (`06 §4`) and an **`IsMinion`**
  (and/or `owner = boss key`) classification flag. On restore they spawn into their own bucket and resolve
  their owner by matching the boss's key in Pass 2 (`07 §6`).
- **Any classification flag that gates counting must be captured alongside the count.** If the level's
  "enemies remaining" tally excludes boss adds (or the boss itself), then `IsBoss`/`IsMinion` must travel
  with whatever the tally reads — otherwise the restored tally is wrong and an objective never completes.
- **Recompute "adds alive" from ground truth** on restore — count the restored, still-alive minions;
  never restore a captured counter and never let a re-driven summon path re-increment it (§4). Same rule
  as any derived aggregate.

---

## 7. Actions (`phase 5`/`phase 6`)

Boss beats are high-value Ludeo objectives/scoring. Map via `[SDK]`
`LudeoGameplaySession.SendAction(string)` (`[Layer]` `LudeoController.SendAction`). Apply phase 6's keep
test; scope per the note below.

| Action Name | Tier | Description | Scope | Objective / Scoring |
|-------------|------|-------------|-------|---------------------|
| `BossKill` | T1 | Boss defeated (canonical name; matches `rpg.md`/`survival-sandbox.md`) | **global** — fire once | "Defeat the boss" / 1000 pts |
| `BossPhaseTransition` | T1 | Boss entered a new phase/form | **global** | "Reach phase 2" / 200 pts |
| `BossEncounterStart` | T2 | Fight began (arena locked) | **global** | — / — |
| `BossEnrage` | T2 | Boss enraged / final phase | **global** | — / bonus |
| `PlayerDeathToBoss` | T2 | Player died to the boss | **player-scoped** — guard on player as subject | inverse objective |

- **Most boss lifecycle actions are global** (fire once, no player-actor guard) — like `WaveComplete` /
  `MatchWin` (`INDEX.md`). Only player-subject beats (death to boss) are player-scoped.
- **Emit in both flows.** Like every action, a boss action must fire in the Creator flow **and** the
  Player (replay) flow — verify at phase 5's gate.

### Search keywords
```
boss, miniboss, elite, named, encounter, arena, phase, stage, form, transformation
enrage, berserk, desperation, secondPhase, nextPhase, OnPhaseChange, TransitionTo
summon, addSpawn, minion, adds, spawnWave, OnSummon
cutscene, Timeline, PlayableDirector, sequence, scripted, Cinemachine, dialogue, intro
OnBossDefeated, OnBossDeath, BossDefeated, victory, lockArena, sealExit, closeGate
health-bar, bossBar, BossHealthUI
```
In Unity, watch for `PlayableDirector`/`Timeline`/`Cinemachine` (cutscenes), `UnityEvent`/`On*` phase
callbacks, and arena `OnTriggerEnter` locks.

---

## 8. Restore verification & known unknowns

**Verify the fight *plays through*, not just that the boss appears.** The frame-1-looks-right trap is
worst for bosses. At this wave's restore gate: play the restored Ludeo and confirm the boss enters its
next phase, the arena stays locked, adds spawn, and the fight can reach its win/lose condition — then
watch the derived counters (adds-alive, enemies-remaining) match ground truth as it plays (the phase 4
wave restore gate). Confirm the moment **opens on the captured live attack** (§4.6), not a fresh idle.
"Boss is standing there" is not a pass.

> **Expected divergence, not a bug:** the boss's *next* attack after the captured one will differ run to
> run (attack selection is RNG — snapshot-not-replay). Only the **captured** live attack + state must
> match on open; the fight legitimately plays out differently after. Don't chase this into a false failure.

**Known unknowns — record the case and escalate; grow this list.**
- **Mid-cutscene capture / QTE beats** — curating a Ludeo *inside* a cinematic or quick-time event (§5).
- **Boss that transforms into a different prefab per phase** — is it one tracked entity with a form index,
  or a spawn/despawn across phases? Affects the stable key.
- **Persistent boss** (`DontDestroyOnLoad` / carried across scene loads) — reconcile like any persistent
  singleton (match + reset to baseline, `07 §9`), not spawn.
- **Multi-boss / co-op boss arenas** — several encounter singletons live at once; keying and adds-ownership
  get harder.
- **Environmental / "arena is the boss" mechanics** — hazards, phases driven by world geometry rather than
  an enemy GameObject; the encounter state may live entirely in the world/level identity type.
- **Boss with an offscreen/global aggro or a shared health pool across sessions** — out of the
  single-session snapshot model; flag it.
