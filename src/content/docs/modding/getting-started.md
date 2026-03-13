---
title: Getting Started
description: How to set up your environment for modding LCEMP.
---

This guide covers the basics of adding new content to the LCEMP codebase. Before you start modding, make sure you can build the project first by following the [Building & Compiling](/lcemp-docs/overview/building/) guide.

## Prerequisites

- **CMake** 3.10+
- **MSVC** (Visual Studio 2022 recommended)
- **C++11**, the project standard is set via `set(CMAKE_CXX_STANDARD 11)` in `CMakeLists.txt`
- A working LCEMP build (see [Building & Compiling](/lcemp-docs/overview/building/))

## Project Structure

The codebase is split into two main modules:

```
LCEMP/
├── CMakeLists.txt              # Build system root
├── cmake/
│   └── Sources.cmake           # File lists for both targets
├── Minecraft.World/            # Static library (game logic)
│   ├── Tile.h / Tile.cpp       # Block (tile) base class + registration
│   ├── Item.h / Item.cpp       # Item base class + registration
│   ├── OreTile.h/.cpp          # Example Tile subclass
│   ├── WeaponItem.h/.cpp       # Example Item subclass
│   ├── FoodItem.h/.cpp         # Food item subclass
│   ├── ArmorItem.h/.cpp        # Armor item subclass
│   ├── Material.h/.cpp         # Block material types
│   ├── TileItem.h/.cpp         # Item representation of a placed tile
│   └── ...                     # Hundreds of other game classes
├── Minecraft.Client/           # Win32 executable (rendering, input, UI)
└── Common/                     # Shared utilities
```

**MinecraftWorld** is a static library that holds all the game logic: tiles, items, entities, levels, networking, and so on. **MinecraftClient** is the executable that handles rendering, input, and the UI, and it links against MinecraftWorld.

## Where to Add New Code

All game content (blocks, items, entities) lives in the `Minecraft.World/` directory. When you add new files:

1. Create your `.h` and `.cpp` files in `Minecraft.World/`
2. Add them to the `MINECRAFT_WORLD_SOURCES` list in `cmake/Sources.cmake`
3. Include the right aggregate headers in your `.cpp` (see below)

### Aggregate Headers

The codebase uses aggregate include headers to pull in related classes. Your `.cpp` files will usually start with:

```cpp
#include "stdafx.h"
#include "net.minecraft.world.level.tile.h"  // All tile classes
#include "net.minecraft.world.item.h"         // All item classes
#include "net.minecraft.world.entity.h"       // Entity classes
#include "net.minecraft.world.level.h"        // Level, LevelSource
```

## The Static Constructor Pattern

LCEMP uses a **static constructor** (`staticCtor`) pattern to register all game objects at startup. This is the main way new content gets added.

### How It Works

Each major system has a `staticCtor()` method that creates and configures every instance of that type:

- **`Tile::staticCtor()`** in `Tile.cpp` registers all blocks (tiles)
- **`Item::staticCtor()`** in `Item.cpp` registers all items

These get called once during game initialization, before any level is loaded. Each object is created with `new`, configured through chained setter calls, and stored in a static pointer and/or a global array.

### Tile Registration

Tiles are stored in a flat array indexed by tile ID:

```cpp
// From Tile::_init() -- called by the Tile constructor
Tile::tiles[id] = this;
```

The `Tile::tiles` array has `TILE_NUM_COUNT` (4096) slots. When you register a tile in `staticCtor()`, the constructor places it at `tiles[id]` automatically. After all tiles are registered, a loop at the end of `Tile::staticCtor()` creates a default `TileItem` for every tile that doesn't already have a custom item entry:

```cpp
for (int i = 0; i < 256; i++)
{
    if (Tile::tiles[i] != NULL)
    {
        if (Item::items[i] == NULL)
        {
            Item::items[i] = new TileItem(i - 256);
            Tile::tiles[i]->init();
        }
    }
}
```

### Item Registration

Items are stored in `Item::items`, an `ItemArray` of size 32000. The `Item` constructor adds 256 to the ID you pass in:

```cpp
Item::Item(int id) : id( 256 + id )
{
    maxStackSize = Item::MAX_STACK_SIZE;  // 64 by default
    // ...
}
```

So `new Item(4)` creates an item with `id == 260` (which is `Item::apple_Id`). This offset keeps item IDs separate from tile IDs (tiles use 0 through 255, items start at 256).

### Registration Example

Here's how a real tile is registered, taken directly from `Tile::staticCtor()`:

```cpp
Tile::obsidian = (new ObsidianTile(49))
    ->setDestroyTime(50.0f)
    ->setExplodeable(2000)
    ->setSoundType(Tile::SOUND_STONE)
    ->setTextureName(L"obsidian")
    ->setDescriptionId(IDS_TILE_OBSIDIAN)
    ->setUseDescriptionId(IDS_DESC_OBSIDIAN);
```

And a real item from `Item::staticCtor()`:

```cpp
Item::diamond = ( new Item(8) )
    ->setBaseItemTypeAndMaterial(eBaseItemType_treasure, eMaterial_diamond)
    ->setTextureName(L"diamond")
    ->setDescriptionId(IDS_ITEM_DIAMOND)
    ->setUseDescriptionId(IDS_DESC_DIAMONDS);
```

Both use a **builder pattern** where each setter returns `this` (as a `Tile*` or `Item*`), so you can chain the calls together.

## Choosing an Available ID

### Tile IDs

Tile IDs go from 0 to 4095 (`TILE_NUM_COUNT`), but the automatic TileItem loop only covers 0 through 255. The existing codebase uses IDs up to about 171 (`woolCarpet_Id`), with some gaps. Check `Tile.h` for the full list of `static const int` ID constants to find unused slots.

Some known unused IDs in the 0 to 255 range: 133 to 138 (gap between emeraldBlock at 133 and cobbleWall at 139, though 134/135/136 are stairs), 146 to 152, 154, 157 to 170, 172 to 255.

### Item IDs

Item IDs are offset by 256 internally. The constructor parameter is `id - 256`, so if you want final item ID 407, pass `151` to the constructor. Check `Item.h` for existing ID constants to avoid collisions.

## Tips for Debugging

- **Debug build** enables `_DEBUG_MENUS_ENABLED` and `_DEBUG` defines, which turn on in-game debug menus
- Set the working directory in Visual Studio via project properties or the CMake variable `LCEMP_WORKING_DIR`
- Use `-name`, `-ip`, and `-port` launch arguments for testing multiplayer (see [Building & Compiling](/lcemp-docs/overview/building/))
- The codebase uses `shared_ptr<>` a lot for entities and players, so watch for lifetime issues when adding new interactions
- If your tile isn't showing up, make sure it has a non-NULL entry in `Tile::tiles[]` and that a matching `TileItem` or custom item exists in `Item::items[]`

## Next Steps

- [Adding Blocks](/lcemp-docs/modding/adding-blocks/) to create and register a new tile (block)
- [Adding Items](/lcemp-docs/modding/adding-items/) to create and register a new item
