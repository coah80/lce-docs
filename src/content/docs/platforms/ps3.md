---
title: PS3
description: PlayStation 3 platform implementation.
---

The PlayStation 3 port lives in `Minecraft.Client/PS3/`. It was the first Sony platform and set up the patterns that PS4 and PS Vita reuse. The PS3 version features Cell SPU job offloading and uses the Sony NP Matching2 system for online play.

## Key Files

| File | Purpose |
|------|---------|
| `PS3_App.h/.cpp` | `CConsoleMinecraftApp` application class with PSN commerce |
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

`CConsoleMinecraftApp` is the largest Sony app class, since it has the full PlayStation Store commerce system:

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
A full `eUI_DLC_State` enum drives the storefront:

1. `eCommerce_State_Init` initializes the commerce library
2. `eCommerce_State_GetCategories` fetches store categories
3. `eCommerce_State_GetProductList` retrieves product listings
4. `eCommerce_State_AddProductInfoDetailed` gets detailed product info
5. `eCommerce_State_Checkout` handles the purchase flow with session management
6. `eCommerce_State_DownloadAlreadyPurchased` re-downloads owned content
7. `eCommerce_State_UpgradeTrial` handles trial-to-full upgrade

All commerce operations use async callbacks (`CommerceInitCallback`, `CommerceGetCategoriesCallback`, etc.).

### DLC System
- `SONYDLC` struct maps DLC keynames to types (skin pack, texture pack, mash-up pack)
- `m_SONYDLCMap` is a hash map from name to DLC info
- Disc patch support: `SetDiscPatchUsrDir`, `IsFileInPatchList`, `GetBDUsrDirPath`

### Save Thumbnails
Dual-buffer thumbnail system:
- `m_ThumbnailBuffer` for save thumbnail
- `m_SaveImageBuffer` for save image
- `m_ScreenshotBuffer` for screenshot sharing
- `GetSaveThumbnail` has two overloads (one for combined thumbnail + data image)

## Rendering

Uses GCM (Graphics Command Manager) for PS3's RSX GPU, wrapped by the 4J render abstraction.

## UI Controller

`ConsoleUIController` inherits from `UIController` (Iggy-based):
- Simple `init(S32 w, S32 h)`, no device pointers needed (GCM context is global)
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
1. **Matching context**: `ContextCallback` for context state changes
2. **Request**: `DefaultRequestCallback` for async request completions
3. **Room events**: `RoomEventCallback` for room member changes
4. **Signalling**: `SignallingCallback` for peer connection events
5. **RUDP**: `RudpContextCallback` / `RudpEventCallback` for data transport
6. **System**: `NetCtlCallback`, `SysUtilCallback`, `ManagerCallback`, `BasicEventCallback`

### Rich Presence
- `SetRichPresence` with custom data
- `PresenceSyncInfo` for synchronizing host/game state
- Resend countdown to handle PSN presence update rate limits
- PSN sign-in flow via `AttemptPSNSignIn` with completion callbacks

## Cell SPU Job System

The `C4JSpursJob` system offloads heavy work to the PS3's SPU cores:

### Job Types
- `C4JSpursJob_CompressedTile` for tile data compression
- `C4JSpursJob_ChunkUpdate` for chunk mesh rebuilding
- `C4JSpursJob_LevelRenderer_cull` for frustum culling
- `C4JSpursJob_LevelRenderer_zSort` for depth sorting
- `C4JSpursJob_LevelRenderer_FindNearestChunk` for nearest chunk lookup
- `C4JSpursJob_Texture_blit` for texture blitting
- `C4JSpursJob_CompressedTileStorage_compress` / `_getData` for compressed storage
- `C4JSpursJob_PerlinNoise` for noise generation

### Job Queue
`C4JSpursJobQueue` manages a 256-depth queue with:
- `Port` class for submitting jobs and waiting for completion
- 16-port allocation with bitmask tracking
- `submitJob`, `waitForCompletion`, `hasCompleted`, `submitSync`

## Platform Extras

### Thread-Local Storage
`TLSStorage` provides manual TLS since PS3's Cell architecture needs explicit management for PPU/SPU contexts.

### Edge ZLib
`EdgeZLib` wraps Sony's Edge library compression for efficient tile data handling on SPU.

### Shutdown Manager
`ShutdownManager` handles graceful game exit, making sure saves complete before the process terminates.

### Compatibility Layer
- `Ps3Stubs.h/.cpp` implements Win32 API functions (critical sections, thread primitives, etc.)
- `Ps3Types.h` defines Windows types (`DWORD`, `BYTE`, `HRESULT`, etc.)
- `winerror.h` has Windows error code constants
- `PS3Strings.h/.cpp` provides string conversion utilities (wide char, UTF-8)

## Unique Platform Features

- **SPU offloading**: Heavy computation gets pushed to Cell SPU cores via the SPURS job queue
- **Regional SKU handling**: Full product code management for SCEE/SCEA/SCEJ regions
- **Disc patch support**: Detection and file routing for disc-based patches
- **Voice chat**: `SonyVoiceChat` for in-game voice communication
- **Remote storage**: `SonyRemoteStorage_PS3` for cloud saves
- **HTTP client**: `SonyHttp_PS3` for web requests
- **Sound engine**: Custom `PS3_SoundEngine` for Cell-optimized audio

