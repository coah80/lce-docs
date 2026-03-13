---
title: "Overview"
description: "Overview of the Minecraft.Client module."
---

The `Minecraft.Client` module is where all the client-side code lives for Legacy Console Edition Minecraft. This covers rendering, UI, input handling, audio, texture management, networking, and platform abstraction. It depends on `Minecraft.World` for the actual game logic (entities, tiles, levels, items) and provides the visual and interactive layer that players see and use.

## Module Entry Point

The central class is `Minecraft` (declared in `Minecraft.h`). It holds references to every major subsystem and acts as the root of the entire client. There is one global instance accessed via `Minecraft::GetInstance()`.

| Field | Type | Purpose |
|---|---|---|
| `level` | `MultiPlayerLevel*` | The active game level |
| `levels` | `MultiPlayerLevelArray` | All loaded levels (one per dimension) |
| `levelRenderer` | `LevelRenderer*` | World chunk rendering |
| `gameRenderer` | `GameRenderer*` | Per-frame render orchestration |
| `particleEngine` | `ParticleEngine*` | Particle spawning and drawing |
| `textures` | `Textures*` | Texture loading and binding |
| `soundEngine` | `SoundEngine*` | Audio playback (Miles Sound System) |
| `font` / `altFont` | `Font*` | Text rendering (default and alternate character sets) |
| `gui` | `Gui*` | HUD overlay (hotbar, chat, health) |
| `screen` | `Screen*` | Active menu screen (null when in-game) |
| `options` | `Options*` | Player settings |
| `user` | `User*` | Current user identity |
| `skins` | `TexturePackRepository*` | Texture pack management |
| `achievementPopup` | `AchievementPopup*` | Achievement toast notifications |
| `humanoidModel` | `HumanoidModel*` | Shared player model geometry |
| `hitResult` | `HitResult*` | Current block/entity the player is looking at |
| `timer` | `Timer*` | Frame timing and tick interpolation |
| `progressRenderer` | `ProgressRenderer*` | Loading screen progress bars |
| `gameMode` | `MultiPlayerGameMode*` | Client-side game mode handler |
| `player` | `shared_ptr<MultiplayerLocalPlayer>` | Primary local player |
| `cameraTargetPlayer` | `shared_ptr<Mob>` | Camera target (usually the player) |

## Split-Screen Architecture

LCE supports up to four local players through split-screen. The `Minecraft` class keeps per-player arrays for many subsystems:

```cpp
shared_ptr<MultiplayerLocalPlayer> localplayers[XUSER_MAX_COUNT];
MultiPlayerGameMode *localgameModes[XUSER_MAX_COUNT];
ItemInHandRenderer *localitemInHandRenderers[XUSER_MAX_COUNT];
StatsCounter* stats[4];
unsigned int uiDebugOptionsA[XUSER_MAX_COUNT];
```

Methods for managing split-screen:

| Method | What it does |
|--------|-------------|
| `addLocalPlayer(int idx)` | Re-arrange the screen and start a connection for a new player |
| `createExtraLocalPlayer(...)` | Create a local player with a name, pad, and dimension |
| `createPrimaryLocalPlayer(int iPad)` | Create the first player |
| `removeLocalPlayerIdx(int idx)` | Remove a split-screen player |
| `setLocalPlayerIdx(int idx)` | Switch which player viewport is active for rendering |
| `updatePlayerViewportAssignments()` | Recalculate viewport layout after a player joins/leaves |
| `storeExtraLocalPlayer(int idx)` | Save a player's state |

The `localPlayerIdx` field tracks which viewport is currently being rendered. Per-player connection state is tracked in `m_connectionFailed[]`, `m_connectionFailedReason[]`, and `m_pendingLocalConnections[]`.

## Game Loop

The game loop is split into three phases to fit with the console platform loop:

1. **`run()`** calls `run_middle()` and `run_end()` in sequence
2. **`run_middle()`** processes input, ticks game logic, renders frames
3. **`run_end()`** handles cleanup and frame timing

