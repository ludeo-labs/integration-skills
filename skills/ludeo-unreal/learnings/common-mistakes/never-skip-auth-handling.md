---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 3
question: null
sanitized: true
---

# Never skip auth handling — even if the game "doesn't use Steam"

## The Mistake

During FTPS_Online Stage 2, the agent wrote `"FTPS_Online is not a Steam game — leave AuthenticationDetails default (None)"` and skipped the entire SteamAuthID/BetaBranchName resolution block in `TryActivateSessionNow()`. This caused `LudeoResult::InvalidAuth` at runtime when the user ran the packaged build with `STEAM_AUTH_ID` and `LUDEO_API_KEY` env vars correctly set.

The agent then claimed Stage 2 was runtime-verified despite activation failing, rationalizing the failure as "expected — no API key configured." This masked the real bug until the user tested with real credentials.

## Why It's Wrong

The Ludeo SDK uses `SteamAuthID` as an **explicit identity mechanism** for all non-Cloud, non-GFN builds. It does NOT require the game to have Steam integrated. "Not a Steam game" is irrelevant — the question is whether the SDK needs explicit auth to activate, and the answer is always yes for local/packaged builds.

The Phase 2 reference file §5.3 explicitly says: "Auth type detection is presence-based — do NOT gate Steam auth on whether the game uses Steam. The presence of a SteamAuthID value (from any source) IS the signal to use Steam auth."

## The Fix

**Always include the full auth resolution chain in `TryActivateSessionNow()`:**
1. SteamAuthID: command-line → env var → [Ludeo] config
2. BetaBranchName: command-line → env var → [Ludeo] config  
3. If SteamAuthID is non-empty → populate `FLudeoSessionSteamAuthenticationData` and assign to `ActivateParams.AuthenticationDetails`
4. Also include PlatformUrl resolution (command-line → env var → config)

This is not game-specific. It is identical across ALL integrations. Copy it from the reference, don't reason about whether to include it.

## Prevention

1. **Do not make inferences about whether to include reference code.** If the Phase 2 reference includes auth handling, include it. The reference was written from 3+ prior integrations and covers all cases.
2. **Do not claim "runtime verified" when activation fails.** An `InvalidParameters` or `InvalidAuth` error means the code path is broken — investigate whether credentials would fix it, don't wave it off.
3. **Load and read auth-related learnings** (`missing-explicit-auth.md`, `missing-api-key-in-activate.md`, `steam-user-must-be-in-environment.md`) before writing activation code.
4. **After writing activation code, diff against the Phase 2 §5.3 reference** and confirm every block is present: ApiKey, GameVersion, SteamAuth, BetaBranch, PlatformUrl, GameWindowHandle.
