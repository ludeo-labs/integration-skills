# Reference Sample Catalog

This is the authoritative lookup for known-good Ludeo integration reference samples. Phase 2 (and any phase making a classification decision) MUST check this catalog before deriving classifications from scratch.

## How to Use This Catalog

1. **Attempt a name match first.** If the game repo name or `.uproject` filename matches an entry's `repoName` or aliases, check the match criteria below.
2. **Verify the match criteria.** A name match alone is NOT sufficient — every listed criterion must hold in the current project. If any criterion fails, the sample does NOT apply.
3. **If the match holds, start from the sample's classification** and verify each of the sample's preconditions against the current project. Do not re-derive from scratch.
4. **If no sample matches, proceed with normal analysis** — but record the absence of a reference sample in `saveSystemEvidence.referenceSampleMatch: null`.

**Rule:** Reference sample matches override grep-based inference. If a sample matches, grep results that contradict the sample's classification are a signal to stop and reconcile with the human — NOT to silently override the sample.

---

## Samples

### FPSGameStarterKit — SaveWorld / Reconciliation Reference

**Repo:** `ludeosdk-fpsgame-sample` (Ludeo fork of FPSGameStarterKit marketplace template)
**Aliases:** `FPSGame`, `FPSGameStarterKit`, `FPS_Game`, `FTPS_Online` (when derived from this template)
**Engine versions:** UE 5.x

**Match criteria (ALL must hold):**
- [ ] Game is Blueprint-only OR has minimal C++ (no custom gameplay state classes in `Source/`).
- [ ] Uses **standard UE engine classes** for gameplay state: `APlayerState`, `APlayerController`, `ACharacter` (default or lightly-subclassed, not heavily component-based).
- [ ] Gameplay state (Health, Score, etc.) lives as **direct members or engine-class properties**, not on dynamically-added BP sub-components.
- [ ] BP gameplay variables **have the "Save Game" flag checked** (verify by opening `BP_CharacterBase` or equivalent in the editor).
- [ ] No custom `USaveGame` subclass with unflagged properties in the gameplay path.
- [ ] No `FFastArraySerializer` / `NetDeltaSerialize` blockers on the tracked properties.

**If ALL criteria hold → classification:**
- `saveSystemGroup`: **1 (Full Save System)**
- `stateApproach`: **reconciliation (SaveWorld + property filters)**
- `integration pattern`: See `references/phase-05-tracking-restore.md` Section 5, which explicitly cites FPSGameStarterKit as the reference for this path.

**If ANY criterion fails:** FPSGameStarterKit is NOT the right reference. Do NOT apply its classification. Fall through to normal analysis and the BP-only verification step in `phase-02-mapping.md` Section 3.5.

**Known counter-example:** VoyagerV2 is BP-only and looks superficially similar, but fails the criteria — its gameplay state lives on dynamically-added BP sub-components (`HealthComp_C`, `WeaponComp_C`) and the BP variables do NOT have the SaveGame flag. VoyagerV2 is Group 3 (manual), not Group 1. See `learnings/save-systems/saveworld-fails-on-bp-component-architecture.md`.

---

### Lyra — Non-Gameplay Handling Reference

**Repo:** `ludeosdk-lyra-sample`
**Aliases:** `Lyra`, `LyraGame`, `LyraStarterGame`
**Engine versions:** UE 5.3+

**Match criteria (ALL must hold):**
- [ ] C++ project with a `LyraGame` module in `Source/`.
- [ ] Uses the **Experience** system (`ULyraExperienceDefinition`, `ULyraExperienceManagerComponent`).
- [ ] Uses **GameplayMessageSubsystem** for cross-system events.
- [ ] Uses **GAS** (`UAbilitySystemComponent`, `UAttributeSet`) for health/damage.
- [ ] Uses **CommonUI** + `UPrimaryGameLayout` for menus.

**If ALL criteria hold → reference for:**
- **Phase 3** (non-gameplay handling): pause/resume, NoneLudeable, Player Flow pause timing, menu overlay detection. See `learnings/common-mistakes/always-check-reference-sample-first.md`.
- **Phase 5** (state tracking): full entity inventory with Player, Bot, GameMetadata at 10Hz.
- **Phase 9** (Player Flow): deferred health restoration via GAS init, bot identity matching by index, pause-before-apply pattern.

**Do NOT apply Lyra-specific patterns to non-Lyra games without checking the per-pattern criteria.** Many Lyra patterns are game-specific (GAS, Experience system, QuickBar) and do not generalize.

---

### VoyagerV2 — Manual Reflection / BP-Component Architecture Reference

**Repo:** Internal — VoyagerV2 TPS prototype
**Aliases:** `Voyager`, `VoyagerV2`, `VoyagerTPS`
**Engine versions:** UE 5.x

**Match criteria (ALL must hold):**
- [ ] Blueprint-only project (no `Source/` with gameplay state).
- [ ] Gameplay state (Health, Energy, EquippedWeapon) lives on **dynamically-added BP sub-components** (`HealthComp_C`, `WeaponComp_C`, etc.), not as direct UPROPERTY members.
- [ ] BP gameplay variables do NOT have the "Save Game" flag (verify by opening the BP in-editor).
- [ ] Game has its own BPI_SaveGame interface for save/load, separate from UE's `USaveGame` property serialization.

**If ALL criteria hold → classification:**
- `saveSystemGroup`: **3 (No Save System — from Ludeo's perspective)**
- `stateApproach`: **manual (WritableObject.WriteData with explicit reflection via FindPropertyByName + ContainerPtrToValuePtr)**
- `integration pattern`: See `learnings/save-systems/saveworld-experiment-final-summary.md` and `learnings/save-systems/saveworld-fails-on-bp-component-architecture.md`.

**If ANY criterion fails:** VoyagerV2 is NOT the right reference. In particular, BP-only alone does NOT match — the component-based + no-SaveGame-flag conditions are what make VoyagerV2's approach necessary. Do not pattern-match on "BP-only" and apply VoyagerV2's rules.

---

## Catalog Maintenance

When adding a new reference sample:

1. Give it a **clear set of match criteria** — specific enough that false positives are mechanically detectable.
2. State a **known counter-example** if possible — a game that looks similar on the surface but fails the criteria. This prevents surface-feature pattern-matching.
3. List the **concrete classifications and phases** the sample is a reference for.
4. Cross-reference the sample from every learning that cites it, so a learning reader can find the catalog entry.

**Adding new samples is a Phase 1 or post-integration task**, not something to do mid-Phase-1 under time pressure.
