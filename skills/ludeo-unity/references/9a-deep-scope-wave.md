# Phase 4 · Task 0 — Deep-Scope This Wave (Unity)

> **Single-task subagent brief.** Dispatched by the phase-4 orchestrator
> (`9-tracking-restore-orchestrator.md`) **once per wave**, before that wave's capture is implemented.
> You **deep-scope only the current wave's object types** and **append** their per-entity rows to
> `OBJECT_TRACKING.md` (+ the structured save matrix to `CODE_MAP.save_system.per_entity`). This is
> **analysis only — no code, run nothing.** You run in isolated context — your inputs are the files in §2.
> Return a summary + the appended rows + any human-questions; the orchestrator runs the wave's row-review
> gate.
>
> **This brief adds no new procedure.** It runs **phase 3 Part B** (`references/8-map-game-objects.md` →
> "Part B — Deep-Scope Procedure", Steps B1–B7) scoped to this wave. Read that procedure and apply it to
> exactly the types this wave covers.
>
> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`ludeo-integration-docs/12-SDK-API-REFERENCE.md`](ludeo-integration-docs/12-SDK-API-REFERENCE.md)) ·
> `[Layer]` = prescribed façade ([`ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md`](ludeo-integration-docs/unity/REFERENCE-ARCHITECTURE.md)) ·
> `[Unity]` = engine API.

## 1. Goal / Purpose

Turn this wave's **census entries** (object types tagged `wave: N` in `OBJECT_TRACKING.md`) into full
**deep-scope rows**: per-entity properties (typed attributes), the stable key, hook sites, cross-entity
references, the time-base fields (if the wave owns the `SessionState`/`Continuity` singleton), the batch /
stream-in paths, and the reconciliation-vs-manual approach. The rows you append are exactly what this
wave's capture (task 1) writes and its restoration (tasks 2/4) mirrors — **scoped to this wave only**, so
the next wave's types are untouched until their turn.

## 2. Inputs (Input Contract)

- [ ] **Which wave** — the integer `N` and the list of `objectType`s tagged `wave: N` in the census
      (passed by the orchestrator).
- [ ] **Phase 3 census** → `ludeo-integration-plan/OBJECT_TRACKING.md` — the `## Wave Rollout`,
      `## Object Type Census`, and `## Spawn/Own Pattern Summary` tables (Part A), **human-approved**.
- [ ] **Phase 3 Part B procedure** → `references/8-map-game-objects.md` "Part B — Deep-Scope Procedure"
      (Steps B1–B7) — **the procedure you execute.**
- [ ] **Phase 1** → `ludeo-integration-plan/CODE_MAP.json` (`object_model`, `event_systems`,
      `session_boundaries`, the game-level `save_system` block).
- [ ] **Phase 0** → `ludeo-integration-plan/INTAKE.md` — game-level save classification (for Step B5).
- [ ] **Prior waves' rows** already in `OBJECT_TRACKING.md` — read them so cross-wave references resolve
      correctly and you do not duplicate a shared type.
- [ ] Context files: `ludeo-integration-docs/06-TRACKING-PATTERNS.md` (**§1.4, §3, §4, §6, §9, §11**),
      the matching `game-patterns/<genre>.md` §3 checklist, `open-world-tracking.md` if streaming.

## 3. Steps

1. **Resolve the wave's type set.** From the census, take the `objectType`s tagged `wave: N`. For **Wave 1**
   this is the restorable spine (world/level identity + player + time-base/continuity) **plus** the
   must-have collection types; for later waves it is that wave's assigned types.
2. **Run phase 3 Part B, Steps B1–B7, scoped to those types** (`8-map-game-objects.md`):
   - **B1** time-base/continuity fields — only if this wave owns the `SessionState`/`Continuity` singleton
     (normally Wave 1).
   - **B2** stable key per type · **B3** properties (typed attributes + cadence) · **B4** cross-entity
     references · **B5** reconciliation-vs-manual · **B6** batch/stream-in paths · **B7** confidence + open
     questions.
