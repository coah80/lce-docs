---
title: Custom Dimensions
description: How to create a new dimension with custom terrain, sky, fog, biomes, and portal travel.
---

Adding a new dimension to LCE means building out several pieces: a `Dimension` subclass, a `ChunkSource` for terrain generation, a biome, portal logic, and then wiring it all together. This guide walks through each piece, with real examples from the Aether dimension implementation in the client source.

## How the Dimension Class Works

The `Dimension` base class in `Minecraft.World/Dimension.h` is what defines a dimension's behavior. It controls things like fog color, time of day, cloud height, spawn rules, and which terrain generator to use.

Here are the key members:

```cpp
class Dimension
{
public:
    Level *level;
    LevelType *levelType;
    BiomeSource *biomeSource;
    bool ultraWarm;      // Nether-style: water evaporates, lava flows faster
    bool hasCeiling;     // Bedrock ceiling (Nether/End style)
    float *brightnessRamp;
    int id;              // Unique dimension ID (-1=Nether, 0=Overworld, 1=End)
};
```

The base class provides a bunch of virtual methods you can override. Here's what each one does:

| Method | What it controls |
|--------|-----------------|
| `init()` | Set up biome source, dimension ID, flags |
| `createRandomLevelSource()` | Return your custom terrain generator |
| `getTimeOfDay()` | Sun position / day-night cycle |
| `getSunriseColor()` | Sunrise/sunset gradient (or `NULL` to disable) |
| `getFogColor()` | Fog color based on time of day |
| `isNaturalDimension()` | Whether natural day/night mob spawning rules apply |
| `mayRespawn()` | Whether players respawn here or get sent to Overworld |
| `hasGround()` | Whether there's a ground plane (affects rendering) |
| `getCloudHeight()` | Y level where clouds render |
| `isValidSpawn()` | Whether a given X/Z is a valid spawn position |
| `getSpawnPos()` | Fixed spawn coordinates (or `NULL` to use default) |
| `getSpawnYPosition()` | Y level for spawning |
| `isFoggyAt()` | Whether fog is extra thick at a position |
| `hasBedrockFog()` | Whether the bedrock fog effect at world bottom is active |
| `getClearColorScale()` | Sky clear color multiplier |

The `Dimension::getNew()` factory method is how the game creates dimension instances from an ID:

```cpp
Dimension *Dimension::getNew(int id)
{
    if (id == -1) return new HellDimension();
    if (id == 0) return new NormalDimension();
    if (id == 1) return new TheEndDimension();
    return NULL;
}
```

You'll need to add your dimension to this factory. More on that in the [registration section](#registering-the-dimension).

## Creating a Dimension Subclass

Start by creating two files: a header and implementation in `Minecraft.World/`.

**`MyDimension.h`**
```cpp
#pragma once
#include "Dimension.h"

class MyDimension : public Dimension
{
public:
    virtual void init();
    virtual ChunkSource *createRandomLevelSource() const;
    virtual float getTimeOfDay(__int64 time, float a) const;
    virtual float *getSunriseColor(float td, float a);
    virtual Vec3 *getFogColor(float td, float a) const;
    virtual bool hasGround();
    virtual bool mayRespawn() const;
    virtual bool isNaturalDimension();
    virtual float getCloudHeight();
    virtual bool isValidSpawn(int x, int z) const;
    virtual Pos *getSpawnPos();
    virtual int getSpawnYPosition();
    virtual bool isFoggyAt(int x, int z);
    virtual bool hasBedrockFog();
    virtual double getClearColorScale();
};
```

You don't have to override every single method. The base class has defaults for everything. Just override the ones you want to change. Here's how the Aether implementation looks:

**`AetherDimension.cpp`**
```cpp
#include "AetherDimension.h"
#include "FixedBiomeSource.h"
#include "AetherLevelSource.h"
#include "net.minecraft.world.level.biome.h"

void AetherDimension::init()
{
    // Use a fixed biome for the whole dimension
    biomeSource = new FixedBiomeSource(Biome::aether, 0.5f, 0.0f);
    id = 2;
    hasCeiling = false;
}

ChunkSource *AetherDimension::createRandomLevelSource() const
{
    return new AetherLevelSource(level, level->getSeed());
}
```

The `init()` method is the most important one. This is where you:
1. Set up the `biomeSource` (what biome the dimension uses)
2. Assign a unique `id`
3. Configure `hasCeiling` and `ultraWarm`

