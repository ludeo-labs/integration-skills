---
category: engine-quirks
tier: generalizable
sourceGame: ActionAdventureSample
phase: 1
question: "Does the native core version logged at Initialize() differ from the UPM package version you installed?"
sanitized: true
---

# The native core logs a DIFFERENT version than the UPM package — this is normal

At `LudeoManager.Initialize()` the native layer prints its own banner:

```
Core:Log LudeoSDK v4.2.5.0, GitHash:…, Build type:Release, Build Timestamp:…
```

On a plugin installed from the **v4.3.1.0** UPM release, the core reported **v4.2.5.0**. The managed
wrapper version (the UPM package / `package.json`) and the bundled native core version are
**independently numbered** and are expected to differ.

**Why it matters:** during the phase-1 smoke test this reads as "I installed the wrong package" or
"the release zip is stale", and it invites a pointless reinstall. It is not an error, and it is not a
signal that the wrapper and core are mismatched.

**What to actually check** at the smoke test — the version banner is not one of them:

- `Initialize()` returns a `LudeoResult` at all (any value) → the native plugin loaded.
- `WrapperDllNotFound` → it did **not** load; that is the real failure mode to chase.
- `CreateSession` returns `Success`.

**Corollary:** when reporting an SDK bug to Ludeo, quote **both** numbers — the UPM package version
and the core banner (plus its `GitHash`). They identify different components.
