---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 8
question: null
sanitized: true
---

# Plugin dependencies must be in .uplugin, not just .Build.cs

Module dependencies in `.Build.cs` make code compile and link. But UE also requires plugin-level dependencies in the `.uplugin` file's `"Plugins"` array. Without them, the editor logs warnings like:

> Warning: Plugin 'LudeoIntegration' does not list plugin 'GameplayAbilities' as a dependency, but module 'LudeoIntegrationRuntime' depends on module 'GameplayAbilities'.

Every module dependency that comes from a separate plugin must have a corresponding entry in `.uplugin`:

```json
"Plugins": [
    { "Name": "LudeoUESDK", "Enabled": true },
    { "Name": "ModularGameplay", "Enabled": true },
    { "Name": "GameplayMessageRouter", "Enabled": true },
    { "Name": "GameplayAbilities", "Enabled": true },
    { "Name": "CommonGame", "Enabled": true },
    { "Name": "CommonUI", "Enabled": true },
    { "Name": "ShooterCore", "Enabled": true }
]
```

Add these during Stage 2 plugin scaffold, and update when new module deps are added in later stages.
