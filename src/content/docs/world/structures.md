---
title: Structures
description: How LCE generates structures like villages, temples, and strongholds.
---

LCE generates several types of structures during world creation: villages, strongholds, mineshafts, nether fortresses, desert pyramids, jungle pyramids, and cave systems. The structure system is built on a shared framework of `StructureFeature`, `StructureStart`, and `StructurePiece` classes, all in `Minecraft.World/`.

## Architecture overview

```
LargeFeature (base for chunk-spanning features)
├── LargeCaveFeature      - Overworld cave carving
├── LargeHellCaveFeature  - Nether cave carving
├── CanyonFeature         - ravine/canyon carving
├── DungeonFeature        - alternate cave/tunnel generation
└── StructureFeature      - base for all placed structures
    ├── VillageFeature
    ├── StrongholdFeature
    ├── MineShaftFeature
    ├── NetherBridgeFeature
    └── RandomScatteredLargeFeature  (desert pyramids, jungle temples)

StructureStart            - holds the list of pieces for one structure instance
StructurePiece            - a single room/corridor/building within a structure
```

### Key source files

| File | Purpose |
|------|---------|
| `LargeFeature.h` | Base class for features spanning multiple chunks |
| `StructureFeature.h` / `.cpp` | Chunk-level placement logic, caching, post-processing |
| `StructureStart.h` / `.cpp` | Container for a structure's piece list and bounding box |
| `StructurePiece.h` / `.cpp` | Base piece class with block placement, chest generation, coordinate transforms |
| `VillageFeature.h` / `VillagePieces.h` | Village generation and all village building types |
| `StrongholdFeature.h` / `StrongholdPieces.h` | Stronghold generation and room types |
| `MineShaftFeature.h` / `MineShaftPieces.h` | Abandoned mineshaft generation |
| `NetherBridgeFeature.h` / `NetherBridgePieces.h` | Nether fortress generation |
| `RandomScatteredLargeFeature.h` / `ScatteredFeaturePieces.h` | Desert pyramids and jungle temples |
| `DungeonFeature.h` / `.cpp` | Cave and tunnel carving |

---

## StructureFeature framework

`StructureFeature` extends `LargeFeature` and provides the shared infrastructure for all placed structures.

### Feature type enum

```cpp
enum EFeatureTypes {
    eFeature_Mineshaft,
    eFeature_NetherBridge,
    eFeature_Temples,
    eFeature_Stronghold,
    eFeature_Village,
};
```

This enum maps to values in the game rules XML and is used by `LevelGenerationOptions::isFeatureChunk()` to force structure placement at specific coordinates.

### Generation pipeline

1. **`addFeature()`**: Called for each chunk within 8 chunks of the chunk being generated. Checks `isFeatureChunk()` and, if true, calls `createStructureStart()` to build the structure. Results are cached in `cachedStructures` (keyed by chunk hash).

2. **`isFeatureChunk()`**: Pure virtual. Each subclass has its own placement algorithm (spacing grids, biome checks, random rolls). Also checks `LevelGenerationOptions` for force-placed structures. Receives a `bIsSuperflat` flag from the level's generator type.

3. **`createStructureStart()`**: Pure virtual. Builds a `StructureStart` containing all the pieces.

4. **`postProcess()`**: Called during chunk population. Goes through all cached structures whose bounding boxes overlap the current chunk and calls `StructureStart::postProcess()` to place blocks.

### StructureStart

`StructureStart` holds a `list<StructurePiece *>` and a `BoundingBox`. Key methods:

- `postProcess()`: hands off to each piece's `postProcess()` within the chunk bounding box
- `calculateBoundingBox()`: computes the union of all piece bounding boxes
- `moveBelowSeaLevel()`: shifts the whole structure downward (used by strongholds)
- `moveInsideHeights()`: keeps the Y position within a range (used by nether fortresses, range 48-70)

### StructurePiece

`StructurePiece` is the base class for individual rooms, corridors, and buildings. Here is the full breakdown of what it handles.

#### Orientation and coordinate translation

Each piece has an `orientation` field (from the `Direction` system) and a `BoundingBox` in world coordinates. The piece converts local coordinates (x, y, z) to world coordinates based on the orientation:

