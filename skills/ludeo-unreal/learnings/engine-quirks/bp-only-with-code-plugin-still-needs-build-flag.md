---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 3
question: "Does the packaging command pass -build -target=<Game>? A BP-only project that has a C++ plugin (every Ludeo integration does) STILL needs the game target compiled — a 'no Source/ dir => skip -build' heuristic produces a package with no/stale game binary and fails on configs with no pre-built binary (e.g. Shipping)."
sanitized: true
---

# A BP-only project with a C++ plugin STILL needs -build -target at package time

## Precondition

The project has no `Source/` game module but DOES contain a C++ code plugin (the Ludeo integration plugin is one — so this applies to every BP-only Ludeo integration), and UBT auto-generates the game `.Target.cs` (the CommonUI / ModularGameplay "treated as a code project" case — see `bp-only-project-ubt-auto-targets.md`).

## The trap

A homegrown packaging script decided whether to pass `-build` by testing for a `Source\*.Target.cs`:

```bat
REM WRONG premise: "BP-only project must not pass -build"
if exist "%PROJECT_DIR%Source\*.Target.cs" (set EXTRA=-build -target=Game) else (set EXTRA=)
RunUAT BuildCookRun -clientconfig=%CONFIG% -cook -stage -pak %EXTRA% ...
```

No `Source/` dir → no `-build`. But the C++ **plugin** must still be compiled into the game binary, and the auto-generated game target builds it. With `-build` omitted, `BuildCookRun` cooks + stages but **never compiles a game binary**:

- **Development** *appears* to work — only because an earlier explicit `-build` left a Development binary on disk that staging silently reuses (so the package is whatever was last built — often stale; cross-ref `stale-package-masquerades-as-missing-feature.md`).
- **Shipping** (or any config with no pre-built binary) hard-fails at the stage step:
  `Stage Failed. Missing receipt '<Game>-Win64-Shipping.target'. Check that this target has been built.` (UAT `ExitCode=103 Error_MissingExecutable`).

## The rule

Pass `-build` **whenever the project contains any C++ that links into the game binary — a `Source/` module OR a code plugin.** Detect the plugin, don't just test for `Source/`:

```bat
set HAS_CODE=0
if exist "%PROJECT_DIR%Source\*.Target.cs" set HAS_CODE=1
if exist "%PROJECT_DIR%Plugins\<IntegrationPlugin>\Source\*" set HAS_CODE=1
if %HAS_CODE%==1 set EXTRA=-build -target=<Game>
```

For a BP-only project the game target name is just `<Game>` (the UBT auto-generated primary game target), so `-build -target=<Game>` is correct and proven (`BuildCookRun -build -target=<Game>` = SUCCESS; the plugin links via the auto-generated module in `Intermediate/Source/`).

## How to apply

- The skill's `BuildAndPackage.bat` (`.ludeo/tools/`) already always passes `-build` — prefer it over a project-local script that guesses.
- If the integrator has their own packaging script, check it passes `-build -target=<Game>`; the "no Source ⇒ no build" shortcut is the common mistake.
- Symptom decoder: a `Missing receipt '<Game>-Win64-<Config>.target'` / `Error_MissingExecutable` at the stage step almost always means the build step was skipped or built a different config.

## Related

- `bp-only-project-ubt-auto-targets.md` — when to create `Source/` vs rely on auto-generated targets (the prerequisite to this).
- `bp-only-packaging-needs-source-module.md` — the no-auto-target case (must hand-author the module).
- `stale-package-masquerades-as-missing-feature.md` — the Development half (omitting `-build` reuses a stale binary instead of failing loudly).
