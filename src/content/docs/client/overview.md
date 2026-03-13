---
title: "Overview"
description: "Overview of the Minecraft.Client module."
---

The `Minecraft.Client` module is where all the client-side code lives for Legacy Console Edition Minecraft. This covers rendering, UI, input handling, audio, texture management, networking stubs, and platform abstraction. It depends on `Minecraft.World` for the actual game logic (entities, tiles, levels, items) and provides the visual and interactive layer that players see and use.

## Module entry point

The central class is `Minecraft` (declared in `Minecraft.h`). It holds references to every major subsystem:

| Field | Type | Purpose |
|---|---|---|
| `level` | `MultiPlayerLevel*` | The active game level |
| `levelRenderer` | `LevelRenderer*` | World chunk rendering |
| `gameRenderer` | `GameRenderer*` | Per-frame render orchestration |
| `particleEngine` | `ParticleEngine*` | Particle spawning and drawing |
| `textures` | `Textures*` | Texture loading and binding |
| `soundEngine` | `SoundEngine*` | Audio playback (Miles Sound System) |
| `font` / `altFont` | `Font*` | Text rendering (default and alternate character sets) |
| `gui` | `Gui*` | HUD overlay (hotbar, chat, health) |
| `screen` | `Screen*` | Active menu screen (nullable) |
| `options` | `Options*` | Player settings |
| `user` | `User*` | Current user identity |
| `skins` | `TexturePackRepository*` | Texture pack management |
| `achievementPopup` | `AchievementPopup*` | Achievement toast notifications |
| `humanoidModel` | `HumanoidModel*` | Shared player model geometry |
| `hitResult` | `HitResult*` | Current block/entity the player is looking at |
| `timer` | `Timer*` | Frame timing and tick interpolation |
| `progressRenderer` | `ProgressRenderer*` | Loading screen progress bars |

## Split-screen architecture

LCE supports up to four local players through split-screen. The `Minecraft` class keeps per-player arrays for many subsystems:

```cpp
shared_ptr<MultiplayerLocalPlayer> localplayers[XUSER_MAX_COUNT];
MultiPlayerGameMode *localgameModes[XUSER_MAX_COUNT];
ItemInHandRenderer *localitemInHandRenderers[XUSER_MAX_COUNT];
StatsCounter* stats[4];
```

Methods like `addLocalPlayer()`, `createExtraLocalPlayer()`, `removeLocalPlayerIdx()`, and `updatePlayerViewportAssignments()` handle the lifecycle of additional split-screen players. The `localPlayerIdx` field tracks which player viewport is currently being rendered.

## Game loop

The game loop is split into three phases to fit with the console platform loop:

1. **`run()`** calls `run_middle()` and `run_end()` in sequence
2. **`run_middle()`** processes input, ticks game logic, renders frames
3. **`run_end()`** handles cleanup and frame timing

The `tick()` method drives per-tick updates. It takes `bFirst` (true for the first active viewport) and `bUpdateTextures` (true when texture animations should advance). This separation lets split-screen viewports share texture tick work.

## Level management

The client can hold multiple levels at the same time (one per dimension: Overworld, Nether, End):

```cpp
MultiPlayerLevel *level;           // primary active level
MultiPlayerLevelArray levels;      // all loaded levels
Level *animateTickLevel;           // level used for animation ticks
```

`setLevel()` switches the active level, with parameters to control stats saving and player insertion. `getLevel(dimension)` retrieves a level by dimension ID.

## Connection to Minecraft.World

`Minecraft.Client` depends on `Minecraft.World` through direct includes:

- `Entity.h`, `Level.h`, `Vec3.h` for core game objects
- `LevelListener.h` so `LevelRenderer` can receive world change events
- `ProgressListener.h` so `ProgressRenderer` can handle loading progress callbacks
- `DisconnectPacket.h` for disconnect reason enumeration in multiplayer
- `C4JThread.h` for threading primitives shared across both modules

## Common/ subdirectory

The `Common/` subdirectory has platform-shared code organized into these areas:

| Directory | Purpose |
|---|---|
| `Audio/` | `SoundEngine` and `ConsoleSoundEngine` (Miles Sound System wrapper) |
| `Colours/` | `ColourTable` for biome colour lookup |
| `DLC/` | `DLCManager`, `DLCPack`, and all DLC file type headers |
| `GameRules/` | `GameRuleManager` and console-specific game rule constants |
| `Leaderboards/` | Leaderboard integration |
| `Media/` | Media archive handling |
| `Network/` | `GameNetworkManager`, `PlatformNetworkManagerInterface`, `SessionInfo` |
| `Telemetry/` | Usage telemetry |
| `Trial/` | `TrialMode` for demo/trial version restrictions |
| `Tutorial/` | Full tutorial system with tasks, hints, and constraints |
| `UI/` | Console UI framework (`UIScene`, `UIControl`, `UILayer` hierarchy) |
| `XUI/` | Xbox-specific XUI helpers |
| `res/` | Bundled resource files (textures, fonts, GUI assets) |
| `zlib/` | Compression library |

