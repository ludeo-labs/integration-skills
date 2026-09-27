---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "1,7"
question: "Does the studio have its own build pipeline — a build window, build-configuration assets, CI entry points — and are you about to make a player with Unity's standard Build Settings dialog or a bare BuildPipeline.BuildPlayer call instead? A player made that way can launch and then fail in several unrelated-looking ways."
sanitized: true
---

# Build players only through the studio's own pipeline

A studio's build pipeline does work that Unity's standard build does not, and skipping it does not fail
the build. It produces a player that starts and then breaks in ways that point nowhere near the build
method. One Windows player built through Unity's own dialog failed three ways at once:

| Symptom | Actual cause |
|---|---|
| Closes right after the splash screen | the pipeline copies Steam's app-id file next to the executable; without it the game asks Steam to relaunch it and quits (`SteamAPI.RestartAppIfNecessary`) |
| Most models never load: `Invalid path in TextDataProvider .../aa/settings.json`, then `No Location found for Key=...` | the pipeline rebuilds Addressables content as a separate step; `BuildPipeline.BuildPlayer` never builds it, and skipping it does not fail the build |
| The loading screen never finishes | the development flag baked into the project settings disagreed with the dialog's own Development Build checkbox, so FMOD asked for its logging library variant while only the release variant shipped; the exception killed the game's loading routine before it signalled completion |

They look like a corrupt project, a broken asset database and an engine bug. They were one operator
mistake.

## The habit

1. **Find the studio's pipeline before the first player build** — a build window, per-platform build
   configuration assets, CI entry points — and build through it. For the cloud, add one more
   configuration to it rather than changing an existing one (see
   [[the-cloud-build-is-a-second-configuration-not-a-modified-one]]).
2. **When a player misbehaves, check how it was built before reading code.** Fast triage on the output
   folder: is the store's app-id file next to the executable; does `StreamingAssets/aa/` hold
   `settings.json` and bundle files (a folder holding only stale catalogs was never built); does the
   plugins folder hold the library variant the log asks for.
3. **Verify content, not the build result**: grep the built Addressables catalog for a known key.
4. **Don't kill a build that looks hung** (see [[a-build-that-looks-hung-is-usually-the-linker]]), and
   see [[buildscriptsonly-is-not-scripts-only-with-addressables]] for why "scripts only" is not a
   shortcut.
