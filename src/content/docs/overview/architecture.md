---
title: Architecture
description: How the LCEMP codebase is organized and how the two main modules connect.
---

## Two-Module Architecture

LCEMP follows a strict two-module separation:

```
LCEMP/
├── Minecraft.World/       # Game logic (static library)
│   ├── *.h / *.cpp        # ~1,560 files flat in root
│   └── x64headers/        # Windows 64-bit specific headers
│
├── Minecraft.Client/      # Rendering, UI, platform (executable)
│   ├── *.h / *.cpp        # Core client code (root level)
│   ├── Common/            # Shared cross-platform code
│   │   ├── Audio/
│   │   ├── Colours/
│   │   ├── DLC/
│   │   ├── GameRules/
│   │   ├── Leaderboards/
│   │   ├── Media/
│   │   ├── Network/
│   │   ├── res/           # Resources (textures, fonts, etc.)
│   │   ├── Telemetry/
│   │   ├── Trial/
│   │   ├── Tutorial/
│   │   ├── UI/
│   │   ├── XUI/
│   │   └── zlib/
│   ├── Xbox/              # Xbox 360 platform layer
│   ├── Durango/           # Xbox One platform layer
│   ├── PS3/               # PlayStation 3 platform layer
│   ├── Orbis/             # PS4 platform layer
│   ├── PSVita/            # PS Vita platform layer
│   ├── Windows64/         # Windows 64-bit platform layer
│   ├── macOS/             # macOS platform layer
│   └── Windows_Libs/      # Windows dev libraries
│
├── CMakeLists.txt         # Build configuration
├── cmake/Sources.cmake    # Source file lists
└── MinecraftConsoles.sln  # Visual Studio solution
```

## Module Responsibilities

### Minecraft.World (Static Library)

This is the **game logic** layer. It has zero rendering code and no platform dependencies. Everything here is pure C++ game simulation:

| System | Key Classes | Purpose |
|--------|-------------|---------|
| **Blocks** | `Tile`, `StoneTile`, `GrassTile`, etc. | Block definitions, properties, behavior |
| **Items** | `Item`, `SwordItem`, `FoodItem`, etc. | Item definitions, tool tiers, food |
| **Entities** | `Entity`, `Mob`, `Player`, `Zombie`, etc. | All living and non-living entities |
| **World Gen** | `Biome`, `BiomeSource`, Layer classes | Terrain generation, biome placement |
| **Structures** | `StructureStart`, `VillagePieces`, etc. | Generated structures (villages, dungeons) |
| **AI** | `Goal`, `GoalSelector`, attack/move goals | Mob AI behavior trees |
| **Crafting** | `CraftingManager`, `FurnaceRecipes` | Recipe definitions |
| **Enchantments** | `Enchantment`, enchantment subclasses | Enchantment system |
| **Effects** | `MobEffect`, `MobEffectInstance` | Potion/status effects |
| **Containers** | `AbstractContainerMenu`, slot system | Inventory management |
| **Networking** | `Packet` subclasses, `Connection` | Network protocol packets |
| **Level** | `Level`, `LevelStorage`, chunk system | World state, saving, loading |
| **NBT** | `CompoundTag`, `ListTag`, etc. | Data serialization |

### Minecraft.Client (Executable)

This is the **presentation** layer. It depends on Minecraft.World and adds rendering, input, audio, and platform-specific code:

| System | Key Classes | Purpose |
|--------|-------------|---------|
| **Rendering** | `EntityRenderer`, `TileRenderer` | Entity and block rendering |
| **Models** | `HumanoidModel`, `ZombieModel`, etc. | 3D model definitions |
| **Particles** | `ParticleEngine`, `Particle` subclasses | Visual particle effects |
| **Screens** | `Screen`, `CreateWorldScreen`, etc. | GUI screens and menus |
| **Tesselator** | `Tesselator` | Vertex buffer builder |
| **Textures** | `TextureMap`, `TexturePackRepository` | Texture loading and management |
| **Input** | `Input` | Keyboard, mouse, controller |
| **Settings** | `Settings` | Game options |
| **Server** | `MinecraftServer`, `ServerLevel` | Integrated server for multiplayer |
| **Network** | `PlayerConnection` | Client-side network handler |

