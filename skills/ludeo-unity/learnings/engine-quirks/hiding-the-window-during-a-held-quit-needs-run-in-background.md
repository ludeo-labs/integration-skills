---
category: engine-quirks
tier: generalizable
sourceGame: RoomActionSample
phase: "3,7"
question: "Does the integration hold the quit (Application.wantsToQuit returning false while the run ends and the SDK finishes uploading) and hide or minimize the window meanwhile? Then Application.runInBackground must be true first."
sanitized: true
---

# Hiding the window during a held quit needs `Application.runInBackground = true`

Exit looked broken: after the click the game stayed on screen for ~15 s. The quit was held (our `wantsToQuit`
returned false) while the run's last attribute upload finished on a slow network, then the plugin ran its own
`DeInit` and issued a second `Application.Quit` a frame later. Waiting is right — that upload is what keeps the
capture — so the fix was to hide and mute the window at the first quit request and let the SDK finish out of sight.

The first version hung forever instead: a hidden window counts as unfocused, and with **Run In Background** off Unity
stops the frame loop. The plugin's second `Application.Quit` (issued from a frame) never ran; the process sat hidden
with the SDK already shut down (`Shutdown finished`, then `isWantsToQuit: False`, then nothing).

```csharp
void HideForQuit()
{
    Application.runInBackground = true;   // before hiding: the plugin's follow-up quit needs frames
    // mute the game's audio, then hide the window (Windows: ShowWindow(MainWindowHandle, SW_HIDE))
}
```

Verify in the log that the process reaches the input-system shutdown lines after `isWantsToQuit: True`, and that no
game process is left running afterwards.
