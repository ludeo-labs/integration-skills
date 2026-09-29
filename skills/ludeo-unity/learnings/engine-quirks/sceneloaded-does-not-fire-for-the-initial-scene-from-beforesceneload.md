---
category: engine-quirks
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Are you binding Activate / the first per-scene install to SceneManager.sceneLoaded subscribed from a [RuntimeInitializeOnLoadMethod(BeforeSceneLoad)] bootstrap, and relying on it firing for the FIRST scene of the run?"
sanitized: true
---

# `SceneManager.sceneLoaded` did not fire for the initial scene when subscribed from `BeforeSceneLoad`

The phase-3 plan bound "Activate late" and the per-scene install to `SceneManager.sceneLoaded`, subscribed
from the layer's `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]` bootstrap,
with a comment asserting it *"fires for the FIRST scene too (Editor direct-play covered)"*. The
[[bind-openroom-to-sceneloaded-plus-manager-presence-not-a-named-entry]] learning makes the same claim.

**In a Windows player build on Unity 2021.3.37f1 it did not.** The run log is unambiguous:

```
[Ludeo] 10:29:34:207 Initialize + CreateSession: Success; ... Activate deferred to the first sceneLoaded
[Ludeo] 10:29:34:220 Bootstrap complete ... waiting for the first sceneLoaded
   ... 19 seconds of main menu, no sceneLoaded line ...
[Ludeo] 10:29:53:859 sceneLoaded 'FirstLevel' (build index 1)
[Ludeo] 10:29:53:862 Activate: issuing from 'FirstLevel'
```

The menu scene loaded and ran for 19 s without the callback; the first `sceneLoaded` was the level the
player picked. Consequences: `Activate` fired from inside a level instead of the menu (the readiness gate
then covered the level for ~1 s), and in the **preselected player flow** the restore would start from a
gameplay scene rather than the menu — exactly the ordering
[[activate-late-or-the-cloud-selects-before-the-game-can-load]] warns about.

Stated limit: observed in one build on one Unity version; the Editor direct-play case was not measured
in the same session. Treat "does the initial scene fire it?" as a per-version fact to verify from a log,
never from a comment.

## The fix that does not depend on the answer

Handle the initial scene explicitly from an `AfterSceneLoad` hook and keep `sceneLoaded` for later loads,
with a once-per-scene guard so a version that *does* fire it is not double-handled:

```csharp
[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
static void Boot() { /* Initialize, CreateSession, subscribe events; */ SceneManager.sceneLoaded += OnSceneLoaded; }

[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
static void InitialScene() { OnSceneLoaded(SceneManager.GetActiveScene(), LoadSceneMode.Single); }

static int s_lastHandled;
static void OnSceneLoaded(Scene s, LoadSceneMode m)
{
    if (s.handle == s_lastHandled) return;   // already handled (either path)
    s_lastHandled = s.handle;
    // ... classify by manager presence, Activate once, per-scene install ...
}
```

## How it was caught

Only by the trace: the layer logs every `sceneLoaded` with the scene name, and `Activate` logs the scene it
is issued **from** (the diagnostic recommended in the activate-late learning). Without either line this
would have read as "sign-in works, just a slightly long loading screen".
