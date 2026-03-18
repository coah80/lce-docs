---
title: Adding Biomes
description: Step-by-step guide to adding new biomes to LCE.
---

This guide covers creating new biomes in LCE, including how to subclass `Biome`, configure properties, set up mob spawns, customize decorators, and hook into the layer-based world generation pipeline.

## Biome System Overview

The biome system lives entirely in `Minecraft.World/`. Here are the core classes:

| File | Purpose |
|------|---------|
| `Biome.h` / `Biome.cpp` | Base class, static biome registry, mob spawn lists |
| `BiomeDecorator.h` | Feature placement (ores, trees, grass, flowers) |
| `BiomeSource.h` | Provides biome data to the chunk generator |
| `BiomeInitLayer.h` | Picks which biomes show up during world gen |
| `Layer.h` / `Layer.cpp` | Layer pipeline that turns noise into biome IDs |

LCE supports up to 256 biomes (the `Biome::biomes[256]` static array). The 23 vanilla biomes use IDs 0-22.

## Step 1: Create a Biome Subclass

Create a new class that extends `Biome`. Most biome subclasses are pretty small. They just configure properties in the constructor and maybe override `getTreeFeature()` or `decorate()`.

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

Properties are set through a builder-pattern chain in `Biome::staticCtor()`. Here's how the vanilla forest biome is registered:

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
| `setSnowCovered()` | None | Turns on snow cover (also triggered by temp < 0.15) |
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

Temperature controls a few different things:
- **Snow**: Biomes with temperature < 0.15 and rain enabled get snow instead of rain (`hasSnow()`)
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

`BiomeDecorator` handles placing ores, trees, flowers, grass, reeds, cacti, and other features during chunk generation. You configure it by changing the count fields in your biome's constructor.

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

### The Full Decorator Flow

Here's the exact order that `BiomeDecorator::decorate()` places things. This order matters because later features can overwrite earlier ones.

1. **Ores** (`decorateOres()`)
2. **Sand deposits** (sandCount times, placed at surface)
3. **Clay deposits** (clayCount times, placed at surface)
4. **Gravel deposits** (gravelCount times, placed at surface)
5. **Trees** (treeCount times, +1 bonus tree 10% of the time)
6. **Huge mushrooms** (hugeMushrooms times)
7. **Flowers** (flowerCount times, yellow flower + 25% chance of rose each)
8. **Grass** (grassCount times, uses `biome->getGrassFeature()`)
9. **Dead bushes** (deadBushCount times)
10. **Water lilies** (waterlilyCount times)
11. **Mushrooms** (mushroomCount times, 25% chance brown + 12.5% chance red each)
12. **Extra mushrooms** (always: 25% chance brown, 12.5% chance red, once each)
13. **Reeds** (reedsCount times + always 10 extra attempts)
14. **Pumpkins** (1 in 32 chance per chunk)
15. **Cacti** (cactusCount times)
16. **Water springs** (50 attempts if `liquids` is true)
17. **Lava springs** (20 attempts if `liquids` is true)

Note: reeds always get 10 extra placement attempts on top of `reedsCount`. And mushrooms get a baseline placement (one brown, one red attempt) even if `mushroomCount` is 0.

### Ore Generation Rates

The decorator places ores through `decorateOres()`. Each ore type has a vein size (set in `_init()`) and a spawn count/depth:

| Ore | Vein Size | Attempts per Chunk | Y Range |
|-----|-----------|-------------------|---------|
| Dirt | 32 blocks | 20 | 0 to genDepth (128) |
| Gravel | 32 blocks | 10 | 0 to 128 |
| Coal | 16 blocks | 20 | 0 to 128 |
| Iron | 8 blocks | 20 | 0 to 64 |
| Gold | 8 blocks | 2 | 0 to 32 |
| Redstone | 7 blocks | 8 | 0 to 16 |
| Diamond | 7 blocks | 1 | 0 to 16 |
| Lapis Lazuli | 6 blocks | 1 | centered at y=16, spread 16 |

Lapis uses `decorateDepthAverage()` instead of `decorateDepthSpan()`. This means it uses a triangle distribution centered on y=16, so it's most common around that level and gets rarer above and below.

4J added `level->setInstaTick(true)` around ore generation as a performance optimization. This prevents block update events from firing while ores are being placed.

### Ore Features

The decorator places ores at these rates through `decorateOres()`. The feature objects are:

