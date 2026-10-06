---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "1,7"
question: "Are you about to make the game 'cloud-ready' by changing settings, defines or scenes in place? The cloud build and the build players buy want OPPOSITE things — look for the studio's own per-configuration build system and add one more configuration to it instead."
sanitized: true
---

# Cloud-ready is a second build configuration, not a modified first one

Ludeo's cloud guidance reads like a list of removals: no splash screens, no intro videos, no menu,
no store client, no cheats. Applied to *the* build, every one of those is a product change the
studio did not ask for — their players want the logos, need the store client, and the studio wants
its cheats. The two builds want opposite things, and reconciling them in one configuration means
someone eventually ships the wrong half.

**Look for the game's own build configuration system first.** A shipped game usually has one, and it
is usually better than anything you would add: this project had per-platform `ScriptableObject`
configurations, each owning its scripting defines, its Unity `BuildOptions`, its scene list, its
store-platform selection, and its content flags — with about twenty of them already (release, demo,
playtest, per-storefront, per-content-update). Cloud-ready became *one more asset* in that folder.

## What that bought, concretely

| Cloud requirement | Cost, because the system already existed |
| --- | --- |
| No store client | Set the configuration's platform-service field to `None`. Its define map sets **every** store define false, so the removal is complete rather than one-define deep. |
| No cheats, no dev console | Two booleans already on the base configuration. |
| A real release player | `isDevelopment = false` + the release define type, already modelled. |
| Cloud-only code fenced off | One extra define via the configuration's own "additional directives" field. Nothing cloud-specific can reach the consumer build. |
| Same game content | Copy the content-flag mask from the release configuration, so the cloud build has the same content updates the clips were recorded in. |

The whole cloud configuration is one editor method that creates-or-updates the asset — re-runnable,
and the single written-down statement of what makes a build cloud-ready.

## Two details worth stealing

**Assert the configuration at build time; do not trust that the setup method ran.** An
`IPreprocessBuildWithReport` hook reads the **baked** values out of the build report and throws
`BuildFailedException` on any wrong one, so a mis-flagged cloud build cannot even produce an
artifact. Crucially, it **only refuses when the cloud define is among the defines being baked** —
the studio's own configurations are logged and never blocked. A gate that can break a normal build
will be deleted by the studio, and then it protects nothing.

**The SDK settings asset is shared, so flip it for the build's duration only.** Local replay testing
needs the two development shortcuts (authenticate as a fixed user, auto-start a fixed clip) that a
cloud build must not have. Rather than asking the integrator to remember both ways, the build method
sets them, builds, and restores them in a `finally` — so a *failed* build does not leave the local
harness broken. The build-time gate then asserts the shipped values independently.

## When this does not apply

A project with no build configuration system (a single set of Player Settings, built by hand) has
no seam to add to. There, propose one — but say plainly that it is new infrastructure, and expect
the honest answer to be "not now".

Related: [[store-platform-removal-is-layered-not-a-single-fix]] — the same store-client problem
scoped from the *code* side, where it is five fixes rather than one field.
