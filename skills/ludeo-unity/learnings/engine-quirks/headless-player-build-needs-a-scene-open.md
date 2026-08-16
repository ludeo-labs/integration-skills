---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "3,7"
question: "Does the game implement BuildPlayerProcessor / IPreprocessBuildWithReport? If so, check whether it reads or restores the currently-open scene — that assumption breaks under -batchmode."
sanitized: true
---

# A game's own build hook can assume an open scene, which no headless build has

A headless player build failed with `BuildReport.summary.result == Failed` and
`summary.totalErrors == 0` — no compile errors, nothing obviously wrong. The real message was
further up the log:

```
Error building Player: ArgumentException: Scene file not found: ''.
  at <Game>.PreprocessBuild_ActionOnBuild.PrepareForBuild (BuildPlayerContext) [...]
```

The game's own `BuildPlayerProcessor` politely saves the scene the developer had open, does its
work, and restores it:

```csharp
public override void PrepareForBuild(BuildPlayerContext ctx)
{
    var activeScenePath = EditorSceneManager.GetActiveScene().path;
    // ... process scenes ...
    EditorSceneManager.OpenScene(activeScenePath, OpenSceneMode.Single);   // ← ""
}
```

Under `-batchmode` **no scene is open**, so `path` is `""` and the restore throws. The hook works
perfectly when a human clicks Build and fails every time from a shell.

## Why it matters beyond the immediate error

This is strong evidence the project **has never been built from the command line** — worth
checking against the rest of the build story (no CI config, build scripts that compute settings
and discard them). It shapes what phase 7 can assert about the shipped build, and it is worth
telling the studio: their build is not automatable as-is.

## The fix, on your side of the fence

Open a scene before calling `BuildPipeline.BuildPlayer`, in **your** build script, rather than
editing the game's hook:

```csharp
if (string.IsNullOrEmpty(EditorSceneManager.GetActiveScene().path))
    EditorSceneManager.OpenScene(enabledScenes[0], OpenSceneMode.Single);
```

Keeps the workaround removable with the rest of the integration, and leaves the studio's file
untouched.

## The general check

Before building headlessly, grep for the build-hook interfaces and read each implementation for
editor-only assumptions — an open scene, a focused window, a dialog, `EditorUtility.DisplayDialog`,
`Selection.activeObject`:

```
grep -rn "BuildPlayerProcessor\|IPreprocessBuildWithReport\|IPostprocessBuildWithReport" --include=*.cs Assets/
```

Related: [[buildscriptsonly-is-not-scripts-only-with-addressables]] — the other way a player build
surprises you, and why `result == Failed` with zero errors deserves a careful read of the log.
