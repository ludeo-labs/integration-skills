---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 3,6
question: "Is a pause menu (or any stretch where the simulation freezes) emitting ONLY the pause/resume pair? Then Creator Lab still lets a creator trim the moment's start point into that stretch. Check the two trigger types' behaviour table in the Non-Gameplay Handling doc before choosing."
sanitized: true
---

# The pause and non-Ludeoable triggers split by FLOW, not by severity — a real pause needs both

**Corrects part of [[classify-non-ludeoable-by-whether-the-sim-actually-freezes]]**, which describes the
pause pair as *"local capture hygiene, no backend mapping"* and sends a sim-freezing menu to the pause
pair only. The freeze discriminator in that learning is still right for **whether the clock must stop**; it
is not a way to decide whether a stretch may be used as a moment's start point.

## What happened

The in-game pause menu was classified by the rule above: it freezes the sim, so it emitted only the
pause/resume pair. The Global Trigger mapping was correct, the actions were sent at both ends (proven in
the log). A creator could still drag the moment's start point into the menu stretch in Creator Lab — the
moment began on a paused menu.

## The docs, read in full

The Non-Gameplay Handling page has a behaviour table:

| | Non-Ludeoable Area trigger | Pause/Resume trigger |
|---|---|---|
| Prevents Ludeo creation | Yes | Yes |
| Pauses timers and tracking | No | **Yes** |
| Data saved by backend | **Yes** | **No** |

and says of pause/resume: *"Think of it as the Player Flow equivalent of the Non-Ludeoable Area trigger
for Creator Flow."* So:

- **Non-Ludeoable Area** is the **Creator-flow** instrument: it blocks the stretch as a start point and the
  backend keeps its data.
- **Pause/Resume** is the **Player-flow** instrument: it stops the Ludeo clock during playback, and the
  backend keeps nothing for that stretch.

## The rule

- A stretch where the player has no control but the sim runs (cutscene, dialogue, camera pan) → the
  **non-Ludeoable** pair.
- A stretch where the sim **freezes** (pause menu, and the SDK's own overlay pause in Player Flow) → **both**
  pairs, nested: open pause then non-Ludeoable, close in reverse order. Close both on every End/Abort path.
- Emitting both from one polled state machine keeps it one edit:

```csharp
void Open(Span s)  { if (s == Span.Paused) { Emit(PAUSE); Emit(START_NON_LUDEOABLE); }
                     else if (s == Span.NonLudeoable) Emit(START_NON_LUDEOABLE); }
void Close(Span s) { if (s == Span.Paused) { Emit(STOP_NON_LUDEOABLE); Emit(RESUME); }
                     else if (s == Span.NonLudeoable) Emit(STOP_NON_LUDEOABLE); }
```

**Verify in Creator Lab**, not only in the log: record a clip containing a pause, publish, and try to drag
the start handle into the paused stretch — it must refuse.
