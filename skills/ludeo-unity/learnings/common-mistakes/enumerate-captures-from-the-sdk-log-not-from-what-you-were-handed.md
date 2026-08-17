---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,7"
question: "Are you reasoning about which moments a session captured, from a platform UI list or from a folder of files someone collected for you? Enumerate them from the SDK's own onCaptureVideoRequest lines first — the handed-over set is routinely incomplete, and the missing entries are disproportionately the informative ones."
sanitized: true
---

# Count the session's captures from the SDK log, not from the evidence you were handed

One play session produced **three different answers** to "how many moments did this capture?":

| Source | Count |
|---|---|
| the platform's Moments list, as seen by the integrator | 5 |
| the evidence folder collected from it | 6 |
| the SDK's own log for that session | **8** |

The investigation ran for a day against the folder of six. The two captures that were never
collected turned out to be the only ones that answered the question — they were the earliest of the
session, they were the only clips proving the recorder had been working at all, and checking them
converted "we cannot know when this started" into a bounded window that then refuted the leading
theory. The answer had been sitting in a log everyone had already read, one grep away.

## The rule

**The SDK log is the register of what was actually captured.** Every capture emits one line carrying
*both* ids and a timestamp:

```
VideoEncoderManager: onCaptureVideoRequest. gameplayId=<guid>, highlightId=<guid>, startTime=…
```

Enumerate from that, deduplicated by `highlightId`, before you reason about a session's moments:

```
grep -oE 'onCaptureVideoRequest\. gameplayId=[0-9a-f-]{36}, highlightId=[0-9a-f-]{36}' Editor.log \
  | sort -u
```

Everything downstream of that line can lose entries for reasons that have nothing to do with your
investigation: a UI list pages, filters, or hides moments that never reached `ready`; a moment that
never finished encoding exists as a record with no video; and a person assembling an evidence folder
stops when they have what looks like enough. None of those omissions announce themselves — the folder
does not know it is short.

## Two useful side-effects of enumerating this way

**Both ids arrive together.** The asset path needs the `(gameplayId, highlightId)` pair, and it is a
common waste of time to have one and go hunting for the other. They are on the same line — take them
as a pair and never resolve them separately.

**You get capture times for free**, which is what lets you order the moments against everything else
in the log (state writes, room open/close, errors). A folder of files sorted by name gives you an
order; the log gives you a *timeline*, and the two are not the same thing.

## The generalisation

This is the collection version of a mistake the corpus already records about signals: reasoning from
a derived, downstream view of something when the authoritative record is right there. **A set of
artifacts someone assembled for you is a claim about the evidence, not the evidence.** Before you
conclude anything from a set, check the set is complete against whatever produced it — and be
especially suspicious when the entries you *do* have all agree with each other, since a filtered
sample is exactly what produces false unanimity.
