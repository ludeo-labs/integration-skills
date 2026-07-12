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
- [ ] **Phase / form index** (`int`) — the current stage of the fight
- [ ] **Phase thresholds already crossed** (`bool`/bitmask) — so restore doesn't re-trigger a "drop to
      50%" transition the boss is already past
- [ ] Vulnerability / stagger / armor-broken flag (`bool`) — the window the player is exploiting
- [ ] Aggro / target key (`06 §4` — the *player's* stable key, not a reference)
- [ ] Is alive/dead (`bool`)

### Encounter / fight-state singleton — CRITICAL
- [ ] **Phase timer — remaining, not elapsed** (`float`, `06 §9.4`) — enrage clocks, phase countdowns
- [ ] **Scripted-sequence cursor** (`int`) — current beat/step of any scripted attack rotation or set-piece
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
- The **in-flight attack/telegraph** mid-animation — transient; let it re-drive from the restored phase.
- The **intro cutscene** — not state; §5.

---

## 4. Spawn & triggers — the hard part

Bosses rarely use the normal enemy spawner (`06 §2.2`). They spawn on a **one-shot trigger**: an arena
`OnTriggerEnter`, a cutscene's end, an HP-threshold event on a mini-boss, a door/elevator, a wave-cleared
signal. That trigger typically does **much more than instantiate the boss** — it locks the arena, seals
the exit, starts the boss music, shows the health bar, disables the checkpoint, maybe despawns trash mobs.

On restore you must **instantiate the boss directly into its captured phase and reconstruct those
side-effects — without re-firing the trigger or its cutscene.**

- **Audit the spawn trigger's full side-effect set** before restoring the boss. List everything it does;
  each item is either (a) reconstructed from captured state (arena locked, music cued, health bar shown)
  or (b) deliberately skipped (the intro cutscene, §5). Missing one is the classic "boss is there but the
  arena's open and the music's silent" bug.
- **Guard the trigger with `!LudeoController.Instance.IsInLudeoFlow`** `[Layer]` — the same gating the
  batch-registration and spawn paths use (`06 §6`). In the play flow the boss comes from its bucket
  (`07 §4` two-pass), not from the arena trigger.
- **Restore invariants, not just the object.** If the trigger maintains manager-level bookkeeping (a
  "boss active" flag, a locked-doors set, an encounter counter), that bookkeeping is a **derived
  invariant** — recompute it from the restored ground truth, don't trust a replayed value and don't let a
  re-driven spawn path bump it N times. (This is the general side-effect rule; a boss is its worst case.)
- **Snap, don't ease** (`07 §5`, `07 §10.1`). Spawn the boss *at* its captured phase/pose; do not let a
  spawn animation, an intro dolly, or a `SmoothDamp` health-bar fill play in from a default — the moment
  must open mid-fight.

---

## 5. Cutscenes & scripted moments

- **Do not replay the intro cutscene on restore.** A captured boss moment is almost always the *fight*,
  not the cinematic. The cutscene is a one-shot beat, not tracked state — skip it (suppress, not freeze,
  `07 §10.1`), and snap straight to the captured fight state.
- **If a scripted sequence is *active* at capture** (a scripted attack rotation, a set-piece phase), track
  its **cursor** (§3) and snap the sequence to it on restore — do not run it from step 0.
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
wave restore gate). "Boss is standing there" is not a pass.

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
