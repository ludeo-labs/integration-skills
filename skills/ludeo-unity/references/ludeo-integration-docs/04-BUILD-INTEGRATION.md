# 04 — Build Integration (Unity)

How the Ludeo SDK fits into a Unity build, and how to verify the project still builds and runs both
**without** and **with** the SDK. The install/config mechanics live in
[`unity/UPM-INSTALL-AND-DEFINES.md`](./unity/UPM-INSTALL-AND-DEFINES.md); the disable model is
CR-001 in [`00-CRITICAL-REQUIREMENTS.md`](./00-CRITICAL-REQUIREMENTS.md).

> **There is no build script.** Unity's "build" is the Editor + Player Settings + installed
> packages. You don't edit CMake/Make/.vcxproj, and there is no `LUDEO_SDK_ENABLED`-style macro to
> flip — the package is auto-referenced once installed, and Ludeo is disabled at **runtime**.

---

## The build model

```
Install package (UPM or .unitypackage)
   └─ auto-referenced runtime asmdef ⇒ `using LudeoSDK;` compiles everywhere
   └─ LudeoPostProcess sets up StreamingAssets on import
   └─ Resources/LudeoUnityManager.prefab drives SDK Tick at runtime (CR-005)
Configure LudeoSettings.asset (apiKey, …)
Wire the integration layer (REFERENCE-ARCHITECTURE.md), all SDK use behind interfaces
   └─ consent/uninit ⇒ Dummy*/Disabled* ⇒ game runs normally (CR-001)
Build the player (Mono or IL2CPP), Windows target
```

The "enabled vs disabled" axis in Unity is **runtime** (consent + dummies), not a compile flag —
unless you deliberately ship a build that excludes the package (optional define; see the install
doc §4).

---

## Two builds to verify (the Unity meaning of "baseline + SDK")

Like the generic workflow, prove the integration didn't break the game — but in Unity terms:

1. **Baseline** — *before* installing the package / wiring the layer (or in a config with Ludeo
   disabled): the project compiles in the Editor and the game plays. Capture this as your reference.
2. **SDK-enabled** — *after* install + layer wiring: the project still compiles, the game still
   plays, and with consent off the dummy path leaves gameplay unchanged.

If the project ships a no-package configuration (install doc §4), also verify it **compiles with the
package removed** behind the optional define.

**Verify each in two places:** the **Editor** (fast iteration) *and* a **player build** (IL2CPP +
native plugins behave differently from the Editor — see below).

---

## Compiling & checking errors

- **Editor:** scripts recompile on focus/save. Watch the **Console** for compile errors; the
  integration must be error-free with the package present. (Phase 3 · task 5 drives the fix loop.)
- **Batch/CI:** a player build can be produced headless, e.g.
  `Unity -batchmode -quit -projectPath <proj> -buildTarget Win64 -executeMethod <YourBuilder.Build>`
  (the project supplies the build method). Use this to confirm IL2CPP builds, not just the Editor.
- A clean compile with the package installed is the phase-1 gate.
- **The agent can't see the Console** — read compile errors and runtime/SDK output from Unity's log
  files (or a `-logFile` capture). See [`unity/READING-UNITY-LOGS.md`](./unity/READING-UNITY-LOGS.md).

---

## Platform, backend & stripping

- **Platform:** Ludeo capture targets **Windows desktop**. The package ships native plugins for
  `x86`/`x86_64`. Don't claim non-Windows support without confirming the native layer exists for it.
- **Scripting backend:** Mono and IL2CPP both work. **IL2CPP** is typical for shipping — verify a
  player build, because stripping/AOT issues won't show in the Mono Editor.
- **Code stripping (IL2CPP):** keep the package's `link.xml`. SDK types are reached through native
  callbacks and can be stripped without it. If you maintain a project `link.xml`, preserve Ludeo's
  entries.
- **Native dll presence:** if the native plugin is missing or arch-mismatched, the SDK reports
  `LudeoResult.WrapperDllNotFound` at runtime (init callback) rather than failing to compile.

---

## Build-time gotchas

- **Don't tick or instantiate the manager yourself.** `LudeoUnityManager` (from `Resources`) is
  created and ticked by the plugin. Recreating it or calling a tick is wrong (CR-005).
- **Don't gate the SDK behind a define by default.** The package is auto-referenced; a define is
  only for no-package build configs (install doc §4). Adding an unnecessary define just creates a
  way to forget to set it.
- **`StreamingAssets`** for Ludeo are created by `LudeoPostProcess` on import — don't hand-author or
  delete them; re-import the package if they're missing.
- **Dev-only settings off for release:** `runWithoutLauncher`, `autoStartInLudeo`,
  `ludeoToAutoStart` must be off in shipping builds (install doc §3).

---

## Phase-1 exit criteria

- [ ] Package installed (UPM or `.unitypackage`); `using LudeoSDK;` compiles with no extra wiring.
- [ ] `LudeoSettings.asset` present with a real `apiKey`; dev-only flags appropriate for the build.
- [ ] Baseline build verified (game compiles + plays).
- [ ] SDK-enabled build verified in the **Editor and a player build** (game compiles + plays;
      consent-off path unchanged).
- [ ] `InitLudeoSession` reaches its callback with a `resultCode` (proves the native layer loaded;
      `WrapperDllNotFound` means it didn't — fix platform/plugins before continuing).
- [ ] Player build is **self-contained**: `<Game>_Data/Plugins/` carries the Ludeo native(s) plus the
      3rd-party deps *this* build needs (detected per-build — config-driven, e.g. Steam only if not
      `runWithoutLauncher`, and/or a dependency walk of the native dll). The `validate-build` skill is
      the final gate (runs the exe from inside the folder; catches missing-DLL crashes).

→ See `1-build-game-with-sdk.md` (phase 1) for the step-by-step, and `3e-compile-and-fix.md` for the
error-fix loop.
