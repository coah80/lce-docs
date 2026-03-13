---
title: Building & Compiling
description: How to set up and build the LCE project.
---

## Prerequisites

- **CMake** 3.10 or higher
- **MSVC** (Visual Studio 2022 recommended), since the project uses MSVC-specific compiler flags (`/W3`, `/MP`, `/MT`, `/EHsc`)
- **Windows**, which is the only supported build target (the CMakeLists.txt explicitly checks `if(NOT WIN32)` and errors out)

:::note
The codebase has platform code for Xbox 360, Xbox One, PS3, PS4, and PS Vita, but the CMake build system only targets Windows 64-bit right now. The other platforms use their own SDK build systems (Visual Studio solutions, SNC makefiles, etc.) which are not included.
:::

## Required Asset Directories

You need to provide these directories yourself. They are not included in the repository.

### Media & Resources

These are the core content files the game needs to run:

| Directory | What's in it |
|-----------|-------------|
| `Minecraft.Client/music/` | Background music files (played through Miles Sound System) |
| `Minecraft.Client/Common/Media/` | Media archive containing bundled game data |
| `Minecraft.Client/Common/res/` | Resources: textures, fonts, GUI assets, mob textures |
| `Minecraft.Client/Common/DummyTexturePack/` | Fallback texture pack used when no other pack is loaded |

### Platform Media

Each platform has its own media directory with platform-specific assets:

- `Minecraft.Client/DurangoMedia/` (Xbox One)
- `Minecraft.Client/OrbisMedia/` (PS4)
- `Minecraft.Client/PS3Media/` (PS3)
- `Minecraft.Client/PSVitaMedia/` (PS Vita)
- `Minecraft.Client/Windows64Media/` (Windows 64-bit, this is the one you need for PC builds)

### Runtime DLLs

These DLLs need to be in the working directory at runtime:

| File | What it is |
|------|-----------|
| `x64/Debug/iggy_w64.dll` | Iggy SWF/Flash UI runtime |
| `x64/Debug/mss64.dll` | Miles Sound System runtime |

### Redistributable

- `Minecraft.Client/redist64/` contains redistributable runtime files

### 4J Libraries (per platform)

Each platform has its own set of 4J Studios pre-compiled libraries:

| Directory | Contains |
|-----------|----------|
| `Minecraft.Client/Windows64/4JLibs/` | `4J_Input`, `4J_Storage`, `4J_Profile`, `4J_Render_PC` (release `_r` and debug `_d` variants) |
| `Minecraft.Client/Xbox/4JLibs/` | Xbox 360 4J libraries |
| `Minecraft.Client/Durango/4JLibs/` | Xbox One 4J libraries |
| `Minecraft.Client/PS3/4JLibs/` | PS3 4J libraries |
| `Minecraft.Client/Orbis/4JLibs/` | PS4 4J libraries |
| `Minecraft.Client/PSVita/4JLibs/` | PS Vita 4J libraries |

Only the Windows64 libraries are needed for PC builds.

### Middleware (per platform)

Each platform needs its own middleware binaries:

| Middleware | Directories |
|-----------|-------------|
| **Miles Sound System** | `Miles/` inside each platform directory |
| **Iggy UI** | `Iggy/` inside each platform directory (includes headers in `include/` and libs in `lib/`) |
| **Sentient Telemetry** | `Sentient/` inside each platform directory (includes headers in `Include/`) |

### PlayStation-Specific

Only needed if you're targeting PlayStation (not required for PC builds):

- `Minecraft.Client/PS3_GAME/` (PS3 game data)
- `Minecraft.Client/PS4_GAME/` (PS4 game data)
- `Minecraft.Client/sce_sys/` (Sony system files)
- `Minecraft.Client/TROPDIR/` (Trophy data)
- `Minecraft.Client/PS3/PS3Extras/DirectX/` (DirectX compatibility headers for PS3)
- `Minecraft.Client/PS3/PS3Extras/HeapInspector/` (Memory debugging tools)
- `Minecraft.Client/PS3/PS3Extras/boost_1_53_0/` (Boost library for PS3)
- `Minecraft.Client/Common/Network/Sony/` (Sony network platform manager)

### Other

- `Minecraft.Client/common/dlc/` (DLC content files, lowercase "common")
- `Minecraft.Client/durango/sound/` (Xbox One sound files, lowercase)
- `Minecraft.Client/xbox/MinecraftWindows.rc` (Windows resource file)
- `Minecraft.Client/xbox/MinecraftWindows.ico` (Application icon)
- `Minecraft.Client/xbox/small.ico` (Small application icon)

