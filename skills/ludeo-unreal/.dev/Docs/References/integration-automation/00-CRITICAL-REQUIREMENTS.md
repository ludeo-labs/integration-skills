> **UE CAVEAT:** CR-001 (macro-based conditional compilation via `#ifdef LUDEO_SDK_ENABLED`) does **not** apply to Unreal Engine. UE uses plugin architecture — all Ludeo code lives in a separate plugin that is enabled/disabled as a unit. CR-002 through CR-008 are universally applicable.

---

# 🚨 CRITICAL REQUIREMENTS - Ludeo SDK Integration

> **⚠️ These requirements are MANDATORY for a working integration**
>
> Violating these will result in integration failure, crashes, or completely broken functionality.

**Last Updated:** December 2025  
**Applies to:** All Ludeo SDK integrations

---

## ⚠️ **CRITICAL REQUIREMENTS (Integration Will Not Work Without These)**

### 🔴 **CR-001: Macro-Based Conditional Compilation is MANDATORY**

**ALL** Ludeo SDK integration code **MUST** be wrapped with conditional compilation macros.

**Why:** 
- Allows SDK to be disabled for non-Ludeo builds
- Keeps codebase clean when SDK is disabled
- Prevents compilation errors when SDK is not present

**Required:**
```cpp
#if LUDEO_SDK_ENABLED
    #include <Ludeo/DataWriter.h>
    // SDK code here
#endif

// In game code - use capture macros
LUDEO_CAPTURE_FLOAT(this, "entity", "health", newHealth);
// This macro becomes a no-op when SDK disabled
```

**Forbidden:**
```cpp
// ❌ NEVER do this - pollutes code when SDK disabled
#include <Ludeo/DataWriter.h>  // No guard!
ludeo_DataWriter_SetFloat("health", health);  // No guard!
```

**Validation:**
- [ ] Project compiles with `LUDEO_SDK_ENABLED=1`
- [ ] Project compiles with `LUDEO_SDK_ENABLED=0`
- [ ] No SDK code present in binaries when disabled

---

### 🔴 **CR-002: Context Stack MUST Be Managed Properly**

Always pair `EnterObject` with `LeaveObject`. Use RAII helpers.

**Required:**
```cpp
ludeo_DataWriter_SetCurrent(writer);
if (ludeo_DataWriter_EnterObject(objectId)) {
    ludeo_DataWriter_SetFloat("health", health);
    ludeo_DataWriter_LeaveObject();  // ✅ ALWAYS LEAVE!
}

// Better: Use RAII helper
{
    LudeoCapture::ObjectScope scope(objectId);
    if (scope.IsEntered()) {
        ludeo_DataWriter_SetFloat("health", health);
        // Automatic cleanup
    }
}
```

**Forbidden:**
```cpp
// ❌ Missing LeaveObject - stack corruption!
ludeo_DataWriter_EnterObject(objectId);
ludeo_DataWriter_SetFloat("health", health);
// FORGOT LeaveObject() - WILL BREAK!
```

---

### 🔴 **CR-003: Async Operations REQUIRE Callbacks**

Many SDK operations are **asynchronous** and require callbacks.

**Async Operations:**
- `ludeo_Session_Activate()`
- `ludeo_Session_OpenRoom()`
- `ludeo_Room_AddPlayer()`
- `ludeo_GameplaySession_Begin()`
- `ludeo_GameplaySession_End()`
- `ludeo_Room_Close()`
- `ludeo_Session_GetLudeo()`

**Required:**
```cpp
// ✅ Async call with callback
LudeoResult result = ludeo_Session_Activate(
    m_session_handle, &params, this, OnSessionActivatedCallback);

if (result != LudeoResult::Success) {
    LogError("Failed to START activation: %d", result);
}

// Callback handles completion
void OnSessionActivatedCallback(const LudeoSessionActivateCallbackParams* data) {
    if (data->resultCode == LudeoResult::Success) {
        // NOW it's activated
    }
}
```

**Forbidden:**
```cpp
// ❌ Treating async as sync - WILL NOT WORK
LudeoResult result = ludeo_Session_Activate(...);
if (result == Success) {
    // Session is NOT activated yet! This is wrong!
}
```

---

### 🔴 **CR-004: Window Handle MUST Be Provided**

SDK requires native window handle for video capture and overlay.

**Required:**
```cpp
LudeoSessionActivateParams params = {};
params.windowHandle = GetGameWindowHandle();  // ✅ REQUIRED!
params.apiKey = m_api_key.c_str();
// ... other params

ludeo_Session_Activate(m_session_handle, &params, this, OnSessionActivatedCallback);
```

