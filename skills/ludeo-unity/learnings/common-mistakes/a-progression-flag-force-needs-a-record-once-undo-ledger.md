---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Are you forcing a PERSISTED progression flag (PlayerPrefs / a save key) before the restore's scene load, to suppress an intro or tutorial that HOLDS PLAYER CONTROL — and can that pre-load hook be re-entered by replay-to-replay?"
sanitized: true
---

# Forcing a persisted progression flag before the restore load needs a record-once undo ledger — a one-line SetInt writes the *viewer's* progression, permanently

The `07 §10` suppression census turns up two shapes: state-clobbering mechanisms (which the apply can
simply out-order) and **flow-blocking** ones — an intro cutscene, a first-run tutorial, a "welcome back"
sequence — that hold player control without touching any restored value. When one of those is gated by a
**persisted** flag rather than by a scene object, the fix is not a code gate, it is a **write to the flag**,
and its deadline is **before `SceneManager.LoadSceneAsync`**: the consumer reads it from the `Start()`/
`Awake()` of the very scene the restore is loading. That means it belongs in the selection-time
`onBeginRestore` hook, above the load call — never in `ApplyRestoredState()`, which is frames too late.

That much is usually spotted during planning. What is not spotted is that the one-line version is wrong in
four separate ways.

## 1. The flag is the *viewer's* data, not the Ludeo's

`PlayerPrefs` and the save file belong to the person watching. Forcing an intro counter past its maximum
and leaving it there tells their game they have already watched the intro of a level they may never have
played. A restore is allowed to *borrow* the viewer's progression for the length of a replay; it is not
allowed to keep it. So every force is **recorded and handed back**.

## 2. Record ONCE, or replay-to-replay eats the original

This is the trap, and it is invisible in a single-replay smoke test.

`onBeginRestore` is a **per-restore** hook, and the re-entrant `HandleGetLudeoDone` path (`07 §2.2`) calls
it again when the viewer picks a second Ludeo from the overlay without quitting. A naive ledger re-reads
"the original" on that second entry — and by then the original **is the forced sentinel**. The undo now
writes the sentinel back as if it were the viewer's own value, permanently, and the log looks perfect
both times.

```csharp
public static void SuppressIntroSequences()
{
    if (s_held) return;                     // <-- the whole fix: the 2nd restore must NOT re-record
    s_hadKey   = PlayerPrefs.HasKey(KEY);
    s_original = s_hadKey ? PlayerPrefs.GetInt(KEY) : 0;
    s_held     = true;
    PlayerPrefs.SetInt(KEY, SENTINEL);
    PlayerPrefs.Save();
}
```

Same family as the "reset every restore, not only at bootstrap" pause-flag rule — but the **opposite**
polarity, which is why it is easy to get backwards: pause flags must be re-initialised on *every* restore;
the undo ledger must be recorded on *only the first*. The distinguishing question is whether the value is
the layer's own or the player's.

## 3. "Absent" is not "zero"

`PlayerPrefs.GetInt(key)` returns `0` for a key that was never written, so a ledger that stores only the
value cannot tell "the viewer had 0" from "the viewer had no key". Undoing the second case with
`SetInt(0)` **creates** a key the viewer never had. Track `HasKey` separately and undo with `DeleteKey`.
The same applies to any save system whose read funnel returns a default.

## 4. The undo has to be wired to the exit that does NOT raise the ordinary end event

Hook the undo to the layer's end/abort notification and you will cover every *ordinary* finish. But the
CR-007 exit funnel typically **early-returns without raising that event when no run was ever begun** —
and "the viewer quit from a covered menu while the restore was still inbound" is exactly that case. It is
also the case most likely to happen during gate testing, so the leak gets written by the very session that
was supposed to validate the mechanism. Wire the undo to `OnApplicationQuit` as its own call (which on
Unity also covers Editor stop-play), and make it **idempotent** so the overlapping paths cannot double-undo.

## Choosing the forced value: you cannot read the bound you have to beat

The threshold is usually a **serialized per-instance field** on a manager in the scene being loaded — so
at force time the object does not exist yet and the field is unreadable. Do not hardcode the value you
happened to see in the prefab; pick a sentinel far above any plausible authored maximum and say why in a
comment. And check the consumer's branch structure while you are there: if the "already seen" branch is
the `if` and the increment is its `else`, forcing the flag also **skips the increment**, so the layer's own
write is the only one that needs undoing. If the increment is unconditional, the replay writes the viewer's
progression too and the ledger has to absorb that as well.

## Where else the same shape hides

Any *persisted* value the restore has to lie about so the moment becomes playable: a "tutorial completed"
bool, a difficulty-unlock, a "seen this cutscene" set, a first-launch EULA/consent stamp, an intro play
counter. The tell is that suppression could not be done with an `IsInLudeoFlow` gate, because the thing
being suppressed is chosen **before any of your code in that scene runs**.

> **A pre-scene-load force is a borrow, not a write. Record the original exactly once, distinguish absent
> from zero, and hand it back on the exit that does not announce itself.**

## 5. An in-memory ledger cannot survive the failure it exists for — PERSIST it

The four points above were written from reasoning. Point 2's record-once guard then failed in the field, and
the way it failed is the most useful part of this learning.

Two consecutive gate runs, in-memory ledger only:

| run | what happened | prefs after |
|---|---|---|
| 1 | recorded the real value `3`, forced the sentinel, then the **Editor was killed** — no end/abort hook, no `OnApplicationQuit`, no teardown of any kind | `9999` |
| 2 | read `9999`, dutifully recorded **that** as "the viewer's own value", forced, undid | `9999` — the `3` is gone forever |

The record-once guard was working *exactly as designed*. It simply cannot distinguish a leaked sentinel from
a genuine value, because a static field dies with the process while the **forced value survives on disk**.
The asymmetry is the whole bug: the thing you wrote is durable, the note about what you overwrote is not.

**The fix: the ledger lives next to the thing it protects, in the same persistent store.**

```csharp
// force: persist the ledger BEFORE writing the force
PlayerPrefs.SetInt(LEDGER_KEY, hadKey ? original : ABSENT_SENTINEL);
PlayerPrefs.Save();
PlayerPrefs.SetInt(GAME_KEY, FORCED);      // crash between the two => ledger with no force => repair is a no-op
PlayerPrefs.Save();

// undo: drop the ledger LAST - it IS the "a force is outstanding" marker
// boot: if the ledger key exists at all, a previous process died holding a force -> restore and clear
```

Three ordering rules fall out, and each one is a distinct bug if you get it backwards:

1. **Write the ledger before the force.** The surviving-crash case is then "ledger present, force absent",
   whose repair is a harmless rewrite of the same value. The opposite order leaves "force present, ledger
   absent" — the leak itself.
2. **Delete the ledger after restoring.** The ledger's *existence* is the outstanding-force marker, so
   clearing it first makes a crash in between look like a clean boot.
3. **A ledger already present at force time means trust the ledger, not the current value.** The current
   value is the leaked sentinel. This is the guard that would have saved run 2.

Repair at the earliest boot hook that precedes any reader of the flag — before the first scene loads, not in
a scene object's `Start()`.

> **The force is durable, so the memory of what it overwrote must be too. If your undo note lives only in a
> static field, the first hard kill converts a borrow into a permanent write — and the next run will
> faithfully record the sentinel as the truth.**