## Build Steps

### 1. Get the Required Assets

Collect all the assets listed above. At minimum for a Windows build you need:
- The `Common/res/`, `Common/Media/`, and `Common/DummyTexturePack/` directories
- The `Windows64Media/` directory
- The `Windows64/4JLibs/`, `Windows64/Iggy/`, `Windows64/Miles/`, and `Windows64/Sentient/` directories
- The runtime DLLs (`iggy_w64.dll`, `mss64.dll`)
- The resource file and icons from `xbox/`

### 2. Set Up the Source

Place the LCEMP `Minecraft.Client` and `Minecraft.World` source folders alongside the CMakeLists.txt. Your directory structure should look like:

```
LCEMP/
├── CMakeLists.txt
├── cmake/
│   └── Sources.cmake
├── Minecraft.World/
│   ├── *.h / *.cpp
│   └── x64headers/
├── Minecraft.Client/
│   ├── *.h / *.cpp
│   ├── Common/
│   ├── Windows64/
│   └── ...
└── Assets/              # Working directory (set via LCEMP_WORKING_DIR)
```

### 3. Generate the Build

```bash
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
```

This generates a Visual Studio 2022 solution targeting x64. You can also use other generators:

```bash
# Visual Studio 2019
cmake .. -G "Visual Studio 16 2019" -A x64

# Ninja (for faster builds)
cmake .. -G Ninja -DCMAKE_BUILD_TYPE=Release
```

### 4. Build

```bash
# Release build
cmake --build . --config Release

# Debug build (enables debug menus and debug overlay)
cmake --build . --config Debug
```

Or open the generated `.sln` file in Visual Studio and build from there.

### 5. Set the Working Directory

The game needs a working directory to find its assets. CMake sets this via the `LCEMP_WORKING_DIR` variable:

```bash
cmake .. -G "Visual Studio 17 2022" -A x64 -DLCEMP_WORKING_DIR="C:/path/to/your/assets"
```

If not set, it defaults to an `Assets/` folder next to the CMakeLists.txt. In Visual Studio, this is configured as the debugger working directory via `VS_DEBUGGER_WORKING_DIRECTORY`.

### 6. Copy Runtime DLLs

Make sure `iggy_w64.dll` and `mss64.dll` are in the output directory (next to the built exe) or in the working directory.

### 7. Run

```bash
Minecraft.Client.exe
```

Or run with launch arguments (see below).

## CMake Configuration Details

### MinecraftWorld Target (Static Library)

```
Type: STATIC library (.lib)

Compile definitions (Release):
  _LARGE_WORLDS
  _LIB
  _CRT_NON_CONFORMING_SWPRINTFS
  _CRT_SECURE_NO_WARNINGS
  _WINDOWS64

Compile definitions (Debug, adds):
  _DEBUG_MENUS_ENABLED
  _DEBUG

Include directories:
  Minecraft.World/
  Minecraft.World/x64headers/
```

### MinecraftClient Target (Win32 Executable)

```
Type: WIN32 executable (.exe)

Compile definitions (Release):
  _LARGE_WORLDS
  _CRT_NON_CONFORMING_SWPRINTFS
  _CRT_SECURE_NO_WARNINGS
  _WINDOWS64

Compile definitions (Debug, adds):
  _DEBUG_MENUS_ENABLED
  _DEBUG

Include directories:
  Minecraft.Client/
  Minecraft.Client/Windows64/Iggy/include/
  Minecraft.Client/Xbox/Sentient/Include/

Link libraries:
  MinecraftWorld.lib (the static library built above)
  d3d11.lib
  XInput9_1_0.lib
  Windows64/Iggy/lib/iggy_w64.lib
  Windows64/Miles/lib/mss64.lib
  Windows64/4JLibs/libs/4J_Input_r.lib (or _d for Debug)
  Windows64/4JLibs/libs/4J_Storage_r.lib (or _d for Debug)
  Windows64/4JLibs/libs/4J_Profile_r.lib (or _d for Debug)
  Windows64/4JLibs/libs/4J_Render_PC.lib (or _PC_d for Debug)
```

### Compiler Flags (MSVC)

| Flag | Purpose |
|------|---------|
| `/W3` | Warning level 3 (moderate warnings) |
| `/MP` | Multi-process compilation (compiles multiple .cpp files in parallel) |
| `/MT` | Multi-threaded static CRT for Release (matches 4J libs) |
| `/MTd` | Multi-threaded static debug CRT for Debug |
| `/EHsc` | C++ exception handling (synchronous exceptions only) |

