---
category: engine-quirks
tier: universal
sourceGame: VoyagerV2
phase: 2
question: null
sanitized: true
---

If the integration plugin uses UGameStateComponent (from ModularGameplay module), the .uplugin must list ModularGameplay as a plugin dependency — not just as a Build.cs module dependency. Without the plugin dependency, the cook process fails with "module could not be loaded" because UE loads plugins in dependency order.

```json
// .uplugin — must include:
"Plugins": [
    { "Name": "LudeoUESDK", "Enabled": true },
    { "Name": "ModularGameplay", "Enabled": true }  // ← REQUIRED
]
```

The compiler won't catch this — it only shows up at cook/package time when UnrealEditor-Cmd.exe tries to load the module.
