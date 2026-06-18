---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

Every type used in a header file must be either included or forward-declared in that header — do not rely on the .cpp file's includes. In Lyra Stage 2, `FGameplayTag` was used in method signatures in `LudeoGameStateComponent.h` but `GameplayTagContainer.h` was only included in the .cpp. The compiler saw `FGameplayTag` as unknown in other translation units that included the header, causing cascading errors.

**Rule:** If a type appears in a method signature, member variable, or base class in a `.h` file, it must be included or forward-declared in that `.h` file. The `.cpp` includes do not help other files that include the header.
