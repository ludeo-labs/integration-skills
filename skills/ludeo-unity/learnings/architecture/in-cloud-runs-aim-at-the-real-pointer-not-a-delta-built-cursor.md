---
category: architecture
tier: generalizable
sourceGame: RoomActionSample
phase: "7"
question: "Does the game aim with a virtual cursor built by adding up mouse deltas (hidden, confined OS cursor), and will it be played through the cloud stream?"
sanitized: true
---

# In cloud runs, aim at the real pointer instead of a cursor built from mouse deltas

A cloud tester called the aiming "input lag". The game hid and confined the OS cursor and moved its own virtual
cursor by summing raw mouse deltas times a sensitivity; its aim raycast also ran only every other frame. Over a
stream, mouse input arrives batched and rescaled and the confined pointer hits the window edges, so the summed
cursor drifts away from where the viewer's pointer really is. The in-game sensitivity slider was out of reach, since
the pause menu is blocked for cloud players.

## Fix (cloud runs only, behind the cloud launch option the run command already passes)

1. Aim at the real pointer position. The game already had this mode for the Editor; a static flag switched it on.
2. Refresh the aim every frame.
3. Cap the frame rate at the stream's 60 fps, VSync off: frames above what the stream shows only cost encoder time.

Keep all three cloud-only. Locally the result feels less snappy (60 fps instead of 144, and the OS pointer's own
acceleration instead of raw deltas), so judge it on the cloud build, not the local one. The tester found the cloud
build played better.

## Generalization

Before the first cloud upload, find how the game turns the mouse into aim: absolute position, delta accumulation,
or a camera-relative stick. Delta accumulation into a hidden cursor is the case to switch over for streaming.
