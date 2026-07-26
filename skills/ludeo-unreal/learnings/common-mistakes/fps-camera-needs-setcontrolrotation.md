---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "Is this an FPS or TPS game where the camera direction is controlled by the player controller?"
sanitized: true
---

# SetActorTransform doesn't set FPS camera direction — need SetControlRotation

## Problem

`Pawn->SetActorTransform()` sets the actor's world transform but does NOT update the player controller's view rotation. In FPS games, the camera direction is controlled by `APlayerController::ControlRotation`, not the pawn's rotation. The player spawns facing the wrong direction.

## Fix

After setting the pawn transform, also set the controller rotation:

```cpp
if (AController* Ctrl = Pawn->GetController())
{
    Ctrl->SetControlRotation(Xform.GetRotation().Rotator());
}
```

Only needed for the player entity, not AI (AI controllers handle their own rotation).
