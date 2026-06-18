# Ludeo Tracked Data Reference

All data reported to the Ludeo SDK during gameplay. Keep this document in sync when adding or changing tracking.

---

## Actions (via SendAction)

| Action Name | Trigger | Player-Bound | Source |
| --- | --- | --- | --- |
| Kill | Elimination message — killer is tracked player | Yes | `OnEliminationMessage` |
| Death | Elimination message — victim is tracked player | Yes | `OnEliminationMessage` |
| _(damage type tags)_ | All `GameplayEffect.DamageType.*` tags from the kill context are sent as separate actions (e.g., `GameplayEffect.DamageType.Melee`, `GameplayEffect.DamageType.Weapon.RailGun`) — sent alongside Kill | Yes | `OnEliminationMessage` |
| WeaponPickup | QuickBar slots changed (debounced 1s, suppressed if <2 filled slots or within 1s of spawn) | Yes | `OnInventoryChanged` |
| HealthPickup | Health increased between ticks (outside 1s respawn window) | Yes | `UpdateWritableObjects` |
| Assist | Player assisted a kill | Yes | `OnAssistMessage` |
| Grenade | Player activates grenade ability (`Ability.Type.Action.Grenade` tag) | Yes | `OnAbilityActivated` |
| Dash | Player activates dash ability (`Ability.Type.Action.Dash` tag) | Yes | `OnAbilityActivated` |
| DoubleKill | 2 eliminations within 4.5s (`ElimChainProcessor`) | Yes | `OnAccoladeMessage` |
| TripleKill | 3 eliminations within 4.5s | Yes | `OnAccoladeMessage` |
| QuadKill | 4 eliminations within 4.5s | Yes | `OnAccoladeMessage` |
| PentaKill | 5 eliminations within 4.5s | Yes | `OnAccoladeMessage` |
| KillStreak5 | 5 eliminations without dying (`ElimStreakProcessor`) | Yes | `OnAccoladeMessage` |
| KillStreak10 | 10 eliminations without dying | Yes | `OnAccoladeMessage` |
| KillStreak15 | 15 eliminations without dying | Yes | `OnAccoladeMessage` |
| KillStreak20 | 20 eliminations without dying | Yes | `OnAccoladeMessage` |
| PauseLudeo | Game paused (Player Flow) | Yes | `TickComponent` pause detection |
| ResumeLudeo | Game unpaused (Player Flow) | Yes | `TickComponent` pause detection |
| StartNoneLudeable | Game paused (Creator Flow) | Yes | `TickComponent` pause detection |
| StopNoneLudeable | Game unpaused (Creator Flow) | Yes | `TickComponent` pause detection |
| Resume | Sent before EndGameplay if game was paused | Yes | `EndGameplay` |

---

## State Objects (via FLudeoWritableObject)

### GameMetadata (ObjectType: `"GameMetadata"`) — written once, used for map loading in Player Flow

| Attribute | Type | Update Freq | Source |
| --- | --- | --- | --- |
| MapName | FString | Once | `GetWorld()->GetMapName()` |
| ExperienceAsset | FString | Once | Experience primary asset ID |
| BotCount | int32 | Once | Number of bots in the match — passed as `?NumBots=N` in Player Flow travel URL |

### Player (ObjectType: `"Player"`, bound to player) — runtime state, updated ~10Hz

| Attribute | Type | Update Freq | Source |
| --- | --- | --- | --- |
| MatchTime | float | ~10Hz | `GetWorld()->GetTimeSeconds()` |
| Position | FVector | ~10Hz | `Pawn->GetActorLocation()` |
| Rotation | FRotator | ~10Hz | `Pawn->GetActorRotation()` |
| ControlRotation | FRotator | ~10Hz | `Controller->GetControlRotation()` — aim/camera direction |
| Health | float | ~10Hz | `ULyraHealthComponent::GetHealth()` |
| MaxHealth | float | ~10Hz | `ULyraHealthComponent::GetMaxHealth()` |
| Score | int32 | ~10Hz | Kill count from elimination listener |
| TeamID | int32 | ~10Hz | `ALyraPlayerState::GetTeamId()` |
| ActiveWeaponSlot | int32 | ~10Hz | `QuickBar->GetActiveSlotIndex()` |
| WeaponSlotCount | int32 | ~10Hz | `QuickBar->GetSlots().Num()` (total slots, not occupied) |
| WeaponSlot_N | FString | ~10Hz | `ItemDefClass->GetPathName()` per slot (empty if unoccupied) |
| CurrentWeaponClass | FString | ~10Hz | Active weapon `ItemDefClass->GetPathName()` |

### Bot (ObjectType: `"Bot"`, one per bot, keyed by bot name via `TMap<FString, FLudeoWritableObject>`) — runtime state, updated ~10Hz

