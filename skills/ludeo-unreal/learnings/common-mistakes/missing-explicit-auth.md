---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 2
question: "Does the game run with Steam initialized at activation time? If not (e.g., editor, standalone, or sample projects), explicit Steam authentication is required."
sanitized: true
---

The SDK's implicit authentication requires `SteamAPI_Init()` to have been called before `Session->Activate()`. Many games — especially sample projects, editor-only setups, or games that initialize Steam late — will fail implicit auth with `"SteamClient() failed. SteamAPI_Init() possibly not called yet?"`.

The fix is explicit authentication via `FLudeoSessionSteamAuthenticationData` with the user's Steam ID. The Steam ID should be resolved the same way as the API key: command line (`-SteamAuthID=`) → env var (`STEAM_AUTH_ID`) → config (`DefaultGame.ini`).

**Rule:** The `ActivateSession()` skeleton must include explicit auth resolution code. Do not rely on implicit auth working — always provide a fallback path via explicit auth when a Steam ID is available.

```cpp
FString SteamAuthID;
if (!FParse::Value(FCommandLine::Get(), TEXT("-SteamAuthID="), SteamAuthID))
    SteamAuthID = FPlatformMisc::GetEnvironmentVariable(TEXT("STEAM_AUTH_ID"));
if (SteamAuthID.IsEmpty())
    GConfig->GetString(TEXT("/Script/LudeoUESDK.LudeoSettings"), TEXT("SteamAuthID"), SteamAuthID, GGameIni);

if (!SteamAuthID.IsEmpty())
{
    FLudeoSessionSteamAuthenticationData SteamAuth;
    SteamAuth.AuthenticationID = SteamAuthID;
    // Also resolve BetaBranchName from command line → env var → config
    ActivateParams.AuthenticationDetails = SteamAuth;
}
```
