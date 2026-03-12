---
title: macOS
description: macOS platform implementation.
---

The macOS platform layer lives in `Minecraft.Client/macOS/`. It is the most minimal platform implementation in the codebase — many subsystems are present only as empty stubs, suggesting this port was either early-stage or used primarily as a development/testing target.

## Key files

| File | Purpose |
|------|---------|
| `macOS/4JLibs/inc/4J_Render.h` | Metal rendering abstraction (`C4JRender` / `RenderManager`) |
| `macOS/4JLibs/inc/4J_Input.h` | Input manager (`C_4JInput` / `InputManager`) |
| `macOS/4JLibs/inc/4J_Storage.h` | Storage manager (`C4JStorage` / `StorageManager`) |
| `macOS/4JLibs/inc/4J_Profile.h` | Profile manager (`C4JProfile` / `ProfileManager`) |
| `macOS/Iggy/include/iggy.h` | Iggy UI library stub (empty) |
| `macOS/Iggy/gdraw/gdraw_metal.h` | GDraw Metal rendering stub (empty) |
| `macOS/Sentient/SentientManager.h` | Telemetry manager stub (empty) |

## Rendering — Metal via C4JRender

The macOS renderer is built on Apple's **Metal** API, wrapped by the same `C4JRender` singleton used on all platforms. The header defines the full rendering interface:

```
RenderManager  →  global singleton alias for C4JRender
```

### OpenGL compatibility constants

Despite targeting Metal, the header defines OpenGL-style symbolic constants for blend modes, texture formats, and primitive types:

- **Blend factors**: `BLEND_ZERO`, `BLEND_ONE`, `BLEND_SRC_ALPHA`, `BLEND_DST_ALPHA`, etc.
- **Blend operations**: `BLENDOP_ADD`, `BLENDOP_SUBTRACT`, `BLENDOP_REVSUBTRACT`, `BLENDOP_MIN`, `BLENDOP_MAX`
- **Texture formats**: `FMT_A8R8G8B8`, `FMT_DXT1`, `FMT_DXT3`, `FMT_DXT5`, `FMT_R32F`, `FMT_A16B16G16R16F`, `FMT_A2R10G10B10`, etc.
- **Primitive types**: `PT_POINTLIST`, `PT_LINELIST`, `PT_LINESTRIP`, `PT_TRIANGLELIST`, `PT_TRIANGLESTRIP`, `PT_TRIANGLEFAN`
- **Cull modes**: `CULL_NONE`, `CULL_CW`, `CULL_CCW`
- **Compare functions**: `CMP_NEVER` through `CMP_ALWAYS`
- **Stencil operations**: `STENCILOP_KEEP`, `STENCILOP_ZERO`, `STENCILOP_REPLACE`, `STENCILOP_INCR`, etc.
- **Fill modes**: `FILL_WIREFRAME`, `FILL_SOLID`

These constants map internally to Metal equivalents, allowing the shared rendering code to use a single API surface across all platforms.

### Texture and buffer management

`C4JRender` provides:

- `CreateTexture()` / `LockTextureRect()` / `UnlockTextureRect()` — software texture manipulation
- `CreateVertexBuffer()` / `CreateIndexBuffer()` — geometry buffers
- `CreateRenderTarget()` / `SetRenderTarget()` / `ResolveRenderTarget()` — off-screen rendering
- `CreateDepthStencilSurface()` — depth buffer management
- `ImageFileBuffer` struct for thumbnail/screenshot capture

### Render state

State is managed through `SetRenderState()`, `SetSamplerState()`, and `SetTextureStageState()` with platform-agnostic enum keys that mirror Direct3D 9 conventions (e.g., `RS_ZENABLE`, `RS_ZWRITEENABLE`, `RS_ALPHABLENDENABLE`).

## Input — C_4JInput

The input system uses the same `C_4JInput` / `InputManager` singleton as other platforms. It provides:

- **Gamepad support**: Button constants for all standard controller inputs (`GAMEPAD_A`, `GAMEPAD_B`, `GAMEPAD_X`, `GAMEPAD_Y`, shoulder buttons, triggers, sticks, D-pad)
- **Action bitmask mapping**: `GetActions()` returns a bitmask of game actions; `ACTION_JUMP`, `ACTION_SNEAK`, `ACTION_ATTACK`, etc.
- **Keyboard modes**: `eKeyboardMode_None`, `eKeyboardMode_Chat`, `eKeyboardMode_Sign`, `eKeyboardMode_BookEdit`, `eKeyboardMode_BookSign`, `eKeyboardMode_Anvil`, `eKeyboardMode_CommandBlock`, `eKeyboardMode_CommandBlockMinecart`, `eKeyboardMode_Jigsaw`, `eKeyboardMode_StructureBlock`
- **Cursor management**: `IsCursorEnabled()`, `SetCursorEnabled()`
- **String verification**: `VerifyString()` for validating user text input

## Storage — C4JStorage

The storage manager provides:

- `SAVE_INFO` struct containing: save name, file name, file size, thumbnail data, thumbnail dimensions, and last-modified timestamp
- Standard save/load/delete operations
- Asynchronous saving state reporting (`IsSaving()`, `ESavingMessage`)
- Save-data enumeration for the world-select UI

## UI — stub architecture

The Iggy UI library headers exist in the macOS tree but are **empty stubs**:

- `macOS/Iggy/include/iggy.h` — present but contains no functional declarations
- `macOS/Iggy/gdraw/gdraw_metal.h` — Metal GDraw backend header is empty

This means the Iggy Flash-based menu system that powers the UI on all other platforms (except Xbox 360's XUI) was either not yet integrated on macOS or was handled through a different mechanism.

## Telemetry — Sentient stub

`macOS/Sentient/SentientManager.h` defines a `SentientManager` class that is completely empty. On other platforms (notably Xbox One and PS4), Sentient provides gameplay telemetry. The macOS stub suggests telemetry was not implemented for this platform.

## Networking

No platform-specific network manager header was found in the macOS directory. The macOS build likely either:

- Reuses the Windows `WinsockNetLayer` (BSD sockets are available on macOS)
- Was not intended for multiplayer

## Platform characteristics

| Aspect | Implementation |
|--------|---------------|
| **Graphics API** | Metal |
| **UI framework** | Iggy (stubbed) |
| **Input** | Gamepad + keyboard via `C_4JInput` |
| **Storage** | `C4JStorage` with `SAVE_INFO` |
| **Networking** | No platform-specific manager found |
| **Telemetry** | Sentient (stubbed) |
| **Maturity** | Partial — many subsystems are stubs |

The macOS platform represents the least complete implementation in the LCEMP codebase. The 4J library headers (`Render`, `Input`, `Storage`, `Profile`) are fully defined, but higher-level systems like UI and telemetry remain unimplemented stubs.
