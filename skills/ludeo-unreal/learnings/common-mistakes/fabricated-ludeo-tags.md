---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 1
question: null
sanitized: true
---

Do not include `Config/Tags/LudeoTags.ini` in the plugin structure. The Ludeo SDK does not use custom gameplay tags via ini files. This was fabricated in the Lyra integration and flagged by the reviewer. Only include files that correspond to real SDK concepts.
