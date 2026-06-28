---
category: engine-quirks
tier: generalizable
sourceGame: StoryPuzzleGame
phase: 2
question: "Is the target project on UE 5.3 (or any engine OLDER than the one the latest LudeoUESDK release was built for) AND hitting a stale-C-SDK-vs-backend problem? If so, the newest release zip's WRAPPER may not compile on your engine — keep a known-good-on-your-engine wrapper and swap in ONLY the newer core C SDK."
sanitized: true
---

# LudeoUESDK release repo moved; and on UE 5.3 the 4.3.x wrapper won't compile — use a core-only hybrid

Two findings from a UE **5.3** integration that needed a newer core C SDK to fix a stale-build/
backend mismatch (`unknown event_name "ludeo-play-ready"`, RoomReady never fires — see
[[sdk-build-version-must-match-current-backend]]).

## 1. The release repo moved

`config/sdk-sources.json` points at `EdgeGamingGG/ludeosdk-unreal-plugin`. The **current canonical
release repo is `ludeo-labs/unreal-plugin-releases`** (`gh release list -R ludeo-labs/unreal-plugin-releases`).
Both still publish the same tags (latest observed: `4.3.1`, asset `LudeoUESDK-4.3.1.zip`), but prefer
the `ludeo-labs` repo. `gh` must be authenticated (the LDL engineer's account `*-ludeo` worked).
Skill TODO: update `sdk-sources.json` to the `ludeo-labs/unreal-plugin-releases` repo.

## 2. The 4.3.x release zip requires UE 5.5+ — it does NOT compile on UE 5.3

The `LudeoUESDK-4.3.1.zip` **wrapper** modules use engine APIs that don't exist before UE 5.5:
- `EAllowShrinking::No` (UE 5.5+ enum) — `LudeoSessionManager.cpp`, `LudeoSession.cpp`
- `FScriptMapHelper::FIterator` / `FScriptSetHelper::GetElementPtr` / 4-arg `WriteData` — UE 5.5+
  container-helper APIs — `LudeoWritableObject.cpp`

On UE 5.3 these are hard compile errors (`C2653 'EAllowShrinking'`, `C2664` FIterator→int32, etc.).
This is the concrete recurrence of [[sdk-release-zip-is-engine-version-specific]] — "supports 4.27–5.7"
describes the *codebase*, not the *particular published zip*, which is built for one recent engine.

## 3. The fix: core-only hybrid (keep your 5.3-good wrapper, swap only the core C SDK)

The backend-protocol handling that emits/recognizes `ludeo-play-ready` lives in the **core C SDK**
(`Source/LudeoSDK/SDK/` — the native `LudeoSDK-Win64-*.dll` + headers), NOT in the UE wrapper. So you
do **not** need the new wrapper at all:

1. Keep the wrapper that already compiles on your engine (here: the `4.2.0` release wrapper, which
   built fine on 5.3). Restore it as `Plugins/LudeoUESDK`.
2. Delete its stale `Source/LudeoSDK/SDK/` and drop in the newer core from the new release
   (here: CoreSDK **4.2.2**, bundled in the `4.3.1` zip — the wrapper VersionName and the CoreSDK
   version are independent; the 4.3.1 release notes literally say "Updated CoreSDK version to 4.2.2").
3. Clear the wrapper's stale `Binaries/` + `Intermediate/`, rebuild the editor target.

Result on 5.3: `Module.LudeoUESDK.*.cpp` compiled and linked clean against the 4.2.2 core — **no
C-API drift** when wrapper/core versions are close (4.2.0 wrapper ↔ 4.2.2 core). This matches the
hybrid remedy in [[sdk-release-zip-is-engine-version-specific]].

**Gotcha after the swap:** the runtime may still load the OLD core DLL — see
[[refresh-project-binaries-after-core-sdk-swap]]. Always confirm the fix by grepping the run log for
`LudeoSDK v…` and verifying the version actually changed.

## How to keep the backup out of UBT's way

When backing up the old plugin, move it **outside the project tree** (e.g. a sibling of the repo).
Leaving `Plugins/LudeoUESDK_bak/` inside `Plugins/` makes UBT compile BOTH copies' `*.Build.cs` →
`CS0101`/`CS0229` "already defines"/"ambiguity" on `LudeoSDK`/`LudeoUESDK`/`LudeoUESDKEditor`, and the
whole build-rules assembly fails before any C++ compiles.
