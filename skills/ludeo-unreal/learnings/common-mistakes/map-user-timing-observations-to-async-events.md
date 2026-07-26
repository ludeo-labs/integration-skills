---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# When the user says "if I wait N seconds it works," find the specific async event in the log

## The mistake

User says: "If I wait a few seconds before clicking play, it works. If I click fast, it doesn't."

Wrong response: theorize about what "settles" during those seconds — subsystems initializing, garbage collection, whatever — and propose a fixed-duration wait or a longer settle loop.

Right response: **open the log and find what specifically completes in that N-second window.** There's an async event with a name; find it, and gate on it directly.

## The ActionGame session that taught this

A voice-over timing bug was "fast-click reproducible, slow-click works." I spent two rounds theorizing (DialogManager-null, class layout changes, C++ preprocessor). All wrong. Once I looked at the log with the user's annotation "THIS IS WHERE THE OVERLAY APPEARS / IF I WAIT TILL HERE, IT WORKS," the answer was plain:

```
22:32:15:221 — Ludeo overlay appears
22:32:16:243 — APlayerStateBase::OnDoneLoadingLoadoutAssets
22:32:16:244 — APlayerCharacter::OnLoadoutLoaded
22:32:17:164 — ProcessLoadedPackages completes (cosmetic mesh done)
```

That named delegate (`OnLoadoutLoadedDelegate`) was the signal the user was empirically waiting on. Binding to it fixed the bug surgically.

## How to apply

When a user describes timing-dependent behavior during Player Flow:

1. Ask them (or annotate yourself) the exact moment "it starts working" — even approximately.
2. Look at the log in that window. Grep for:
   - `OnDone*`, `OnLoaded`, `OnReady`, `OnInit*`
   - `LogStreaming:` entries (async package loads)
   - `APlayerStateBase`, `APlayerCharacter`, `AbilitySystem` events
   - Subsystem BeginPlay / initialization logs
3. Match the "it starts working" moment to a specific event. That event has a name, a delegate, or an accessor. Gate on it.
4. If there's no named signal, add a log inside the suspected subsystem and rerun — don't guess.

## Anti-pattern: fixed-duration waits

"Just wait 3 seconds before OpenRoom" is a band-aid. It breaks on slower machines, faster SSDs, different map sizes. Bind to the actual signal or log inside the signal path.

## Related

- `gate-openroom-on-loadout-ready.md` — the fix this insight led to.
- `verify-vo-path-before-proposing-skip.md` — same family: grep first, theorize second.
