# Phase 3 — Map Game Objects (Unity)

> Guideline phase 3 ("map game objects (sub-set)"). This phase does the **up-front CENSUS only** (Part A):
> enumerate every trackable GameObject **type**, flag the **load-bearing** ones, and assign each a **wave**.
> The **deep per-entity scoping** (properties, stable keys, hook sites, references, reconciliation matrix)
> lives in **Part B**, which the **phase-4 wave loop invokes once per wave, scoped to that wave's types** —
> not all at once here. **No code in either part.**
>
> **Why split this way (the iterative model).** Discovering everything *deeply* up front produces one large
> plan a human rubber-stamps, and a wrong key for a late-wave type only surfaces at that wave's restore gate.
> Scoping deep discovery *per wave* keeps each pass small and verified at its own gate — but risks never
> *looking* at a load-bearing subsystem. The census (Part A) is the cheap middle: it **sees every type**
> (so nothing load-bearing is silently deferred) while staying shallow enough to review. See
> `06-TRACKING-PATTERNS.md §1.1` on iterative capture↔reconstruct cycles.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Produce the **census + wave plan** at the top of `OBJECT_TRACKING.md`: how the game spawns/owns objects,
the full list of GameObject **types** to track (the sub-set), a **load-bearing flag** per type, and a
**wave assignment** per type — **Wave 1** being the minimal *restorable spine* (world/level identity +
player singleton + time-base/continuity) **plus the few collection types the moment is visibly wrong
without**. The **deep-scope detail** for each type (Part B) is filled **per wave by phase 4**, appended to
the same file. Output (Part A) is human-approved before the phase-4 wave loop begins.

## 2. Inputs (Input Contract)

- [ ] **Fresh agent session.** If you see prior tool calls or CODE_MAP references, **STOP** and ask the
      user to start a fresh session and continue here.
- [ ] **Phase 1** → `ludeo-integration-plan/CODE_MAP.json` — classes, `event_systems`,
      `session_boundaries`, `object_model`, `non_ludeoable_candidates`, the **game-level `save_system`
      block** (mechanism/format/group/entry_points, `per_entity: []`), `serialization`.
- [ ] **Phase 2** → `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (boundaries / hook map).
- [ ] **Phase 0** → `ludeo-integration-plan/INTAKE.md` — the game-level save-system classification
      (the narrative source; the structured form is `CODE_MAP.save_system`). **No `phase 2c` /
      `GAME_ANALYSIS_SAVE_SYSTEM.md`** — 2c is retired; the **per-entity** matrix is built in Part B.
- [ ] Recommended: if `ludeo-integration-plan/TDD_<GameName>.md` exists, read its **State Capture** section.
- [ ] Context files read:
  - `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — **§1.1** (iterative wave rollout — the model this
    phase implements), **§1.4** (attributes vs blobs — default attributes), **§2** (spawn/own
    classification), **§4** (identity by bucket + your own key, no ID map), **§6** (batch registration),
    **§9** (what-to-track decision guide).
  - `ludeo-integration-docs/game-patterns/INDEX.md` — the genre/structural pattern index (load matching
    file(s) in Part A Step A3 — see §5).

---

## 3. Steps

