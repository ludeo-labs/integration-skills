---
category: engine-quirks
tier: generalizable
sourceGame: SurvivalSample
phase: "7"
question: "Are you about to call a player build hung because the editor process is at zero CPU and the log has gone silent for minutes? Check the whole process TREE, including grandchildren - the IL2CPP linker runs two levels down, prints nothing, and can hold the parent idle for tens of minutes."
sanitized: true
---

# A player build that looks hung is usually the linker, and the evidence is two levels down

A cloud build was declared hung on this evidence: the editor process at exactly zero CPU, its log
not written for ten minutes, and the stage stuck at "Incremental Player Build". It was killed and
restarted. **It had not been hung at all** — it was linking, and the restart cost more time than
waiting would have.

What the sampling missed: processes were enumerated by parent id, so only the editor's *direct*
children were measured. The expensive step does not live there.

```
Unity.exe
 └─ bee_backend.exe        ← direct child, idle, waiting on its jobs
     └─ il2cpp / link.exe  ← grandchild, 20s of CPU per 10s wall, 6 GB working set
```

The editor is idle **because** it is waiting on that grandchild, which prints nothing for the whole
link. Every signal a parent-only sample produces says "dead".

## The check that actually distinguishes the two

Sample aggregate CPU across the build tool names, not the process tree, and compare two samples a
minute apart:

```
Unity, bee_backend, il2cpp, link, clang, mono, netcorerun, <engine>.ILPP.Runner, <engine>ShaderCompiler
```

If the **sum** advances, the build is working no matter how quiet the log is. Only when nothing
anywhere has burned CPU for a couple of consecutive minutes is it genuinely stuck. Log idleness on
its own is worthless here: a watch built on "log quiet for 6 minutes" fired a false stall while the
linker was measurably flat out.

## Why the silence lasts so long

Check the IL2CPP configuration before estimating. At the most optimized setting the link is tens of
minutes on a large game, and some projects add `--verbose --enable-stats --profiler-report`, which
makes it slower still. Read that out of the build's own gate line rather than assuming.

## The cost of getting it wrong

Killing mid-build is not free: content already written stays behind, and the project's own guidance
warns that killing during a content write leaves output a later incremental build will not repair.
Here the content write had finished, and the restart rewrote everything that ships, so the artifact
was sound — but that was luck, not design. **Prove the tree is idle before killing anything.**

Related: [[prove-the-log-came-from-the-build-you-just-made]] — the same family of mistake, trusting
one signal about a build without checking what actually produced it.
