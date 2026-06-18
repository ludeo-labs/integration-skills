---
category: common-mistakes
tier: universal
sourceGame: EndlessFPS
phase: 2
question: "Did you build the LudeoUESDK plugin alone on the project's engine version before scaffolding the integration plugin?"
sanitized: true
---

# Build the LudeoUESDK plugin standalone before scaffolding the integration

Acquiring the SDK plugin (release zip or submodule) does not prove it compiles on the project's engine version. A release asset may target a different engine version and need adjustment before it builds — for example `WhitelistPlatforms` (4.x) → `PlatformAllowList` (5.x) in the `.uplugin`, or a changed module loading phase.

**Do this:** after adding `LudeoUESDK` to the project, build that module **alone** (Editor target) and confirm it compiles and links *before* scaffolding the `LudeoIntegration` plugin on top of it. If you scaffold first, engine-API drift surfaces as a long, confusing compile-fix loop tangled with your own new code instead of an isolated, obvious SDK build failure.

This is a build-verification discipline, independent of any specific version-support claim: build the dependency clean before you depend on it.

See also [[uplugin-must-declare-plugin-deps]] and [[ludeouesdk-default-branch-lacks-ue57-fixes]].