The `tick()` method drives per-tick updates. It takes `bFirst` (true for the first active viewport in split-screen) and `bUpdateTextures` (true when texture animations should advance). This separation lets split-screen viewports share texture tick work without doing it multiple times.

The main loop also calls `tickAllConnections()` to process incoming and outgoing network packets for all connected players.

### Frame Timing

`Timer` manages frame timing and tick interpolation. It calculates how many ticks need to run per frame and provides a partial tick value (`a` in render calls) for smooth interpolation between discrete game ticks. The game targets 20 ticks per second (`SharedConstants::TICKS_PER_SECOND`).

Performance metrics are tracked in static arrays:
- `frameTimes[512]` records frame render times
- `tickTimes[512]` records tick execution times

## Rendering Pipeline

### GameRenderer

`GameRenderer` is the per-frame render orchestrator. It handles:

- **Camera positioning** with smooth movement (`SmoothFloat` for turn, distance, rotation, tilt, roll)
- **FOV calculation** with effects like speed boost, slowdown, and bow zoom
- **Light texture** updates for the block/sky lighting lookup (4 light textures for split-screen)
- **View bobbing** and hurt-bob animations
- **Rain/snow rendering** with positional rain arrays
- **Fog and sky color** setup based on dimension and weather
- **Anaglyph 3D** support (red-cyan stereoscopic)
- **Pick (raycasting)** to find what the player is looking at

The render pass flows:
1. `setupCamera()` positions the camera
2. `renderLevel()` renders the world (terrain, entities, particles, overlays)
3. `renderItemInHand()` renders the held item
4. `setupGuiScreen()` configures 2D overlay rendering
5. GUI/HUD rendering happens through `Gui` and `Screen`

### LevelRenderer

`LevelRenderer` is the world renderer. It implements the `LevelListener` interface to receive world change events. Key responsibilities:

- **Chunk management**: Allocates and manages render chunks in a 3D grid around the player. On the Windows 64-bit build with large worlds, the view distance is 18 chunks (`PLAYER_VIEW_DISTANCE`)
- **Dirty chunk tracking**: Uses a lock-free stack (`XLockFreeStack<int>`) for marking chunks that need rebuilding
- **Multi-threaded chunk rebuilds**: Up to 4 concurrent rebuild threads (`MAX_CONCURRENT_CHUNK_REBUILDS`), each with its own `Chunk` workspace and thread-local `Tesselator`
- **Entity rendering**: `renderEntities()` dispatches to per-type renderers through `EntityRenderDispatcher`
- **Sky rendering**: Stars, sun/moon, sky dome, clouds (both simple and advanced), halo ring
- **Destroyed tile manager**: Tracks recently-destroyed blocks to provide temporary collision while chunk geometry rebuilds
- **Block destruction animation**: Crack overlay at 10 stages
- **Per-player state**: Separate level, chunk array, camera position, and tile renderer for each split-screen viewport

Memory limits per platform:
| Platform | Max Command Buffer |
|----------|-------------------|
| Windows 64-bit | 2047 MB |
| Xbox One | 512 MB |
| PS4 | 448 MB |
| PS3 | 110 MB |
| Xbox 360/Vita | 55 MB |

### Tesselator

`Tesselator` is the vertex buffer builder. It's the core of all geometry rendering. Key features:

- **Thread-local storage**: Each thread gets its own `Tesselator` instance via TLS (`tlsIdx`). The main thread and chunk rebuild threads each have independent vertex buffers
- **Max memory**: 16 MB per tesselator instance (split between two arrays)
- **Vertex format**: Position, UV, color, secondary UV (`tex2` for lightmap), normal
- **Compact format**: A compressed quad format for Xbox 360 that packs vertex data more tightly
- **Bounding box tracking**: The `Bounds` class tracks tight min/max bounds of all submitted vertices
- **PS Vita optimization**: Deferred alpha-cutout primitives (`alphaCutOutEnabled`) and optimized `tileQuad()`/`tileRainQuad()`/`tileParticleQuad()` functions

Usage pattern:
```cpp
Tesselator *t = Tesselator::getInstance();
t->begin();           // or begin(mode)
t->color(r, g, b);
t->tex(u, v);
t->vertex(x, y, z);
// ... more vertices ...
t->end();             // flushes to GPU
```

