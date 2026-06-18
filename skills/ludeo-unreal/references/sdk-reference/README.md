# SDK Reference (bundled, offline)

This directory is the **offline fallback** for SDK knowledge when the `sdk-docs` MCP server is unavailable. It covers the **durable concepts** of the Ludeo SDK — the session/room lifecycle, the writer/reader model, attributes vs. actions, the callback pattern, and the threading model. These concepts change rarely.

## What this is NOT

It is **not** an authoritative API reference. Exact method signatures, parameter struct field names, enum values, and callback param shapes **drift between SDK versions** and must come from one of these sources, in order of preference:

1. **`sdk-docs` MCP server** — when available, the authoritative, current API reference.
2. **The installed plugin headers** — `Plugins/LudeoUESDK/Source/` in the target game. These are the ground truth for the exact build the project links against. Grep them for the precise field name or signature (e.g. `Params.APIKey` vs `Params.ApiKey`). The SKILL.md "SDK field name drift warning" makes this rule explicit: **when a code skeleton disagrees with the SDK header, the header wins.**

Treat any code in `sdk-fundamentals.md` as illustrative of the *pattern*, not as a copy-paste-correct signature.

## UE plugin vs. native C SDK

This skill targets the **LudeoUESDK plugin**, which is a C++ wrapper over the native Ludeo C SDK. The fundamentals doc shows the underlying C API (`ludeo_DataWriter_SetFloat`, etc.) to explain *how the SDK thinks*, but in UE integration code you call the plugin's C++ wrappers (`FLudeoWritableObject::WriteData(...)`, scoped object guards, the subsystem/component lifecycle). For the wrapper surface, read the plugin headers or query `sdk-docs`.

## Contents

| File | Covers |
|------|--------|
| `sdk-fundamentals.md` | Core concepts: sessions, rooms, DataWriter/DataReader, object IDs, attributes vs. actions, LudeoSelected, handles, sync/async, callbacks, threading/Tick. |
