---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: "When a runtime SDK signal (OnRoomReady, etc.) fails to fire but all the lifecycle CALLS succeed, and a known-good reference integration exists for THIS game or engine — have you diffed your flow against it BEFORE theorizing about SDK versions or backend config?"
sanitized: true
---

# When a runtime signal is missing, diff against the known-good reference sample FIRST

## What happened (Lyra, Phase 2)

Creator-flow recording didn't work: activation/consent/OpenRoom/AddPlayer all succeeded, but
`OnRoomReady` never fired, so `BeginGameplay` never ran. The agent spent a long sequence chasing the
wrong layers, in this order:

1. Theorized the overlay `failed to parse gameplays.gameplay-ready` warning was the cause (it was a
   red herring — a known-good run shows the same warning).
2. Swapped the whole LudeoUESDK plugin to another version to rule out the SDK (negative — identical).
3. Theorized a Studio-Labs / backend game-config problem (the integrator, a platform engineer,
   rejected this outright).

Only then did diffing against the **official reference integration for the same game**
(`ludeosdk-lyra-sample`, same `LudeoSessionSubsystem`+`LudeoGameStateComponent` architecture) reveal
the actual one-line-class root cause in ~2 reads: the sample opens the Creator room at component
`BeginPlay` (level load); this integration delayed `OpenRoom` until the gameplay phase, and the
platform's Creator-flow `RoomReady` never arrives for a late-opened room. See
[[open-creator-room-at-level-load-not-on-phase]].

## The rule

When an SDK **runtime signal fails to fire but every preceding SDK CALL returns success**, the bug is
almost always a sequencing/timing difference in YOUR integration — and the fastest oracle is a
**known-good reference integration**, ideally for the same game/engine. Diff against it BEFORE:
- swapping SDK versions,
- theorizing backend / Studio-Labs config,
- attributing it to overlay warnings or platform connectivity.

Reference integrations available to diff against (architecture is shared across them):
`ludeosdk-lyra-sample`, plus prior completed integrations (FPSGameStarterKit, VoyagerV2, TacticsGame).
A 30-minute reference diff would have replaced hours of SDK-swap + backend theorizing.

## "Build from scratch, don't lean on the sample" is an IMPLEMENTATION rule, not a DIAGNOSIS rule

An integrator may ask you to write the integration from scratch (to exercise the process) rather than
copy the sample. Honor that for *authoring* code. But when something is broken at runtime, the
reference sample is the ground-truth **diagnostic** oracle — reading it to find a divergence is not
"leaning on it," it's debugging. Don't let a from-scratch directive stop you from diffing against the
known-good flow when a signal won't fire.

## Cross-references

- [[open-creator-room-at-level-load-not-on-phase]] — the specific root cause this incident found.
- [[dont-bypass-sdk-when-your-lifecycle-is-broken]] — same family: a missing SDK signal means YOUR
  lifecycle/sequencing is off, not the SDK.
- [[never-force-begin-without-onroomready]] — don't paper over the missing signal; fix the cause.
- [[always-check-reference-sample-first]] — the Phase-1 classification analogue of this rule.