The CRT linkage (`/MT` vs `/MTd`) is critical. The 4J libraries were compiled with the static multi-threaded CRT, so the game must match. Using `/MD` (dynamic CRT) will cause linker errors.

### Source File Lists

Source files are listed in `cmake/Sources.cmake` in two variables:

- `MINECRAFT_WORLD_SOURCES` (706 .cpp files)
- `MINECRAFT_CLIENT_SOURCES` (454 .cpp files, including `Common/` subdirectory sources and `Windows64/` platform sources)

CMake prepends the module directory path to each filename, so the source lists use relative paths like `"Tile.cpp"` and `"Common/UI/UIScene.cpp"`.

## Launch Arguments

| Argument | Usage | Description |
|----------|-------|-------------|
| `-name` | `-name <username>` | Sets your in-game username. Shows up in multiplayer for other players |
| `-ip` | `-ip <targetip>` | Manually connect to a server IP if LAN discovery doesn't find it |
| `-port` | `-port <targetport>` | Override the default port (25565) if the host changed it in source |

**Example:**
```
Minecraft.Client.exe -name Steve -ip 192.168.0.25 -port 25565
```

If you don't pass `-name`, the game uses a default username. If you don't pass `-ip`, the game uses LAN discovery (UDP broadcast on port 25566) to find local servers.

## Networking Constants

These are defined in `WinsockNetLayer.h` and can be changed if needed:

| Constant | Default | Purpose |
|----------|---------|---------|
| `WIN64_NET_DEFAULT_PORT` | 25565 | TCP port for game connections |
| `WIN64_NET_MAX_CLIENTS` | 7 | Max remote clients (host + 7 = 8 players) |
| `WIN64_NET_RECV_BUFFER_SIZE` | 65536 | TCP receive buffer size per connection |
| `WIN64_NET_MAX_PACKET_SIZE` | 3 MB | Max single packet size |
| `WIN64_LAN_DISCOVERY_PORT` | 25566 | UDP port for LAN broadcast/discovery |
| `WIN64_LAN_BROADCAST_MAGIC` | `0x4D434C4E` | Magic bytes in broadcast packet ("MCLN") |
| `WIN64_LAN_BROADCAST_PLAYERS` | 8 | Max player slots advertised |

## Compile Definitions Reference

| Define | Where | Purpose |
|--------|-------|---------|
| `_LARGE_WORLDS` | Both targets | Enables large world support. Changes the lighting cache type from `unsigned int` to `__uint64`, increases coordinate range |
| `_WINDOWS64` | Both targets | Selects Windows 64-bit platform layer. Guards platform-specific code blocks |
| `_LIB` | World only | Indicates static library compilation |
| `_DEBUG_MENUS_ENABLED` | Debug only | Enables debug options menu, debug overlay, debug console, schematic tools |
| `_DEBUG` | Debug only | General debug flag, enables assertions and extra validation |
| `_CRT_NON_CONFORMING_SWPRINTFS` | Both targets | Allows old-style swprintf without buffer size parameter |
| `_CRT_SECURE_NO_WARNINGS` | Both targets | Suppresses MSVC "unsafe function" warnings for strcpy, sprintf, etc. |

Other platform defines you'll see in the codebase (not used in the CMake PC build):

| Define | Platform |
|--------|----------|
| `_XBOX` | Xbox 360 |
| `_DURANGO` | Xbox One |
| `__PS3__` | PlayStation 3 |
| `__ORBIS__` | PlayStation 4 |
| `__PSVITA__` | PlayStation Vita |

## Troubleshooting

### Linker errors about unresolved symbols in 4J libs

Make sure you're using the matching CRT configuration. The 4J libraries use static multi-threaded CRT (`/MT`). If your project uses `/MD`, you'll get mismatched CRT linker errors. The CMakeLists.txt handles this with `CMAKE_MSVC_RUNTIME_LIBRARY`.

### Missing iggy_w64.dll or mss64.dll at runtime

Copy these DLLs to the same directory as your built .exe, or to the working directory. The game will crash on startup if it can't find them.

### Can't find assets / black screen

Check that the working directory (`LCEMP_WORKING_DIR`) points to where your game assets are. The game expects to find texture packs, media archives, and fonts in that directory.

### Build takes forever

The project has ~1,160 .cpp files across both targets. Use the `/MP` flag (already set in CMake) for parallel compilation. With Ninja generator instead of MSBuild, builds can be faster too.

### Connection refused in multiplayer

Make sure the host is running on port 25565 (TCP) and the LAN discovery port 25566 (UDP) is not blocked by your firewall. Both players need to be on the same LAN for discovery to work, or use the `-ip` flag to connect directly.
