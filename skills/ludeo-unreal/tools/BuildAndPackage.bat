@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM  Ludeo Cloud Build Package Script (self-detecting)
REM
REM  Packages a UE game for Ludeo cloud builds using BuildCookRun.
REM  Can live in the game repo root (next to the .uproject) or
REM  in .ludeo\tools\ -- the script walks up to find the .uproject.
REM  No manual configuration required -- detects engine path,
REM  project name, and target automatically.
REM
REM  Usage:
REM    BuildAndPackage.bat                     (Development config)
REM    BuildAndPackage.bat --config Shipping   (Shipping config)
REM    BuildAndPackage.bat --clean             (clean artifacts first)
REM    BuildAndPackage.bat --nopause           (CI/agent mode: never block on pause)
REM
REM  Manual override (if auto-detection fails):
REM    set UE_ROOT=C:\Program Files\Epic Games\UE_5.7
REM    set TARGET_NAME=MyGame
REM    BuildAndPackage.bat
REM ============================================================

REM --- Parse arguments first (so --nopause guards every exit path) ---
set CONFIG=Development
set DO_CLEAN=0
set NOPAUSE=0
:parse_args
if "%~1"=="" goto done_args
if /i "%~1"=="--config" (set CONFIG=%~2& shift & shift & goto parse_args)
if /i "%~1"=="--clean" (set DO_CLEAN=1& shift & goto parse_args)
if /i "%~1"=="--nopause" (set NOPAUSE=1& shift & goto parse_args)
echo Unknown argument: %~1
shift
goto parse_args
:done_args

REM --- Locate .uproject by walking up from the script's directory ---
REM Works whether this script is in the repo root, .ludeo\tools\, or elsewhere.
set SEARCH_DIR=%~dp0
set PROJECT_FILE=
:search_uproject
for %%F in ("%SEARCH_DIR%*.uproject") do (
    if not defined PROJECT_FILE set PROJECT_FILE=%%F
)
if defined PROJECT_FILE goto found_uproject
REM Walk up one directory
for %%D in ("%SEARCH_DIR:~0,-1%\..") do set PARENT_DIR=%%~fD\
if /i "%PARENT_DIR%"=="%SEARCH_DIR%" goto no_uproject
set SEARCH_DIR=%PARENT_DIR%
REM Stop at drive root (e.g., C:\)
if "%SEARCH_DIR:~3%"=="" goto no_uproject
goto search_uproject

:no_uproject
echo ERROR: No .uproject file found walking up from %~dp0
echo Place this script in the game repo (root or .ludeo\tools\).
if %NOPAUSE%==0 pause
exit /b 1

:found_uproject
REM Derive PROJECT_DIR from the .uproject location
for %%F in ("%PROJECT_FILE%") do set PROJECT_DIR=%%~dpF

REM --- Derive GameName from .uproject filename ---
for %%F in ("%PROJECT_FILE%") do set GAME_NAME=%%~nF

REM --- Detect TARGET_NAME from Source\*.Target.cs (prefer non-Editor target) ---
if not defined TARGET_NAME (
    for %%F in ("%PROJECT_DIR%Source\*.Target.cs") do (
        set FNAME=%%~nF
        REM Strip ".Target" suffix
        set FNAME=!FNAME:.Target=!
        REM Skip Editor/Server targets for packaging
        echo !FNAME! | findstr /I /R "Editor$ Server$" >nul
        if errorlevel 1 (
            if not defined TARGET_NAME set TARGET_NAME=!FNAME!
        )
    )
)
    REM A Ludeo-integrated Blueprint-only project has NO Source\*.Target.cs, but the
    REM LudeoIntegration C++ plugin still makes it a code project. UBT auto-generates the
    REM game target named <GameName>, so the GAME_NAME fallback below is the correct target.
    REM (We always pass -build — see the BuildCookRun call — because the plugin must compile in.)
if not defined TARGET_NAME (
    REM Fallback: use GameName
    set TARGET_NAME=%GAME_NAME%
)

REM --- Detect UE_ROOT from .uproject EngineAssociation + LauncherInstalled.dat ---
if not defined UE_ROOT (
    REM Extract EngineAssociation version from .uproject
    set UE_VERSION=
    for /f "usebackq tokens=2 delims=:," %%A in (`findstr /C:"EngineAssociation" "%PROJECT_FILE%"`) do (
        set RAW=%%A
        REM Strip quotes, spaces, braces
        set RAW=!RAW:"=!
        set RAW=!RAW: =!
        set RAW=!RAW:{=!
        set RAW=!RAW:}=!
        if not defined UE_VERSION set UE_VERSION=!RAW!
    )

    if defined UE_VERSION (
        REM Try standard Epic Games install location
        if exist "C:\Program Files\Epic Games\UE_!UE_VERSION!\Engine\Build\BatchFiles\RunUAT.bat" (
            set UE_ROOT=C:\Program Files\Epic Games\UE_!UE_VERSION!
        )
    )
)

