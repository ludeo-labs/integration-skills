---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 1
question: "Do you want to set LudeoSettings' apiKey / launcherUserId / betaVersion from the agent side rather than having the integrator type them into the Inspector?"
sanitized: true
---

# You can hand-author `LudeoSettings.asset` — but you must write EVERY field explicitly

Phase 1 normally has the integrator open **Ludeo → Setup and Show LudeoSettings** and type the values
into the Inspector. The agent can instead author
`Assets/LudeoSDK/Resources/LudeoSettings.asset` as YAML *before* Unity resolves the package. The
plugin cooperates: `LudeoConfigMenu.CreateLudeoSettingsFileIfNotExists` checks
`Resources.Load<LudeoSettings>("LudeoSettings")`, finds the hand-written asset, logs
`LudeoSettings.asset already exists. Keeping existing one.` and proceeds to the core-DLL write-back —
so the authored values survive.

**Two hard requirements.**

1. **`m_Script` must carry the plugin's own GUID** — read it out of the installed package at
   `Runtime/UnityScripts/LudeoSettings.cs.meta`. It is stable per plugin release, not per project:
   ```yaml
   m_Script: {fileID: 11500000, guid: <guid from LudeoSettings.cs.meta>, type: 3}
   m_Name: LudeoSettings
   ```
   Do not carry a GUID forward from a previous integration without re-reading the `.meta`.

2. ⚠️ **Write every field. Unity fills omitted fields with `default(T)`, NOT the C# field
   initializer.** This is the trap: `LudeoSettings` declares sensible defaults in code
   (`platformUrl = "https://services.ludeo.com"`, `ludeoLogLevel = Error`,
   `ludeoLogCategory = All`, `coreDllReference = Release`), and **none of them apply** to a
   hand-authored asset. Omit `platformUrl` → the backend URL is the empty string. Omit
   `ludeoLogCategory` → you get `Core` (`0`), not `All` (`0x7FFFFFFF`). The Inspector path never
   exposes this, because `ScriptableObject.CreateInstance` *does* run the initializers.

**Enums serialize as their integer value**, so read the numbers out of the plugin's own definitions
(`Runtime/Logging/LudeoLogging_Defs.cs`, `Runtime/Ludeo/Ludeo_Defs.cs`) rather than guessing — e.g.
`LudeoLogLevel.Log = 4`, `LudeoLogCategory.All = 2147483647`, `LudeoSDKCoreDll.Release = 0`. Booleans
are `0`/`1`. Quote a long numeric id (a launcher/user id) so YAML keeps it a string rather than
coercing it to a number.

**Verify from the log, not from the file** — `Initialize()` echoes the values it actually read:
```
LudeoSDK:  SetLogLevel to category: 'All' with level 'Log'      ← proves logLevel + logCategory parsed
LudeoSDK:  runWithoutLauncher is true. Not setting up one.      ← proves the auth toggle parsed
```
If either line disagrees with what you wrote, the asset did not deserialize as intended — check the
`m_Script` GUID first (a wrong GUID yields an asset with no script, and every field reads as default).

**Why bother:** it removes hand-transcription of a 36-character API key and a 17-digit launcher id,
puts the whole SDK configuration in the diff for review, and lets phase 1 finish without a
copy-into-Inspector round trip. The one thing it does **not** remove is the core-DLL write-back, which
needs the Editor (see the postprocessor learning in this category).