## MinecraftConsoles Additions

MinecraftConsoles adds quite a lot to the PS3 platform compared to LCEMP. The biggest additions are the full SPU task source code and the third-party library bundles.

### Sony Shared Network Layer

In MinecraftConsoles, the core Sony networking code was refactored from per-platform copies into `Common/Network/Sony/`. The PS3-specific files (`SQRNetworkManager_PS3`, `SonyCommerce_PS3`, etc.) now extend shared base classes:
- `SQRNetworkManager` (shared NP Matching2 manager)
- `PlatformNetworkManagerSony` (shared platform manager)
- `SonyCommerce` (shared commerce with `#ifdef __PS3__` branches for PS3-specific NP APIs)

### SPU Task Sources

`PS3/SPU_Tasks/` contains the full Cell SPU job source code. In LCEMP, these jobs were referenced but the SPU sources were not included. MinecraftConsoles bundles everything:

**ChunkUpdate/** (80+ files): Complete tile rendering for SPU with `_SPU` variants of every tile class (AnvilTile_SPU, BedTile_SPU, CactusTile_SPU, etc.), plus `Tesselator_SPU`, `TileRenderer_SPU`, `Direction_SPU`, `Facing_SPU`, `Icon_SPU`, `Material_SPU`, and a `task.cpp` entry point. Also includes `ChunkRebuildData.h/.cpp` for mesh data transfer.

**CompressedTile/**: Tile compression/decompression on SPU with `CompressedTileStorage_SPU`, `SparseDataStorage_SPU`, `SparseLightStorage_SPU`

**CompressedTileStorage_compress/**: SPU-side compression entry point

**CompressedTileStorage_getData/**: SPU-side data retrieval entry point

**GameRenderer_updateLightTexture/**: Light texture generation on SPU

**LevelRenderChunks/**: Chunk list processing on SPU

**LevelRenderer_cull/**: Frustum culling on SPU

**LevelRenderer_FindNearestChunk/**: Nearest chunk search on SPU

**LevelRenderer_zSort/**: Depth sorting on SPU

**PerlinNoise/**: Noise generation on SPU with `ImprovedNoise_SPU` and `PerlinNoise_SPU`

**RecalcHeightmapOnly/**: Heightmap recalculation on SPU

**Renderer_TextureUpdate/**: Texture update on SPU

**RLECompress/**: Run-length encoding compression on SPU

**Texture_blit/**: Texture blitting on SPU

**Common/**: Shared SPU helpers (`DmaData.h`, `spu_assert.h`)

### Iggy UI Library

`PS3/Iggy/` bundles the Iggy Flash-based UI:
- `gdraw/gdraw_ps3gcm.h/.cpp` (GCM graphics backend)
- `include/iggy.h`, `include/gdraw.h`, `include/iggyexpruntime.h`, `include/iggyperfmon.h`, `include/iggyperfmon_ps3.h`, `include/rrCore.h`

### Miles Sound System

`PS3/Miles/include/mss.h` and `rrCore.h` for audio.

### XUI Scene Layout Headers

`PS3/Media/` contains compiled XUI scene layout headers in three resolution variants:
- Standard (720p)
- `_480` variants (480p for SD displays)
- `_small` variants (splitscreen)

There are layout headers for every UI scene: base, brewingstand, chat, connectingprogress, container, controls, craftingpanel (2x2 and 3x3), credits, death, debug, debugoverlay, DLC, enchant, fullscreenprogress, furnace, helpandoptions, howtoplay, ingameinfo, intro, inventory, inventory_creative, leaderboards, load_settings, main, multi_create, multi_gameinfo, multi_joinload, multi_launch_more_options, NewUpdateMessage, partnernetpassword, pause, reinstall, savemessage, settings (All, Audio, Control, Graphics, options), signentry, skinselect, socialpost, text_entry, trap, trialexitupsell, tutorialpopup, and win.

### Boost Library

`PS3/PS3Extras/boost_1_53_0/` contains a subset of Boost 1.53.0 including:
- `boost/asio/` for networking
- `boost/regex.h` for regular expressions
- `boost/spirit/` for parsing
- `boost/test/` for unit testing utilities
- `boost/tr1/` for C++ TR1 type traits and containers

### DirectX Math Compatibility

`PS3/PS3Extras/DirectX/` provides DirectX math headers for cross-platform compatibility:
- `DirectXMath.h`, `DirectXCollision.h`, `DirectXColors.h`, `DirectXPackedVector.h`
- `no_sal2.h`, `sal.h` for annotation stubs

### HeapInspector

`PS3/PS3Extras/HeapInspector/` is a memory debugging tool with:
- Hook-based allocation tracking samples
- Multi-threaded hook samples
- Replace new/delete samples
- Server-side heap info reporting (`HeapInspectorServer.h`)

### Other Additions

- `PS3/4JLibs/inc/` with 4J abstraction headers (4J_Render.h, 4J_Input.h, 4J_Profile.h, 4J_Storage.h)
- `PS3/4JLibs/STO_TitleSmallStorage.h/.cpp` for small save data (separate from main saves)
- `PS3/Sentient/` with telemetry SDK headers
- `PS3/Passphrase/ps3__np_conf.h` for NP configuration
- `PS3Media/` with DLC, localization, and media assets
