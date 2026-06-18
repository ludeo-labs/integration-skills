@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM  Ludeo BP Inspector — UE Editor Python script runner
REM
REM  Invokes bp_inspector.py inside UE Editor (headless commandlet).
REM  Auto-detects UE_ROOT and project path. Supports UE 4.26+.
REM
REM  Usage:
REM    RunBPInspector.bat inspect
REM    RunBPInspector.bat set-savegame /Game/Characters/BP_Char Health true
REM
REM  Manual override (if auto-detection fails):
REM    set UE_ROOT=C:\Program Files\Epic Games\UE_5.7
REM    RunBPInspector.bat inspect
REM ============================================================

REM --- Locate .uproject by walking up from the script's directory ---
set SEARCH_DIR=%~dp0
set PROJECT_FILE=
:search_uproject
for %%F in ("%SEARCH_DIR%*.uproject") do (
    if not defined PROJECT_FILE set PROJECT_FILE=%%F
)
if defined PROJECT_FILE goto found_uproject
for %%D in ("%SEARCH_DIR:~0,-1%\..") do set PARENT_DIR=%%~fD\
if /i "%PARENT_DIR%"=="%SEARCH_DIR%" goto no_uproject
set SEARCH_DIR=%PARENT_DIR%
if "%SEARCH_DIR:~3%"=="" goto no_uproject
goto search_uproject

:no_uproject
echo ERROR: No .uproject file found walking up from %~dp0
echo Place this script in the game repo (root or .ludeo\tools\).
pause
exit /b 1

:found_uproject
for %%F in ("%PROJECT_FILE%") do set PROJECT_DIR=%%~dpF

REM --- Detect UE_ROOT from .uproject EngineAssociation ---
if not defined UE_ROOT (
    set UE_VERSION=
    for /f "usebackq tokens=2 delims=:," %%A in (`findstr /C:"EngineAssociation" "%PROJECT_FILE%"`) do (
        set RAW=%%A
        set RAW=!RAW:"=!
        set RAW=!RAW: =!
        set RAW=!RAW:{=!
        set RAW=!RAW:}=!
        if not defined UE_VERSION set UE_VERSION=!RAW!
    )

    if defined UE_VERSION (
        REM Try standard Epic Games install location
        if exist "C:\Program Files\Epic Games\UE_!UE_VERSION!\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" (
            set UE_ROOT=C:\Program Files\Epic Games\UE_!UE_VERSION!
        )
        if not defined UE_ROOT (
            if exist "C:\Program Files\Epic Games\UE_!UE_VERSION!\Engine\Binaries\Win64\UE4Editor-Cmd.exe" (
                set UE_ROOT=C:\Program Files\Epic Games\UE_!UE_VERSION!
            )
        )
    )
)

if not defined UE_ROOT (
    echo ERROR: Could not auto-detect UE_ROOT.
    echo EngineAssociation from .uproject: !UE_VERSION!
    echo.
    echo Set UE_ROOT manually before running:
    echo   set UE_ROOT=C:\Program Files\Epic Games\UE_5.x
    echo   %~nx0 inspect
    pause
    exit /b 1
)

REM --- Detect editor binary (UE5 vs UE4 naming) ---
set EDITOR_CMD=
if exist "%UE_ROOT%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" (
    set EDITOR_CMD=%UE_ROOT%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe
) else if exist "%UE_ROOT%\Engine\Binaries\Win64\UE4Editor-Cmd.exe" (
    set EDITOR_CMD=%UE_ROOT%\Engine\Binaries\Win64\UE4Editor-Cmd.exe
) else (
    echo ERROR: Could not find UnrealEditor-Cmd.exe or UE4Editor-Cmd.exe in %UE_ROOT%
    pause
    exit /b 1
)

REM --- Locate bp_inspector.py relative to this batch file ---
set SCRIPT_PATH=%~dp0bp_inspector.py
if not exist "%SCRIPT_PATH%" (
    echo ERROR: bp_inspector.py not found at %SCRIPT_PATH%
    echo Ensure bp_inspector.py is in the same directory as this batch file.
    pause
    exit /b 1
)

REM --- Check Python Editor Script Plugin is enabled ---
findstr /I /C:"PythonScriptPlugin" "%PROJECT_FILE%" >nul 2>&1
if errorlevel 1 (
    findstr /I /C:"PythonEditorScriptPlugin" "%PROJECT_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo NOTE: Python Editor Script Plugin not found in .uproject.
        echo If the script produces no output, enable it:
        echo   Add to .uproject Plugins: {"Name": "PythonScriptPlugin", "Enabled": true}
        echo Proceeding anyway -- the plugin may be enabled at engine level.
        echo.
    )
)

REM --- Check for arguments ---
if "%~1"=="" (
    echo Usage:
    echo   %~nx0 inspect
    echo   %~nx0 set-savegame /Game/Path/BP_Name VarName true^|false
    echo.
    echo Engine: %UE_ROOT%
    echo Project: %PROJECT_FILE%
    pause
    exit /b 1
)

REM --- Build argument string for Python script ---
set PYTHON_ARGS=
:build_args
if "%~1"=="" goto run
set PYTHON_ARGS=!PYTHON_ARGS! -PythonArg="%~1"
shift
goto build_args

:run
echo ============================================
echo  Ludeo BP Inspector
echo ============================================
echo.
echo Engine:  %UE_ROOT%
echo Editor:  %EDITOR_CMD%
echo Project: %PROJECT_FILE%
echo Script:  %SCRIPT_PATH%
echo Args:   %PYTHON_ARGS%
echo.
echo Starting UE Editor (headless)... This may take 30-60 seconds.
echo.

REM -nullrhi alone doesn't silence Slate's "Had to block on waiting for a draw buffer"
REM warning spam in some engine configs (observed on UE4 source build: ~17k/sec, >1GB
REM log in minutes). -LogCmds="LogSlate off" suppresses the entire category.
"%EDITOR_CMD%" "%PROJECT_FILE%" -ExecutePythonScript="%SCRIPT_PATH%" %PYTHON_ARGS% -stdout -unattended -nopause -nullrhi -LogCmds="LogSlate off"

set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% NEQ 0 (
    echo.
    echo BP Inspector exited with code %EXIT_CODE%
)

exit /b %EXIT_CODE%