3. **Resolve cross-wave references (B4 rule).** If a type in this wave references a type **not yet
   captured** (a later wave), either pull the target into **this** wave (if the reference is load-bearing
   for this wave's replay — and tell the orchestrator, since it changes the wave plan) or mark the row
   **deferred to wave M**. Never silently drop it.
4. **Append, do not rewrite.** Append one `## Entity: <ObjectType> (wave: N)` block per type to
   `OBJECT_TRACKING.md` (schema in `8-map-game-objects.md` §6); append/extend `## Cross-Entity References`
   and the time-base table. **Leave prior waves' blocks and the Part-A census tables unchanged.** Append
   this wave's entries to `CODE_MAP.save_system.per_entity` with `"wave": N`.
5. **Return** a summary, the appended `objectType`s, and any human-questions (unresolved stable key,
   ambiguous reconciliation, a load-bearing cross-wave reference that should reshape the wave plan).

## 4. Questions to ask the human

The orchestrator relays whatever you surface — do not invent your own. Expected:
- A **collection type with no stable key** (adding one is a prerequisite for tracking that type).
- **reconciliation-vs-manual** where the entity's save format is ambiguous.
- A **load-bearing cross-wave reference** — should the referenced type move into this wave (reshaping the
  approved wave plan)? This is a wave-plan change; the orchestrator takes it back to the census gate.

## 5. Patterns to apply

- **Scope discipline** — deep-scope **only this wave's types**. Do not pull the whole game's detail
  forward; that defeats the per-wave verification the model is built on.
- **The load-bearing guardrail** (`8-map-game-objects.md` §5) — if scoping this wave reveals state an
  **earlier, already-confirmed** wave needed, that is a miss in the earlier wave: surface it so the
  orchestrator re-opens that wave, do **not** absorb it silently here.
- **The mirror principle** — what you scope here is what task 1 captures and tasks 2/4 restore, row-for-row.
  A gap here is a silently broken replay for this wave.
- **Append-only** — the census (Part A) and prior waves' rows are fixed; you only add this wave's rows.

## 6. Output Contract

| File | Change |
|------|--------|
| `ludeo-integration-plan/OBJECT_TRACKING.md` | **Appended:** one `## Entity` block per `wave: N` type + this wave's cross-entity / time-base rows |
| `CODE_MAP.json → save_system.per_entity` | **Appended:** this wave's `{entity, approach, reason, wave}` entries |

## 7. ✅ Success Criteria

- [ ] Every `objectType` tagged `wave: N` has a complete `## Entity` block (key, properties, hooks,
      confidence) — and **no later wave's** type was scoped.
- [ ] Stable key resolved per collection type (no `GetInstanceID()`/references, CR-014); singleton
      persistence flagged (Step B2).
- [ ] Properties captured as **typed attributes** by default; any blob has a recorded reason (Step B3).
- [ ] Cross-entity references rowed; cross-wave references either pulled in or marked **deferred** (Step B4).
- [ ] reconciliation-vs-manual recorded per entity + written to `CODE_MAP.save_system.per_entity` with
      `wave` (Step B5).
- [ ] Census tables + prior waves' blocks **unchanged** (append-only).

## 8. Common Mistakes

- **Scoping beyond the wave** — deep-scoping types from later waves; defeats per-wave verification.
- **Rewriting the census or a prior wave's block** — this brief is append-only.
- **Silently dropping a cross-wave reference** instead of pulling it in or marking it deferred.
- **Absorbing earlier-wave load-bearing state here** instead of surfacing it for a wave-plan fix.
- **Defaulting to blobs / `GetInstanceID()`** (`06 §1.4`, CR-014).

## Related / Next

- Procedure: `8-map-game-objects.md` "Part B" (Steps B1–B7) — the steps this brief runs.
- Orchestrator: `9-tracking-restore-orchestrator.md` — dispatches this brief as **task 0 of each wave**,
  then runs the wave's row-review gate before dispatching task 1 (capture).
- **Next in the wave:** task 1 (`9-implement-object-tracking.md`) captures the rows you just appended.
