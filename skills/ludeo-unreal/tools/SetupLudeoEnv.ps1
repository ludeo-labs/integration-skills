# ============================================================
#  Ludeo SDK Environment Variables (Interactive)
#  Run this in your PowerShell terminal before launching the game.
#  Usage:
#    . .\SetupLudeoEnv.ps1          - set env vars interactively (note the dot-source!)
#    . .\SetupLudeoEnv.ps1 check    - verify env vars are set
# ============================================================

param([string]$Action)

if ($Action -eq "check") {
    Write-Host ""
    Write-Host "=== Ludeo Environment Check ==="
    $allOk = $true

    if ([string]::IsNullOrEmpty($env:LUDEO_API_KEY)) {
        Write-Host "  [MISSING] LUDEO_API_KEY" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "  [OK]      LUDEO_API_KEY=$($env:LUDEO_API_KEY.Substring(0,8))..." -ForegroundColor Green  # gitleaks:allow (prints masked env value, no secret here)
    }

    if ([string]::IsNullOrEmpty($env:STEAM_AUTH_ID)) {
        Write-Host "  [MISSING] STEAM_AUTH_ID" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "  [OK]      STEAM_AUTH_ID=$env:STEAM_AUTH_ID" -ForegroundColor Green
    }

    if (-not [string]::IsNullOrEmpty($env:LUDEO_STEAM_BETA_BRANCH)) {
        Write-Host "  [OK]      LUDEO_STEAM_BETA_BRANCH=$env:LUDEO_STEAM_BETA_BRANCH" -ForegroundColor Green
    } else {
        Write-Host "  [--]      LUDEO_STEAM_BETA_BRANCH not set (will use config default)" -ForegroundColor DarkGray
    }

    if (-not [string]::IsNullOrEmpty($env:LUDEO_PLATFORM_URL)) {
        Write-Host "  [OK]      LUDEO_PLATFORM_URL=$env:LUDEO_PLATFORM_URL" -ForegroundColor Green
    } else {
        Write-Host "  [--]      LUDEO_PLATFORM_URL not set (will use production default)" -ForegroundColor DarkGray
    }

    Write-Host ""
    if ($allOk) {
        Write-Host "All required variables are set. You can launch the game from this terminal." -ForegroundColor Green
    } else {
        Write-Host "Some required variables are missing. Run: . .\SetupLudeoEnv.ps1" -ForegroundColor Yellow
    }
    return
}

Write-Host ""
Write-Host "=== Ludeo SDK Environment Setup ==="
Write-Host ""

$env:LUDEO_API_KEY = Read-Host "Enter your Ludeo API key (from Ludeo Studio Labs)"
$env:STEAM_AUTH_ID = Read-Host "Enter your Steam ID (find at https://steamid.io)"
$branch = Read-Host "Steam beta branch name (press Enter to use config default)"
if (-not [string]::IsNullOrEmpty($branch)) {
    $env:LUDEO_STEAM_BETA_BRANCH = $branch
}
$url = Read-Host "Platform URL (press Enter for production default)"
if (-not [string]::IsNullOrEmpty($url)) {
    $env:LUDEO_PLATFORM_URL = $url
}

# Run check automatically after setup
& $PSCommandPath check
