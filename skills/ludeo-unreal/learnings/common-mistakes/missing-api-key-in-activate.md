---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

The `FLudeoSessionActivateSessionParameters::ApiKey` field MUST be populated before calling `Session->Activate()`. The SDK will fail with `"parameter 'params.apiKey' is null"` if it's empty. The TDD specifies API key resolution order (command-line → env var → config) but the implementation skeleton left `ApiKey` unset.

**Rule:** The implementation guidance in phase-02 must include the API key resolution code directly in the `ActivateSession()` skeleton — not as a comment or TODO, but as actual code:

```cpp
FString ApiKey;
if (!FParse::Value(FCommandLine::Get(), TEXT("-LudeoAPIKey="), ApiKey))
{
    ApiKey = FPlatformMisc::GetEnvironmentVariable(TEXT("LUDEO_API_KEY"));  // gitleaks:allow (reads from env, no secret here)
}
if (ApiKey.IsEmpty())
{
    GConfig->GetString(TEXT("/Script/LudeoUESDK.LudeoSettings"), TEXT("ApiKey"), ApiKey, GGameIni);
}
ActivateParams.ApiKey = ApiKey;
```

This is not optional or a "fill in later" item — it's required for the SDK to function at all.
