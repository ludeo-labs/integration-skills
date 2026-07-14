---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# #define UE_API + MinimalAPI breaks classes without UE_API-prefixed members

Adding `#define UE_API LYRAGAME_API` before a class and `MinimalAPI` to its UCLASS specifier causes compilation errors when the class members don't already use `UE_API` prefixes:

```
error C2065: 'RemainingBotNames': undeclared identifier
error C2143: syntax error: missing ';' before '<class-head>'
```

This pattern only works when the header already follows the Lyra convention of prefixing methods with `UE_API`. Applying it to classes that don't follow this convention (e.g., `ALyraGameSession`, `ULyraBotCreationComponent`) breaks the class declaration.

**Fix:** For classes that don't use the `UE_API` macro pattern, use class-level export instead:

```cpp
// WRONG — breaks if methods aren't prefixed with UE_API:
#define UE_API LYRAGAME_API
UCLASS(MinimalAPI)
class ALyraGameSession : public AGameSession { ... };
#undef UE_API

// CORRECT — exports entire class without requiring per-method prefixes:
UCLASS()
class LYRAGAME_API ULyraGamePhaseSubsystem : public UWorldSubsystem { ... };
```

Class-level export (`class LYRAGAME_API ClassName`) exports all public methods. It's less granular than MinimalAPI + per-method UE_API, but works universally.
