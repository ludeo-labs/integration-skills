---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Did you pick the apply-inside-onRoomReady placement AND drop your loading cover in Begin's callback — i.e. is anything the viewer is supposed to SEE before pressing Play gated on RoomReady?"
sanitized: true
---

# `RoomReady` is the press-Play signal, so applying there puts your loading cover behind the pre-play overlay

`07 §2.1` sanctions two apply placements — at scene-load, or inside `onRoomReady` — and says either
"honors §2.1". That is true of the *ordering* invariants, and it is why the `onRoomReady` one gets picked:
it is the compressed, obviously-correct-looking shape (`ApplyRestoredState(); BeginGameplay(cb → unfreeze);`)
and the ordering checklist passes on it.

What the two placements do **not** share is *when they happen in wall-clock time relative to the viewer*.

## The thing that is easy to not know

On the play flow, **`RoomReady` does not fire when the room is ready. It fires when the viewer presses Play
on the overlay.** The room chain completes, the overlay presents the Ludeo, and `RoomReady` is withheld
until the press.

The tell is in any restore log, and it is unmissable once you look for it:

```
14:36:0x  AddPlayer: Success.
                                  <-- ~13,500 log lines. This is a person reading an overlay.
14:36:2x  RoomReady.
```

If you have measured a multi-second `AddPlayer → RoomReady` gap and filed it as "SDK latency", it was not
latency. It was the viewer.

## Why that breaks the reveal specifically

The natural pairing is: raise a loading cover when the restore starts, drop it in `Begin`'s callback once
everything is restored and unfrozen. With the `onRoomReady` placement, **both the apply and the cover-drop
land after the press**, so the entire pre-play window renders the cover. If the cover is opaque — and a
restore cover must be, or the viewer sees the outgoing menu or a half-built level — the viewer stares at a
**flat black screen behind the overlay** and presses Play on nothing.

And `07 §2.1(5)` is not merely "never show a half-built scene". Read it exactly:

> the first frame **revealed behind the (paused) overlay** must be the finished restored scene

Two different frames get conflated here, and the bug lives in the gap:

| | |
|---|---|
| "the first frame after my cover drops" | satisfied by the `onRoomReady` placement |
| "the first frame revealed behind the overlay" | **not** satisfied — there is no reveal before the press at all |

The product experience is *look at the moment, then take control of it*. A restore that is perfectly correct
on frame 1 still fails if the viewer could not see frame 1 until after committing.

## The fix: apply at scene-assembly, reveal there, raise the leg last

Move the apply to the scene-loader's completion, and make the ordering inside that one hook explicit:

```csharp
public void OnRestoreSceneAssembled()          // called by the restore scene loader, after its extra frame
{
    ApplyRestoredState();                       // still FROZEN - CR-010, never unfreeze first
    Cover.Hide();                               // THE REVEAL - the finished restored scene
    controller.NotifySceneReadyForRestore();    // leg 3 - now genuinely means "apply done, frozen-ready"
}
```

Then `RoomReady` becomes the *resume* point only: `BeginGameplay(cb → unfreeze; release controls)`.

Three details that make this hold up rather than just move the bug:

1. **Reveal BEFORE raising the leg.** Raising the scene-ready leg can satisfy the begin gate and fire
   `Begin` synchronously — if the cover is still up at that instant, the reveal is skipped entirely and you
   are back where you started, intermittently.
2. **Keep a guarded re-call of the apply at `RoomReady`.** Make the apply single-fire (a flag re-armed per
   restore, so replay-to-replay still applies) and call it from the `RoomReady` path too. Apply-before-Begin
   is the one ordering error that silently *corrupts data* — `BeginGameplay` starts SDK recording, so
   Begin-before-apply records the **default** state as the new playthrough's opening. A no-op call is cheap
   insurance that no future route can break it.
3. **The last write in the apply order is now the last thing before the viewer sees the scene.** Anything
   that settles after it — an async spawn, a deferred re-assert, a camera blend — is a **visible pop**, not
   a log detail. If a wave makes the apply async or adds a post-`Start` re-assert, that settle goes
   *between* the apply and the reveal, not after the leg.

## Where else this reasoning applies

Any decision that reads as "ordering-equivalent, pick either" but where one branch is gated on a
**human action** rather than on machine readiness. The ordering checklist cannot see the difference; only
asking *"what is on screen, and who is waiting for whom?"* can.

> **`RoomReady` on the play flow is a person's click, not a state transition. Anything the viewer must see
> in order to decide to click cannot be gated on it.**
