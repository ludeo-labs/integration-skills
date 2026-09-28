---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "1,2,3,4,5,7"
question: "Has a step failed with no clear error — no overlay, no room, no capture, a sign-in failure, a hang — above all before the first capture has ever worked end to end? Then check the setup chain below before opening any code."
sanitized: true
---

# Check the setup chain before debugging code

Seeing the Ludeo overlay for the first time depends on a chain of settings spread across several
systems, and a single missed link fails silently or with a symptom that points somewhere else. On a
large integration a lot of early-phase time went to exactly this: one missed setup step, debugged as
if it were a bug in the code just written. The integrator's own recollection was that one step in the
multi-step setup is very easy to miss, and that each miss cost far more time than checking would have.

## The chain, with the symptom each link produces when it is wrong

| Link | Symptom when it is wrong |
|---|---|
| API key, backend environment and game version in the SDK settings asset | activation or session errors, or capture data landing under the wrong game or version |
| Run-without-launcher, for any run not started by the Ludeo launcher | no overlay; `userToken returned is null!`, then activate failing — while the log still reports the overlay as enabled |
| The integration's own "start the SDK in play mode" toggle, if it added one | nothing at all: the game plays normally and the log has no SDK lines — see [[an-off-by-default-play-mode-toggle-makes-the-sdk-silently-absent]] |
| Studio Lab configuration for the game and the environment in use | a room that never opens although the code path runs; on one practice integration this was an entitlement present in one backend environment and missing in the other |
| The CLI's active login | uploads and build listings that belong to another game — see [[ludeo-cli-set-token-ignores-config]] |
| Scripting defines left behind by a cloud-build configuration | the Editor boots as a cloud build and hangs on the loading screen — see [[the-cloud-build-is-a-second-configuration-not-a-modified-one]] |

## The habit

1. **Keep this list in the integration's notes from phase 1**, extended with anything project-specific,
   and **run it first** whenever a step fails without a clear error. Say which links you checked, and
   how, before proposing a code cause.
2. **Read the actual value; don't infer it.** Several of these settings are binary-serialized or live in
   Editor preferences. Read them through the Editor or the SDK's own API, not by grepping a file.
3. **Fold the checks into whatever starts a test run**, so the chain is asserted every time instead of
   remembered: a one-call setup helper that checks and repairs these settings and refuses to start a run
   that cannot work.
4. **Treat "no SDK lines at all" as a setup problem first.** If activation never appears in the log,
   nothing downstream can appear either.

## Why it matters most in phases 1–4

Before the first capture has worked end to end there is no known-good baseline to compare against, so
every missing link looks like a new defect in freshly written code. Once the chain has worked once, a
regression is easier to spot. Before that, the checklist is the only baseline there is.
