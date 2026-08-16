---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: 3
question: "Is the Ludeo layer being placed in a namespace nested under the game's root namespace? If so, grep that root for types shadowing common framework names (`MonoBehaviour`, `Environment`, `Object`, `Random`, `Time`, `Debug`, `Input`) — the bare name resolves to the game's, not the framework's."
sanitized: true
---

# A layer namespaced under the game's root binds to the game's shadowing types, not the framework's

The integration layer was written as `namespace GameRoot.LudeoIntegration`, with the runtime
behaviour declared the ordinary way:

```csharp
public class LudeoRuntimeBehaviour : MonoBehaviour
```

The game also defines, in its root namespace:

```csharp
namespace GameRoot
{
    public class MonoBehaviour : UnityEngine.MonoBehaviour
    {
        public virtual void OnDestroy() => ResourceManager.Release(this);
    }
}
```

C# name resolution walks **outward** through enclosing namespaces before it consults `using`
directives. From inside `GameRoot.LudeoIntegration`, the unqualified `MonoBehaviour` therefore
binds to **`GameRoot.MonoBehaviour`**, not `UnityEngine.MonoBehaviour` — even with
`using UnityEngine;` at the top of the file.

## Why it is easy to miss

It **compiles and it runs**. The game's base derives from `UnityEngine.MonoBehaviour`, so every
Unity message still works and nothing visibly breaks. The layer had quietly acquired a
dependency on a game class it was explicitly designed not to depend on, plus that class's
`OnDestroy` behaviour (here, releasing the object through the game's resource manager — wrong
for a Ludeo-owned object that must outlive scenes).

The only signal was **one warning** in a log carrying thousands:

```
warning CS0114: 'LudeoRuntimeBehaviour.OnDestroy()' hides inherited member
'MonoBehaviour.OnDestroy()'. To make the current member override that implementation,
add the override keyword. Otherwise add the new keyword.
```

That warning is the tell. `UnityEngine.MonoBehaviour` declares **no** virtual `OnDestroy` — Unity
messages are dispatched by name, not by override. **So CS0114 on a Unity message method is proof
you are not deriving from the type you think you are.**

## The rule

- **Qualify the base type explicitly** in every layer MonoBehaviour: `: UnityEngine.MonoBehaviour`.
  One token, and it makes the intent unmissable to a reviewer.
- **Before writing the layer, grep the game for shadowing declarations.** In the observed project
  this bit **twice**: `MonoBehaviour` (a base class, caught via CS0114) and — later, in a new file —
  `Environment`, where the game declares a gameplay `Environment` class and
  `System.Environment.GetCommandLineArgs()` failed to resolve with
  `CS0117: 'Environment' does not contain a definition for 'GetCommandLineArgs'`. That second one is
  the more common shape: a **hard compile error naming a member you know exists**, which reads like a
  missing `using` and is actually the wrong type entirely.

  Run this once before writing the layer, and treat every hit as a name to fully qualify:
  ```
  grep -rnE "(class|struct|enum) (MonoBehaviour|Environment|Object|Random|Debug|Time|Input|Application|Screen|Camera)\b" --include=*.cs Assets/
  ```
  Games shadow these names routinely — they are natural gameplay nouns. `Random` and `Time` shadows
  are the quietest, because they usually still compile.
- **Or side-step it entirely**: give the layer a namespace that is *not* nested under the game's
  root. That trades one class of surprise for a longer `using` list; qualifying the base type is
  usually enough.
- **Grep the compile log for warnings whose path is inside the layer folder**, not just for
  `error CS`. In a codebase with ~13,500 warnings the layer's own contribution is the only slice
  that is actionable, and it isolates in one command:
  `grep -oE "Assets[/\\]Ludeo[^ ]*: warning CS[0-9]+: .*" "$LOG" | sort -u`.
  Target zero warnings from layer files — the surrounding noise floor makes anything else
  unreviewable.

Related: [[agent-can-run-unity-compile-gates-headlessly]] — this was caught by the headless
compile gate, from a warning, which is exactly the half of the gate the agent can run itself.
