---
category: engine-quirks
tier: generalizable
sourceGame: SurvivalSample
phase: "1,7"
question: "Does a Windows player build throw DllNotFoundException (WinError 126) for the Ludeo SDK library although the file is present in the player's Plugins folder? The error names the wrong file: the player's hardened DLL search hides both the SDK's own dependency and the SDK itself. Preload both by absolute path."
sanitized: true
---

# The player's hardened DLL search hides the SDK's native dependency

In Windows player builds the SDK failed to initialise: its first native call threw
`DllNotFoundException` for `LudeoSDK-Win64-Release.dll` with `WinError 126`, although the file was
present in `<game>_Data/Plugins/x86_64`. The Editor was fine.

## Two failing lookups, not one

The Unity player calls `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)`, which removes the
application directory, the working directory and `PATH` from the DLL search, leaving only `System32`.
Two separate things then fail:

1. The SDK statically imports `libx264-164.dll`, which ships beside it — and Windows never searches the
   directory a DLL was loaded *from* for that DLL's own imports.
2. IL2CPP requests the SDK itself **by bare name**, which under that hardening resolves only against
   `System32`.

Both produce the identical `126` naming the SDK. Fixing only the first changes nothing visible, which
cost a full build cycle to discover.

## The fix

Preload by **absolute path** before anything initialises the SDK: the dependency first, then every
`LudeoSDK-Win64-*.dll` in `Application.dataPath/Plugins/x86_64` (pattern-matched, because Release and
Development variants exist and only one ships in a given build). An absolute-path load performs no
search, and once a module is in the process the loader satisfies later requests for that base name —
import or `DllImport` — from the loaded module. The player's hardening stays intact. Verify with the
SDK's own initialisation lines, not just the absence of the exception.

## Traps

- **The error names the wrong file.** Never trust the file named in a `126`.
- **Copying either DLL next to the executable does nothing**, and that is not evidence against the
  dependency theory: the hardened search excludes the application directory too.
- **`LOAD_WITH_ALTERED_SEARCH_PATH` gives error 1114**, which suggests a `DllMain` failure. A red
  herring: the player does not use that flag.
- **A probe that loads by absolute path proves nothing about Unity**, which asks by bare name.

The reproduction that settles it is a tiny console program dropped into the build folder that calls
`SetDefaultDllDirectories(0x800)` and then `LoadLibraryExW`: vary absolute path against bare name, and
preload candidates one at a time. Seconds per run, no rebuild. Any other native plugin that ships its
own dependency DLL has the same latent shape.
