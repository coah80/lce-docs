---
title: Custom World Generation
description: How to modify terrain generation in LCE.
---

LCE world generation follows the same pipeline as legacy console Minecraft: a `ChunkSource` generates raw terrain, `BiomeDecorator` places ores and vegetation, and a `Layer` stack picks biome placement. Once you understand these systems, you can add new ores, trees, structures, and even completely custom terrain shapes.

## Generation pipeline

```
Layer stack (biome selection)
    |
    v
ChunkSource::create()          -- raw terrain heightmap
    |
    v
ChunkSource::postProcess()     -- structures, ores, vegetation
    |
    v
ChunkSource::lightChunk()      -- lighting pass
```

The overworld uses `RandomLevelSource`, the Nether uses a separate hell source, and The End uses `TheEndLevelRandomLevelSource`.

## ChunkSource

`ChunkSource` (`Minecraft.World/ChunkSource.h`) is the abstract base for all terrain generators:

```cpp
class ChunkSource {
public:
    int m_XZSize;  // world size in chunks

    virtual bool hasChunk(int x, int y) = 0;
    virtual LevelChunk *getChunk(int x, int z) = 0;
    virtual LevelChunk *create(int x, int z) = 0;
    virtual void postProcess(ChunkSource *parent, int x, int z) = 0;
    virtual void lightChunk(LevelChunk *lc) {}
    virtual bool save(bool force, ProgressListener *progressListener) = 0;
    virtual bool tick() = 0;
    virtual bool shouldSave() = 0;
    virtual wstring gatherStats() = 0;
    virtual vector<Biome::MobSpawnerData *> *getMobsAt(...) = 0;
    virtual TilePos *findNearestMapFeature(...) = 0;
};
```

### RandomLevelSource (overworld)

`RandomLevelSource` (`Minecraft.World/RandomLevelSource.h`) generates the overworld. Here's what's important:

- **Perlin noise layers** shape the terrain: `lperlinNoise1`, `lperlinNoise2`, `perlinNoise1`, `scaleNoise`, `depthNoise`, `forestNoise`
- **Large features** get applied during `create()`: caves (`LargeCaveFeature`), canyons (`CanyonFeature`)
- **Structures** get applied during `postProcess()`: strongholds, villages, mineshafts, scattered features (temples)
- **Edge falloff**: the console edition applies terrain falloff near world borders to create ocean edges

```cpp
RandomLevelSource::RandomLevelSource(Level *level, __int64 seed, bool generateStructures) {
    caveFeature = new LargeCaveFeature();
    strongholdFeature = new StrongholdFeature();
    villageFeature = new VillageFeature(0, m_XZSize);
    mineShaftFeature = new MineShaftFeature();
    scatteredFeature = new RandomScatteredLargeFeature();
    canyonFeature = new CanyonFeature();

    random = new Random(seed);
    lperlinNoise1 = new PerlinNoise(random, 16);
    lperlinNoise2 = new PerlinNoise(random, 16);
    perlinNoise1  = new PerlinNoise(random, 8);
    // ... more noise layers
}
```

World size is defined by constants in `ChunkSource.h`:

| Constant | Value | Description |
|---|---|---|
| `LEVEL_MAX_WIDTH` | `5*64` (large) or `54` | Overworld size in chunks |
| `HELL_LEVEL_MAX_SCALE` | `8` (large) or `3` | Nether scale factor |
| `END_LEVEL_MAX_WIDTH` | `18` | End dimension size |

## Feature system

`Feature` (`Minecraft.World/Feature.h`) is the abstract base class for all decorative world generation elements:

```cpp
class Feature {
public:
    Feature();
    Feature(bool doUpdate);

    virtual bool place(Level *level, Random *random, int x, int y, int z) = 0;
    virtual void init(double V1, double V2, double V3) {}

protected:
    virtual void placeBlock(Level *level, int x, int y, int z, int tile);
    virtual void placeBlock(Level *level, int x, int y, int z, int tile, int data);
};
```

Every Feature subclass implements `place()` to generate blocks at a given position. The `placeBlock()` helpers handle setting tiles in the level.

### Built-in Feature subclasses

| Feature class | File | What it generates |
|---|---|---|
| `OreFeature` | `OreFeature.h` | Ore veins (ellipsoidal clusters) |
| `TreeFeature` | `TreeFeature.h` | Oak trees (with jungle variant) |
| `BirchFeature` | `BirchFeature.h` | Birch trees |
| `PineFeature` | `PineFeature.h` | Pine/spruce trees |
| `SpruceFeature` | `SpruceFeature.h` | Spruce trees |
| `SwampTreeFeature` | `SwampTreeFeature.h` | Swamp trees with vines |
| `MegaTreeFeature` | `MegaTreeFeature.h` | Large 2x2 trees |
| `HugeMushroomFeature` | `HugeMushroomFeature.h` | Giant mushrooms |
| `FlowerFeature` | `FlowerFeature.h` | Flowers (any single-block plant) |
| `TallGrassFeature` | `TallGrassFeature.h` | Tall grass patches |
| `CactusFeature` | `CactusFeature.h` | Cactus columns |
| `ReedsFeature` | `ReedsFeature.h` | Sugar cane |
| `ClayFeature` | `ClayFeature.h` | Clay patches |
| `SandFeature` | `SandFeature.h` | Sand/gravel patches |
| `LakeFeature` | `LakeFeature.h` | Surface/underground lakes |
| `SpringFeature` | `SpringFeature.h` | Water/lava springs |
| `DungeonFeature` | `DungeonFeature.h` | Monster spawner rooms |
| `DesertWellFeature` | `DesertWellFeature.h` | Desert wells |
| `BonusChestFeature` | `BonusChestFeature.h` | Starting bonus chest |
| `SpikeFeature` | `SpikeFeature.h` | End spikes (obsidian pillars) |

