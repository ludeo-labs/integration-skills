---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 1
question: "Are you treating 'Ludeo → Setup Ludeo SDK' as a required manual step, and did you see UpdateLudeoCoreDllReference logged twice?"
sanitized: true
---

# `Ludeo → Setup Ludeo SDK` already ran itself at package import (plugin v4.3.1.0)

The phase-1 brief presents **Ludeo → Setup Ludeo SDK** as the manual step that performs the
native-core-DLL write-back. On plugin **v4.3.1.0** the package's own `AssetPostprocessor` already
did it at import time. The Editor log carries the full chain:

```
UpdateLudeoCoreDllReference to: LudeoSDK-Win64-Release.dll
  LudeoPlatformSettings:UpdateLudeoCoreDllReference (LudeoSDKCoreDll, BuildTarget)
  LudeoPlatformSettings:UpdateLudeoCoreDllReference (LudeoSDKCoreDll)
  LudeoConfigMenu:SetupLudeoSDK ()                      ← the "manual" menu action…
  LudeoUnityEditorHelpers:UpdateMetaSettings ()
  LudeoUnityEditorHelpers:SetupLudeoAssets ()
  LudeoPostProcess:RunSetupOnce ()                      ← …invoked by the package itself
  UnityEditor.EditorApplication:Internal_CallDelayFunctions ()
```

Invoking the menu afterwards logs the **same line a second time**, with a shorter stack that stops at
`LudeoConfigMenu:SetupLudeoSDK`. Two identical `UpdateLudeoCoreDllReference to: …` lines is the
**expected** signature of import-auto-run + manual-run, not a double-configure bug.

**What this changes:**
- **Still run the menu once** — it is idempotent and it is the cheapest confirmation that the *active
  build target* resolves to a supported core DLL. Nothing is harmed by the second run.
- **Don't diagnose the duplicate line.** Distinguish the two by stack depth: a trace containing
  `LudeoPostProcess:RunSetupOnce` is the import auto-run; one starting at `LudeoConfigMenu` is yours.
- **The failure case surfaces earlier than you expect.** Because the write-back runs at import,
  `UpdateLudeoCoreDllReference failed to find dll name for: <coreDll>, <buildTarget>` can already be
  in the log *before* you ever open the menu. If the active build target is unsupported, that error is
  an **import-time** symptom — set the target to a supported one and reimport, rather than assuming
  the menu never ran.
- **Corollary for a scripted/CI install:** the core-DLL reference does not depend on a human clicking
  the menu, so a headless package install is not silently mis-configured for lack of the click.

**Unchanged:** the package must still be installed **mutable** (`file:` → an extracted *folder*, or
embedded under `Packages/`). The write-back edits files inside the package; from a read-only
`PackageCache` install it fails silently whether it is triggered by the postprocessor or the menu.
