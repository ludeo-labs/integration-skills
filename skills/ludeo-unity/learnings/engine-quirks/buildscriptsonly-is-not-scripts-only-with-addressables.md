---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "3,5,6,7"
question: "Does the game use Addressables (or any package with an IPreprocessBuildWithReport/build-hook that produces content)? If so, BuildOptions.BuildScriptsOnly will NOT give you a fast, asset-safe rebuild."
sanitized: true
---

# `BuildScriptsOnly` is not scripts-only when Addressables is in the project — and interrupting it corrupts the build

Iterating on the integration layer means rebuilding the player a lot, and
`BuildOptions.BuildScriptsOnly` looks like the answer: rebuild the managed assemblies, reuse the
baked assets. In a project with **Addressables** it is not.

Observed on a real build:

- Full build: **30 minutes** (dominated by shader variant compilation).
- "Scripts-only" build: **1 minute** — but it **rewrote a 603 MB asset bundle**. Addressables'
  own build hooks run inside the player build regardless of the flag, so the content pipeline
  re-executes. The log reaches `GenerateLocationListsTask` and friends.

The dangerous part is not the time. It is that **killing a build mid-content-write leaves the
output corrupt, and a subsequent scripts-only build does not repair it.** After an interrupted
run the player crashed on launch with:

```
The referenced script (Unknown) on this Behaviour is missing!
The file 'archive:/CAB-<guid>/CAB-<guid>' is corrupted! Remove it and launch unity again!
[Position out of bounds!]
Crash!!!
```

Confirmed by timestamp: every healthy bundle carried the good full build's time; the single
corrupt one carried the interrupted build's time.

## Rules

1. **Do not promise scripts-only as "the fast path" before measuring it on that project.** Time
   one, and check whether bundle files change (`ls -la` the Addressables output folder before and
   after). If bundles are rewritten, it is a content build wearing a different name.
2. **Never put a tool/CI timeout on a player build that is shorter than the build.** An agent
   harness killing the process at N minutes is indistinguishable from a power cut. Run builds
   **in the background** with no wall-clock kill, and poll for the result.
3. **After any interrupted build, do a full rebuild.** Do not layer another incremental build on
   top and assume it heals — it does not.
4. **Verify a build by its own success line, not by exit code**, and check the output timestamps.
   `BuildReport.summary.result` can be `Failed` while `totalErrors` is `0`
   (see [[headless-player-build-needs-a-scene-open]] for one cause).

## What to use instead

For iterating on C# only, the editor's own compile is the fast feedback loop — run the headless
compile gate (`-batchmode -quit`, then grep for `error CS`), which takes a couple of minutes and
touches no content. Build a player only when you actually need to run one, and accept it is a
full build.