The phase is two parts. **Part A runs once, here**, and ends at a human gate. **Part B is a reusable
procedure the phase-4 orchestrator invokes once per wave** (`references/9a-deep-scope-wave.md` dispatches
it, scoped to that wave's types). Run only Part A in this phase.

---

## Part A — Census (run ONCE, in this phase)

### Step A1: Read prior artifacts
From `ludeo-integration-plan/`: `CODE_MAP.json` (classes, `event_systems`, `session_boundaries`,
`object_model`, `non_ludeoable_candidates`, the game-level `save_system` block), `INTAKE.md` (the
save-system classification narrative), `SDK_INTEGRATION_POINTS.json` (boundaries), and
`TDD_<GameName>.md` if present.

### Step A2: Classify how the game spawns & owns objects (foundation)
Apply `06-TRACKING-PATTERNS.md §2`: §2.1 direct `Instantiate`/`Destroy`, §2.2 central spawner/manager,
§2.3 object pool, §2.4 prefab/data-driven, §2.6 per-tick sweep (fallback), §2.7 manager/serializer-driven
sweep (strong-save games with a stable-id save manager but **no live-GameObject enumerator** — sweep the
serializer as the capture source; mind the floor-not-ceiling caveat). Unity games mix patterns;
**classify per subsystem.** Common happy path: §2.2 (spawner) + §2.5 (save-system as a discovery input).

Record per subsystem: the **register hook** and **unregister hook** (file:line). The detailed
property-sample strategy, batch-enumeration path, and pattern pitfalls are confirmed in **Part B** per
wave — here, just the spawn/own classification + the hook sites (they decide the wave-1 vs later split).

> **⛔ DOTS / ECS stop-gate.** If the trackable state lives in **Entities / DOTS** (`IComponentData`,
> `SystemBase`/`ISystem`, Burst), the SDK has **no supported path** (`06 §2` callout). Stop and tell the
> user: the parts to be Ludeo-tracked must be GameObjects. Only the GameObject side of a hybrid project
> can be planned here.

### Step A3: Determine genre & load the tracking checklist
- Web search `"<game_name>" game genre`; ask the user if it fails.
- Read `game-patterns/INDEX.md`, load the matching genre file(s) (`shooter` / `rts` / `racing` / `rpg`
  / `survival-sandbox`); hybrid games load multiple.
- **If `session_boundaries` has the `{ model, start_sites[], exit_sites[], pause_overlay[] }`
  sub-structure** (open-world / streaming / sandbox), also load **both** `game-patterns/open-world.md`
  and `game-patterns/open-world-tracking.md` — the tracking delta: **presence ≠ existence** (don't
  unregister on stream-out), world/cell object types, persistent-world-id identity across stream cycles,
  scoping the tracked set to the loaded neighborhood.
- **If the game has bosses** (INTAKE "Bosses? yes", or a boss / named / scripted-encounter type surfaces
  during discovery), also load `game-patterns/bosses.md` — a boss fight is a load-bearing, scripted
  encounter with a unique spawn trigger, phases/forms, an intro cutscene, and summoned adds, whose state
  restoration must reconstruct without re-firing the trigger. It drives the boss's wave/load-bearing flags
  below and its per-wave scoping in Part B.
- **If `session_boundaries.assembly == "procedural"`**, also load `game-patterns/procedural-world.md` —
  add a singleton **`RunMetadata`** objectType (§3) capturing the **generation inputs** (selection id,
  sub-roll id, progress cursor, scaling counter) as stable asset names/values; default to **resolved**
  capture (§4). First answer §2.1's decisive question: one room live → `RunMetadata` is the container;
  several rooms live → **procedural ∩ open-world**, also load `open-world-tracking.md` and add
  layout/connectivity + per-room `ChunkDelta` objectTypes.

Use each genre file's **§3 Tracking Checklist** as a **validation checklist** — what *should* be tracked.
Actual hook sites + field names still come from the codebase (confirmed in Part B).

### Step A4: Enumerate trackable GameObject TYPES + flag the load-bearing ones
Combine the genre checklist with codebase discovery. Apply `06 §9.2` to each candidate: visible during
gameplay? influences a tracked object? referenced by a tracked object? If any → track; else skip. **When
in doubt, track** (`06 §9.1`).

For each **type** record (census level — *not* full properties/keys; those are Part B): class, file:line,
spawn pattern (dynamic / scene-placed / both), whether it streams in/out (+ its **persistent world id**,
`open-world-tracking.md §4`), and a **load-bearing flag**:

> **⚠️ An entity is a SUBSYSTEM, not the single class you name here.** The `class, file:line` you record
> is only the **anchor** — a type's state routinely lives across **several components / managers /
> ScriptableObjects**, not on the anchor MonoBehaviour. The player especially: `PlayerController` holds
> transform + health, but stats, skills, inventory, equipment, progression, and reputation live on
> **separate** `Stats`/`SkillTree`/`Inventory`/`Equipment`/`Progression` components or singleton managers.
> Note the anchor here; Part B Step B3 sweeps the **whole subsystem** for the field surface. Treating the
> anchor class *as* the entity is the #1 way a load-bearing type ends up with a passing completeness tally
> over an incomplete field set (`06 §9.1` mode 4).

> **Load-bearing** = the curated moment is **visibly wrong or unresumable** without this type on the first
> replayed frame (the player; the world/level identity; the time-base/continuity clock; the primary
> antagonists/interactables in view). **Not load-bearing** = the replay still reads correctly without it on
> frame 1 (background props, distant populations, cosmetic systems, secondary modes). This flag drives the
> wave assignment in Step A5; getting it wrong is the failure the iterative model guards against.

> **⚠️ Always identify a world/level IDENTITY type — every game.** Restoration's *first* step rebuilds the
> world the capture happened in (`07 §8`), so a **world/level identity** key is mandatory: scene name /
> level index (level-based), `RunMetadata` selection id (procedural), persistent world/region id
> (open-world). Record it as a singleton "definitions"/"world" objectType, **load-bearing = yes, Wave 1**.

> **⚠️ Identity is not placement — absolute world positions need a deterministic spatial frame.** Before
> tracking any object's **absolute world position**, ask: is the level geometry **placed** deterministically
> across runs? **Phase 1 already answered this from the code** — check
> `CODE_MAP.session_boundaries.world_frame` (and `assembly`); if `world_frame.deterministic == false` (or it
> wasn't probed), treat absolute positions as unsafe until you confirm the frame. The answer is usually
> **no** for procedural / streamed / randomized layouts — the world re-assembles at a different
> origin/rotation each run (connector alignment + offsets, often from an unseeded RNG) — **and also for a
> runtime floating-origin / origin-rebasing world, which is `assembly: "authored"` yet still
> frame-nondeterministic.** Then the absolute positions you captured restore into the void. Reproducing
> *which* content
> (rooms/levels — the identity key above) is **necessary but not sufficient**; you must also reproduce its
> **placement**: either capture/replay the resolved layout transforms at the engine's placement seam, or
> capture positions relative to a stable reconstructed frame (`06 §9.4`; for procedural,
> `game-patterns/procedural-world.md` §3 Placement + §5). The tell is partial success — a capture in the
> run's first room (still at origin) restores perfectly while deeper ones break, which is why a quick
> start-of-level smoke test misses it (verify from a deep state — `9-tracking-restore-orchestrator.md`).

> **⚠️ Always identify a time-base / continuity singleton — resume the moment, don't restart it.** A
> viewer-centric sweep (§9.2) misses it because it lives on a **manager/singleton**, not a visible
> GameObject: master/session clocks (music/scheduler position, beat/bar index, global timer), active
> timers & cooldowns (**remaining**, not elapsed — §9.4), in-progress sequence/wave/combo index. Record as
> a singleton **`SessionState`/`Continuity`** objectType, **load-bearing = yes when the moment is
> time-driven, Wave 1**. (Its field-level capture is confirmed in Part B Step B1.)

> **⚠️ Always track soundtrack PRESENCE (which track is playing) — every game, and distinct from the clock
> above.** Restore **suppresses the game's own scene-start music trigger** (phase-10 Step 3, gated on
> `IsInLudeoFlow`), so a replay is **silent** unless restore re-starts the track — the classic "state
> restores but music doesn't" bug (`07 §8`). Record the **active-track id** as an attribute on the
> **environment / world-definitions** singleton (not the time-base clock): only *which* track, not its
> position — restarting from the top is fine. This is **required for completeness on every integration but
> NOT load-bearing** (the moment isn't *visibly* wrong without it on frame 1). Per the guardrail (§5),
> non-load-bearing state belongs in a **later wave (2+)** — assign it there in Step A5, and do **not** drop
> it just because it's deferred. (The mid-song *position* clock is the separate, time-driven-only Wave-1
> concern above.)

> **⚠️ If the game has bosses — record TWO types, both load-bearing / Wave 1 (when a boss is in the
> captured moment).** A boss is not a generic enemy: (1) the **boss entity** (flag it `IsBoss` so it's
> never swept into or counted as the generic-enemy bucket), and (2) a **`<Boss>Encounter` fight-state
> singleton** — phase/form index, phase timer *remaining*, scripted cursor, arena-lock, adds-alive — the
> manager-level state a viewer-centric sweep (§9.2) misses, just like the time-base singleton. Adds the
> boss summons are their **own** type (`IsMinion`, owner = boss key). The boss's spawn is a one-shot
> trigger/cutscene whose side effects restoration reconstructs without re-firing — see
> `game-patterns/bosses.md` for the full framework. Do not defer a boss in the captured moment to a late
> wave.

### Step A5: Assign a wave to every type (NEW — the iterative plan)
Tag each type `wave: 1 | 2 | 3 | …`:
- **Wave 1 — the restorable spine + the must-have set.** Auto-include: the **world/level identity**, the
  **player singleton**, the **time-base/continuity** singleton (when time-driven). Then add the **few
  collection types the moment is visibly wrong without** (the primary antagonists / interactables in view,
  from the genre §3 checklist). Wave 1 is the smallest set that produces a *coherent* replay — not just the
  singletons, and not the whole game.
- **Later waves (2, 3, …)** — every remaining type, **ordered by load-bearing-ness** (most-load-bearing
  next). Background populations, cosmetic systems, secondary modes, and the **soundtrack-presence
  attribute** (required for completeness, not load-bearing — the callout above) come last.
- **Rule:** a type flagged **load-bearing = yes** may **not** sit in a late wave behind non-load-bearing
  types. If you find yourself deferring load-bearing state, it belongs in Wave 1 (this is the guardrail —
  see §5).

Record the wave plan as the `## Wave Rollout` table (schema §6).

### Step A6: Halt for human review (the census gate)
Summarize and ask the user to review **the census only**: (1) spawn/own patterns + hooks (Step A2),
(2) **type coverage** — missing / over-tracked types (Step A4), (3) **load-bearing flags** — is anything
mis-flagged?, (4) **the wave plan** — is Wave 1 the minimal coherent moment, and is anything load-bearing
wrongly deferred? (Step A5). Walk the restore mentally: with **only Wave 1's types**, does the moment
rebuild AND resume (world identity + player + time-base + the must-have collections)? If Wave 1 restarts
the clock or drops an in-view antagonist, fix the wave plan now.

**Do not proceed to the phase-4 wave loop automatically** — this gate prevents looping against a
misunderstood object model or a wrong wave order. The **deep per-entity detail is intentionally absent
here**; it is produced per wave in Part B.

---

## Part B — Deep-Scope Procedure (run PER WAVE — invoked by phase 4's wave loop)

> **Do not run this in phase 3.** The phase-4 orchestrator dispatches `references/9a-deep-scope-wave.md`
> once per wave; that brief runs this procedure **scoped to the current wave's types only** and **appends**
> the resulting per-entity sections to `OBJECT_TRACKING.md` (the census + wave plan from Part A stays at the
> top). Each invocation deep-scopes a small set, immediately before that wave's capture/restore is
> implemented and verified — so a deep-scoping error is caught at that wave's own gate, not buried in a
> full-game plan. Run Steps B1–B7 for the wave's types, then halt for that wave's row review.

### Step B1: Map time-base / continuity fields (for the wave's `SessionState`/`Continuity`, if in scope)
For the time-base singleton (Wave 1, when time-driven), enumerate the fields:
- **Master / session clocks** — music/scheduler position (`AudioSource.time` / `dspTime`), beat/bar index,
  global match/run timer.
- **Active timers & cooldowns** — **remaining** time, not elapsed (§9.4); spawn/wave countdowns.
- **In-progress sequences** — current phase/step/wave/combo index of any scripted or rhythmic run.

> **Snapshot-then-play-forward.** Capture the **resolved** moment and let the game play forward; do not
> reproduce the future generation. An unseeded `GenerateTrack()` only needs its output at capture time
> (§4 resolved). Conversely the resolved clock/timer/sequence values **are** required — a rhythm moment
> whose `musicSource.time` isn't captured replays from the top.

### Step B2: Pin a stable key per entity type (in the wave)
Per `06 §4` — **there is no ID map**. Identity is the `objectType` bucket + your own key:
- **Singleton** (the player): the bucket's single entry suffices. **Record whether it lives on a
  *persistent* object** — `DontDestroyOnLoad`, `static Instance`, or held on a `ScriptableObject`/manager
  that survives scene loads. If so, restoration *matches* (not spawns) it (`07 §9`), carrying the prior
  run's full state; flag it **"persistent — reset to baseline before restore"** and note the game's
  new-game/respawn reset (file:method) for `phase 12` to mirror. Without the reset, uncaptured fields
  (inventory, buffs, score, cooldowns) leak across Ludeos.
- **Collection** (enemies, pickups): capture **your own stable key** as an attribute — an int assigned
  per spawn, a content/prefab id, or (streaming) the persistent world id. **Never** `GetInstanceID()` or
  object references (CR-014).

Record the key source + file:line. A collection type with no stable key is an open question — adding one
is a prerequisite for tracking.

### Step B3: Inventory properties per entity (the object→attribute table)
For each type in the wave, **enumerate its full state-field surface, then give every field a
disposition** — do not silently list only "the properties that seem to matter." The failure this guards
against is invisible-but-load-bearing state (skills, cooldowns, quests, reputation, hidden inventory)
that a viewer-centric read (`06 §9.2`) tells you to drop and a behavioral restore gate never catches,
because it only bites when the run **plays forward** (`06 §9.1`).

**Derive the field surface (the completeness FLOOR) from the codebase, not from intuition. First fix
*what the entity is* — sweep the whole subsystem, not the census's anchor class:**

> **The entity is the anchor GameObject's full subsystem.** Enumerate the fields of **every component on
> the entity's GameObject (and its child objects)** plus the **managers / singletons / ScriptableObjects
> that hold this entity's state** — not just the `class` named in the Step A4 census. For the **player**,
> the anchor `PlayerController` usually holds only transform + health; **actively go find** the separate
> `Stats` / `Attributes` / `SkillTree` / `Inventory` / `Equipment` / `Progression` / `Reputation`
> components or manager singletons and fold their fields into the surface. Grep the genre file's search
> keywords (`06 §9`, `game-patterns/<genre>.md §2`) to locate them. A field set enumerated from the anchor
> class alone is **under-scoped** — the tally below will then pass over an incomplete surface (the exact
> `06 §9.1` mode-4 trap).

Then floor the swept surface against the codebase:
- **Has a save/serializer for this entity?** → the fields it serializes are the floor (`06 §2.5`,
  §2.7). Floor, not ceiling — saves omit transient/visual state (velocity, facing, in-flight, clocks)
  a viewer notices, so add those; and include meta/settings it should *not* (stripped below). (Save-less
  games — many roguelikes — **lack this floor**, so the subsystem sweep above is your only surface: do it
  thoroughly.)
- **No save?** → the **runtime-mutable** gameplay fields across the swept subsystem's components
  (fields whose value changes during play). **Not** every `[SerializeField]` — editor-authored config /
  prefab refs / tuning constants are static and are excluded below, not enumerated as candidates.

**Then classify each field (`identity/key | static | dynamic-continuous | dynamic-discrete |
reference`) and assign it ONE disposition — this is completeness of *disposition*, not of capture, so
it composes with the wave model (breadth is deferred across waves; each entity is scoped in full at its
own wave):**
- **capture (this wave)** — apply `06 §9.3`'s keep-test; capture as a typed attribute (below).
- **defer → wave N** — real state, but non-load-bearing for this wave's replay; record the target wave
  + reason (the same field-level deferral the soundtrack-presence attribute uses, Step A4). Deferring is
  allowed; *not noticing the field exists* is not.
- **exclude** — with a one-word reason: `static` (never changes at play), `settings`/`meta` (not part
  of *this* moment — and actively harmful to capture: leaks across Ludeos, cf. Step B2), or `derivable`
  (`06 §9.3` step 3, *only if* restore actually re-derives it).

Emit the tally in the entity's row: `N state fields = C capture + D defer + X exclude`, and **name the
components/managers the surface was swept from** so `N`'s denominator is auditable. A field with no
disposition is a plan defect, not a default-drop — and a **suspiciously small `N`** (a player in an
RPG/roguelike-shaped game with only transform + health) is the tell that the sweep stopped at the anchor
class and missed a stats/skill/inventory subsystem. Re-sweep before accepting it.

> **This is not the up-front exhaustive plan the iterative model rejects.** It runs **per wave, scoped
> to that wave's types** (Part B is invoked once per wave). The census (Part A) stays shallow —
> types only. Widening across *waves* stays iterative; each *entity*, when its wave lands, is scoped in
> full so a later wave never has to backfill load-bearing state into an already-verified one (`06 §1.1`
> guardrail, §5).

Capture each **capture**-disposition property as a **discrete typed attribute by default** (`Vector3`/`Quaternion`/`int`/
`float`/`bool`/`string` — `06 §1.4`). Do **not** plan a `byte[]` blob, and don't ask the user, unless
they requested it or the state is genuinely opaque/large/unmappable — then record the entity + reason
under Open Questions and keep going. Note write cadence:
- Identity/key + static → written every tick alongside dynamics (the SDK diff-sends, so it's free; never
  split "register now, key later" — `06 §3.1`).
- Position / rotation / velocity → per-tick sample.
- Health / ammo / score → per-tick (or guard skip-unchanged, `06 §11`).
- References → capture the **target's stable key** (§4).

### Step B4: Map cross-entity references (within / into the wave)
For every reference-kind property fill a Cross-Entity References row (From / To / Field / Capture /
Restoration). Capture the target's stable key; at restore (phase 12, two-pass per CR-006) it's resolved
by **matching the captured key against the objects you spawned** — not an ID-map lookup. Missing rows
silently break reference resolution.

> **Cross-wave references.** If a wave's entity references a type that is **not yet captured** (a later
> wave), that reference cannot resolve until the target's wave lands — either pull the target into this
> wave (if the reference is load-bearing for this wave's replay) or record the reference as **deferred to
> wave N** in the row. Do not silently drop it.

### Step B5: Build the per-entity save matrix (reconciliation vs manual)
> The **game-level** classification (mechanism/format/group) is already in `INTAKE.md` +
> `CODE_MAP.save_system`. For each entity in the wave, decide the approach **per entity** and record it
> inline (no separate `GAME_ANALYSIS_SAVE_SYSTEM.md`).

For each entity type, using the game-level classification + the entity's serialization in code:
- **reconciliation** — the existing save serializes this entity to **named, typed fields** that map
  cleanly onto Ludeo attributes; tracking mirrors that plumbing.
- **manual** — no usable save, or the save is opaque/packed/binary/a transition cache → tracking writes
  each property explicitly with `SetAttribute`.

> ⚠️ **A strong save system ≠ reconciliation.** Group is *coverage*; reconciliation is *format*. A Group-1
> game saving via `BinaryFormatter`/packed bytes is still **manual** per entity. Named fields *inside* a
> per-entity struct still need enumerating into flat `SetAttribute` calls — the work is mechanical, the
> approach is still **manual**. This is often the most consequential call.

Record the approach in each entity row **and** write the structured form back to
`CODE_MAP.save_system.per_entity` (the array phase 0 left empty), appending this wave's entries:
`{ "entity": "...", "approach": "manual|reconciliation", "reason": "...", "wave": N }`.

### Step B6: Identify batch + stream-in registration paths (for the wave's types)
For each type with scene-placed (or already-loaded-at-run-start) instances, record the iterator + the
hook that registers them once gameplay begins (`06 §6`):
- **Skip when playing a Ludeo** — batch registration runs only when `!LudeoController.Instance.IsInLudeoFlow`
  `[Layer]` (the play flow creates objects from buckets).
- **Streaming worlds:** no "register the whole world" step — objects register at their **stream-in** hook
  (treat like a spawn); **stream-out must not unregister** (distinguish from death — `open-world-tracking.md
  §2`). Record stream-in/out hooks + the real "removed from world" signal.

### Step B7: Confidence + open questions (for the wave's rows)
Tag each entity row `high | medium | low`. Low-confidence → "Needs Human Review"; genuine ambiguities →
per-entity "Open Questions". The per-wave deep-scope brief (`9a`) appends these rows and halts for the
wave's row review before that wave's capture is implemented.

## 4. Questions to ask the human

- **Genre**, if the web search fails (Part A).
- **The Step A6 census gate** — type coverage, load-bearing flags, and the wave plan, before the phase-4
  loop.
- **(Part B, per wave)** A **collection type with no stable key** — adding one is a prerequisite for
  tracking; **reconciliation-vs-manual** where the entity's save format is ambiguous.

## 5. Patterns to apply

- **Iterative wave rollout is the model, not an option** (`06 §1.1`) — census every type once (Part A),
  then deep-scope + implement + verify **per wave** (Part B + phase 4). Wave 1 = restorable spine + the
  must-have set; widen only after a wave's restore gate is green.
- **The load-bearing guardrail** — widening is for **breadth, not backfilling**. If a later wave reveals
  state an **already-confirmed** wave needed to read correctly, that is a miss in the **earlier** wave: go
  back, add it there, re-verify *that wave's* gate. Never carry load-bearing state forward as "enrichment."
  (This is why Step A4 forces a load-bearing flag and Step A5 forbids deferring load-bearing types.)
- **Use the genre files** (guideline mandate) — `game-patterns/INDEX.md` + the matching genre file's §3
  Tracking Checklist as a *validation* checklist; plus the structural files (`open-world.md` /
  `open-world-tracking.md` / `procedural-world.md`) when `session_boundaries` calls for them.
- **Attributes by default, not blobs** (`06 §1.4`) — discrete typed attributes for every entity; `byte[]`
  only if asked or genuinely opaque, recording the reason rather than asking per entity. (Part B.)
- **No ID map** — identity is the objectType bucket + your own stable key; relationships are the target's
  key, resolved two-pass (`06 §4`). Never `GetInstanceID()`/references (CR-014). (Part B.)
- **Spawn/own classification is foundational** — get `06 §2` right or every hook decision is wrong. (Part A.)
- **When in doubt, track it** — over-tracking is cheap; under-tracking is a silently broken replay.
- **Streaming: presence ≠ existence** — stream-out is not death (`open-world-tracking.md §2`).
- **A strong save ≠ reconciliation** — check *format* (named vs opaque), per entity (Part B Step B5).

## 6. Output Contract

| File | Purpose | Filled by |
|------|---------|-----------|
| `ludeo-integration-plan/OBJECT_TRACKING.md` — census + wave plan (top) | Approved plan the phase-4 loop drives off | **Part A** (this phase) |
| `ludeo-integration-plan/OBJECT_TRACKING.md` — per-entity deep sections | What each wave's capture/restore mirrors | **Part B**, appended **per wave** by phase 4 |
| `CODE_MAP.json → save_system.per_entity` | The per-entity matrix in structured form (with `wave`) | **Part B**, appended per wave |

`OBJECT_TRACKING.md` (Part A writes the header + the first three tables; Part B appends one `## Entity`
block per type as its wave is scoped):
```markdown
# Object Tracking Plan — <GameName>

**Engine:** Unity <version>
**Save-system group:** <1 | 2 | 3>   (from INTAKE.md / CODE_MAP.save_system)
**Spawn/own patterns:** <e.g., §2.2 spawner for entities, §2.3 pool for projectiles>
**Structural:** <level-based | open-world/streaming> · **Assembly:** <authored | procedural (RunMetadata captured)>
**Types:** X   **Waves:** N   **Census pending human review**

## Wave Rollout            ← Part A (census)
| Wave | objectTypes in this wave | Why this wave (load-bearing rationale) |
|---|---|---|
| 1 | World/level identity, Player, SessionState/Continuity, <must-have collections> | Restorable spine + the set the moment is visibly wrong without |
| 2 | <next-most-load-bearing types> | ... |
| … | <remaining types> | background / cosmetic / secondary |

## Object Type Census      ← Part A (census; deep detail appended per wave below)
| objectType | Class | File:Line | Spawn pattern | Streams in/out | Load-bearing | Wave |
|---|---|---|---|---|---|---|

## Spawn/Own Pattern Summary  ← Part A
| Subsystem | Pattern (§2.x) | Register hook | Unregister hook | Notes |
|---|---|---|---|---|

<!-- ───────── appended PER WAVE by phase 4 (Part B via 9a) ───────── -->
## Entity: <ObjectType>   (wave: N)
- Class / file:line / Pattern (§2.x) / Spawn pattern (dynamic | placed | both | streamed)
- Stable key: `<attribute>` from `<field/source>` at `<file:line>` (or "singleton — bucket[0]")
- Restoration approach: <reconciliation | manual>   ← Step B5; also in CODE_MAP.save_system.per_entity
- Persistent singleton: <no | yes — DontDestroyOnLoad/static/SO-held; reset via `<reset method @ file:line>` before restore>
- Streams in/out: <no | yes — world id `<...>`, removal signal `<...>`>
- Pre-existing at run start: <yes | no>
- Field surface swept from: <components / managers / SOs enumerated — not just the anchor class>   ← Step B3
- Field completeness: <N> state fields = <C> capture + <D> defer + <X> exclude   ← Step B3 tally
- Confidence: <high | medium | low>

### Hook Sites
| Hook | File:Line | Notes |
|---|---|---|
| Register | ... | spawn site / Start / Spawn / pool Get — guard `!IsInLudeoFlow` |
| Unregister | ... | OnDestroy / Despawn / Release — NOT on stream-out (open-world) |

### Properties (every state field gets a row — Disposition, not just the captured ones)
| Field | Kind | Disposition | Type | Source (file:line) | Cadence | Reference to | Notes |
|---|---|---|---|---|---|---|---|
<!-- Disposition = capture | defer→wave N | exclude(static|settings|derivable). Floor = save-serialized
     fields (06 §2.5/§2.7) or runtime-mutable component fields. Type/Cadence apply to `capture` rows. -->

### Open Questions
- ...

## Time-Base / Continuity State (singleton `SessionState`/`Continuity` — Step B1)
| State | Source (file:line) | Type | Why the moment can't RESUME without it |
|---|---|---|---|

## Cross-Entity References
| From | To | Field | Capture | Restoration |
|---|---|---|---|---|
| ... | ... | ... | Track <Target>'s stable key | match key against spawned objects in Pass 2 (or deferred to wave N) |

## Genre Coverage Check
| Genre catalog item | In code? | Tracked? | Wave | Notes |
|---|---|---|---|---|

## Needs Human Review (Low Confidence)
| Candidate | Reason | Action |
|---|---|---|
```

## 7. ✅ Success Criteria

**The phase-3 gate is the CENSUS gate** (Part A) — satisfy before the phase-4 wave loop. The deep
criteria are verified **per wave** in phase 4 (listed here as what each Part-B invocation must meet).

**Guideline phase-3 criteria (census level):**
- [ ] **Every trackable object TYPE enumerated** — the `## Object Type Census` table (Step A4).
- [ ] **Typed attributes are the default** — recorded as the plan's standing rule; no blanket blobs
      (verified per wave in Part B Step B3).
- [ ] **Blob use (if any) justified as genuinely opaque** — each `byte[]` has a recorded reason (Part B).

**Skill-specific additions (census level):**
- [ ] Spawn/own pattern classified per subsystem with register/unregister hooks (Step A2).
- [ ] **Load-bearing flag** set per type (Step A4); a **world/level identity** type and the
      **time-base/continuity** singleton both identified and assigned **Wave 1**.
- [ ] **Wave plan** built (Step A5): Wave 1 = restorable spine + the must-have set; no load-bearing type
      deferred behind non-load-bearing ones; later waves ordered by load-bearing-ness.
- [ ] **Step A6 census gate passed** — type coverage + load-bearing flags + wave plan human-approved;
      Wave 1 confirmed to rebuild **and** resume the moment.

**Per-wave (Part B, verified in phase 4):**
- [ ] A **stable key** per collection type (no `GetInstanceID()`/references); singleton persistence flagged.
- [ ] **Field completeness (Step B3):** the field surface was swept from the **whole subsystem**
      (all components on the entity + its managers/SOs, not just the anchor class); every field has a
      disposition — `capture | defer→wave N | exclude(reason)`; the `N = C + D + X` tally + the swept-from
      components are recorded; no field is left undispositioned (silent drop). Player has a stats/skill/
      inventory subsystem folded in where the game has one.
- [ ] Per-entity property table (typed attributes) + cadence for the `capture` rows.
- [ ] Cross-entity references rowed (target's key, two-pass resolve; cross-wave refs marked deferred).
- [ ] **Per-entity reconciliation-vs-manual matrix** built (Step B5) → entity rows + `CODE_MAP.save_system.per_entity`.

## 8. Common Mistakes

- **Deep-scoping every type up front** instead of census-then-per-wave — produces a rubber-stamped plan
  and surfaces a wrong key for a late type only at that wave's restore gate.
- **Mis-flagging load-bearing** / **deferring load-bearing state to a late wave** — the failure the
  iterative model exists to prevent (Unreal's documented ActionGame break). Re-check Step A4/A5.
- **Scoping the field surface to the anchor class** — enumerating only `PlayerController`'s fields and
  missing the separate `Stats`/`SkillTree`/`Inventory`/`Equipment` components, so the completeness tally
  passes over an incomplete set. Sweep the **whole subsystem** (Step B3).
- **Shallow property inventory** — listing only the visibly-changing fields and silently dropping
  invisible-but-load-bearing state (skills, cooldowns, quests, reputation, hidden inventory). Enumerate
  the full state-field surface and disposition every field (Step B3); a viewer-centric read alone misses
  what only breaks when the run plays forward.
- **Defaulting to blobs** instead of discrete typed attributes (`06 §1.4`). (Part B.)
- **Using `GetInstanceID()` / object references as keys** (CR-014) — unstable across runs and stream cycles.
- **Skipping the world-identity or time-base/continuity object** — the Ludeo rebuilds but can't be
  relocated / resumed; the failure only shows at restore. Both are Wave 1.
- **Defaulting a strong-save game to reconciliation** — check the *format* per entity (Part B Step B5).
- **Unregistering on stream-out** in a streaming world (presence ≠ existence).
- **Proceeding to the phase-4 loop without the Step A6 census gate.**

## Related / Next

- `phase 1` (FIRST), `phase 2` — produce the inputs; `phase 0` `INTAKE.md` holds the game-level save
  classification.
- `phase 6 actions` — sibling discovery for discrete **actions** (waits for Wave 1's restore gate).
- **Next:** review the **census + wave plan** with the user (Step A6), then the phase-4 orchestrator
  (`9-tracking-restore-orchestrator.md`) runs the **wave loop** — per wave it invokes Part B
  (`9a-deep-scope-wave.md`) then implements capture/restore for that wave. `phase 11`/`phase 12` also
  consume the per-wave rows.
