---
title: Adding Biomes
description: Step-by-step guide to adding new biomes to LCEMP.
---

This guide covers creating new biomes in LCEMP, including subclassing `Biome`, configuring properties, registering mob spawns, customizing decorators, and integrating with the layer-based world generation pipeline.

## Biome System Overview

The biome system lives entirely in `Minecraft.World/`. The core classes are:

| File | Purpose |
|------|---------|
| `Biome.h` / `Biome.cpp` | Base class, static biome registry, mob spawn lists |
| `BiomeDecorator.h` | Feature placement (ores, trees, grass, flowers) |
| `BiomeSource.h` | Provides biome data to the chunk generator |
| `BiomeInitLayer.h` | Selects which biomes appear during world gen |
| `Layer.h` / `Layer.cpp` | Layer pipeline that transforms noise into biome IDs |

LCEMP supports up to 256 biomes (the `Biome::biomes[256]` static array). The 23 vanilla biomes use IDs 0-22.

## Step 1: Create a Biome Subclass

Create a new class that extends `Biome`. Most biome subclasses are small -- they configure properties in the constructor and optionally override `getTreeFeature()` or `decorate()`.

### Header (`Minecraft.World/MyBiome.h`)

```cpp
#pragma once
#include "Biome.h"

class MyBiome : public Biome
{
public:
    MyBiome(int id);

    // Override for custom tree generation
    virtual Feature *getTreeFeature(Random *random);

    // Override for custom decoration (optional)
    virtual void decorate(Level *level, Random *random, int xo, int zo);
};
```

### Implementation (`Minecraft.World/MyBiome.cpp`)

```cpp
#include "MyBiome.h"

MyBiome::MyBiome(int id) : Biome(id)
{
    // Customize mob spawns -- base Biome constructor
    // already adds default friendlies and enemies.

    // Remove defaults if needed:
    // friendlies.clear();
    // enemies.clear();

    // Add custom spawns:
    enemies.push_back(new MobSpawnerData(eTYPE_MY_MOB, 8, 1, 3));
    friendlies_wolf.push_back(
        new MobSpawnerData(eTYPE_WOLF, 5, 4, 4));

    // Configure the decorator
    decorator->treeCount = 10;
    decorator->grassCount = 2;
    decorator->flowerCount = 4;
}
```

## Step 2: Biome Properties

Properties are set via a builder-pattern chain in `Biome::staticCtor()`. Here is how the vanilla forest biome is registered:

```cpp
Biome::forest = (new ForestBiome(4))
    ->setColor(0x056621)
    ->setName(L"Forest")
    ->setLeafColor(0x4EBA31)
    ->setTemperatureAndDownfall(0.7f, 0.8f)
    ->setLeafFoliageWaterSkyColor(
        eMinecraftColour_Grass_Forest,
        eMinecraftColour_Foliage_Forest,
        eMinecraftColour_Water_Forest,
        eMinecraftColour_Sky_Forest);
```

### Property Reference

| Method | Parameters | Effect |
|--------|-----------|--------|
| `setName(wstring)` | Display name | Sets `m_name` for the biome |
| `setColor(int)` | Hex RGB | Map color on the debug view |
| `setTemperatureAndDownfall(float, float)` | temp, downfall | Controls snow, rain, grass/foliage tint |
| `setDepthAndScale(float, float)` | depth, scale | Terrain height; negative = water, 0.1 = flat, 1.5 = mountains |
| `setLeafColor(int)` | Hex RGB | Leaf block tint override |
| `setSnowCovered()` | None | Enables snow cover (also triggered by temp < 0.15) |
| `setNoRain()` | None | Disables precipitation entirely |
| `setLeafFoliageWaterSkyColor(...)` | Four `eMinecraftColour` values | Console-specific color table entries for grass, foliage, water, sky |

### Default Property Values

Set in the `Biome` base constructor:

| Property | Default |
|----------|---------|
| `topMaterial` | `Tile::grass_Id` |
| `material` | `Tile::dirt_Id` |
| `leafColor` | `0x4EE031` |
| `temperature` | `0.5f` |
| `downfall` | `0.5f` |
| `depth` | `0.1f` |
| `scale` | `0.3f` |
| `_hasRain` | `true` |

