---
title: Custom Structures
description: How to add new generated structures like dungeons, temples, and fortresses to LCE.
---

Structures are the big generated buildings you find in the world: strongholds, villages, nether fortresses, mineshafts, temples. They span multiple chunks and are built from smaller pieces that connect together. This guide walks through how all of that works and how to make your own.

## The big picture

Structure generation uses three classes working together:

1. **`StructureFeature`** decides _where_ a structure can spawn and kicks off generation
2. **`StructureStart`** holds all the pieces of one structure instance and manages the bounding box
3. **`StructurePiece`** is a single room, corridor, or building segment that actually places blocks

The flow looks like this:

```
StructureFeature::addFeature()
    -> isFeatureChunk()          // should a structure start here?
    -> createStructureStart()    // yes, build one
        -> StructureStart()
            -> create start piece
            -> startPiece->addChildren()  // recursively add rooms
            -> calculateBoundingBox()
            -> position the whole thing (moveBelowSeaLevel, etc.)

StructureFeature::postProcess()
    -> for each cached structure that overlaps this chunk:
        -> structureStart->postProcess()
            -> for each piece that overlaps the chunk bounding box:
                -> piece->postProcess()  // place actual blocks
```

## StructureFeature

`StructureFeature` (`Minecraft.World/StructureFeature.h`) extends `LargeFeature` and is the entry point for any structure type. It caches structure starts in a hashmap so they only get created once.

```cpp
class StructureFeature : public LargeFeature {
public:
    enum EFeatureTypes {
        eFeature_Mineshaft,
        eFeature_NetherBridge,
        eFeature_Temples,
        eFeature_Stronghold,
        eFeature_Village,
    };

protected:
    unordered_map<__int64, StructureStart *> cachedStructures;

    // Return true if a structure should start at chunk (x, z)
    virtual bool isFeatureChunk(int x, int z, bool bIsSuperflat = false) = 0;

    // Build and return the actual structure at chunk (x, z)
    virtual StructureStart *createStructureStart(int x, int z) = 0;
};
```

To make your own structure, you subclass `StructureFeature` and implement those two pure virtual methods. That's the minimum. Here's the skeleton:

```cpp
// MyStructureFeature.h
#pragma once
#include "StructureFeature.h"
#include "StructureStart.h"

class MyStructureFeature : public StructureFeature {
protected:
    bool isFeatureChunk(int x, int z, bool bIsSuperflat = false) override;
    StructureStart *createStructureStart(int x, int z) override;

private:
    class MyStructureStart : public StructureStart {
    public:
        MyStructureStart(Level *level, Random *random, int chunkX, int chunkZ);
    };
};
```

### How addFeature works

`addFeature()` gets called for every chunk within 8 chunks of the chunk being generated. It checks the cache, calls `isFeatureChunk()`, and if that returns true, calls `createStructureStart()` and stores the result:

```cpp
void StructureFeature::addFeature(Level *level, int x, int z, ...) {
    if (cachedStructures.find(ChunkPos::hashCode(x, z)) != cachedStructures.end())
        return;  // already cached

    random->nextInt();  // clear random key

    if (isFeatureChunk(x, z, level->getLevelData()->getGenerator() == LevelType::lvl_flat)) {
        StructureStart *start = createStructureStart(x, z);
        cachedStructures[ChunkPos::hashCode(x, z)] = start;
    }
}
```

### How postProcess works

When a chunk is actually being built, `postProcess()` loops through all cached structures and calls `postProcess` on any that overlap the current chunk's 16x16 area:

```cpp
bool StructureFeature::postProcess(Level *level, Random *random, int chunkX, int chunkZ) {
    int cx = (chunkX << 4);
    int cz = (chunkZ << 4);

    for (auto &entry : cachedStructures) {
        StructureStart *start = entry.second;
        if (start->isValid() &&
            start->getBoundingBox()->intersects(cx, cz, cx + 15, cz + 15)) {
            BoundingBox *bb = new BoundingBox(cx, cz, cx + 15, cz + 15);
            start->postProcess(level, random, bb);
            delete bb;
        }
    }
    return intersection;
}
```

This means a single structure can be built across multiple `postProcess` calls as different chunks get generated. Each piece only places blocks that fall inside the current chunk's bounding box.

## Placement rules

The `isFeatureChunk()` method is where you control spacing and biome requirements. The existing structures show a few different patterns.

### Grid-based spacing (villages)

Villages use a grid system with minimum separation:

```cpp
bool VillageFeature::isFeatureChunk(int x, int z, bool bIsSuperflat) {
    int townSpacing = bIsSuperflat ? 32 : 16;
    int minTownSeparation = 8;

    int xx = x, zz = z;
    if (x < 0) x -= townSpacing - 1;
    if (z < 0) z -= townSpacing - 1;

    int xCenter = x / townSpacing;
    int zCenter = z / townSpacing;
    Random *r = level->getRandomFor(xCenter, zCenter, 10387312);
    xCenter *= townSpacing;
    zCenter *= townSpacing;
    xCenter += r->nextInt(townSpacing - minTownSeparation);
    zCenter += r->nextInt(townSpacing - minTownSeparation);
    x = xx;
    z = zz;

    if (x == xCenter && z == zCenter) {
        // also check biome is valid
        bool biomeOk = level->getBiomeSource()->containsOnly(
            x * 16 + 8, z * 16 + 8, 0, allowedBiomes);
        if (biomeOk) return true;
    }
    return false;
}
```

The key idea: divide the world into a grid of `townSpacing` chunks, pick one random spot per grid cell (offset by up to `townSpacing - minTownSeparation`), and only spawn there if the biome is right.

### Random chance (mineshafts)

Mineshafts use a probability check that scales with distance from origin:

```cpp
bool MineShaftFeature::isFeatureChunk(int x, int z, bool bIsSuperflat) {
    return random->nextInt(100) == 0
        && random->nextInt(80) < max(abs(x), abs(z));
}
```

The first gate is 1-in-100. The second check means mineshafts are more likely the further you go from spawn. At chunk (0,0), the second check almost always fails (needs random < 0). At chunk (80,0), it's a guaranteed pass.

### Fixed position (nether fortress)

The nether fortress picks one random position at world creation time (based on the seed) and always spawns there. On console edition with limited world size, this makes sure there's always at least one:

```cpp
bool NetherBridgeFeature::isFeatureChunk(int x, int z, bool bIsSuperflat) {
    if (!isSpotSelected) {
        random->setSeed(level->getSeed());
        random->nextInt();
        // 7x7 grid of possible chunks
        int chunk = random->nextInt(49);
        int xCoord = chunk % 7;
        int zCoord = chunk / 7;
        netherFortressPos = new ChunkPos(xCoord, zCoord);
        isSpotSelected = true;
    }

    if (x == netherFortressPos->x && z == netherFortressPos->z)
        return true;

    // On large worlds, extra fortresses can spawn via
    // a region-based 1-in-3 chance per 16-chunk cell
    #ifdef _LARGE_WORLDS
    if (level->dimension->getXZSize() > 30) {
        int cx = x >> 4;
        int cz = z >> 4;
        random->setSeed(cx ^ (cz << 4) ^ level->getSeed());
        random->nextInt();
        if (random->nextInt(3) != 0) return false;
        if (x != ((cx << 4) + 4 + random->nextInt(8))) return false;
        if (z != ((cz << 4) + 4 + random->nextInt(8))) return false;
        return true;
    }
    #endif

    return false;
}
```

### Biome-aware placement (strongholds)

Strongholds pick a position at a certain distance and angle from origin, then nudge it to find a valid biome:

```cpp
TilePos *position = level->getBiomeSource()->findBiome(
    (selectedX << 4) + 8, (selectedZ << 4) + 8,
    7 << 4,         // search radius
    allowedBiomes,  // acceptable biomes
    &random
);
```

### Game rules override

All built-in structures also check `LevelGenerationOptions::isFeatureChunk()` to allow forced placement through the game rules XML system. Your custom structure can do this too if you add it to the `EFeatureTypes` enum.

## StructureStart

`StructureStart` (`Minecraft.World/StructureStart.h`) is the container that holds all the pieces for one instance of a structure. It manages the overall bounding box and delegates block placement to each piece.

```cpp
class StructureStart {
protected:
    list<StructurePiece *> pieces;
    BoundingBox *boundingBox;

    StructureStart();

    void calculateBoundingBox();           // union of all piece boxes
    void moveBelowSeaLevel(Level *level, Random *random, int offset);
    void moveInsideHeights(Level *level, Random *random, int lowest, int highest);

public:
    void postProcess(Level *level, Random *random, BoundingBox *chunkBB);
    bool isValid();
};
```

The constructor of your `StructureStart` subclass is where the magic happens. You create a start piece, call `addChildren()` to recursively grow the structure, then position it:

```cpp
MyStructureFeature::MyStructureStart::MyStructureStart(
    Level *level, Random *random, int chunkX, int chunkZ
) : StructureStart() {
    // Create the first piece at the chunk position
    MyStartPiece *start = new MyStartPiece(
        random, (chunkX << 4) + 2, (chunkZ << 4) + 2
    );
    pieces.push_back(start);

    // Recursively add connected rooms/corridors
    start->addChildren(start, &pieces, random);

    // If your structure uses a pending queue (like fortresses do):
    vector<StructurePiece *> *pending = &start->pendingChildren;
    while (!pending->empty()) {
        int pos = random->nextInt((int)pending->size());
        auto it = pending->begin() + pos;
        StructurePiece *piece = *it;
        pending->erase(it);
        piece->addChildren(start, &pieces, random);
    }

    // Calculate the overall bounding box from all pieces
    calculateBoundingBox();

    // Position the structure vertically
    // For underground structures:
    moveBelowSeaLevel(level, random, 10);
    // For structures at a specific height range:
    // moveInsideHeights(level, random, 48, 70);
}
```

### Positioning helpers

- **`calculateBoundingBox()`** creates a bounding box that encloses all pieces. Call this after all pieces are added.
- **`moveBelowSeaLevel(level, random, offset)`** pushes the structure underground. Used by strongholds. The `offset` is subtracted from sea level to get the max Y.
- **`moveInsideHeights(level, random, lowest, highest)`** moves the structure to a random Y between `lowest` and `highest`. Used by nether fortresses (48 to 70).

### Validity

`isValid()` returns true by default. Villages override it to check that the structure has enough non-road pieces (more than 2) and that the bounding box fits inside the world:

```cpp
bool VillageFeature::VillageStart::isValid() {
    if ((boundingBox->x0 < (-m_iXZSize / 2)) ||
        (boundingBox->x1 > (m_iXZSize / 2)) ||
        (boundingBox->z0 < (-m_iXZSize / 2)) ||
        (boundingBox->z1 > (m_iXZSize / 2))) {
        valid = false;
    }
    return valid;
}
```

If `isValid()` returns false, the structure is skipped entirely during `postProcess`.

## StructurePiece

`StructurePiece` (`Minecraft.World/StructurePiece.h`) is the building block. Each piece is a room, corridor, staircase, or other segment that knows how to place its own blocks.

```cpp
class StructurePiece {
protected:
    BoundingBox *boundingBox;  // world-space bounds
    int orientation;           // Direction::NORTH, SOUTH, EAST, WEST, or UNDEFINED
    int genDepth;              // how deep in the recursion tree

    StructurePiece(int genDepth);

public:
    // Override to spawn child pieces (corridors, rooms, etc.)
    virtual void addChildren(StructurePiece *startPiece,
                             list<StructurePiece *> *pieces,
                             Random *random);

    // Override to place blocks in the world
    virtual bool postProcess(Level *level, Random *random,
                             BoundingBox *chunkBB) = 0;
};
```

### Coordinate system

This is the tricky part. Pieces work in **local coordinates** that get translated to world coordinates based on the orientation and bounding box. The translation methods are:

- `getWorldX(x, z)` converts local X
- `getWorldY(y)` converts local Y (adds `boundingBox->y0`)
- `getWorldZ(x, z)` converts local Z

The orientation flips and swaps coordinates so the same piece layout can face any direction:

| Orientation | Local (0,0,0) maps to | X axis becomes | Z axis becomes |
|---|---|---|---|
| `NORTH` | `(bb.x0, bb.y0, bb.z1)` | world X | world -Z |
| `SOUTH` | `(bb.x0, bb.y0, bb.z0)` | world X | world +Z |
| `WEST` | `(bb.x1, bb.y0, bb.z0)` | world -X | world Z |
| `EAST` | `(bb.x0, bb.y0, bb.z0)` | world +X | world Z |

You don't need to think about this most of the time. Just use the helper methods and they handle the rotation for you.

### Block placement helpers