- **UNDEFINED**: No translation at all
- **NORTH**: `(0, 0, 0)` maps to `(boundingBox.x0, boundingBox.y0, boundingBox.z1)`, so Z runs backward
- **SOUTH**: Same X, but Z is flipped the other way
- **EAST/WEST**: Local X and Z swap, so corridors can face different directions without duplicate code

The comment in the source is worth noting: "When-ever a structure piece is placing blocks, it is VERY IMPORTANT to always make sure that all getTile and setTile calls are within the chunk's bounding box. Failing to check this will cause the level generator to create new chunks, leading to infinite loops."

#### Coordinate helper methods

| Method | What it does |
|--------|-------------|
| `getWorldX(x, z)` | Converts local X/Z to world X, accounting for orientation |
| `getWorldY(y)` | Converts local Y to world Y (adds `boundingBox.y0`) |
| `getWorldZ(x, z)` | Converts local X/Z to world Z, accounting for orientation |
| `getOrientationData(tile, data)` | Rotates block metadata (like stair facing) to match piece orientation |

4J made these public (they are protected in Java) so that game rules can access them.

#### Block placement methods

| Method | What it does |
|--------|-------------|
| `placeBlock(level, block, data, x, y, z, chunkBB)` | Places a single block, clipped to chunk bounds |
| `getBlock(level, x, y, z, chunkBB)` | Gets a block safely (returns 0 if out of bounds to prevent chunk generation) |
| `generateBox(...)` | Fills a box with edge/fill tiles. Has 6 overloads for different use cases |
| `generateAirBox(...)` | Fills a box with air |
| `generateMaybeBox(...)` | Fills a box with a random probability per block |
| `maybeGenerateBlock(...)` | Places a single block with a random probability |
| `generateUpperHalfSphere(...)` | Carves or fills a half-sphere shape (used in rooms) |
| `generateAirColumnUp(...)` | Clears a column of blocks upward |
| `fillColumnDown(...)` | Fills a column downward until hitting a solid block |

The `generateBox()` method alone has 6 overloads:

1. Basic edge/fill tiles (no data values)
2. Edge/fill tiles with explicit data values
3. Box-to-box version (takes a `BoundingBox` instead of coordinates)
4. BlockSelector version (per-block randomization)
5. BlockSelector with BoundingBox input
6. Random probability version (`generateMaybeBox`)

#### Chest and dispenser generation

| Method | What it does |
|--------|-------------|
| `createChest(level, chunkBB, random, x, y, z, treasure, numRolls)` | Places a chest with weighted random loot |
| `createDispenser(level, chunkBB, random, x, y, z, facing, items, numRolls)` | Places a dispenser with items and a facing direction |
| `createDoor(level, chunkBB, random, x, y, z, orientation)` | Places a door with the right orientation |

#### Collision detection

`findCollisionPiece()` is a static method that checks if a new piece's bounding box overlaps any existing pieces in the list. This prevents rooms from clipping into each other.

#### BlockSelector inner class

`BlockSelector` is an inner class that lets you randomize blocks during box generation. It has three virtual methods:

- `next(random, worldX, worldY, worldZ, isEdge)`: Called per block, sets `nextId` and `nextData`
- `getNextId()`: Returns the block ID to use
- `getNextData()`: Returns the data value to use

Strongholds use `SmoothStoneSelector` to mix stone brick variants. Jungle temples use `MossStoneSelector` for mossy/cracked stone. Both are good examples of this pattern.

#### Other fields

- `genDepth`: Tracks recursion depth during piece generation. Each structure type defines a MAX_DEPTH constant
- `edgesLiquid()`: Checks if any edge of the bounding box touches liquid (used to avoid awkward placements)
- `isInChunk()`: Checks if the piece overlaps a given chunk position
- `getLocatorPosition()`: Returns the "center" position of the piece (used for map features)

---

## Villages

**Source**: `VillageFeature.h`, `VillageFeature.cpp`, `VillagePieces.h`, `VillagePieces.cpp`

### Placement

Villages spawn in **Plains** and **Desert** biomes. The placement algorithm uses a grid with:

- **Town spacing**: 16 chunks (32 on large worlds or superflat)
- **Minimum separation**: 8 chunks
- **Seed salt**: `10387312`

The algorithm divides the world into grid cells, picks a random position within each cell, then checks `BiomeSource::containsOnly()` to make sure the biome works.

A bounds check makes sure villages don't extend past the world edge. If any part of the bounding box falls outside `[-XZSize/2, XZSize/2]`, the village is marked invalid.

