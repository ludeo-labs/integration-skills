---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

`FLudeoSessionActivateSessionParameters::GameVersion` is required by the SDK. If empty, activation fails with `"params.gameVersion can't be nulled or an empty string"`. Set it to `FApp::GetBuildVersion()` alongside the API key.

**Rule:** The implementation skeleton must populate ALL required fields on `FLudeoSessionActivateSessionParameters`: `ApiKey`, `GameVersion`, `GameWindowHandle`, and `AuthenticationDetails` (when explicit auth is needed). These are not optional.
