---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: 1
question: "Is LudeoUnityEditorHelpers.SetupLudeoAssets being run headlessly for the FIRST time, i.e. before LudeoSettings.asset exists on disk?"
sanitized: true
---

# The first headless SDK setup run throws — run it twice

Running `-executeMethod LudeoSDKUnityEditor.LudeoUnityEditorHelpers.SetupLudeoAssets` on a
project that has no `LudeoSettings.asset` yet **throws, and the throw is partially benign**:

```
Unable to import newly created asset : Assets/LudeoSDK/Resources/LudeoSettings.asset
UnityException: Creating asset at path Assets\LudeoSDK\Resources\LudeoSettings.asset failed.
  at LudeoSDKUnityEditor.LudeoConfigMenu.CreateLudeoSettings ()
executeMethod ... threw exception.
```

The cause is the batch: `UpdateMetaSettings` wraps its steps in
`AssetDatabase.StartAssetEditing()`/`StopAssetEditing()`, and a freshly created asset is not
import-ready inside that batch. The package's own source comments acknowledge this.

**What actually happened on disk — verify, don't infer from the exception:**

| Step (in `UpdateMetaSettings` order) | Ran? |
|---|---|
| `SetupLudeoStreamingAssets()` | ✅ files created |
| `SetWin64ImportSettings()` | ✅ |
| `LudeoConfigMenu.SetupLudeoSDK()` → create settings asset | ⚠️ file written, then threw on import |
| `LudeoPlatformSettings.UpdateLudeoCoreDllReference(...)` | ❌ **never ran** — the throw aborted before it |

That last row is the one that bites. The core-DLL reference selects which native DLL is
active; leaving it unset is a plausible route to a later `WrapperDllNotFound`.

**Fix — run the same command a second time.** On the second pass the asset already exists,
so `CreateLudeoSettingsFileIfNotExists` takes the load-existing branch and the run completes:

```
[Ludeo SDK] LudeoSettings.asset already exists. Keeping existing one.
UpdateLudeoCoreDllReference to: LudeoSDK-Win64-Release.dll
```

Exit code is `0` on **both** runs, so exit status is not a usable signal. Grep the log for
`UpdateLudeoCoreDllReference to:` to confirm the setup genuinely finished, and for
`threw exception` to catch the first-run abort.

If you write field values (e.g. `apiKey`) into the settings asset between the two runs, they
survive — the second run explicitly keeps the existing asset rather than recreating it.

See also [[headless-editor-setup-needs-executemethod]].
