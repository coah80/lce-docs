---
title: PS Vita
description: PS Vita platform implementation.
---

The PS Vita port lives in `Minecraft.Client/PSVita/`. It's the only handheld platform in the codebase and has two separate network managers: one for PSN online play and one for local ad-hoc wireless multiplayer. The Vita version also has a lot of memory optimization work because of the handheld's limited resources.

## Key Files

| File | Purpose |
|------|---------|
| `PSVita_App.h/.cpp` | `CConsoleMinecraftApp` application class |
| `PSVita_Minecraft.cpp` | Vita entry point and main loop |
| `PSVita_UIController.h/.cpp` | `ConsoleUIController` using Iggy + GXM |
| `PSVita_PlayerUID.h/.cpp` | Vita player identity |
| `Network/SQRNetworkManager_Vita.h/.cpp` | PSN online network manager |
| `Network/SQRNetworkManager_AdHoc_Vita.h/.cpp` | Ad-hoc wireless network manager |
| `Network/SonyVoiceChat_Vita.h/.cpp` | Vita voice chat |
| `Network/PSVita_NPToolkit.h/.cpp` | NP Toolkit wrapper |
| `Network/SonyHttp_Vita.h/.cpp` | HTTP client |
| `Network/SonyRemoteStorage_Vita.h/.cpp` | Remote storage |
| `Network/SonyCommerce_Vita.h/.cpp` | PlayStation Store integration |
| `PSVitaExtras/PsVitaStubs.h/.cpp` | Win32 compatibility stubs |
| `PSVitaExtras/PSVitaTypes.h` | Type definitions |
| `PSVitaExtras/PSVitaStrings.h/.cpp` | String utilities |
| `PSVitaExtras/PSVitaMaths.h` | Math utilities |
| `PSVitaExtras/TLSStorage.h/.cpp` | Thread-local storage |
| `PSVitaExtras/PSVitaTLSStorage.h/.cpp` | Vita-specific TLS extensions |
| `PSVitaExtras/ShutdownManager.h/.cpp` | Graceful shutdown |
| `PSVitaExtras/CustomMap.h/.cpp` | Custom map container |
| `PSVitaExtras/CustomSet.h/.cpp` | Custom set container |
| `PSVitaExtras/libdivide.h` | Integer division optimization library |
| `PSVitaExtras/user_malloc.c` | Custom memory allocator |
| `PSVitaExtras/user_new.cpp` | Custom new/delete operators |
| `PSVitaExtras/user_malloc_for_tls.c` | TLS memory allocator |
| `PSVitaExtras/zlib.h` / `zconf.h` | Local zlib headers |
| `PSVitaExtras/Conf.h` | Build configuration |
| `Leaderboards/PSVitaLeaderboardManager.h/.cpp` | PSN leaderboards |
| `Assert/assert.h` | Custom assert |

## Application Class

`CConsoleMinecraftApp` follows the standard Sony pattern with the same commerce state machine and SKU management as PS3/PS4. Some Vita-specific details:

- Same `PRODUCTCODES` and `EProductSKU` system as PS4 (no disc product code)
- `SonyCommerce` integration for PlayStation Store
- `SonyRemoteStorage` for cloud saves
- `AppEventTick` for Vita-specific system event processing
- `SaveDataTick` with Vita save data dialog management

### Save Data Management

The Vita has its own save data dialog system with delete confirmation:

```cpp
enum ESaveDataDeleteDialogState {
    eSaveDataDeleteState_idle,
    eSaveDataDeleteState_waitingForUser,
    eSaveDataDeleteState_userConfirmation,
    eSaveDataDeleteState_deleting,
    eSaveDataDeleteState_continue,
    eSaveDataDeleteState_abort,
};
```

Methods `initSaveDataDeleteDialog`, `updateSaveDataDeleteDialog`, and `finishSaveDataDeleteDialog` manage the native `SceSaveDataDialogParam` system dialog.

## Rendering

