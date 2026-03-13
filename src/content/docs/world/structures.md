---
title: Structures
description: How LCEMP generates structures like villages, temples, and strongholds.
---

LCEMP generates several types of structures during world creation: villages, strongholds, mineshafts, nether fortresses, desert pyramids, jungle pyramids, and cave systems. The structure system is built on a shared framework of `StructureFeature`, `StructureStart`, and `StructurePiece` classes, all located in `Minecraft.World/`.

## Architecture overview

```
LargeFeature (base for chunk-spanning features)
├── LargeCaveFeature      – Overworld cave carving
├── LargeHellCaveFeature  – Nether cave carving
├── CanyonFeature         – ravine/canyon carving
├── DungeonFeature        – alternate cave/tunnel generation
└── StructureFeature      – base for all placed structures
    ├── VillageFeature
    ├── StrongholdFeature
    ├── MineShaftFeature
    ├── NetherBridgeFeature
    └── RandomScatteredLargeFeature  (desert pyramids, jungle temples)

StructureStart            – holds the list of pieces for one structure instance
StructurePiece            – a single room/corridor/building within a structure
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

2. **`isFeatureChunk()`**: Pure virtual. Each subclass implements its own placement algorithm (spacing grids, biome checks, random rolls). Also checks `LevelGenerationOptions` for force-placed structures. Receives a `bIsSuperflat` flag derived from the level's generator type.

3. **`createStructureStart()`**: Pure virtual. Constructs a `StructureStart` containing all the pieces.

4. **`postProcess()`**: Called during chunk population. Iterates all cached structures whose bounding boxes overlap the current chunk and calls `StructureStart::postProcess()` to place blocks.

### StructureStart

`StructureStart` holds a `list<StructurePiece *>` and a `BoundingBox`. Key methods:

- `postProcess()` -- delegates to each piece's `postProcess()` within the chunk bounding box
- `calculateBoundingBox()` -- computes the union of all piece bounding boxes
- `moveBelowSeaLevel()` -- shifts the entire structure downward (used by strongholds)
- `moveInsideHeights()` -- constrains Y position to a range (used by nether fortresses, range 48-70)

### StructurePiece

`StructurePiece` is the base class for individual rooms, corridors, and buildings. It manages:

- **Orientation**: Translates local coordinates (x, y, z) to world coordinates based on a `Direction`-style `orientation` field
- **Block placement**: `placeBlock()`, `generateBox()`, `generateAirBox()`, `fillColumnDown()`, and `generateUpperHalfSphere()` all clip to the chunk bounding box to prevent infinite chunk generation loops
- **Chest generation**: `createChest()` places a chest with weighted random loot
- **Dispenser generation**: `createDispenser()` places a dispenser with items
- **Collision detection**: `findCollisionPiece()` checks if a new piece's bounding box overlaps existing pieces
- **`BlockSelector`**: An inner class that allows per-block randomization (e.g., mossy stone bricks in strongholds)

The `genDepth` field tracks recursion depth during piece generation, with each structure type defining a `MAX_DEPTH` constant.

---

## Villages

**Source**: `VillageFeature.h`, `VillageFeature.cpp`, `VillagePieces.h`, `VillagePieces.cpp`

### Placement

Villages spawn in **Plains** and **Desert** biomes. The placement algorithm uses a grid with:

- **Town spacing**: 16 chunks (32 on large worlds or superflat)
- **Minimum separation**: 8 chunks
- **Seed salt**: `10387312`

The algorithm divides the world into grid cells, picks a random position within each cell, then checks `BiomeSource::containsOnly()` to verify the biome is suitable.

A bounds check ensures villages do not extend past the world edge -- if any part of the bounding box falls outside `[-XZSize/2, XZSize/2]`, the village is marked invalid.

### Village generation

`VillageStart` creates a `StartPiece` (which extends `Well`) and recursively generates pieces. Roads are prioritized over houses during generation. A village is valid only if it contains more than 2 non-road pieces.

The `StartPiece` tracks:

- `isDesertVillage` -- whether to use sandstone materials
- `villageSize` -- controls piece set generation
- `pieceSet` -- weighted list of building types
- `pendingHouses` / `pendingRoads` -- queues processed in random order

### Village piece types

| Piece Class | Enum | Dimensions (WxHxD) | Description |
|-------------|------|---------------------|-------------|
| `Well` | -- | 6x15x6 | Central well, always the start piece |
| `SimpleHouse` | `EPieceClass_SimpleHouse` | 5x6x5 | Basic one-room house with optional terrace |
| `SmallTemple` | `EPieceClass_SmallTemple` | 5x12x9 | Village church |
| `BookHouse` | `EPieceClass_BookHouse` | 9x9x6 | Library building |
| `SmallHut` | `EPieceClass_SmallHut` | 4x6x5 | Tiny house with optional low ceiling |
| `PigHouse` | `EPieceClass_PigHouse` | 9x7x11 | Butcher shop |
| `Smithy` | `EPieceClass_Smithy` | 10x6x7 | Blacksmith with loot chest |
| `Farmland` | `EPieceClass_Farmland` | 7x4x9 | Small farm with 2 crop types |
| `DoubleFarmland` | `EPieceClass_DoubleFarmland` | 13x4x9 | Large farm with 4 crop types |
| `TwoRoomHouse` | `EPieceClass_TwoRoomHouse` | 9x7x12 | Two-room dwelling |
| `StraightRoad` | -- | 3xNx-- | Variable-length road segment |
| `LightPost` | -- | 3x4x2 | Torch lamp post |

### Village loot

The **Smithy** contains a chest with weighted treasure items (defined in `Smithy::treasureItems`). Desert villages replace cobblestone/wood with sandstone variants via `biomeBlock()` and `biomeData()` overrides.

### Village constants

- `MAX_DEPTH = 50` -- maximum piece generation recursion
- `BASE_ROAD_DEPTH = 3` -- starting depth for road generation
- `LOWEST_Y_POSITION = 10` -- minimum Y for village placement

---

## Strongholds

**Source**: `StrongholdFeature.h`, `StrongholdFeature.cpp`, `StrongholdPieces.h`, `StrongholdPieces.cpp`

### Placement

Only **1 stronghold** is generated per world on console (`strongholdPos_length = 1`), compared to 3 in Java Edition. Allowed biomes for placement:

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

The `createStructureStart()` method regenerates the stronghold until the portal room is successfully placed.

### Stronghold generation

`StrongholdStart` creates a `StartPiece` (which extends `StairsDown`) and recursively generates rooms from a `pendingChildren` queue. After generation, the entire structure is moved below sea level (offset 10).

### Stronghold piece types

| Piece Class | Enum | Dimensions (WxHxD) | Description |
|-------------|------|---------------------|-------------|
| `StairsDown` | `EPieceClass_StairsDown` | 5x11x5 | Spiral staircase (also the start piece) |
| `Straight` | `EPieceClass_Straight` | 5x5x7 | Corridor with optional side branches |
| `LeftTurn` | `EPieceClass_LeftTurn` | 5x5x5 | Left-turning corridor |
| `RightTurn` | `EPieceClass_RightTurn` | 5x5x5 | Right-turning corridor (extends LeftTurn) |
| `PrisonHall` | `EPieceClass_PrisonHall` | 9x5x11 | Prison cells corridor |
| `RoomCrossing` | `EPieceClass_RoomCrossing` | 11x7x11 | Large room with random interior type |
| `StraightStairsDown` | `EPieceClass_StraightStairsDown` | 5x11x8 | Straight descending staircase |
| `FiveCrossing` | `EPieceClass_FiveCrossing` | 10x9x11 | Five-way intersection |
| `ChestCorridor` | `EPieceClass_ChestCorridor` | 5x5x7 | Corridor with loot chest |
| `Library` | `EPieceClass_Library` | 14x6(or 11)x15 | Library (single or double-height) |
| `PortalRoom` | `EPieceClass_PortalRoom` | 11x8x16 | End portal room with silverfish spawner |
| `FillerCorridor` | -- | variable | Connects unfinished ends |

### Stronghold piece weight rules

- **Library**: Only placed when `depth > 4`
- **PortalRoom**: Only placed when `depth > 5`
- Door types: `OPENING`, `WOOD_DOOR`, `GRATES`, `IRON_DOOR` (randomly selected per piece)

### Stronghold loot

- `ChestCorridor`: 14 weighted treasure item types
- `RoomCrossing`: 7 small treasure item types
- `Library`: 4 library-specific treasure item types

### Block selector

`SmoothStoneSelector` randomizes between stone brick variants (normal, mossy, cracked) for stronghold walls.

---

## Mineshafts

**Source**: `MineShaftFeature.h`, `MineShaftFeature.cpp`, `MineShaftPieces.h`, `MineShaftPieces.cpp`, `MineShaftStart.h`

### Placement

Mineshafts use a probabilistic check rather than a grid:

```
random.nextInt(100) == 0 && random.nextInt(80) < max(abs(chunkX), abs(chunkZ))
```

This means mineshafts become more common further from the world origin. Force placement via `LevelGenerationOptions` is also supported.

### Mineshaft generation

`MineShaftStart` creates a `MineShaftRoom` as the start piece and recursively generates corridors, crossings, and stairs.

### Mineshaft piece types

| Piece Class | Description |
|-------------|-------------|
| `MineShaftRoom` | Large open room that serves as the hub |
| `MineShaftCorridor` | Standard corridor with optional rails and spider webs (cave spider spawner) |
| `MineShaftCrossing` | Intersection point, optionally two-floored |
| `MineShaftStairs` | Descending/ascending staircase |

### Mineshaft constants

- `DEFAULT_SHAFT_WIDTH = 3`, `DEFAULT_SHAFT_HEIGHT = 3`, `DEFAULT_SHAFT_LENGTH = 5`
- `MAX_DEPTH = 8` (changed in 1.2.3)
- Loot defined in `MineShaftPieces::smallTreasureItems`

### Spider corridors

`MineShaftCorridor` has `hasRails` and `spiderCorridor` flags. Spider corridors contain cave spider spawners and cobweb blocks.

---

## Nether Fortress

**Source**: `NetherBridgeFeature.h`, `NetherBridgeFeature.cpp`, `NetherBridgePieces.h`

### Placement

The nether fortress uses a unique placement strategy on console:

1. **Forced fortress**: One fortress is always placed using the world seed. A random chunk in a 7x7 area `[(0,0) to (6,6)]` is selected.
2. **Large worlds only**: Additional fortresses can generate using the Java-style algorithm: divide nether into 16x16 chunk regions, 2/3 chance to skip, then random offset within the region.

Force placement via game rules is also supported.

### Fortress generation

`NetherBridgeStart` creates a `StartPiece` (which extends `BridgeCrossing`) and recursively generates pieces. After generation, the structure is constrained to Y range 48-70 via `moveInsideHeights()`.

### Fortress mob spawns

The fortress defines its own enemy spawn list separate from the Hell biome:

| Mob | Weight | Min | Max |
|-----|--------|-----|-----|
| Blaze | 10 | 2 | 3 |
| Zombie Pigman | 10 | 4 | 4 |
| Magma Cube | 3 | 4 | 4 |

These are returned by `getBridgeEnemies()` and used for spawning within fortress bounds.

### Fortress piece types

The fortress has two categories of pieces: **bridge** pieces and **castle** pieces, each with their own weight lists.

**Bridge pieces** (6 types):

| Piece Class | Dimensions | Description |
|-------------|-----------|-------------|
| `BridgeStraight` | 5x10x19 | Straight bridge segment |
| `BridgeEndFiller` | 5x10x8 | Bridge dead-end cap |
| `BridgeCrossing` | 19x10x19 | Large bridge intersection (also the start piece) |
| `RoomCrossing` | 7x9x7 | Small room at bridge junctions |
| `StairsRoom` | 7x11x7 | Room with staircase |
| `MonsterThrone` | 7x8x9 | Blaze spawner room |

**Castle pieces** (8 types):

| Piece Class | Dimensions | Description |
|-------------|-----------|-------------|
| `CastleEntrance` | 13x14x13 | Grand entrance hall |
| `CastleStalkRoom` | 13x14x13 | Nether wart farm room |
| `CastleSmallCorridorPiece` | 5x7x5 | Narrow corridor |
| `CastleSmallCorridorCrossingPiece` | 5x7x5 | Small corridor intersection |
| `CastleSmallCorridorRightTurnPiece` | 5x7x5 | Right turn corridor |
| `CastleSmallCorridorLeftTurnPiece` | 5x7x5 | Left turn corridor |
| `CastleCorridorStairsPiece` | 5x14x10 | Corridor with stairs |
| `CastleCorridorTBalconyPiece` | 9x7x9 | T-shaped balcony corridor |

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

The specific structure type is determined at generation time based on the biome at the chunk center:

- **Jungle biome** -> `JunglePyramidPiece`
- **Otherwise** (desert/desert hills) -> `DesertPyramidPiece`

### Desert Pyramid

`DesertPyramidPiece` extends `ScatteredFeaturePiece`. It contains:

- 4 loot chests (tracked by `hasPlacedChest[4]`)
- 6 weighted treasure item types
- TNT trap below the treasure room

### Jungle Temple

`JunglePyramidPiece` extends `ScatteredFeaturePiece`. It contains:

- Main chest and hidden chest (tracked by `placedMainChest`, `placedHiddenChest`)
- 2 arrow dispenser traps (`placedTrap1`, `placedTrap2`)
- 6 weighted treasure item types
- 1 dispenser item type (arrows)
- `MossStoneSelector` for randomized mossy/cracked stone brick walls

### ScatteredFeaturePiece base

Both pyramid types inherit from `ScatteredFeaturePiece`, which provides:

- Width, height, and depth dimensions
- `heightPosition` for vertical placement
- `updateAverageGroundHeight()` to adapt to terrain

---

## Caves (DungeonFeature / LargeCaveFeature)

**Source**: `LargeCaveFeature.h`, `LargeCaveFeature.cpp`, `DungeonFeature.h`, `DungeonFeature.cpp`

`LargeCaveFeature` extends `LargeFeature` and is the primary Overworld cave carver, used as `caveFeature` in `RandomLevelSource`. `DungeonFeature` is a related `LargeFeature` subclass with a similar room-and-tunnel algorithm. Both carve through the block array during chunk generation (before structures are placed).

### Cave generation algorithm

1. **`addFeature()`**: For each chunk, rolls a triple-nested random to determine cave count: `random(random(random(40) + 1) + 1)`, with a 14/15 chance of zero caves.
2. For each cave, picks a random position and generates:
   - Optionally a room (`addRoom()`) with a 1/4 chance, which creates a large spheroid
   - 1 + random(4) tunnels originating from the room center
3. **`addTunnel()`**: Carves a winding path through blocks using:
   - Sinusoidal thickness variation
   - Random rotation changes for organic shapes
   - Y-scale parameter for room vs tunnel proportions
   - Tunnel splitting at a random midpoint (creates branching caves)
   - Water detection to avoid carving into water bodies
   - Below Y=10, carved space is filled with lava instead of air

### Cave constraints

- Caves avoid carving through water or calm water blocks
- Maximum generation distance: `radius * 16 - 16` blocks
- Only carves through stone, dirt, and grass blocks
- Grass blocks below carved space are restored when dirt is exposed

---

## Console-specific modifications

Several 4J Studios modifications affect structure generation:

### World boundary checks

- **Villages**: Bounding box checked against `[-XZSize/2, XZSize/2]`; invalid if extending past the edge
- **Strongholds**: Distance formula adjusted to keep structures within console world limits
- **Nether fortress**: Forced placement in a small 7x7 chunk area to fit the limited nether size

### Structure counts

- **Strongholds**: 1 per world (vs 3 in Java Edition), with retry logic (up to 10 or 30 attempts)
- **Villages**: Town spacing reduced from 32 to 16 chunks on non-superflat small worlds

### Force placement

All structure types support forced placement through `LevelGenerationOptions::isFeatureChunk()`, which reads from game rules XML. This allows the game rules system (via `ConsoleGenerateStructure` and `XboxStructureAction*` classes in `Minecraft.Client/Common/GameRules/`) to place structures at specific coordinates.

### Feature position tracking

Each structure type calls `app.AddTerrainFeaturePosition()` when created, registering positions as `eTerrainFeature_Village`, `eTerrainFeature_Stronghold`, `eTerrainFeature_Mineshaft`, etc. This is used for the in-game map and Eye of Ender functionality.
