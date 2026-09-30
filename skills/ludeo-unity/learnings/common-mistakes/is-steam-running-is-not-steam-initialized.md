---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 3
question: "Is your Activate readiness gate testing Steam with `SteamAPI.IsSteamRunning()` (or any other 'is the client there' API)? That is not the same question as 'did SteamAPI_Init succeed in THIS process' — swap it for the wrapper's own Initialized flag before you trust the gate."
sanitized: true
---

# `IsSteamRunning()` answers the wrong question, and the gate passes silently

Implicit (Steam) auth requires that **this process** completed `SteamAPI_Init` before `Activate` is
called. The natural-looking predicate for a readiness gate is:

```csharp
return Steamworks.SteamAPI.IsSteamRunning();   // WRONG
```

`IsSteamRunning()` reports only that **a Steam client process exists on the machine**. It says nothing
about whether this process got a valid Steam session. On any developer box where Steam is running but
**not logged in** — or where the account does not own the app id — it returns `true` while
`SteamAPI_Init()` has already failed.

## Why it costs more than one wrong line

The gate then *passes*, so:

- `Activate` is called immediately and the callback returns `InvalidAuth`.
- The gate's own "store platform was not ready" warning — the diagnostic written specifically to
  explain this failure — **never fires**, because from the gate's point of view nothing went wrong.

So the log contains the failure but not the explanation, and the gate that exists to catch this class
of problem produces no evidence either way. (This is the general shape of
[[a-guard-that-cannot-fire-is-not-evidence]]: a guard whose predicate cannot go false is not a check.)

## The fix

Use the value the wrapper sets *after* `SteamAPI_Init` returns. With Steamworks.NET the game's Steam
manager component usually exposes two of them, and **the obvious one is the wrong one**:

| Member | Backing | Safe to poll? |
| --- | --- | --- |
| `static bool Initialized` | `Instance.m_bInitialized` | **No** — see below |
| `static Task<bool> InitializedAsync` | a `static TaskCompletionSource<bool>` | **Yes** |

**`Initialized` goes through the singleton accessor, and that accessor *lazily creates* the manager
GameObject** (`GetOrCreateInstance` → `new GameObject(...)` → `DontDestroyOnLoad`). So merely *asking
the question* constructs the game's Steam manager. A readiness gate that polls from
`BeforeSceneLoad` therefore builds it earlier than the game intends, reordering the game's own
startup — and calling the same property from an *editor* script throws outright, because
`DontDestroyOnLoad` is play-mode only. (Related but distinct from
[[a-guard-that-cannot-fire-is-not-evidence]]: there the predicate cannot go false; here reading the
predicate *changes the world*.)

Prefer the task, which touches only a static field:

```csharp
// Fence must match the wrapper's own - the member only exists inside it.
#if UNITY_STANDALONE && STORE_STEAM
    System.Threading.Tasks.Task<bool> steamInit = SteamManager.InitializedAsync;
    if (!steamInit.IsCompleted) return StoreAuthState.Pending;   // has not answered yet
    return steamInit.Result ? StoreAuthState.Ready : StoreAuthState.Failed;
#else
    return StoreAuthState.Ready;
#endif
```

**Model the gate as three states, not a bool.** A task separates *"Steam has not answered yet"* from
*"Steam answered no"*. With a bool the gate cannot tell them apart and burns its full timeout on a
failure that was already final; with three states it reports the real cause immediately.

Two more details that bite:

- **Match the `#if` fence exactly.** The wrapper's `Initialized` is typically declared *inside*
  `#if UNITY_STANDALONE && STORE_STEAM`. Guarding your call with a looser fence (`#if STORE_STEAM`
  alone) compiles on your platform and breaks on the next one. See
  [[verify-the-define-fence-before-citing-a-hook]].
- **Do not stop at the game's platform abstraction.** An `IPlatform.IsInitialized`-style flag usually
  reports itself initialized even when the underlying store SDK failed — that abstraction's job is to
  degrade gracefully, not to report store health. Test both.

## When the gate correctly reports "not ready"

A fixed gate turns an unexplained `InvalidAuth` into a stated cause, but it does not make local runs
work. If the machine has no logged-in Steam client, implicit auth **cannot** succeed there — switch
local/CI runs to explicit auth (`runWithoutLauncher = true` + `launcherUserId`), and make sure that
setting is reverted or `#if`-gated before the build is uploaded.
