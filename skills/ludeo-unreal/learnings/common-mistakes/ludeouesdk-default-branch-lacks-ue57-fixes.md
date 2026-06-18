---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 2
question: "For UE 5.4+ projects, check if the LudeoUESDK default branch (dev) compiles cleanly. If not, look for a feature branch with 'ue57' or 'deprecated API' fixes before writing any integration code."
sanitized: true
---

# LudeoUESDK default branch (`dev`) does not compile on UE 5.4+ out of the box

## The Problem

When adding LudeoUESDK as a git submodule in Stage 0, you land on `origin/HEAD -> dev` by default. On UE 5.4+, a clean build fails inside the SDK plugin itself with:

```
error C2039: 'IsPendingKill': is not a member of 'UObject'
error C2039: 'MarkPendingKill': is not a member of 'UObject'
```

in `Plugins/LudeoUESDK/Source/LudeoUESDK/Private/LudeoUESDK/LudeoSaveSystem/LudeoLoadGameSpecification.cpp`. These UE 4.x APIs were removed in UE 5.0, so the errors appear in every UE 5.x version — they are latent in `dev` and only surface when the LudeoSaveSystem module is included in a game build.

(Warnings for deprecated APIs — `FObjectIterator` thread safety, `TArray::RemoveAt(bool bAllowShrinking)`, `Stats2.h` — also appear on 5.7 but are not fatal.)

## The Fix

The repo has a feature branch with the fixes already done: `ronen/lyra_and_ue57_int`. It is a **strict superset** of `dev` at the time of writing — 3 commits ahead, zero commits behind:

```
e54d251 Add PlatformUrl parameter to FLudeoSessionActivateSessionParameters and update session activation logic
c1aeb89 Fix deprecated API warnings for UE 5.7 compatibility
cc9c343 Replace raw UObject pointers with TObjectPtr in UPROPERTY declarations
c6ef155 Update CoreSDK to 4.1.0 — Thread-safe DataWriter support (#111)   ← dev HEAD
```

Checkout inside the submodule (absolute path required — see `engine-quirks/relative-paths-in-bash-commands.md`):

```bash
cd "<absolute-path>/Plugins/LudeoUESDK" && git checkout -B ronen/lyra_and_ue57_int origin/ronen/lyra_and_ue57_int
```

Record the branch in `integration.json → sdkSetup.uePlugin.branch`.

## How to detect early

**During Stage 0 or Stage 2, before the first build:**

1. Read the game's UE version from `.uproject → EngineAssociation`.
2. If version is 5.0 or newer, ask the human during Stage 0 whether a non-default branch should be checked out, and note the `ronen/lyra_and_ue57_int` candidate.
3. Alternatively, grep the SDK for `IsPendingKill` before the first build:
   ```bash
   grep -r "IsPendingKill\|MarkPendingKill" "<plugin-path>/Source"
   ```
   If matches exist AND the game is UE 5.x, switch branches before building.

## Extra benefit from switching

The `ronen/lyra_and_ue57_int` branch also adds `PlatformUrl` as a first-class field on `FLudeoSessionActivateSessionParameters`. On `dev`, plugin code that sets `PlatformUrl` would fail to compile. The skill's Stage 2 reference guidance in `references/phase-02-lifecycle.md` §5.3 already includes `PlatformUrl` handling — so the skill's own reference code is **incompatible with `dev` by design** and only compiles against this feature branch. This is another reason to always prefer the feature branch on UE 5.x integrations.

## Skill action

Stage 0 should:
1. Detect UE version from `.uproject`
2. If 5.0+, query the LudeoUESDK repo branches (or have a known list in `config/sdk-sources.json`) and prompt the human to pick one. Default suggestion for UE 5.7: `ronen/lyra_and_ue57_int`.
3. After the submodule is added, run the checkout via absolute path and record the resulting branch and SHA in `integration.json`.

Until `dev` catches up with these fixes, this is a universal step for all UE 5.x integrations.
