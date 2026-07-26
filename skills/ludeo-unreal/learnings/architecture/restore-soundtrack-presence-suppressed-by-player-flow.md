---
category: architecture
tier: generalizable
sourceGame: multiple
phase: 4
question: "Does the game start its background music / soundtrack from a scene-start / level-load hook (BeginPlay, a level-BP begin event, a music-manager auto-start) that Player Flow suppresses? If yes, restore must (re)start the captured track itself or the replay is silent."
sanitized: true
---

# Restore soundtrack PRESENCE explicitly — Player Flow suppression silences the replay

## Precondition

This applies when:
- The game starts its background music / soundtrack from a **scene-start / level-load hook** — `BeginPlay`, a level-BP "begin" event, or a music manager that auto-starts a track when the gameplay level loads.
- That same start path is (correctly) suppressed in Player Flow because it also runs
  fresh-load setup that would clobber restored state — i.e. it sits behind a `bIsPlayerFlow`
  guard, or downstream of one.
- Symptom: the restored replay is **silent** even though positions, entities, and gameplay
  state restore correctly. The classic "state restores but the music doesn't."

## Problem

The music trigger and the state-clobbering setup often share a hook. Guarding that hook in
Player Flow (the right call for the state) also takes the music with it — nothing ever calls
the game's `PlayTrack` / `UAudioComponent::Play` on the restored run, so the moment plays back
mute. A silent replay reads as broken to a viewer even when the gameplay is perfectly restored.

## Fix

Capture **which track is active** as environment state, and restart it idempotently on restore
instead of relying on the suppressed start hook:

```cpp
// Capture side (Creator Flow) — track presence is environment state
Obj.WriteData(LudeoAttr::ActiveMusicTrackId, MusicManager->GetActiveTrackId());

// Restore side (Player Flow) — restart the captured track from the environment restore step
int32 TrackId = 0;
Obj.ReadData(LudeoAttr::ActiveMusicTrackId, TrackId);
MusicManager->PlayTrack(TrackId);   // idempotent: no-op if already the active track
```

Where there is no music manager, the equivalent is a captured `USoundBase*` class-path restored
via `UGameplayStatics::SpawnSound2D` / a persistent `UAudioComponent`.

## Split the three concerns — don't conflate them

- **Presence** — *which* track is playing. Every game with a soundtrack; restore-required so the
  replay isn't silent. Restarting **from the top** is enough.
- **Position** — clock offset into the track (`StartTime`). Only matters for time-driven moments
  (a beat-synced sequence); otherwise skip it.
- **Intensity** — dynamic mixing / layered stems. A cosmetic polish layer; optional.

## How to apply

Player Flow restoration: find where the game kicks off its soundtrack (grep for the music
manager, `PlaySound2D`, a `UAudioComponent` on a persistent actor, a `BP` "play music" node at
level begin). If that path is suppressed in Player Flow, add an explicit track-presence
capture + idempotent restart in the **environment restore** step.

Presence is **not load-bearing** — it does not gate any other restored state — so it belongs to
a **later enrichment pass (Phase 7)**, never the Wave-1 / slice-restore spine. But do not drop it
because it is deferred: a silent replay is a visible fidelity gap.

## Related learnings

- `suppress-engine-vo-via-dialog-manager-mute.md` — the inverse concern: narrowly *silence* VO/dialog in Player Flow. This one ensures the *soundtrack* is not silenced by the same suppression.
- `prefer-narrow-mute-over-killing-trigger-event.md` — why broad suppression takes more than you intended (music included).
