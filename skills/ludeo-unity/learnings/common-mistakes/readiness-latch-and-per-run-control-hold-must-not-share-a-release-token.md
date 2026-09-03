---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "Does your readiness gate use ONE release token for both 'SDK readiness resolved' (once per app run) and 'the player may have control now' (once per gameplay run) - and can readiness resolve AFTER a level has already started?"
sanitized: true
---

# The app-run readiness latch and the per-run control hold are two gates — give them separate release tokens

[[readiness-gate-cover-gate-the-grant-of-control-not-the-fade]] warns that a gate can silently sit off
the real path. This is the same class of failure from the opposite direction: the gate is on the path, it
*holds* correctly, and then something else releases it early.

Two distinct things get called "the gate":

| | Readiness latch | Control hold |
| --- | --- | --- |
| Scope | **once per app run** | **once per gameplay run** (every level entry, every restore) |
| Means | "Activate resolved and consent decided" | "the player does not have control yet" |
| Released by | the Activate/consent callbacks, or a bounded timeout | `Begin`'s **callback**, a capture-declined signal, or a bounded watchdog |

The plan can state that distinction perfectly and the implementation still collapse it, because the
natural place to write "readiness resolved" is the `onInitDone(startingInLudeo: false)` handler — and the
obvious body for that handler is *"release the gate, hide the cover"*. If the hold is keyed by a single
token, that line releases **the run's** hold too.

## Why it hides in review and shows up in the log

It is invisible whenever readiness resolves **before** a level starts — the whole menu-gated flow, which
is what you exercise when clicking through the game. It fires whenever readiness resolves **after**, and
there is one path where that is guaranteed: **Editor direct-play on a level scene**, where there is no
menu to absorb the `Activate` + consent round-trip. That is also the path the integrator uses dozens of
times a day.

The symptom in the log is an ordering, not an error:

```
Controls gate HELD (Readiness)
Readiness hold has lasted 2s - covering the level
Activate: Success
Consent: canCreate=True canPlay=True
SDK readiness resolved
Controls gate released (Readiness)      <-- player has control HERE
Opening creator room -> OpenRoom: Success -> AddPlayer: Success -> RoomReady
BeginGameplay: Success - capture is live  <-- capture starts several frames LATER
```

Nothing fails. A capture is produced. The opening seconds of every run simply are not in it.

**Log the release with its reason and the Begin success on separate lines** — that ordering *is* the
test, and it is the only cheap way to see this. A gate that prints "held" and later "released" without
naming the reason cannot be audited this way.

## The fix

`onInitDone(false)` must not touch the run's hold at all:

```csharp
public void OnInitDone(bool startingInLudeo)
{
    if (startingInLudeo) { cover.Show(); return; }     // play path: hold the pre-gameplay screen
    // Creator path: readiness resolved. The run's hold belongs to the RUN.
    if (!controlsGate.IsHeld) cover.Hide();
}
```

Then confirm every release path for the run's hold still exists, or you have traded an early release for
a hang:

- **`Begin`'s success callback** — the normal release, and the only one that makes "first controlled
  frame == first captured frame" true;
- **capture-declined** — consent off, or the room chain returned a failure: hand control back immediately
  and play uncaptured;
- **a bounded watchdog** — releases anyway after N seconds, so an offline player is never stuck.

Same reasoning applies to whatever "capture is live" gates your per-frame work. A controller that sets
`isGameplayActive = true` when `BeginGameplay` is *issued* (the reference shape) is fine for attribute
sampling, but anything that **sends** — non-ludeoable span actions, gameplay actions — must wait for
`Begin`'s **callback**, or it emits before capture exists. Keep a separate `captureLive` flag set in that
callback and cleared on every teardown path.
