---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 6
question: "Does the game run on the Ludeo cloud streamer at its normal graphics settings, or does the GPU crash mid-session? Cloud runs the Win Shipping build under Proton/Wine with D3D->Vulkan (vkd3d-proton) on a shared GPU; high/ultra settings can lose the device. Config/ini overrides may not stick if the game's menu framework re-applies its own settings on launch."
sanitized: true
---

# Cloud GPU device-loss — force a low-graphics profile at ECVF_SetByConsole

## Precondition

The integration works locally but on the Ludeo cloud (LudeoCast) the session **freezes / the stream goes black or stalls** shortly after gameplay starts. The cloud runs the **Windows Shipping** build on Linux under **Proton/Wine**, translating DirectX to **Vulkan via vkd3d-proton**, on a **shared** cloud GPU — a far less forgiving target than a local discrete GPU + native driver.

## Symptom (what the cloud log shows)

- `DXGI_ERROR_DEVICE_REMOVED (0x887a0005)` and/or `VK_ERROR_DEVICE_LOST` from vkd3d-proton.
- The streamer's frame-grab (`XGRAB`) starves — multi-second stalls — because no new frames are produced after the device is lost.
- Distinguish from a *paused/static* scene: if device-loss codes are absent and XGRAB is healthy (~0ms) but the picture is frozen, the cause is elsewhere (a held pause, a failed restore). Device-loss = the GPU actually fell over under load.

## Root cause

The game's normal high/ultra settings (Lumen GI + reflections, ray tracing, virtual shadow maps, volumetric fog/clouds, SSR/SSGI, full screen-percentage) overload the translated/shared cloud GPU and the device is lost mid-session.

## Fix — set a low-gfx cvar profile at `ECVF_SetByConsole` from the plugin

```cpp
#include "HAL/IConsoleManager.h"
void ULudeoGameStateComponent::ForceLowGraphics() const {
  IConsoleManager& CM = IConsoleManager::Get();
  auto Set=[&CM](const TCHAR* N,const TCHAR* V){ if(IConsoleVariable* CV=CM.FindConsoleVariable(N)) CV->Set(V,ECVF_SetByConsole); };
  Set(TEXT("t.MaxFPS"),TEXT("30"));            Set(TEXT("r.ScreenPercentage"),TEXT("50"));
  Set(TEXT("r.ViewDistanceScale"),TEXT("0.4")); Set(TEXT("r.DetailMode"),TEXT("0"));
  // GI / RT / VSM / volumetrics / SSR / SSGI / PostAA -> off (the device-loss culprits)
  Set(TEXT("r.DiffuseIndirect.Allow"),TEXT("0")); Set(TEXT("r.Lumen.DiffuseIndirect.Allow"),TEXT("0"));
  Set(TEXT("r.Lumen.Reflections.Allow"),TEXT("0")); Set(TEXT("r.RayTracing"),TEXT("0"));
  Set(TEXT("r.Shadow.Virtual.Enable"),TEXT("0")); Set(TEXT("r.VolumetricFog"),TEXT("0"));
  Set(TEXT("r.VolumetricCloud"),TEXT("0")); Set(TEXT("r.SSR.Quality"),TEXT("0"));
  Set(TEXT("r.SSGI.Enable"),TEXT("0")); Set(TEXT("r.PostProcessAAQuality"),TEXT("0"));
  // ...shadow/material/AO/anisotropy/foliage density also lowered
}
```

Call it at game-ready, and **re-assert it for a few seconds** (a frame-countdown re-applying every ~30 frames) — see gotcha below.

## Why `ECVF_SetByConsole` specifically (the non-obvious part)

A menu/settings framework (here a marketplace main-menu kit + its GameInstance) commonly calls `UGameUserSettings::ApplySettings()` on **every launch**, which writes scalability cvars at **`ECVF_SetByGameSetting`** / device-profile priority. On a fresh cloud machine with no savegame it benchmarks or resets to **high** defaults. UE cvar priority is `SetByScalability < SetByGameSetting < SetBySystemSettingsIni < SetByDeviceProfile < ... < SetByConsole`. So **`DefaultEngine.ini [SystemSettings]`, `DefaultScalability.ini`, and a `DefaultGameUserSettings.ini` all get overridden** by the framework — they did NOT stick. Only `ECVF_SetByConsole` (the highest non-debug priority) wins, and it must come from code you control (the plugin), because the `~` console and `-ExecCmds` are stripped in Shipping.

**Do not require editing the game's BP/settings framework** — on a marketplace kitbash the developer often doesn't know where settings live. The plugin-side `SetByConsole` override needs zero changes to the game.

## Gotchas

- **Re-assert, don't set-once.** The framework's apply can run *after* your game-ready hook, clobbering a one-shot call. Re-apply every ~30 frames for ~1–2 min after ready (a `LowGfxFramesLeft` countdown in `TickComponent`).
- **This is a floor, not a target.** Forcing everything to minimum proves stability but looks bad. Tune back up one bucket at a time (raise `r.ScreenPercentage`, `r.PostProcessAAQuality`, `r.ViewDistanceScale` first — best visual ROI; keep Lumen/RT/VSM/volumetrics off longest — they're the prime device-loss suspects), re-cooking and watching the log for `0x887a0005` after each step. The first device-loss is the ceiling.
- `LogLudeoIntegration` is stripped in Shipping, so you can't confirm from your own logs that `ForceLowGraphics` ran — confirm indirectly (e.g. `t.MaxFPS 30` shows up as the SDK `ludeo_Tick` rate dropping to ~30/sec) and by the disappearance of the device-loss codes.
