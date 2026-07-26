---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 8
question: null
sanitized: true
---

# GameFeature plugins must set ExplicitlyLoaded to true

UE requires `"ExplicitlyLoaded": true` in the `.uplugin` file for any plugin under `Plugins/GameFeatures/`. Without it, the editor logs a warning at startup:

> GameFeaturePlugin LudeoIntegration, does not set ExplicitlyLoaded to true. This is required for GameFeaturePlugins.

Set this in the `.uplugin` during Stage 2 plugin scaffold creation.
