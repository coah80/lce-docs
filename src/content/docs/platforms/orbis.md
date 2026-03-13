---
title: PS4 (Orbis)
description: PlayStation 4 platform implementation.
---

The PlayStation 4 port (codenamed "Orbis") lives in `Minecraft.Client/Orbis/`. It builds on the PS3 Sony networking patterns but uses the modern NP Toolkit and GNM renderer. The PS4 version adds remote play support, party voice chat, and a better save data dialog system.

## Key Files

| File | Purpose |
|------|---------|
| `Orbis_App.h/.cpp` | `CConsoleMinecraftApp` application class |
| `Orbis_Minecraft.cpp` | PS4 entry point and main loop |
| `Orbis_UIController.h/.cpp` | `ConsoleUIController` using Iggy |
| `Orbis_PlayerUID.h/.cpp` | PS4 player identity |
| `Network/SQRNetworkManager_Orbis.h/.cpp` | NP Matching2 network manager |
| `Network/SonyVoiceChat_Orbis.h/.cpp` | PS4 voice chat |
| `Network/SonyVoiceChatParty_Orbis.h/.cpp` | Party voice chat |
| `Network/Orbis_NPToolkit.h/.cpp` | NP Toolkit wrapper |
| `Network/SonyHttp_Orbis.h/.cpp` | HTTP client |
| `Network/SonyRemoteStorage_Orbis.h/.cpp` | Remote storage / cloud saves |
| `Network/SonyCommerce_Orbis.h/.cpp` | PlayStation Store integration |
| `Network/PsPlusUpsellWrapper_Orbis.h/.cpp` | PS Plus upsell dialog |
| `OrbisExtras/OrbisStubs.h/.cpp` | Win32 API compatibility stubs |
| `OrbisExtras/OrbisTypes.h` | Type definitions |
| `OrbisExtras/OrbisMaths.h` | Math utilities |
| `OrbisExtras/TLSStorage.h/.cpp` | Thread-local storage |
| `OrbisExtras/ShutdownManager.h` | Shutdown handling |
| `OrbisExtras/winerror.h` | Windows error code compatibility |
| `Leaderboards/OrbisLeaderboardManager.h/.cpp` | PSN leaderboards |
| `Assert/assert.h` | Custom assert |
| `MinecraftPronunciation/` | Voice control pronunciation XML |

## Application Class

`CConsoleMinecraftApp` follows the same Sony pattern as PS3, with some key differences:

### NP Toolkit Integration
Uses `<np_toolkit.h>` for PSN services. Commerce category IDs use `SCE_TOOLKIT_NP_COMMERCE_CATEGORY_ID_LEN` instead of PS3's `SCE_NP_COMMERCE2_CATEGORY_ID_LEN`.

### Commerce System
Same `eUI_DLC_State` state machine as PS3 with all the commerce states. The PS4 version also includes:
- `SystemServiceTick` for system service event polling
- `SaveDataDialogTick` for PS4 save data dialog management
- `PatchAvailableDialogTick` / `ShowPatchAvailableError` for game update notifications

### Save Data Dialogs
PS4 uses system-level save data dialogs (`SceSaveDataDialogParam`) with:
- `m_bSaveDataDialogRunning` as the dialog active flag
- `m_bOptionsSaveDataDialogRunning` for options-triggered save dialog
- Save incomplete callbacks with message box flow

### Product Codes
Same `PRODUCTCODES` struct as PS3 but without `chDiscProductCode` field (PS4 is download-only for this title).

## Rendering

