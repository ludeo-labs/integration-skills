---
category: common-mistakes
tier: universal
sourceGame: StoryPuzzleGame
phase: 3
question: null
sanitized: true
---

# After swapping the core C SDK, the project's own Binaries/ copy of the DLL is NOT refreshed by an incremental build

You swapped in a newer core C SDK (`Source/LudeoSDK/SDK/Bin/Win64/.../LudeoSDK-Win64-*.dll`) to fix a
stale-build/backend mismatch ([[sdk-build-version-must-match-current-backend]]), rebuilt the editor
target with 0 errors — and the running game **still logs the OLD** `LudeoSDK vX` and still shows
`unknown event_name "..."`. The rebuild relinked the wrapper but did NOT update every runtime copy of
the native DLL.

## Why

The native `LudeoSDK-Win64-{Release,Development}.dll` is a `RuntimeDependency`, copied to the target's
binary dir. There are multiple copies on disk, and an **incremental** editor build does not
necessarily overwrite all of them — in particular the **project-level** `<<Project>>/Binaries/Win64/`
copy can stay stale (older mtime) while the plugin-level `Plugins/LudeoUESDK/Binaries/Win64/` copy is
refreshed. The editor-game loads the project-level copy, so it keeps loading the old build. (The
`-game` editor run uses the **Development** DLL — match the config you actually run.)

## Fix

After any core-SDK swap, overwrite the runtime copies directly from the new source, for BOTH configs:

```
copy Plugins\LudeoUESDK\Source\LudeoSDK\SDK\Bin\Win64\Release\LudeoSDK-Win64-Release.dll          <Project>\Binaries\Win64\
copy Plugins\LudeoUESDK\Source\LudeoSDK\SDK\Bin\Win64\Development\LudeoSDK-Win64-Development.dll    <Project>\Binaries\Win64\
```

(or delete `<Project>/Binaries/Win64/LudeoSDK-Win64-*.dll` and do a clean rebuild so the copy is
re-staged). Then **verify by the log, not by faith**: grep the run log for `LudeoSDK v` and confirm
the version/GitHash/Build-date actually changed. The DLLs differ in size, so a quick
`find -iname LudeoSDK-Win64-*.dll -printf "%s %t %p"` exposes which copies are stale.

## Packaged builds

The same staleness applies harder to cooked packages — `Saved/StagedBuilds/` and the archived
`PackagedBuild/` keep the old core DLL across incremental cooks. After an SDK swap, **clean** repackage
(`BuildAndPackage.bat --clean`, or delete `PackagedBuild` + `Saved/StagedBuilds`) and re-grep the
packaged log for `LudeoSDK v…`. See [[stale-package-masquerades-as-missing-feature]] and the packaging
gotcha in [[sdk-build-version-must-match-current-backend]].
