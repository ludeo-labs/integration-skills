---
category: engine-quirks
tier: generalizable
sourceGame: ActionAdventureSample
phase: 1
question: "Are you deciding how to run the phase-1 Editor smoke test, or worried Initialize() will leave the Editor cursor hooked after stop-play?"
sanitized: true
---

# Stop-play in the Editor DOES tear the native layer down (plugin v4.3.1.0, Unity 6.2)

The phase-1 brief warns that the Editor "does not tear that native layer down when you stop play
mode", so a single `Initialize()` can leave the OS cursor hooked across the whole Editor. On plugin
**v4.3.1.0 / Unity 6000.2.6f2** that did **not** reproduce — teardown ran to completion on stop-play:

```
[UNITY_HOOK] OnWantsToQuit
[UNITY_HOOK] OnWantsToQuit - Quitting immediately.
[UNITY_HOOK] DeInit
[LudeoManager] Disposing …
[INIT_WRPR] Calling LudeoShutdown!
Core:Log Starting shutdown → Closed network thread → Shutdown finished
[LudeoManager] Disposed
```

Integrator confirmed the Editor cursor behaved normally afterwards.

**Why it works — read `LudeoUnityManager.OnWantsToQuit`.** `Awake` subscribes to
`Application.wantsToQuit`, which Unity fires on Editor stop-play too. The handler branches on
`Application.isEditor`: the non-Editor branch defers the quit and shuts down asynchronously, while
the **Editor branch calls `DeInit()` and returns `true` immediately** — a full synchronous
`LudeoManager.Shutdown()` before play mode ends.

**What this changes:**
- The Editor smoke-test leg is **safer than the brief implies**. Keep firing it manually from a
  `[MenuItem]` (one init per play session is still the right discipline, and a bare auto-firing
  `[RuntimeInitializeOnLoadMethod]` still re-inits the overlay on *every* play), but do not treat a
  hooked cursor as an expected cost.
- If the cursor **is** stuck after stop-play, that is now a **signal**, not the norm — check whether
  teardown actually ran (grep the log for `[LudeoManager] Disposed`). A missing `Disposed` means
  `wantsToQuit` never fired or `DeInit` threw, which is a real bug worth reporting.

**Unchanged:** CR-007 still requires routing every gameplay exit through `EndGameplay`/`AbortGameplay`
and disposing the session on quit. This learning is only about the Editor's stop-play behaviour, not
about session hygiene.

**Not yet verified:** older plugin versions, older Unity versions, and games that hide their own
cursor (`Cursor.visible = false`) — the original warning may still hold there.
