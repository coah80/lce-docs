---
title: Adding Blocks
description: Step-by-step guide to adding new blocks (tiles) to LCE.
---

Blocks in LCE are called **tiles**. Every block in the game (stone, dirt, furnaces, doors, you name it) is either a subclass or direct instance of the `Tile` class defined in `Minecraft.World/Tile.h`. This guide walks you through creating a new tile from scratch, based on how existing tiles work in the source code.

## Overview of the Tile System

The base `Tile` class gives you:

- A **numeric ID** (`int id`) that uniquely identifies the tile in the world
- **Material** (`Material *material`) that controls interaction behavior (flammable, solid, etc.)
- **Properties** like destroy speed, explosion resistance, sound type, and light emission
- **Render shape** constants (`SHAPE_BLOCK`, `SHAPE_CROSS_TEXTURE`, `SHAPE_STAIRS`, etc.)
- **Virtual methods** for behavior: `tick()`, `use()`, `attack()`, `neighborChanged()`, `onPlace()`, `onRemove()`, and more

All tiles are stored in the static array `Tile::tiles[4096]`. The `Tile` constructor automatically registers itself:

```cpp
// From Tile::_init()
Tile::tiles[id] = this;
this->id = id;
```

## Step 1: Create a Tile Subclass

Create two new files in `Minecraft.World/`: a header and an implementation file.

**`MyCustomTile.h`**
```cpp
#pragma once
#include "Tile.h"

class Random;
class Level;
class Player;

class MyCustomTile : public Tile
{
public:
    MyCustomTile(int id);

    // Override behavior as needed
    virtual void tick(Level *level, int x, int y, int z, Random *random);
    virtual bool use(Level *level, int x, int y, int z,
                     shared_ptr<Player> player, int clickedFace,
                     float clickX, float clickY, float clickZ,
                     bool soundOnly = false);
    virtual int getResource(int data, Random *random, int playerBonusLevel);
    virtual int getResourceCount(Random *random);
};
```

**`MyCustomTile.cpp`**
```cpp
#include "stdafx.h"
#include "MyCustomTile.h"
#include "net.minecraft.world.item.h"
#include "net.minecraft.world.level.h"
#include "net.minecraft.world.entity.player.h"

MyCustomTile::MyCustomTile(int id) : Tile(id, Material::stone)
{
    // The Tile constructor calls _init(), which:
    //   - Sets tiles[id] = this
    //   - Defaults: destroySpeed=0, explosionResistance=0
    //   - Sets soundType = SOUND_NORMAL, friction = 0.6
}

void MyCustomTile::tick(Level *level, int x, int y, int z, Random *random)
{
    // Called each tick if setTicking(true) was used during registration.
    // Example: check neighbors, spawn particles, change state, etc.
}

bool MyCustomTile::use(Level *level, int x, int y, int z,
                       shared_ptr<Player> player, int clickedFace,
                       float clickX, float clickY, float clickZ,
                       bool soundOnly)
{
    // Called when the player right-clicks/uses the block.
    // Return true if the interaction was handled.
    return false;
}

int MyCustomTile::getResource(int data, Random *random, int playerBonusLevel)
{
    // What item ID drops when the block is mined.
    // Return the tile's own ID to drop itself.
    return id;
}

int MyCustomTile::getResourceCount(Random *random)
{
    // How many items drop. Default is 1.
    return 1;
}
```

The `Tile` constructor takes up to three parameters:

```cpp
Tile(int id, Material *material, bool isSolidRender = true);
```

The third parameter `isSolidRender` controls whether the block counts as opaque for lighting and rendering. Set it to `false` for transparent or non-full blocks (like glass or fences).

## Step 2: Choose a Material

The `Material` class determines the fundamental behavior of a block. Here are the available materials from `Material.h`:

| Material | Description |
|----------|-------------|
| `Material::stone` | Standard solid block |
| `Material::wood` | Burnable, wooden |
| `Material::metal` | Metal blocks (anvil, iron block) |
| `Material::glass` | Fragile, transparent |
| `Material::cloth` | Soft (wool, carpet) |
| `Material::sand` | Gravity-affected blocks |
| `Material::dirt` | Dirt/gravel type |
| `Material::plant` | Vegetation |
| `Material::water` | Water blocks |
| `Material::lava` | Lava blocks |
| `Material::leaves` | Leaf blocks |
| `Material::portal` | Portal blocks |
| `Material::fire` | Fire |

