---
title: PS3
description: PlayStation 3 platform implementation.
---

The PlayStation 3 port lives in `Minecraft.Client/PS3/`. It was the first Sony platform and established the patterns reused by PS4 and PS Vita. The PS3 version features Cell SPU job offloading and uses the Sony NP Matching2 system for online play.

## Key Files

| File | Purpose |
|------|---------|
| `PS3_App.h/.cpp` | `CConsoleMinecraftApp` -- application class with PSN commerce |
| `PS3_Minecraft.cpp` | PS3 entry point and main loop |
| `Xbox_Minecraft.cpp` | Shared game initialization (Xbox-style naming, used on PS3) |
| `PS3_UIController.h/.cpp` | `ConsoleUIController` using Iggy |
| `PS3_PlayerUID.h/.cpp` | PS3 player identity |
| `Network/SQRNetworkManager_PS3.h/.cpp` | NP Matching2 network manager |
| `Network/SonyVoiceChat.h/.cpp` | PS3 voice chat |
| `Network/SonyHttp_PS3.h/.cpp` | HTTP client |
| `Network/SonyRemoteStorage_PS3.h/.cpp` | Remote storage |
| `Network/SonyCommerce_PS3.h/.cpp` | PlayStation Store integration |
| `PS3Extras/C4JSpursJob.h/.cpp` | Cell SPU SPURS job system |
| `PS3Extras/C4JThread_SPU.h/.cpp` | SPU thread management |
| `PS3Extras/EdgeZLib.h/.cpp` | Edge library zlib compression |
| `PS3Extras/Ps3Stubs.h/.cpp` | Win32 API compatibility stubs |
| `PS3Extras/Ps3Types.h` | Type definitions |
| `PS3Extras/PS3Strings.h/.cpp` | String utilities |
| `PS3Extras/PS3Maths.h` | Math utilities |
| `PS3Extras/TLSStorage.h/.cpp` | Thread-local storage |
| `PS3Extras/ShutdownManager.h/.cpp` | Graceful shutdown handling |
| `PS3Extras/winerror.h` | Windows error code compatibility |
| `Leaderboards/PS3LeaderboardManager.h/.cpp` | PSN leaderboards |
| `Audio/PS3_SoundEngine.cpp` | PS3 audio implementation |
| `Assert/assert.h` | Custom assert implementation |

## Application Class

`CConsoleMinecraftApp` is the largest Sony app class, containing the full PlayStation Store commerce system:

### SKU Management
Regional product codes identified by `EProductSKU`:
- `e_sku_SCEE` (Europe)
- `e_sku_SCEA` (Americas)
- `e_sku_SCEJ` (Japan)

The `PRODUCTCODES` struct stores per-region:
- Product code (9 chars)
- Disc product code
- Save folder prefix
- Commerce category
- Texture pack category ID
- Upgrade key (59 chars)

### Commerce State Machine
A comprehensive `eUI_DLC_State` enum drives the storefront:

1. `eCommerce_State_Init` -- Initialize commerce library
2. `eCommerce_State_GetCategories` -- Fetch store categories
3. `eCommerce_State_GetProductList` -- Retrieve product listings
4. `eCommerce_State_AddProductInfoDetailed` -- Get detailed product info
5. `eCommerce_State_Checkout` -- Purchase flow with session management
6. `eCommerce_State_DownloadAlreadyPurchased` -- Re-download owned content
7. `eCommerce_State_UpgradeTrial` -- Trial-to-full upgrade

All commerce operations use async callbacks (`CommerceInitCallback`, `CommerceGetCategoriesCallback`, etc.).

### DLC System
- `SONYDLC` struct maps DLC keynames to types (skin pack, texture pack, mash-up pack)
- `m_SONYDLCMap` -- Hash map from name to DLC info
- Disc patch support: `SetDiscPatchUsrDir`, `IsFileInPatchList`, `GetBDUsrDirPath`

### Save Thumbnails
Dual-buffer thumbnail system:
- `m_ThumbnailBuffer` -- Save thumbnail
- `m_SaveImageBuffer` -- Save image
- `m_ScreenshotBuffer` -- Screenshot for sharing
- `GetSaveThumbnail` has two overloads (one for combined thumbnail + data image)

## Rendering

Uses GCM (Graphics Command Manager) for PS3's RSX GPU, wrapped by the 4J render abstraction.

## UI Controller

