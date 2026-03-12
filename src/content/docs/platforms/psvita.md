---
title: PS Vita
description: PS Vita platform implementation.
---

The PS Vita port lives in `Minecraft.Client/PSVita/`. It is the only handheld platform in the codebase and features two separate network managers -- one for PSN online play and one for local ad-hoc wireless multiplayer. The Vita version includes significant memory optimization work due to the handheld's constrained resources.

## Key Files

| File | Purpose |
|------|---------|
| `PSVita_App.h/.cpp` | `CConsoleMinecraftApp` -- application class |
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

`CConsoleMinecraftApp` follows the standard Sony pattern with the same commerce state machine and SKU management as PS3/PS4. Key specifics:

- Same `PRODUCTCODES` and `EProductSKU` system as PS4 (no disc product code)
- `SonyCommerce` integration for PlayStation Store
- `SonyRemoteStorage` for cloud saves
- `AppEventTick` -- Vita-specific system event processing
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
- `init(S32 w, S32 h)` -- Sets up GXM-backed dynamic buffers
- Standard Iggy custom draw callbacks
- `handleUnlockFullVersionCallback` for trial upgrade

## Networking

The Vita is unique in having two separate network managers.

### PSN Online: `SQRNetworkManager_Vita`

Extends `SQRNetworkManager` with the same NP Matching2 architecture as PS4:

- **Invite handling**: `RecvInviteGUI`, `TickInviteGUI` for system invites
- **Joinable presence**: `GetJoinablePresenceDataAndProcess`, `ProcessJoinablePresenceData`, `TickJoinablePresenceData` for presence-based join flow
- **NP Toolkit**: `PSVita_NPToolkit` wrapper for PSN services
- **Voice chat**: `SonyVoiceChat_Vita` with `SQRVoiceConnection` per network address
- **Friend search**: `FriendSearchResult` class (same pattern as PS4)
- **Initialisation guard**: `IsInitialised` / `UnInitialise` methods for clean lifecycle management

Unique to Vita's PSN manager:
- `PSNSignInReturnedPresenceInvite` -- Callback for sign-in-triggered presence invites
- `m_bJoinablePresenceWaitingForOnline` -- Flag for deferred joinable presence processing
- `m_bSendingInviteMessage` -- Invite message send tracking
- `GetHostUID` -- Direct host UID access from presence info
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
- `CreateMatchingContext(bool bServer)` -- Creates either server or client matching context
- `StopMatchingContext` -- Tears down matching
- `MatchingEventHandler` -- Static handler for ad-hoc matching events (peer discovery, connection, disconnection)
- `startMatching` -- Begins ad-hoc matching process

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

The Vita's limited RAM (512 MB total, shared with OS) required extensive optimization:

### Custom Containers
- `CustomMap.h/.cpp` -- Memory-optimized map implementation
- `CustomSet.h/.cpp` -- Memory-optimized set implementation

### Custom Allocators
Three separate allocator implementations:
- `user_malloc.c` -- Main heap allocator
- `user_new.cpp` -- C++ new/delete operators
- `user_malloc_for_tls.c` -- Thread-local storage allocator

### libdivide
`libdivide.h` -- A header-only library that replaces expensive integer division operations with multiplication and bit-shift sequences. Important for the Vita's ARM Cortex-A9 processor where hardware division is slow.

### Dual TLS System
- `TLSStorage.h/.cpp` -- Standard TLS (shared with other Sony platforms)
- `PSVitaTLSStorage.h/.cpp` -- Additional Vita-specific TLS with tighter memory management

### Local zlib
Bundled `zlib.h` and `zconf.h` headers rather than using system zlib, allowing for Vita-optimized build configuration.

## Unique Platform Features

- **Dual networking**: Both PSN online and local ad-hoc wireless multiplayer
- **Ad-hoc protocol**: Custom packet-based protocol for direct Vita-to-Vita communication
- **Memory-optimized containers**: Custom map and set implementations for reduced memory footprint
- **libdivide**: Integer division optimization for ARM
- **Joinable presence**: Presence-based game joining (players join via PSN status rather than invites)
- **GXM rendering**: Vita-specific dynamic buffer management for GDraw/Iggy
- **Save data delete dialog**: Full save management with user-facing delete confirmation
- **Build configuration**: `Conf.h` for Vita-specific build options, `configuration.psp2path` for SDK paths
- **Rename utility**: `GameConfig/rename.py` script for batch file operations
