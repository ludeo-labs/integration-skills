---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Does your SDK-readiness gate hold the MAIN MENU (not a level) while Activate/consent resolve, and are you implementing that hold by disabling Unity's EventSystem or another UI input component from a hook that runs before the menu's own Start()?"
sanitized: true
---

# Never implement the menu-side readiness cover by disabling the `EventSystem`

The readiness gate needs the main menu to not start a level before `Activate` + consent resolve. The
obvious "input-only" cover is `EventSystem.current.enabled = false` until readiness lands, re-enabled
afterwards. It compiled, it logged `Menu cover HELD` / `released`, and it broke the menu completely.

What the run log showed (Windows player, Unity 2021.3.37f1):

```
[Ludeo] Menu cover HELD (readiness) on 'MainMenu'
NullReferenceException  at MenuScreen.ShowInputHint ()  at MenuScreen.Start ()
NullReferenceException  at KeepMenuSelection.SelectItem (GameObject)   x270 (every frame)
[Ludeo] Activate: Success — readiness resolved     (4 s later)
[Ludeo] Menu cover released
```

The integrator's report: *"I try to select a level and can't hit enter or esc, it doesn't do anything."*

## Why

- The gate hook runs at `AfterSceneLoad`, i.e. **before the menu scripts' `Start()`**.
- `EventSystem.current` is assigned in the component's `OnEnable` and cleared in `OnDisable`. Disabling
  the component makes `EventSystem.current` **null**.
- The menu's own startup (`SetSelectedGameObject` of the first button, a controller-hint popup) dereferences
  `EventSystem.current` → NRE in `Start()`, and a per-frame "keep something selected" script NREs every frame.
- Re-enabling the component 4 s later does not replay the menu's `Start()`: the initial selection never
  happened, so keyboard/gamepad navigation has no focused item. Enter/Esc do nothing. The player sees a
  dead menu with no error on screen.

## The rule

**A readiness cover must never mutate a component the game's own startup depends on.** Use the game's
existing full-screen loading canvas (raycast-blocking) as the visual cover, or nothing at all on the
menu — a level started before readiness is already absorbed by the **per-run control hold** at the gameplay
scene, which is the gate that actually matters
([[readiness-latch-and-per-run-control-hold-must-not-share-a-release-token]]). If input truly must be
suppressed in the menu, do it through a mechanism the menu does not read at `Start` (e.g. a
`CanvasGroup.interactable=false` on the menu's root, applied *after* the menu's `Start`, i.e. from the
host's first `Update`), and log which one you chose.

Generalization of [[a-path-that-skips-the-menus-skips-what-the-menus-initialise]]: the mirror failure — the
menus *did* run, but a hook that ran before them removed something their initialisation required.
