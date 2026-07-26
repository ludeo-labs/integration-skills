---
category: architecture
tier: generalizable
sourceGame: FTPS_Online
phase: 3
question: "Does this flight/vehicle game use physics simulation (Simulate Physics on root component) or FloatingPawnMovement with manual position updates? Check the BP Inspector component list. If FloatingPawnMovement is present, do NOT plan for SetPhysicsLinearVelocity — track the game's own position/speed variables instead."
sanitized: true
---

# Flight games may use FloatingPawnMovement, not physics

## Precondition

Applies when the game involves flying vehicles/aircraft AND the entity's parent class is `Pawn` (not `Character` or a vehicle class).

## What happened

FTPS_Online is a plane dogfighting game. The Stage 1 TDD assumed physics-based flight and planned `SetPhysicsLinearVelocity` / `SetPhysicsAngularVelocity` for restoration.

The BP Inspector revealed:
- Root component: `DefaultSceneRoot` (SceneComponent) — NOT a physics body
- Movement: `FloatingPawnMovement` — arcade-style, NOT physics-driven
- Game manually replicates `ActorLocation` and `ActorRotation` as BP variables
- Speed controlled by `currentSpeed` / `targetSpeed` / `maxSpeed` BP variables

## Correct approach for FloatingPawnMovement games

**Write:** `ActorLocation`, `ActorRotation`, `currentSpeed`, `health`, `Team`
**Restore:** `SetActorLocationAndRotation()` + set BP variables via reflection
**Do NOT:** call `SetPhysicsLinearVelocity` or `SetPhysicsAngularVelocity`

## How to detect early

Run `RunBPInspector.bat inspect` and check components list for `FloatingPawnMovement`, `ProjectileMovementComponent`, `CharacterMovementComponent`, or physics body components.
