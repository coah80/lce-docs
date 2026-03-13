---
title: Architecture
description: How the LCE codebase is organized and how the two main modules connect.
---

## Two-Module Architecture

LCE is split into two clearly separated modules. `Minecraft.World` is a self-contained static library with zero rendering code and zero platform dependencies. `Minecraft.Client` is the executable that adds rendering, input, audio, and platform-specific code on top.

```
LCEMP/
├── Minecraft.World/       # Game logic (static library)
│   ├── *.h / *.cpp        # ~1,560 files flat in root
│   └── x64headers/        # Windows 64-bit specific headers
│
├── Minecraft.Client/      # Rendering, UI, platform (executable)
│   ├── *.h / *.cpp        # Core client code (root level)
│   ├── Common/            # Shared cross-platform code
│   │   ├── Audio/         # Miles Sound System wrapper
│   │   ├── Colours/       # Biome colour lookup tables
│   │   ├── DLC/           # DLC pack management
│   │   ├── GameRules/     # Console game rule system
│   │   ├── Leaderboards/  # Leaderboard integration
│   │   ├── Media/         # Media archive handling
│   │   ├── Network/       # Cross-platform networking (QNet)
│   │   ├── res/           # Resources (textures, fonts, etc.)
│   │   ├── Telemetry/     # Analytics/telemetry
│   │   ├── Trial/         # Trial/demo mode logic
│   │   ├── Tutorial/      # In-game tutorial system
│   │   ├── UI/            # Iggy SWF UI framework
│   │   ├── XUI/           # Xbox-specific XUI helpers
│   │   └── zlib/          # Compression library
│   ├── Xbox/              # Xbox 360 platform layer
│   ├── Durango/           # Xbox One platform layer
│   ├── PS3/               # PlayStation 3 platform layer
│   ├── Orbis/             # PS4 platform layer
│   ├── PSVita/            # PS Vita platform layer
│   ├── Windows64/         # Windows 64-bit platform layer
│   └── Windows_Libs/      # Windows dev libraries
│
├── CMakeLists.txt         # Build configuration
├── cmake/Sources.cmake    # Source file lists
└── MinecraftConsoles.sln  # Visual Studio solution
```

## Compilation Model

The build produces two targets:

| Target | Type | Depends On |
|--------|------|-----------|
| `MinecraftWorld` | Static library (.lib) | Nothing (self-contained) |
| `MinecraftClient` | Win32 executable (.exe) | MinecraftWorld + all external libs |

`MinecraftWorld` compiles first as a static `.lib`. Then `MinecraftClient` compiles and links against it, plus Direct3D 11, XInput, Iggy, Miles Sound System, and the 4J Studios platform libraries.

Both targets share these compile definitions:

| Define | Purpose |
|--------|---------|
| `_LARGE_WORLDS` | Enables large world support (bigger than the original 864x864 console worlds) |
| `_WINDOWS64` | Selects the Windows 64-bit platform layer |
| `_CRT_NON_CONFORMING_SWPRINTFS` | Compatibility for older C runtime string functions |
| `_CRT_SECURE_NO_WARNINGS` | Suppresses MSVC secure CRT warnings |

Debug builds add:

| Define | Purpose |
|--------|---------|
| `_DEBUG_MENUS_ENABLED` | Enables in-game debug menus and debug overlay |
| `_DEBUG` | General debug mode flag |

MinecraftWorld also gets `_LIB` to indicate it's being compiled as a static library.

### Compiler Flags

