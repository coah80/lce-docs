---
title: World Generation
description: How LCEMP generates terrain, caves, ores, and features.
---

LCEMP generates worlds through a multi-stage pipeline that turns a 64-bit seed into a complete landscape of terrain, biomes, caves, ores, and structures. The system comes from Java Edition but has major changes by 4J Studios to support finite world sizes and parallel chunk generation.

## Chunk source hierarchy

All chunk generators implement the `ChunkSource` interface, which defines how chunks get created, populated, and saved. The key methods are `getChunk()`, `postProcess()`, and `lightChunk()`.

| Class | Dimension | Base block | Liquid |
|---|---|---|---|
| `RandomLevelSource` | Overworld | `Tile::rock` | `Tile::calmWater` |
| `CustomLevelSource` | Overworld (heightmap-based) | `Tile::rock` | `Tile::calmWater` |
| `FlatLevelSource` | Superflat | Configured layers | None |
| `HellRandomLevelSource` | Nether | `Tile::hellRock` | `Tile::calmLava` |
| `TheEndLevelRandomLevelSource` | The End | `Tile::whiteStone` | None |

`CustomLevelSource` reads heightmap data from binary files (`heightmap.bin` and `waterheight.bin`) and uses those instead of noise-generated terrain. It's used for console-specific pre-authored worlds (content packages). `RandomLevelSource` does the full noise-driven terrain generation described below.

## Overworld chunk generation pipeline

`RandomLevelSource::getChunk()` runs these stages in order:

### 1. Seed the chunk RNG

```cpp
random->setSeed(xOffs * 341873128712L + zOffs * 132897987541L);
```

Each chunk gets a deterministic seed based on its coordinates and two large prime-like constants.

### 2. Prepare heights (`prepareHeights`)

This stage computes a low-resolution 3D density field and upsamples it into a 16x128x16 block array.

The density field is sampled on a grid of `(CHUNK_WIDTH=4)` blocks horizontally and `(CHUNK_HEIGHT=8)` blocks vertically. The grid dimensions are 5x17x5 (including boundary samples for interpolation).

Seven Perlin noise octave generators contribute to the density value at each sample point:

| Noise generator | Octaves | Role |
|---|---|---|
| `lperlinNoise1` | 16 | Lower noise bound (amplitude A) |
| `lperlinNoise2` | 16 | Upper noise bound (amplitude B) |
| `perlinNoise1` | 8 | Interpolation selector between A and B |
| `scaleNoise` | 10 | Per-column terrain scale factor |
| `depthNoise` | 16 | Per-column depth variation |
| `floatingIslandScale` | 10 | Floating island scale (unused, `FLOATING_ISLANDS = false`) |
| `floatingIslandNoise` | 16 | Floating island noise (unused) |

The master frequency constant is `684.412`. Noise inputs are scaled by this value divided by various factors (e.g. `s / 80.0` for the selector noise, `s` directly for the bound noises).

**Biome influence:** A 5x5 neighborhood of biomes around each column is sampled. Each biome's `depth` and `scale` fields get distance-weighted (using a precomputed `pows` kernel of `10 / sqrt(dx^2 + dz^2 + 0.2)`) to produce smoothed per-column depth and scale values. These shift and compress the density curve, creating the right terrain height and roughness for each biome.

**Density computation per sample point:**

```
yCenter = ySize / 2.0 + depth * 4
yOffs = (y - yCenter) * 12 * 128 / genDepth / scale
if (yOffs < 0) yOffs *= 4  // steeper underground falloff

val = lerp(selector, lowerBound, upperBound) - yOffs
```

If `val > 0`, the sample becomes `Tile::rock`. If below sea level, it becomes `Tile::calmWater`. The final block array is produced by trilinear interpolation of these samples to full resolution.

**Edge-of-world falloff (4J addition):** Within 32 blocks of the world boundary, a compensation value ramps from 0 to 128, subtracting from the density threshold. This makes terrain gradually drop below sea level at the map edges, blending into the infinite ocean surrounding the finite world.

