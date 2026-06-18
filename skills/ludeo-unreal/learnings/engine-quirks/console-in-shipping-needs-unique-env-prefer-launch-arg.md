---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 2
question: "Do you actually need the ~ console in the Shipping build, or just to trigger Player Flow there? Console-in-Shipping forces a unique build environment (engine-module recompile on an installed engine) + a real Source/ Target.cs; the Player Flow launch arg (-LudeoID=<id>) needs neither."
sanitized: true
---

# Console in a Shipping build is expensive — prefer the Player Flow launch arg

## Precondition

You want to issue console commands (e.g. the Ludeo `Play` command) in a **Shipping** packaged build, on an **installed/Launcher** engine. (Development packages already have the console; this is only a Shipping problem.)

## The facts (verified against the engine source)

- The drop-down console in Shipping is gated by the compile define `ALLOW_CONSOLE`, which in Shipping resolves to `ALLOW_CONSOLE_IN_SHIPPING` (`Core/Public/Misc/Build.h`).
- `ALLOW_CONSOLE_IN_SHIPPING=1` is emitted only when the game `Target.cs` sets `bUseConsoleInShipping = true` (`UnrealBuildTool/Configuration/UEBuildTarget.cs`).
- `bUseConsoleInShipping` is marked `[RequiresUniqueBuildEnvironment]` (`TargetRules.cs`). So it forces `BuildEnvironment = TargetBuildEnvironment.Unique`.
- On an **installed** engine the precompiled Shipping engine libraries were built with the console OFF, so a unique environment must **recompile a large chunk of the engine** from the installed source on the first Shipping package — a much longer build. (`bOverrideBuildEnvironment` lets it *link* but does not help, because the precompiled Engine module still has the console compiled out.)
- And it needs a persistent `Target.cs` to set the flag — which a **Blueprint-only project** (auto-generated target in `Intermediate/Source`) does not have, so you must convert it to a real `Source/` game module (see `bp-only-with-code-plugin-still-needs-build-flag.md` / `bp-only-packaging-needs-source-module.md`).

Net cost for a BP-only project on a Launcher engine: a project-build restructure **plus** an engine-module recompile.

## The cheaper path for Ludeo Player Flow

The usual reason to want the console in Shipping is to start **Player Flow** (the `Play`-a-Ludeo command). The Ludeo integration already supports a **launch argument** for this — the session subsystem parses `-LudeoID=<id>` from the command line itself (custom `FParse`, independent of the console), and the cloud launcher passes the Ludeo context anyway. So:

- **Local Shipping test:** add `-LudeoID=<id>` to the launch (e.g. in the cloud `run.bat` or the shortcut). No console, no rebuild.
- **Cloud:** LudeoCast supplies the Ludeo context at launch.

Reserve the full console-in-Shipping route for when you genuinely need arbitrary console commands in a Shipping build and have accepted the unique-environment recompile (and, ideally, a source-built engine).

## How to apply

When an integrator asks to "enable the console in the Shipping build," first ask **why**. If it's to trigger Player Flow, point them at `-LudeoID=`. Only take on `bUseConsoleInShipping=true` (Source module + unique env + engine recompile) if arbitrary Shipping console access is a hard requirement.
