---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "1,3,7"
question: "Does the game require a store platform client (Steam / Epic / a console SDK) to reach gameplay? A Ludeo cloud machine has none of them — scope this as a layered removal, not a one-line fallback."
sanitized: true
---

# Running without the store platform is five fixes, not one — and each hides the next

A cloud machine has no Steam client, no signed-in user, and no store overlay. Scoping this from
the code looks reassuring: the game had a `IPlatformNetwork` interface with one implementation,
selected on a single line. "Add a second implementation" seemed like the whole job.

It was the first of **five**, each invisible until the previous one was fixed, and each found only
by running the game:

| # | What breaks | Symptom |
|---|---|---|
| 1 | Platform init fails → startup shows a "connection error" page and `return`s | Game never reaches gameplay; the rest of startup never runs |
| 2 | The **network transport is platform-based** (here `FizzyFacepunch` for Mirror) and refuses to `ServerStart` | Hosting *half*-succeeds — it logs an error and returns, so the server never listens and the game settles into a broken state instead of failing loudly |
| 3 | The connect handler reads the platform user id → throws inside `OnServerConnect` | Host never authenticates; every later `TargetRpc` reports a **null connection**, producing a wall of unrelated-looking errors |
| 4 | Several scattered reads of `<Platform>.UserId` decide **which player is the local one** | Wrong player identity, or a throw, deep in gameplay code |
| 5 | `Application.OpenURL` (store page, survey, community link) | A browser window opens **on top of the streamed game**, which the viewer cannot dismiss |

## The two non-obvious ones

**(4) is the trap.** These reads are scattered — player spawn, skills, save data, UI. Patching each
site independently is wrong: they must all return the **same** stand-in id, or the game disagrees
with itself about who the local player is. Add **one** guarded accessor and point every site at it:

```csharp
static public UserId LocalUserId =>
    Platform.IsValid ? Platform.UserId : new UserId { Value = STABLE_STAND_IN };
```

**(2) fails quietly.** A transport that logs-and-returns rather than throwing is worse than one
that throws: `StartHost()` appears to succeed. Check the transport component on the network
manager prefab early — if it is the platform's transport, plan to swap it. Mirror serves the local
player directly in host mode, so any working transport does; a UDP/KCP one is usually already in
the project and needs nothing but a port.

## How to scope this properly at phase 1

Do not estimate from the interface. Grep for the platform SDK's namespace across gameplay code,
not just the networking folder:

```
grep -rn "Steamworks\|SteamClient\.\|SteamUser\.\|SteamFriends\." --include=*.cs Assets/ | grep -v IsValid
```

Every hit outside the platform wrapper is a leak of the platform assumption into game logic, and
each is a potential blocker. Also check the transport on the network manager prefab, and grep for
`Application.OpenURL` / `Process.Start`.

**Make it opt-in** (a command-line argument, or a flag the SDK sets), never an automatic fallback:
silently switching a real player from "install the store client" to "plays offline" is a product
change that is not yours to make.

## Why it matters for scheduling

This is not phase-7 polish. It is a **hard blocker for the cloud** that is fully testable locally
today — close the store client and run the build — so there is no reason to defer it on
testability grounds, only on priority. Discovering five layers of it during the upload step is a
much worse day than discovering them during lifecycle work.
