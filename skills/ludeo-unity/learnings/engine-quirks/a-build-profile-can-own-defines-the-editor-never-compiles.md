---
category: engine-quirks
tier: generalizable
sourceGame: TopDownRogueSample
phase: "1,3,7"
question: "Is the game on Unity 6+ and built through Build Profile assets (Assets/Settings/Build Profiles/*.asset, or a CI step passing a build profile)? A define that lives only in a profile's m_ScriptingDefines is absent from every Editor and headless compile, so the code it gates is never compiled or run by your gates."
sanitized: true
---

# A Build Profile can own defines the Editor never compiles with

Unity 6 Build Profiles carry their own **scripting defines** (`m_ScriptingDefines` in the profile
asset), separate from Player Settings. The Editor, and a plain `-batchmode -quit` compile, use them only
when that profile is the **active** one. A CI job that passes the profile does.

Observed: the game's store-platform wrapper sat in its own asmdef with
`"defineConstraints": ["<STORE_DEFINE>"]`, and that symbol was defined **only** in the store's Build
Profile, not in Player Settings. Consequences:

- Every headless compile gate passed without ever compiling the store wrapper. A Ludeo change that broke
  it would stay green until the first profile build.
- In the Editor the store client is never initialized, so an Editor run tells you nothing about how the
  store init interacts with the SDK: implicit auth, a restart-through-the-store call quitting the player,
  init order against `Activate`.
- A phase-1 "does the store wrapper leak into game code" grep looks clean for the wrong reason if you
  reason only from the Editor's defines.

## The check (phase 1, minutes)

```
grep -n -A6 "m_ScriptingDefines" "Assets/Settings/Build Profiles/"*.asset
grep -rn "defineConstraints" --include=*.asmdef Assets/
```

Any symbol a `defineConstraints` entry needs that is missing from Player Settings'
`scriptingDefineSymbols` is supplied by a profile, or by nothing at all. Record which profile.

## What it buys you later

A second Build Profile that leaves the store define out is a clean seam for the cloud build
([[the-cloud-build-is-a-second-configuration-not-a-modified-one]]): it removes the store wrapper at
compile time with no game-code edits and without touching the studio's own profile. It can be built
headlessly:

```
Unity.exe -batchmode -quit -projectPath <proj> -activeBuildProfile "<cloud profile>.asset" -build "<out>\<Game>.exe" -logFile <log>
```

Caveat: that command is the studio's pipeline only when the profile **is** their pipeline. If they
build through a build tool, CI script or custom window, build through that instead
([[build-players-only-through-the-studios-own-pipeline]]). Check whether Addressables content is built
with the player (`m_BuildAddressablesWithPlayerBuild`) rather than assume it.

Related: [[store-platform-removal-is-layered-not-a-single-fix]]: a profile without the store define
removes the wrapper's compile-time surface in one move; runtime assumptions elsewhere still need
checking.