### Village generation

`VillageStart` creates a `StartPiece` (which extends `Well`) and recursively generates pieces. Roads get prioritized over houses during generation. A village only counts as valid if it has more than 2 non-road pieces.

The `StartPiece` tracks:

- `isDesertVillage`: whether to use sandstone materials
- `villageSize`: controls piece set generation
- `pieceSet`: weighted list of building types (a `list<PieceWeight *>`)
- `pendingHouses` / `pendingRoads`: queues processed in random order
- `biomeSource`: for biome lookups during generation
- `isLibraryAdded`: prevents duplicate libraries
- `previousPiece`: tracks the last piece weight used
- `m_level`: 4J addition, pointer to the Level

### Village size constants

Villages have three size categories defined in `VillagePieces`:

| Constant | Value | Usage |
|----------|-------|-------|
| `SIZE_SMALL` | 0 | Small village variant |
| `SIZE_BIG` | 1 | Medium village variant |
| `SIZE_BIGGEST` | 2 | Large village variant |

### Village piece weight system

The `PieceWeight` class controls which buildings appear and how often:

- `pieceClass`: An `EPieceClass` enum value (4J replaced Java's `Class<?>` reflection)
- `weight`: How likely this piece is to be selected
- `placeCount`: How many times this piece has been placed so far
- `maxPlaceCount`: Maximum number of this piece type allowed (0 means unlimited)
- `doPlace(depth)`: Returns true if this piece can still be placed
- `isValid()`: Returns true if `maxPlaceCount` hasn't been reached

`createPieceSet()` builds the weighted list based on `villageSize`. `updatePieceWeight()` recalculates total weight after each placement.

### Village piece hierarchy

All village pieces extend `VillagePiece`, which extends `StructurePiece`. `VillagePiece` adds:

- `spawnedVillagerCount`: tracks how many villagers this piece has spawned
- `startPiece`: pointer back to the `StartPiece` for accessing shared state
- `getAverageGroundHeight()`: samples terrain to set the building's Y level
- `spawnVillagers()`: places villager entities inside the building
- `getVillagerProfession()`: virtual method for piece-specific professions
- `biomeBlock()` / `biomeData()`: virtual methods that swap materials for desert villages (cobblestone becomes sandstone, wood becomes smooth sandstone, etc.)
- Overrides of `placeBlock()`, `generateBox()`, and `fillColumnDown()` to route through `biomeBlock()`/`biomeData()`
- `isOkBox()`: 4J added a `startRoom` parameter to check bounds against the world edge

Road pieces extend `VillageRoadPiece`, which is a simple passthrough subclass of `VillagePiece`.

### Village piece types

| Piece Class | Enum | Dimensions (WxHxD) | Description |
|-------------|------|---------------------|-------------|
| `Well` | -- | 6x15x6 | Central well, always the start piece |
| `SimpleHouse` | `EPieceClass_SimpleHouse` | 5x6x5 | Basic one-room house with optional terrace (`hasTerrace` flag) |
| `SmallTemple` | `EPieceClass_SmallTemple` | 5x12x9 | Village church. Overrides `getVillagerProfession()` for priest |
| `BookHouse` | `EPieceClass_BookHouse` | 9x9x6 | Library building. Overrides `getVillagerProfession()` for librarian |
| `SmallHut` | `EPieceClass_SmallHut` | 4x6x5 | Tiny house with `lowCeiling` and `tablePlacement` random flags |
| `PigHouse` | `EPieceClass_PigHouse` | 9x7x11 | Butcher shop. Overrides `getVillagerProfession()` for butcher |
| `Smithy` | `EPieceClass_Smithy` | 10x6x7 | Blacksmith with loot chest. Has `staticCtor()` for treasure items |
| `Farmland` | `EPieceClass_Farmland` | 7x4x9 | Small farm with 2 crop types (`cropsA`, `cropsB` from `selectCrops()`) |
| `DoubleFarmland` | `EPieceClass_DoubleFarmland` | 13x4x9 | Large farm with 4 crop types (`cropsA` through `cropsD`) |
| `TwoRoomHouse` | `EPieceClass_TwoRoomHouse` | 9x7x12 | Two-room dwelling |
| `StraightRoad` | -- | 3xNx-- | Variable-length road segment |
| `LightPost` | -- | 3x4x2 | Torch lamp post |

### Piece generation flow

Pieces connect through doorways. The generation functions follow this pattern:

1. `generateAndAddPiece()` / `generateAndAddRoadPiece()`: Top-level functions that pick a direction and depth
2. `generatePieceFromSmallDoor()`: Picks a weighted random piece from the piece set
3. `findAndCreatePieceFactory()`: Creates the actual piece instance from the `EPieceClass` enum
4. Each piece's static `createPiece()` / `findPieceBox()`: Checks if the bounding box fits without collisions

Roads and houses use separate generation queues (`pendingRoads` and `pendingHouses`). Roads are processed first, then houses fill in the gaps.

### Village loot

The **Smithy** has a chest with weighted treasure items (defined in `Smithy::treasureItems`, initialized in `Smithy::staticCtor()`). Desert villages swap cobblestone/wood for sandstone variants through `biomeBlock()` and `biomeData()` overrides.

### Village constants

- `MAX_DEPTH = 50`: maximum piece generation recursion
- `BASE_ROAD_DEPTH = 3`: starting depth for road generation
- `LOWEST_Y_POSITION = 10`: minimum Y for village placement

---

## Strongholds

**Source**: `StrongholdFeature.h`, `StrongholdFeature.cpp`, `StrongholdPieces.h`, `StrongholdPieces.cpp`

### Placement

Only **1 stronghold** is generated per world on console (`strongholdPos_length = 1`), compared to 3 in Java Edition. Allowed biomes:

> Desert, Forest, Extreme Hills, Swampland, Taiga, Ice Plains, Ice Mountains, Desert Hills, Forest Hills, Extreme Hills Edge, Taiga Hills, Jungle, Jungle Hills

The placement algorithm:

1. Picks a random angle
2. Calculates a distance from origin based on world size:
   - **Small worlds** (pre-TU9): `(1.25 + random) * (5.0 + random(7))` chunks
   - **Small worlds** (post-TU9): `(1.25 + random) * (3 + random(4))` chunks (moved inward to prevent edge clipping)
   - **Large worlds < 2.25x32 chunks**: Same as post-TU9 small world formula
   - **Large worlds >= 2.25x32 chunks**: Original Java formula `(1.25 + random) * 32.0` chunks
3. Uses `BiomeSource::findBiome()` to locate a valid biome near the calculated position
4. Retries up to `MAX_STRONGHOLD_ATTEMPTS` (10 on small worlds, 30 on large worlds) if no valid biome is found

The `createStructureStart()` method keeps regenerating the stronghold until the portal room is successfully placed.

### Stronghold generation

`StrongholdStart` creates a `StartPiece` (which extends `StairsDown`) and recursively generates rooms from a `pendingChildren` queue. After generation, the whole structure is moved below sea level (offset 10).

The `StartPiece` tracks:

- `isLibraryAdded`: prevents duplicate libraries
- `previousPiece`: the last `PieceWeight` used
- `portalRoomPiece`: pointer to the portal room (checked to confirm it was placed)
- `pendingChildren`: queue of pieces waiting to add their children
- `m_level`: 4J addition

### Stronghold piece weight system

The stronghold uses a weight system similar to villages but with depth-gated pieces:

- `PieceWeight`: Base class with `pieceClass`, `weight`, `placeCount`, `maxPlaceCount`
- `PieceWeight_Library`: Subclass that overrides `doPlace()` to require `depth > 4`
- `PieceWeight_PortalRoom`: Subclass that overrides `doPlace()` to require `depth > 5`

The `imposedPiece` static field can force a specific piece type to be placed next. `totalWeight` tracks the sum of all available piece weights and `currentPieces` holds the active weight list. `resetPieces()` reinitializes everything for a new stronghold.

### Stronghold piece hierarchy

All stronghold pieces extend `StrongholdPiece`, which extends `StructurePiece`. `StrongholdPiece` adds:

- `SmallDoorType` enum: `OPENING`, `WOOD_DOOR`, `GRATES`, `IRON_DOOR`
- `generateSmallDoor()`: Places a door of the given type at a position
- `randomSmallDoor()`: Picks a random door type
- `generateSmallDoorChildForward/Left/Right()`: Creates child pieces off each exit

Pieces connect through these "small door" exits. Each piece stores its own `entryDoor` type, randomly picked at creation time.

### Stronghold piece types

| Piece Class | Enum | Dimensions (WxHxD) | Description |
|-------------|------|---------------------|-------------|
| `StairsDown` | `EPieceClass_StairsDown` | 5x11x5 | Spiral staircase (also the start piece). Has `isSource` flag for the first instance |
| `Straight` | `EPieceClass_Straight` | 5x5x7 | Corridor with optional `leftChild` and `rightChild` branches |
| `LeftTurn` | `EPieceClass_LeftTurn` | 5x5x5 | Left-turning corridor |
| `RightTurn` | `EPieceClass_RightTurn` | 5x5x5 | Right-turning corridor (extends `LeftTurn`, overrides `addChildren` and `postProcess`) |
| `PrisonHall` | `EPieceClass_PrisonHall` | 9x5x11 | Prison cells corridor |
| `RoomCrossing` | `EPieceClass_RoomCrossing` | 11x7x11 | Large room with random interior `type` (fountain, pillar, etc.) |
| `StraightStairsDown` | `EPieceClass_StraightStairsDown` | 5x11x8 | Straight descending staircase |
| `FiveCrossing` | `EPieceClass_FiveCrossing` | 10x9x11 | Five-way intersection with `leftLow`, `leftHigh`, `rightLow`, `rightHigh` exit flags |
| `ChestCorridor` | `EPieceClass_ChestCorridor` | 5x5x7 | Corridor with loot chest. 14 weighted treasure item types |
| `Library` | `EPieceClass_Library` | 14x6(or 11)x15 | Library with `isTall` flag for double-height variant (`tallHeight = 11`). 4 library-specific treasure items |
| `PortalRoom` | `EPieceClass_PortalRoom` | 11x8x16 | End portal room with silverfish spawner (`hasPlacedMobSpawner` flag) |
| `FillerCorridor` | -- | variable | Connects unfinished ends. Takes a `steps` count for length |

### Stronghold piece weight rules

- **Library**: Only placed when `depth > 4` (via `PieceWeight_Library` subclass)
- **PortalRoom**: Only placed when `depth > 5` (via `PieceWeight_PortalRoom` subclass)
- Door types: `OPENING`, `WOOD_DOOR`, `GRATES`, `IRON_DOOR` (randomly picked per piece)

### Stronghold loot

- `ChestCorridor`: 14 weighted treasure item types (`TREASURE_ITEMS_COUNT = 14`)
- `RoomCrossing`: 7 small treasure item types (`SMALL_TREASURE_ITEMS_COUNT = 7`, 4J addition)
- `Library`: 4 library-specific treasure item types (`LIBRARY_TREASURE_ITEMS_COUNT = 4`, 4J addition)

### Block selector

`SmoothStoneSelector` randomizes between stone brick variants (normal, mossy, cracked) for stronghold walls. It is a static const instance shared across all stronghold pieces.

### Stronghold constants

- `MAX_DEPTH = 50`
- `LOWEST_Y_POSITION = 10`
- `SMALL_DOOR_WIDTH = 3`, `SMALL_DOOR_HEIGHT = 3`
- `CHECK_AIR`: Static bool used during generation

---

## Mineshafts

**Source**: `MineShaftFeature.h`, `MineShaftFeature.cpp`, `MineShaftPieces.h`, `MineShaftPieces.cpp`, `MineShaftStart.h`

### Placement

Mineshafts use a probability check instead of a grid:

```
random.nextInt(100) == 0 && random.nextInt(80) < max(abs(chunkX), abs(chunkZ))
```

This means mineshafts become more common the further you get from the world origin. Force placement through `LevelGenerationOptions` is also supported.

### Mineshaft generation

`MineShaftStart` creates a `MineShaftRoom` as the starting piece and recursively generates corridors, crossings, and stairs.

The piece selection is handled by `createRandomShaftPiece()`, which picks between corridors, crossings, and stairs based on random rolls. `generateAndAddPiece()` creates child pieces from existing ones.

### Mineshaft piece types

| Piece Class | Description |
|-------------|-------------|
| `MineShaftRoom` | Large open room that serves as the hub. Maintains a `childEntranceBoxes` list tracking where corridors connect |
| `MineShaftCorridor` | Standard corridor with optional rails and spider webs. Tracks `hasRails`, `spiderCorridor`, `hasPlacedSpider`, and `numSections` |
| `MineShaftCrossing` | Intersection point with a `direction` field and optional `isTwoFloored` flag for double-height crossings |
| `MineShaftStairs` | Descending/ascending staircase connecting different levels |

### Mineshaft constants

- `DEFAULT_SHAFT_WIDTH = 3`, `DEFAULT_SHAFT_HEIGHT = 3`, `DEFAULT_SHAFT_LENGTH = 5`
- `MAX_DEPTH = 8` (changed in 1.2.3)
- Loot defined in `MineShaftPieces::smallTreasureItems` (initialized in `MineShaftPieces::staticCtor()`)

### Spider corridors

`MineShaftCorridor` has `hasRails` and `spiderCorridor` flags. Spider corridors have cave spider spawners (`hasPlacedSpider` prevents double-placement) and cobweb blocks. Regular corridors can have minecart rails.

Each corridor has a `numSections` field controlling its length. The static `findCorridorSize()` method checks if a corridor of the desired length fits without hitting another piece.

---

## Nether Fortress

**Source**: `NetherBridgeFeature.h`, `NetherBridgeFeature.cpp`, `NetherBridgePieces.h`

### Placement

The nether fortress has a unique placement strategy on console:

1. **Forced fortress**: One fortress is always placed using the world seed. A random chunk in a 7x7 area `[(0,0) to (6,6)]` is picked.
2. **Large worlds only**: Extra fortresses can generate using the Java-style algorithm: divide the nether into 16x16 chunk regions, 2/3 chance to skip, then random offset within the region.

Force placement through game rules is also supported.

### Fortress generation

`NetherBridgeStart` creates a `StartPiece` (which extends `BridgeCrossing`) and recursively generates pieces. After generation, the structure is kept within Y range 48-70 through `moveInsideHeights()`.

The `StartPiece` tracks:

- `isLibraryAdded`: reused field name from the stronghold pattern
- `previousPiece`: the last `PieceWeight` used
- `availableBridgePieces`: list of available bridge piece weights
- `availableCastlePieces`: list of available castle piece weights
- `pendingChildren`: queue of pieces waiting to add their children
- `m_level`: 4J addition

### Fortress piece hierarchy

All fortress pieces extend `NetherBridgePiece`, which extends `StructurePiece`. `NetherBridgePiece` adds:

- `updatePieceWeight()`: Recalculates total weight for the available piece list
- `generatePiece()`: Picks a weighted random piece from bridge or castle lists
- `generateAndAddPiece()`: Creates a child piece with an `isCastle` flag that determines which piece list to use
- `generateChildForward/Left/Right()`: Creates child pieces off each exit, with the `isCastle` flag passed through
- `generateLightPost()` / `generateLightPostFacing*()`: Places the soul sand + nether brick fence light posts that decorate fortress corridors
- `isOkBox()`: 4J added `startRoom` parameter for world edge checking

### Two piece categories

The fortress has two separate piece categories, each with their own weight array:

**Bridge pieces** (`BRIDGE_PIECEWEIGHTS_COUNT = 6`):

| Piece Class | Enum | Dimensions (WxHxD) | Description |
|-------------|------|---------------------|-------------|
| `BridgeStraight` | `EPieceClass_BridgeStraight` | 5x10x19 | Straight bridge segment |
| `BridgeEndFiller` | `EPieceClass_BridgeEndFiller` | 5x10x8 | Bridge dead-end cap. Has a `selfSeed` for deterministic generation |
| `BridgeCrossing` | `EPieceClass_BridgeCrossing` | 19x10x19 | Large bridge intersection (also the start piece) |
| `RoomCrossing` | `EPieceClass_RoomCrossing` | 7x9x7 | Small room at bridge junctions |
| `StairsRoom` | `EPieceClass_StairsRoom` | 7x11x7 | Room with staircase |
| `MonsterThrone` | `EPieceClass_MonsterThrone` | 7x8x9 | Blaze spawner room (`hasPlacedMobSpawner` flag) |

**Castle pieces** (`CASTLE_PIECEWEIGHTS_COUNT = 7`):

| Piece Class | Enum | Dimensions (WxHxD) | Description |
|-------------|------|---------------------|-------------|
| `CastleEntrance` | `EPieceClass_CastleEntrance` | 13x14x13 | Grand entrance hall |
| `CastleStalkRoom` | `EPieceClass_CastleStalkRoom` | 13x14x13 | Nether wart farm room |
| `CastleSmallCorridorPiece` | `EPieceClass_CastleSmallCorridorPiece` | 5x7x5 | Narrow corridor |
| `CastleSmallCorridorCrossingPiece` | `EPieceClass_CastleSmallCorridorCrossingPiece` | 5x7x5 | Small corridor intersection |
| `CastleSmallCorridorRightTurnPiece` | `EPieceClass_CastleSmallCorridorRightTurnPiece` | 5x7x5 | Right turn corridor |
| `CastleSmallCorridorLeftTurnPiece` | `EPieceClass_CastleSmallCorridorLeftTurnPiece` | 5x7x5 | Left turn corridor |
| `CastleCorridorStairsPiece` | `EPieceClass_CastleCorridorStairsPiece` | 5x14x10 | Corridor with stairs |

Note: `CastleCorridorTBalconyPiece` (9x7x9, T-shaped balcony corridor) also exists in the enum (`EPieceClass_CastleCorridorTBalconyPiece`) but is not counted in the castle weights array. It still generates as a special case.

### Fortress mob spawns

The fortress defines its own enemy spawn list, separate from the Hell biome:

| Mob | Weight | Min | Max |
|-----|--------|-----|-----|
| Blaze | 10 | 2 | 3 |
| Zombie Pigman | 10 | 4 | 4 |
| Magma Cube | 3 | 4 | 4 |

These come from `getBridgeEnemies()` and are used for spawning within fortress bounds.

### PieceWeight system

The fortress `PieceWeight` has an extra `allowInRow` flag not present in village or stronghold weights:

```cpp
PieceWeight(EPieceClass pieceClass, int weight, int maxPlaceCount, bool allowInRow);
PieceWeight(EPieceClass pieceClass, int weight, int maxPlaceCount);
```

When `allowInRow` is false, the same piece type can't be placed twice in a row. This prevents repetitive fortress layouts.

### Fortress constants

- `MAX_DEPTH = 30`
- `LOWEST_Y_POSITION = 10`
- Pieces use `PieceWeight` with an `allowInRow` flag controlling consecutive placement

---

## Desert Pyramids and Jungle Temples

**Source**: `RandomScatteredLargeFeature.h`, `RandomScatteredLargeFeature.cpp`, `ScatteredFeaturePieces.h`

### Placement

Both structure types are managed by `RandomScatteredLargeFeature`, which uses:

- **Feature spacing**: 32 chunks
- **Minimum separation**: 8 chunks
- **Seed salt**: `14357617`
- **Allowed biomes**: Desert, Desert Hills, Jungle

Which structure you get depends on the biome at the chunk center:

- **Jungle biome** -> `JunglePyramidPiece`
- **Otherwise** (desert/desert hills) -> `DesertPyramidPiece`

### ScatteredFeaturePiece base

Both pyramid types inherit from `ScatteredFeaturePiece`, which extends `StructurePiece` and provides:

- `width`, `height`, `depth` dimension fields
- `heightPosition` for vertical placement
- `updateAverageGroundHeight(level, chunkBB, offset)` to sample terrain and set the Y level

The constructor takes the full set of dimensions:

```cpp
ScatteredFeaturePiece(Random *random, int west, int floor, int north, int width, int height, int depth);
```

### Desert Pyramid

`DesertPyramidPiece` extends `ScatteredFeaturePiece`. It has:

- 4 loot chests (tracked by `hasPlacedChest[4]`)
- 6 weighted treasure item types (`TREASURE_ITEMS_COUNT = 6`)
- TNT trap below the treasure room

### Jungle Temple

`JunglePyramidPiece` extends `ScatteredFeaturePiece`. It has:

- Main chest and hidden chest (tracked by `placedMainChest`, `placedHiddenChest`)
- 2 arrow dispenser traps (`placedTrap1`, `placedTrap2`)
- 6 weighted treasure item types (`TREASURE_ITEMS_COUNT = 6`)
- 1 dispenser item type (`DISPENSER_ITEMS_COUNT = 1`, arrows)
- `MossStoneSelector` inner class for randomized mossy/cracked stone brick walls (uses the `BlockSelector` pattern)
- `stoneSelector` static instance of `MossStoneSelector`

---

## Caves (LargeCaveFeature / DungeonFeature)

**Source**: `LargeCaveFeature.h`, `LargeCaveFeature.cpp`, `DungeonFeature.h`, `DungeonFeature.cpp`

`LargeCaveFeature` extends `LargeFeature` and is the main Overworld cave carver, used as `caveFeature` in `RandomLevelSource`. `DungeonFeature` is a related `LargeFeature` subclass with a similar room-and-tunnel algorithm. Both carve through the block array during chunk generation (before structures get placed).

### Cave generation algorithm

1. **`addFeature()`**: For each chunk, rolls a triple-nested random to figure out cave count: `random(random(random(40) + 1) + 1)`, with a 14/15 chance of zero caves.
2. For each cave, picks a random position and generates:
   - Optionally a room (`addRoom()`) with a 1/4 chance, which creates a large spheroid
   - 1 + random(4) tunnels coming from the room center
3. **`addTunnel()`**: Carves a winding path through blocks using:
   - Sinusoidal thickness variation
   - Random rotation changes for organic shapes
   - Y-scale parameter for room vs tunnel proportions
   - Tunnel splitting at a random midpoint (creates branching caves)
   - Water detection to avoid carving into water bodies
   - Below Y=10, carved space is filled with lava instead of air

### Cave constraints

- Caves won't carve through water or calm water blocks
- Maximum generation distance: `radius * 16 - 16` blocks
- Only carves through stone, dirt, and grass blocks
- Grass blocks below carved space are restored when dirt gets exposed

---

## Console-specific modifications

Several 4J Studios changes affect structure generation:

### World boundary checks

- **Villages**: Bounding box checked against `[-XZSize/2, XZSize/2]`; invalid if extending past the edge. The `isOkBox()` method on `VillagePiece` takes a `startRoom` parameter (4J addition) for this check
- **Strongholds**: Distance formula adjusted to keep structures within console world limits
- **Nether fortress**: Forced placement in a small 7x7 chunk area to fit the limited nether size

### Structure counts

- **Strongholds**: 1 per world (vs 3 in Java Edition), with retry logic (up to 10 or 30 attempts)
- **Villages**: Town spacing reduced from 32 to 16 chunks on non-superflat small worlds

### Force placement

All structure types support forced placement through `LevelGenerationOptions::isFeatureChunk()`, which reads from game rules XML. This lets the game rules system (through `ConsoleGenerateStructure` and `XboxStructureAction*` classes in `Minecraft.Client/Common/GameRules/`) place structures at specific coordinates.

### Feature position tracking

Each structure type calls `app.AddTerrainFeaturePosition()` when created, registering positions as `eTerrainFeature_Village`, `eTerrainFeature_Stronghold`, `eTerrainFeature_Mineshaft`, etc. This is used for the in-game map and Eye of Ender functionality.

### Level pointer addition

Every `StartPiece` class (village, stronghold, fortress) has an `m_level` field that 4J added. In Java, the level was accessed through other means, but the console version passes it directly to the start piece constructor.

### isOkBox world edge checks

4J added a `startRoom` parameter to `isOkBox()` in `VillagePiece`, `StrongholdPiece`, and `NetherBridgePiece`. This lets pieces check their bounding box against the world boundaries during generation, preventing structures from extending past the world edge.

## MinecraftConsoles Differences

The structure system in MC is mostly the same as LCEMP, but with a few additions:

### Witch huts

MC adds a third scattered feature type: `SwamplandHut`. In LCEMP, `RandomScatteredLargeFeature` only generates desert pyramids and jungle temples. MC adds swampland to the allowed biomes and generates witch huts in swamp biomes.

The witch hut has its own enemy spawn list (`swamphutEnemies`) that just contains Witch (weight 1, groups of 1). MC also adds `isSwamphut()` and `getSwamphutEnemies()` methods to `RandomScatteredLargeFeature` so the spawning system can check if a position is inside a witch hut and use the special spawn list.

### Structure persistence

MC adds two new classes for saving structure data:

- **`StructureFeatureIO`**: Handles reading and writing structure bounding boxes and piece data to/from NBT tags. This lets the game remember where structures are between saves.
- **`StructureFeatureSavedData`**: Extends the saved data system to persist structure locations. This is important for things like witch hut mob spawning, where the game needs to know structure boundaries even after the world has been saved and reloaded.

LCEMP doesn't persist structure data at all. Once a structure is generated during world creation, its bounding box info only lives in memory until the game closes.

### Everything else

Villages, strongholds, mineshafts, nether fortresses, desert pyramids, and jungle temples are the same in both codebases. Same piece types, same placement algorithms, same loot tables.
