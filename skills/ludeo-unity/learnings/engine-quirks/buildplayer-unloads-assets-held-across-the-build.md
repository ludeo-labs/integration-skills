---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: 7
question: "Does a build script hold a loaded asset reference (ScriptableObject, prefab, settings asset) across a BuildPipeline.BuildPlayer call and write to it afterwards — e.g. to restore a temporarily flipped configuration?"
sanitized: true
---

# BuildPlayer unloads loaded assets — a reference held across it is destroyed, and the failed restore strands the flipped config on disk

A ship-build editor method that temporarily flips configuration (scripting defines, a
settings ScriptableObject like `LudeoSettings`) and restores it in a `finally` looks
airtight. It isn't: `BuildPipeline.BuildPlayer` runs an asset unload pass, and any asset
object loaded before the build (via `Resources.Load` or `AssetDatabase.LoadAssetAtPath`)
is destroyed by the time the call returns. The managed wrapper survives as Unity's
fake-null: **field writes on it appear to succeed** (they go nowhere), and the first real
engine call — `EditorUtility.SetDirty(settings)` — throws `ArgumentNullException`.

The failure cascades in batchmode:

1. The build itself SUCCEEDS (the flipped values were saved before the build, so the
   baked player is correct).
2. The `finally` throws mid-restore. `-executeMethod` reports "threw exception", exit 1 —
   which looks like a failed build until the log is read to the end.
3. Worst part: the editor saves `ProjectSettings.asset` only on a clean quit. The
   exception aborts that, so even define/bundleVersion restores that ran **in memory**
   never reach disk. The project is stranded in the ship configuration — on the next dev
   build or editor open, dev tools are gone and launcher-auth is on, with nothing to say why.

## The fix

In the restore path, **reload the asset by path instead of trusting the pre-build
reference**, and **save the project explicitly** so an earlier partial failure cannot
strand the flip:

```csharp
finally
{
    PlayerSettings.SetScriptingDefineSymbolsForGroup(group, devDefines);
    settings = AssetDatabase.LoadAssetAtPath<MySettings>(SettingsAssetPath); // reload!
    if (settings != null) { /* restore fields */ EditorUtility.SetDirty(settings); }
    AssetDatabase.SaveAssets();
    EditorApplication.ExecuteMenuItem("File/Save Project"); // ProjectSettings won't save on a thrown-out quit
}
```

Recovery when it does happen: the flip is exactly the diff `git status` shows on
`ProjectSettings.asset` and the settings asset — `git checkout --` both.

## How to spot the true outcome in the log

Exit code and the "threw exception" tail say failure; the truth is earlier: the build's
own SUCCEEDED line, then a stack trace pointing into the `finally`. Grep for both the
success marker and `ArgumentNullException` before declaring the build dead — this is the
exit-code-lies rule in the other direction: **exit 1 does not mean the artifact is bad.**
