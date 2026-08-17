---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,7"
question: "Is a captured moment unplayable, or does it show the wrong thing, while every signal you can reach says the capture succeeded? Before explaining WHY the wrong content was captured, open the video and confirm the recorder was capturing anything at all — a dead recorder produces a full-length, correctly-sized, cleanly-uploaded clip of one still frame."
sanitized: true
---

# A moment that uploaded cleanly can still be sixty seconds of one frozen frame

The integrator reported that finishing a boss fight produced moments that could not be turned into a
playable Ludeo. Every instrument that could be reached said the capture had worked:

- the mark call succeeded, repeatedly;
- the SDK logged `onCaptureVideoRequest` with a clean 60000ms window for each one;
- it logged `Sending video data … 39101518 bytes` and `Finished uploading video data`;
- the upload websocket closed `graceful=true`;
- the backend logged each moment `status transitioned from 'in_progress' to 'ready'`;
- every `video.mp4` returned HTTP 200.

Two separate explanations were offered from that evidence — first that the capture room had closed
early, then that the 60-second window had scrolled past the fight into menu time. Both were wrong,
and both were constructed **without opening a single video file**, which had been sitting on disk the
whole time.

Every clip was **one still frame held for the full minute**. The recorder had stopped taking new
frames from the game window minutes earlier and never recovered. Everything downstream of the frame
source was perfectly healthy, which is exactly why every signal was green.

## The rule

**When a moment is wrong, the video file is the primary artifact. Open it first.** Not the logs, not
the backend status, not the byte count — those all describe the pipeline *around* the recorder, and
that pipeline stays green when the recorder dies. A derived signal cannot report a defect that lives
upstream of it.

The byte count deserves specific suspicion. The encoder is constant-bitrate, so a still frame fills
the same budget as a firefight — around `bitrate × duration` either way. **File size tells you the
encoder ran, never that it had anything to encode.** Uniform sizes across a batch of clips are, if
anything, a mild warning sign; genuine gameplay varies.

## How to check it, and the distinction that matters

`ffmpeg`'s `freezedetect` filter answers this in one command and needs no eyeballing:

```
ffmpeg -hide_banner -i clip.mp4 -vf freezedetect=n=-60dB:d=2 -map 0:v:0 -f null - 2>&1 \
  | grep freeze
```

Read the output carefully, because **two very different things both report as "frozen":**

| Output | Meaning | Verdict |
|---|---|---|
| `freeze_start: 0` and **no** `freeze_end` | the recorder was already dead before the clip window opened | **the defect** |
| `freeze_start` late, each with a matching `freeze_end` | the player sat in a full-screen menu and the recorder faithfully recorded a still screen, then resumed | **healthy — do not report this** |

That second row is not a technicality. A game with any full-screen upgrade/inventory/shop screen will
produce clips containing multi-second still stretches as a matter of course, and a checker that flags
them will cry wolf on every capture. The signature of the real defect is the freeze that **never
ends**.

## Do not stop at the first correlated event

Once the freeze was confirmed, the session log offered a tempting culprit: a session websocket had
died with `ec='stream truncated'` inside the window where the freeze must have begun. It was the only
discontinuity in the log, and it read as causal.

It was not. A later session dropped the same sockets twice and produced clean clips, and a clip
captured while a full-screen menu was open showed freezes that all recovered. **Both candidate
triggers died to a control session** — the same build, playing normally, capturing repeatedly, with
no recurrence.

For an intermittent fault, a clean control run is worth more than another look at the failing log. It
is what separates "our integration did this" from "the SDK did this", and it is the evidence that
makes an escalation credible instead of speculative. Run one before you write the escalation.

## Bound the onset before you explain it

The freeze's start time was initially recorded as unknowable. It was not — it just needed clips
nobody had checked. Each clip is a rolling window ending at its capture, so:

- a clip with **no** freeze proves the recorder was alive through its whole window;
- a clip frozen from `t=0` proves it was already dead when that window opened.

Two such clips bracket the onset. Doing that narrowed "unknown" to an eighteen-minute window, which
was enough to test — and kill — both proposed triggers. **Bound the failure in time before theorising
about its cause**; the bracket usually refutes the first theory for free.

## Build the check into the loop

This defect is invisible to a human who does not sit through a minute of every clip, so it will be
missed unless something checks automatically. A small script that walks the SDK's own capture log,
fetches each clip, and classifies it *clean / static-UI / dead-recorder* — exiting non-zero on the
last — turns "did the recorder die again?" from an hour of watching into one command. Given the fault
is intermittent, catching the *next* occurrence with good instrumentation is usually the only path to
a root cause.
