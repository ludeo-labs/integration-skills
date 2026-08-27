---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 7
question: "Are you adding player-only code (a cloud log mirror, a P/Invoke, a platform shim) behind `#if ... && !UNITY_EDITOR`, in a project whose compile gate is a headless Editor run? That gate cannot see inside the block — it will pass on code it never read."
sanitized: true
---

# `#if !UNITY_EDITOR` makes your compile gate vacuous for the exact code that ships

The natural way to write player-only code is:

```csharp
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern void OutputDebugStringW(string message);
    ...
#endif
```

`UNITY_EDITOR` is defined for **every** Editor compile, including `-batchmode`. So the entire block is
excluded from the only compile the agent can run. The gate reports zero errors because there was
nothing in it to check — the class compiles down to an empty shell, and a typo, a bad P/Invoke
signature or a missing `using` inside the block surfaces for the first time **in the cloud**, one
build-and-upload cycle later.

That is the worst possible place for it: this pattern is used almost exclusively for code that only
runs where you cannot observe it.

## Do this instead

Gate the **platform** at compile time and the **Editor** at runtime:

```csharp
#if UNITY_STANDALONE_WIN                       // defined in the Editor too, when the active
    ...                                        // build target is Windows Standalone
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    private static void Install()
    {
        if (Application.isEditor) return;      // runtime exclusion, not compile-time
        ...
    }
#endif
```

`UNITY_STANDALONE_WIN` **is** defined during an Editor compile whenever the active build target is
Windows Standalone, so the body is type-checked by the same headless gate that guards everything
else, while never executing in an Editor session. Pass `-buildTarget Win64` to the batchmode run so
the target is not left to whatever the project was last switched to.

## Prove it compiled, don't infer it

Exit code 0 and "Exiting batchmode successfully" do not distinguish "compiled clean" from "compiled
an empty class". Nor does the type appearing in the assembly — the shell exists either way. Grep the
built assembly for a symbol that can **only** come from inside the guarded block:

```bash
rm -rf Library/ScriptAssemblies          # defeat the Bee cache
# ... run the batchmode compile ...
grep -c "OutputDebugStringW" Library/ScriptAssemblies/Assembly-CSharp.dll   # 1 = the body is in
grep -c "kernel32.dll"       Library/ScriptAssemblies/Assembly-CSharp.dll
```

The same trap applies to `#if DEVELOPMENT_BUILD` around restore-verification code, and to any
`#if !UNITY_EDITOR` platform shim. Whenever a conditional block is invisible to the gate, the gate is
not guarding it — and the block is usually the part you understand least.
