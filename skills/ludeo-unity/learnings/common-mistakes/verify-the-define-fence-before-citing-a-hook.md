---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: 2
question: "Does the target build use a define set that differs from the Editor's (a demo/shipping/console variant that turns dev tools OFF)? If so, every hook you record must be checked against the fence it sits inside."
sanitized: true
---

# A hook is only real if its `#if` fence is defined in the TARGET build

While mapping, a promising integration hook turned up inside a core manager's
`Update()`: a clean check that suppressed gameplay input whenever any UI page was
open. It read exactly like the game-owned input gate a restore-freeze or consent
overlay should reuse — so it went into the CODE_MAP as one.

It was wrong. Reading four lines further up:

```csharp
private void Update()
{
#if UNITY_EDITOR || GAME_DEV_TOOLS
    if (inputActions != null && uiManager != null && uiManager.OpenPageCount == 0)
    {
        inputActions.CheckInput();      // debug-only input probe
    }
#endif
    // ... real per-frame work continues here, unfenced
}
```

Two independent reasons it was not the gate:

1. **It is fenced.** The target build in this engagement was a demo variant whose
   define set turns the dev-tools symbol **off** — so the block does not exist in the
   shipping binary at all.
2. **Even when compiled, it gates the wrong thing** — a debug input probe, not the
   player's input.

The *actual* input authority was elsewhere: a dedicated input singleton that arbitrates
between named action maps, with a highest-priority "prevent" map and a public
`SetPreventInput(bool)` — a far better hook, and one that ships.

## Why this is easy to get wrong

Grep output is line-oriented. A match shows you the line, not the preprocessor
context it lives in. In the Editor, the fenced code compiles and looks live, so
even a runtime spot-check can confirm a hook that will not exist in the build you
are actually shipping.

The failure is asymmetric and quiet: an integration built on a fenced hook compiles
and works in-Editor, then silently no-ops in the target build.

## The check

Before recording any hook in the CODE_MAP — or building on one in a later phase:

1. **Read the surrounding lines, not just the match.** Look upward for `#if`, and
   confirm where the matching `#endif` lands. `grep -B 10` costs nothing.
2. **Resolve the fence against the TARGET build's define set**, not the Editor's.
   `UNITY_EDITOR` in the condition is an immediate red flag that the block may be
   Editor-only. Note that a build variant define often *disables* a dev-tools define
   — check the project's define configuration, not just the symbol's name.
3. **Ask whether the fenced code is even the thing you think it is.** Debug probes
   frequently mirror the shape of real logic while doing something adjacent.
4. **When a fenced hook is genuinely the best site**, say so explicitly and record
   what must change (unfence it, or add a Ludeo-owned equivalent) — don't quietly
   depend on it.

## Record the correction

If a hook already went into an artifact and turns out to be fenced, **fix the entry
and leave a `correction` note naming the fence**. The next phase reads the artifact,
not the conversation — an uncorrected entry is a trap for whoever picks it up.

Related: [[investigate-before-asking]] §2 — never assert what you have not checked.
The check here is four lines of context.
