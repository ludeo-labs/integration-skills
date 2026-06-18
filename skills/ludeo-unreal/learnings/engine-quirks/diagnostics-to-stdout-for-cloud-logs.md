---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 6
question: "Do you need integration diagnostics from a Ludeo cloud/cast run (not just local PIE)? If so, are your diagnostic lines written to stdout (printf + fflush), or only to UE_LOG / OutputDebugString — the latter may never reach the durable central log store."
sanitized: true
---
# Get cloud diagnostics into the platform log pipeline by writing to stdout, not just UE_LOG

## Precondition
You are diagnosing an integration on a Ludeo **cloud / cast** run — the game runs headless on a
cloud VM (under Wine), not in local PIE or packaged on your own machine. Locally every logging
channel is readable from one place, so this distinction never bites; on the cloud the channels
diverge and most of them are lost when the VM recycles.

## The trap
On the cast VM the logging channels do **not** all reach the same place:

- **`UE_LOG`** goes to the UE log file on the VM's disk.
- **`FPlatformMisc::LowLevelOutputDebugStringf` / `OutputDebugString`** under Wine lands only in a
  **VM-local** capture file (e.g. the per-instance game log). That disk dies with the instance.
- The platform's **central, durable log collector ingests the process's `stdout`.**

So a marker emitted only via `UE_LOG` or `OutputDebugString` can be completely **absent from the
central log store** — observed empirically: diagnostic markers showed up centrally only once they
were also written to `stdout`. The failure mode is insidious: your diagnostics look fine when you
SSH/fetch the live VM, but you are racing the VM's lifetime, and once it recycles the evidence is
gone — and it was never in the central store you'd normally search.

## What to do
Mirror each diagnostic line to `stdout` and flush it, in addition to whatever UE logging you do:

```cpp
void Diag(const FString& Message)
{
    UE_LOG(LogYourIntegration, Log, TEXT("[Diag] %s"), *Message);   // local UE log file
    printf("[Diag] %s\n", TCHAR_TO_UTF8(*Message));                  // -> central collector
    fflush(stdout);                                                  // don't let it buffer past a crash
}
```

- Keep a fixed, grep-able prefix so the trace is trivial to isolate in the central store.
- `fflush` matters: an unflushed buffer is lost if the process is killed (exactly when you most
  want the trace).

## Keep it a diagnostic, not a fixture
This is debugging scaffolding, not a permanent part of the integration. Once the issue is
resolved, strip the `stdout` mirror (or downgrade the genuinely-useful lifecycle markers to plain
`UE_LOG`). Verbose SDK-side logging belongs behind an env toggle (so it can be flipped on a cloud
run without a recook), not shipped on. Leaving a `printf`-to-stdout firehose in a release build is
noise; the value is knowing the technique exists the moment a cloud-only mystery appears.
