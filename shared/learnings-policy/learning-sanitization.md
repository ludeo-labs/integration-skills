# Learning Sanitization

`learnings/` entries are **committed to a public repo**. Before adding or editing one, sanitize it.

## Forbidden in committed learnings

- **Game titles and studio names.** Refer to "the game", "a prior integration", "an FPS", etc.
- **Secrets.** No API keys, tokens, credentials, or internal URLs.
- **Verbatim proprietary code.** Describe the *pattern* and minimal illustrative snippets only.
- **Personal data.** No names, emails, or identifiers of people.

## Required in every learning

- A clear **title** stating the lesson (kebab-case filename, one lesson per file).
- A **precondition**: under what circumstances this applies. A learning without a stated precondition
  is not trustworthy — and a reader must verify the precondition still holds before acting on it.
- The **failure it prevents** or the **better outcome** it produces.

## Process

- **Append-only.** Don't rewrite history; add a new file or a dated note.
- Place the file in the right category (`architecture/`, `common-mistakes/`, `engine-quirks/`,
  `save-systems/`) and assign a tier per [`learning-policy.json`](./learning-policy.json).
- Generalize: a learning should help the **next** integration, not just describe what happened in one.