### Adding a custom ore

`OreFeature` generates ellipsoidal ore veins. Constructor parameters:

```cpp
OreFeature(int tileId, int count);                   // replaces stone by default
OreFeature(int tileId, int count, int targetTileId);  // replaces a specific tile
```

- `tileId` is the ore block ID to place
- `count` is the vein size (number of placement iterations; vanilla uses 7-32)
- `targetTileId` is what block to replace (defaults to `Tile::rock_Id`, which is stone)

The `place()` method creates a tube-shaped vein between two random endpoints, placing ore blocks in an ellipsoidal pattern around the tube.

**To add a new ore**, register an `OreFeature` in `BiomeDecorator::_init()` and call it in `decorateOres()`:

```cpp
// In BiomeDecorator::_init()
myCustomOreFeature = new OreFeature(Tile::myOre_Id, 8);  // vein size 8

// In BiomeDecorator::decorateOres()
decorateDepthSpan(6, myCustomOreFeature, 0, Level::genDepth / 4);
// 6 attempts per chunk, between y=0 and y=genDepth/4
```

The decoration helpers control how often and where features get placed:

| Method | Parameters | Behavior |
|---|---|---|
| `decorateDepthSpan(count, feature, y0, y1)` | count, feature, min Y, max Y | Places `count` times at random Y between y0 and y1 |
| `decorateDepthAverage(count, feature, yMid, ySpan)` | count, feature, center Y, spread | Places near a center height (used for lapis) |
| `decorate(count, feature)` | count, feature | Places at surface height |

### Adding a custom tree

Trees are `Feature` subclasses. `TreeFeature` supports configurable trunk/leaf types:

```cpp
TreeFeature(bool doUpdate);
TreeFeature(bool doUpdate, int baseHeight, int trunkType, int leafType, bool addJungleFeatures);
```

Biomes return their tree type through `getTreeFeature()`:

```cpp
virtual Feature *getTreeFeature(Random *random);
```

To add a custom tree, either subclass `Feature` directly or create a `TreeFeature` with custom block types. Then override `getTreeFeature()` in your biome to return it.

## BiomeDecorator

`BiomeDecorator` (`Minecraft.World/BiomeDecorator.h`) is the main decoration orchestrator. Each biome owns a `BiomeDecorator` that runs during `postProcess()`.

### Decoration counts

These fields control how many times each feature runs per chunk:

```cpp
int waterlilyCount = 0;
int treeCount = 0;
int flowerCount = 2;
int grassCount = 1;
int deadBushCount = 0;
int mushroomCount = 0;
int reedsCount = 0;
int cactusCount = 0;
int gravelCount = 1;
int sandCount = 3;
int clayCount = 1;
int hugeMushrooms = 0;
bool liquids = true;
```

Biome subclasses (like `DesertBiome`, `ForestBiome`, `JungleBiome`) are `friend` classes of `BiomeDecorator` and can directly change these counts. For example, a forest biome bumps up `treeCount`, and a desert increases `cactusCount` and `deadBushCount`.

### Decoration order

The `decorate()` method runs in this order:

1. **Ores**: `decorateOres()` places dirt, gravel, coal, iron, gold, redstone, diamond, lapis
2. **Sand, clay, gravel**: surface deposits
3. **Trees**: uses `biome->getTreeFeature(random)` for biome-specific trees
4. **Huge mushrooms**: mushroom island biome feature
5. **Flowers**: yellow flowers and roses
6. **Grass**: uses `biome->getGrassFeature(random)`
7. **Dead bushes, waterlilies, mushrooms**
8. **Reeds (sugar cane), pumpkins, cactus**
9. **Liquid springs**: water and lava underground

### Ore generation depths

From `decorateOres()` in `BiomeDecorator.cpp`:

| Ore | Attempts/chunk | Y range |
|---|---|---|
| Dirt | 20 | 0 to genDepth |
| Gravel | 10 | 0 to genDepth |
| Coal | 20 | 0 to genDepth |
| Iron | 20 | 0 to genDepth/2 |
| Gold | 2 | 0 to genDepth/4 |
| Redstone | 8 | 0 to genDepth/8 |
| Diamond | 1 | 0 to genDepth/8 |
| Lapis | 1 | centered at genDepth/8 |

