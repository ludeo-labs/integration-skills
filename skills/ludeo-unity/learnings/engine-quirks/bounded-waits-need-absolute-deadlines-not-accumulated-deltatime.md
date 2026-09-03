---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "Is any readiness/Begin timeout implemented as a coroutine accumulating Time.unscaledDeltaTime, or armed at scene activation to cover both the Activate/consent wait AND the room chain?"
sanitized: true
---

# The readiness gate's bounded waits: use **absolute deadlines**, one per wait, and make a fallthrough stick

The readiness gate needs bounded waits — an unbounded one leaves an offline player behind the cover with
no way to move. Three things about *how* you bound them turn out to matter, and all three failed in one
run at the phase-3 compile+run gate.

## 1. `Time.unscaledDeltaTime` accumulation inherits time that passed before the timer was armed

```csharp
// ✗ the timer fires early, sometimes drastically
float elapsed = 0f;
while (elapsed < timeoutSeconds) { elapsed += Time.unscaledDeltaTime; yield return null; }
```

Arm this from `SceneManager.sceneLoaded` and the coroutine's first `yield return null` resumes on the
first `Update` after the scene finished loading — and **that frame's `unscaledDeltaTime` spans the entire
scene load**. (Unlike `Time.deltaTime`, `unscaledDeltaTime` is not clamped by `Time.maximumDeltaTime`.) On
a large level in the Editor that is several seconds of "elapsed" credited before the timer existed. The
observed symptom was an 8-second timeout expiring roughly a second after it was armed.

```csharp
// ✓ cannot double-count
m_deadline = Time.realtimeSinceStartup + timeoutSeconds;   // arm
// in Update: if (m_deadline > 0f && Time.realtimeSinceStartup >= m_deadline) { m_deadline = 0f; Expire(); }
```

Checking deadlines in `Update` also removes a second fragility: a coroutine started from
`[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]`, before any scene exists, is a poor place for a
bootstrap timer. A deadline field costs nothing and survives everything.

## 2. One timeout must not bound two unrelated waits

Between a gameplay scene activating and `Begin` landing there are **two** independent waits:

| Wait | Typical | Bounded from |
| --- | --- | --- |
| `Activate` + first `ConsentUpdated` | **seconds** — measured 3–7 s on one project | bootstrap |
| `OpenRoom → AddPlayer → RoomReady → Begin` | well under a second | the moment `OpenRoom` is issued |

Arming a single "Begin didn't land" timer at scene activation lets the *first* wait consume the *second*
one's budget. A completely healthy session then trips the timeout — and the failure is worse than a plain
timeout, because everything afterwards still succeeds: control is handed back, the log announces the run
is uncaptured, and then `Begin` lands anyway and capture starts **mid-run**.

Arm the readiness deadline at bootstrap and the Begin deadline from an explicit "room chain started"
signal raised where `OpenRoom` is called. Then each bound reflects one thing, and the Begin bound can stay
tight without punishing a slow `Activate`.

## 3. A declared fallthrough must be FINAL

Once a bounded wait expires and control is handed back, the run must **stay** uncaptured. Otherwise a late
callback starts capture after the player has been playing — a Ludeo that begins in the middle of the
action, which is worse than no Ludeo, and it makes the log a liar.

Give the run a `captureDeclinedThisRun` latch, set it on every fallthrough path, and check it **in the
begin gate itself**, not only where the room is opened:

```csharp
void TryBeginAfterRoomReady()
{
    if (m_captureDeclinedThisRun) { /* log once */ return; }
    ...
}
```

Clear the latch when a new run starts, and close any room that was opened but never begun, so the next
run does not stack on it.

## Sizing the readiness bound

Measure it, don't guess: read the SDK's own timestamped log lines for the `Activate` async call and the
`ConsentUpdated` broadcast, across several runs. On one project that was 3.1 s / 3.9 s / 6.7 s — so an
8-second bound was close enough to normal to misfire, and 15 s was the honest floor. The cost of a
generous bound is only paid on the developer's direct-into-a-level path; the shipped menu flow resolves
consent long before a level loads.