`ConsoleUIController` inherits from `UIController` (Iggy-based):
- Simple `init(S32 w, S32 h)` -- no device pointers needed (GCM context is global)
- `handleUnlockFullVersionCallback` static method for trial upgrade UI flow

## Networking

`SQRNetworkManager_PS3` extends `SQRNetworkManager` and provides full PSN online play:

### Session Management
- Uses SCE NP Matching2 for room-based multiplayer
- Room creation via server context selection: enumerate servers, select random, create world, create room
- Room joining with member ID tracking
- External room data for game session synchronization

### Player Tracking
- `SQRNetworkPlayer` instances stored in `m_aRoomSlotPlayers` (up to `MAX_ONLINE_PLAYER_COUNT`)
- `RoomSyncData` for cross-machine player synchronization
- RUDP (Reliable UDP) connections per player with context-to-player mapping

### Communication
- **Signalling**: `SceNpMatching2` signalling callbacks for peer discovery
- **RUDP**: Reliable UDP for game data via `RudpContextCallback` and `RudpEventCallback`
- **Local data**: Direct memory copy for same-machine players via `LocalDataSend`

### Friend Search
- Threaded friend count retrieval (`GetFriendsThreadProc`)
- Room data external list queries for finding friends' games
- Results stored in matched arrays: NpId, RoomId, ServerId, room found flag, external data

### Callbacks
Six callback categories:
1. **Matching context**: `ContextCallback` -- Context state changes
2. **Request**: `DefaultRequestCallback` -- Async request completions
3. **Room events**: `RoomEventCallback` -- Room member changes
4. **Signalling**: `SignallingCallback` -- Peer connection events
5. **RUDP**: `RudpContextCallback` / `RudpEventCallback` -- Data transport
6. **System**: `NetCtlCallback`, `SysUtilCallback`, `ManagerCallback`, `BasicEventCallback`

### Rich Presence
- `SetRichPresence` with custom data
- `PresenceSyncInfo` for synchronizing host/game state
- Resend countdown to handle PSN presence update rate limits
- PSN sign-in flow via `AttemptPSNSignIn` with completion callbacks

## Cell SPU Job System

The `C4JSpursJob` system offloads compute-intensive work to the PS3's SPU cores:

### Job Types
- `C4JSpursJob_CompressedTile` -- Tile data compression
- `C4JSpursJob_ChunkUpdate` -- Chunk mesh rebuilding
- `C4JSpursJob_LevelRenderer_cull` -- Frustum culling
- `C4JSpursJob_LevelRenderer_zSort` -- Depth sorting
- `C4JSpursJob_LevelRenderer_FindNearestChunk` -- Nearest chunk lookup
- `C4JSpursJob_Texture_blit` -- Texture blitting
- `C4JSpursJob_CompressedTileStorage_compress` / `_getData` -- Compressed storage
- `C4JSpursJob_PerlinNoise` -- Noise generation

### Job Queue
`C4JSpursJobQueue` manages a 256-depth queue with:
- `Port` class for submitting jobs and waiting for completion
- 16-port allocation with bitmask tracking
- `submitJob`, `waitForCompletion`, `hasCompleted`, `submitSync`

## Platform Extras

### Thread-Local Storage
`TLSStorage` provides manual TLS since PS3's Cell architecture requires explicit management for PPU/SPU contexts.

### Edge ZLib
`EdgeZLib` wraps Sony's Edge library compression for efficient tile data handling on SPU.

### Shutdown Manager
`ShutdownManager` handles graceful game exit, ensuring saves complete before process termination.

### Compatibility Layer
- `Ps3Stubs.h/.cpp` -- Implements Win32 API functions (critical sections, thread primitives, etc.)
- `Ps3Types.h` -- Defines Windows types (`DWORD`, `BYTE`, `HRESULT`, etc.)
- `winerror.h` -- Windows error code constants
- `PS3Strings.h/.cpp` -- String conversion utilities (wide char, UTF-8)

## Unique Platform Features

- **SPU offloading**: Heavy computation pushed to Cell SPU cores via SPURS job queue
- **Regional SKU handling**: Full product code management for SCEE/SCEA/SCEJ regions
- **Disc patch support**: Detection and file routing for disc-based patches
- **Voice chat**: `SonyVoiceChat` for in-game voice communication
- **Remote storage**: `SonyRemoteStorage_PS3` for cloud saves
- **HTTP client**: `SonyHttp_PS3` for web requests
- **Sound engine**: Custom `PS3_SoundEngine` for Cell-optimized audio
