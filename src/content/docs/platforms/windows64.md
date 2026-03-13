---
title: Windows 64
description: Windows 64-bit platform implementation.
---

The Windows 64-bit port is the main development target for LCEMP. It lives in `Minecraft.Client/Windows64/` and provides a full PC implementation using Direct3D 11 for rendering and Winsock2 for networking.

## Key Files

| File | Purpose |
|------|---------|
| `Windows64_App.h/.cpp` | `CConsoleMinecraftApp` application class |
| `Windows64_Minecraft.cpp` | Entry point (`WinMain`), main game loop |
| `Windows64_UIController.h/.cpp` | `ConsoleUIController` with Iggy-based UI |
| `Windows64_PostProcess.h/.cpp` | Gamma correction post-process shader |
| `Network/WinsockNetLayer.h/.cpp` | TCP/UDP LAN networking layer |
| `Leaderboards/WindowsLeaderboardManager.h/.cpp` | Leaderboard stub |
| `Minecraft_Macros.h` | Slot display and skin bitmask packing macros |
| `4JLibs/inc/4J_Render.h` | `C4JRender` class, Direct3D 11 rendering abstraction |
| `4JLibs/inc/4J_Input.h` | `C_4JInput` class, gamepad/keyboard input |
| `4JLibs/inc/4J_Storage.h` | `C4JStorage` class, filesystem save/load |
| `4JLibs/inc/4J_Profile.h` | Profile management |

## Application Class

`CConsoleMinecraftApp` inherits from `CMinecraftApp` and provides a minimal implementation for PC. It handles:

- Thumbnail capture (`m_ThumbnailBuffer` of type `ImageFileBuffer`)
- TMS file loading (local filesystem)
- Stub implementations for console-specific features (banned list, string table returns `NULL`)

## Entry Point and Main Loop

`Windows64_Minecraft.cpp` defines the Win32 entry point. The startup sequence:

1. Parse command-line arguments for username, resolution, and multiplayer options
2. Create the Win32 window with `CreateWindowEx`
3. Initialize Direct3D 11 device and swap chain
4. Initialize `RenderManager`, `InputManager`, `ProfileManager`, `StorageManager`
5. Define gamepad action mappings (`DefineActions`), same Xbox 360 button layout
6. Initialize thread-local storage for `Tesselator`, `AABB`, `Vec3`, `IntCache`, `Compression`
7. Call `Minecraft::main()` to set up the game instance
8. Run the intro sequence, then enter the main game loop

The main loop processes input, profiles, storage, rendering, sound, network ticks, and UI (Iggy) rendering each frame.

Global configuration:
- Default resolution: 1920x1080 (`g_iScreenWidth`, `g_iScreenHeight`)
- Username stored in `g_Win64Username` (max 16 characters)

## Rendering

Uses Direct3D 11 through the `C4JRender` abstraction in `4JLibs/inc/4J_Render.h`. The render manager provides an OpenGL-style API with constants like `GL_SRC_ALPHA`, `GL_DEPTH_BUFFER_BIT`, etc., mapped to D3D11 equivalents.

Key rendering features:
- Matrix stack (modelview, projection, texture)
- Command buffer system for batched rendering (`CBuffCreate`, `CBuffStart`, `CBuffCall`)
- Texture management with create/bind/data upload
- Splitscreen viewport support (fullscreen, 2-way split, 4-way quadrants)
- Conditional rendering with survey/query system

A dedicated post-process pass handles gamma correction via `Windows64_PostProcess.h`:
```cpp
bool InitGammaPostProcess();
void ApplyGammaPostProcess();
void SetGammaValue(float gamma);
```

## Input Handling

`C_4JInput` (the `InputManager` singleton) provides:

- Gamepad support with Xbox 360-style button constants (`_360_JOY_BUTTON_A`, etc.)
- Three control schemes (MAP_STYLE_0, MAP_STYLE_1, MAP_STYLE_2) for remappable layouts
- Analog stick access with deadzone and sensitivity settings
- Key repeat rate configuration
- Keyboard input dialog (`RequestKeyboard`) with multiple modes (default, numeric, password, alphabet, IP address)
- String verification against offensive word lists (TCR 092 compliance)
- Southpaw and swap-triggers axis remapping

The Windows 64 port also includes `KeyboardMouseInput` for PC-native keyboard and mouse controls.

## Networking

The `WinsockNetLayer` class provides a custom TCP-based networking layer with LAN discovery:

### Connection Model
- **Host**: Listens on a configurable port (default `25565`) and accepts TCP connections via a dedicated accept thread
- **Client**: Connects to a host via IP/port
- **Max clients**: 7 (`WIN64_NET_MAX_CLIENTS`), max packet size 3 MB

### Player Identification
Each connected player gets a `smallId` (single byte) for efficient addressing. The layer supports:
- `SendToSmallId` for sending data to a specific player
- `PopPendingJoinSmallId` / `PopDisconnectedSmallId` for tracking join/leave events
- Thread-safe connection management with per-connection `CRITICAL_SECTION` locks

### LAN Discovery
UDP broadcast on port `25566` (`WIN64_LAN_DISCOVERY_PORT`) with a `Win64LANBroadcast` packet containing:
- Magic number `0x4D434C4E` ("MCLN")
- Net version, game port, host name
- Player count, max players, game settings
- Texture pack IDs, joinability flag, dedicated server flag
- Player names (up to 8 slots)

Discovery runs on a separate thread and returns `Win64LANSession` structs via `GetDiscoveredSessions()`.

### Multiplayer Globals
```cpp
extern bool g_Win64MultiplayerHost;
extern bool g_Win64MultiplayerJoin;
extern int g_Win64MultiplayerPort;
extern char g_Win64MultiplayerIP[256];
```

## UI Controller

`ConsoleUIController` inherits from `UIController` (Iggy-based) and provides Direct3D 11-specific rendering:

- Initialized with `ID3D11Device`, `ID3D11DeviceContext`, render target view, and depth stencil view
- Custom draw callbacks for Iggy regions (`beginIggyCustomDraw4J`, `setupCustomDraw`, `endCustomDraw`)
- Texture substitution support (`getSubstitutionTexture`, `destroySubstitutionTexture`)

## Storage

Uses filesystem-based storage through `C4JStorage`. Save data is stored as local files. The `SAVE_INFO` struct contains UTF-8 filenames, titles, metadata (modification time, data size, thumbnail size), and thumbnail data.

## Unique Platform Features

- **Keyboard and mouse input**: Full `KeyboardMouseInput` class for PC controls alongside gamepad
- **Windowed mode**: Win32 window creation with configurable resolution
- **Post-process gamma**: Shader-based gamma correction since Windows doesn't provide system-level gamma like consoles do
- **No DRM/commerce**: Simplified app class without storefront integration
- **Command-line multiplayer**: Can specify host/join via command-line globals
