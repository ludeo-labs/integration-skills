---
category: engine-quirks
tier: generalizable
sourceGame: SurvivalSample
phase: "1,3,5"
question: "Are you starting play mode in whatever scene happens to be open (a menu, a gameplay map) rather than the game's scene-0 boot scene? Check for singletons the boot flow normally owns — a second EventSystem, audio manager, or input module — because a duplicate can emit a per-frame warning that grows the log without bound."
sanitized: true
---

# Entering play mode outside the boot scene can flood the log and take the Editor down

Starting play mode in an already-open menu scene, instead of the project's scene-0 boot scene,
duplicated a UI singleton the boot flow normally owns. Unity's UGUI then emitted this **every
frame, with a full managed stack trace each time**:

```
There are 2 event systems in the scene. Please ensure there is always exactly one event system
  → UnityEngine.EventSystems.EventSystem:Update()   (stock UGUI, emitted from Update)
```

Measured on a large HDRP project: ~16,700 occurrences inside a single log tail sample, the count
climbing to "3 event systems" as more UI loaded, and `Editor-prev.log` at **377 MB**. Stack-trace
extraction per frame plus the log writes froze the Editor; it had to be killed. Twice.

Nothing about this is Ludeo-specific — but it lands squarely on Ludeo work, because phases 3 and 5
want repeatable play-mode runs and the tempting shortcut is "just press play wherever we are".

## Three rules, all cheap

1. **Always enter through the game's own boot scene** (scene 0 in Build Settings), and let the game
   reach the menu or level the way it does for a player. This is the same principle as
   [[boot-the-replay-through-the-games-own-entry-flow]] and
   [[jumping-straight-into-a-level-skips-setup-the-restore-needs]], arriving from a third direction:
   there, the shortcut breaks the *restore*; here it breaks the *Editor*.

2. **Give every automated run a log circuit breaker.** Count normalized messages via
   `Application.logMessageReceived`; abort the run when any single message passes a threshold
   (200 is generous) or total volume passes a ceiling. **Normalize digits out of the key** —
   `There are # event systems in the scene` — or a message whose count is *in the text* reads as a
   different message every time and never trips. Verify the breaker fires before trusting it
   ([[a-guard-that-cannot-fire-is-not-evidence]]); a spam guard that silently never trips is worse
   than none, because it reads as proof of a quiet run.

3. **Never log from inside the log handler.** Obvious in hindsight, unbounded in practice.

## Diagnosing it after the fact

The Editor log survives the crash as `Editor-prev.log` next to `Editor.log`. Do not read it whole —
a flooded one is hundreds of MB:

```bash
tail -200000 "$LOCALAPPDATA/Unity/Editor/Editor-prev.log" | sort | uniq -c | sort -rn | head -12
```

The top line names the flood, and its stack frame names the emitter. A graceful-looking tail
(`Input System module state changed to: Shutdown`, `Cleanup mono`, a memory-leak report) means the
process was killed after the freeze, not that it exited cleanly — do not read it as a clean run.