`StructurePiece` has a bunch of helpers for placing blocks in local coordinates. These all respect the chunk bounding box, so they won't accidentally generate blocks outside the current chunk:

```cpp
// Place a single block at local (x, y, z)
void placeBlock(Level *level, int block, int data,
                int x, int y, int z, BoundingBox *chunkBB);

// Read a block at local (x, y, z), returns 0 if outside bounds
int getBlock(Level *level, int x, int y, int z, BoundingBox *chunkBB);

// Fill a box with edge and fill blocks
void generateBox(Level *level, BoundingBox *chunkBB,
                 int x0, int y0, int z0, int x1, int y1, int z1,
                 int edgeTile, int fillTile, bool skipAir);

// Same but with data values for edge and fill
void generateBox(Level *level, BoundingBox *chunkBB,
                 int x0, int y0, int z0, int x1, int y1, int z1,
                 int edgeTile, int edgeData, int fillTile, int fillData,
                 bool skipAir);

// Fill a box with air
void generateAirBox(Level *level, BoundingBox *chunkBB,
                    int x0, int y0, int z0, int x1, int y1, int z1);

// Fill with a probability (some blocks get skipped randomly)
void generateMaybeBox(Level *level, BoundingBox *chunkBB,
                      Random *random, float probability,
                      int x0, int y0, int z0, int x1, int y1, int z1,
                      int edgeTile, int fillTile, bool skipAir);

// Maybe place a single block (probability-based)
void maybeGenerateBlock(Level *level, BoundingBox *chunkBB,
                        Random *random, float probability,
                        int x, int y, int z, int tile, int data);

// Fill a dome/sphere shape
void generateUpperHalfSphere(Level *level, BoundingBox *chunkBB,
                             int x0, int y0, int z0, int x1, int y1, int z1,
                             int fillTile, bool skipAir);

// Fill a column downward until hitting solid ground
void fillColumnDown(Level *level, int tile, int tileData,
                    int x, int startY, int z, BoundingBox *chunkBB);

// Clear blocks upward until hitting air
void generateAirColumnUp(Level *level, int x, int startY, int z,
                         BoundingBox *chunkBB);
```

The `skipAir` parameter on `generateBox` is important: when true, it won't replace existing air blocks. This is useful when you want to overlay a structure onto existing terrain without filling in caves.

### Orientation-aware data values

When placing blocks like stairs, doors, ladders, or rails, their data values (which control facing direction) need to be rotated to match the piece's orientation. Use `getOrientationData()`:

```cpp
placeBlock(level,
    Tile::stairs_stone_Id,
    getOrientationData(Tile::stairs_stone_Id, 2),  // auto-rotates
    x, y, z, chunkBB);
```

This handles rotation for rails, doors, stairs, ladders, buttons, pistons, dispensers, levers, and directional tiles.

### Collision detection

Before placing a new piece, check that it doesn't overlap any existing pieces:

```cpp
static StructurePiece *findCollisionPiece(
    list<StructurePiece *> *pieces, BoundingBox *box);
```

Returns the colliding piece if one exists, or `NULL` if the space is free.

### Liquid edge check

Before placing blocks, many pieces check if they're next to lava or water:

```cpp
bool edgesLiquid(Level *level, BoundingBox *chunkBB);
```

If this returns true, the piece's `postProcess` returns false, which removes it from the structure. This is how mineshafts avoid generating into lava lakes.

## Creating a new structure from scratch

Let's put it all together. Say you want to add an abandoned tower that spawns on the surface in forest biomes.

### Step 1: Define your pieces

```cpp
// AbandonedTowerPieces.h
#pragma once
#include "StructurePiece.h"

class AbandonedTowerPieces {
public:
    static void staticCtor();

    class TowerBase : public StructurePiece {
    public:
        TowerBase(int genDepth, Random *random, int west, int north);

        void addChildren(StructurePiece *startPiece,
                         list<StructurePiece *> *pieces,
                         Random *random) override;
        bool postProcess(Level *level, Random *random,
                         BoundingBox *chunkBB) override;
    };

    class TowerFloor : public StructurePiece {
    private:
        bool hasChest;

    public:
        TowerFloor(int genDepth, BoundingBox *box, bool hasChest);

        bool postProcess(Level *level, Random *random,
                         BoundingBox *chunkBB) override;
    };

private:
    static WeighedTreasureArray treasureItems;
};
```

### Step 2: Implement the pieces