### Common (Shared Code)

The `Common` directory sits inside `Minecraft.Client` but is symlinked from the root as well. It contains cross-platform code used by all platform targets:

| Directory | Purpose |
|-----------|---------|
| `Audio/` | Sound system abstraction |
| `Colours/` | Color definitions and palettes |
| `DLC/` | Downloadable content management |
| `GameRules/` | Game rule definitions |
| `Leaderboards/` | Leaderboard system |
| `Media/` | Media file handling |
| `Network/` | Cross-platform networking |
| `res/` | Resources (textures, fonts, GUI, mob textures) |
| `Telemetry/` | Analytics/telemetry |
| `Trial/` | Trial/demo mode logic |
| `Tutorial/` | In-game tutorial system |
| `UI/` | UI framework |
| `XUI/` | Extended UI components |
| `zlib/` | Compression library |

## External Dependencies

### 4J Studios Libraries

4J Studios (the original LCE developer) created platform abstraction libraries:

| Library | Purpose |
|---------|---------|
| `4J_Input` | Cross-platform input abstraction |
| `4J_Storage` | Cross-platform file storage |
| `4J_Profile` | User profile management |
| `4J_Render` | Rendering abstraction layer |

These are provided as pre-compiled `.lib` files (debug `_d` and release `_r` variants).

### Third-Party Middleware

| Library | Purpose |
|---------|---------|
| **Iggy** | Scaleform-like UI framework (Flash-based UI rendering) |
| **Miles Sound System (MSS)** | Audio middleware by RAD Game Tools |
| **Sentient** | Telemetry/analytics system |
| **Direct3D 11** | Windows rendering API |
| **XInput** | Controller input (Windows) |
| **zlib** | Data compression |
| **libpng** | PNG image loading |
| **Boost 1.53** | C++ utility library (PS3 only) |

## Build Targets

| Target | Type | Links To |
|--------|------|----------|
| `MinecraftWorld` | Static library (.a/.lib) | Nothing (self-contained) |
| `MinecraftClient` | Win32 executable | MinecraftWorld + all external libs |

## Key Compile Definitions

| Define | Purpose |
|--------|---------|
| `_LARGE_WORLDS` | Enables large world support (larger than default) |
| `_WINDOWS64` | Windows 64-bit build target |
| `_DEBUG_MENUS_ENABLED` | Enables debug menus (debug builds only) |
| `_DEBUG` | Debug mode |

## Data Flow

```
Player Input → Input System → Game Logic (Minecraft.World)
                                    ↓
                              Level Updates
                                    ↓
                          Packet Serialization
                                    ↓
                         Network → Other Players
                                    ↓
                              Rendering Pass
                                    ↓
                     Tesselator → GPU → Screen
```

## File Naming Conventions

The codebase follows Minecraft's original Java naming conventions translated to C++:

- **Tiles** (blocks): Named after the Java equivalent (e.g., `GrassTile`, `OreTile`)
- **Entities**: Direct names (e.g., `Zombie.h`, `Skeleton.h`, `Pig.h`)
- **Packets**: Suffixed with `Packet` (e.g., `AddPlayerPacket`, `MovePlayerPacket`)
- **Goals** (AI): Suffixed with `Goal` (e.g., `MeleeAttackGoal`, `FollowParentGoal`)
- **Screens**: Suffixed with `Screen` (e.g., `CreateWorldScreen`, `FurnaceScreen`)
- **Models**: Suffixed with `Model` (e.g., `ZombieModel`, `DragonModel`)
- **Renderers**: Suffixed with `Renderer` (e.g., `EntityRenderer`, `BoatRenderer`)

## C++ Standard

The project targets **C++11** and uses:
- `shared_ptr` extensively for entity/item management
- `enable_shared_from_this` for self-referencing
- `wstring` for text (wide strings throughout)
- Traditional class inheritance hierarchy (no templates/generics)
