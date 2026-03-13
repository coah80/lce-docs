---
title: "Build System & CI"
description: "Build differences, CI/CD, C++17, and Linux support."
---

MinecraftConsoles supports two build methods: the original Visual Studio solution (`.sln`) and a newer CMake-based build. Both target Windows x64 exclusively at build time.

## C++17

The CMake build enforces C++17:

```cmake
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
```

The project uses C++17 features throughout the codebase, including `shared_ptr`, `make_shared`, `dynamic_pointer_cast`, and modern STL containers.

## Build methods

### Visual Studio solution

**File**: `MinecraftConsoles.sln`

The primary build method, documented in `COMPILE.md`:

1. Open `MinecraftConsoles.sln` in Visual Studio 2022.
2. Set `Minecraft.Client` as the Startup Project.
3. Select configuration: `Debug` (recommended) or `Release`.
4. Select platform: `Windows64`.
5. Build with `Ctrl+Shift+B`, run with `F5`.

### CMake

**File**: `CMakeLists.txt`

A supplementary build system that generates a Visual Studio 2022 solution.

**Configure**:

```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64 \
  -DCMAKE_GENERATOR_INSTANCE="C:/Program Files/Microsoft Visual Studio/2022/Community"
```

**Build**:

```powershell
cmake --build build --config Debug --target MinecraftClient
cmake --build build --config Release --target MinecraftClient
```

**Run**:

```powershell
cd .\build\Debug
.\MinecraftClient.exe
```

The game relies on relative paths (e.g., `Common\Media\...`), so launching from the output directory is required.

## Project structure

The CMake build defines two targets:

| Target | Type | Description |
|--------|------|-------------|
| `MinecraftWorld` | Static library | Game logic, entities, items, tiles, commands |
| `MinecraftClient` | Win32 executable | Rendering, UI, networking, platform code |

Source file lists are maintained in separate CMake includes:

- `cmake/WorldSources.cmake` -- all `Minecraft.World/` source files
- `cmake/ClientSources.cmake` -- all `Minecraft.Client/` source files

### Compile definitions

Both targets define:

- `_LARGE_WORLDS` -- extended world size support
- `_DEBUG_MENUS_ENABLED` -- debug menu availability
- `_CRT_NON_CONFORMING_SWPRINTFS` / `_CRT_SECURE_NO_WARNINGS` -- MSVC compatibility
- `_WINDOWS64` -- 64-bit platform flag
- `_DEBUG` (Debug only) / `_LIB` (World library only)

### MSVC options

The `configure_msvc_target()` function applies:

- `/W3` warnings in Debug, `/W0` in Release
- `/MP` multi-processor compilation
- `/FS` force synchronous PDB writes
- `/EHsc` C++ exception handling
- `/GL /O2 /Oi /GT /GF` whole-program optimization in Release
- `/LTCG /INCREMENTAL:NO` link-time code generation for Release

### Dependencies

`MinecraftClient` links against:

- `MinecraftWorld` (static library)
- `d3d11` -- DirectX 11 rendering
- `XInput9_1_0` -- controller input
- `wsock32` -- networking
- `legacy_stdio_definitions` -- MSVC compatibility
- Iggy libraries (`iggy_w64.lib`, `iggyperfmon_w64.lib`, `iggyexpruntime_w64.lib`) -- SWF/Flash UI rendering
- 4J libraries (`4J_Input.lib`, `4J_Storage.lib`, `4J_Render_PC.lib`) -- platform abstraction (debug/release variants)

## Platform support

### Windows (primary)

Both the `.sln` and CMake builds target Windows x64 only. The CMake build explicitly enforces this:

```cmake
if(NOT WIN32)
  message(FATAL_ERROR "This CMake build currently supports Windows only.")
endif()
if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
  message(FATAL_ERROR "Use a 64-bit generator/toolchain (x64).")
endif()
```

### Asset copying

