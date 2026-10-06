---
category: engine-quirks
tier: generalizable
sourceGame: TopDownRogueSample
phase: "5"
question: "Are you changing autoStartInLudeo, ludeoToAutoStart, runWithoutLauncher or the launcher user at runtime (a test harness picking the Ludeo to replay, a dev config file next to the exe) instead of baking them into LudeoSettings.asset?"
sanitized: true
---

# A runtime override of `LudeoSettings` must land before `Initialize()` copies it

A test harness that replays a Ludeo with nobody at the keyboard needs the SDK to auto-start **that**
Ludeo: `autoStartInLudeo = true`, `ludeoToAutoStart = <id>`. Writing those into the asset per run is
wrong twice over: a player build can't write its own assets, and in the Editor the change gets saved
into the project and ships. So the harness changes the settings object in memory. When it does this
matters.

## What the SDK does (observed on plugin 4.3.x; re-check on the installed version)

- `LudeoManager.Initialize()` constructs the manager, which reads the local config **once**: it copies
  `runWithoutLauncher`, `autoStartInLudeo` and `ludeoToAutoStart` (parsed as a `Guid`) from
  `LudeoUnityHelpers.GetLudeoSettings()` into its own config struct.
- `GetLudeoSettings()` caches the `Resources.Load` result, so everything reads one object.
- Later, the Activate callback and the first media-capture state change consult that **copy**, not the
  asset. A change after `Initialize()` has no effect, and nothing says so.
- Auto-start happens only when `runWithoutLauncher` is true.

## The habit

- Apply the override from a `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSplashScreen)]`
  method. That runs before every `BeforeSceneLoad` method, which is where layers usually call
  `Initialize()`. Or call it explicitly as the first line before `Initialize()`.
- Change the object `GetLudeoSettings()` returns, and keep a strong reference to it so it can't be
  unloaded and reloaded fresh from the asset.
- Never write the asset. In the Editor, refuse the override (log why) rather than risk it being saved.
- Log what changed, before and after, and put that line in the run's result. "Auto-start set to
  `<id>` before Initialize" is then evidence, not an assumption.
- If the replay boots something other than the Ludeo you meant, check the override's log line first:
  a late override leaves the previous asset values in force.

The same timing rule covers any other runtime source of these values, such as a dev-build config file
next to the exe: apply it before `Initialize()`.

Related: [[forcing-a-setting-for-a-replay-must-not-persist-it]] (the same don't-persist rule for the
game's own settings), [[qa-needs-a-launcherless-auth-override-in-the-ship-build]].
