---
category: engine-quirks
tier: generalizable
sourceGame: StackOBot
phase: 3
question: "Does the machine's %APPDATA%/Unreal Engine/UnrealBuildTool/BuildConfiguration.xml set PCHMemoryAllocationFactor (which emits /Zm<N>)? If yes and the engine is UE 5.8+, remove that element before building — /Zm inside UBT's nested response file makes cl.exe fail with D8000."
sanitized: true
---

# UE 5.8 + PCHMemoryAllocationFactor: /Zm in a nested response file → cl D8000

## Precondition

- Engine is **UE 5.8+** (UBT emits a per-module `<Module>.Shared.rsp` and references
  it via `@"...Shared.rsp"` from *inside* each per-file `.obj.rsp` — a **nested**
  response file; earlier engines put those args in one flat rsp).
- The machine's `BuildConfiguration.xml` sets `<PCHMemoryAllocationFactor>` under
  `<WindowsPlatform>`, which makes UBT add `/Zm<N>` to the module's shared rsp.
- MSVC toolset 14.44 (observed with cl 19.44.35225 from dir 14.44.35207).

## Symptom

Every *plugin/game module* compile action fails immediately with:

```
cl : Command line error D8000 : UNKNOWN COMMAND-LINE ERROR
```

while engine SharedPCH actions succeed (their rsp is self-contained, not nested).
There is no further diagnostic — D8000 is generic.

## Root cause (empirically bisected)

`cl.exe` rejects **`/Zm` specifically when it arrives via a nested response file**:

- `/Zm50` flat in the response file → accepted
- any other flag tested (e.g. `/W4`) nested → accepted
- `/Zm50` inside a nested `@rsp` → **D8000, always**

Reproduce minimally: `b.rsp` = `/Zm50`; `a.rsp` = `@"b.rsp"` + `/c` + `t.c`;
`cl @a.rsp` → D8000. Note cl prints its banner *before* the error — don't judge
success from the first lines of output (`head -2` shows only the banner).

## Fix

Remove (or comment out) `<PCHMemoryAllocationFactor>` from `BuildConfiguration.xml`
for UE 5.8+ builds. The setting is a PCH memory limiter that mattered on
low-memory machines; on modern hardware it is usually vestigial. If other projects
on the machine still want it, back the file up, strip the element, build, restore
(same discipline as CompilerVersion pinning).

## How to recognize it fast

- D8000 on module compiles + successful SharedPCH compiles in the same build.
- `grep -n "/Zm" <Module>.Shared.rsp` — if present, check BuildConfiguration.xml.
- The rsp chain: `Module.<Name>.cpp.obj.rsp` line 2 is `@"...<Name>.Shared.rsp"` —
  that nesting is new in UE 5.8 (`UEBuildModuleCPP.cs` "Create shared rsp for the
  normal cpp files" + `VCToolChain.CreateSharedResponseFile`).