```cpp
// AbandonedTowerPieces.cpp
#include "stdafx.h"
#include "AbandonedTowerPieces.h"
#include "BoundingBox.h"
#include "WeighedTreasure.h"

WeighedTreasureArray AbandonedTowerPieces::treasureItems;

void AbandonedTowerPieces::staticCtor() {
    treasureItems = WeighedTreasureArray(4);
    treasureItems[0] = new WeighedTreasure(Item::ironIngot_Id, 0, 1, 4, 10);
    treasureItems[1] = new WeighedTreasure(Item::bread_Id, 0, 1, 3, 15);
    treasureItems[2] = new WeighedTreasure(Item::goldIngot_Id, 0, 1, 2, 5);
    treasureItems[3] = new WeighedTreasure(Item::bow_Id, 0, 1, 1, 3);
}

AbandonedTowerPieces::TowerBase::TowerBase(
    int genDepth, Random *random, int west, int north
) : StructurePiece(genDepth) {
    // 7x12x7 tower base, starting at y=64 (adjusted later)
    orientation = random->nextInt(4);
    boundingBox = new BoundingBox(west, 64, north,
                                  west + 6, 64 + 11, north + 6);
}

void AbandonedTowerPieces::TowerBase::addChildren(
    StructurePiece *startPiece,
    list<StructurePiece *> *pieces,
    Random *random
) {
    // Stack 2-3 floors on top of the base
    int floorCount = 2 + random->nextInt(2);
    for (int i = 0; i < floorCount; i++) {
        int floorY = boundingBox->y0 + 4 + (i * 4);
        BoundingBox *floorBB = new BoundingBox(
            boundingBox->x0, floorY, boundingBox->z0,
            boundingBox->x1, floorY + 3, boundingBox->z1
        );

        // Check for collision before adding
        if (StructurePiece::findCollisionPiece(pieces, floorBB) == NULL) {
            bool hasChest = (i == floorCount - 1);  // top floor gets loot
            StructurePiece *floor = new TowerFloor(
                genDepth + 1, floorBB, hasChest);
            pieces->push_back(floor);
        } else {
            delete floorBB;
        }
    }
}

bool AbandonedTowerPieces::TowerBase::postProcess(
    Level *level, Random *random, BoundingBox *chunkBB
) {
    if (edgesLiquid(level, chunkBB)) return false;

    // Stone brick walls (edge = stone brick, fill = air)
    generateBox(level, chunkBB,
        0, 0, 0, 6, 3, 6,
        Tile::stoneBrickSmooth_Id, 0, 0, 0, false);

    // Hollow the inside
    generateAirBox(level, chunkBB, 1, 1, 1, 5, 3, 5);

    // Floor
    generateBox(level, chunkBB,
        1, 0, 1, 5, 0, 5,
        Tile::stoneBrickSmooth_Id, 0, false);

    // Door opening on the south side
    generateAirBox(level, chunkBB, 2, 1, 0, 4, 2, 0);

    // Fill columns down to ground so it doesn't float
    for (int x = 0; x <= 6; x++) {
        for (int z = 0; z <= 6; z++) {
            fillColumnDown(level, Tile::stoneBrickSmooth_Id, 0,
                           x, -1, z, chunkBB);
        }
    }

    return true;
}

AbandonedTowerPieces::TowerFloor::TowerFloor(
    int genDepth, BoundingBox *box, bool hasChest
) : StructurePiece(genDepth), hasChest(hasChest) {
    boundingBox = box;
}

bool AbandonedTowerPieces::TowerFloor::postProcess(
    Level *level, Random *random, BoundingBox *chunkBB
) {
    // Walls
    generateBox(level, chunkBB,
        0, 0, 0, 6, 3, 6,
        Tile::stoneBrickSmooth_Id, 0, 0, 0, false);

    // Hollow inside
    generateAirBox(level, chunkBB, 1, 0, 1, 5, 3, 5);

    // Floor planks
    generateBox(level, chunkBB,
        1, 0, 1, 5, 0, 5,
        Tile::wood_Id, 0, false);

    // Cobweb decoration
    maybeGenerateBlock(level, chunkBB, random, 0.3f,
                       1, 3, 1, Tile::web_Id, 0);
    maybeGenerateBlock(level, chunkBB, random, 0.3f,
                       5, 3, 5, Tile::web_Id, 0);

    // Loot chest on the top floor
    if (hasChest) {
        createChest(level, chunkBB, random,
                    3, 1, 3, treasureItems, 4);
    }

    return true;
}
```

### Step 3: Define the StructureFeature

```cpp
// AbandonedTowerFeature.h
#pragma once
#include "StructureFeature.h"
#include "StructureStart.h"

class AbandonedTowerFeature : public StructureFeature {
public:
    static void staticCtor();
    static vector<Biome *> allowedBiomes;

protected:
    bool isFeatureChunk(int x, int z, bool bIsSuperflat = false) override;
    StructureStart *createStructureStart(int x, int z) override;

private:
    class TowerStart : public StructureStart {
    public:
        TowerStart(Level *level, Random *random, int chunkX, int chunkZ);
    };
};
```

```cpp
// AbandonedTowerFeature.cpp
#include "stdafx.h"
#include "AbandonedTowerFeature.h"
#include "AbandonedTowerPieces.h"
#include "net.minecraft.world.level.h"
#include "net.minecraft.world.level.biome.h"

vector<Biome *> AbandonedTowerFeature::allowedBiomes;

void AbandonedTowerFeature::staticCtor() {
    allowedBiomes.push_back(Biome::forest);
    allowedBiomes.push_back(Biome::forestHills);
}

bool AbandonedTowerFeature::isFeatureChunk(int x, int z, bool bIsSuperflat) {
    // Space towers 24 chunks apart, minimum 8 chunk separation
    int spacing = 24;
    int separation = 8;

    int xx = x, zz = z;
    if (x < 0) x -= spacing - 1;
    if (z < 0) z -= spacing - 1;

    int gridX = x / spacing;
    int gridZ = z / spacing;
    Random *r = level->getRandomFor(gridX, gridZ, 98765432);
    gridX *= spacing;
    gridZ *= spacing;
    gridX += r->nextInt(spacing - separation);
    gridZ += r->nextInt(spacing - separation);
    x = xx;
    z = zz;

    if (x == gridX && z == gridZ) {
        return level->getBiomeSource()->containsOnly(
            x * 16 + 8, z * 16 + 8, 0, allowedBiomes);
    }
    return false;
}

StructureStart *AbandonedTowerFeature::createStructureStart(int x, int z) {
    return new TowerStart(level, random, x, z);
}

AbandonedTowerFeature::TowerStart::TowerStart(
    Level *level, Random *random, int chunkX, int chunkZ
) : StructureStart() {
    AbandonedTowerPieces::TowerBase *base =
        new AbandonedTowerPieces::TowerBase(
            0, random, (chunkX << 4) + 2, (chunkZ << 4) + 2);
    pieces.push_back(base);
    base->addChildren(base, &pieces, random);

    calculateBoundingBox();
    // No vertical repositioning needed for surface structures
}
```

### Step 4: Register it in world generation

Add your feature to `RandomLevelSource` in its constructor and `postProcess`:

```cpp
// In RandomLevelSource.h, add a member:
AbandonedTowerFeature *abandonedTowerFeature;

// In RandomLevelSource constructor:
abandonedTowerFeature = new AbandonedTowerFeature();

// In RandomLevelSource::postProcess():
abandonedTowerFeature->postProcess(level, random, chunkX, chunkZ);

// In RandomLevelSource::create() (or apply()), add the feature scan:
if (generateStructures) {
    // ... existing features ...
    abandonedTowerFeature->apply(this, level, xOffs, zOffs, blocks);
}
```

Don't forget to call your `staticCtor()` during initialization (where the other structure `staticCtor` calls happen) and clean up in the destructor.

## Adding rooms and corridors

The recursive piece system is how structures grow organically. Each piece's `addChildren()` method creates new pieces and adds them to the shared piece list.

### The recursion pattern

Here's how mineshafts do it. A corridor picks a random direction at the end and spawns a new piece:

```cpp
void MineShaftCorridor::addChildren(
    StructurePiece *startPiece,
    list<StructurePiece *> *pieces,
    Random *random
) {
    int depth = getGenDepth();
    int endSelection = random->nextInt(4);

    switch (orientation) {
    case Direction::NORTH:
        if (endSelection <= 1) {
            // Continue straight
            generateAndAddPiece(startPiece, pieces, random,
                boundingBox->x0, boundingBox->y0 - 1 + random->nextInt(3),
                boundingBox->z0 - 1, orientation, depth);
        } else if (endSelection == 2) {
            // Branch left
            generateAndAddPiece(startPiece, pieces, random,
                boundingBox->x0 - 1, boundingBox->y0 - 1 + random->nextInt(3),
                boundingBox->z0, Direction::WEST, depth);
        } else {
            // Branch right
            generateAndAddPiece(startPiece, pieces, random,
                boundingBox->x1 + 1, boundingBox->y0 - 1 + random->nextInt(3),
                boundingBox->z0, Direction::EAST, depth);
        }
        break;
    // ... similar for other directions
    }
}
```

### Depth limits

Use `genDepth` to prevent infinite recursion. Mineshafts cap at depth 8:

```cpp
StructurePiece *MineShaftPieces::generateAndAddPiece(..., int depth) {
    if (depth > MAX_DEPTH) return NULL;

    // Also limit distance from start piece
    if (abs(footX - startPiece->getBoundingBox()->x0) > 5 * 16 ||
        abs(footZ - startPiece->getBoundingBox()->z0) > 5 * 16)
        return NULL;

    StructurePiece *newPiece = createRandomShaftPiece(
        pieces, random, footX, footY, footZ, direction, depth + 1);
    if (newPiece != NULL) {
        pieces->push_back(newPiece);
        newPiece->addChildren(startPiece, pieces, random);
    }
    return newPiece;
}
```

### Weighted random piece selection

Nether fortresses use a weight system to control how often each piece type shows up:

```cpp
class PieceWeight {
public:
    EPieceClass pieceClass;
    const int weight;       // how likely this piece is to be picked
    int placeCount;         // how many times it's been placed
    int maxPlaceCount;      // max allowed (0 = unlimited)
    bool allowInRow;        // can this piece repeat back-to-back?

    bool doPlace(int depth);
    bool isValid();
};
```

The weight values control the probability distribution. Higher weight = more likely to be picked. `maxPlaceCount` prevents any one piece type from taking over the whole structure.

### BoundingBox::orientBox

When creating a new piece's bounding box relative to a parent, use `BoundingBox::orientBox()`:

```cpp
static BoundingBox *orientBox(
    int footX, int footY, int footZ,   // connection point
    int offX, int offY, int offZ,      // offset from foot
    int width, int height, int depth,   // piece dimensions
    int orientation                     // facing direction
);
```

This creates a correctly oriented bounding box for a piece that connects at the given foot position. It handles all the coordinate rotation for you.

## Loot chests

Adding loot chests to your structure uses the `createChest()` method on `StructurePiece`:

```cpp
bool createChest(Level *level, BoundingBox *chunkBB, Random *random,
                 int x, int y, int z,
                 WeighedTreasureArray treasure, int numRolls);
```

- `x, y, z` are local coordinates inside the piece
- `treasure` is the loot table (array of `WeighedTreasure` items)
- `numRolls` is how many times to roll the loot table

### Defining a loot table

Each `WeighedTreasure` entry defines one possible item:

```cpp
WeighedTreasure(int itemId, int auxValue, int minCount, int maxCount, int weight);
```

- `itemId` is the item or block ID
- `auxValue` is the data/damage value (0 for most items)
- `minCount` / `maxCount` is the stack size range
- `weight` controls how likely this item is to be picked (higher = more common)

Here's the mineshaft loot table as a real example:

```cpp
void MineShaftPieces::staticCtor() {
    smallTreasureItems = WeighedTreasureArray(11);
    smallTreasureItems[0]  = new WeighedTreasure(Item::ironIngot_Id, 0, 1, 5, 10);
    smallTreasureItems[1]  = new WeighedTreasure(Item::goldIngot_Id, 0, 1, 3, 5);
    smallTreasureItems[2]  = new WeighedTreasure(Item::redStone_Id, 0, 4, 9, 5);
    smallTreasureItems[3]  = new WeighedTreasure(Item::dye_powder_Id,
                                                  DyePowderItem::BLUE, 4, 9, 5);
    smallTreasureItems[4]  = new WeighedTreasure(Item::diamond_Id, 0, 1, 2, 3);
    smallTreasureItems[5]  = new WeighedTreasure(Item::coal_Id,
                                                  CoalItem::STONE_COAL, 3, 8, 10);
    smallTreasureItems[6]  = new WeighedTreasure(Item::bread_Id, 0, 1, 3, 15);
    smallTreasureItems[7]  = new WeighedTreasure(Item::pickAxe_iron_Id, 0, 1, 1, 1);
    smallTreasureItems[8]  = new WeighedTreasure(Tile::rail_Id, 0, 4, 8, 1);
    smallTreasureItems[9]  = new WeighedTreasure(Item::seeds_melon_Id, 0, 2, 4, 10);
    smallTreasureItems[10] = new WeighedTreasure(Item::seeds_pumpkin_Id, 0, 2, 4, 10);
}
```

You can also add enchanted books using `addToTreasure`:

```cpp
createChest(level, chunkBB, random, x, y, z,
    WeighedTreasure::addToTreasure(
        smallTreasureItems,
        Item::enchantedBook->createForRandomTreasure(random)
    ),
    3 + random->nextInt(4)  // 3-6 rolls
);
```

### Dispensers

For trap-style structures, you can also place dispensers with items using `createDispenser()`:

```cpp
bool createDispenser(Level *level, BoundingBox *chunkBB, Random *random,
                     int x, int y, int z, int facing,
                     WeighedTreasureArray items, int numRolls);
```

The `facing` parameter gets auto-rotated through `getOrientationData()` just like any other directional block.

## Mob spawners

To place a mob spawner (like the cave spider spawner in mineshafts):

```cpp
// Convert local coords to world coords yourself for tile entities
int y = getWorldY(y0);
int x = getWorldX(x0 + 1, newZ);
int z = getWorldZ(x0 + 1, newZ);

if (chunkBB->isInside(x, y, z)) {
    level->setTile(x, y, z, Tile::mobSpawner_Id);
    auto entity = dynamic_pointer_cast<MobSpawnerTileEntity>(
        level->getTileEntity(x, y, z));
    if (entity != NULL) {
        entity->setEntityId(L"CaveSpider");
    }
}
```

