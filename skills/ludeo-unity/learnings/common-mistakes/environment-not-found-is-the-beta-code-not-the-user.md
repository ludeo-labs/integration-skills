---
category: common-mistakes
tier: generalizable
sourceGame: IdleSample
phase: "1,3"
question: "Did Activate return InvalidAuth on a local run with runWithoutLauncher = true, launcherUserId and betaVersion set? Read the SDK's Http lines before touching code: a 404 'Environment not found' from the users/auth call appears to mean no Studio Lab environment matches that beta code for this API key."
sanitized: true
---

# `InvalidAuth` with "Environment not found" is the beta code, not the user or the code

A local no-launcher run (`runWithoutLauncher = true`, a store user id in `launcherUserId`, a branch name
in `betaVersion`) came back `Activate: InvalidAuth`. The layer fell back correctly, but `InvalidAuth`
reads like a bad user or key, and the SDK's summary line doesn't say which.

The SDK logs the actual exchange at `Http:` level, a few lines above the summary:

```
Http:Log   POST …/api/v3/users/auth, data={"hashAuthSourceUserId":"<masked>","betaCode":"<betaVersion>",…}
Http:Error Reply Code=404, Body={"statusCode":404,"message":"Environment not found"}
Http:Error … Reply Code=401, Body={"message":"Unauthorized: Token missing"}
Core:Error ludeo_Session_Activate failed with LudeoResult::InvalidAuth
```

The 401 afterwards is a consequence, not the cause. **The 404 is the answer:** read from these Http lines
(inferred, not confirmed by Ludeo), the server found no environment for this game whose beta-branch
setting equals the `betaCode` sent. The user id was apparently not the failing step. Nothing in the
integration code could fix it.

## The check

1. Grep the log for `users/auth` and read the reply code and body on the next `Http:` line.
2. `Environment not found`: in Studio Lab, confirm an environment exists for the game the `apiKey`
   belongs to, and that its beta-branch name matches `betaVersion` **exactly** (case included). Either
   create the environment or change `betaVersion` to the configured name.
3. Only once that returns 200 does the user's creator invite matter; that failure has its own reply.
4. Mask the user id and the API key when you quote these lines to anyone.

Related: [[check-the-setup-chain-before-debugging-code]].