The CMake build automatically copies runtime assets during configuration:

- **Windows**: Uses `robocopy.exe` to copy redistributables from `x64/Release/`, client assets (excluding source files), and DurangoMedia patches.
- **Unix/Linux**: Uses `rsync` with equivalent exclusion filters. This path exists for asset copying but the actual compilation still requires MSVC.

The asset copy excludes source files (`*.cpp`, `*.h`, etc.), build files, scripts, and platform-specific directories (`Durango*`, `Orbis*`, `PS*`, `Xbox`).

### Running on Linux

Per `COMPILE.md`, contributors on Linux need a Windows machine or VM to build. Running the compiled game via Wine is a separate concern from having a supported build environment.

The `CONTRIBUTING.md` notes that one of the project's goals is "having workable multi-platform compilation for ARM, Consoles, Linux" -- this is a future goal, not a current capability.

## CI/CD

MinecraftConsoles uses three GitHub Actions workflows:

### debug-test.yml (PR gate)

**Triggers**: Pull requests (opened, reopened, synchronize), pushes to `main`, and manual dispatch.

Runs a Debug build on `windows-latest` using MSBuild. This is the primary CI gate that validates all PRs compile successfully. Ignores changes to `.gitignore` and markdown files (both root and `.github/` markdown).

### nightly.yml (nightly release)

**Triggers**: Pushes to `main` and manual dispatch.

Builds a Release configuration on `windows-latest`, zips the output as `LCEWindows64.zip`, and publishes it as a nightly release using the `andelf/nightly-release` action. The release includes:

- `LCEWindows64.zip` -- full game package
- `Minecraft.Client.exe` -- standalone executable
- `Minecraft.Client.pdb` -- debug symbols

Release builds use MSVC v14.44.35207 with `/O2 /Ot /Oi /Ob3 /GF /fp:precise`.

### build.yml (manual)

**Triggers**: Manual dispatch only (`workflow_dispatch`).

Builds both Release and Debug configurations in a matrix strategy. Uploads artifacts for each configuration as `MinecraftClient-Release` and `MinecraftClient-Debug`.

## Code quality tools

### .clang-format

**File**: `.clang-format`

The project includes a clang-format configuration based on the Microsoft style:

| Setting | Value |
|---------|-------|
| Base style | Microsoft |
| Indent width | 4 |
| Tab width | 4 |
| Use tabs | Never |
| Column limit | 0 (unlimited) |
| Pointer alignment | Right (`int *ptr`) |
| Brace wrapping | Always after control statements |
| Insert braces | Yes (enforces braces on single-line blocks) |
| Sort includes | Case sensitive |
| Standard | Latest |

Notable settings: `InsertBraces: true` ensures all control flow blocks have braces, and `ColumnLimit: 0` disables line length enforcement.

## Differences from LCEMP build

| Aspect | LCEMP | MinecraftConsoles |
|--------|-------|-------------------|
| Build system | Visual Studio `.sln` | `.sln` + CMake |
| CI/CD | None documented | 3 GitHub Actions workflows |
| Code formatting | No enforced standard | `.clang-format` (Microsoft-based) |
| Nightly releases | None | Automated via GitHub Actions |
| PR validation | None | Debug build on every PR |
| Asset copying | Manual | Automated in CMake (robocopy/rsync) |

## Contributing

The `CONTRIBUTING.md` file outlines strict contribution guidelines:

- **Scope**: Stability, quality of life, and platform support over new content. No Java Edition backports, visual changes, or content without LCE precedent.
- **Parity**: Must match original LCE visual and gameplay experience.
- **Accepted changes**: Bug fixes, multi-platform support, SWF-free UI replacements, asset quality improvements, dedicated server menus, Steamworks networking, keyboard/mouse support.
- **PR requirements**: One topic per PR, fully documented changes, use the PR template. Undocumented changes cause closure.
- **AI policy**: Code written largely or noticeably by an LLM is not accepted.
