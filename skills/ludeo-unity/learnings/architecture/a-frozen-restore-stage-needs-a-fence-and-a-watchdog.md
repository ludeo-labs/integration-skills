---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does your restore freeze the world and then wait for asynchronous work inside a coroutine, with the same coroutine owning the unfreeze and the 'restore applied' notification? Then one exception anywhere in it is a permanent freeze the player cannot escape - fence the nested enumerator, wrap the whole handshake in a finally, and add a real-time watchdog."
sanitized: true
---

# The frozen restore stage needs a fence, a finally, and a watchdog

The shape this is about is the recommended one: apply the moment frozen, wait frozen for the asset
loads, settle, re-freeze, then tell the SDK the restore is applied (see
[[wait-for-the-restores-async-work-frozen]]). It has a failure mode that is easy to miss and
maximally bad when it happens.

**One coroutine owns three things**: the freeze, the unfreeze, and the notification that releases the
player. If anything inside it throws, Unity logs the exception and drops the coroutine — so none of
the code after the throw runs. The world stays frozen, the SDK is never told, and because the
controller's begin gate requires "restore applied" before it will act on `RoomReady`, the platform's
Play click is refused for the rest of the process. The viewer sees a still world whose character
still turns to their input, no overlay, no menu, no way out. `Update` keeps running at a zero time
scale, which is exactly what makes it look like something other than a crash.

It took a cloud session to find, because the throw needed a profile state no developer machine had.

## Three defences, and each covers what the others cannot

**1. Drive the nested enumerator by hand.** `yield return innerCoroutine` hands the inner enumerator
to the engine's scheduler, and an exception out of *its* `MoveNext` kills the whole chain. The usual
comment next to such code says a coroutine cannot be wrapped in try/catch because C# forbids
`yield return` inside a try-with-catch. True, and irrelevant: nothing stops you wrapping the
`MoveNext` call and yielding outside the try.

```csharp
IEnumerator stage = InnerStage(ctx);
while (true) {
    object current;
    try {
        if (!stage.MoveNext()) break;
        current = stage.Current;
    } catch (Exception e) {
        ReportAndKeepGoing(ctx, e);   // do NOT rethrow
        break;
    }
    yield return current;             // outside the try - this is what makes it legal
}
```

**2. Wrap the whole handshake in `try { … } finally { … }`.** A `finally` in an iterator runs while
the exception propagates out of `MoveNext`, so it is the backstop for everything the per-stage catch
does not see. It may not yield, so it does only the non-yielding hand-over: unfreeze, release input,
notify. Guard it with a "did the normal path already finish?" flag, and set that flag **after** the
notify returns — the notify is not a leaf, it typically releases the begin gate and runs the
hand-over inline.

**3. Add a real-time watchdog, because a `finally` cannot catch a hang.** Work that waits forever
throws nothing. Budget it against the platform's own load timeout, not a guess, and on expiry finish
degraded through the same hand-over. Name the last stage reached in the message: "it stopped
awaiting the loadout" sends the reader somewhere, "the restore failed" does not.

## Two traps when proving it

Fault injection is the only way to test this on demand, and it is easy to write a test that passes
for the wrong reason. Both of these happened:

- **Injecting by iteration count.** "Throw on the 3rd `MoveNext`" never fired, because the stage took
  exactly two: one to its first `yield return`, one for everything after it. The run passed and
  proved nothing. Count the steps first, or inject on a condition that cannot silently not-happen.
- **Injecting inside a guard you also added.** The tail-throw test landed inside the `try/catch`
  around the self-check, so the inner wrapper absorbed it and the `finally` never ran — while the
  verdict still said "passed". Put the injection where only the defence under test can save it, and
  **read the log lines, not the verdict**.

Report honestly on the degraded path: the moment is incomplete, and the log should say which part is
missing. And do not reuse a "reset the run clock" failure handler from the synchronous stage — by the
time the loadout is running, the clock's dependants are already applied, so zeroing it creates the
very inconsistency that handler exists to prevent.
