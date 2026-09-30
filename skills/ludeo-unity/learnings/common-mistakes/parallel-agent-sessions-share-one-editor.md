---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "1,2,3,4,5,6,7,8"
question: "Are two or more agent sessions working on the same project at once, sharing one open Unity Editor? Then every compile any of them triggers is a domain reload in the others' Editor, and a human capture in progress leaves no file to detect. Split the files up front, and ask the peer before any reload."
sanitized: true
---

# Parallel agent sessions share one Editor

Several agent sessions on one project share one Unity Editor process. Every compile any of them causes —
a bridge call, an `AssetDatabase.Refresh`, entering play mode — is a domain reload in every other
session's Editor, and a reload during play mode kills that play session (see
[[an-mcp-editor-bridge-compiles-every-call-never-during-play-mode]]). Even waking the bridge after its
idle shutdown triggered a full reload that compiled another session's half-written sources.

A **human** capture is the worst case: it writes no job file and no result file, so the usual "is a run
in flight?" check is blind for the minutes it takes, and the capture is lost (see
[[an-mcp-editor-bridge-compiles-every-call-never-during-play-mode]]).

## What it cost

On one integration up to five sessions ran at once against one Editor. They exchanged about 100
cross-session messages, 64 of them on a single day, mostly negotiating who had the Editor. Two sessions
diagnosed the same bug separately; one session's unfinished files broke another's compile check;
sessions misattributed file ownership to each other; and the integrator had to referee Editor ownership
by hand. The agents' own verdict was that parallelism was "net positive … but not dramatically": design
and code ran in parallel, but every gate stayed serial on the one Editor.

## The habit

1. **Partition files up front** and say which session owns which. Concurrent edits to different parts
   of one file coexisted fine; the conflict is reloads, not text.
2. **Before any reload, message the peer and wait for a reply**, rather than inferring from the absence
   of a result file.
3. **Compile without the Editor** wherever possible (see
   [[dotnet-build-of-the-unity-csproj-cannot-catch-player-build-breaks]]). That removed most of the
   negotiation.
4. **Keep shared state in one notes file** that every session reads, instead of relaying instructions
   by copy-paste, and keep each session anchored on its own phase (see
   [[keep-the-phases-in-order-and-re-anchor-after-a-detour]]).
5. **If every step needs the Editor, prefer one session at a time.**
