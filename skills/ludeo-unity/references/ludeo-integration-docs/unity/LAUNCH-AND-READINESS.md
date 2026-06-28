# Launch Models & the SDK-Readiness Gate (Unity)

> **Load when:** intake's launch model (phase 0) is **"boot-straight-to-gameplay"** (creator axis) or
> **"launched preselected"** (player axis), or `CODE_MAP.launch_model` records either. Classic
> menu-gated games don't need the gate — but read [§6](#6-also-hardens-the-classic-menu-flow) first;
> the same window can bite a fast menu.
>
> **This is a structural lifecycle pattern, not a genre pattern.** Like
> [`../game-patterns/open-world.md`](../game-patterns/open-world.md) (which is about *session
> boundaries*), this file is about the **startup sequence**: where init/activate/consent sit relative
> to the game's own auto-start, and how the create-vs-play branch resolves when there is no menu to
> wait in.

> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)) · `[Layer]` = prescribed façade
> ([`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md)) · `[Unity]` = engine API.

---

## 1. The menu was an implicit waiting room

The classic flow boots to a main menu, and that menu silently does **three** jobs the lifecycle leans
on without ever naming them:

1. It absorbs the async `InitLudeoSession → Activate` `[SDK]` latency — the round-trip finishes while
   the player reads the menu.
2. It absorbs the async **consent** latency — `AddNotifyConsentUpdated` `[SDK]` fires and flips
   `LudeoFlowSwitch` `[Layer]` from its default **Disabled+Dummy** to enabled **before** the first
   creator `OpenRoom`. Open a room while the switch is still `Disabled` and `DisabledLudeoFlow.InitRoom`
   **no-ops** — no room, no capture, no Ludeo, all session, **silently** (the failure passes a smoke
   test whenever consent happens to win the race).
3. It is where the create-vs-play branch (`onInitDone(isStartingInLudeo)` `[Layer]`) is consumed —
   "show the menu" vs. "go to the level for a replay."

A **boot-straight-to-gameplay** game (the first Build Settings scene *is* a gameplay scene that
auto-starts a run) has no waiting room. Gameplay auto-starts on that scene's `Start()` `[Unity]`, so
all three guarantees break. You replace the menu's implicit wait with one explicit thing: the
**SDK-readiness gate**.

## 2. The SDK never blocks

`InitLudeoSession`, `Activate`, and consent are **all async callbacks** `[SDK]` — nothing waits for
you (see [`../05-LIFECYCLE-MANAGEMENT.md`](../05-LIFECYCLE-MANAGEMENT.md) startup sequence, and
`HandleActivateDone`/`HandleConsentUpdated` in [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md)).
The gate below is **integration code you build**, not an SDK affordance. Skip it and the game races
ahead of the SDK — the creator `OpenRoom` no-ops against the still-`Disabled` flow switch (§1.2).

## 3. Don't gate the level load — gate the first interactive/recorded frame

Load the gameplay scene **immediately** — that load *is* the latency-hiding window the menu used to be.
Hold only the moment you hand the player control and start recording. This is the exact discipline the
**restore** flow already uses (it freezes/suppresses the first interactive frame until `RoomReady →
Begin`, [`../07-RESTORATION-PATTERNS.md`](../07-RESTORATION-PATTERNS.md) §10); the menu just made it
look unnecessary for capture.

### 3.1 Creator path (no Ludeo selected)

```
app boot → gameplay scene loads NOW + a "ready" cover, sim frozen/suppressed
   ║  (in parallel)
   ╚→ InitLudeoSession → Activate → AddNotifyConsentUpdated (canCreate)   [SDK] all async
         → OpenRoom(creator) → AddGamePlayer → RoomReady → Begin           [SDK] CR-009 gate
release the cover / unfreeze / enable input   ⟵ when Begin lands
   ⇒ the first frame the player controls == the first captured frame
```

The room chain (`OpenRoom → AddGamePlayer → RoomReady`) only starts **after** the readiness gate
clears (Activate resolved + consent allows create) — never synchronously in the gameplay scene's
`Start()`. `Begin` is then gated by the existing two-signal begin-gate (`RoomReady ∧ AddGamePlayer`,
CR-009). The "ready" cover hides both the consent wait *and* the room-open→Begin latency.

### 3.2 Player path (Ludeo preselected at launch — `isLudeoSelected` / `autoStartInLudeo`)

When the app is launched with a Ludeo already chosen, `Activate`'s callback returns
`isLudeoSelected == true` and a `LudeoSelected` notification follows `[SDK]`. The game must **not** run
its normal boot-into-creator-gameplay:

- **Suppress the auto-start** — the same `IsInLudeoFlow` `[Layer]` suppression the restore flow uses
  for intros/spawns/press-start gates ([`11-implement-restoration-flow.md`](../../11-implement-restoration-flow.md)
  §5). The `onInitDone(isStartingInLudeo: true)` branch is the signal to take this path.
- **The world may already be live.** Unlike the classic flow (where `LudeoSelected` fires at a menu
  with no world yet), here the boot scene may have already instantiated the default new-game world —
  and possibly auto-started a creator run — before `LudeoSelected` resolves. So restoration **resets /
  reloads the already-loaded scene** rather than booting a fresh one (contrast
  [`11-implement-restoration-flow.md`](../../11-implement-restoration-flow.md) Step 3's
  "boot one here"), and tears down any auto-started creator run via the existing `HandleGetLudeoDone`
  re-entrancy teardown (`07 §2.2`).

> **`autoStartInLudeo`/`ludeoToAutoStart` (phase 0) is the dev-side test harness for this production
> path** — it forces the preselected-Ludeo launch without the platform launcher. If intake's player
> axis is "launched preselected", wire and verify this path, don't treat the flags as test-only.

## 4. ⚠️ The gate MUST be bounded with a fallthrough — or the game is unlaunchable offline

The readiness gate is a **bounded** wait, not an indefinite one. Release the creator gate on **any** of:

1. **Success** — `canCreate` true → start the captured run (OpenRoom → … → Begin → reveal).
2. **Consent denied** — `canCreate` false → release the cover and **start gameplay normally,
   uncaptured** (CR-001: a disabled SDK is a set of no-ops, the game plays fine).
3. **Init/activation failure or timeout** — `WrapperDllNotFound`, offline, or no consent callback within
   a **bounded timeout** → start uncaptured.

An unbounded wait **hangs the game at the cover forever** when the player is offline or auth fails.
Reuse the layer's existing per-callback timeout (the tank's `cancellationTokenSource` exists for
exactly this — cancel the timer when the callback arrives, fall through on expiry).

> **Open decision — "uncaptured fallthrough" vs "uncaptured-then-upgrade".** If consent reliably
> arrives within a tight bound of `Activate`, a short timeout + fallthrough is enough. If consent can
> lag seconds, decide whether to (a) start uncaptured and stay uncaptured for the run, or (b) start
> uncaptured and **upgrade** to a captured run when consent lands late (open the room then). Record the
> choice in `SDK_LIFECYCLE_PLAN`. Default to (a) — simpler and correct; (b) only if late consent is
> common for the target platform.

## 5. Bootstrap with no init scene

The classic wiring constructs `LudeoController` `[Layer]` in a bootstrap MonoBehaviour in a dedicated
**init scene**. A boot-straight game has none, so the controller must still exist **before** the
gameplay scene's `Start()` runs, or the auto-start races the gate:

- **`[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]` `[Unity]` static hook**
  — constructs the controller before the first scene loads. Preferred when there is genuinely no boot
  scene.
- **A tiny boot scene at Build Settings index 0** — an `Awake`/`Start` bootstrap that constructs the
  controller, then loads the gameplay scene. Closest to the classic shape; use it if the game already
  has any pre-gameplay scene to fold into.

Either way, the gameplay scene's auto-start must consult the gate (frozen/suppressed until release),
never start unconditionally in `Start()`.

## 6. Also hardens the classic (menu) flow

The gate is not only for boot-straight games. Any **menu-gated** game whose "Play" button immediately
loads-and-starts a level, or that **auto-continues / skips the intro**, can blow past the same consent
window — the classic flow is only safe because the menu is *assumed slow*. If the game has a fast or
skippable menu, apply the gate there too: it makes startup timing **explicit** instead of relying on
the player dawdling. For a slow, click-through main menu the gate is redundant (consent has long since
arrived) — skip it.

## 7. Validation Checklist

- [ ] Level **load** is not blocked — only the first interactive/recorded frame waits (the cover hides
      the latency).
- [ ] Creator `OpenRoom` fires **after** the readiness gate clears (Activate resolved + `canCreate`),
      never synchronously in the gameplay scene's `Start()`.
- [ ] First frame the player controls == first captured frame (reveal/unfreeze on `Begin`).
- [ ] Gate is **bounded**: releases to an **uncaptured** game on consent-denied, init failure, or
      timeout — never hangs at the cover.
- [ ] Player path: auto-start **suppressed** under `IsInLudeoFlow`; restore **resets/reloads** the
      already-live scene (not boot-fresh) and tears down any auto-started creator run (`07 §2.2`).
- [ ] Controller constructed before the gameplay scene's `Start()` (RuntimeInitializeOnLoadMethod or a
      build-index-0 boot scene).

---

## Calls used in this doc

**`[SDK]`** (authority: [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)):
`LudeoManager.InitLudeoSession` · `LudeoSession.{Activate, OpenRoom, AddNotifyConsentUpdated,
AddNotifyLudeoSelected, AddNotifyRoomReady}` · `LudeoRoom.AddGamePlayer` · `LudeoGameplaySession.Begin`.

**`[Layer]`** (from [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md)):
`LudeoController.{IsInLudeoFlow, BeginGameplay}` · `LudeoFlowSwitch.{SetFlags, SwitchToCreate}` ·
`ILudeoFlow.InitRoom` · the `onInitDone`/`onRoomReady`/`onBeginRestore` hooks · the readiness-gate
additions (`TryReleaseCreatorGate`).

**`[Unity]`:** `RuntimeInitializeOnLoadMethod` · `Time.timeScale` · `SceneManager.LoadScene` ·
MonoBehaviour `Awake`/`Start`.

---

**Next:** the gate's concrete wiring (fields + `TryReleaseCreatorGate`) lives in
[`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md); it is planned in
[`../../3-plan-sdk-lifecycle.md`](../../3-plan-sdk-lifecycle.md) and implemented in
[`../../4-implement-sdk-lifecycle.md`](../../4-implement-sdk-lifecycle.md). The player-path restore
specifics are in [`11-implement-restoration-flow.md`](../../11-implement-restoration-flow.md).