Uses GNM (PS4's low-level graphics API) through the 4J render abstraction.

The UI controller uses double-buffered staging:
```cpp
S32 staging_buf_size;
void *staging_buf[2];
int currentStagingBuf;
```

This is needed because PS4's GPU memory model requires UI texture uploads to go through a staging buffer.

## UI Controller

`ConsoleUIController` inherits from `UIController` (Iggy-based):
- `init(S32 w, S32 h)` initializes staging buffers for texture uploads
- `handleUnlockFullVersionCallback` for trial upgrade UI flow
- Standard Iggy custom draw callbacks for in-game item rendering

## Networking

`SQRNetworkManager_Orbis` extends `SQRNetworkManager` with PS4-specific features:

### Session Management
Same room-based architecture as PS3 using NP Matching2, with some notable additions:
- **Invite handling**: `RecvInviteGUI` (static) and `TickInviteGUI` for PS4 system-level invite processing via NP Toolkit message attachments
- **Remote play support**: `UpdateRemotePlay` method for PS Vita remote play sessions
- **Host member tracking**: `m_hostMemberId` field (PS3 relied on room owner only)

### Voice Chat
Two voice chat implementations:
- `SonyVoiceChat_Orbis` for standard in-game voice
- `SonyVoiceChatParty_Orbis` for PS4 party voice chat integration

Voice connections are tracked via `m_NetAddrToVoiceConnectionMap`, which maps network addresses to `SQRVoiceConnection` instances.

### Signalling Events
PS4 uses a queued signalling model (unlike PS3's direct callbacks):
```cpp
class SignallingEvent {
    SceNpMatching2ContextId ctxId;
    SceNpMatching2RoomId roomId;
    SceNpMatching2RoomMemberId peerMemberId;
    SceNpMatching2Event event;
    int error_code;
};
std::vector<SignallingEvent> m_signallingEventList;
```

Events get queued from the signalling callback and processed on the server thread via `SignallingEventsTick`. This prevents crashes from Iggy UI calls during callbacks.

### Friend Search
Uses `FriendSearchResult` class (cleaner than PS3's parallel arrays):
```cpp
class FriendSearchResult {
    SceNpId      m_NpId;
    SceNpMatching2RoomId   m_RoomId;
    SceNpMatching2ServerId m_ServerId;
    bool         m_RoomFound;
    void        *m_RoomExtDataReceived;
};
```

### PSN Sign-In
Improved sign-in flow with extra state tracking:
- `s_SignInCompleteCallbackPending` / `s_SignInCompleteCallbackPad` for deferred callbacks
- `s_errorDialogClosed` / `s_systemDialogClosed` timestamps
- `SYSTEM_UI_WAIT_TIME` (1000ms) delay before checking system UI results
- `SetPresenceFailedCallback` for presence error handling

### Error Handling
- `OnlineCheck` method for connectivity verification
- `tickErrorDialog` for system error dialog management
- `s_errorDialogRunning` flag to prevent overlapping error dialogs

### Notifications
- `TickNotify` processes NP notifications
- `NotifyRealtimePlusFeature` shows PS Plus upsell prompts per quadrant

## Custom Memory Management

Three custom allocator files:
- `user_malloc.cpp` with a custom `malloc`/`free` implementation
- `user_new.cpp` with custom `new`/`delete` operators
- `user_malloc_for_tls.cpp` for TLS-specific memory allocation

## Pronunciation Support

`MinecraftPronunciation/` contains XML files for PS4 voice recognition:
- `pronunciation.xml` with Minecraft-specific word pronunciations
- `MinecraftPronunciation.xml` with extended pronunciation data

## PS Plus Integration

`PsPlusUpsellWrapper_Orbis` handles PS Plus subscription upsell dialogs when players try to access online features without an active subscription.

## Unique Platform Features

- **Remote play**: `UpdateRemotePlay` for PS Vita Remote Play sessions
- **Party voice chat**: Separate `SonyVoiceChatParty_Orbis` class for PS4 party system integration
- **Queued signalling**: Thread-safe event processing to avoid UI crashes during network callbacks
- **Save data dialogs**: System-level save management with delete confirmation and space checking
- **Patch notification**: `ShowPatchAvailableError` for mandatory update prompts
- **Custom allocators**: Three separate memory allocation implementations for different contexts
- **NP Toolkit**: Modern PSN service integration replacing PS3's direct NP API calls
- **PS Plus upsell**: Integrated subscription promotion for online features
- **Voice pronunciation**: XML-based voice command recognition support

## MinecraftConsoles Additions

### Sony Shared Network Layer

Like PS3, the PS4 networking code in MinecraftConsoles was refactored to extend shared base classes in `Common/Network/Sony/`. The PS4-specific `SQRNetworkManager_Orbis` extends the shared `SQRNetworkManager` with PS4-specific features like queued signalling events, party voice chat, and the NP Toolkit integration.

The shared `SonyCommerce` class uses `#ifdef` branches to handle the API differences between PS3 (direct NP Commerce2 API) and PS4/Vita (NP Toolkit wrappers). On PS4, the PS3 constant names are `#define`'d to their NP Toolkit equivalents (e.g., `SCE_NP_COMMERCE2_CATEGORY_ID_LEN` maps to `SCE_TOOLKIT_NP_COMMERCE_CATEGORY_ID_LEN`).

### 4JLibs Headers

`Orbis/4JLibs/inc/` with 4J_Render.h, 4J_Input.h, 4J_Profile.h, 4J_Storage.h.

### Iggy UI Library

`Orbis/Iggy/` bundles:
- `gdraw/gdraw_orbis.h/.cpp` (GNM graphics backend)
- `include/iggy.h`, `include/gdraw.h`, `include/iggyexpruntime.h`, `include/iggyperfmon.h`, `include/iggyperfmon_orbis.h`, `include/rrCore.h`

### Miles Sound System

`Orbis/Miles/include/mss.h` and `rrCore.h` for audio.

### Sentient Telemetry

`Orbis/Sentient/` with the standard telemetry headers.

### GameConfig

`Orbis/GameConfig/Minecraft.spa.h` was added in MinecraftConsoles (not present in LCEMP's Orbis directory).

### Media and Content

`OrbisMedia/` with DLC, localization, and media assets. Also `PS4_GAME/` and `sce_sys/` for PlayStation system metadata at the Minecraft.Client root level.