## CMinecraftApp

The `CMinecraftApp` class (in `Common/Consoles_App.h`) is the platform application shell. It manages:

- Game settings persistence (`GAME_SETTINGS` profile data)
- DLC installation and marketplace integration
- Sign-in state tracking and invite processing
- Menu actions through an action queue (`eXuiAction`, `eXuiServerAction`)
- Localization and string table loading
- Game host options (difficulty, PvP, TNT, fire spread, etc.)
- Banned player list management
- Tutorial mode and tips system

## Platform directories

Platform-specific code lives in sibling directories at the `Minecraft.Client` level:

- `Durango/` for Xbox One
- `Orbis/` for PS4
- `PS3/` for PlayStation 3
- `PSVita/` for PlayStation Vita
- `Xbox/` for Xbox 360
- `Windows64/` for Windows 64-bit build

Conditional compilation (`#ifdef _DURANGO`, `#ifdef __ORBIS__`, `#ifdef __PS3__`, `#ifdef __PSVITA__`, `#ifdef _XBOX`, `#ifdef _WINDOWS64`) gates platform-specific behavior throughout the shared code.

## Key constants

```cpp
static const wstring VERSION_STRING;                    // game version
static const int frameTimes_length = 512;               // FPS history buffer
static const int tickTimes_length = 512;                // tick time history buffer
```

The `Minecraft` class also exposes some static helpers:

- `Minecraft::useFancyGraphics()` checks the fancy graphics option
- `Minecraft::useAmbientOcclusion()` checks the AO option
- `Minecraft::renderNames()` checks if player names should be drawn
- `Minecraft::renderDebug()` checks if debug overlay is active
- `Minecraft::maxSupportedTextureSize()` returns the platform texture size limit

## MinecraftConsoles differences

MinecraftConsoles is a later version of the codebase (roughly TU19/1.6.4 era vs LCEMP's TU9/1.2.2 base). Here are the big structural differences at the module level:

- **`LivingEntityRenderer`** is a new intermediate class between `EntityRenderer` and `MobRenderer`. It pulls mob rendering logic (armor overlays, name tags, body rotation, arrow rendering) into its own layer.
- **`ResourceLocation`** is added as a proper type for texture paths, replacing raw string lookups. There's also a `TextureAtlas` class with `LOCATION_BLOCKS` and `LOCATION_ITEMS` static fields.
- **`BossMobGuiInfo`** tracks boss health bar state (health progress, display ticks, name, darken-world flag). LCEMP doesn't have the Wither boss so there's no boss health bar system.
- **New UI scene interfaces** are added: `IUIScene_HUD`, `IUIScene_BeaconMenu`, `IUIScene_CommandBlockMenu`, `IUIScene_FireworksMenu`, `IUIScene_HopperMenu`, `IUIScene_HorseInventoryMenu`.
- **`DLCCapeFile`** and **`DLCFile`** are new DLC file types for cape content.
- **`DurangoTelemetry`** adds Xbox One specific telemetry.
- **`UISplitScreenHelpers`** has split-screen utility functions not present in LCEMP.
- **`ChunkRebuildData`** is a separate class for chunk rebuild tracking instead of being inlined in `LevelRenderer`.
- The **`gdraw` graphics layer** is much bigger. LCEMP only has `gdraw_metal.h` (macOS port), while MinecraftConsoles has the original multi-platform set: `gdraw_d3d.h`, `gdraw_d3d10.h`, `gdraw_d3d11.h`, `gdraw_orbis.h`, `gdraw_ps3gcm.h`, `gdraw_psp2.h`, `gdraw_wgl.h`, plus the generic `gdraw.h`.
- **New host options** include `eGameHostOption_WorldSize`, `eGameHostOption_MobGriefing`, `eGameHostOption_KeepInventory`, `eGameHostOption_DoMobSpawning`, `eGameHostOption_DoMobLoot`, `eGameHostOption_DoTileDrops`, `eGameHostOption_NaturalRegeneration`, `eGameHostOption_DoDaylightCycle`.
- **Controller actions** add `ACTION_MENU_QUICK_MOVE` for quick-moving items in inventories.
