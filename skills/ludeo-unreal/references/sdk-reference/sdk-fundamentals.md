# Ludeo SDK Fundamentals (Conceptual)

> **Offline fallback.** When `sdk-docs` MCP is available, prefer it. This file explains durable *concepts*, not exact signatures. For exact signatures, grep the installed plugin headers under `Plugins/LudeoUESDK/Source/` — the header always wins over any skeleton here. See `README.md` in this directory.

This skill targets the **LudeoUESDK plugin** (a C++ wrapper over the native Ludeo C SDK). The C-API names below (`ludeo_*`) describe the underlying model; in UE you call the plugin's C++ wrappers. Use these concepts to reason about *what* to call and *when*, then confirm the *how* against the headers.

## Table of Contents

1. [What the SDK does](#1-what-the-sdk-does)
2. [Core concepts](#2-core-concepts)
3. [Lifecycle: session, room, gameplay session](#3-lifecycle-session-room-gameplay-session)
4. [Attributes vs. actions](#4-attributes-vs-actions)
5. [Creator Flow vs. Player Flow](#5-creator-flow-vs-player-flow)
6. [API patterns: handles, sync/async, param structs, results](#6-api-patterns)
7. [Data type mapping](#7-data-type-mapping)
8. [Callback pattern](#8-callback-pattern)
9. [Threading and Tick](#9-threading-and-tick)

---

## 1. What the SDK does

Ludeo lets a game capture **playable moments** — game states that can be captured during gameplay (Creator Flow), stored as "Ludeos" on the platform, shared, and later restored for playback (Player Flow). Restoration is **snapshot-restore**: the SDK puts game state back to a captured snapshot and the game resumes its own logic from there. There is no frame-by-frame replay, no input playback, no puppet mode.

---

## 2. Core concepts

- **LudeoObjectId** — a unique `uint64` identifier for each tracked game object within a Ludeo. Used to organize an object's attributes. (In the UE wrapper you typically work with writable/readable object handles rather than raw IDs.)
- **Attribute** — a named, typed property of an object (`"health"`, `"position"`). Identified by **string name**, not by ID. Written via the DataWriter during capture, read via the DataReader during restore.
- **Action** — a discrete gameplay event that fires once at a moment in time (`"Kill"`, `"PickupCollected"`). Distinct from continuous state. Actions drive Ludeo objectives and scoring.
- **DataWriter** — the capture-side interface. Writes object attributes to the platform during a gameplay session. Obtained from the room.
- **DataReader** — the restore-side interface. Reads a captured snapshot back. Obtained when a Ludeo is fetched/selected.

---

## 3. Lifecycle: session, room, gameplay session

Three nested scopes, longest-lived first:

| Scope | Lifetime | Mental model |
|-------|----------|--------------|
| **Game Session** | Activated once when the game/SDK comes up; released at shutdown | "The SDK is running" |
| **Room** | One per gameplay instance (a match/level). **Stays open for the entire match.** | "This match is being recorded" |
| **Gameplay Session** | One per player within a room | "This player's slice of the match" |

**A Room is NOT a Highlight.** A Room is a long-running recording session that stays open for the whole match; highlights are extracted *within* an open room. Do **not** open/close a room per highlight. (This is the single most common conceptual error — see SKILL.md "Key SDK Concepts".)

Rough call ordering (names are conceptual — confirm against headers):
- Activate the session once: `ludeo_Session_Activate` (async).
- Open a room when gameplay starts: `ludeo_Session_OpenRoom` (async) → gives you the **DataWriter**.
- Add the player(s): `ludeo_Room_AddPlayer` (async) → gives a gameplay session.
- Begin/End gameplay around the playable window: `ludeo_GameplaySession_Begin` / `_End`.
- Close the room when the match ends: `ludeo_Room_Close`.
- Fetch a captured Ludeo for restore: `ludeo_Session_GetLudeo` → gives the **DataReader**.

---

## 4. Attributes vs. actions

```
Attributes = continuous state    →  Write/Read each value (health, position, ammo)
Actions    = discrete events     →  Fire once when the event happens (Kill, Collect)
```

Use attributes for "what is the state right now". Use actions for "this just happened". A common mistake is encoding a moment-in-time event as a polled boolean attribute (or vice versa). Actions carry semantic meaning the platform uses for objectives/scoring; attributes reconstruct the world.

---

## 5. Creator Flow vs. Player Flow

- **Creator Flow (capture):** normal gameplay. The integration writes object attributes via the DataWriter and reports actions as they fire.
- **Player Flow (restore):** the SDK provides a DataReader holding a snapshot. The integration reads attributes back and applies them to the (re)spawned game objects, then the game resumes naturally.

Critical guard rule the skill enforces: **state writing is Creator-only** (`CreateWritableObjects`/`UpdateWritableObjects` are guarded by `bIsPlayerFlow`), but **action listeners and entity tracking must run in BOTH flows** (kill detection, spawn tracking, action reporting must NOT be guarded out of Player Flow). See SKILL.md "`bIsPlayerFlow` audit".

**LudeoSelected** can fire at any time (menu, gameplay, loading). On selection the game must interrupt, load the right level, restore from the DataReader, and pause for player input.

---

## 6. API patterns

- **Opaque handles.** The SDK exposes opaque handle types (session, room, gameplay session, data writer, data reader). They're created by the SDK, passed to subsequent calls, and released when done. Always null-check a handle before use.
- **Synchronous vs. asynchronous.** Setters/getters (`SetFloat`, `EnterObject`) and `ludeo_Tick` return immediately. Lifecycle operations (`Session_Activate`, `OpenRoom`, `AddPlayer`, `GameplaySession_Begin/End`, `Room_Close`, `GetLudeo`) are **async** — they return immediately and signal completion via a **callback**. Never assume an async op finished on return.
- **Versioned parameter structs.** Operations take a params struct whose `apiVersion`/`API_LATEST` field MUST be set. Field names vary by version — confirm against the header.
- **Result codes.** Operations return a `LudeoResult` (`Success == 0`, plus error variants). Always check it, including inside callbacks.

---

## 7. Data type mapping

The SDK is typed. Conceptual correspondence (confirm exact wrapper method names in the headers):

| C++ type | Set | Get | Notes |
|----------|-----|-----|-------|
| `float` | `SetFloat` | `GetFloat` | single precision |
| `int32` | `SetInt32` | `GetInt32` | signed 32-bit |
| `uint32` | `SetUInt32` | `GetUInt32` | unsigned 32-bit |
| `uint64` | `SetUInt64` | `GetUInt64` | IDs / large values |
| `bool` | `SetBool` | `GetBool` | uses `LUDEO_TRUE`/`LUDEO_FALSE` |
| `Vec3` | `SetVec3Float` | `GetVec3Float` | `float[3]` — maps to UE `FVector` |
| `Vec4`/`Quat` | `SetVec4Float` | `GetVec4Float` | `float[4]` — maps to UE `FQuat`/`FRotator` |
| `string` | `SetString` | `GetString` | null-terminated |

The UE wrapper's `FLudeoWritableObject::WriteData` / `FLudeoReadableObject::ReadData` accept UE types (`FVector`, `FRotator`, `FString`, `FTransform`, primitives) directly — prefer those in integration code.

---

## 8. Callback pattern

Async operations report completion through a callback. The universal shape:

1. The callback receives a params struct with a `resultCode` — check it first, log and bail on failure.
2. You pass a `clientData` pointer (commonly `this`) into the async call; cast it back inside the callback to recover your context.
3. In C the callback is a free/static function; the UE wrapper typically exposes delegates you bind instead.

```cpp
// Conceptual — the UE wrapper exposes this as a bound delegate, not a free function.
void OnSessionActivated(const LudeoSessionActivateCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) { /* log + return */ return; }
    auto* manager = static_cast<MyLudeoManager*>(data->clientData);
    manager->bSessionActive = true;
}
```

Common completion callbacks: session activate, open room (gives `dataWriter`), add player (gives gameplay session), begin/end gameplay, close room, get Ludeo (gives `dataReader`), Ludeo selected, player ready.

---

## 9. Threading and Tick

- SDK operations are **not** inherently thread-safe — call them from a consistent thread (the game thread).
- **`ludeo_Tick()` must be called once per frame** on that thread. This is what processes pending callbacks. In UE the plugin's subsystem/manager drives this; if callbacks never fire, a missing per-frame Tick is the first thing to check.
- If the game touches the SDK from worker threads, queue operations and drain the queue during Tick on the game thread.

---

## Key takeaways

1. Attributes are addressed by **string name**, not ID.
2. Async lifecycle ops complete via **callbacks** — never assume completion on return.
3. A **Room spans the whole match**; highlights live inside it. Don't cycle rooms per highlight.
4. Player Flow is **snapshot-restore**, not replay.
5. State writes are **Creator-only**; action/entity tracking runs in **both** flows.
6. For exact signatures, the **plugin headers win** — this file is concepts only.
