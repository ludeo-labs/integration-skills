---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 3
question: "Binding the END of the capture window to a game method (return-to-hub, back-to-lobby, quit-to-menu)? Enumerate that method's callers BY ENCLOSING METHOD, not by count. A 'return to X' method is very often also the BOOT path into X, so it fires before any run exists."
sanitized: true
---

# Audit the END boundary's callers as hard as the START boundary's

Phase 3's brief is emphatic about the start boundary: bind `OpenRoom` to the **convergent runtime
signal**, not to a plausibly-named entry method, because static analysis makes a `StartNewGame`-style
handler look canonical when real games reach gameplay by several paths. That warning is repeated three
times in one brief.

It says nothing equivalent about the **end** boundary, and the omission is easy to inherit. In the
observed integration the start boundary was traced properly — the obvious candidate was rejected after
following all five entry paths to a convergent event — and the end boundary was then bound to a
hub-return method **on the strength of its name**, corroborated by the phase-2 map having labelled it
an End exit site.

The very first thing that happened on launch was the end boundary firing.

## Why the name lies

The method was called from the gameplay container's `Start()`. For any player past the tutorial, the
"return to the hub" method **is the boot path into the hub** — it runs before the container's own
gameplay-start call and long before any run-start event.

That is not a quirk of one codebase. It is the normal shape: a hub/lobby/menu game needs one routine
that puts the player in the hub, and both "boot into the hub" and "come back to the hub after a run"
call it. The word *return* is true only in the common case.

Auditing all 19 callers by enclosing method, **seven were not run ends**:

| Caller context | What it really is |
|---|---|
| container `Start()` | boot into the hub |
| container `Start()`, debug skip-tutorial branch | boot |
| `SkipTutorial()` | tutorial skip |
| `OnForceTutorialEnd()` / `TutorialEndActions()` | tutorial completion |
| `LoadRoom(...)` | a mid-flow reload |
| debug-menu click handler | dev tooling |

## The count is not the audit

The trap has a specific shape worth naming, because it *feels* like diligence:

> "This method has 19 call sites. Hooking each one is 19 chances to miss one, so hook the **method
> body** instead — one insertion covers them all, including callers added later."

Every clause is true, and hooking the body is still the right call. But that reasoning is about
**coverage**, and it silently substitutes for the **semantic** question: *do all 19 callers mean the
thing the method is named after?* The list was printed and then used only for its length.

**Enumerating callers is not auditing callers.** Run the same one-liner on the end boundary that you
ran on the start boundary:

```
awk -v L=<line> 'NR<=L && /^[[:space:]]*(private|public|protected|internal)?[[:space:]]*(void|IEnumerator|bool)[[:space:]]+[A-Za-z_]+[[:space:]]*\(/ {ln=NR;l=$0} END{print ln": "l}' <file>
```

A caller inside `Start()`, `Awake()`, a tutorial routine, or a debug handler is a red flag on sight.

## Swapping signals does not fix it — the layer must own run state

The reflex is to hunt for a better game event. Check it before committing: in the observed project the
obvious alternative (a `SafezoneEnter`-style notification) fired from the hub scene's load-completed
handler, which **also runs at boot**. Every candidate carried the same ambiguity, because the ambiguity
is in the game's design, not in the choice of hook.

The formulation that works inverts the authority:

> **The game signal asks the question; the layer decides whether there is anything to end.**

```csharp
public static void OnRunEnded()
{
    if (!s_roomOpenForRun) return;      // boot, tutorial, debug, mid-flow reload - nothing to end
    s_roomOpenForRun = false;

    if (controller.IsGameplayActive) controller.EndGameplay(null);   // real run - keep the capture
    else                            controller.AbortGameplay(null);  // room opened, never begun - close it
}
```

Two things fall out of it that are worth keeping:

- It is **robust to callers added later**, which was the original (correct) reason for hooking the
  method body rather than the call sites. A 20th caller in a future release needs no attention.
- The **else branch is not decoration**. A façade's `EndGameplay` typically early-returns when
  gameplay never began — which leaves the *room* open and leaking on the backend. Aborting closes it.

## Also check the start side for the mirror case

The same container `Start()` fired the **run-start** event during the tutorial, so a capture room would
have opened during scripted onboarding. Whatever flag the game sets for its tutorial world (here, one
set nine lines above the call) is the guard. If you audit one boundary, audit both in the same pass —
the bug that bites first is not necessarily the one you looked for.

Related: [[a-session-boundary-can-exist-and-never-fire]] — the same family, inverted. There the mapped
boundary was fully wired and never fired; here it fired when nothing had started.