For comparison, here's how the Nether does it:

```cpp
void HellDimension::init()
{
    biomeSource = new FixedBiomeSource(Biome::hell, 1, 0);
    ultraWarm = true;
    hasCeiling = true;
    id = -1;
}
```

Setting `ultraWarm = true` makes water evaporate and lava flow faster. Setting `hasCeiling = true` puts a bedrock ceiling at the top of the world.

## Custom Sky and Fog

The sky and fog methods are where you give your dimension its visual identity.

### Time of Day

`getTimeOfDay()` returns a float from 0.0 to 1.0 that controls the sun position:
- `0.0` = noon (maximum brightness)
- `0.25` = sunset
- `0.5` = midnight
- `0.75` = sunrise

Return a constant to freeze time. The Aether and End both lock to permanent day:

```cpp
float AetherDimension::getTimeOfDay(__int64 time, float a) const
{
    return 0.0f;  // Permanent daytime
}
```

The Nether returns `0.5f` for permanent dim lighting.

### Fog Color

`getFogColor()` returns an RGB `Vec3` that tints the fog. The `td` parameter is the current time of day if you want the fog to shift with the day/night cycle.

```cpp
Vec3 *AetherDimension::getFogColor(float td, float a) const
{
    // Bright sky-blue fog
    float r = 0.62f;
    float g = 0.80f;
    float b = 1.0f;
    return Vec3::newTemp(r, g, b);
}
```

The Aether uses a fixed color. If you want fog that changes with time (like the Overworld does), multiply your RGB values by a brightness factor derived from `td`:

```cpp
float br = Mth::cos(td * PI * 2) * 2 + 0.5f;
if (br < 0.0f) br = 0.0f;
if (br > 1.0f) br = 1.0f;
r *= br;
g *= br;
b *= br;
```

### Sunrise Color

Return `NULL` to disable sunrise/sunset gradients entirely (what the Aether and End do). The base Dimension class has the full sunrise calculation if you want to customize it instead.

```cpp
float *AetherDimension::getSunriseColor(float td, float a)
{
    return NULL;  // No sunrise/sunset
}
```

### Other Visual Settings

```cpp
float AetherDimension::getCloudHeight()
{
    // Clouds higher than normal (default is Level::genDepth)
    return (float)Level::genDepth + 32;
}

bool AetherDimension::isFoggyAt(int x, int z)
{
    return false;  // No thick fog patches
}

bool AetherDimension::hasBedrockFog()
{
    return false;  // No fog at world bottom
}

double AetherDimension::getClearColorScale()
{
    return 1.0;  // Full brightness sky clear color
}
```

## Custom Terrain Generation (ChunkSource)

This is the big one. Your `ChunkSource` subclass is what actually generates the blocks in your dimension.

### The ChunkSource Interface

The base class in `ChunkSource.h` defines the pure virtual methods you need to implement:

```cpp
class ChunkSource
{
public:
    int m_XZSize;

    virtual bool hasChunk(int x, int y) = 0;
    virtual LevelChunk *getChunk(int x, int z) = 0;
    virtual LevelChunk *create(int x, int z) = 0;
    virtual void lightChunk(LevelChunk *lc) {}
    virtual void postProcess(ChunkSource *parent, int x, int z) = 0;
    virtual bool save(bool force, ProgressListener *progressListener) = 0;
    virtual bool tick() = 0;
    virtual bool shouldSave() = 0;
    virtual wstring gatherStats() = 0;
    virtual vector<Biome::MobSpawnerData *> *getMobsAt(
        MobCategory *mobCategory, int x, int y, int z) = 0;
    virtual TilePos *findNearestMapFeature(
        Level *level, const wstring& featureName, int x, int y, int z) = 0;
};
```

The two most important methods are:
- **`getChunk()`** / **`create()`** - Generate a chunk's blocks
- **`postProcess()`** - Decorate with features (trees, ores, flowers) after initial generation

### How the Aether Level Source Works

The `AetherLevelSource` generates floating islands using Perlin noise. Here's the structure:

```cpp
class AetherLevelSource : public ChunkSource
{
private:
    Random *random;
    Random *pprandom;
    PerlinNoise *lperlinNoise1;
    PerlinNoise *lperlinNoise2;
    PerlinNoise *perlinNoise1;
    PerlinNoise *islandNoise;    // Scattered island clusters
    PerlinNoise *carvingNoise;   // Irregular island shapes
public:
    PerlinNoise *scaleNoise;
    PerlinNoise *depthNoise;
    Level *level;
};
```

The constructor seeds all the noise generators:

```cpp
AetherLevelSource::AetherLevelSource(Level *level, __int64 seed)
{
    m_XZSize = level->getLevelData()->getXZSize();
    this->level = level;

    random = new Random(seed);
    pprandom = new Random(seed);

    lperlinNoise1 = new PerlinNoise(random, 16);
    lperlinNoise2 = new PerlinNoise(random, 16);
    perlinNoise1 = new PerlinNoise(random, 8);
    scaleNoise = new PerlinNoise(random, 10);
    depthNoise = new PerlinNoise(random, 16);
    islandNoise = new PerlinNoise(random, 4);
    carvingNoise = new PerlinNoise(random, 6);
}
```

### Chunk Generation Pipeline

The chunk generation happens in `getChunk()`, which calls two sub-methods:

1. **`prepareHeights()`** - Fills the chunk with blocks based on noise. Where the noise value is positive, place your dimension's base stone block:

```cpp
// Inside the noise sampling loop:
int tileId = 0;
if (val > 0)
{
    tileId = Tile::holystone_Id;  // Aether's base stone
}
blocks[offs] = (byte) tileId;
```

2. **`buildSurfaces()`** - Replaces the top layers with surface blocks (grass, dirt). Walks each column from top to bottom and replaces the first few blocks of stone it hits:

```cpp
byte top = (byte) Tile::aetherGrass_Id;
byte mid = (byte) Tile::aetherDirt_Id;
byte base = (byte) Tile::holystone_Id;

for (int y = Level::genDepthMinusOne; y >= 0; y--)
{
    int old = blocks[offs];
    if (old == Tile::holystone_Id)
    {
        if (run == -1)
        {
            run = runDepth;
            blocks[offs] = top;   // Top block: aether grass
        }
        else if (run > 0)
        {
            run--;
            blocks[offs] = mid;   // Below: aether dirt
        }
        // When run reaches 0, stays as holystone
    }
}
```

The full `getChunk()` method ties it together:

```cpp
LevelChunk *AetherLevelSource::getChunk(int xOffs, int zOffs)
{
    random->setSeed(xOffs * 341873128712l + zOffs * 132897987541l);

    BiomeArray biomes;
    unsigned int blocksSize = Level::genDepth * 16 * 16;
    byte *tileData = (byte *)XPhysicalAlloc(blocksSize, MAXULONG_PTR, 4096, PAGE_READWRITE);
    XMemSet128(tileData, 0, blocksSize);
    byteArray blocks = byteArray(tileData, blocksSize);

    level->getBiomeSource()->getBiomeBlock(biomes, xOffs * 16, zOffs * 16, 16, 16, true);

    prepareHeights(xOffs, zOffs, blocks, biomes);
    buildSurfaces(xOffs, zOffs, blocks, biomes);

    LevelChunk *levelChunk = new LevelChunk(level, blocks, xOffs, zOffs);
    XPhysicalFree(tileData);

    delete biomes.data;
    return levelChunk;
}
```

### Post-Processing (Decoration)

After a chunk is generated, `postProcess()` places features like trees, ores, and flowers. The Aether delegates this to its biome's decorator:

```cpp
void AetherLevelSource::postProcess(ChunkSource *parent, int xt, int zt)
{
    HeavyTile::instaFall = true;
    int xo = xt * 16;
    int zo = zt * 16;

    pprandom->setSeed(level->getSeed());
    __int64 xScale = pprandom->nextLong() / 2 * 2 + 1;
    __int64 zScale = pprandom->nextLong() / 2 * 2 + 1;
    pprandom->setSeed(((xt * xScale) + (zt * zScale)) ^ level->getSeed());

    Biome *biome = level->getBiome(xo + 16, zo + 16);
    biome->decorate(level, pprandom, xo, zo);

    HeavyTile::instaFall = false;
}
```

### The Lighting Step

One important detail: `lightChunk()` needs to call `recalcHeightmap()` so skylighting works correctly. This has to happen after the chunk is added to the cache, not during generation:

```cpp
void AetherLevelSource::lightChunk(LevelChunk *lc)
{
    lc->recalcHeightmap();
}
```

### Boilerplate Methods

These are mostly the same for every custom LevelSource:

```cpp
bool AetherLevelSource::hasChunk(int x, int y) { return true; }
bool AetherLevelSource::save(bool force, ProgressListener *p) { return true; }
bool AetherLevelSource::tick() { return false; }
bool AetherLevelSource::shouldSave() { return true; }
wstring AetherLevelSource::gatherStats() { return L"AetherLevelSource"; }

TilePos *AetherLevelSource::findNearestMapFeature(
    Level *level, const wstring& featureName, int x, int y, int z)
{
    return NULL;  // No structures to locate
}

vector<Biome::MobSpawnerData *> *AetherLevelSource::getMobsAt(
    MobCategory *mobCategory, int x, int y, int z)
{
    Biome *biome = level->getBiome(x, z);
    if (biome == NULL) return NULL;
    return biome->getMobs(mobCategory);
}
```

## Custom Biome Setup

Your dimension needs a biome to control surface blocks, tree types, mob spawning, grass/foliage colors, and decoration. For a custom dimension, you'll typically create a custom `Biome` subclass and a custom `BiomeDecorator`.

### The Biome Subclass

```cpp
// AetherBiome.h
#pragma once
#include "Biome.h"

class AetherBiome : public Biome
{
public:
    AetherBiome(int id);
    virtual Feature *getTreeFeature(Random *random);
    virtual Feature *getGrassFeature(Random *random);
    virtual int getGrassColor();
    virtual int getFolageColor();
    virtual int getSkyColor(float temp);
};
```

The constructor is where you set up surface materials, mob lists, and attach a custom decorator:

```cpp
AetherBiome::AetherBiome(int id) : Biome(id)
{
    // Clear default mob spawning
    enemies.clear();
    friendlies.clear();
    friendlies_chicken.clear();
    friendlies_wolf.clear();
    waterFriendlies.clear();

    // Custom surface blocks
    topMaterial = (byte) Tile::aetherGrass_Id;
    material = (byte) Tile::aetherDirt_Id;

    // Swap in custom decorator
    delete decorator;
    decorator = new AetherBiomeDecorator(this);
}
```

Override `getTreeFeature()` to control what trees generate:

```cpp
Feature *AetherBiome::getTreeFeature(Random *random)
{
    if (random->nextInt(10) == 0)
        return new GoldenOakTreeFeature(false);  // 10% chance
    return new SkyrootTreeFeature(false);         // 90% chance
}
```

And set custom colors:

```cpp
int AetherBiome::getSkyColor(float temp) { return 0x9ecbff; }
int AetherBiome::getGrassColor() { return 0x8ab69a; }
int AetherBiome::getFolageColor() { return 0x8ab69a; }
```

### The Biome Decorator

The decorator controls what features get placed in each chunk. Subclass `BiomeDecorator` and override `decorate()`:

```cpp
AetherBiomeDecorator::AetherBiomeDecorator(Biome *biome) : BiomeDecorator(biome)
{
    // Ores that replace holystone instead of stone
    ambrosiumOreFeature = new OreFeature(Tile::ambrosiumOre_Id, 16, Tile::holystone_Id);
    zaniteOreFeature = new OreFeature(Tile::zaniteOre_Id, 8, Tile::holystone_Id);
    gravititeOreFeature = new OreFeature(Tile::gravititeOre_Id, 4, Tile::holystone_Id);

    // Set feature counts
    treeCount = 2;
    grassCount = 5;
    flowerCount = 2;

    // Disable overworld stuff
    sandCount = 0;
    clayCount = 0;
    liquids = false;
    // ... etc
}
```

In the `decorate()` override, place your features:

```cpp
void AetherBiomeDecorator::decorate()
{
    decorateAetherOres();

    // Trees
    int forests = treeCount;
    if (random->nextInt(10) == 0) forests += 1;
    for (int i = 0; i < forests; i++)
    {
        int x = xo + random->nextInt(16) + 8;
        int z = zo + random->nextInt(16) + 8;
        Feature *tree = biome->getTreeFeature(random);
        tree->init(1, 1, 1);
        tree->place(level, random, x, level->getHeightmap(x, z), z);
        delete tree;
    }

    // Flowers, grass, etc...
}
```

