---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 4
question: null
sanitized: true
---

# Always check SDK-level logs ([Ludeo] prefix), not just game integration logs

Game integration logs (LogLudeoComponent, LogLudeoIntegration) only show what the integration code does. The SDK's own logs (prefixed with `[Ludeo]`) reveal errors that the integration code cannot detect — silent failures, rejected API calls, and configuration issues.

**Critical SDK log categories to grep for:**
- `[Ludeo] Data: Error:` — DataWriter/DataReader failures (e.g., BindPlayer without EnterObject)
- `[Ludeo] Core: Error:` — SDK-level errors (e.g., missing config endpoints)
- `[Ludeo] Session: Error:` — Session lifecycle failures
- `[Ludeo] Http:` — Backend communication (highlight uploads, attribute registration)

**Example:** The ActionRoguelike integration showed all game-level logs as successful (Room opened, Player added, BeginGameplay, SendAction success=1), but the SDK log revealed `DataWriter::setPlayerBinding failed` — an error invisible to the integration code.

**How to apply:** When debugging Ludeo integration issues, always run:
```
grep "[Ludeo].*Error\|[Ludeo].*Fail" <logfile>
```
Filter out `[Ludeo] Coherent: Warning:` lines (CSS parsing noise from the overlay UI).
