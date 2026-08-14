---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: 1
question: "Is the Ludeo package being installed or configured headlessly (-batchmode, CI, or an agent driving Unity), rather than by a human in an interactive Editor session?"
sanitized: true
---

# Headless installs get no SDK project setup — invoke it with `-executeMethod`

Phase 1 says the plugin's project setup (StreamingAssets provisioning, native-plugin
import settings, `LudeoSettings.asset`) happens automatically on import. That is true
**only in an interactive Editor session**.

In the v4.3.x package the SDK is compiled from source, so there is no managed-DLL import
event to hook. `LudeoPostProcess` instead runs `[InitializeOnLoad]` and defers the real
work with `EditorApplication.delayCall` (`LudeoPostProcess.cs`), because `AssetDatabase`
edits are unsafe directly inside a domain-reload static constructor.

**Under `-batchmode -quit`, Unity exits before `delayCall` ever fires.** The package
resolves, its assemblies compile, `using LudeoSDK;` works — and the project setup silently
does not happen. Nothing errors, so the install looks successful.

Symptoms of the silent skip:

- no `Assets/StreamingAssets/<sdk>/` files
- no `Assets/LudeoSDK/Resources/LudeoSettings.asset`
- native plugin import settings never applied for the target platform
- the core-DLL reference never selected — a later `Initialize()` can fail with
  `WrapperDllNotFound` for what looks like a packaging problem

**Fix — call the setup entry point explicitly:**

```
Unity.exe -batchmode -quit -projectPath <proj> \
  -executeMethod LudeoSDKUnityEditor.LudeoUnityEditorHelpers.SetupLudeoAssets \
  -logFile <log>
```

`SetupLudeoAssets` is the full path (StreamingAssets + platform import settings +
settings asset). Calling only `LudeoConfigMenu.SetupLudeoSDK` creates the settings asset
but skips the first two.

Note the menu item is **`Ludeo/Setup Ludeo SDK`**. Workflow text referring to
"Ludeo → Setup and Show LudeoSettings" does not match the v4.3.x package.

See also [[sdk-setup-needs-two-headless-runs]] — the first headless invocation partially
throws.