**Platform-Specific:**
- **Windows:** `HWND` handle
- **Linux:** X11 or Wayland window handle
- **Engine-specific:** Use engine's window API

**Validation:**
- [ ] Window handle obtained correctly per platform
- [ ] Handle provided during Session activation
- [ ] Video capture works (check Ludeo platform)

---

### 🔴 **CR-005: ludeo_Tick() MUST Be Called Every Frame**

SDK requires `ludeo_Tick()` to process callbacks and internal operations.

**Required:**
```cpp
void GameLoop::Update() {
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().Tick();  // ✅ Every frame!
#endif
    
    // Rendering...
}
```

**Rules:**
- Call once per frame
- Call on consistent thread (usually main thread)
- Don't skip frames

**Forbidden:**
```cpp
// ❌ Calling irregularly or skipping
if (someCondition) {
    LudeoManager::Get().Tick();  // WRONG - must be every frame!
}
```

---

### 🔴 **CR-006: Two-Pass Restoration is MANDATORY**

Restoration MUST use two passes to handle object relationships correctly.

**Required:**
```cpp
// ✅ PASS 1: Create all objects (minimal data)
for (each object in DataReader) {
    GameObject* obj = CreateGameObject(type, position, id);
    restored_objects[ludeo_id] = obj;
}

// ✅ PASS 2: Restore properties and relationships
for (each restored object) {
    RestoreProperties(obj);  // Now references can be resolved
}
```

**Why Critical:**
- Pass 1 creates all objects so they exist
- Pass 2 can resolve references because objects exist
- Single-pass fails when object B references object A that doesn't exist yet

**Forbidden:**
```cpp
// ❌ Single-pass - will fail on relationships
for (each object) {
    CreateAndFullyRestore(object);  // Relationships break!
}
```

→ **See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) Section 9.3

---

### 🔴 **CR-007: Release ObjectsInfo After Use**

Always release ObjectsInfo to avoid memory leaks.

---

### 🔴 **CR-008: EndGameplaySession() MUST Be Called on ALL Exit Paths**

Every way to leave active gameplay must call `EndGameplaySession()`.

**Exit paths to hook:**
- Level complete / win / loss
- Player quits to menu
- Player quits to desktop
- Level restart
- Network disconnect (multiplayer)
- Error recovery / crash handling

**Validation:**
- [ ] Audit all paths out of gameplay state
- [ ] Each path calls `EndGameplaySession()` before cleanup

**Required:**
```cpp
LudeoObjectsInfo* objects_info = nullptr;
LudeoResult result = ludeo_DataReader_GetObjectsInfo(reader, &params, &objects_info);

if (result == LudeoResult::Success) {
    // Use objects_info...
    
    // ✅ CRITICAL: Release when done!
    ludeo_ObjectsInfo_Release(objects_info);
}
```

**Why Critical:**
- Memory leak if not released
- SDK allocates this memory, you must free it

---

## 📊 **Validation Checklist**

Before considering integration complete, verify these critical requirements:

### CR-001: Macro Compilation
- [ ] Compiles with `LUDEO_SDK_ENABLED=1`
- [ ] Compiles with `LUDEO_SDK_ENABLED=0`
- [ ] No SDK symbols in disabled build

### CR-002: Context Stack
- [ ] All `EnterObject` calls have matching `LeaveObject`
- [ ] Using RAII helpers where possible
- [ ] No stack corruption errors

### CR-003: Async Callbacks
- [ ] All async operations have callbacks
- [ ] Not treating async return values as completion
- [ ] Callbacks implemented correctly

### CR-004: Window Handle
- [ ] Window handle obtained correctly
- [ ] Handle provided during Session activation
- [ ] Video capture works

### CR-005: Tick Every Frame
- [ ] `ludeo_Tick()` called once per frame
- [ ] Called on consistent thread
- [ ] Never skipped

### CR-006: Two-Pass Restoration
- [ ] Pass 1 creates all objects
- [ ] Pass 2 restores properties/relationships
- [ ] Object references resolve correctly

### CR-007: Resource Release
- [ ] `ludeo_ObjectsInfo_Release()` called after use
- [ ] No memory leaks in valgrind/leak detector

### CR-008: All Exit Paths
- [ ] All gameplay exit paths audited
- [ ] Each calls `EndGameplaySession()`

---

## 🔗 **Related Documents**

**For best practices and additional guidelines:**
- [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - Error handling, return value checking, API patterns
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Stable IDs, pause tracking, actions implementation
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - LudeoSelected handling, player input flow

**For implementation:**
- [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md) - Step-by-step integration workflow
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) - When things go wrong

---

**Remember:** These 8 requirements are non-negotiable. Violating them will break your integration.