| Attribute | Type | Update Freq | Source |
| --- | --- | --- | --- |
| BotName | FString | ~10Hz | `PlayerState->GetPlayerName()` |
| Position | FVector | ~10Hz | `Pawn->GetActorLocation()` |
| Rotation | FRotator | ~10Hz | `Pawn->GetActorRotation()` |
| ControlRotation | FRotator | ~10Hz | `Controller->GetControlRotation()` — bot aim direction |
| TeamID | int32 | ~10Hz | `ALyraPlayerState::GetTeamId()` |
| Health | float | ~10Hz | `ULyraHealthComponent::GetHealth()` |
| MaxHealth | float | ~10Hz | `ULyraHealthComponent::GetMaxHealth()` |
| ActiveWeaponSlot | int32 | ~10Hz | `QuickBar->GetActiveSlotIndex()` |
| WeaponSlotCount | int32 | ~10Hz | `QuickBar->GetSlots().Num()` |
| WeaponSlot_N | FString | ~10Hz | `ItemDefClass->GetPathName()` per slot (empty if unoccupied) |
| FocusTarget | FString | ~10Hz | `AIController->GetFocusActor()->GetName()` — target name, empty if none |
| MoveStatus | int32 | ~10Hz | `AIController->GetMoveStatus()` (0=Idle, 1=Waiting, 2=Paused, 3=Moving) |
| PerceivedEnemies | int32 | ~10Hz | Hostile count from `AIPerceptionComponent->GetCurrentlyPerceivedActors()` filtered by `GetTeamAttitudeTowards()` |

---

## Player Flow Reconstruction

### Player State (`FLudeoPlayerInitialState`)

Read in `ULudeoSessionSubsystem::OnGetLudeo()`, applied in `ULudeoGameStateComponent::ApplyPlayerState()`:

| Attribute | How Applied |
| --- | --- |
| Position + Rotation | `Pawn->TeleportTo(Position, Rotation)` — after unpause |
| ControlRotation | `Controller->SetControlRotation()` — restores camera/aim direction |
| TeamID | `ALyraPlayerState::SetGenericTeamId()` |
| Health / MaxHealth | Deferred via `OnAbilitySystemInitialized_RegisterAndCall` + next-tick timer |
| Weapon loadout | Clear QuickBar, load defs from recorded paths, place in slots, set active slot |

### Bot State (`FLudeoBotInitialState`)

Read in `ULudeoSessionSubsystem::OnGetLudeo()`, applied in `ULudeoGameStateComponent::ApplyPlayerState()` (bot section). Matched by **index order** (first recorded → first spawned), not by name.

| Attribute | How Applied |
| --- | --- |
| Position + Rotation | `Pawn->TeleportTo(Position, Rotation)` |
| ControlRotation | `Controller->SetControlRotation()` |
| TeamID | `ALyraPlayerState::SetGenericTeamId()` |
| Weapon loadout | Clear QuickBar, load defs from recorded paths, place in slots, set active slot |
| FocusTarget | `AIController->SetFocus(Actor)` — found by name via `TActorIterator`; cleared if empty |
| Health / MaxHealth | Deferred via `OnAbilitySystemInitialized_RegisterAndCall` + next-tick timer (per-bot callback) |

---

## Notes

- **Bot objects** are writable objects only — bots are NOT added as Ludeo players via `AddPlayer()`. Identified by `PlayerState->IsABot()`.
- **Scoped guard constraint**: Bot writes must happen **outside** the player's `FScopedLudeoDataReadWriteEnterObjectGuard` scope. Player writes are wrapped in `{ }` braces so guards are destroyed before bot writes begin.
- **WeaponSlotCount** is the total number of QuickBar slots (typically 3), not the number of occupied slots.
- **HealthPickup** detection compares health between 0.1s update ticks, suppressed during post-respawn window (same 1s threshold as WeaponPickup spawn suppression).
- **Ability actions** (Grenade, Dash) filter by `Ability.Type.Action.Grenade` and `Ability.Type.Action.Dash` tags. Unrecognized activations are logged at Verbose level for future tag discovery.
- **AI observables**: `FocusTarget` is restored via `AIController->SetFocus()` during Player Flow. `MoveStatus` and `PerceivedEnemies` are read-only observations — stored in `FLudeoBotInitialState` but not directly settable (the bot AI rebuilds these from its behavior tree and perception system). See [Lyra_AI_Reference.md](Lyra_AI_Reference.md) for bot AI architecture details.
- **Bot identity matching**: Bots are matched by array index order during Player Flow. `BotCount` in GameMetadata ensures the same number of bots spawn via `?NumBots=N` travel URL parameter.
- **Accolade actions** (DoubleKill–PentaKill, KillStreak5–20) are detected by Lyra's built-in `UElimChainProcessor` (4.5s multi-kill window) and `UElimStreakProcessor` (consecutive kills without dying) in ShooterCore. Listeners use `PartialMatch` on parent tags to catch all child accolades. These processors are spawned automatically by the ShooterCore experience.
- **Pause/Resume actions** are detected via `GetWorld()->IsPaused()` state transitions in `TickComponent()` (enabled with `bTickEvenWhenPaused = true`). Different action names are used for Creator Flow (`StartNoneLudeable`/`StopNoneLudeable`) vs Player Flow (`PauseLudeo`/`ResumeLudeo`). Configure in Studio Labs > Ludeo Settings > Triggers: map trigger start/end events accordingly.
- **Damage type actions**: When the tracked player gets a kill, all `GameplayEffect.DamageType.*` tags from the elimination context are sent as individual actions. This captures weapon-specific and ability-specific kill types (e.g., Melee, Weapon.RailGun) without requiring explicit per-type handling.
- All handlers live in `ULudeoGameStateComponent` (`LudeoIntegration/.../Private/LudeoGameStateComponent.cpp`).