| Flag | What it does |
|------|-------------|
| `/W3` | Warning level 3 |
| `/MP` | Multi-process compilation (parallel .cpp compilation) |
| `/MT` or `/MTd` | Multi-threaded static CRT (matches 4J libs' CRT linkage) |
| `/EHsc` | C++ exception handling model |

## Dependency Graph

```
MinecraftClient.exe
├── MinecraftWorld.lib (static, game logic)
├── d3d11.lib (Direct3D 11 rendering)
├── XInput9_1_0.lib (controller input)
├── iggy_w64.lib (Iggy SWF/Flash UI framework)
├── mss64.lib (Miles Sound System audio)
├── 4J_Input_r.lib / 4J_Input_d.lib (input abstraction)
├── 4J_Storage_r.lib / 4J_Storage_d.lib (file storage)
├── 4J_Profile_r.lib / 4J_Profile_d.lib (user profiles)
└── 4J_Render_PC.lib / 4J_Render_PC_d.lib (rendering)
```

Release libraries use the `_r` suffix, debug libraries use `_d`.

### Include Paths

`MinecraftWorld` includes:
- `Minecraft.World/` (its own root)
- `Minecraft.World/x64headers/` (Windows 64-bit specific headers)

`MinecraftClient` includes:
- `Minecraft.Client/` (its own root)
- `Minecraft.Client/Windows64/Iggy/include/` (Iggy UI headers)
- `Minecraft.Client/Xbox/Sentient/Include/` (Sentient telemetry headers)

Note that `MinecraftClient` can include headers from `MinecraftWorld` via relative paths like `..\..\Minecraft.World\Entity.h`. The dependency only goes one way: Client depends on World, never the other way around. There is one exception: `Minecraft.World.cpp` includes `..\..\Minecraft.Client\ServerLevel.h` because the static constructor needs to call `ServerLevel::staticCtor()`.

## Module Responsibilities

### Minecraft.World (Static Library)

This is the **game logic** layer. No rendering code, no platform dependencies. Pure C++ game simulation.

| System | Key Classes | Purpose |
|--------|-------------|---------|
| **Blocks** | `Tile`, `StoneTile`, `GrassTile`, `OreTile`, etc. | Block definitions, properties, behavior. 172 tile IDs registered |
| **Items** | `Item`, `WeaponItem`, `FoodItem`, `ArmorItem`, `DiggerItem` | Item definitions, tool tiers, food, armor, enchantability |
| **Entities** | `Entity`, `Mob`, `Player`, `Zombie`, `Skeleton`, `EnderDragon` | All living and non-living entities with `eINSTANCEOF` type system |
| **World Gen** | `Biome`, `BiomeSource`, `Layer` subclasses | 23 biomes, layer-based biome map pipeline |
| **Structures** | `StructureFeature`, `StructureStart`, `VillagePieces` | Villages, strongholds, mine shafts, nether bridges, jungle temples, desert temples |
| **AI** | `Goal`, `GoalSelector`, attack/move/look goals | Mob behavior with prioritized goal system |
| **Navigation** | `PathNavigation`, `PathFinder`, `Node`, `BinaryHeap` | A* pathfinding over a node graph |
| **Crafting** | `Recipes`, `ShapedRecipy`, `ShapelessRecipy`, `FurnaceRecipes` | ~100 shaped/shapeless recipes plus smelting |
| **Enchantments** | `Enchantment`, 20 subclasses, `EnchantmentHelper` | Protection, damage, digging, bow, thorns enchantments |
| **Effects** | `MobEffect`, `MobEffectInstance`, `PotionBrewing` | 19 status effects and potion brewing |
| **Containers** | `AbstractContainerMenu`, slot system | Inventory UI logic: crafting, furnace, brewing, enchanting, anvil, trading |
| **Networking** | `Packet` subclasses (98 packet types), `Connection` | Client-server protocol for all game state sync |
| **Level** | `Level`, `LevelChunk`, `Dimension` | World state, tick loop, lighting, chunks, dimensions |
| **Storage** | `LevelStorage`, `ConsoleSaveFile`, `McRegionChunkStorage` | Save/load in console save format and McRegion format |
| **NBT** | `CompoundTag`, `ListTag`, `Tag` hierarchy | Named Binary Tag serialization for all persistent data |
| **Commands** | `Command`, `GiveItemCommand`, `GameModeCommand`, etc. | 10 server commands |
| **Stats** | `Stat`, `Achievement`, `StatsCounter` | Gameplay statistics and achievement tracking |
| **Materials** | `Material`, `MaterialColor` | Block material properties (solid, liquid, flammable) |
| **Math/Physics** | `AABB`, `Vec3`, `Pos`, `TilePos`, `Mth`, `Random`, `Facing` | Collision boxes, vectors, positions, math utilities |
| **Villages** | `Village`, `Villages`, `VillageSiege` | Village door tracking and zombie siege events |
| **Damage** | `DamageSource`, `EntityDamageSource`, `IndirectEntityDamageSource` | Damage type registry (fire, fall, entity, etc.) |
| **Trading** | `MerchantRecipe`, `MerchantRecipeList`, `ClientSideMerchant` | Villager trade offer system |

### Minecraft.Client (Executable)

This is the **presentation** layer. It depends on Minecraft.World and adds everything players see and interact with.

| System | Key Classes | Purpose |
|--------|-------------|---------|
| **Core** | `Minecraft` | Central class holding references to every subsystem |
| **Rendering** | `GameRenderer`, `LevelRenderer`, `EntityRenderer` | Per-frame orchestration, world rendering, entity rendering |
| **Tesselator** | `Tesselator` | Vertex buffer builder with thread-local storage for multi-threaded chunk rebuilds |
| **Tile Rendering** | `TileRenderer`, `TileEntityRenderDispatcher` | Block rendering with AO, lighting cache, face culling |
| **Entity Rendering** | `EntityRenderDispatcher`, `MobRenderer`, 40+ renderer classes | Entity type to renderer mapping, all mob and entity renderers |
| **Models** | `HumanoidModel`, `ZombieModel`, `DragonModel`, etc. | 3D model definitions built from `ModelPart` cubes |
| **Particles** | `ParticleEngine`, 25+ `Particle` subclasses | Visual particle effects with per-layer rendering (max 200 per layer) |
| **Screens** | `Screen`, `CreateWorldScreen`, `PauseScreen`, `ChatScreen` | GUI screen hierarchy |
| **Textures** | `Textures`, `TextureMap`, `TexturePackRepository`, `Stitcher` | Texture loading, atlas stitching, texture pack management |
| **Input** | `KeyboardMouseInput` (PC), `ConsoleInput` (controller) | WASD, mouse look, controller via XInput |
| **Font** | `Font`, `UIBitmapFont`, `UITTFFont` | Text rendering with default and alternate character sets |
| **GUI** | `Gui`, `GuiComponent` | HUD overlay (hotbar, chat, health, experience bar) |
| **Settings** | `Options` | 17 game options (music, sound, sensitivity, render distance, etc.) |
| **Server** | `MinecraftServer`, `ServerLevel`, `PlayerList` | Integrated server for multiplayer hosting |
| **Networking** | `PlayerConnection`, `ServerConnection`, `ClientConnection` | Client-side and server-side network handlers |
| **Camera** | `Camera`, `GameRenderer` | First/third person camera with smooth movement |
| **Split-Screen** | Per-player arrays in `Minecraft` class | Up to 4 local split-screen players |
| **Audio** | `SoundEngine`, `ConsoleSoundEngine` | Miles Sound System wrapper |

### Common (Shared Code)

The `Common/` directory lives inside `Minecraft.Client` and contains cross-platform code shared by all platform targets:

| Directory | Key Classes | Purpose |
|-----------|-------------|---------|
| `Audio/` | `SoundEngine`, `ConsoleSoundEngine`, `SoundNames` | Miles Sound System abstraction with named sound lookups |
| `Colours/` | `ColourTable` | Biome colour lookup from colour tables |
| `DLC/` | `DLCManager`, `DLCPack`, `DLCFile` subclasses | DLC content: audio, textures, skins, capes, colour tables, game rules, localization, UI data |
| `GameRules/` | `GameRuleManager`, `GameRule`, `LevelGenerationOptions`, `ConsoleSchematicFile` | Console-specific game rules, level generators, schematic system for custom structures |
| `Leaderboards/` | `LeaderboardManager` | Platform leaderboard integration |
| `Media/` | Media archive handling | Loading bundled media archives |
| `Network/` | `CGameNetworkManager`, `PlatformNetworkManagerInterface`, `SessionInfo` | Game-level networking: hosting, joining, session discovery, player management via QNet |
| `Telemetry/` | `TelemetryManager` | Usage analytics/telemetry |
| `Trial/` | `TrialMode` | Demo/trial version restrictions with timer |
| `Tutorial/` | `FullTutorial`, `TutorialTask` subclasses, hints, constraints | Full tutorial system with area constraints, crafting tasks, pickup tasks, stat tracking |
| `UI/` | `UIScene`, `UIControl`, `UILayer`, `UIController`, 50+ scene/control classes | Console UI framework built on Iggy (Flash/SWF). Scenes for every menu: HUD, inventory, crafting, settings, DLC store, etc. |
| `XUI/` | XUI helpers | Xbox-specific XUI integration |
| `zlib/` | zlib 1.2.x | Data compression (deflate, inflate, crc32, adler32) |

## External Dependencies

### 4J Studios Libraries

4J Studios built platform abstraction libraries that LCE depends on. These come as pre-compiled `.lib` files:

| Library | Purpose |
|---------|---------|
| `4J_Input` | Cross-platform input abstraction (controller, keyboard) |
| `4J_Storage` | Cross-platform file storage, save management, profile data, DLC mounting |
| `4J_Profile` | User profile management, game settings persistence |
| `4J_Render` | Rendering abstraction layer (wraps D3D11, GCM, GNM, etc.) |

### Third-Party Middleware

| Library | Purpose |
|---------|---------|
| **Iggy** | Flash/SWF-based UI framework. All console menus and HUD elements are SWF movies controlled from C++ via `IggyPlayer`, `IggyValuePath`, and `IggyName` APIs |
| **Miles Sound System (MSS)** | Audio middleware by RAD Game Tools. Handles sound playback, music streaming, 3D positional audio |
| **QNet** | Networking library used internally by the platform network managers for reliable UDP/TCP communication between console players |
| **Sentient** | Telemetry/analytics system for tracking gameplay events |
| **Direct3D 11** | Windows rendering API (used only in the Windows64 platform layer) |
| **XInput** | Controller input on Windows |
| **zlib** | Data compression for chunk data, save files, and network packets |

Other console-specific dependencies:
- **Boost 1.53** (PS3 only)
- **libpng** (for PNG image loading, save thumbnails)

## Static Constructor Initialization

LCE uses a **static constructor** pattern to register all game objects at startup. The entry point is `MinecraftWorld_RunStaticCtors()` in `Minecraft.World.cpp`, and the order matters:

```
1.  Packet::staticCtor()           - Register all 98 network packet types
2.  MaterialColor::staticCtor()    - Block material color palette
3.  Material::staticCtor()         - Block material types (solid, liquid, etc.)
4.  Tile::staticCtor()             - All 172 block types + auto-generate TileItems
5.  HatchetItem/PickaxeItem/ShovelItem::staticCtor() - Tool effectiveness tables
6.  BlockReplacements::staticCtor() - Block replacement mappings
7.  Biome::staticCtor()            - All 23 biome definitions
8.  Item::staticCtor()             - All items (offset by 256 from tile IDs)
9.  FurnaceRecipes::staticCtor()   - Smelting recipe table
10. Recipes::staticCtor()          - Crafting recipe table (~100 recipes)
11. Stats::staticCtor()            - Stats and achievements
12. Skeleton/PigZombie::staticCtor() - Mob-specific static data
13. TileEntity::staticCtor()       - Tile entity type registry (13 types)
14. EntityIO::staticCtor()         - Entity serialization registry
15. MobCategory::staticCtor()      - Mob spawn categories
16. Item::staticInit()             - Post-init item setup
17. LevelChunk::staticCtor()       - Chunk static data
18. LevelType::staticCtor()        - Level type registry (default, flat, large biomes)
19. Structure statics              - Mine shaft, stronghold, village, scattered feature piece data
20. EnderMan::staticCtor()         - Enderman carriable blocks list
21. PotionBrewing::staticCtor()    - Potion brewing recipe chains
22. Enchantment::staticCtor()      - All enchantment definitions
23. SharedConstants::staticCtor()  - Global constants
24. ServerLevel::staticCtor()      - Server level static data
25. Storage statics                - SparseLightStorage, CompressedTileStorage, etc.
26. Villager::staticCtor()         - Villager trade tables
27. GameType::staticCtor()         - Game mode definitions
```

The comment in source says: "The ordering of these static ctors can be important. If they are within statement blocks then DO NOT CHANGE the ordering - 4J Stu"

## Data Flow

Here's how data moves through the system during gameplay:

```
Player Input (keyboard/mouse/controller)
    │
    ▼
KeyboardMouseInput / ConsoleInput
    │
    ▼
Minecraft::tick() ──────────────────────────► MinecraftServer::tick()
    │                                              │
    ▼                                              ▼
MultiplayerLocalPlayer                        ServerLevel::tick()
    │                                              │
    ▼                                              ▼
MultiPlayerGameMode                           Entity::tick() for all entities
    │                                         Tile random ticks
    ▼                                         Weather, lighting, village siege
PlayerActionPacket / UseItemPacket                 │
    │                                              ▼
    ▼                                         Packet serialization
WinsockNetLayer (TCP)                              │
    │                                              ▼
    ▼                                    Network ── Other Players
PlayerConnection::handle()
    │
    ▼
Level state updates
    │
    ▼
LevelRenderer::setDirty() ──► Chunk rebuild (multi-threaded)
    │                              │
    ▼                              ▼
GameRenderer::render()         Tesselator ──► GPU vertex buffers
    │
    ▼
Direct3D 11 ──► Screen
```

## Networking Architecture (LCEMP)

LCEMP's multiplayer uses a TCP-based system built on top of Winsock:

| Component | Class | Role |
|-----------|-------|------|
| **Net Layer** | `WinsockNetLayer` | Low-level TCP socket management, LAN broadcast/discovery |
| **Game Network** | `CGameNetworkManager` | High-level session management, hosting, joining |
| **Server** | `MinecraftServer` | Integrated server running on the host's machine |
| **Server Connections** | `ServerConnection`, `PlayerConnection` | Server-side per-player connection handlers |
| **Client Connections** | `ClientConnection`, `PendingConnection` | Client-side connection to the server |
| **Packet System** | `Packet` base class, 98 subclasses | Serialized game state changes (movement, block updates, container clicks, etc.) |

The host runs both a `MinecraftServer` (game simulation) and a `MinecraftClient` (rendering). Clients connect over TCP and exchange `Packet` objects serialized through `DataInputStream`/`DataOutputStream`.

LAN discovery works by broadcasting a `Win64LANBroadcast` struct over UDP on port 25566 with a magic value `0x4D434C4E` ("MCLN"). The struct includes the host name, game port, player count, host settings, and texture pack info. Clients listen on the same port and build a list of discovered sessions.

## Thread Safety

4J Studios added thread safety throughout the codebase for multi-threaded chunk rebuilding. Key patterns:

- **Critical sections** (`CRITICAL_SECTION`) around entity lists (`m_entitiesCS`), tile entity lists (`m_tileEntityListCS`), lighting (`m_checkLightCS`), and chunk flags (`m_csDirtyChunks`)
- **Thread-local storage** (TLS via `DWORD tlsIdx`) for the lighting cache, tile shapes, `Tesselator` instances, and `Vec3` pools. Each thread that rebuilds chunks gets its own storage
- **Lock-free stack** (`XLockFreeStack<int>`) for the dirty chunk queue in `LevelRenderer`
- **Per-player arrays** in `LevelRenderer` for levels, chunks, tile renderers, and camera positions to support split-screen without locking

The multi-threaded chunk rebuild system uses up to 4 concurrent rebuild threads (`MAX_CONCURRENT_CHUNK_REBUILDS = 4`) on the Windows 64-bit build, with activation events and completion events to coordinate work.

## Key Design Patterns

### Builder Pattern (Tile/Item Registration)

All tiles and items are created through chained setter calls:

```cpp
Tile::obsidian = (new ObsidianTile(49))
    ->setDestroyTime(50.0f)
    ->setExplodeable(2000)
    ->setSoundType(Tile::SOUND_STONE)
    ->setTextureName(L"obsidian")
    ->setDescriptionId(IDS_TILE_OBSIDIAN);
```

Each setter returns `this`, so calls chain together nicely.

### eINSTANCEOF Type System

Instead of C++ `dynamic_cast` (which is slow), 4J added a custom type enumeration. Every entity overrides `GetType()` to return its `eINSTANCEOF` value, and the codebase uses `GetType() == eTYPE_ZOMBIE` instead of `dynamic_cast<Zombie*>(entity)`.

### GoalSelector AI

Mobs use a `GoalSelector` with prioritized `Goal` instances. Each goal has `canUse()`, `canContinueToUse()`, `start()`, `stop()`, and `tick()` methods. The selector runs the highest-priority goal that can currently be used. Mobs typically have two selectors: `goalSelector` for behavior (wander, eat, breed) and `targetSelector` for choosing targets (nearest attackable player, hurt-by retaliation).

### Listener Pattern

`Level` broadcasts events to `LevelListener` instances. `LevelRenderer` implements this interface to receive notifications about tile changes, entity additions/removals, sounds, particles, and level events, which trigger chunk rebuilds and visual updates.

## File Naming Conventions

The codebase follows Minecraft's original Java naming conventions, translated to C++:

- **Tiles** (blocks): `*Tile.h/.cpp` (e.g., `GrassTile`, `OreTile`, `FurnaceTile`)
- **Items**: `*Item.h/.cpp` (e.g., `BowItem`, `ArmorItem`, `FoodItem`)
- **Tile entities**: `*TileEntity.h/.cpp` (e.g., `ChestTileEntity`, `FurnaceTileEntity`)
- **Tile items**: `*TileItem.h/.cpp` (e.g., `LeafTileItem`, `ClothTileItem`)
- **Entities**: Direct names (e.g., `Zombie.h`, `Skeleton.h`, `Pig.h`)
- **Packets**: `*Packet.h/.cpp` (e.g., `MovePlayerPacket`, `TileUpdatePacket`)
- **Goals** (AI): `*Goal.h/.cpp` (e.g., `MeleeAttackGoal`, `FollowParentGoal`)
- **Enchantments**: `*Enchantment.h/.cpp` (e.g., `DamageEnchantment`, `ProtectionEnchantment`)
- **Biomes**: `*Biome.h/.cpp` (e.g., `DesertBiome`, `JungleBiome`)
- **Features** (world gen): `*Feature.h/.cpp` (e.g., `OreFeature`, `TreeFeature`)
- **Layers** (biome gen): `*Layer.h/.cpp` (e.g., `ZoomLayer`, `RiverLayer`)
- **Screens**: `*Screen.h/.cpp` (e.g., `CreateWorldScreen`, `PauseScreen`)
- **Models**: `*Model.h/.cpp` (e.g., `ZombieModel`, `DragonModel`)
- **Renderers**: `*Renderer.h/.cpp` (e.g., `EntityRenderer`, `BoatRenderer`)
- **Recipes**: `*Recip*.h/.cpp` (note inconsistent spelling: `Recipy`, `Recipies`, `Recipes`)
- **Aggregate headers**: `net.minecraft.*.h` files that bundle related headers (e.g., `net.minecraft.world.level.tile.h` includes all tile headers)

## C++ Standard and Patterns

The project targets **C++11** and uses:

- `shared_ptr` heavily for entity/item/tile entity management
- `enable_shared_from_this` so entities can get shared pointers to themselves
- `weak_ptr` for the rider/riding relationship to avoid circular references
- `wstring` for all text throughout (wide strings)
- `unordered_map` and `unordered_set` for fast lookups
- Traditional class inheritance (no templates or generics for game logic)
- Virtual functions for polymorphism (entities, tiles, items, packets, goals)
- Static arrays indexed by ID for tiles (`Tile::tiles[4096]`) and items (`Item::items[32000]`)