if not defined UE_ROOT (
    echo ERROR: Could not auto-detect UE_ROOT.
    echo EngineAssociation from .uproject: !UE_VERSION!
    echo.
    echo Set UE_ROOT manually before running:
    echo   set UE_ROOT=C:\Program Files\Epic Games\UE_5.x
    echo   %~nx0
    echo.
    echo Or if using a source-built engine, set UE_ROOT to the engine root directory.
    if %NOPAUSE%==0 pause
    exit /b 1
)

set OUTPUT_DIR=%PROJECT_DIR%PackagedBuild

if %DO_CLEAN%==1 (
    echo Cleaning build artifacts...
    if exist "%OUTPUT_DIR%" rmdir /S /Q "%OUTPUT_DIR%"
    if exist "%PROJECT_DIR%Intermediate" rmdir /S /Q "%PROJECT_DIR%Intermediate"
    if exist "%PROJECT_DIR%Saved\StagedBuilds" rmdir /S /Q "%PROJECT_DIR%Saved\StagedBuilds"
    echo Clean complete.
    echo.
)

echo ============================================
echo  %GAME_NAME% + Ludeo SDK -- Cloud Build Package
echo ============================================
echo.
echo Engine:  %UE_ROOT%
echo Project: %PROJECT_FILE%
echo Target:  %TARGET_NAME%
echo Config:  %CONFIG%
echo Output:  %OUTPUT_DIR%
echo.

if not exist "%UE_ROOT%\Engine\Build\BatchFiles\RunUAT.bat" (
    echo ERROR: RunUAT.bat not found at %UE_ROOT%
    echo Verify UE is installed at that location.
    if %NOPAUSE%==0 pause
    exit /b 1
)

echo Starting BuildCookRun...
echo This will take 30-60 minutes.
echo.

call "%UE_ROOT%\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun ^
    -project="%PROJECT_FILE%" ^
    -noP4 ^
    -platform=Win64 ^
    -clientconfig=%CONFIG% ^
    -cook ^
    -build ^
    -stage ^
    -pak ^
    -package ^
    -archive ^
    -archivedirectory="%OUTPUT_DIR%" ^
    -target=%TARGET_NAME% ^
    -utf8output ^
    -compressed ^
    -prereqs ^
    -nodebuginfo

REM --- Success gate: staged output existence, NOT %ERRORLEVEL% ---
REM On some UE 5.x versions a successful RunUAT ("ExitCode=0 (Success)") is followed
REM by a stray "'0' is not recognized..." shell error that corrupts %ERRORLEVEL%,
REM so gating on it falsely reports failure and skips the run.bat emission below.
REM The reliable signal is the staged bootstrap exe existing in the archive.
if not exist "%OUTPUT_DIR%\Windows\%GAME_NAME%.exe" (
    echo.
    echo ============================================
    echo  BUILD FAILED -- staged build not found at:
    echo    %OUTPUT_DIR%\Windows\%GAME_NAME%.exe
    echo  Check the BuildCookRun log above for errors.
    echo  ^(A "Missing receipt <Game>-Win64-<Config>.target" error means the
    echo   build step was skipped or targeted the wrong config.^)
    echo ============================================
    if %NOPAUSE%==0 pause
    exit /b 1
)

echo.
echo ============================================
echo  BUILD SUCCEEDED
echo ============================================
echo.
echo Output: %OUTPUT_DIR%\Windows
echo.
REM --- Emit the LudeoCast cloud-launch run.bat at the archived build root ---
set ARCHIVE_WIN=%OUTPUT_DIR%\Windows
if /i "%CONFIG%"=="Shipping" (
    set EXE_NAME=%GAME_NAME%-Win64-Shipping.exe
) else if /i "%CONFIG%"=="Test" (
    set EXE_NAME=%GAME_NAME%-Win64-Test.exe
) else (
    set EXE_NAME=%GAME_NAME%.exe
)
if exist "%~dp0run.bat.template" (
    powershell -NoProfile -Command "(Get-Content -Raw '%~dp0run.bat.template') -replace '__GAME__','%GAME_NAME%' -replace '__EXE__','%EXE_NAME%' | Set-Content -NoNewline -Encoding ASCII '%ARCHIVE_WIN%\run.bat'"
    echo Emitted cloud launch script: %ARCHIVE_WIN%\run.bat  ^(set this as executableLaunchPath when submitting^)
) else (
    echo NOTE: run.bat.template not found next to this script; cloud run.bat NOT emitted.
)
echo.
echo Next steps:
echo   1. Verify locally: %OUTPUT_DIR%\Windows\%TARGET_NAME%.exe -log
echo   2. Upload to Ludeo cloud build storage (see Stage 7 guidance)
echo   3. Set run.bat as executableLaunchPath when submitting the build to LudeoCast
echo.
if %NOPAUSE%==0 pause
