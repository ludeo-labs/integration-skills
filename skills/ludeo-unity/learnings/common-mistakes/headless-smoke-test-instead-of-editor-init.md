---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: 1
question: "Can the agent launch Unity itself (Editor installed locally, project not locked), so the phase-1 Initialize() smoke test can run headlessly instead of as a hand-clicked Editor action?"
sanitized: true
---

# Run the phase-1 smoke test headlessly — it removes the cursor-hook risk entirely

Phase 1 Step 4 warns that `LudeoManager.Initialize()` is not an inert probe: it brings up
the native/overlay layer, which hooks the OS cursor and input, and the Editor does **not**
tear that down when you stop play mode. The documented mitigation is to fire it once from a
`[MenuItem]`, read the log, and stop play immediately — which leaves a window where a
mis-step hooks the cursor across the whole Editor.

**A headless run removes the risk rather than managing it.** Put the smoke test in an
`Editor/` folder as a plain `public static` method and invoke it directly:

```
Unity.exe -batchmode -quit -projectPath <proj> \
  -executeMethod <Namespace>.LudeoSmokeTest.RunSmokeTest \
  -logFile <log>
```

The Unity process **exits when the method returns**, so whatever the native layer hooked
dies with the process. There is no interactive Editor left behind to inherit a hooked
cursor, and no human has to remember to stop play.

Why this works without any auth configured: `Initialize()` and
`SessionManager.CreateSession(out …)` are **synchronous and local**. `Activate` is the call
that needs auth (implicit Steam or explicit `launcherUserId`), and the smoke test does not
make it. So this leg can run before the auth values are known — do not treat missing auth
as a blocker for it.

A passing run logs, and should be grepped for:

```
[LudeoSmoke] init=Success
[LudeoSmoke] create=Success session=ok
```

plus **zero** `WrapperDllNotFound`. Seeing `LudeoLogManager:InitNativeHook` in the log is
corroboration that the native layer actually loaded.

Caveats:

- This covers the **Editor leg only**. The player-build leg still matters — IL2CPP plus
  native plugins differ from the Editor — and is normally deferred.
- Unity must not already have the project open; a held lock makes batchmode fail.
- Still delete the throwaway once both legs pass; the real init belongs in the phase-3 layer.