| Feature | Ore Type |
|---------|----------|
| `coalOreFeature` | Coal |
| `ironOreFeature` | Iron |
| `goldOreFeature` | Gold |
| `redStoneOreFeature` | Redstone |
| `diamondOreFeature` | Diamond |
| `lapisOreFeature` | Lapis Lazuli |

### Decorator Helper Methods

The `BiomeDecorator` provides three methods for ore-style placement that you can use in custom decorators:

```cpp
// Place count times at random x/z, random y between y0 and y1
void decorateDepthSpan(int count, Feature *feature, int y0, int y1);

// Place count times at random x/z, y centered on yMid with triangle distribution
void decorateDepthAverage(int count, Feature *feature, int yMid, int ySpan);

// Shorthand for decorateDepthSpan with y0=0, y1=genDepth
void decorate(int count, Feature *feature);
```

`decorateDepthAverage` uses `random->nextInt(ySpan) + random->nextInt(ySpan) + (yMid - ySpan)`. Adding two random values creates a triangle distribution that peaks at `yMid`. This is how lapis lazuli concentrates around y=16.

### Liquid Springs

When `liquids` is true (the default), the decorator places:
- **50 water springs**: at random y using `random->nextInt(random->nextInt(genDepth - 8) + 8)`. The nested `nextInt` makes springs more common at lower Y values.
- **20 lava springs**: at random y using triple-nested `nextInt`, making them even more biased toward the bottom of the world.

Set `decorator->liquids = false` in your biome constructor to turn off underground springs entirely.

### Custom Tree Generation

Override `getTreeFeature()` to control which trees spawn. The returned `Feature` gets used once per tree attempt:

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

The four `eMinecraftColour` values point to entries in the console-specific color table. For a new biome, you'll need to add matching color entries in the colour definitions, or just reuse existing biome colors.

## Step 6: Add to the Layer Pipeline

The world generation layer pipeline decides where biomes show up. The pipeline is built in `Layer::getDefaultLayers()` (`Minecraft.World/Layer.cpp`).

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

`BiomeInitLayer` (`Minecraft.World/BiomeInitLayer.cpp`) is where land cells get assigned to specific biomes. It has a `startBiomes` array:

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

To get your biome into world generation, add it to the `startBiomes` array:

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

If you want more complex biome placement logic (like biomes that only appear near certain other biomes), you can create a new `Layer` subclass:

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

The `zoomLevel` variable in `getDefaultLayers()` controls biome scale: 4 for normal worlds, 6 for large biomes (`LevelType::lvl_largeBiomes`). Your biome will automatically scale with this setting since the zoom layers run after biome selection.

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

## Existing Biome Analysis

Here's a detailed look at what each biome subclass actually configures. Use these as reference when building your own.

### PlainsBiome (ID 1)

Disables trees and boosts flowers/grass. Decorator: `treeCount = -999` (disabled), `flowerCount = 4`, `grassCount = 10`. Temperature 0.8, downfall 0.4.

### DesertBiome (ID 2, 17)

- Surface: sand on sand
- Clears all friendly mob lists (no animals)
- Decorator: `deadBushCount = 2`, `reedsCount = 50`, `cactusCount = 10`
- No rain (`setNoRain()`)
- Temperature 2.0, downfall 0.0
- Also has the desert well (1 in 1000 chance per chunk in `decorate()`)

### ForestBiome (ID 4, 18)

- Adds wolves to `friendlies_wolf` (weight 5, group 4)
- Decorator: `treeCount = 10`, `grassCount = 2`
- `getTreeFeature()`: 1/5 chance birch, 1/10 chance fancy oak (`BasicTree`), otherwise normal oak

### TaigaBiome (ID 5, 19)

- Adds wolves
- Decorator: `treeCount = 10`, `grassCount = 1`
- Surface: grass/dirt (default)
- Snow covered for Taiga Hills variant
- `getTreeFeature()`: 33% tall spruce, 67% normal spruce

### SwampBiome (ID 6)

The most complex decorator setup of any vanilla biome:

- Decorator: `treeCount = 2`, `flowerCount = -999` (disabled!), `deadBushCount = 1`, `mushroomCount = 8`, `reedsCount = 10`, `waterlilyCount = 4`
- `getTreeFeature()`: always returns `SwampTreeFeature`
- Custom `decorate()` adds extra reeds (10 bonus attempts on top of the 10 base) and extra mushrooms

Setting `flowerCount` to -999 is a clever hack. Since the flower loop runs `flowerCount` times, a negative number means zero iterations. The constant -999 is used instead of 0 to make the intent clear.

### JungleBiome (ID 21, 22)

The densest biome by far:

- Decorator: `treeCount = 50`, `grassCount = 25`, `flowerCount = 4`
- Adds ocelots to enemies list (weight 2, group 1-1)
- Adds chickens to the main `friendlies` list (weight 10, group 4)
- Custom `getTreeFeature()` with four tree types:
  - 1/10 chance: fancy oak (`BasicTree`)
  - 1/2 chance: ground bush (`GroundBushFeature`)
  - 1/3 chance: mega jungle tree (`MegaTreeFeature`, 2x2 trunk)
  - Otherwise: normal jungle tree (`TreeFeature` with jungle blocks and vines)
- Custom `decorate()` adds 50 vine placements after the standard decoration
- Temperature 1.2, downfall 0.9 (humid)

### IceBiome (ID 12, 13)

- Snow covered
- Temperature 0.0, downfall 0.5
- Decorator: default (minimal vegetation)
- Surface: grass/dirt with snow on top

### MushroomIslandBiome (ID 14, 15)

- Surface: `mycelium` on dirt
- Clears all enemy and friendly mob lists
- Adds mooshroom cows to `friendlies_mushroomcow` (weight 8, group 4-8)
- Decorator: `hugeMushrooms = 1`, `mushroomCount = 1`, `treeCount = -100`, `flowerCount = -100`, `grassCount = -100`

### ExtremeHillsBiome (ID 3, 20)

- Temperature 0.2, downfall 0.3
- Adds default biome emerald ore feature (not through the standard decorator)
- Standard decorator settings

### OceanBiome (ID 0, 10)

- Depth: -1.0 (deep water)
- Scale: 0.1 (flat ocean floor)
- No subclass customization beyond depth/scale

### BeachBiome (ID 16)

- Surface: sand on sand
- Depth: 0.0, scale: 0.1 (flat at sea level)

### RiverBiome (ID 7, 11)

- Depth: -0.5 (shallow water)
- Scale: 0.0 (flat)

## The Layer Seed Algorithm

The layer pipeline uses a custom random number generator. Each layer gets a 64-bit seed that combines the world seed with the layer's own seed. Here's how it works:

```cpp
void Layer::initWorldGenSeed(__int64 seed) {
    worldGenSeed = seed;
    worldGenSeed *= worldGenSeed * 6364136223846793005LL + 1442695040888963407LL;
    worldGenSeed += baseSeed;
    worldGenSeed *= worldGenSeed * 6364136223846793005LL + 1442695040888963407LL;
    worldGenSeed += baseSeed;
    worldGenSeed *= worldGenSeed * 6364136223846793005LL + 1442695040888963407LL;
    worldGenSeed += baseSeed;
}
```

Then for each position, it re-seeds with the X/Z coordinates:

```cpp
void Layer::initRandom(__int64 x, __int64 z) {
    chunkSeed = worldGenSeed;
    chunkSeed *= chunkSeed * 6364136223846793005LL + 1442695040888963407LL;
    chunkSeed += x;
    chunkSeed *= chunkSeed * 6364136223846793005LL + 1442695040888963407LL;
    chunkSeed += z;
    chunkSeed *= chunkSeed * 6364136223846793005LL + 1442695040888963407LL;
    chunkSeed += x;
    chunkSeed *= chunkSeed * 6364136223846793005LL + 1442695040888963407LL;
    chunkSeed += z;
}
```

The `nextRandom(int bound)` method then extracts values from this seed. On PS Vita, there's an optimization that uses bitwise AND instead of modulo when the bound is a power of 2.

This deterministic seeding is what makes world generation reproducible from the same seed. Every layer, at every position, always produces the same result for a given world seed.

## The Biome Color System

Each biome has four color table entries for grass, foliage, water, and sky. These are set through `setLeafFoliageWaterSkyColor()`:

```cpp
Biome *Biome::setLeafFoliageWaterSkyColor(
    eMinecraftColour grass,
    eMinecraftColour foliage,
    eMinecraftColour water,
    eMinecraftColour sky)
```

The `getSkyColor()`, `getGrassColor()`, `getFolageColor()`, and `getWaterColor()` methods all read from the ColourTable using these enum values. If the colour table returns 0 (no entry), the code falls back to a temperature-based calculation.

For a new biome, you can either:
1. Reuse existing biome color entries (pass `eMinecraftColour_Grass_Forest` etc.)
2. Add new entries to the ColourTable string array and binary data

Option 1 is simpler and works fine if your biome's colors are similar to an existing one. Option 2 gives you full control but requires editing the binary color data that ships with the texture pack.
