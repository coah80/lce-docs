---
title: Overview
description: Platform abstraction layer in LCE.
---

The LCE codebase targets six platforms through a layered abstraction system developed by 4J Studios. Each platform directory under `Minecraft.Client/` has platform-specific implementations that plug into shared interfaces defined in `Minecraft.Client/Common/`.

## Supported Platforms

| Directory | Platform | Codename | Status |
|-----------|----------|----------|--------|
| `Xbox/` | Xbox 360 | | Original console port |
| `Durango/` | Xbox One | Durango | Next-gen Xbox |
| `PS3/` | PlayStation 3 | | Sony seventh-gen |
| `Orbis/` | PlayStation 4 | Orbis | Sony eighth-gen |
| `PSVita/` | PS Vita | | Sony handheld |
| `Windows64/` | Windows 64-bit | | PC port (LCE primary target) |

## Abstraction Pattern

Each platform implements the same set of core subsystems through a common class hierarchy.

### Application Layer (`CConsoleMinecraftApp`)

Every platform defines a `CConsoleMinecraftApp` class that inherits from `CMinecraftApp` (the shared base). This class is the main application object and owns:

- Rich presence management (`SetRichPresenceContext`)
- Screenshot and thumbnail capture (`CaptureSaveThumbnail`, `GetScreenshot`)
- TMS (Title Managed Storage) file loading (`LoadLocalTMSFile`, `FreeLocalTMSFiles`)
- DLC and commerce management (platform-specific storefronts)
- Application lifecycle (`StoreLaunchData`, `ExitGame`, `FatalLoadError`)

Each platform declares a global `app` instance:
```cpp
extern CConsoleMinecraftApp app;
```

### UI Controller (`ConsoleUIController`)

The UI system uses a two-tier abstraction:

- **`IUIController`** (`Common/UI/IUIController.h`) is the pure virtual interface defining all UI operations: scene navigation, tooltip management, HUD control, DLC handling, tutorial display, trial timer, and splitscreen support.
- **`UIController`** (`Common/UI/UIController.h`) is the base implementation used by most platforms. It uses the Iggy UI library (from RAD Game Tools) for Flash-based menus with custom draw callbacks.
- **`ConsoleUIController`** is the platform-specific subclass. Xbox 360 inherits directly from `IUIController` (using XUI), while all other platforms inherit from `UIController` (using Iggy).

Each platform declares a global `ui` instance:
```cpp
extern ConsoleUIController ui;
```

### Network Manager

Networking follows a three-layer architecture:

1. **`CPlatformNetworkManager`** (`Common/Network/PlatformNetworkManagerInterface.h`) is the abstract interface for session management, player tracking, host/join operations, and data transmission.
2. **Platform network managers** implement this interface using their native networking SDK:
   - Xbox 360: `CPlatformNetworkManagerXbox` using QNET (`IQNetCallbacks`)
   - Xbox One: `CPlatformNetworkManagerDurango` using `DQRNetworkManager` (Xbox Realtime Networking Sessions / XRNS)
   - PS3/PS4/Vita: `CPlatformNetworkManagerSony` using `SQRNetworkManager` variants (PSN Matching2 + RUDP)
   - Windows 64: `WinsockNetLayer` using raw Winsock2 TCP sockets with LAN discovery via UDP broadcast
3. **`CGameNetworkManager`** is the shared game-level manager that delegates to the platform layer.

### Rendering (`C4JRender`)

The 4J render abstraction (`RenderManager` singleton) wraps platform graphics APIs behind an OpenGL-style interface with:

- Matrix stack operations (modelview, projection, texture)
- Texture management (create, bind, data upload)
- State control (blend, depth, fog, lighting, culling)
- Command buffers for batched draw calls
- Viewport management for splitscreen

Xbox 360 uses Direct3D 9, Xbox One and Windows 64 use Direct3D 11. The Sony platforms use their native GNM/GCM renderers.

### Input (`C_4JInput`)

The `InputManager` singleton provides unified gamepad input across all platforms using a bitmask-based action mapping system. Actions are defined with `SetGameJoypadMaps()` and queried with `ButtonPressed()`, `ButtonDown()`, and analog stick accessors. Multiple control schemes (MAP_STYLE_0 through MAP_STYLE_2) allow remappable layouts.

### Storage (`C4JStorage`)

The `StorageManager` singleton handles save/load operations, DLC package mounting, and TMS file retrieval. Each platform provides native implementations for its storage model (Xbox content packages, PSN save data dialogs, filesystem on PC).

### Profiles and Achievements (`C4JProfile`)

The `ProfileManager` singleton manages player profiles, achievements/trophies, rich presence, and leaderboards. Platform-specific leaderboard managers (`XboxLeaderboardManager`, `DurangoLeaderboardManager`, `PS3LeaderboardManager`, `OrbisLeaderboardManager`, `PSVitaLeaderboardManager`, `WindowsLeaderboardManager`) inherit from a common `LeaderboardManager` base.

## Per-Platform Extras

Beyond the core abstractions, each platform has its own unique subsystems:

- **Xbox 360**: XUI scene graph for menus, social posting (`CSocialManager`), Kinect integration hooks, avatar awards
- **Xbox One**: Xbox Live Services (MXSS), party controller, chat integration layer, secure device associations
- **PS3**: Cell SPU job system (`C4JSpursJob`), Edge zlib compression, voice chat
- **PS4**: NP Toolkit integration, voice chat with party support, remote play, pronunciation XML
- **PS Vita**: Ad-hoc networking (`SQRNetworkManager_AdHoc_Vita`), custom memory allocators, `libdivide` optimizations
- **Windows 64**: Winsock LAN discovery, keyboard/mouse input, post-process gamma correction, Win32 windowed mode

## File Naming Conventions

Platform files follow consistent naming patterns:

- `{Platform}_App.h/.cpp` for the application class
- `{Platform}_UIController.h/.cpp` for the UI controller
- `{Platform}_Minecraft.cpp` for the entry point and main loop
- `Network/` subdirectory for the platform networking implementation
- `Leaderboards/` subdirectory for the leaderboard manager
- `Social/` subdirectory for social features (where applicable)
- `XML/` subdirectory for the XML parser (ATG XML parser, shared across platforms)
- `{Platform}Extras/` for platform-specific utilities and type stubs
