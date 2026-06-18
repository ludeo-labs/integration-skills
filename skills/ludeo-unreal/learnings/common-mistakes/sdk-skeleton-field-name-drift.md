---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 2
question: "For every SDK struct/method used in generated code, has the field name and signature been verified against the current SDK headers (Plugins/LudeoUESDK/Source/LudeoUESDK/Public/)?"
sanitized: true
---

# Reference File Skeletons Can Drift Behind SDK Releases

## The Mistake

Copying SDK code from a reference file skeleton without verifying the struct field names against the actual SDK headers. The skill's reference files are written against a snapshot of the SDK and can silently drift when the SDK evolves.

In FPSGameStarterKit, `references/phase-02-lifecycle.md` Section 5.3 had this skeleton:

```cpp
ActivateParams.AuthenticationDetails.SteamAuthID = SteamAuthID;  // WRONG field name
ActivateParams.BetaBranchName = BetaBranch;                       // WRONG struct
```

The agent copied it verbatim. The real SDK API is:

```cpp
FLudeoSessionSteamAuthenticationData SteamAuth;
SteamAuth.AuthenticationID = SteamAuthID;   // field is AuthenticationID, not SteamAuthID
SteamAuth.BetaBranchName   = BetaBranch;    // nested in the auth struct
ActivateParams.AuthenticationDetails = SteamAuth;
```

The skeleton had the concept right (use explicit Steam auth, resolve from CLI/env/config) but the field names and struct nesting wrong. The agent had no signal that the skeleton was stale — it compiled against an older SDK header but not the current one.

## Correct Behavior

Phase 2 Section 5 now opens with a required SDK header verification step:

> **Before using any SDK struct, enum, or method from the snippets in this section, `Grep` the SDK headers under `Plugins/LudeoUESDK/Source/LudeoUESDK/Public/` for the exact type name. Confirm field names and method signatures match the current SDK version. If a header says one thing and this reference says another, trust the header.**

This applies to every code block in Section 5, not just ActivateSession. The reference file is a starting point for structure and intent, not a source of truth for API signatures.

## Prevention

- Any time the skill writes SDK-calling code, grep the SDK headers first for the struct/method.
- When a drift is found, update the reference file AND capture a new learning documenting the old vs new signature.
- The Lyra integration spec (`LUDEO_UE_INTEGRATION_SPEC.md`) is a secondary source of truth — Lyra's integration is actively maintained and catches drift early.
- `config/sdk-sources.json` is deliberately NOT version-pinned — the user prefers "grep headers each time" over pinning a snapshot that would itself drift.
