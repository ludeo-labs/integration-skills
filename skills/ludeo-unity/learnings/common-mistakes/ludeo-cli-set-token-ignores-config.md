---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: 7
question: "Does the machine already hold a Ludeo CLI token for another game (the integrator works on several titles)?"
sanitized: true
---

# `ludeo auth set-token` ignores `--config` — it overwrites the saved token

To keep a second game's token apart, `ludeo --config <other.json> auth set-token ...` was used. The CLI (v1.6.2)
wrote the token into the default `~/.ludeo/config.json` anyway ("Config saved to: ...config.json") and never created
the other file, replacing the first game's token. Tokens are bound to one game version, so the first game's uploads
then target the wrong game until its token is set again.

- Before `set-token`, check `ludeo auth status`; if a token for another game is saved, tell the integrator it will be
  replaced (they can re-set it from Studio Labs later).
- `ludeo builds list` shows `Using Game ID from access token: <id>` — confirm it is the intended game before a
  dry-run. That id is the **game version** id; the Studio Labs environment id (for `builds assign --env-id`) is a
  different value.
- Never type the token for the integrator; give them a one-line command or a tiny `.bat` that prompts for it.
