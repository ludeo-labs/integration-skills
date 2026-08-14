---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
---

# "Moment" is the integrator's word for the thing they mark — never reuse it for the session bracket

The creator marks a highlight while playing (in the observed engagement, a function key on the
overlay). **The SDK does this internally — the game does not call it.** In plugin v4.3.1,
`LudeoPlayer.MarkHighlight(...)` is decorated `[Obsolete("This method is obsolete. LudeoSDK
handles Marking Highlights internally.")]`; what the plugin actually does is receive the
notification and tag the captured video for upload — `PluginCallbacks.onHighlightTakenCallback`
is wired to `HandleMarkHighlight` in the `LudeoPlayer` constructor, and that forwards
`highlightId` + `highlightUrl` to `MediaCaptureService.TagVideoWithUploadData`
(`Runtime/LudeoGameplaySession/LudeoPlayer.cs`, `Runtime/Ludeo/Ludeo_Defs.cs` →
`LudeoSessionHighlightCallbackData`).

> Check this against the installed package before repeating it — an obsolete-marked API is
> exactly the kind of thing that moves between plugin versions.

**That is what "a moment" means to the integrator: the thing they chose by pressing the key.**

Our own vocabulary drifts. Briefs and subagent summaries reach for "moment" as a loose synonym
for the gameplay-session bracket (`OpenRoom`…`CloseRoom`, `BeginGameplay`…`EndGameplay`). Used
in front of the integrator, that silently redefines a word they already own — and it reads as
the agent not understanding the product it is integrating.

## What this looked like

A subagent surfaced a correct, narrow question: on a level→level transition, call
`EndGameplay` or `AbortGameplay`? It phrased it as *"is an intermediate level a finished
moment?"*. The orchestrator relayed it and, trying to make it feel like a product decision,
re-dressed it as **"this decides how many playable clips a run can produce"**.

The integrator's reply:

> *"are you confusing what a moment is? your question make no sense, why are you asking it
> that way? don't I chose moments when I press f9 to capture?"*

They were right on both counts:

1. **The word was hijacked.** They choose moments. The bracket does not.
2. **The added framing was factually wrong.** The platform derives clips from a captured
   stretch; the game does not decide how many. This was written in the engagement's own state
   file — read at the start of that very session — and the question contradicted it.

## The distinction to hold

| Thing | Who decides | What it is |
|---|---|---|
| The marked highlight | **the creator**, live, via the capture key → `MarkHighlight` | the moment |
| The room / gameplay-session bracket | the integration code | the **window** in which marking is possible, and whether the captured stretch is submitted (`EndGameplay`) or discarded (`AbortGameplay`) |
| How many playable clips result | **the platform**, from the captured stretch | not a game-side decision at all |

`EndGameplay` vs `AbortGameplay` is therefore **"keep this capture or throw it away"** — never
"is this a moment", and never "how many clips do we get".

## The rule

- Never use "moment" for the bracket in anything the integrator reads. Say **"the stretch we
  capture"** or **"the window where they can mark"**.
- When a subagent's question contains "moment", treat it as a **defect in the question** and
  re-derive what is actually being asked before relaying it.
- Before framing anything as a product decision, check the framing against the glossary and
  state file you already have. Product-sounding language invented to justify a question is how
  a wrong claim gets laundered into a decision the integrator is asked to make.

Related: [[write-for-the-integrator-not-for-the-skill]] — same failure, inverted. That learning
warns against making the reader decode *our* jargon. This one is the mirror image: taking
*their* word and quietly giving it our meaning. Also [[verify-a-relayed-question-before-asking-it]].
