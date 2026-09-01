---
category: engine-quirks
tier: generalizable
sourceGame: ActionAdventureSample
phase: 1
question: "Did Initialize() log a yellow 'DummyOSSystems SetLoggerCallbacks (called too early?)' warning?"
sanitized: true
---

# `DummyOSSystems SetLoggerCallbacks (called too early?)` during Initialize is benign

A yellow warning fires on **every** `LudeoManager.Initialize()`:

```
LudeoSDK:  DummyOSSystems SetLoggerCallbacks (called too early?)
  … LudeoLogManager:SetLogCallback
  … LudeoManager:SetLoggingCallback
  … LudeoManager:UpdateLogSettings      ← LudeoManager.cs, inside SetupLocalConfig
  … LudeoManager:.ctor
  … LudeoManager:Initialize
```

**Cause — ordering inside the SDK, not a fault in your integration.** `Initialize()` runs the
`LudeoManager` constructor → `SetupLocalConfig()` → `UpdateLogSettings()` *before* it instantiates
`LudeoUnityManager` and injects the real `IInterfaceFactory`. Until that injection, the interface
factory is still `DummyInterfaceFactory`, so the logger callbacks land on `DummyOSSystems`, which
warns. The very next lines in the log confirm the recovery:

```
Interface implementation found: LudeoUnityManager(Clone) (LudeoSDK.NativeCode.LudeoInterfaceFactory)
[UNITY_HOOK] Awake
```

The warning's own text ("called too early?") invites you to go looking for a call-order mistake in
your own code. There is none to find — the game cannot influence this, and nothing about it changes
whether `Initialize()` succeeds.

**Do not:** move your `Initialize()` call earlier/later, add a delay frame, or pre-register logging
callbacks to try to silence it. Confirm `init=Success` and move on.
