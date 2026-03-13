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

Mineshafts just use a flat probability check. Simple and effective for structures that should be scattered everywhere underground.

### Fixed position (nether fortress)

The nether fortress picks one random position at world creation time (based on the seed) and always spawns there. On console edition with limited world size, this makes sure there's always at least one:

```cpp
bool NetherBridgeFeature::isFeatureChunk(int x, int z, bool bIsSuperflat) {
    if (!isSpotSelected) {
        random->setSeed(level->getSeed());
        random->nextInt();
        int chunk = random->nextInt(49);  // 7x7 grid
        netherFortressPos = new ChunkPos(chunk % 7, chunk / 7);
        isSpotSelected = true;
    }
    return (x == netherFortressPos->x && z == netherFortressPos->z);
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

## Key source files

- `Minecraft.World/StructureFeature.h/.cpp` for the base feature class
- `Minecraft.World/StructureStart.h/.cpp` for the structure container
- `Minecraft.World/StructurePiece.h/.cpp` for the piece base class and all placement helpers
- `Minecraft.World/BoundingBox.h` for the spatial bounds used everywhere
- `Minecraft.World/Direction.h` for orientation constants
- `Minecraft.World/WeighedTreasure.h` for the loot table system
- `Minecraft.World/MineShaftFeature.h` and `MineShaftPieces.h/.cpp` for a clean example of a full structure
- `Minecraft.World/NetherBridgeFeature.h/.cpp` and `NetherBridgePieces.h` for the weight-based piece system
- `Minecraft.World/VillageFeature.h/.cpp` for grid-based placement with biome checks
- `Minecraft.World/StrongholdFeature.h/.cpp` for biome-seeking placement
- `Minecraft.World/ScatteredFeaturePieces.h/.cpp` for simple single-piece structures (temples)
- `Minecraft.World/RandomLevelSource.h/.cpp` for where structures get registered
