---
category: engine-quirks
tier: generalizable
sourceGame: IdleSample
phase: "7"
question: "Did a player build of a project that uses Addressables fail in its first seconds with the Scriptable Build Pipeline error 'Unable to build with the current configuration, please check the Build Settings.' followed by 'Failed to build Addressables content'? Check that the installed Editor actually has the player variant for the target + scripting backend before touching Build Settings."
sanitized: true
---

# "Unable to build with the current configuration" is usually a missing player module

A Windows IL2CPP release build died about 8 seconds in, before any preprocess hook ran:

```
InvalidOperationException: Unable to build with the current configuration, please check the Build Settings.
BuildFailedException: Failed to build Addressables content, content not included in Player Build. "SBP ErrorException"
```

Nothing in Build Settings was wrong. The Scriptable Build Pipeline raises that message when
`ContentPipeline.CanBuildPlayer` is false, which is the Build Settings window's **Build button** state for
the target (`IBuildWindowExtension.EnabledBuildButton()`). On Windows that button is disabled when the
chosen scripting backend's player is not installed: `<Editor>/Data/PlaybackEngines/WindowsStandaloneSupport/Variations/`
held only `*_mono` folders, no `win64_player_nondevelopment_il2cpp`, and the project's backend was IL2CPP.

## Check first

- List `.../WindowsStandaloneSupport/Variations/` for the backend you build (`*_il2cpp` vs `*_mono`).
- Install the missing module ("Windows Build Support (IL2CPP)", module id `windows-il2cpp`). The Unity
  CLI's `install-modules` downloads it but its installer needs UAC elevation, which an agent shell cannot
  raise, so have the developer add it from Unity Hub (Installs, Add modules). IL2CPP on Windows also needs
  a Visual Studio C++ toolchain
  (`vswhere -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64`).
- Or build the Mono variant if the target accepts it, but decide that deliberately, not as a workaround.