### Registering the Biome

Register your biome as a static member on the `Biome` class, just like the existing biomes. In `Biome.h`, add:

```cpp
static Biome *myBiome;
```

In `Biome.cpp`, initialize it to `NULL` and then create it during biome setup:

```cpp
Biome *Biome::myBiome = NULL;

// In the biome initialization block:
Biome::myBiome = (new MyBiome(23))
    ->setColor(0x7EC8E3)
    ->setName(L"MyBiome")
    ->setNoRain()
    ->setTemperatureAndDownfall(0.5f, 0.0f);
```

Pick a biome ID that doesn't conflict with existing ones. The Aether uses ID 23.

## Portal Logic

Getting players into your dimension requires a portal system. There are three parts to this: the portal tile, the activation trigger, and the dimension-switching logic.

### The Portal Tile

Create a tile that extends `HalfTransparentTile`. The Aether portal is a 2-wide by 3-tall opening inside a glowstone frame:

```cpp
AetherPortalTile::AetherPortalTile(int id)
    : HalfTransparentTile(id, L"water", Material::portal, false)
{
    setTicking(true);
}
```

The key method is `trySpawnPortal()`, which validates the frame and fills it with portal blocks:

```cpp
bool AetherPortalTile::trySpawnPortal(Level *level, int x, int y, int z, bool actuallySpawn)
{
    // Check for glowstone frame on the sides
    int xd = 0, zd = 0;
    if (level->getTile(x - 1, y, z) == Tile::lightGem_Id ||
        level->getTile(x + 1, y, z) == Tile::lightGem_Id) xd = 1;
    if (level->getTile(x, y, z - 1) == Tile::lightGem_Id ||
        level->getTile(x, y, z + 1) == Tile::lightGem_Id) zd = 1;
    if (xd == zd) return false;  // Must be oriented one way

    // Validate entire frame: 4 wide x 5 tall with glowstone edges
    for (int xx = -1; xx <= 2; xx++)
    {
        for (int yy = -1; yy <= 3; yy++)
        {
            bool edge = (xx == -1) || (xx == 2) || (yy == -1) || (yy == 3);
            if ((xx == -1 || xx == 2) && (yy == -1 || yy == 3)) continue;
            int t = level->getTile(x + xd * xx, y + yy, z + zd * xx);
            if (edge)
            {
                if (t != Tile::lightGem_Id) return false;
            }
            else
            {
                if (t != 0 && t != Tile::water_Id && t != Tile::calmWater_Id)
                    return false;
            }
        }
    }

    if (!actuallySpawn) return true;

    // Fill interior with portal blocks
    level->noNeighborUpdate = true;
    for (int xx = 0; xx < 2; xx++)
        for (int yy = 0; yy < 3; yy++)
            level->setTile(x + xd * xx, y + yy, z + zd * xx,
                           Tile::aetherPortalTile_Id);
    level->noNeighborUpdate = false;
    return true;
}
```

### Activation Trigger

The Aether portal gets activated when you dump a water bucket inside a glowstone frame. This check lives in `BucketItem.cpp`:

```cpp
// When placing water from a bucket:
if (content == Tile::water_Id &&
    level->getTile(xt, yt - 1, zt) == Tile::lightGem_Id)
{
    if (Tile::aetherPortalTile->trySpawnPortal(level, xt, yt, zt, true))
    {
        return true;
    }
}
```

### Entity Teleportation

When an entity walks into the portal, `entityInside()` fires:

```cpp
void AetherPortalTile::entityInside(Level *level, int x, int y, int z,
                                     shared_ptr<Entity> entity)
{
    if (entity->riding == NULL && entity->rider.lock() == NULL)
    {
        entity->handleInsideAetherPortal();
    }
}
```

On the `Player` class, `handleInsideAetherPortal()` sets a flag:

```cpp
void Player::handleInsideAetherPortal()
{
    if (changingDimensionDelay > 0)
    {
        changingDimensionDelay = 10;
        return;
    }
    isInsideAetherPortal = true;
}
```

The actual dimension switch happens in `ServerPlayer`'s tick. It counts up `portalTime` and when it hits 1.0, it calls `toggleDimension()`:

```cpp
else if (isInsideAetherPortal)
{
    portalTime += 1 / 80.0f;
    if (portalTime >= 1)
    {
        portalTime = 1;
        changingDimensionDelay = 10;

        // Toggle between Overworld (0) and Aether (2)
        int targetDimension = 0;
        if (dimension == 2) targetDimension = 0;
        else targetDimension = 2;

        server->getPlayers()->toggleDimension(
            dynamic_pointer_cast<ServerPlayer>(shared_from_this()),
            targetDimension);
    }
    isInsideAetherPortal = false;
}
```

This means you need to:
1. Add `bool isInsideAetherPortal` to `Player.h`
2. Add `handleInsideAetherPortal()` to both `Entity` (empty base) and `Player` (sets the flag)
3. Add the portal handling block to `ServerPlayer`'s tick method

## Registering the Dimension

There are several places you need to hook your dimension into the game.

### 1. Add to Dimension::getNew()

In `Dimension.cpp`, add your dimension to the factory:

```cpp
Dimension *Dimension::getNew(int id)
{
    if (id == -1) return new HellDimension();
    if (id == 0)  return new NormalDimension();
    if (id == 1)  return new TheEndDimension();
    if (id == 2)  return new MyDimension();  // Your new dimension
    return NULL;
}
```

### 2. Register the Portal Tile

In `Tile.cpp`, add a static member and initialize it during tile setup:

```cpp
// Static member
AetherPortalTile *Tile::aetherPortalTile = NULL;

// In tile initialization:
Tile::aetherPortalTile = (AetherPortalTile *)
    ((new AetherPortalTile(137))
        ->setDestroyTime(-1)
        ->setSoundType(Tile::SOUND_GLASS)
        ->setLightEmission(0.75f))
    ->setTextureName(L"water");
```

Make sure you pick a tile ID that's not already taken. Declare the pointer in `Tile.h` too.

### 3. Register the Biome

As covered in the [biome section](#registering-the-biome), add it as a static `Biome*` member and initialize it with a unique ID.

### 4. Add Portal Support to Entity/Player

Add `handleInsideAetherPortal()` as a virtual on `Entity` (empty body) and override it on `Player` to set the portal flag. Add the dimension-switching logic to `ServerPlayer`.

## Spawn Logic

Your dimension's `isValidSpawn()` and `getSpawnPos()` control where players appear when they enter the dimension.

The Aether checks that the top block is solid:

```cpp
bool AetherDimension::isValidSpawn(int x, int z) const
{
    int topTile = level->getTopTile(x, z);
    if (topTile == 0) return false;
    return Tile::tiles[topTile]->material->blocksMotion();
}

Pos *AetherDimension::getSpawnPos()
{
    return new Pos(0, 64, 0);
}

int AetherDimension::getSpawnYPosition()
{
    return 64;
}

bool AetherDimension::mayRespawn() const
{
    return false;  // Dying sends you back to Overworld
}
```

Returning `false` from `mayRespawn()` means if a player dies in your dimension, they respawn in the Overworld instead. Both the Nether, End, and Aether work this way.

## Quick Reference: Existing Dimensions

Here's a comparison of how each dimension configures itself, which is handy for deciding what settings to use:

| Setting | Overworld | Nether | End | Aether |
|---------|-----------|--------|-----|--------|
| `id` | 0 | -1 | 1 | 2 |
| `hasCeiling` | false | true | true | false |
| `ultraWarm` | false | true | false | false |
| `getTimeOfDay()` | Full cycle | 0.5 (dim) | 0.0 (bright) | 0.0 (bright) |
| `isNaturalDimension()` | true | false | false | false |
| `mayRespawn()` | true | false | false | false |
| `hasGround()` | true | true | false | true |
| `isFoggyAt()` | false | true | true | false |
| Biome source | `BiomeSource` | Fixed (hell) | Fixed (sky) | Fixed (aether) |

## Summary

To add a custom dimension, you need to:

1. **Create a `Dimension` subclass** with your sky/fog/spawn settings
2. **Create a `ChunkSource` subclass** for terrain generation
3. **Create a `Biome` subclass** with surface blocks, colors, and a decorator
4. **Create a portal tile** for traveling to/from the dimension
5. **Register everything**: add to `Dimension::getNew()`, register the tile and biome, wire up the portal logic in `Entity`/`Player`/`ServerPlayer`

The Aether implementation in the client source is a good reference for all of this. It covers every piece of the pipeline from terrain generation to portal teleportation.