Note that tile entity setup needs world coordinates, not local coordinates. The `placeBlock()` helper won't set up the tile entity for you, so you need to call `setTile()` and then grab the entity separately.

## Console-specific stuff

### The game rules system

4J Studios added a `ConsoleGenerateStructure` class that lets the game rules XML system define custom structures at specific coordinates. These are used for mashup packs and pre-placed content:

```cpp
class ConsoleGenerateStructure : public GameRuleDefinition, public StructurePiece {
    // Combines game rule parsing with structure piece placement
    int m_x, m_y, m_z;
    vector<ConsoleGenerateStructureAction *> m_actions;
    int m_dimension;
};
```

This is separate from the procedural structure system and places structures at exact world positions defined in XML.

### World boundary checks

Console worlds have fixed sizes. Always check that your structure fits within the world boundaries. The village code shows how:

```cpp
if ((boundingBox->x0 < (-m_iXZSize / 2)) || (boundingBox->x1 > (m_iXZSize / 2)))
    valid = false;
```

### Structure density on small worlds

Console worlds are much smaller than Java worlds. The existing code adjusts structure spacing based on world size. For example, villages use a spacing of 16 chunks on console vs 32 on Java. Keep this in mind when setting your spacing values. If your structures are too dense they'll overlap, too sparse and players might never find them.

## BlockSelector for varied materials

