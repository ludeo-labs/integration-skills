@echo off
setlocal EnableDelayedExpansion
rem ============================================================================
rem RunKismetDump.bat — run the LudeoDumpKismet commandlet headlessly.
rem
rem Dumps disassembled Blueprint bytecode + bound-event + variable inventories
rem for every map (or a filtered subset) to <ProjectSaved>/LudeoKismet/.
rem
rem Usage (run from anywhere; project auto-detected from script location or
rem pass explicitly):
rem   RunKismetDump.bat [ProjectFile.uproject] [-Maps=Sub1,Sub2] [-Classes=Sub1] [-OutDir=path]
rem
rem Requires: LudeoKismetDump plugin installed in <Project>/Plugins/ and
rem enabled, plus a built Development editor target.
rem
rem Engine detection order:
rem   1. UE_ROOT environment variable
rem   2. ..\Engine relative to the project dir (source-build layout)
rem ============================================================================

set PROJECT=%~1
set EXTRA_ARGS=%2 %3 %4 %5 %6

rem --- Find the .uproject ---
if "%PROJECT%"=="" (
    for %%F in ("%CD%\*.uproject") do set PROJECT=%%~fF
)
if "%PROJECT%"=="" (
    echo [RunKismetDump] No .uproject given and none found in current directory.
    echo Usage: RunKismetDump.bat ^[ProjectFile.uproject^] ^[-Maps=...^] ^[-Classes=...^]
    exit /b 1
)
for %%F in ("%PROJECT%") do set PROJECT_DIR=%%~dpF

rem --- Find the engine ---
set ENGINE_ROOT=%UE_ROOT%
if "%ENGINE_ROOT%"=="" (
    if exist "%PROJECT_DIR%..\Engine\Binaries\Win64" set ENGINE_ROOT=%PROJECT_DIR%..\Engine
)
if "%ENGINE_ROOT%"=="" (
    echo [RunKismetDump] Engine not found. Set UE_ROOT or use a source-build layout ^(^<root^>\Engine next to the project^).
    exit /b 1
)

rem --- Pick the editor-cmd binary (UE4 vs UE5 name) ---
set EDITOR_CMD=
if exist "%ENGINE_ROOT%\Binaries\Win64\UE4Editor-Cmd.exe" set EDITOR_CMD=%ENGINE_ROOT%\Binaries\Win64\UE4Editor-Cmd.exe
if exist "%ENGINE_ROOT%\Binaries\Win64\UnrealEditor-Cmd.exe" set EDITOR_CMD=%ENGINE_ROOT%\Binaries\Win64\UnrealEditor-Cmd.exe
if "%EDITOR_CMD%"=="" (
    echo [RunKismetDump] No UE4Editor-Cmd.exe or UnrealEditor-Cmd.exe under %ENGINE_ROOT%\Binaries\Win64
    exit /b 1
)

echo [RunKismetDump] Project: %PROJECT%
echo [RunKismetDump] Editor:  %EDITOR_CMD%
echo [RunKismetDump] Args:    %EXTRA_ARGS%

"%EDITOR_CMD%" "%PROJECT%" -run=LudeoDumpKismet %EXTRA_ARGS% -unattended -nopause -nosplash -nullrhi -log
set RESULT=%ERRORLEVEL%

echo [RunKismetDump] Exit code %RESULT%. Output under ^<ProjectSaved^>\LudeoKismet\
exit /b %RESULT%
