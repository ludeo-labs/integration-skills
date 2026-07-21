---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

# Don't hard-code PlatformUrl; leave it empty when unset — and log the resolved activation params

## PlatformUrl: empty is the safe default

Resolve `PlatformUrl` from CLI → env → config and set `ActivateParams.PlatformUrl` **only if
non-empty**. Leave it **empty otherwise** — the C SDK uses its own internal production default when
the field is empty. Do **NOT** hard-code a default string like `"https://services.ludeo.com"`:

```
[Ludeo] Session: Error: Session0: "https://services.ludeo.com" is not a valid url
[Ludeo] Core: Error: ludeo_Session_Activate failed with LudeoResult::InvalidParameters
```

This SDK build rejects an explicit `https://services.ludeo.com` as "not a valid url," even though an
**empty** PlatformUrl activates fine. (The reference sample defaults it to that string and works on
its SDK build — but copying that default onto a different SDK build broke activation. Don't assume a
sample's URL default is portable; empty-unless-provided is the robust choice.)

```cpp
const FString PlatformUrl = ResolveLudeoConfig(TEXT("-LudeoPlatformUrl="), TEXT("LUDEO_PLATFORM_URL"), TEXT("PlatformUrl"));
if (!PlatformUrl.IsEmpty()) { ActivateParams.PlatformUrl = PlatformUrl; } // else leave empty
```

## Always log the resolved activation params

`ludeo_Session_Activate failed with InvalidParameters` is opaque — it names no field. Log exactly what
was resolved right before calling `Activate`, so the failure is self-diagnosing instead of a guessing
game (do NOT theorize about which field is bad — print them):

```cpp
UE_LOG(LogLudeoIntegration, Log,
  TEXT("Activating Ludeo session — ApiKey=%s, GameVersion='%s', PlatformUrl=%s, Auth=%s"),
  ApiKey.IsEmpty() ? TEXT("<EMPTY!>") : TEXT("set"),
  *ActivateParams.GameVersion,
  PlatformUrl.IsEmpty() ? TEXT("<production default>") : *PlatformUrl,
  bExplicitSteamAuth ? TEXT("explicit Steam") : TEXT("<none>"));
```

In the Lyra incident this one line is what turned "activation fails, why?" into "the SDK rejected the
PlatformUrl I just hard-coded" in a single run. Also set `Localization` (`PreferredLangauge="en"` +
one `SupportedLanguageCollection` entry) — the SDK can reject an empty Localization struct.