For structures that use multiple block types randomly (like the jungle temple's mossy stone), create a `BlockSelector` subclass:

```cpp
class MossStoneSelector : public StructurePiece::BlockSelector {
public:
    void next(Random *random, int worldX, int worldY, int worldZ, bool isEdge) override {
        if (random->nextFloat() < 0.4f) {
            nextId = Tile::mossStone_Id;  // mossy cobblestone
        } else {
            nextId = Tile::stoneBrick_Id;  // regular cobblestone
        }
        nextData = 0;
    }
};
```

Then use it with the `generateBox` overload that takes a selector:

```cpp
MossStoneSelector selector;
generateBox(level, chunkBB, x0, y0, z0, x1, y1, z1,
            false, random, &selector);
```

The `isEdge` parameter tells you whether the current block is on the outer surface of the box, so you can use different materials for walls vs interior.

## Every built-in structure analyzed

Now that you know the system, here is a detailed breakdown of every structure that ships with LCE.

### Mineshafts (`MineShaftFeature`)

**Placement:** Random chance. `random->nextInt(100) == 0 && random->nextInt(80) < max(abs(x), abs(z))`. This means mineshafts are more common further from spawn. The double random gate makes them rare in the first place (1 in 100 chunks pass the first check), and the second check scales with distance.

**Start:** `MineShaftStart` creates a `MineShaftRoom` (a random-sized dirt room, 7-13 blocks wide, at y=50-60) and calls `addChildren`. The whole thing gets moved below sea level with `moveBelowSeaLevel(level, random, 10)`.

**Piece types:**

| Piece | Chance | Description |
|---|---|---|
| `MineShaftCorridor` | 70% | The standard tunnel. 3 wide, variable length. Can have rails (`hasRails`) or be a spider corridor (`spiderCorridor`) with cobwebs and cave spider spawners. |
| `MineShaftStairs` | 10% | A staircase that goes up or down, connecting corridors at different heights. |
| `MineShaftCrossing` | 20% | A 2-4 way intersection. Can be two-floored (`isTwoFloored`). |
| `MineShaftRoom` | start only | The initial dirt room that everything branches from. |

**Depth limit:** 8. Distance limit: 5 chunks (80 blocks) from the start piece in X or Z.

**Loot table (11 items):**

| Item | Count | Weight |
|---|---|---|
| Iron Ingot | 1-5 | 10 |
| Gold Ingot | 1-3 | 5 |
| Redstone | 4-9 | 5 |
| Lapis Lazuli | 4-9 | 5 |
| Diamond | 1-2 | 3 |
| Coal | 3-8 | 10 |
| Bread | 1-3 | 15 |
| Iron Pickaxe | 1 | 1 |
| Rail | 4-8 | 1 |
| Melon Seeds | 2-4 | 10 |
| Pumpkin Seeds | 2-4 | 10 |

Plus a random enchanted book gets added through `addToTreasure`.

---

### Nether Fortress (`NetherBridgeFeature`)

**Placement:** On small console worlds, the fortress position is forced. The game picks one of 49 chunks in a 7x7 grid using `random->nextInt(49)` seeded from the world seed. This guarantees exactly one fortress per small nether. On large worlds (`_LARGE_WORLDS`), extra fortresses can also spawn using the Java-style algorithm (1 in 3 chance per 16x16 chunk region).

**Mob spawns:** The fortress maintains its own enemy list used for spawn checks inside the bounding box:
- Blaze (weight 10, group 2-3)
- Zombie Pigman (weight 10, group 4)
- Magma Cube (weight 3, group 4)

**Start:** `NetherBridgeStart` creates a `BridgeCrossing` as the starting piece. After recursive generation, the whole structure is positioned with `moveInsideHeights(level, random, 48, 70)`, placing it between y=48 and y=70.

**Piece system:** The fortress uses two separate weight lists for bridge pieces and castle pieces:

**Bridge pieces (6 types):**

| Piece | Weight | Max | Allow Repeat | Size |
|---|---|---|---|---|
| `BridgeStraight` | 30 | unlimited | yes | 5x10x19 |
| `BridgeCrossing` | 10 | 4 | no | 19x10x19 |
| `MonsterThrone` | 15 | 2 | no | 7x8x9 |
| `CastleEntrance` | 15 | 1 | no | 13x14x13 |
| `RoomCrossing` | 10 | 4 | no | 7x9x7 |
| `StairsRoom` | 10 | 3 | no | 7x11x7 |

**Castle pieces (7 types):**

| Piece | Weight | Max | Allow Repeat | Size |
|---|---|---|---|---|
| `CastleStalkRoom` | 30 | 2 | no | 13x14x13 |
| `CastleSmallCorridorPiece` | 25 | unlimited | yes | 5x7x5 |
| `CastleSmallCorridorCrossingPiece` | 15 | 5 | no | 5x7x5 |
| `CastleSmallCorridorRightTurnPiece` | 5 | 10 | no | 5x7x5 |
| `CastleSmallCorridorLeftTurnPiece` | 5 | 10 | no | 5x7x5 |
| `CastleCorridorStairsPiece` | 10 | 3 | yes | 5x14x10 |
| `CastleCorridorTBalconyPiece` | 7 | 2 | no | 9x7x9 |

4J increased the weights for `MonsterThrone` (was 5, now 15) and `CastleEntrance` (was 5, now 15) to make sure blazes and nether wart always appear. Without them, brewing would be impossible. `CastleStalkRoom` was also bumped (5 to 30) since it grows the nether wart.

**Depth limit:** 30. Distance limit: 7 chunks (112 blocks) from the start. When nothing fits, a `BridgeEndFiller` (dead end wall, 5x10x8) caps the corridor.

**The `allowInRow` flag:** Bridge pieces have an extra `allowInRow` boolean. When set to true, the same piece type can appear back-to-back. Only `BridgeStraight`, `CastleSmallCorridorPiece`, and `CastleCorridorStairsPiece` allow this. Everything else forces a different piece type after each placement.

---

### Stronghold (`StrongholdFeature`)

**Placement:** Fixed count based on world size. Java gets 3 strongholds, console gets just 1 (`strongholdPos_length = 1`). The position is picked by generating a random angle, computing a distance from origin (tuned for console world size), and then using `BiomeSource::findBiome()` to nudge it into a valid biome.

On small console saves (pre-TU9), the distance formula is `(1.25 + random) * (5 + random(7))`. Post-TU9, it was tightened to `(1.25 + random) * (3 + random(4))` to keep the stronghold further from the world edge. Large worlds use the original Java distance of `(1.25 + random) * 32`.

The code retries up to `MAX_STRONGHOLD_ATTEMPTS` times (10 on old-gen, 30 on new-gen) to find a valid biome. If it never finds one, it still stores the last attempted position so the Eye of Ender works.

**Allowed biomes:** Desert, Forest, Extreme Hills, Swampland, Taiga, Ice Plains, Ice Mountains, Desert Hills, Forest Hills, Smaller Extreme Hills, Taiga Hills, Jungle, Jungle Hills.

**Start:** `StrongholdStart` creates a `StairsDown` as the entry. After recursive piece generation, the whole structure is moved underground with `moveBelowSeaLevel(level, random, 10)`. The code regenerates the entire stronghold (destroying and re-creating `StrongholdStart`) until the portal room piece exists.

**Piece weights (11 types):**

| Piece | Weight | Max | Size | Special |
|---|---|---|---|---|
| `Straight` | 40 | unlimited | 5x5x7 | Can branch left/right randomly |
| `PrisonHall` | 5 | 5 | 9x5x11 | Iron bars cells |
| `LeftTurn` | 20 | unlimited | 5x5x5 | |
| `RightTurn` | 20 | unlimited | 5x5x5 | |
| `RoomCrossing` | 10 | 6 | 11x7x11 | Has 3 room variants with fountains/pillars |
| `StraightStairsDown` | 5 | 5 | 5x11x8 | |
| `StairsDown` | 5 | 5 | 5x11x5 | |
| `FiveCrossing` | 5 | 4 | 10x9x11 | 5 exits, configurable per side |
| `ChestCorridor` | 5 | 4 | 5x5x7 | Contains a loot chest |
| `Library` | 10 | 2 | 14x6(or 11)x15 | Only at depth > 4. Can be tall or short. |
| `PortalRoom` | 20 | 1 | 11x8x16 | Only at depth > 5. End portal + silverfish spawner. |

**Door types:** Each stronghold piece has a random door type: `OPENING` (no door), `WOOD_DOOR`, `GRATES` (iron bars), or `IRON_DOOR`.

**`SmoothStoneSelector`:** The stronghold has its own `BlockSelector` that randomly picks between stone bricks, mossy stone bricks, and cracked stone bricks. This gives the walls their weathered look.

**Loot tables:**

ChestCorridor (14 items):

| Item | Count | Weight |
|---|---|---|
| Ender Pearl | 1 | 10 |
| Diamond | 1-3 | 3 |
| Iron Ingot | 1-5 | 10 |
| Gold Ingot | 1-3 | 5 |
| Redstone | 4-9 | 5 |
| Bread | 1-3 | 15 |
| Apple | 1-3 | 15 |
| Iron Pickaxe | 1 | 5 |
| Iron Sword | 1 | 5 |
| Iron Chestplate | 1 | 5 |
| Iron Helmet | 1 | 5 |
| Iron Leggings | 1 | 5 |
| Iron Boots | 1 | 5 |
| Golden Apple | 1 | 1 |

Library (4 items):

| Item | Count | Weight |
|---|---|---|
| Book | 1-3 | 20 |
| Paper | 2-7 | 20 |
| Map | 1 | 1 |
| Compass | 1 | 1 |

RoomCrossing (7 items): Iron Ingot (1-5, w10), Gold Ingot (1-3, w5), Redstone (4-9, w5), Coal (3-8, w10), Bread (1-3, w15), Apple (1-3, w15), Iron Pickaxe (1, w1).

---

### Village (`VillageFeature`)

**Placement:** Grid-based, spacing of 16 chunks on console (32 on superflat or large worlds), minimum separation of 8 chunks. Only spawns in plains and desert biomes. 4J added a bounds check in `isValid()` to reject villages that extend past the world edge. Villages need more than 2 non-road pieces to be considered valid.

**Start:** `VillageStart` creates a `Well` as the center piece. The well spawns roads, and roads spawn buildings. Two separate queues (`pendingRoads` and `pendingHouses`) are processed in random order, with roads getting priority.

**Piece weights (9 building types):**

| Piece | Weight | Max (base) | Size | Spawns |
|---|---|---|---|---|
| `SimpleHouse` | 4 | 2-4 + villageSize scaling | 5x6x5 | Generic villager |
| `SmallTemple` | 20 | 0-1 + villageSize | 5x12x9 | Priest |
| `BookHouse` | 20 | 0-2 + villageSize | 9x9x6 | Librarian |
| `SmallHut` | 3 | 2-5 + villageSize scaling | 4x6x5 | Generic villager |
| `PigHouse` | 15 | 0-2 + villageSize | 9x7x11 | Butcher |
| `DoubleFarmland` | 3 | 1-4 + villageSize | 13x4x9 | No villagers |
| `Farmland` | 3 | 2-4 + villageSize scaling | 7x4x9 | No villagers |
| `Smithy` | 15 | 0-1 + villageSize | 10x6x7 | Blacksmith |
| `TwoRoomHouse` | 8 | 0-3 + villageSize scaling | 9x7x12 | Generic villager |

Max counts are randomized with `Mth::nextInt(random, min, max)` where both min and max scale with `villageSize`. Pieces with a max of 0 get removed from the set.

**Biome-aware blocks:** Village pieces override `biomeBlock()` and `biomeData()` to swap materials based on biome. In desert villages, wooden planks become sandstone, cobblestone becomes sandstone, logs become sandstone, and so on.

**Smithy loot table (13 items):**

| Item | Count | Weight |
|---|---|---|
| Diamond | 1-3 | 3 |
| Iron Ingot | 1-5 | 10 |
| Gold Ingot | 1-3 | 5 |
| Bread | 1-3 | 15 |
| Apple | 1-3 | 15 |
| Iron Pickaxe | 1 | 5 |
| Iron Sword | 1 | 5 |
| Iron Chestplate | 1 | 5 |
| Iron Helmet | 1 | 5 |
| Iron Leggings | 1 | 5 |
| Iron Boots | 1 | 5 |
| Obsidian | 3-7 | 5 |
| Sapling | 3-7 | 5 |

**Villager professions:** Each building type overrides `getVillagerProfession()` to spawn the right villager type. The `SmallTemple` spawns priests, `BookHouse` spawns librarians, `PigHouse` spawns butchers, and `Smithy` spawns blacksmiths. Other buildings spawn generic villagers.

**Depth limit:** 50. Road depth starts at 3.

---

### Desert Temple and Jungle Temple (`RandomScatteredLargeFeature`)

**Placement:** Grid-based, spacing of 32 chunks, minimum separation of 8. Only spawns in desert, desert hills, and jungle biomes. The biome at the chunk center determines which temple type to create.

**Desert Pyramid (`DesertPyramidPiece`):**
- Size: 21x15x21.
- Single-piece structure (no `addChildren`).
- Built from sandstone with smooth sandstone pillars and hieroglyph decorations.
- Orange and blue wool decorations in a diamond pattern on the floor.
- Two towers with sandstone stairs.
- Underground tomb at y=-14 with a stone pressure plate on top of TNT and 4 loot chests in the cardinal directions.
- Ground height is averaged across the bounding box using `updateAverageGroundHeight()`.

**Desert Pyramid loot (6 items):**

| Item | Count | Weight |
|---|---|---|
| Diamond | 1-3 | 3 |
| Iron Ingot | 1-5 | 10 |
| Gold Ingot | 2-7 | 15 |
| Emerald | 1-3 | 2 |
| Bone | 4-6 | 20 |
| Rotten Flesh | 3-7 | 16 |

Plus an enchanted book. Each of the 4 chests gets 2-6 rolls.

**Jungle Temple (`JunglePyramidPiece`):**
- Size: 12x10x15.
- Uses the `MossStoneSelector` for walls (40% cobblestone, 60% mossy cobblestone).
- Multi-story with interior stairs.
- Two tripwire traps with redstone circuits leading to arrow dispensers.
- A main chest behind one of the traps.
- A hidden room accessible via three levers, with sticky pistons and a repeater circuit. Opening it reveals a second chest.

**Jungle Temple loot:** Same table as desert pyramid (6 items, same weights). Dispenser arrows: weight 30, count 2-7.

**`MossStoneSelector`:** The jungle temple's custom `BlockSelector`. On each call, `random->nextFloat() < 0.4f` picks `stoneBrick_Id` (cobblestone), otherwise `mossStone_Id`. This creates the overgrown look.

---

### The `findCollisionPiece` check

Every structure uses `StructurePiece::findCollisionPiece()` before adding a new piece. It loops through all existing pieces and returns the first one whose bounding box overlaps the proposed box. If the result is not NULL, the new piece is rejected. This keeps corridors and rooms from overlapping each other.

### The `edgesLiquid` check

Many pieces call `edgesLiquid()` at the start of `postProcess()`. This checks all 6 faces of the piece's bounding box for any liquid blocks (water or lava). If liquid is found, `postProcess()` returns false, which removes the piece from the structure. This is how mineshafts avoid generating tunnels that open directly into underground lava pools.

### The `isOkBox` helper

Strongholds, villages, and nether fortresses all add a custom `isOkBox()` check (a 4J addition). This takes the proposed bounding box plus the start room, and uses `findCollisionPiece()` plus an optional world-bounds check to decide if the piece can be placed.

### Feature position tracking

4J added `app.AddTerrainFeaturePosition()` calls in every `createStructureStart()` method. This registers the structure's chunk position with the game's terrain feature tracking system, which is used by:
- Eye of Ender (for strongholds, via `getNearestGeneratedFeature()`)
- Debug displays
- Save file metadata

The `getNearestGeneratedFeature()` method on `StructureFeature` searches all cached structures and the `getGuesstimatedFeaturePositions()` fallback to find the closest instance of a structure type to a given world position.

## Key source files

- `Minecraft.World/StructureFeature.h/.cpp` for the base feature class
- `Minecraft.World/StructureStart.h/.cpp` for the structure container
- `Minecraft.World/StructurePiece.h/.cpp` for the piece base class and all placement helpers
- `Minecraft.World/BoundingBox.h` for the spatial bounds used everywhere
- `Minecraft.World/Direction.h` for orientation constants
- `Minecraft.World/WeighedTreasure.h/.cpp` for the loot table system and item rolling
- `Minecraft.World/MineShaftFeature.h/.cpp` and `MineShaftPieces.h/.cpp` for a clean example of a full structure
- `Minecraft.World/MineShaftStart.cpp` for the mineshaft initialization
- `Minecraft.World/NetherBridgeFeature.h/.cpp` and `NetherBridgePieces.h/.cpp` for the weight-based piece system with dual piece lists
- `Minecraft.World/VillageFeature.h/.cpp` and `VillagePieces.h/.cpp` for grid-based placement with biome checks and biome-aware block swapping
- `Minecraft.World/StrongholdFeature.h/.cpp` and `StrongholdPieces.h/.cpp` for biome-seeking placement and the portal room guarantee
- `Minecraft.World/ScatteredFeaturePieces.h/.cpp` for single-piece structures (temples) with traps and loot
- `Minecraft.World/RandomScatteredLargeFeature.h/.cpp` for temple placement and biome-based type selection
- `Minecraft.World/RandomLevelSource.h/.cpp` for where structures get registered