Pass the material to the `Tile` constructor:

```cpp
MyCustomTile::MyCustomTile(int id) : Tile(id, Material::stone)
```

## Step 3: Register in Tile::staticCtor()

Open `Minecraft.World/Tile.cpp` and add your registration inside `Tile::staticCtor()`. You'll also need a static pointer declaration in `Tile.h`.

**In `Tile.h`**, add a forward declaration and static pointer:

```cpp
// Forward declaration near the top of Tile.h
class MyCustomTile;

// Inside the Tile class, with the other static tile pointers
static MyCustomTile *myCustomTile;
```

**In `Tile.cpp`**, add the static definition and registration:

```cpp
// Static definition (near the other static Tile* definitions)
MyCustomTile *Tile::myCustomTile = NULL;

// Inside Tile::staticCtor(), add with the other registrations:
Tile::myCustomTile = (MyCustomTile *)(new MyCustomTile(160))
    ->setDestroyTime(3.0f)
    ->setExplodeable(10)
    ->setSoundType(Tile::SOUND_STONE)
    ->setTextureName(L"myCustomTile")
    ->setDescriptionId(IDS_TILE_MY_CUSTOM)
    ->setUseDescriptionId(IDS_DESC_MY_CUSTOM);
```

Pick an unused ID. See [Getting Started](/lcemp-docs/modding/getting-started/) for help finding available IDs.

## Step 4: Set Properties

All property setters return `Tile*`, so you can chain them together in the builder pattern. Here's what's available:

### Destroy Time and Resistance

```cpp
->setDestroyTime(3.0f)      // How long to mine (seconds-ish). 0 = instant break.
->setExplodeable(10)         // Explosion resistance. Higher = more resistant.
->setIndestructible()        // Cannot be broken (like bedrock, uses -1.0f internally)
```

Real examples from the source:
- Dirt: `setDestroyTime(0.5f)`
- Stone: `setDestroyTime(1.5f)`, `setExplodeable(10)`
- Obsidian: `setDestroyTime(50.0f)`, `setExplodeable(2000)`
- Bedrock: `setIndestructible()`, `setExplodeable(6000000)`

### Sound Type

```cpp
->setSoundType(Tile::SOUND_STONE)
```

Available sound types:

| Constant | Used For |
|----------|----------|
| `SOUND_NORMAL` | Default / redstone dust |
| `SOUND_WOOD` | Wood, torches, fire |
| `SOUND_GRAVEL` | Gravel, dirt, farmland |
| `SOUND_GRASS` | Grass, leaves, flowers, TNT |
| `SOUND_STONE` | Stone, ores, bricks |
| `SOUND_METAL` | Iron/gold/diamond blocks, rails |
| `SOUND_GLASS` | Glass, ice, portals |
| `SOUND_CLOTH` | Wool, carpet, snow, cactus |
| `SOUND_SAND` | Sand, soul sand |
| `SOUND_SNOW` | Snow |
| `SOUND_LADDER` | Ladders |
| `SOUND_ANVIL` | Anvils |

### Light

```cpp
->setLightEmission(15 / 16.0f)  // How much light the block emits (0.0 to 1.0)
->setLightBlock(3)               // How much light the block absorbs (0-255)
```

Real examples:
- Torch: `setLightEmission(15 / 16.0f)`
- Glowstone: `setLightEmission(1.0f)`
- Lava: `setLightEmission(1.0f)`, `setLightBlock(255)`
- Water: `setLightBlock(3)`
- Leaves: `setLightBlock(1)`

### Render Shape

Override `getRenderShape()` in your subclass to return one of the `SHAPE_*` constants:

```cpp
int MyCustomTile::getRenderShape()
{
    return Tile::SHAPE_BLOCK;  // Standard full cube
}
```

Key shape constants defined in `Tile.h`:

| Constant | Value | Used For |
|----------|-------|----------|
| `SHAPE_INVISIBLE` | -1 | Air, moving pistons |
| `SHAPE_BLOCK` | 0 | Standard full cube |
| `SHAPE_CROSS_TEXTURE` | 1 | Flowers, saplings, tall grass |
| `SHAPE_TORCH` | 2 | Torches |
| `SHAPE_FIRE` | 3 | Fire |
| `SHAPE_WATER` | 4 | Water/lava |
| `SHAPE_DOOR` | 7 | Doors |
| `SHAPE_STAIRS` | 10 | Stairs |
| `SHAPE_FENCE` | 11 | Fences |
| `SHAPE_CACTUS` | 13 | Cactus |
| `SHAPE_BED` | 14 | Beds |

### Other Properties

```cpp
->setTicking(true)           // Enable tick() updates for this tile
->setNotCollectStatistics()  // Exclude from statistics tracking
->sendTileData()             // Send data bits to clients (for blocks with aux data)
->disableMipmap()            // Disable texture mipmapping (used for cross-texture plants)
->setBaseItemTypeAndMaterial(Item::eBaseItemType_block, Item::eMaterial_stone)
                             // Set creative inventory category
```

### Collision Shape

Override `setShape()` to define a non-full bounding box:

```cpp
// In your constructor or updateDefaultShape():
setShape(0.0f, 0.0f, 0.0f, 1.0f, 0.5f, 1.0f);  // Half-slab height
```

The six parameters are: `x0, y0, z0, x1, y1, z1` (in block-space, 0.0 to 1.0).

## Step 5: Add Behavior

### Tick Updates

If you called `setTicking(true)` during registration, the `tick()` method will be called periodically:

```cpp
void MyCustomTile::tick(Level *level, int x, int y, int z, Random *random)
{
    // Check conditions, modify neighbors, etc.
}
```

### Player Interaction (Right-Click)

Override `use()` to handle right-click interactions:

```cpp
bool MyCustomTile::use(Level *level, int x, int y, int z,
                       shared_ptr<Player> player, int clickedFace,
                       float clickX, float clickY, float clickZ,
                       bool soundOnly)
{
    // Open a GUI, toggle state, etc.
    // Return true if the interaction was consumed.
    return true;
}
```

### Player Attack (Left-Click)

Override `attack()` for left-click behavior:

```cpp
void MyCustomTile::attack(Level *level, int x, int y, int z,
                          shared_ptr<Player> player)
{
    // Handle left-click (e.g., note blocks play sound on attack)
}
```

### Block Drops

Control what drops when the block is mined:

```cpp
int MyCustomTile::getResource(int data, Random *random, int playerBonusLevel)
{
    // Return the item ID to drop.
    // Return the tile ID itself to drop the block:
    return id;
    // Or return a different item, like OreTile does:
    // if (id == Tile::coalOre_Id) return Item::coal_Id;
}

int MyCustomTile::getResourceCount(Random *random)
{
    // How many items drop. Can use random for variable drops.
    return 1;
}
```

### Neighbor Updates

React when an adjacent block changes:

```cpp
void MyCustomTile::neighborChanged(Level *level, int x, int y, int z, int type)
{
    // 'type' is the ID of the neighboring tile that changed.
    // Used by redstone, rails, torches, etc.
}
```

### Placement and Removal

```cpp
void MyCustomTile::onPlace(Level *level, int x, int y, int z)
{
    // Called when the block is placed in the world.
}

void MyCustomTile::onRemove(Level *level, int x, int y, int z, int id, int data)
{
    // Called when the block is removed from the world.
}
```

## Step 6: Add the TileItem

For tiles with IDs 0 through 255, the end of `Tile::staticCtor()` automatically creates a `TileItem` for any tile that doesn't already have a custom item:

```cpp
for (int i = 0; i < 256; i++)
{
    if (Tile::tiles[i] != NULL && Item::items[i] == NULL)
    {
        Item::items[i] = new TileItem(i - 256);
        Tile::tiles[i]->init();
    }
}
```

If your tile needs special item behavior (multiple sub-types, custom icons, colored variants), register a custom `TileItem` subclass before this loop runs. The codebase has plenty of examples:

