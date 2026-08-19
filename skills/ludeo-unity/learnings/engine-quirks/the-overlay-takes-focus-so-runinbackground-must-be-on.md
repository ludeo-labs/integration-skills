---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: "1,7"
question: "Check Player Settings for runInBackground, and check what fullscreen mode the game actually uses. With runInBackground off, the Ludeo overlay taking focus PAUSES the whole game mid-capture; with exclusive fullscreen, Windows minimizes the game whenever focus moves."
sanitized: true
---

# The overlay takes focus — so runInBackground off means the overlay pauses your capture

Two Player Settings decide whether a Ludeo build survives its own overlay, and both were wrong by
default here. The symptom was reported as "the game minimizes and stops" and read like an SDK bug.

**`runInBackground = 0`.** Unity pauses the entire game on focus loss. The Ludeo overlay taking
focus therefore stops the game *and the capture* mid-run — and so does alt-tabbing to read the log,
which quietly invalidates any run you were watching that way. Set it to `1`.

**Exclusive fullscreen.** The game's own "fullscreen" setting mapped to
`FullScreenMode.ExclusiveFullScreen`, which Windows minimizes whenever the window loses focus: alt-tab,
a second monitor, or the overlay taking focus all drop the game to the taskbar. `FullScreenWindow`
(borderless) looks identical and stays up.

Both are worth raising with the studio rather than silently flipping: `runInBackground` is
project-wide and changes normal builds too. The call here was that it is still correct — a replay
pausing because the overlay took focus is worse than a game that keeps running unfocused — but it is
the studio's setting, so flag it.

## Do not fix it with a runtime resize

The first attempt set borderless by calling the game's screen-mode setter during boot. That produced
a *new* bug: the overlay's timer, objective and counter panels drew as misplaced white rectangles
over the game, only on the direct-boot path.

The overlay creates its own render texture early. Changing the screen mode mid-boot resizes the
backbuffer **after** that texture exists, and the overlay does not re-derive it. Prefer the
project-level setting (`fullscreenMode` in Player Settings, plus whatever preference the game
persists) so no runtime resize happens at all.

Stated limit, kept honestly in the commit: there were no graphics errors in the log to prove this
one — the resize was the only rendering-relevant difference between the working and broken paths.
When a fix rests on elimination rather than evidence, say so and name what to try next (here: the
fast level load racing the overlay's camera setup).
