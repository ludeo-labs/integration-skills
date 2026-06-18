---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# Don't trust prior-session "blockers" without re-verifying — misdiagnoses persist in `knownIssues` notes

## The Mistake

`integration.json → stages.3.knownIssues` had this entry from a prior session:

> "Currently blocked on the studio's editor tooling module suppressing -ExecutePythonScript so BPInspector report cannot be generated."

I treated this as authoritative. Spent ~30 minutes designing alternate paths (static `.uasset` scanner, `.bat` patches to skip the default map, `LastLevel` ini edits, debug probes added to `bp_inspector.py`).

When I finally `grep`'d the actual source for the warning text, the editor's Python bootstrap (`init_unreal.py`) turned out to do nothing more than emit a warning when an environment variable is unset and then `return` from that one function. In shape:

```python
# editor Python bootstrap — emits a warning, then returns from THIS function only
def initialize():
    if 'PYTHONPATH' not in os.environ:
        unreal.log_warning("Python environment not initialized!")
        unreal.log_warning("Python tools will be unavailable.")
        return  # ← only returns from THIS function. Doesn't disable Python.
```

The "suppressor" was a **benign warning** about the `PYTHONPATH` env var not being set (the studio's editor launcher would normally set it). It does NOT disable Python execution. The prior-session diagnosis was wrong.

The actual blocker turned out to be something else — `-ExecutePythonScript` not firing the script in the game's headless config — which I never got to fully diagnose because all the time was spent on the wrong path.

## The Rule

**Before treating any prior-session "X is blocked because Y" note as authoritative, spend 5 minutes verifying Y.** If Y is a log warning, find its source. If Y is a config setting, read it. If Y is "the thing won't work," try it.

`integration.json → knownIssues`, prior-round plan files, and similar artifacts are session snapshots — they reflect what someone *thought* was true at the time they wrote it, not necessarily what's true now (or ever was). They may have been:
- Misdiagnosed in a hurry under deadline pressure
- Worked around silently, with the original assumption never re-checked
- Made stale by a later code change that nobody noted

## Why It's Tempting to Skip Re-verification

- "Past me / past colleague was thoughtful, I'll trust their note"
- "Re-verifying takes time and the deadline is now"
- "If the note is wrong, I'll discover that downstream"

The first is wishful — past investigations often had less info than current ones. The second is the trap — re-verification is 5 minutes; chasing the wrong path is hours. The third is true but *expensive* — the downstream discovery happens AFTER you've burned time on the wrong path.

## Detection before release

When you see a `knownIssue` / blocker note that gates non-trivial work:

1. Read the note's claimed root cause.
2. Find the actual evidence (log line, config value, source code).
3. Verify the claim still holds — has anything changed since the note was written?
4. If it doesn't hold: update the note immediately (don't lose the new finding).

Treat the integration's documented blockers like any other unverified third-party claim — useful as a hypothesis, not as a fact.

## Cross-reference

- `never-claim-sdk-behavior-without-citation.md` — same discipline applied to SDK claims
- `do-not-trust-learning-without-verifying-precondition.md` — same discipline applied to past learnings
