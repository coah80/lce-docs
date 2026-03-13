---
title: Xbox 360
description: Xbox 360 platform implementation.
---

The Xbox 360 was the first console platform for Minecraft Legacy Console Edition and served as the foundation for all the other ports. The code lives in `Minecraft.Client/Xbox/`.

## Key Files

| File | Purpose |
|------|---------|
| `Xbox_App.h/.cpp` | `CConsoleMinecraftApp` main application class |
| `Xbox_Minecraft.cpp` | Entry point (`main()`), D3D9 init, main game loop |
| `Xbox_UIController.h/.cpp` | `ConsoleUIController` using XUI framework |
| `Network/PlatformNetworkManagerXbox.h/.cpp` | Network manager using QNET |
| `Network/NetworkPlayerXbox.h/.cpp` | Xbox 360 network player |
| `Social/SocialManager.h/.cpp` | Facebook social posting via `xsocialpost.h` |
| `Leaderboards/XboxLeaderboardManager.h/.cpp` | Xbox Live leaderboards |
| `XML/ATGXmlParser.h/.cpp` | ATG XML parser |
| `GameConfig/Minecraft.spa.h` | Title-specific achievements and stats configuration |

## Application Class

`CConsoleMinecraftApp` is the most feature-rich app class, since Xbox 360 was the original platform. Key members:

- **Per-player state arrays** indexed by `XUSER_MAX_COUNT` (4 players): menu displayed flags, pause/container/autosave tracking, input countdown timers
- **XUI scene management**: Scene stacks per player (`m_sceneStack`), with first/current/tutorial/chat/HUD scene handles
- **Screenshot system**: `LPD3DXBUFFER` for thumbnail and per-player screenshots, plus `XSOCIAL_PREVIEWIMAGE` for social posting
- **TMS++ integration**: Title Managed Storage for remote file lists, XUID files, config files, DLC info, and banned player lists
- **Font rendering**: Custom `XUI_FontRenderer` with override toggle
- **String table**: `CXuiStringTable` for localized strings
- **Deployment type tracking**: `XTITLE_DEPLOYMENT_TYPE` for disc/digital detection

### Navigation System

The app owns the XUI scene navigation stack with methods:
- `NavigateToScene` / `NavigateBack` / `CloseXuiScenes`
- `TutorialSceneNavigateBack` / `ReloadChatScene` / `ReloadHudScene`
- `AdjustSplitscreenScene` repositions UI elements for 2/4-player splitscreen

## Entry Point and Main Loop

`Xbox_Minecraft.cpp` defines `main()` as the entry point. Initialization sequence:

1. Store launch data (for demo disc return)
2. Initialize Direct3D 9 at 1280x720 with `D3DFMT_A8R8G8B8` back buffer and `D3DFMT_D24S8` depth stencil
3. Initialize XAudio2 for sound and voice chat
4. Set up `InputManager` with 3 control map styles
5. Initialize `ProfileManager` with title ID, 5 profile values, 4 settings
6. Register all achievements (20), gamer pictures (2), avatar awards (3), and a theme
7. Register rich presence contexts
8. Load XUI resources
9. Initialize `StorageManager` with 51 MB max save size
10. Set up sign-in, notification, and profile callbacks
11. Initialize QNET networking
12. Initialize Sentient telemetry
13. Set up thread-local storage for Tesselator (1 MB), AABB, Vec3, IntCache, Compression
14. Initialize social manager
15. Run intro scene loop, then main game loop

The main loop ticks all managers (input, profile, storage, render, social, telemetry, network, leaderboards), runs the game, renders XUI, and carefully saves/restores D3D render states around XUI rendering.

## Rendering

Uses Direct3D 9 (`IDirect3DDevice9`) with:
- Back buffer: 1280x720, `D3DFMT_A8R8G8B8`
- Depth stencil: `D3DFMT_D24S8`
- V-sync enabled (`D3DPRESENT_INTERVAL_ONE`)
- Letterbox disabled for 4:3 displays (anamorphic squash)
- PIX named events for GPU profiling

Render state tracking arrays are kept to restore states after XUI rendering, which changes fillmode, cullmode, alpha blend, viewport, blend operations, and sampler states.

## Input Handling

Three control schemes defined in `DefineActions()`:

- **Style 0** (Default): Standard Minecraft layout. A=jump, LT=use, RT=attack, Y=inventory, X=craft, B=drop
- **Style 1**: Swapped triggers and bumpers. RB=jump, RT=use, LT=attack
- **Style 2**: Alternative. LT=jump, RT=use, A=attack

All styles share the same menu controls (A=OK, B=Cancel, D-pad/left stick for navigation).

## Networking

`CPlatformNetworkManagerXbox` implements `CPlatformNetworkManager` and `IQNetCallbacks`:

- **QNET library**: Microsoft's peer-to-peer networking for Xbox 360
- **Session search**: Threaded search with 30-second delay between searches, QoS measurements
- **Player tracking**: `NetworkPlayerXbox` instances mapped from `IQNetPlayer`
- **Per-system flags**: `PlayerFlags` class tracks boolean flags per connected system
- **Friend sessions**: Per-pad friend session lists with `FriendSessionInfo`
- **Host migration**: Supported via `NotifyNewHost` callback
- **Session properties**: Texture pack parent/sub IDs stored as session metadata

Key callbacks from QNET:
- `NotifyPlayerJoined` / `NotifyPlayerLeaving`
- `NotifyDataReceived` for game data routing
- `NotifyStateChanged` / `NotifyNewHost`
- `NotifyGameSearchComplete` / `NotifyGameInvite`
- `NotifyCommSettingsChanged` / `NotifyReadinessChanged`

## UI System

Xbox 360 is unique in using Microsoft's **XUI framework** instead of Iggy:

- `ConsoleUIController` inherits directly from `IUIController` (not `UIController`)
- Scene navigation via `HXUIOBJ` handles
- XUI string tables for localization
- Custom message boxes via `RequestMessageBox` and `RequestUGCMessageBox`
- Key press animation support (`AnimateKeyPress`)
- Debug overlay support in non-final builds

## Social Features

`CSocialManager` (singleton) provides Facebook integration through Xbox's `xsocialpost.h`:

- Post images and links to social networks
- Capability checking (`IsTitleAllowedToPostImages`, `AreAllUsersAllowedToPostImages`)
- Async operations via `XOVERLAPPED`
- Preview image and caption/description management

## Leaderboards

`XboxLeaderboardManager` extends `LeaderboardManager`:

- 4 leaderboards with 4 difficulty variants each
- Up to 101 cached entries, reads 15 at a time
- Supports friend rankings, personal scores, and top-rank queries
- Uses `XUSER_STATS_READ_RESULTS` for Xbox Live stats
- Async session management with overlapped operations

## Achievements and Awards

Registered in `Xbox_Minecraft.cpp`:
- 20 achievements (`eAward_TakingInventory` through `eAward_InToTheNether`)
- 2 gamer pictures (mine 100 blocks, kill 10 creepers)
- 3 avatar awards (porkchop t-shirt, watch, cap)
- 1 theme (social post reward)

## Unique Platform Features

- **Memory tracking**: Optional `MEMORY_TRACKING` build with custom `XMemAlloc`/`XMemFree` hooks that track allocations by section and size
- **Kinect hooks**: Commented-out `NuiInitialize` code suggests Kinect was investigated but never shipped
- **Demo disc support**: `StoreLaunchData` and `ExitGame` handle returning to a demo disc launcher
- **PIX profiling**: Named events throughout the main loop for Xbox PIX GPU/CPU profiling
- **Debug features**: `SetDebugSequence("LRLRYYY")` for debug menu activation, Partnernet password protection for test builds

## MinecraftConsoles Additions

The MinecraftConsoles codebase adds several directories and files to the Xbox 360 platform.

### 4JLibs Headers

`Xbox/4JLibs/inc/` bundles the 4J abstraction layer headers directly:
- `4J_Render.h` (Direct3D 9 render abstraction)
- `4J_Input.h` (gamepad input)
- `4J_Profile.h` (profiles and achievements)
- `4J_Storage.h` (save data)
- `4J_xtms.h` (Title Managed Storage)

### Audio

`Xbox/Audio/SoundEngine.h/.cpp` contains the Xbox 360-specific sound engine implementation.

### Font System

`Xbox/Font/` adds a custom XUI font system:
- `XUI_Font.h/.cpp` with font loading
- `XUI_FontData.h/.cpp` with glyph data
- `XUI_FontRenderer.h/.cpp` with the rendering pipeline

### Sentient Telemetry

`Xbox/Sentient/` bundles the full Sentient analytics SDK:
- `DynamicConfigurations.h/.cpp` for runtime configuration
- `SentientManager.h/.cpp` for the telemetry manager
- `SentientStats.h/.cpp` for stat tracking
- `SentientTelemetryCommon.h`, `TelemetryEnum.h`, `MinecraftTelemetry.h`
- `Include/` subdirectory with the complete Sentient client API (SenClientCore, SenClientStats, SenClientConfig, SenClientUGC, SenClientMarkers, SenClientFame, SenClientNews, and more)

### Network Extra

`Xbox/Network/extra.h` provides extra networking definitions not present in LCEMP.

### Content and Build Directories

MinecraftConsoles includes several content and build directories:
- `ContentPackageBuild/` for content package creation
- `Title Update/` for title update packaging
- `SubmissionBuild/` and `ReleaseBuild/` for release builds
- `Cheats/` for cheat/debug functionality
- `TMSFiles/` for Title Managed Storage test files
- `Docs/` for platform documentation
- `kinect/` for Kinect integration assets
- `Audio/` for sound data
- `loc/` for localization strings