## Layer system (biome placement)

The `Layer` class (`Minecraft.World/Layer.h`) is the building block for biome map generation. Layers form a chain where each layer transforms the output of its parent:

```cpp
class Layer {
protected:
    shared_ptr<Layer> parent;

public:
    static LayerArray getDefaultLayers(__int64 seed, LevelType *levelType);

    Layer(__int64 seedMixup);
    virtual void init(__int64 seed);
    virtual void initRandom(__int64 x, __int64 y);
    virtual intArray getArea(int xo, int yo, int w, int h) = 0;

protected:
    int nextRandom(int max);
};
```

### Built-in layers

The layer chain processes biome IDs through a series of transformations:

| Layer | File | Purpose |
|---|---|---|
| `IslandLayer` | `IslandLayer.h` | Seed layer: random land/ocean |
| `FuzzyZoomLayer` | `FuzzyZoomLayer.h` | Fuzzy upscale (adds noise) |
| `ZoomLayer` | `ZoomLayer.h` | Clean 2x upscale |
| `AddIslandLayer` | `AddIslandLayer.h` | Adds land patches to ocean |
| `AddSnowLayer` | `AddSnowLayer.h` | Marks cold regions |
| `AddMushroomIslandLayer` | `AddMushroomIslandLayer.h` | Places mushroom islands |
| `BiomeInitLayer` | `BiomeInitLayer.h` | Assigns actual biome IDs |
| `RegionHillsLayer` | `RegionHillsLayer.h` | Creates hill variants |
| `RiverInitLayer` | `RiverInitLayer.h` | Seeds river generation |
| `RiverLayer` | `RiverLayer.h` | Generates rivers |
| `RiverMixerLayer` | `RiverMixerLayer.h` | Merges rivers with biomes |
| `ShoreLayer` | `ShoreLayer.h` | Adds beach biomes |
| `SwampRiversLayer` | `SwampRiversLayer.h` | Swamp-specific rivers |
| `SmoothLayer` | `SmoothLayer.h` | Smooths biome edges |
| `SmoothZoomLayer` | `SmoothZoomLayer.h` | Smooth upscale |
| `TemperatureLayer` | `TemperatureLayer.h` | Temperature map |
| `TemperatureMixerLayer` | `TemperatureMixerLayer.h` | Merges temperature data |
| `DownfallLayer` | `DownfallLayer.h` | Rainfall/downfall map |
| `DownfallMixerLayer` | `DownfallMixerLayer.h` | Merges rainfall data |
| `BiomeOverrideLayer` | `BiomeOverrideLayer.h` | Console-specific biome overrides |

The static method `Layer::getDefaultLayers()` builds the full chain for a given seed and level type.

### Adding a custom biome layer

To insert a new layer into the chain:

1. Subclass `Layer`:
   ```cpp
   class MyCustomLayer : public Layer {
   public:
       MyCustomLayer(__int64 seed, shared_ptr<Layer> parent)
           : Layer(seed) { this->parent = parent; }

       intArray getArea(int xo, int yo, int w, int h) override {
           intArray parentData = parent->getArea(xo, yo, w, h);
           intArray result;
           result.data = new int[w * h];
           result.length = w * h;

           for (int i = 0; i < w * h; i++) {
               // Transform biome IDs here
               result.data[i] = parentData.data[i];
           }
           return result;
       }
   };
   ```

2. Insert it into the layer chain in `Layer::getDefaultLayers()`.

## Structure features

Large structures use a two-class hierarchy:

- `LargeFeature` is the base class for features that span multiple chunks
- `StructureFeature` extends `LargeFeature` with caching and chunk-level decision making

```cpp
class StructureFeature : public LargeFeature {
protected:
    virtual bool isFeatureChunk(int x, int z, bool bIsSuperflat = false) = 0;
    virtual StructureStart *createStructureStart(int x, int z) = 0;
};
```

Built-in structure features:

| Class | Description |
|---|---|
| `StrongholdFeature` | End portal strongholds |
| `VillageFeature` | NPC villages |
| `MineShaftFeature` | Abandoned mineshafts |
| `NetherBridgeFeature` | Nether fortresses |
| `RandomScatteredLargeFeature` | Temples, witch huts |

To add a custom structure, subclass `StructureFeature`, implement `isFeatureChunk()` to decide placement, and `createStructureStart()` to define the structure. Register it in `RandomLevelSource`'s constructor and call it during `postProcess()`.

## Key source files

- `Minecraft.World/ChunkSource.h` for the abstract chunk generator
- `Minecraft.World/RandomLevelSource.h` / `.cpp` for the overworld terrain generator
- `Minecraft.World/Feature.h` for the abstract decoration feature
- `Minecraft.World/OreFeature.h` / `.cpp` for ore vein generation
- `Minecraft.World/BiomeDecorator.h` / `.cpp` for the decoration orchestrator
- `Minecraft.World/Layer.h` for the biome layer base class
- `Minecraft.World/Biome.h` for biome definitions
- `Minecraft.World/StructureFeature.h` for the large structure base class
