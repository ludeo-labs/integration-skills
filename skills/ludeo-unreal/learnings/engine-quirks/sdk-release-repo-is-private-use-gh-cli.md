---
category: engine-quirks
tier: universal
sourceGame: TacticsGame
phase: 1
question: null
sanitized: true
---

# SDK plugin release repo is private — anonymous download URLs 404; use authenticated gh CLI

## The Mistake

Used the literal `downloadUrl` from `config/sdk-sources.json` with anonymous
`curl -L <url>` to fetch the LudeoUESDK release zip. The download failed with
HTTP 404 even though the release and asset exist.

## Why

The plugin repo (`EdgeGamingGG/ludeosdk-unreal-plugin`) is **private**. GitHub
returns 404 (not 401/403) for unauthenticated requests against private release
assets, which misleadingly looks like "asset renamed or release deleted."

## The Fix

Use the authenticated GitHub CLI, exactly as the `ghDownload` field in
`sdk-sources.json` suggests:

```powershell
gh auth status                       # verify an authenticated account first
gh release list -R EdgeGamingGG/ludeosdk-unreal-plugin --limit 10
gh release download <tag> -R EdgeGamingGG/ludeosdk-unreal-plugin -p "*.zip" -D <dest> --clobber
```

## Prevention

- Treat a 404 on the raw `downloadUrl` as "probably auth," not "probably gone" —
  check `gh release list` before concluding anything about the release.
- Prefer the `ghDownload` command from `sdk-sources.json` as the FIRST acquisition
  path; the raw URL only works for public repos.
- If `gh` is not installed/authenticated, that is a Stage 0 environment blocker to
  surface to the human, not something to work around.
