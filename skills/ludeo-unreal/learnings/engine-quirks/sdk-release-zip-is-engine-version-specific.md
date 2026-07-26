---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 3
question: "Does the target engine version match the engine the LudeoUESDK release zip was built against? The published release asset can be built for an OLDER engine (e.g. a 4.2x-era release) and fail to compile on a newer one (e.g. 5.6) until the engine-version-sensitive UE wrapper files are patched. Verify before assuming 'no version risk'."
sanitized: true
---

# The LudeoUESDK release zip is engine-version-specific — verify before trusting "any engine works"

## Precondition

You acquired the LudeoUESDK via the published **release zip** (the self-contained
`LudeoUESDK-<tag>.zip`), and the target project's engine is newer than the engine
the release was packaged against.

## The problem

`config/sdk-sources.json` currently says the plugin "supports UE 4.27 through 5.7"
and "Do not flag engine version compatibility as a risk." In practice a given
**binary release asset can be built/targeted for one specific engine** (observed:
a `4.2.x` release whose `.uplugin` still used the UE-4-era `WhitelistPlatforms`
field and a `PostConfigInit` runtime loading phase). Dropped into a newer engine
(5.6), the **UE wrapper modules** (`LudeoUESDK`, `LudeoUESDKEditor`) may not compile
without engine-API fixes, even though the bundled **core C SDK** is fine.

So "the plugin supports 4.27–5.7" is true of the *codebase*, not necessarily of
*the particular zip you downloaded*.

## Signals it's the wrong-engine build

- `.uplugin` uses `WhitelistPlatforms` (renamed `PlatformAllowList` in UE 5.x).
- Old loading-phase conventions, deprecated module settings.
- Wrapper compile errors against engine headers while the C SDK links fine.

## What works

1. **Build the `LudeoUESDK` module ALONE first** (enable only the SDK plugin, build
   the editor target) — *before* scaffolding your integration plugin. This surfaces
   engine-API drift cheaply, instead of burying it under your own first compile.
2. If the wrapper doesn't build on the target engine, **patch only the
   engine-version-sensitive UE wrapper files** (the `Source/LudeoUESDK` +
   `Source/LudeoUESDKEditor` modules and the `.uplugin`) from a build known-good on
   the target engine. The **core C SDK** (`Source/LudeoSDK/SDK/`) can be kept
   independently — a hybrid of "newer core C SDK + wrapper-known-good-on-target-engine"
   has compiled and linked cleanly (no C-API drift) when the wrapper/core versions
   are close.
3. Re-verify the standalone SDK build before continuing.

## Skill implication

The blanket "no version risk" note in `sdk-sources.json` is misleading. Either ship
per-engine release assets / a version matrix, or document the standalone-SDK-build
pre-check above as a required Stage 2 step. Do not let an agent assume the zip is
engine-agnostic and burn a long compile-fix loop on drift it was told not to expect.
