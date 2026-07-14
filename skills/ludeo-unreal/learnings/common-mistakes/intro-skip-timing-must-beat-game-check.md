---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "Does the game have an intro/cinematic sequence that checks a skip flag during map load?"
sanitized: true
---

# Intro skip must be set BEFORE the game's intro system checks it

## Problem

Setting `bIsSkipIntroSequence` in the component's `BeginPlay` was too late — the game's `ServerCheckSkipIntroSequence` ran 3 times at the same frame with `bIsIntroSequenceSkipped: 0` BEFORE our code set it to 1.

## Fix

Move the intro skip to the subsystem's `OnGameStateSet` — this fires before the component attaches and before the game's intro system processes. Set the skip flag on both the PlayerState and the MissionState via reflection.

## How to Apply

Any intro/cinematic skip flag must be set at the earliest possible point — `OnGameStateSet` or `OnWorldInitialized`, not in the component's `BeginPlay`.
