<#
  Runs one Development build of the game for the agent's play loop (references/agent-play-loop.md).
  capture: waits for -AfterLine (default: the dev hook's "[Ludeo][dev] entered"), leaves the game alone
           -PlaySeconds, presses the overlay's capture key, waits for the clip's upload.
  replay:  waits for -AfterLine (the layer's line once the restore is applied and the game waits for
           Play), presses the overlay's Play key, lets it run -PlaySeconds.
  Either way it saves the game window's picture (<exe folder>\capture.png or replay.png) for the agent to
  check, stops at the first -FailPattern match, then closes the game the way a player does.
  Keys go to the game window's message queue: the user's keyboard, mouse and focus are untouched.
  Run with: powershell -NoProfile -ExecutionPolicy Bypass -File play-game.ps1 -Exe ... -Log ... -Mode ...
#>
param(
  [Parameter(Mandatory)][string]$Exe,
  [Parameter(Mandatory)][string]$Log,   # the player's default Player.log: a -logFile capture can stop after start-up
  [Parameter(Mandatory)][ValidateSet('capture', 'replay')][string]$Mode,
  [string]$AfterLine = '[Ludeo][dev] entered',   # replay: pass the layer's line once the restore waits for Play
  [int]$PlaySeconds = 90,   # the clip holds about the last 60 s before the press: it must start mid-run, not at Begin
  [string]$FailPattern = 'continuing without Ludeo|InvalidAuth',   # regex; the run stops at the first match
  [int]$TimeoutSec = 300,   # per wait
  [int]$Monitor = 0   # 1-based; default: the second screen when there is one, away from the user's work
)
Add-Type -AssemblyName System.Drawing
Add-Type 'using System; using System.Runtime.InteropServices; public static class W {
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public struct RECT { public int L, T, R, B; } }'
if ($Mode -eq 'replay' -and -not $PSBoundParameters.ContainsKey('AfterLine')) { "replay needs -AfterLine: the layer's line once the restore waits for Play"; exit 2 }
[void][W]::SetProcessDPIAware()   # else a scaled display reports the window smaller and the picture is cropped
if ($Mode -eq 'replay' -and -not $PSBoundParameters.ContainsKey('PlaySeconds')) { $PlaySeconds = 15 }

$name = [IO.Path]::GetFileNameWithoutExtension($Exe)
if (Get-Process $name -ErrorAction SilentlyContinue) { 'a game process is already running: not starting'; exit 3 }
Move-Item -LiteralPath $Log "$Log.prev" -Force -ErrorAction SilentlyContinue   # an old run's lines would match at once
$gameArgs = @('-screen-fullscreen', '0', '-screen-width', '1280', '-screen-height', '720')
Add-Type -AssemblyName System.Windows.Forms
if (-not $PSBoundParameters.ContainsKey('Monitor') -and [Windows.Forms.Screen]::AllScreens.Count -gt 1) { $Monitor = 2 }
if ($Monitor -gt 0) { $gameArgs += @('-monitor', "$Monitor") }
$p = Start-Process $Exe -WorkingDirectory (Split-Path $Exe) -PassThru -ArgumentList $gameArgs

# Close the window like a player, so the game's own quit path ends the gameplay; force-kill only a hang.
function Stop-Game {
  if (-not $p.HasExited -and -not ($p.CloseMainWindow() -and $p.WaitForExit(30000))) {
    Stop-Process -Id $p.Id -Force; Write-Host 'force-killed: the game did not quit within 30 s of its window closing'
  }
}

function Wait-Line([string]$text) {
  $end = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $end -and -not $p.HasExited) {
    $fail = Select-String -LiteralPath $Log -Pattern $FailPattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($fail) { Write-Host "FAIL LINE: $($fail.Line)"; Stop-Game; Write-Host "stopped: $Mode, log $Log"; exit 4 }
    $hit = Select-String -LiteralPath $Log -SimpleMatch $text -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($hit) { return $hit.Line }
    Start-Sleep 1
  }
  Write-Host "TIMEOUT or exit while waiting for: $text"   # Write-Host, so the caller still gets $null
  $null
}

# The overlay logs its keys: "bindings rebuilt (Confirm='SPACE', ... HighlightCapture='F9' ...)".
# They change per environment and SDK version, so never hard-code them.
function Press([string]$binding) {
  $line = Wait-Line 'bindings rebuilt'
  if (-not $line) { return }
  if ($line -notmatch "$binding='([^']+)'") { "no $binding key in the log"; return }
  $key = $Matches[1]
  $vk = if ($key -match '^F(\d+)$') { 0x6F + [int]$Matches[1] } elseif ($key -eq 'SPACE') { 0x20 } else { -1 }
  if ($vk -lt 0) { "key '$key' is a chord this script can't send: ask the user to press it"; return }
  $p.Refresh(); $h = $p.MainWindowHandle
  if ($h -eq [IntPtr]::Zero) { 'no game window (MainWindowHandle is 0): no desktop session?'; return }
  [void][W]::PostMessage($h, 0x100, [IntPtr]$vk, [IntPtr]1)            # WM_KEYDOWN
  Start-Sleep -Milliseconds 100
  [void][W]::PostMessage($h, 0x101, [IntPtr]$vk, [IntPtr]0xC0000001)   # WM_KEYUP
  "pressed $binding ($key)"
}

# The window's picture, read even when other windows cover it: the logs can't say what's on screen.
function Shot {
  $p.Refresh(); $h = $p.MainWindowHandle
  if ($p.HasExited -or $h -eq [IntPtr]::Zero) { 'no game window to take a picture of'; return }
  $r = New-Object W+RECT; [void][W]::GetClientRect($h, [ref]$r)
  if ($r.R -le 0 -or $r.B -le 0) { 'the game window is minimized: no picture'; return }
  $bmp = New-Object Drawing.Bitmap $r.R, $r.B; $g = [Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc()
  [void][W]::PrintWindow($h, $dc, 3); $g.ReleaseHdc($dc); $g.Dispose()   # 3 = client area, GPU content included
  $lit = 0; for ($i = 0; $i -lt 200; $i++) { $c = $bmp.GetPixel((Get-Random $r.R), (Get-Random $r.B)); if ($c.R + $c.G + $c.B -gt 30) { $lit++ } }
  $file = Join-Path (Split-Path $Exe) "$Mode.png"; $bmp.Save($file); $bmp.Dispose()
  if ($lit) { "picture: $file" } else { "picture: $file is all black (a dark or loading screen, or a window this can't read)" }
}

if (Wait-Line $AfterLine) {
  if ($Mode -eq 'capture') {
    Start-Sleep $PlaySeconds
    Shot
    Press 'HighlightCapture'
    [void](Wait-Line 'Finished uploading video data')
  } else {
    Press 'Confirm'
    Start-Sleep 3; Shot; Start-Sleep ([Math]::Max(0, $PlaySeconds - 3))
  }
}
Stop-Game
"done: $Mode, log $Log"