```cpp
// Wool has colored variants
Item::items[Tile::cloth_Id] = ( new ClothTileItem(Tile::cloth_Id - 256) )
    ->setTextureName(L"cloth")
    ->setDescriptionId(IDS_TILE_CLOTH);

// Logs have tree-type variants
Item::items[Tile::treeTrunk_Id] = ( new TreeTileItem(Tile::treeTrunk_Id - 256, treeTrunk) )
    ->setTextureName(L"log")
    ->setDescriptionId(IDS_TILE_LOG);

// Slabs need special stacking behavior
Item::items[Tile::stoneSlabHalf_Id] = ( new StoneSlabTileItem(
    Tile::stoneSlabHalf_Id - 256,
    Tile::stoneSlabHalf, Tile::stoneSlab, false) )
    ->setTextureName(L"stoneSlab")
    ->setDescriptionId(IDS_TILE_STONESLAB);
```

## Step 7: Creative Inventory

To make your tile show up in the creative inventory, set its base item type and material during registration:

```cpp
->setBaseItemTypeAndMaterial(Item::eBaseItemType_block, Item::eMaterial_stone)
```

The `eBaseItemType` enum controls which tab the item appears on, and `eMaterial` controls sorting within that tab. Here are the common base item types:

| Type | Usage |
|------|-------|
| `eBaseItemType_block` | Solid decorative blocks |
| `eBaseItemType_structblock` | Structural blocks (bricks, nether brick) |
| `eBaseItemType_structwoodstuff` | Wooden planks |
| `eBaseItemType_stairs` | Stair blocks |
| `eBaseItemType_slab` / `eBaseItemType_halfslab` | Slab blocks |
| `eBaseItemType_fence` | Fences and walls |
| `eBaseItemType_door` | Doors and trapdoors |
| `eBaseItemType_torch` | Torches and light sources |
| `eBaseItemType_device` | Functional blocks (furnace, workbench, enchanting table) |
| `eBaseItemType_rail` | Rail blocks |
| `eBaseItemType_button` | Buttons |
| `eBaseItemType_pressureplate` | Pressure plates |
| `eBaseItemType_piston` | Pistons |
| `eBaseItemType_chest` | Chests |

## Complete Example: Adding a Ruby Ore

Here's a full walkthrough based on the existing `OreTile` pattern.

**`RubyOreTile.h`**
```cpp
#pragma once
#include "Tile.h"

class Random;

class RubyOreTile : public Tile
{
public:
    RubyOreTile(int id);
    virtual int getResource(int data, Random *random, int playerBonusLevel);
    virtual int getResourceCount(Random *random);
    virtual void spawnResources(Level *level, int x, int y, int z,
                                int data, float odds, int playerBonusLevel);
};
```

**`RubyOreTile.cpp`**
```cpp
#include "stdafx.h"
#include "RubyOreTile.h"
#include "net.minecraft.world.item.h"
#include "net.minecraft.world.level.h"

RubyOreTile::RubyOreTile(int id) : Tile(id, Material::stone)
{
}

int RubyOreTile::getResource(int data, Random *random, int playerBonusLevel)
{
    // Drop your custom ruby item (assuming you registered it)
    return Item::ruby_Id;  // You would define this in Item.h
}

int RubyOreTile::getResourceCount(Random *random)
{
    return 1;
}

void RubyOreTile::spawnResources(Level *level, int x, int y, int z,
                                  int data, float odds, int playerBonusLevel)
{
    Tile::spawnResources(level, x, y, z, data, odds, playerBonusLevel);
    // Drop experience orbs
    int xpAmount = Mth::nextInt(level->random, 2, 5);
    popExperience(level, x, y, z, xpAmount);
}
```

**Registration in `Tile.h`:**
```cpp
class RubyOreTile;
// ...
static Tile *rubyOre;
static const int rubyOre_Id = 160;  // Pick an unused ID
```

**Registration in `Tile.cpp`:**
```cpp
Tile *Tile::rubyOre = NULL;

// Inside Tile::staticCtor():
Tile::rubyOre = (new RubyOreTile(160))
    ->setDestroyTime(3.0f)
    ->setExplodeable(5)
    ->setSoundType(Tile::SOUND_STONE)
    ->setTextureName(L"oreRuby")
    ->setDescriptionId(IDS_TILE_RUBY_ORE)
    ->setUseDescriptionId(IDS_DESC_RUBY_ORE);
```

Add your new `.h` and `.cpp` files to `cmake/Sources.cmake`, rebuild, and the block will be available in-game.

## Related Guides

- [Getting Started](/lcemp-docs/modding/getting-started/) for environment setup and the staticCtor pattern
- [Adding Items](/lcemp-docs/modding/adding-items/) to create matching items for your blocks
