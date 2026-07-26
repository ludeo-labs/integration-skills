---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 6
question: null
sanitized: true
---

# SendAction PlayerID must match the PlayerID used in AddPlayer — always

## The Mistake

During FTPS_Online Stage 4, the agent assigned per-bot PlayerIDs to `SendAction` calls (e.g., `PlayerID="Bot_A_0"`, `PlayerID="Bot_B_1"`). This was wrong — the SDK docs explicitly state:

> "Make sure to use the same playerId when reporting actions that you used when adding the player to the room."

Since only ONE player is added to the room (the human host), ALL actions must use that player's ID. Bot kills and deaths are game events within the human's gameplay session, not separate player sessions.

## Why It Happened

The agent wrote action reporting code by reasoning about "which entity performed the action" instead of reading the SDK docs first. The UE plugin reference (`TrackGameplay` page) shows:

```cpp
SendActionParameters.PlayerID = FString::FromInt(PlayerState->GetPlayerId());
```

This is always the human player's ID. The agent invented a pattern (per-entity PlayerIDs) that doesn't exist in any SDK documentation or prior integration.

## The Fix

```cpp
// CORRECT — all actions use the single player added to the room
ReportAction(LocalPlayerID, TEXT("Kill"));
ReportAction(LocalPlayerID, TEXT("Death"));
ReportAction(LocalPlayerID, TEXT("MissileFired"));

// WRONG — bot IDs were never added via AddPlayer
ReportAction("Bot_A_0", TEXT("Kill"));  // SDK ignores this or errors
```

## Prevention

1. **Before writing ANY SendAction code, read the SDK docs page on "Tracking Player Actions"** — specifically the `importantGame State vs Player Actions` callout.
2. **Check how many players are added to the room.** If only one (single-player or listen-server host), ALL actions use that one PlayerID. Multiple PlayerIDs in SendAction only make sense in multiplayer where each human player has been added via `AddPlayer`.
3. **The reference file `phase-04-significant-actions.md` §5.1 already says "Actions must fire in BOTH Creator and Player Flow"** — but it doesn't explicitly warn about PlayerID matching. This is a gap in the reference that the human should consider addressing.