### 3. Build surfaces (`buildSurfaces`)

After height preparation, surfaces get painted based on biome data:

- A 4-octave `perlinNoise3` generates a per-column `runDepth` controlling how deep the surface layer goes.
- Starting from the top of the column and working down, the first stone encountered is replaced with the biome's `topMaterial` (usually grass) and subsequent stone blocks become the biome's `material` (usually dirt).
- Sand surfaces get sandstone layers beneath them.
- Cold biomes (temperature < 0.15) get ice instead of water at the surface.
- Bedrock is placed at Y=0-2 using `y <= 1 + random->nextInt(2)` (Y=0 and Y=1 are always bedrock, Y=2 is 50% chance). 4J changed this from Java's `y <= 0 + random->nextInt(5)` range (Y=0-4) to prevent players from getting stuck.

### 4. Carve caves and canyons

```cpp
caveFeature->apply(this, level, xOffs, zOffs, blocks);
canyonFeature->apply(this, level, xOffs, zOffs, blocks);
```

Both are `LargeFeature` subclasses that scan a neighborhood of `radius = 8` chunks around the target chunk. See the [Cave generation](#cave-generation) section below.

### 5. Apply structures

When `generateStructures` is true:

```cpp
mineShaftFeature->apply(...);
villageFeature->apply(...);
strongholdFeature->apply(...);
scatteredFeature->apply(...);
```

The order is intentional. Canyons run first so they can't cut through structures. This was changed in the 1.2 merge (the original 1.8 order placed canyons last).

### 6. Post-processing (`postProcess`)

Post-processing runs after the chunk is stored in the cache. It uses a separate `pprandom` RNG so it can run at the same time as chunk creation on other threads (a 4J optimization). Steps:

1. **Structure interiors**: Mine shafts, villages, and strongholds place their interior blocks.
2. **Water lakes**: 1-in-4 chance per chunk, random Y.
3. **Lava lakes**: 1-in-8 chance, biased toward lower Y. Above sea level needs an additional 1-in-10 check.
4. **Dungeons (monster rooms)**: 8 attempts per chunk at random positions.
5. **Biome decoration**: Hands off to `BiomeDecorator` (see [Feature placement](#feature-placement)).
6. **Mob spawning**: Initial passive mob population.
7. **Snow and ice**: Cold biomes get snow layers on exposed blocks and ice on water surfaces.

## Noise generation

### PerlinNoise

`PerlinNoise` stacks multiple `ImprovedNoise` octaves. Each octave doubles in frequency and halves in amplitude:

```
value = sum(noise[i].getValue(x * 2^i, y * 2^i, z * 2^i) / 2^i)
```

`ImprovedNoise` implements Ken Perlin's improved noise function with a 512-entry permutation table seeded from the world `Random`. It supports both 2D and 3D evaluation and bulk region sampling through `getRegion()`.

The `Synth` base class provides the shared `getValue(x, y)` interface.

### PerlinSimplexNoise

`PerlinSimplexNoise` stacks `SimplexNoise` octaves using the same summation pattern. `SimplexNoise` implements 2D and 3D simplex noise using a gradient table (`grad3[12][3]`) and skew factors `F2`, `G2`, `F3`, `G3`. It's used for biome temperature and downfall calculations.

### FastNoise

A separate `FastNoise` implementation exists for performance-sensitive paths.

## Cave generation

### LargeCaveFeature (Overworld)

The `addFeature()` method figures out how many cave systems to generate per chunk:

```cpp
int caves = random->nextInt(random->nextInt(random->nextInt(40) + 1) + 1);
if (random->nextInt(15) != 0) caves = 0;
```

This triple-nested random produces a heavily skewed distribution. Most chunks have no caves, but some can have many.

Each cave system starts at a random position. There's a 1-in-4 chance of creating a **room** (a wide spherical cavity), followed by 1-4 **tunnels** carved outward from that point.

**Tunnel carving** (`addTunnel`):
- Tunnels step forward in a direction defined by `yRot` (horizontal angle) and `xRot` (vertical pitch).
- The radius at each step follows a sine curve over the tunnel length, adjusted by a random `thickness` parameter.
- Direction changes through random angular acceleration (`yRota`, `xRota`), with dampening factors.
- Tunnels can **split** at a random midpoint into two diverging branches (if `thickness > 1`).
- Steep tunnels decay their vertical angle more slowly (`0.92` vs `0.7`).
- Blocks below Y=10 are replaced with lava instead of air.
- Caves won't carve through water. If water is found in the carving region, that step is skipped.

### CaveFeature (small caves)

`CaveFeature` generates smaller ellipsoidal cavities. It picks two endpoints in a 16-block range and carves an ellipsoid along the line between them, with some random fuzziness that makes the edges irregular. It checks for liquid nearby and avoids carving near chunk boundaries.

### CanyonFeature

`CanyonFeature` extends `LargeFeature` and carves narrow, tall ravines using the same tunnel-stepping algorithm but with a different Y-scale parameter to create the typical vertical slot shape.

### LargeHellCaveFeature (Nether)

The Nether uses its own cave feature (`LargeHellCaveFeature`) with the same room-and-tunnel algorithm, adapted for the Nether's hellrock terrain and lava sea.

## Feature placement

`BiomeDecorator::decorate()` is called during post-processing and places features in this order:

### Ore generation

`decorateOres()` places ore veins using `OreFeature`. Each vein picks two endpoints and carves an ellipsoidal shape between them, replacing the target block (default: stone) with the ore type.

| Ore | Vein size | Attempts/chunk | Y range |
|---|---|---|---|
| Dirt | 32 | 20 | 0 to genDepth |
| Gravel | 32 | 10 | 0 to genDepth |
| Coal | 16 | 20 | 0 to genDepth |
| Iron | 8 | 20 | 0 to genDepth/2 |
| Gold | 8 | 2 | 0 to genDepth/4 |
| Redstone | 7 | 8 | 0 to genDepth/8 |
| Diamond | 7 | 1 | 0 to genDepth/8 |
| Lapis lazuli | 6 | 1 | Centered at genDepth/8 (triangular distribution) |

Lapis uses `decorateDepthAverage()` which samples `random->nextInt(span) + random->nextInt(span) + (mid - span)`, producing a triangular distribution centered on `genDepth/8`.

### Surface features

After ores, features are placed in order:

1. **Sand patches** (3 attempts) and **clay patches** (1 attempt) at the top solid block.
2. **Gravel patches** (1 attempt).
3. **Trees**: Base count is `treeCount` (biome-specific) with a 1-in-10 chance of +1. Each tree type is picked by `Biome::getTreeFeature()`, which returns one of `TreeFeature`, `BasicTree`, `BirchFeature`, `SwampTreeFeature`, `MegaTreeFeature`, or `GroundBushFeature` depending on the biome and a random roll.
4. **Huge mushrooms**: Only in mushroom island biome (`hugeMushrooms` count).
5. **Flowers**: Yellow flowers and roses (1-in-4 chance per flower attempt).
6. **Tall grass**: Biome-specific through `Biome::getGrassFeature()`.
7. **Dead bushes**: Desert biomes.
8. **Water lilies**: Swamp biome.
9. **Mushrooms**: Small chance on the surface plus guaranteed underground attempts.
10. **Sugar cane (reeds)**: `reedsCount` attempts plus 10 extra always.
11. **Pumpkins**: 1-in-32 chance per chunk.
12. **Cacti**: Desert biomes.
13. **Water springs**: 50 attempts at random heights.
14. **Lava springs**: 20 attempts biased toward lower Y.

### Biome-specific overrides

Several biomes change decorator counts by declaring their decorator class as a friend and tweaking the fields:

| Biome | Notable changes |
|---|---|
| `DesertBiome` | `deadBushCount = 2`, `cactusCount = 10`, `reedsCount = 50`, `treeCount = -999`, sand/sand surface |
| `ForestBiome` | `treeCount = 10`, `grassCount = 2` |
| `PlainsBiome` | `treeCount = -999`, `flowerCount = 4`, `grassCount = 10` |
| `SwampBiome` | `treeCount = 2`, `flowerCount = -999`, `deadBushCount = 1`, `waterlilyCount = 4`, `mushroomCount = 8`, `reedsCount = 10` |
| `TaigaBiome` | `treeCount = 10`, `grassCount = 1` |
| `JungleBiome` | `treeCount = 50`, `grassCount = 25`, `flowerCount = 4` |
| `MushroomIslandBiome` | `hugeMushrooms = 1`, `mushroomCount = 1`, trees/flowers/grass all set to `-100` |
| `BeachBiome` | `treeCount = -999`, `deadBushCount = 0`, `reedsCount = 0`, `cactusCount = 0`, sand/sand surface |

## Biome layer system

Biome selection uses a chain of `Layer` objects that turn a seed into a 2D grid of biome IDs. Each layer wraps a parent layer and applies a transformation. The chain is built in `Layer::getDefaultLayers()`.

### Layer pipeline

```
IslandLayer(1)
  -> FuzzyZoomLayer(2000)
  -> AddIslandLayer(1)
  -> ZoomLayer(2001)
  -> AddIslandLayer(2)
  -> AddSnowLayer(2)
  -> ZoomLayer(2002)
  -> AddIslandLayer(3)
  -> ZoomLayer(2003)
  -> AddIslandLayer(4)
```

This base chain produces a rough continental layout. It then forks into two parallel branches:

**River branch:**
```
base -> ZoomLayer(1000) -> RiverInitLayer(100)
     -> ZoomLayer x(zoomLevel+2)
     -> RiverLayer(1) -> SmoothLayer(1000)
```

**Biome branch:**
```
base -> ZoomLayer(1000) -> BiomeInitLayer(200, levelType)
     -> ZoomLayer x2 -> RegionHillsLayer(1000)
     -> ZoomLayer x zoomLevel (with island/mushroom/shore inserts)
     -> SmoothLayer(1000)
```

The two branches get merged by `RiverMixerLayer`, which overlays river biomes onto the terrain biomes. A final `VoronoiZoom` layer provides block-level biome resolution from the chunk-level data.

### Layer types

| Layer | Purpose |
|---|---|
| `IslandLayer` | Generates initial random land/ocean pattern |
| `FuzzyZoomLayer` | 2x zoom with random neighbor selection |
| `ZoomLayer` | 2x zoom with majority-rule interpolation |
| `AddIslandLayer` | Converts some ocean cells to land |
| `AddSnowLayer` | Marks cold regions for snow biomes |
| `BiomeInitLayer` | Assigns specific biome IDs based on temperature/moisture |
| `RegionHillsLayer` | Adds hill variants of biomes |
| `ShoreLayer` | Adds beach/shore transitions at land-ocean boundaries |
| `RiverInitLayer` | Seeds river generation with random values |
| `RiverLayer` | Detects edges in the river seed to form river paths |
| `RiverMixerLayer` | Overlays rivers onto the biome map |
| `SmoothLayer` | Removes single-cell noise from the biome map |
| `SwampRiversLayer` | Adjusts river placement in swamp biomes |
| `AddMushroomIslandLayer` | Places mushroom island biomes (4J moved to later zoom for smaller islands) |
| `GrowMushroomIslandLayer` | Expands mushroom islands via region growing (4J addition) |
| `VoronoiZoom` | Block-resolution zoom using Voronoi cell assignment |
| `BiomeOverrideLayer` | Debug override layer (non-release builds only) |

The `zoomLevel` is 4 for normal worlds and 6 for large biome worlds. Each zoom doubles the map scale.

### Layer RNG

Each layer uses a deterministic PRNG seeded from the world seed, the layer's `seedMixup` constant, and the (x, z) coordinates. The mixing function uses the LCG constant `6364136223846793005` with increment `1442695040888963407`. The `nextRandom(max)` method extracts bits via `(rval >> 24) % max`.

### Biome registry

`Biome::biomes[256]` holds all 23 registered biomes (`BIOME_COUNT = 23`):

ocean, plains, desert, extremeHills, forest, taiga, swampland, river, hell, sky, frozenOcean, frozenRiver, iceFlats, iceMountains, mushroomIsland, mushroomIslandShore, beaches, desertHills, forestHills, taigaHills, smallerExtremeHills, jungle, jungleHills.

Each biome carries `depth`, `scale`, `temperature`, `downfall`, `topMaterial`, and `material` properties that shape the terrain and surface.

`BiomeSource` wraps the layer system and provides caching (`BiomeCache`) for biome lookups. It also exposes `containsOnly()` for structure placement validation and `findBiome()` for locating specific biomes.

## Structure generation

Structures extend `StructureFeature`, which extends `LargeFeature`. The system works in two phases:

1. **Carving phase** (`addFeature` / `apply`): During chunk creation, `isFeatureChunk()` checks if a chunk should have a structure start. If so, `createStructureStart()` builds the structure layout and `StructureStart` stores the component pieces. The pieces carve their footprint into the block array.

2. **Population phase** (`postProcess`): During post-processing, structure interiors are placed (chests, spawners, rails, etc.).

| Structure | Class | Notes |
|---|---|---|
| Stronghold | `StrongholdFeature` | 1 per world (Java has 3), limited to `allowedBiomes`, up to 30 placement attempts on large worlds |
| Village | `VillageFeature` | Needs `allowedBiomes` validation via `BiomeSource::containsOnly()`, accepts a `villageSizeModifier` |
| Mine shaft | `MineShaftFeature` | Standard generation |
| Nether fortress | `NetherBridgeFeature` | Nether-only, provides special mob spawning list (`bridgeEnemies`) |
| Scattered features | `RandomScatteredLargeFeature` | Desert temples, jungle temples, witch huts |

`StructureFeature` keeps a `cachedStructures` map keyed by a 64-bit hash of chunk coordinates to prevent duplicate generation.

## Nether generation

`HellRandomLevelSource` generates the Nether with these differences from the Overworld:

- **Terrain shape:** Uses a cosine-based Y-offset array that creates the signature ceiling-and-floor shape. The `hs` (height scale) is `684.412 * 3`, making the vertical noise much more compressed.
- **Lava sea** at Y=32 (instead of water at sea level).
- **Surface materials:** Netherrack, soul sand, and gravel are placed using two additional 4-octave noise generators (`perlinNoise2`, `perlinNoise3`) that pick sand and gravel regions.
- **Nether wart:** 4J added a 1-in-16 chance of placing nether wart on soul sand surfaces outside of fortresses.
- **Bedrock** on both floor (Y=0-4) and ceiling (Y=123-127).
- **Boundary walls:** 4J builds bedrock walls around the Nether perimeter, with a randomized jagged edge.
- **Cave carver:** `LargeHellCaveFeature` instead of `LargeCaveFeature`.
- **World scale:** The Nether is 1/3 to 1/8 the Overworld size (`HELL_LEVEL_MAX_SCALE` is 3 on legacy, 8 on large worlds).

Post-processing places:
- 8 lava spring attempts (`HellSpringFeature`)
- Random fire patches (`HellFireFeature`)
- Glowstone clusters (`LightGemFeature`)
- Nether quartz ore (13-block veins, 16 attempts, targeting hellrock)
- Brown and red mushrooms
- Nether portals (`HellPortalFeature`)

## The End generation

`TheEndLevelRandomLevelSource` generates The End dimension:

- **Fixed size:** 18x18 chunks (`END_LEVEL_MIN_WIDTH`), regardless of world size.
- **Island shape:** Uses a distance-based offset (`100 - sqrt(xd^2 + zd^2) * 8`) that creates a floating island tapering off with distance from the origin. This is clamped between -100 and 80.
- **No sea level**: blocks below the island are just void (air).
- **End stone** (`Tile::whiteStone`) is the only terrain block.
- **Noise scale** is doubled (`s *= 2`) compared to the Overworld, giving rougher terrain.
- **No caves or structures** are carved.

The End's biome decorator (`TheEndBiomeDecorator`) places:
- **8 obsidian spikes** in a circle of radius 40 around the origin, with increasing radii (2-4 blocks).
- **The Ender Dragon** at position (0, 128, 0) when chunk (0, 0) is processed.
- **The exit podium** (`EndPodiumFeature`) at the origin, placed when chunk (-16, -16) is processed.

## Flat world generation

`FlatLevelSource` generates superflat worlds using a `FlatLayer` configuration. The terrain is just a simple stack of configured block layers with no noise, caves, or terrain variation. Only village structures are generated if `generateStructures` is enabled.

## Key source files

| File | Description |
|---|---|
| `RandomLevelSource.cpp/.h` | Main Overworld terrain generator |
| `CustomLevelSource.cpp/.h` | Heightmap-based Overworld generator |
| `HellRandomLevelSource.cpp/.h` | Nether terrain generator |
| `TheEndLevelRandomLevelSource.cpp/.h` | End terrain generator |
| `FlatLevelSource.cpp/.h` | Superflat generator |
| `ChunkSource.h` | Base interface for all chunk generators |
| `LevelSource.h` | Block/tile access interface for rendering |
| `PerlinNoise.cpp/.h` | Octave Perlin noise |
| `ImprovedNoise.cpp/.h` | Single-octave improved Perlin noise |
| `PerlinSimplexNoise.cpp/.h` | Octave simplex noise |
| `SimplexNoise.cpp/.h` | Single-octave simplex noise |
| `Synth.h` | Base noise interface |
| `LargeFeature.cpp/.h` | Base class for chunk-spanning features |
| `LargeCaveFeature.cpp/.h` | Overworld cave carver |
| `LargeHellCaveFeature.h` | Nether cave carver |
| `CaveFeature.cpp/.h` | Small ellipsoidal cave feature |
| `CanyonFeature.cpp/.h` | Ravine/canyon carver |
| `Feature.cpp/.h` | Base class for all placed features |
| `BiomeDecorator.cpp/.h` | Feature placement orchestrator |
| `TheEndBiomeDecorator.cpp/.h` | End-specific decoration (spikes, dragon, podium) |
| `OreFeature.cpp/.h` | Ore vein placement |
| `Layer.cpp/.h` | Base biome layer + `getDefaultLayers()` pipeline |
| `BiomeSource.cpp/.h` | Biome lookup with caching |
| `Biome.h` | Biome registry and properties |
| `StructureFeature.cpp/.h` | Base class for generated structures |
| `StrongholdFeature.h` | Stronghold placement |
| `VillageFeature.h` | Village placement |
| `MineShaftFeature.h` | Mine shaft placement |
| `NetherBridgeFeature.h` | Nether fortress placement |
| `RandomScatteredLargeFeature.h` | Desert/jungle temples and witch huts |

## MinecraftConsoles Differences

The world generation system is mostly the same between LCEMP and MC, since both target the same Minecraft version's terrain. The main differences are:

- **Flat world configuration**: MC adds `FlatGeneratorInfo` and `FlatLayerInfo` classes for configurable superflat world presets. LCEMP just has a basic `FlatLayer` system with hardcoded layers.
- **Structure persistence**: MC adds `StructureFeatureIO` and `StructureFeatureSavedData` for saving structure bounding boxes to NBT and loading them back on world reload. In LCEMP, structure data only lives in memory during generation.
- **Witch huts**: MC adds a `SwamplandHut` piece type to `ScatteredFeaturePieces` with its own enemy spawn list (just Witch). In LCEMP, the `RandomScatteredLargeFeature` only generates desert pyramids and jungle temples. MC adds Swampland to the allowed biomes list for scattered features.
- **Nether wart tile**: MC has a separate `NetherWartTile` class. LCEMP uses `NetherStalkTile` for the same block.
- **Glowstone tile**: MC has a dedicated `GlowstoneTile` class. LCEMP just uses a basic `Tile` with `LightGemTile` for the same purpose.