Uses GXM (PS Vita's graphics API) through the 4J render abstraction. The UI controller uses Vita-specific dynamic buffers:

```cpp
gdraw_psp2_dynamic_buffer *m_dynamicBuffer;
int m_currentBackBuffer;
```

The `gdraw_psp2_dynamic_buffer` type is from the GDraw library (RAD Game Tools) adapted for Vita's GXM renderer.

## UI Controller

`ConsoleUIController` inherits from `UIController` (Iggy-based):
- `init(S32 w, S32 h)` sets up GXM-backed dynamic buffers
- Standard Iggy custom draw callbacks
- `handleUnlockFullVersionCallback` for trial upgrade

## Networking

The Vita is unique in having two completely separate network managers.

### PSN Online: `SQRNetworkManager_Vita`

Extends `SQRNetworkManager` with the same NP Matching2 architecture as PS4:

- **Invite handling**: `RecvInviteGUI`, `TickInviteGUI` for system invites
- **Joinable presence**: `GetJoinablePresenceDataAndProcess`, `ProcessJoinablePresenceData`, `TickJoinablePresenceData` for presence-based join flow
- **NP Toolkit**: `PSVita_NPToolkit` wrapper for PSN services
- **Voice chat**: `SonyVoiceChat_Vita` with `SQRVoiceConnection` per network address
- **Friend search**: `FriendSearchResult` class (same pattern as PS4)
- **Initialization guard**: `IsInitialised` / `UnInitialise` methods for clean lifecycle management

Unique to Vita's PSN manager:
- `PSNSignInReturnedPresenceInvite` callback for sign-in-triggered presence invites
- `m_bJoinablePresenceWaitingForOnline` flag for deferred joinable presence processing
- `m_bSendingInviteMessage` for invite message send tracking
- `GetHostUID` for direct host UID access from presence info
- Shutdown state tracking: `m_bIsInitialised`, `m_bShuttingDown`

### Ad-Hoc Local: `SQRNetworkManager_AdHoc_Vita`

A completely separate network manager for local wireless multiplayer without PSN:

- **Direct IP connections**: Uses `SceNetInAddr` for peer addressing instead of room member IDs
- **RUDP connections**: Created with direct IP addresses (`CreateRudpConnections(SceNetInAddr peer)`)
- **IP-to-player mapping**: `m_RudpCtxToIPAddrMap` tracks RUDP context to IP address associations

#### Ad-Hoc Data Protocol

Custom packet format for ad-hoc communication:
```cpp
enum EAdhocDataTag {
    e_dataTag_Normal,
    e_dataTag_RoomSync
};

class AdhocDataPacket {
    EAdhocDataTag m_tag;
    uint32_t      m_pData[1];
};
```

#### Hello Sync
Uses `HelloSyncInfo` instead of `PresenceSyncInfo` for ad-hoc peer discovery and session information exchange.

#### Matching Context
- `CreateMatchingContext(bool bServer)` creates either server or client matching context
- `StopMatchingContext` tears down matching
- `MatchingEventHandler` is the static handler for ad-hoc matching events (peer discovery, connection, disconnection)
- `startMatching` begins the ad-hoc matching process

#### Friend Search (Ad-Hoc)
Modified `FriendSearchResult` for ad-hoc:
```cpp
class FriendSearchResult {
    SceNpId         m_NpId;
    SceNetInAddr    m_netAddr;       // IP address instead of room/server IDs
    bool            m_RoomFound;
    void           *m_RoomExtDataReceived;
    void           *m_gameSessionData;
    RoomSyncData    m_roomSyncData;  // Full room sync embedded
};
```
- `m_bFriendsSearchChanged` flag for UI update notification
- Separate server/client matching contexts: `m_matchingContextServerValid`, `m_matchingContextClientValid`

## Memory Optimizations

The Vita's limited RAM (512 MB total, shared with OS) meant a lot of optimization work was needed:

### Custom Containers
- `CustomMap.h/.cpp` is a memory-optimized map implementation
- `CustomSet.h/.cpp` is a memory-optimized set implementation

### Custom Allocators
Three separate allocator implementations:
- `user_malloc.c` for the main heap allocator
- `user_new.cpp` for C++ new/delete operators
- `user_malloc_for_tls.c` for thread-local storage allocator

### libdivide
`libdivide.h` is a header-only library that replaces expensive integer division operations with multiplication and bit-shift sequences. This matters on the Vita's ARM Cortex-A9 processor where hardware division is slow.

### Dual TLS System
- `TLSStorage.h/.cpp` provides standard TLS (shared with other Sony platforms)
- `PSVitaTLSStorage.h/.cpp` adds Vita-specific TLS with tighter memory management

### Local zlib
Bundled `zlib.h` and `zconf.h` headers rather than using system zlib, allowing for Vita-optimized build configuration.

## Unique Platform Features

- **Dual networking**: Both PSN online and local ad-hoc wireless multiplayer
- **Ad-hoc protocol**: Custom packet-based protocol for direct Vita-to-Vita communication
- **Memory-optimized containers**: Custom map and set implementations for a smaller memory footprint
- **libdivide**: Integer division optimization for ARM
- **Joinable presence**: Presence-based game joining (players join via PSN status rather than invites)
- **GXM rendering**: Vita-specific dynamic buffer management for GDraw/Iggy
- **Save data delete dialog**: Full save management with user-facing delete confirmation
- **Build configuration**: `Conf.h` for Vita-specific build options, `configuration.psp2path` for SDK paths
- **Rename utility**: `GameConfig/rename.py` script for batch file operations

## MinecraftConsoles Additions

### Sony Shared Network Layer

Like the other Sony platforms, the Vita networking code in MinecraftConsoles extends shared base classes from `Common/Network/Sony/`. The Vita is unique because `CPlatformNetworkManagerSony` has `#ifdef __PSVITA__` sections that add ad-hoc networking support:

```cpp
#ifdef __PSVITA__
bool usingAdhocMode() { return m_bUsingAdhocMode; }
bool setAdhocMode(bool bAdhoc);
void startAdhocMatching();
bool checkValidInviteData(const INVITE_INFO* pInviteInfo);
#endif
```

The shared `SQRNetworkManager` base class also includes Vita-specific `#ifdef` sections for `HelloSyncInfo` (used by ad-hoc) and adjusts the RUDP thread priority (500 instead of PS3's 999).

### 4JLibs Headers

`PSVita/4JLibs/inc/` with 4J_Render.h, 4J_Input.h, 4J_Profile.h, 4J_Storage.h.

### Iggy UI Library

`PSVita/Iggy/` bundles:
- `gdraw/gdraw_psp2.h/.cpp` (GXM graphics backend, PSP2 is the Vita's internal codename)
- `include/iggy.h`, `include/gdraw.h`, `include/iggyexpruntime.h`, `include/iggyperfmon.h`, `include/iggyperfmon_psp2.h`, `include/rrCore.h`

### Miles Sound System

`PSVita/Miles/include/mss.h` and `rrCore.h` for audio.

### Sentient Telemetry

`PSVita/Sentient/` with the standard telemetry headers.

### Media and Content

`PSVitaMedia/` with DLC, localization, media, tutorial assets, and a compiled `Minecraft.Client.self` binary (a pre-built Vita executable). Also includes `Sound/` and `Tutorial/` subdirectories.

The Vita also has `PSVita/app/` and `PSVita/Builds/` directories for build configuration and packaging.
