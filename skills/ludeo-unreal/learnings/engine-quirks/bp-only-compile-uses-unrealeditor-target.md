---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 3
question: "Is the project Blueprint-only (no Source/<Game>.Target.cs) but you need to compile a C++ plugin (the Ludeo plugin, or an editor tool plugin)? If so, compile the `UnrealEditor` target with -Project=, NOT a `<Game>Editor` target that doesn't exist."
sanitized: true
---

# Compiling a C++ plugin in a Blueprint-only project: use the `UnrealEditor` target

## Precondition

Blueprint-only project — there is **no `Source/<Game>.Target.cs`**, so the game
editor target (`<Game>Editor`) the standard compile guidance assumes does not exist.
You still need to compile C++ that lives in a **plugin** (the Ludeo integration
plugin, or an editor tool plugin).

## The problem

`learnings/engine-quirks/how-to-compile-ue-from-cli.md` and the Stage-2 "Option A"
build step both say to build `<Game>Editor`. In a BP-only project that target name
doesn't exist, so the build fails with "missing target". Agents then misread this as
a broken environment.

## The fix

Against an **installed (launcher) engine**, build the engine's `UnrealEditor` target
with the project supplied via `-Project=`. UBT compiles the project's code plugins
as modular DLLs into `<Project>/Plugins/<Plugin>/Binaries/…` without needing a game
target:

```
"<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe" ^
    UnrealEditor Win64 Development ^
    -Project="<abs-path>/<Game>.uproject" -WaitMutex -FromMsBuild
```

This is what builds a code plugin (or an editor-only introspection plugin) in a
content-only project. Result: `UnrealEditor-<PluginModule>.dll` under the plugin's
`Binaries/Win64/`.

## Note vs packaging

This is the **compile** path (editor target, dev iteration). It is distinct from
**packaging** a BP-only project with C++ plugins — see
`bp-only-needs-target-cs-for-packaging.md` and `bp-only-project-ubt-auto-targets.md`
for the Game-target/`Target.cs` rules (auto-generated when a plugin like CommonUI is
enabled; otherwise a minimal game module is required).
