---
category: engine-quirks
tier: generalizable
sourceGame: RoomActionSample
phase: 7
question: "Does an editor build script change an asset for one build (e.g. LudeoSettings.runWithoutLauncher off for the cloud build) and put it back afterwards?"
sanitized: true
---

# `BuildPipeline.BuildPlayer` destroys assets loaded before it — reload before restoring

A command-line build helper turned `LudeoSettings.runWithoutLauncher` off for the cloud build and restored it in a
`finally` after `BuildPipeline.BuildPlayer`. The build succeeded, then the restore threw `MissingReferenceException:
The object of type 'LudeoSettings' has been destroyed` — the build unloads assets, so the reference taken before it
was dead. The project was left with the local login off, which would have broken the next local test build.

```csharp
finally
{
    var settings = AssetDatabase.LoadAssetAtPath<LudeoSettings>(SettingsPath);   // reload: the old reference is dead
    settings.runWithoutLauncher = true;
    EditorUtility.SetDirty(settings);
    AssetDatabase.SaveAssets();
}
```

After such a build, check the asset on disk (`runWithoutLauncher:` line) rather than trusting the script ran to the
end. Keep the cloud build in its own output folder so the local test build is never overwritten.
