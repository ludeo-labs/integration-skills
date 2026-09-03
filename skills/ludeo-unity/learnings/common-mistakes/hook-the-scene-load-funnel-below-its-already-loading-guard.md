---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Are you putting the CR-007 End/Abort hook in a wrapper around SceneManager.LoadSceneAsync — and does that wrapper early-return when a load is already in flight?"
sanitized: true
---

# Put the CR-007 scene-transition hook **below** the loader's "already loading" guard, not at the top of the method

A single scene-load wrapper is the best CR-007 hook a project can offer: one edit covers every level
transition and quit-to-menu, on the departure side. The reflex is to put the `End`/`Abort` call at the
**top** of the method. That is wrong whenever the wrapper can decline the request:

```csharp
public bool LoadSceneAsync(string sceneName, OnEndSceneLoaded onDone = null)
{
    // ✗ hook here: a rejected call ends the gameplay session with NO transition
    if (!IsSceneAsyncLoaded())
        return false;                 // already loading — nothing happens

    // ✓ hook here: past the guard, the load is definitely happening
    LudeoGameHooks.NotifySceneChanging(sceneName);

    m_loading = SceneManager.LoadSceneAsync(sceneName);
    ...
}
```

Above the guard, a re-entrant or double-fired transition request (two triggers overlapping, a UI button
pressed twice, a fade callback racing a direct call) ends the run while the player keeps playing the
same level. Capture stops with no error and no visible symptom until someone notices the Ludeo is short.

**Generalize the check:** before placing a hook in any game funnel, read the whole method for early
returns, `bool` results, and no-op branches, and place the hook past the last one. A funnel that
*reports* whether it acted (returns `bool`) is a strong hint that it sometimes doesn't.

## Two companions for the same hook

- **Discriminate End vs Abort by destination.** CR-007 wants `End` for a level transition and `Abort`
  for quit-to-menu. The target scene name is available right there, so one hook serves both:
  `sceneName == <menu scene> ? Abort : End`.
- **Do not also hook the call sites that funnel into it.** Every gate, teleport, level-helper and
  quit-to-menu path that reaches this wrapper is already covered; hooking them too double-ends the
  session. Enumerate the callers, confirm they all pass through, then hook only the funnel — and note
  the deliberately-unhooked list in the plan so a later reviewer doesn't "fix" the omission.
