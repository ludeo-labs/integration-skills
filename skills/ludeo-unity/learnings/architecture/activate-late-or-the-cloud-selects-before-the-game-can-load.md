---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "3,7"
question: "Does the integration call session.Activate() from an early hook (RuntimeInitializeOnLoadMethod, a bootstrap Awake) rather than when the game is genuinely ready to load a Ludeo? On a cloud machine the platform pushes LudeoSelected ~1-2s after activation, so an early Activate lands the selection in whatever boot screen the game happens to be on."
sanitized: true
---

# Activate as late as the SDK says, or the cloud selects a Ludeo before the game can load one

The Unity SDK docs are explicit and easy to skim past:

> **When to Activate:** activate the session **after all essential game assets are loaded and the game
> is ready to start gameplay** — compiling shaders, loading main menu assets, initializing game data.
> **Activating as late as possible** ensures your game is ready to respond to notifications once
> activation completes.

An integration that activates from `RuntimeInitializeOnLoadMethod(BeforeSceneLoad)` does the exact
opposite — the earliest possible moment, before the first scene exists. It is easy to justify with
auth reasoning ("explicit auth, no store client to wait on, so nothing to wait for"), and that
reasoning is both true and irrelevant: the requirement is about **game** readiness, not auth.

**What it costs you.** `Activate` is the starting gun for the platform pushing `LudeoSelected`.
Measured on one cast session: `Activate OK` at T, `LudeoSelected` at **T+1.6s**, while the game was
still in its splash sequence ~26s into boot. The restore then asked for its gameplay-scene load from
inside the splash scene, the load never took effect, and the game sat frozen on the splash forever —
presenting as a white screen with no error anywhere. `GameplaySession_Begin` was never reached, so
every `GameplaySession_End` failed with `WrongState`.

**Why it hides.** A Studio test machine has a human clicking, which gave the same build **22 seconds**
to reach the menu — enough to boot, so it worked there. Same build, same cloud, same player flow: the
only difference was how long the game got. Any local test also passes, because nothing pushes a
selection at you.

## Do this

- Keep `Initialize`, `CreateSession` and **all** event subscriptions early — the SDK requires
  subscribing before `Activate`.
- Split `Activate` into its own call, fired from the game's own "menu is up and ready" signal.
- Arm any readiness timeout **with** `Activate`, not at bootstrap — a timer started before `Activate`
  expires against a clock that never started and reports a false timeout.

## Also from the same page, and worth taking

> `isLudeoSelected == true` ⇒ Player flow. A `LudeoSelected` notification follows immediately;
> **skip unnecessary loading such as splash screens and cutscenes.**

Splash screens in front of the menu are pure latency in the one flow that is timing-sensitive.
Dropping the pre-menu splash from the build entirely is a legitimate fix, not just a tidy-up.

## The diagnostic that named it in one run

Log the scene the restore is loading **from**, not just the scene it is loading:

```csharp
LudeoTrace.Step("loading '" + GameplayScene + "' for playback (from '" +
                SceneManager.GetActiveScene().name + "')");
```

Working runs said `from 'MainMenu'`. Failing runs said `from 'SplashScreens'`, five times in a row.
That one field is the whole diagnosis, and it costs a string concatenation.
