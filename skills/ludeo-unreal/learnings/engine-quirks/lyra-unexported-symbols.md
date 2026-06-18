---
category: engine-quirks
tier: generalizable
sourceGame: Lyra
phase: 2
question: "Do the game classes you need to call from the plugin have their methods exported with the module's API macro (e.g., GAMENAME_API)? If not, which methods need export macros added?"
sanitized: true
---

Game module classes often do not export all their methods with the module API macro. When the Ludeo plugin (a separate DLL) calls into game module methods, unresolved external symbol linker errors occur.

In Lyra, `ULyraGamePhaseSubsystem::WhenPhaseStartsOrIsActive()` and `WhenPhaseEnds()` were not exported with `LYRAGAME_API`. The fix was adding `LYRAGAME_API` to those method declarations in the header. This is a core game modification that must be documented in the TDD.

**How to apply:** During Stage 2 analysis, identify every game class method the plugin will call. Check if each method has the module's API export macro. If not, add it to the Core Game Modifications table in the TDD. Common candidates:
- Phase/state subsystem methods (phase callbacks)
- GameMode delegates and methods
- Experience manager callbacks
- Any method called cross-module from the plugin
