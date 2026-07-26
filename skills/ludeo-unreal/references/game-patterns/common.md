# Universal Capture Baseline (Unreal)

> **Applies to:** every genre — load this **alongside** the matching genre file(s).
> **Purpose:** the per-entity capture items that are universal across genres (player/avatar transform,
> view direction, health, alive). Genre files carry only genre-**specific** additions on top of this.
>
> Type names map to the Unreal DataWriter set-attribute calls; see `references/phase-05-tracking-restore.md`
> for the exact API and the identity/restore mechanics.

> **MVP scope (curated-first):** In Phases 4–6, capture only what your **curated slice**
> (`integration.json → curatedSlice`) needs at the restored moment; the full baseline applies at
> **expansion** (Phase 8).

---

## 1. Player / Avatar (CRITICAL — nearly every game)

- [ ] Position (`FVector`)
- [ ] Body rotation (`FRotator`) — the pawn/actor facing
- [ ] **Look / aim direction** (`ControlRotation` / view rotation) — where the player is *aiming/looking*,
  distinct from body facing. *Validated:* captured separately from body rotation by first-person
  integrations (e.g. Lyra) where look ≠ body; in third-person games it is often derived from the actor
  rotation. Capture it whenever look can diverge from body facing (FPS, shoulder aim, free-look).
- [ ] Velocity (`FVector`) — when movement/physics continuity matters at the restored frame
- [ ] Health (and Max). If the game has a **separate armor/shield pool**, capture it too (and its max).
- [ ] Is alive / dead (`bool`) — and a richer **defeat-state enum** if the game has a downed/revive cycle
  (see `references/game-patterns/shooter.md` §1).
- [ ] Stance (crouch/prone/etc.) — `bool`/enum, when it changes the silhouette or capabilities at the moment
- [ ] Team / faction id (if applicable)

## 2. Camera / View (POV + FOV)

The captured video framing comes from the player camera, so its view state matters for a faithful first frame.

- **View location + rotation** — usually the camera follows the pawn + the look/aim rotation above, so
  capturing `ControlRotation` (§1) lets the game reconstruct the camera. Capture the **camera transform
  explicitly only** when the camera is decoupled from the pawn at capturable moments (spectator, free cam,
  scripted/cinematic camera).
- **Field of View (FOV)** — ⚠️ *recommended-but-usually-derived.* Player Flow is snapshot-restore and the
  game resumes its own logic, so FOV is normally **re-derived** from captured state (ADS/zoom active,
  sprint, current weapon). **Capture FOV explicitly only when it is driven by something transient or
  scripted that the restored state will NOT reproduce** — e.g. a cutscene or temporary zoom FOV not tied to
  a captured flag. No reference integration captures FOV today; prefer capturing the **driving state**
  (ADS/zoom flags) and add an explicit FOV attribute only if the first replayed frame's framing is visibly
  wrong.

## 3. Score / Progression (if the moment is competitive)

- [ ] Score / kills / deaths / objective counters — often the cleanest signal of how the player is doing.
  (In GAS games these are sometimes gameplay-tag stack counts rather than plain integers.)

---

These are the **universal** items. For genre-specific entities, actions, and state (weapons, creatures,
structures, units, turn state, …) load the matching genre file via
`references/game-patterns/INDEX.md`. Per-entity **identity and restore mechanics** (stable keys,
snapshot-restore, streamed-out vs. destroyed) live in `references/phase-05-tracking-restore.md` and — for
streaming worlds — `references/game-patterns/open-world-tracking.md`.