### TileRenderer

`TileRenderer` renders all block types. It has:

- **Per-tile-type rendering**: Handles 36 different render shapes (cubes, crosses, torches, water, redstone, doors, stairs, fences, pistons, brewing stands, anvils, etc.)
- **Ambient occlusion**: Smooth lighting by sampling brightness at block corners
- **Lighting cache**: Hash-based cache for `getLightColor()` calls to avoid redundant lookups during chunk rebuilds
- **Face culling**: Only renders faces that are actually visible (adjacent to air or transparent blocks)
- **Fixed texture override**: Can render all faces with one texture for breaking animation

### EntityRenderDispatcher

Maps entity types to their renderer via `eINSTANCEOF` keys in an `unordered_map`. One global instance (`EntityRenderDispatcher::instance`) handles all entity rendering. Provides the camera position offsets (`xOff`, `yOff`, `zOff`) used by all renderers.

### Entity Renderers

40+ renderer classes, one for each entity type:

| Renderer | Renders |
|----------|---------|
| `PlayerRenderer` | Player model with armor, cape, held item |
| `HumanoidMobRenderer` | Zombies, skeletons, pigmen (shared humanoid model) |
| `ZombieRenderer` | Zombie-specific textures and size |
| `CreeperRenderer` | Creeper with charge overlay |
| `SpiderRenderer` | Spider with glowing eyes |
| `EndermanRenderer` | Enderman with carried block and anger state |
| `EnderDragonRenderer` | Multi-part dragon with wing animation |
| `GhastRenderer` | Ghast with open/closed mouth |
| `SlimeRenderer` | Slime with transparent outer layer |
| `PigRenderer` / `CowRenderer` / `SheepRenderer` / `ChickenRenderer` | Farm animals |
| `WolfRenderer` | Wolf with collar color and angry state |
| `OzelotRenderer` | Cat/ocelot |
| `VillagerRenderer` / `VillagerGolemRenderer` | Villagers and iron golems |
| `BoatRenderer` / `MinecartRenderer` | Vehicles |
| `ArrowRenderer` / `FireballRenderer` | Projectiles |
| `ItemRenderer` / `ItemSpriteRenderer` | Dropped items |
| `PaintingRenderer` / `ItemFrameRenderer` | Hanging entities |
| `FallingTileRenderer` / `TntRenderer` | Falling blocks and TNT |
| `ExperienceOrbRenderer` | XP orbs |
| `LightningBoltRenderer` | Lightning |

### Models

3D models are built from `ModelPart` cubes:

- `HumanoidModel` is the base for player and humanoid mob models. It has head, body, right arm, left arm, right leg, left leg
- `Model` base class with `setupAnim()` (set rotations/positions per frame) and `render()` (draw to tesselator)
- Specialized models: `DragonModel` (multi-part with neck, jaw, wings), `ChestModel`/`LargeChestModel`, `SignModel`, `BookModel`, `SkeletonHeadModel`, `EnderCrystalModel`
- Additional model parts for DLC skins via `CMinecraftApp::SetAdditionalSkinBoxes()` and skin box geometry

## Particle System

`ParticleEngine` manages all particle effects:

