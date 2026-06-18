---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 5
question: null
sanitized: true
---

# Bot-on-bot events should NOT be reported as player actions

## The Mistake

During FTPS_Online Stage 4, ALL Kill/Death actions used `LocalPlayerID` — including bot-on-bot kills. The SDK docs say "use the same playerId when reporting actions that you used when adding the player to the room." This was interpreted as "every action uses the human's PlayerID."

But that's wrong for kill/death. When Bot A kills Bot B, that's NOT a player action — it's a world event. Reporting it as the player's Kill inflates the player's score and creates false achievements.

## The correct approach

Only report Kill/Death when the human player is directly involved:
- **Player kills a bot** → report Kill for LocalPlayerID
- **Bot kills the player** → report Death for LocalPlayerID  
- **Bot kills another bot** → do NOT report (or report as a separate "BotKill" action if needed for scoring)
- **Player dies from environment** → report Death for LocalPlayerID

The check: compare the instigator and victim against the human player's pawn.

```cpp
bool bPlayerIsVictim = (DamagedActor == LocalPlayerPawn);
bool bPlayerIsInstigator = (InstigatorPawn == LocalPlayerPawn);

if (bPlayerIsVictim)
    ReportAction(LocalPlayerID, "Death");
if (bPlayerIsInstigator)
    ReportAction(LocalPlayerID, "Kill");
// Bot-on-bot: don't report
```

## Why the SDK docs are misleading

The SDK docs say "use the same playerId" — this means don't invent new playerIds. It does NOT mean attribute every world event to the human player. Actions should only be reported when the human player is a participant in the event.
