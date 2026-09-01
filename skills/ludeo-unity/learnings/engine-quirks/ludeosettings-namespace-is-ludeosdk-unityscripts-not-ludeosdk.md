---
category: engine-quirks
tier: generalizable
sourceGame: ActionAdventureSample
phase: 7
question: "Are you writing the phase-7 build-gate hook (or any editor script) that does Resources.Load<LudeoSettings>, on plugin 4.3.1.0 or newer?"
sanitized: true
---

# `LudeoSettings` is in `LudeoSDK.UnityScripts`, not `LudeoSDK` — the phase-7 template snippet does not compile as written

The phase-7 build-gate template (`7-upload-build.md` step 2) opens with:

```csharp
using UnityEditor; using UnityEditor.Build; using UnityEditor.Build.Reporting; using UnityEngine; using LudeoSDK;
...
var s = Resources.Load<LudeoSettings>("LudeoSettings");
```

On plugin **4.3.1.0** that fails:

```
error CS0246: The type or namespace name 'LudeoSettings' could not be found
```

`LudeoSettings` is declared in **`LudeoSDK.UnityScripts`**
(`Runtime/UnityScripts/LudeoSettings.cs`), not in `LudeoSDK`. The fix is one line:

```csharp
using LudeoSDK.UnityScripts;   // NOT using LudeoSDK;
```

The fields the gate reads — `apiKey`, `runWithoutLauncher`, `autoStartInLudeo` — are `public`, so no
reflection or accessor work is needed once the namespace is right. (`sdkVersion` is `internal`, so do not
try to log it from the hook.)

## Why it is worth recording rather than just fixing

- The skill is **pinned to the 4.3.0 API** while integrations install the latest release, so its inline
  snippets are a version snapshot, not the authority. This is the second place that drift has shown up.
- It costs a full build/compile cycle to discover, and in an **editor-only** file it is easy to miss
  entirely: Unity's generated `Assembly-CSharp-Editor.csproj` does not list a newly-created file, so a
  `dotnet build` of that csproj reports **0 errors while never compiling the new script**. You get a false
  green. Add the `<Compile Include>` entry (or let Unity regenerate and compile) before believing it.
- The general rule the skill already states applies here concretely: **verify SDK signatures against the
  installed package**, not against the pinned docs. `grep -rn "class LudeoSettings" --include=*.cs
  <package-path>` then read the enclosing `namespace` line — two commands, and it settles it.

Related: [[native-core-version-differs-from-plugin-version]] — the same "installed package is not the
documented package" theme, on the version banner instead of a namespace.