- **5 texture layers**: Misc, terrain, item, entity particle, dragon breath
- **Max 200 particles per layer** (reduced from Java's 4,000 for console performance)
- **Max 1,000 dragon breath particles**
- **3 render arrays** to handle simultaneous dimensions (overworld + nether during portal)
- **25+ particle types**: `BreakingItemParticle`, `BubbleParticle`, `CritParticle`, `DragonBreathParticle`, `DripParticle`, `ExplodeParticle`, `FlameParticle`, `HeartParticle`, `LavaParticle`, `NoteParticle`, `NetherPortalParticle`, `RedDustParticle`, `SmokeParticle`, `SnowShovelParticle`, `SplashParticle`, `SuspendedParticle`, `TerrainParticle`, `WaterDropParticle`, etc.

Particles are spawned through `Level::addParticle()` using the `ePARTICLE_TYPE` enum (instead of Java's string identifiers).

## Texture System

### Texture Management

- `Textures` handles loading, binding, and caching of all textures
- `TextureMap` manages texture atlases with `StitchedTexture`, `Stitcher`, and `StitchSlot` for packing textures into atlas sheets
- `PreStitchedTextureMap` for pre-built atlas textures
- `BufferedImage` for in-memory image manipulation
- `MemTexture` for dynamically generated textures
- `CompassTexture` and `ClockTexture` for animated compass/clock items
- `HttpTexture` for downloading player skin textures
- `MobSkinMemTextureProcessor` and `MobSkinTextureProcessor` for processing downloaded mob skins

### Texture Packs

- `TexturePackRepository` manages the active texture pack stack
- `AbstractTexturePack` base with implementations: `DefaultTexturePack`, `FileTexturePack`, `FolderTexturePack`, `DLCTexturePack`
- Texture pack changes broadcast via `TexturePacket` and `TextureChangePacket`
- DLC texture packs through the `DLCManager` system

## Iggy/SWF UI Framework

The entire console UI is built on **Iggy**, a Flash/SWF-based UI framework. All menus, HUD elements, and overlays are SWF movies controlled from C++.

### Architecture

```
UILayer (manages multiple scenes)
└── UIScene (one SWF movie)
    ├── UIControl instances (buttons, labels, sliders, lists)
    ├── IggyPlayer (SWF movie player)
    ├── IggyValuePath (path to elements in the SWF DOM)
    └── IggyName (fast string lookup for function calls)
```

### UIScene Base

`UIScene` is the base class for all UI screens. It wraps an Iggy SWF movie and provides:

- Element mapping via macros (`UI_MAP_ELEMENT`, `UI_BEGIN_MAP_ELEMENTS_AND_NAMES`)
- Focus management (`m_iFocusControl`, `m_iFocusChild`)
- Timer system (duration-based timers for UI animations)
- Texture registration for items and blocks rendered in the UI
- Opacity control with update flags
- Back scene navigation
- Resolution variants: 1080p, 720p, 480p, Vita

### UI Controls

| Control | Purpose |
|---------|---------|
| `UIControl_Base` | Base control with Iggy value path binding |
| `UIControl_Button` | Clickable button |
| `UIControl_CheckBox` | Toggle checkbox |
| `UIControl_Slider` | Value slider |
| `UIControl_Label` | Text label |
| `UIControl_DynamicLabel` | Label with runtime text changes |
| `UIControl_HTMLLabel` | Rich text with HTML formatting |
| `UIControl_TextInput` | Text entry field |
| `UIControl_Progress` | Progress bar |
| `UIControl_ButtonList` | Scrollable button list |
| `UIControl_SlotList` | Inventory slot grid |
| `UIControl_Cursor` | Mouse/controller cursor |
| `UIControl_BitmapIcon` | Image display |
| `UIControl_SaveList` | World save list |
| `UIControl_DLCList` | DLC content list |
| `UIControl_TexturePackList` | Texture pack list |
| `UIControl_PlayerList` | Player list |
| `UIControl_LeaderboardList` | Leaderboard entries |
| `UIControl_EnchantmentBook` | Enchantment book animation |
| `UIControl_EnchantmentButton` | Enchantment option button |
| `UIControl_MinecraftPlayer` | 3D player model preview |
| `UIControl_PlayerSkinPreview` | Skin preview display |
| `UIControl_SpaceIndicatorBar` | Storage space indicator |

### UI Scenes (Menus)

Over 50 `UIScene_*` classes for every menu in the game:

| Category | Scenes |
|----------|--------|
| **Main Flow** | `UIScene_Intro`, `UIScene_MainMenu`, `UIScene_LoadOrJoinMenu`, `UIScene_LoadMenu`, `UIScene_CreateWorldMenu`, `UIScene_JoinMenu` |
| **In-Game** | `UIScene_HUD`, `UIScene_PauseMenu`, `UIScene_DeathMenu`, `UIScene_ConnectingProgress` |
| **Inventory/Crafting** | `UIScene_InventoryMenu`, `UIScene_CraftingMenu`, `UIScene_CreativeMenu`, `UIScene_AbstractContainerMenu` |
| **Tile Menus** | `UIScene_FurnaceMenu`, `UIScene_BrewingStandMenu`, `UIScene_DispenserMenu`, `UIScene_ContainerMenu`, `UIScene_EnchantingMenu`, `UIScene_AnvilMenu`, `UIScene_TradingMenu` |
| **Settings** | `UIScene_SettingsMenu`, `UIScene_SettingsGraphicsMenu`, `UIScene_SettingsAudioMenu`, `UIScene_SettingsControlMenu`, `UIScene_SettingsOptionsMenu`, `UIScene_SettingsUIMenu`, `UIScene_ControlsMenu` |
| **Info** | `UIScene_HowToPlay`, `UIScene_HowToPlayMenu`, `UIScene_Credits`, `UIScene_EndPoem`, `UIScene_EULA` |
| **DLC** | `UIScene_DLCMainMenu`, `UIScene_DLCOffersMenu`, `UIScene_SkinSelectMenu` |
| **Misc** | `UIScene_SignEntryMenu`, `UIScene_TeleportMenu`, `UIScene_LeaderboardsMenu`, `UIScene_MessageBox`, `UIScene_Timer`, `UIScene_Keyboard`, `UIScene_QuadrantSignin` |
| **Debug** | `UIScene_DebugOptions`, `UIScene_DebugOverlay`, `UIScene_DebugCreateSchematic`, `UIScene_DebugSetCamera` |
| **Host Options** | `UIScene_LaunchMoreOptionsMenu`, `UIScene_InGameHostOptionsMenu`, `UIScene_InGamePlayerOptionsMenu`, `UIScene_InGameInfoMenu` |

### IUIScene Interfaces

Container menu scenes implement `IUIScene_*` interfaces that bridge between the `AbstractContainerMenu` game logic and the SWF UI:

`IUIScene_AbstractContainerMenu`, `IUIScene_InventoryMenu`, `IUIScene_CraftingMenu`, `IUIScene_CreativeMenu`, `IUIScene_FurnaceMenu`, `IUIScene_BrewingMenu`, `IUIScene_EnchantingMenu`, `IUIScene_DispenserMenu`, `IUIScene_ContainerMenu`, `IUIScene_AnvilMenu`, `IUIScene_TradingMenu`, `IUIScene_HUD`, `IUIScene_PauseMenu`, `IUIScene_StartGame`

### UI Components

Reusable UI components drawn on top of scenes:

- `UIComponent_Chat` -- in-game chat overlay
- `UIComponent_Logo` -- Minecraft logo animation
- `UIComponent_Panorama` -- rotating panorama background for title screen
- `UIComponent_Tooltips` -- item tooltip display
- `UIComponent_TutorialPopup` -- tutorial hint popups
- `UIComponent_MenuBackground` -- generic menu background
- `UIComponent_PressStartToPlay` -- "Press Start" prompt
- `UIComponent_DebugUIConsole` -- debug console overlay
- `UIComponent_DebugUIMarketingGuide` -- marketing screenshot guide

## Input System

### Keyboard and Mouse (Windows 64-bit)

`KeyboardMouseInput` (`KeyboardMouseInput.h`) handles all PC input:

- **Key state tracking**: Down, pressed (just pressed), released (just released) for all 256 virtual key codes
- **Mouse buttons**: Left, right, middle with press/release tracking
- **Mouse movement**: Position, delta, raw delta accumulation
- **Mouse wheel**: Scroll delta
- **Mouse grab**: For first-person camera control
- **Default bindings**: W/A/S/D movement, Space jump, LShift sneak, LCtrl sprint, E inventory, Q drop, Tab/R crafting, Escape pause, F5 third person, F3 debug
- **Movement helpers**: `GetMoveX()` / `GetMoveY()` return -1 to 1 based on WASD
- **Look helpers**: `GetLookX()` / `GetLookY()` with sensitivity scaling

### Controller (Console)

`ConsoleInput` handles controller input through `4J_Input` library and XInput. The `ConsoleInputSource` interface provides an abstraction layer.

## Audio System

Audio is handled through the **Miles Sound System (MSS)**:

- `SoundEngine` base class with named sound lookups (`SoundNames`)
- `ConsoleSoundEngine` wraps MSS for the console platform
- Sounds are referenced by integer IDs (converted from Java's string names by 4J)
- 3D positional audio via `Level::playSound(double x, double y, double z, ...)`
- Entity-attached sounds via `Level::playSound(shared_ptr<Entity>, ...)`
- Streaming music through `LevelRenderer::playStreamingMusic()`

## Server System

### MinecraftServer

The integrated server runs in a separate thread when hosting multiplayer. Key members:

| Field | Type | Purpose |
|-------|------|---------|
| `connection` | `ServerConnection*` | Manages all player connections |
| `settings` | `Settings*` | Server configuration |
| `levels` | `ServerLevelArray` | Server-side levels (one per dimension) |
| `players` | `PlayerList*` | All connected players |
| `commandDispatcher` | `CommandDispatcher*` | Server command processing |
| `tickCount` | `int` | Server tick counter |

The server ticks at 20Hz (`MS_PER_TICK = 50ms`). Each tick:
1. Processes console inputs
2. Ticks all server levels (entity updates, world gen, random ticks)
3. Processes player connections
4. Handles post-processing requests (chunk light updates on a separate thread)

### Server Features

- **Pause support**: `IsServerPaused()` for single-player pause
- **Save on exit**: Configurable via `setSaveOnExit()`
- **Slow queue**: Rate-limited packet queue (`MINECRAFT_SERVER_SLOW_QUEUE_DELAY = 250ms`) that cycles through players for fairness
- **Post-processing thread**: Separate thread for chunk post-processing (lighting, structure placement) via `m_postUpdateThread`
- **Network protocol version**: 39 (`SharedConstants::NETWORK_PROTOCOL_VERSION`)

## CMinecraftApp -- Platform Application Shell

`CMinecraftApp` (`Common/Consoles_App.h`) is the platform application shell that manages everything outside of the core game:

### Game Settings

Profile data storage with per-player game settings (204 bytes per player). Settings include graphics options, control mappings, language, skin selections, favorite skins, and mash-up pack preferences. Changes are detected and applied through `CheckGameSettingsChanged()` and `ApplyGameSettingsChanged()`.

### DLC System

Full DLC pipeline:
- `DLCManager` handles DLC pack discovery, installation, and mounting
- DLC content types: audio files, textures, skins, capes, colour tables, game rules, localization strings, UI data
- Marketplace integration with per-platform store APIs
- TMS (title-managed storage) for DLC file downloads
- DLC credit tracking for credits screen attribution

### Game Rules System

`GameRuleManager` manages console-specific game rules:
- Level generation options and custom generators
- Schematic file processing for pre-built structures
- Named area rules, item collection rules, compound rules
- Separate from vanilla Minecraft game rules (which MinecraftConsoles adds later)

### Host Options

Configurable game hosting settings stored as a bitmask (`m_uiGameHostSettings`):
- Difficulty, PvP, TNT, fire spread
- Trust players, host privileges
- World size (in MinecraftConsoles)

### Other Systems

- **Sign-in management**: Tracks player sign-in state, handles sign-in changes
- **Invite processing**: Handles game invites from friends
- **Banned player list**: Per-player ban lists with TMS persistence
- **Tips system**: Rotating game tips and trivia (max 50 game tips + 20 trivia tips)
- **Localization**: Language and locale selection with string table loading
- **Save thumbnails**: Screenshot capture for world save thumbnails
- **Trial mode**: Demo version restrictions with timer

## Platform Directories

Platform-specific code lives in sibling directories at the `Minecraft.Client` level:

| Directory | Platform | Key Classes |
|-----------|----------|-------------|
| `Windows64/` | Windows 64-bit | `CConsoleMinecraftApp` (app shell), `WinsockNetLayer` (TCP networking), `WindowsLeaderboardManager`, `Windows64_UIController`, `gdraw_d3d11` (D3D11 rendering) |
| `Durango/` | Xbox One | Durango app, networking, telemetry |
| `Orbis/` | PS4 | Orbis app, PS Plus integration |
| `PS3/` | PlayStation 3 | PS3 app, SPU jobs for chunk culling |
| `PSVita/` | PS Vita | Vita app with custom memory management |
| `Xbox/` | Xbox 360 | Xbox app, XUI integration, Xbox networking |

### Windows 64-bit Platform Layer

The PC-specific code in `Windows64/` includes:

- **`Windows64_App.h`**: `CConsoleMinecraftApp` inherits from `CMinecraftApp` and implements platform-specific methods (save thumbnails, TMS file loading, etc.)
- **`Windows64_Minecraft.cpp`**: WinMain entry point, window creation, message pump, D3D11 initialization
- **`WinsockNetLayer`**: The entire LCEMP multiplayer networking layer built on Winsock TCP sockets with UDP LAN discovery
- **`KeyboardMouseInput`**: PC keyboard and mouse input handling
- **`gdraw_d3d11`**: Direct3D 11 graphics wrapper for the Iggy UI framework
- **`Windows64_UIController`**: Platform-specific UI controller bindings
- **`WindowsLeaderboardManager`**: Stub leaderboard implementation for Windows

Conditional compilation (`#ifdef _DURANGO`, `#ifdef __ORBIS__`, `#ifdef __PS3__`, `#ifdef __PSVITA__`, `#ifdef _XBOX`, `#ifdef _WINDOWS64`) gates platform-specific behavior throughout the shared code.

## Networking (Client-Side)

### Connection Flow

1. **Discovery**: `WinsockNetLayer::StartDiscovery()` listens for UDP broadcasts on port 25566
2. **Connection**: `WinsockNetLayer::JoinGame()` or `HostGame()` opens TCP sockets
3. **Handshake**: `PreLoginPacket` and `LoginPacket` exchange version info and player data
4. **Gameplay**: `ClientConnection` and `PlayerConnection` handle packet I/O
5. **Disconnect**: `DisconnectPacket` with reason codes (kicked, server closed, version mismatch, etc.)

### Client Connection Classes

| Class | Role |
|-------|------|
| `ClientConnection` | Client's connection to the server, handles incoming packets |
| `PendingConnection` | Connection in progress (during handshake) |
| `ServerConnection` | Server-side, manages all player connections |
| `PlayerConnection` | Server-side per-player handler |
| `CGameNetworkManager` | High-level session management (host, join, leave, invite) |

### Disconnect Reasons

The `DisconnectPacket::eDisconnectReason` enum covers: kicked, server closed, connection lost, version mismatch, server full, and various platform-specific reasons.

## Key Constants

```cpp
static const wstring VERSION_STRING;                    // game version
static const int frameTimes_length = 512;               // FPS history buffer
static const int tickTimes_length = 512;                // tick time history buffer
static const int NETWORK_PROTOCOL_VERSION = 39;         // network version
static const int TICKS_PER_SECOND = 20;                 // game tick rate
```

The `Minecraft` class also exposes some static helpers:

- `Minecraft::useFancyGraphics()` checks the fancy graphics option
- `Minecraft::useAmbientOcclusion()` checks the AO option
- `Minecraft::renderNames()` checks if player names should be drawn
- `Minecraft::renderDebug()` checks if debug overlay is active
- `Minecraft::maxSupportedTextureSize()` returns the platform texture size limit

## Level Management

The client can hold multiple levels at the same time (one per dimension: Overworld, Nether, End):

```cpp
MultiPlayerLevel *level;           // primary active level
MultiPlayerLevelArray levels;      // all loaded levels
Level *animateTickLevel;           // level used for animation ticks
```

`setLevel()` switches the active level, with parameters to control stats saving and player insertion. `getLevel(dimension)` retrieves a level by dimension ID. `forceaddLevel()` inserts a level without the normal setup (used during game load for secondary dimensions).

## MinecraftConsoles Differences

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