### Temperature and Weather

Temperature controls several behaviors:
- **Snow**: Biomes with temperature < 0.15 and rain enabled will have snow instead of rain (`hasSnow()`)
- **Rain**: Disabled when `setNoRain()` is called or when `hasSnow()` returns true
- **Humid**: Biomes with downfall > 0.85 are considered humid (`isHumid()`)

### Surface Materials

Override the default grass/dirt surface by setting `topMaterial` and `material` in your constructor:

```cpp
MyBiome::MyBiome(int id) : Biome(id)
{
    // Sand surface like desert
    this->topMaterial = (byte) Tile::sand_Id;
    this->material = (byte) Tile::sand_Id;
}
```

## Step 3: Mob Spawn Lists

The `Biome` base constructor adds default mob spawns for all biomes. There are six mob categories with separate lists:

| List | Category | Default Contents |
|------|----------|-----------------|
| `enemies` | `MobCategory::monster` | Spider, Zombie, Skeleton, Creeper, Slime, Enderman |
| `friendlies` | `MobCategory::creature` | Sheep (12), Pig (10), Cow (8) |
| `friendlies_chicken` | `MobCategory::creature_chicken` | Chicken (10) |
| `friendlies_wolf` | `MobCategory::creature_wolf` | Empty by default |
| `friendlies_mushroomcow` | `MobCategory::creature_mushroomcow` | Empty by default |
| `waterFriendlies` | `MobCategory::waterCreature` | Squid (10) |

The `MobSpawnerData` constructor takes `(eINSTANCEOF mobClass, int weight, int minCount, int maxCount)`.

### Example: Desert-Style Biome (No Animals)

The `DesertBiome` clears all friendly mob lists:

```cpp
DesertBiome::DesertBiome(int id) : Biome(id)
{
    friendlies.clear();
    friendlies_chicken.clear();
    friendlies_wolf.clear();
    // Desert surface
    this->topMaterial = (byte) Tile::sand_Id;
    this->material = (byte) Tile::sand_Id;
}
```

### Example: Forest-Style Biome (Add Wolves)

The `ForestBiome` adds wolves to the wolf-specific spawn list:

```cpp
ForestBiome::ForestBiome(int id) : Biome(id)
{
    friendlies_wolf.push_back(
        new MobSpawnerData(eTYPE_WOLF, 5, 4, 4));
    decorator->treeCount = 10;
    decorator->grassCount = 2;
}
```

## Step 4: Customize the Decorator

`BiomeDecorator` handles placement of ores, trees, flowers, grass, reeds, cacti, and other features during chunk generation. Configure it by modifying the count fields in your biome's constructor.

### Decorator Count Fields

| Field | Default | Controls |
|-------|---------|----------|
| `treeCount` | 0 | Trees per chunk (set to -999 to disable) |
| `flowerCount` | 2 | Yellow flowers |
| `grassCount` | 1 | Tall grass patches |
| `deadBushCount` | 0 | Dead bushes |
| `mushroomCount` | 0 | Mushroom placement |
| `reedsCount` | 0 | Sugar cane |
| `cactusCount` | 0 | Cacti |
| `waterlilyCount` | 0 | Lily pads |
| `hugeMushrooms` | 0 | Huge mushrooms |
| `sandCount` | 3 | Sand deposits |
| `clayCount` | 1 | Clay deposits |
| `gravelCount` | 1 | Gravel deposits |
| `liquids` | true | Underground lava/water pockets |

### Ore Features

The decorator automatically places ores at standard rates via `decorateOres()`. These are controlled by the feature objects:

| Feature | Ore Type |
|---------|----------|
| `coalOreFeature` | Coal |
| `ironOreFeature` | Iron |
| `goldOreFeature` | Gold |
| `redStoneOreFeature` | Redstone |
| `diamondOreFeature` | Diamond |
| `lapisOreFeature` | Lapis Lazuli |

### Custom Tree Generation

Override `getTreeFeature()` to control which trees spawn. The returned `Feature` is used once per tree attempt:

```cpp
Feature *MyBiome::getTreeFeature(Random *random)
{
    // 20% birch, 10% fancy oak, 70% normal oak
    if (random->nextInt(5) == 0)
    {
        return new BirchFeature(false);
    }
    if (random->nextInt(10) == 0)
    {
        return new BasicTree(false);
    }
    return new TreeFeature(false);
}
```

Available tree features: `TreeFeature` (normal oak), `BasicTree` (fancy oak), `BirchFeature`, `SwampTreeFeature`, `MegaTreeFeature` (large 2x2 jungle trees).

### Custom Decoration Override

For decoration beyond what the decorator handles, override `decorate()`:

```cpp
void MyBiome::decorate(Level *level, Random *random, int xo, int zo)
{
    // Run standard decoration first
    Biome::decorate(level, random, xo, zo);

    // Add custom features (e.g., 1-in-1000 chance of a well)
    if (random->nextInt(1000) == 0)
    {
        int x = xo + random->nextInt(16) + 8;
        int z = zo + random->nextInt(16) + 8;
        Feature *well = new DesertWellFeature();
        well->place(level, random, x,
                    level->getHeightmap(x, z) + 1, z);
        delete well;
    }
}
```

## Step 5: Register the Biome

### Add to the Biome Registry

In `Biome::staticCtor()` (`Minecraft.World/Biome.cpp`), add your biome with a unique ID:

```cpp
// 1. Add a static pointer in Biome.h:
static Biome *myBiome;

// 2. Initialize it in Biome.cpp (top of file):
Biome *Biome::myBiome = NULL;

// 3. Create in staticCtor():
Biome::myBiome = (new MyBiome(23))
    ->setColor(0x336633)
    ->setName(L"My Biome")
    ->setTemperatureAndDownfall(0.6f, 0.7f)
    ->setDepthAndScale(0.2f, 0.5f)
    ->setLeafFoliageWaterSkyColor(
        eMinecraftColour_Grass_Forest,
        eMinecraftColour_Foliage_Forest,
        eMinecraftColour_Water_Forest,
        eMinecraftColour_Sky_Forest);

// 4. Update BIOME_COUNT:
static const int BIOME_COUNT = 24;
```

The `Biome` constructor automatically registers the biome in the `Biome::biomes[256]` array at the given ID index.

### Add to the Color Table

The four `eMinecraftColour` values reference entries in the console-specific color table. For a new biome, you need to add corresponding color entries in the colour definitions, or reuse existing biome colors.

## Step 6: Add to the Layer Pipeline

The world generation layer pipeline determines where biomes appear. The pipeline is built in `Layer::getDefaultLayers()` (`Minecraft.World/Layer.cpp`).

### How the Pipeline Works

```
IslandLayer          # Initial ocean/land noise
    ↓
FuzzyZoomLayer       # Upscale with noise
    ↓
AddIslandLayer ×3    # Add more land masses
    ↓
AddSnowLayer         # Mark cold regions
    ↓
ZoomLayer ×N         # Progressive upscaling
    ↓
BiomeInitLayer       # Assign biome IDs to land cells
    ↓
RegionHillsLayer     # Add hill variants
    ↓
ZoomLayer ×4-6       # Final upscaling (4 normal, 6 large biomes)
    ↓
AddMushroomIslandLayer + GrowMushroomIslandLayer
    ↓
ShoreLayer           # Add beaches along coastlines
    ↓
SwampRiversLayer     # Swamp river features
    ↓
SmoothLayer          # Reduce noise artifacts
    ↓
RiverMixerLayer      # Overlay rivers onto biome map
    ↓
VoronoiZoom          # Final precision zoom for block-level lookup
```

### BiomeInitLayer: Where Biomes Are Selected

`BiomeInitLayer` (`Minecraft.World/BiomeInitLayer.cpp`) is where land cells get assigned to specific biomes. It holds a `startBiomes` array:

```cpp
BiomeInitLayer::BiomeInitLayer(__int64 seed,
    shared_ptr<Layer> parent, LevelType *levelType)
    : Layer(seed)
{
    this->parent = parent;

    if (levelType == LevelType::lvl_normal_1_1)
    {
        startBiomes = BiomeArray(6);
        startBiomes[0] = Biome::desert;
        startBiomes[1] = Biome::forest;
        startBiomes[2] = Biome::extremeHills;
        startBiomes[3] = Biome::swampland;
        startBiomes[4] = Biome::plains;
        startBiomes[5] = Biome::taiga;
    }
    else
    {
        startBiomes = BiomeArray(7);
        // Same as above, plus:
        startBiomes[6] = Biome::jungle;
    }
}
```

To make your biome appear in world generation, add it to the `startBiomes` array:

```cpp
// For the default level type:
startBiomes = BiomeArray(8);
startBiomes[0] = Biome::desert;
startBiomes[1] = Biome::forest;
startBiomes[2] = Biome::extremeHills;
startBiomes[3] = Biome::swampland;
startBiomes[4] = Biome::plains;
startBiomes[5] = Biome::taiga;
startBiomes[6] = Biome::jungle;
startBiomes[7] = Biome::myBiome;  // Your new biome
```

During `getArea()`, each land cell picks a random biome from this array with equal probability using `nextRandom(startBiomes.length)`.

### Creating a Custom Layer

To add more complex biome placement logic (e.g., biomes that only appear near certain other biomes), create a new `Layer` subclass:

```cpp
class MyCustomLayer : public Layer
{
public:
    MyCustomLayer(__int64 seed, shared_ptr<Layer> parent)
        : Layer(seed)
    {
        this->parent = parent;
    }

    intArray getArea(int xo, int yo, int w, int h)
    {
        intArray input = parent->getArea(xo, yo, w, h);
        intArray result = IntCache::allocate(w * h);

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                initRandom(x + xo, y + yo);
                int old = input[x + y * w];

                // Custom logic: replace plains with your biome
                // 10% of the time
                if (old == Biome::plains->id
                    && nextRandom(10) == 0)
                {
                    result[x + y * w] = Biome::myBiome->id;
                }
                else
                {
                    result[x + y * w] = old;
                }
            }
        }
        return result;
    }
};
```

Insert it into the pipeline in `Layer::getDefaultLayers()`:

```cpp
biomeLayer = shared_ptr<Layer>(
    new BiomeInitLayer(200, biomeLayer, levelType));
// Add your custom layer after BiomeInitLayer:
biomeLayer = shared_ptr<Layer>(
    new MyCustomLayer(201, biomeLayer));
```

### Large Biomes Mode

The `zoomLevel` variable in `getDefaultLayers()` controls biome scale: 4 for normal worlds, 6 for large biomes (`LevelType::lvl_largeBiomes`). Your biome will automatically scale with this setting since the zoom layers are applied after biome selection.

## Biome ID Reference

| ID | Biome | Subclass |
|----|-------|----------|
| 0 | Ocean | `OceanBiome` |
| 1 | Plains | `PlainsBiome` |
| 2 | Desert | `DesertBiome` |
| 3 | Extreme Hills | `ExtremeHillsBiome` |
| 4 | Forest | `ForestBiome` |
| 5 | Taiga | `TaigaBiome` |
| 6 | Swampland | `SwampBiome` |
| 7 | River | `RiverBiome` |
| 8 | Hell (Nether) | `HellBiome` |
| 9 | Sky (The End) | `TheEndBiome` |
| 10 | Frozen Ocean | `OceanBiome` |
| 11 | Frozen River | `RiverBiome` |
| 12 | Ice Plains | `IceBiome` |
| 13 | Ice Mountains | `IceBiome` |
| 14 | Mushroom Island | `MushroomIslandBiome` |
| 15 | Mushroom Island Shore | `MushroomIslandBiome` |
| 16 | Beach | `BeachBiome` |
| 17 | Desert Hills | `DesertBiome` |
| 18 | Forest Hills | `ForestBiome` |
| 19 | Taiga Hills | `TaigaBiome` |
| 20 | Extreme Hills Edge | `ExtremeHillsBiome` |
| 21 | Jungle | `JungleBiome` |
| 22 | Jungle Hills | `JungleBiome` |
