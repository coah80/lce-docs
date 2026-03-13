---
title: Building & Compiling
description: How to set up and build the LCE project.
---

## Prerequisites

- **CMake** 3.10 or higher
- **MSVC** (Visual Studio), since the project uses MSVC-specific compiler flags
- **Windows**, which is currently the only supported build target (the CMakeLists.txt explicitly checks for WIN32)

:::note
The codebase has platform code for Xbox 360, Xbox One, PS3, PS4, and PS Vita, but the CMake build system only targets Windows 64-bit right now.
:::

## Required Asset Directories

You need to provide these directories yourself. They're not included in the repository.

### Media & Resources
- `Minecraft.Client/music/`
- `Minecraft.Client/Common/Media/`
- `Minecraft.Client/Common/res/`
- `Minecraft.Client/Common/DummyTexturePack/`

### Platform Media
- `Minecraft.Client/DurangoMedia/`
- `Minecraft.Client/OrbisMedia/`
- `Minecraft.Client/PS3Media/`
- `Minecraft.Client/PSVitaMedia/`
- `Minecraft.Client/Windows64Media/`

### Runtime Files
- `Minecraft.Client/redist64/`
- `x64/Debug/iggy_w64.dll`
- `x64/Debug/mss64.dll`

### Platform-Specific
- `Minecraft.Client/PS3_GAME/`
- `Minecraft.Client/PS4_GAME/`
- `Minecraft.Client/sce_sys/`
- `Minecraft.Client/TROPDIR/`
- `Minecraft.Client/PS3/PS3Extras/DirectX/`
- `Minecraft.Client/PS3/PS3Extras/HeapInspector/`
- `Minecraft.Client/Common/Network/Sony/`
- `Minecraft.Client/common/dlc/`
- `Minecraft.Client/durango/sound/`

### 4J Libraries (per platform)
- `Minecraft.Client/Xbox/4JLibs/`
- `Minecraft.Client/Windows64/4JLibs/`
- `Minecraft.Client/PSVita/4JLibs/`
- `Minecraft.Client/PS3/4JLibs/`
- `Minecraft.Client/Orbis/4JLibs/`
- `Minecraft.Client/Durango/4JLibs/`

### Middleware (per platform)
- Miles Sound System (`Miles/` directories)
- Iggy UI (`Iggy/` directories)
- Sentient Telemetry (`Sentient/` directories)

### Other
- `Minecraft.Client/PS3/PS3Extras/boost_1_53_0/`
- `Minecraft.Client/xbox/MinecraftWindows.rc`
- `Minecraft.Client/xbox/MinecraftWindows.ico`
- `Minecraft.Client/xbox/small.ico`

## Build Steps

1. Get the required assets listed above
2. Replace your `Minecraft.Client` and `Minecraft.World` source folders with the LCE ones
3. Build using CMake:

```bash
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

4. Run with optional launch arguments

## CMake Configuration

The build system defines two targets:

### MinecraftWorld (Static Library)
```
Compile definitions:
  _LARGE_WORLDS
  _LIB
  _CRT_NON_CONFORMING_SWPRINTFS
  _CRT_SECURE_NO_WARNINGS
  _WINDOWS64

Debug-only additions:
  _DEBUG_MENUS_ENABLED
  _DEBUG
```

### MinecraftClient (Win32 Executable)
```
Compile definitions:
  _LARGE_WORLDS
  _CRT_NON_CONFORMING_SWPRINTFS
  _CRT_SECURE_NO_WARNINGS
  _WINDOWS64

Debug-only additions:
  _DEBUG_MENUS_ENABLED
  _DEBUG
```

### Compiler Flags
- `/W3` — Warning level 3
- `/MP` — Multi-process compilation
- `/MT` or `/MTd` — Multi-threaded static CRT (matches 4J libs)
- `/EHsc` — C++ exception handling

### Link Libraries
- `MinecraftWorld` (static)
- `d3d11` (Direct3D 11)
- `XInput9_1_0` (controller input)
- `iggy_w64.lib` (UI framework)
- `mss64.lib` (Miles Sound System)
- `4J_Input_r.lib` / `4J_Input_d.lib`
- `4J_Storage_r.lib` / `4J_Storage_d.lib`
- `4J_Profile_r.lib` / `4J_Profile_d.lib`
- `4J_Render_PC.lib` / `4J_Render_PC_d.lib`

## Launch Arguments

| Argument | Usage | Description |
|----------|-------|-------------|
| `-name` | `-name <username>` | Sets your in-game username |
| `-ip` | `-ip <targetip>` | Manually connect to an IP if LAN advertising doesn't work |
| `-port` | `-port <targetport>` | Override the default port if changed in source |

**Example:**
```
Minecraft.Client.exe -name Steve -ip 192.168.0.25 -port 25565
```

## Important Defines

| Define | Purpose |
|--------|---------|
| `_LARGE_WORLDS` | Enables large world support |
| `_WINDOWS64` | Windows 64-bit target |
| `_DEBUG_MENUS_ENABLED` | Debug menus (Debug builds only) |
| `_DEBUG` | Debug mode (Debug builds only) |
