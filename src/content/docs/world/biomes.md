---
title: Biomes
description: Complete documentation of LCEMP's biome system.
---

LCEMP's biome system controls terrain surface materials, vegetation, mob spawning, climate properties, and how things look (grass/foliage/water/sky colors). The code lives mainly in `Minecraft.World/`, with the base class in `Biome.h`/`Biome.cpp` and subclasses for each biome variant.

## Architecture overview

```
Biome (base class)
├── BiomeSource          – selects biomes for world coordinates via Layer pipeline
│   └── FixedBiomeSource – returns a single biome everywhere (superflat worlds)
├── BiomeDecorator       – places ores, trees, flowers, grass, and other features
│   └── TheEndBiomeDecorator – End-specific decoration (obsidian spikes, podium)
├── BiomeCache           – caches biome lookups in 256x256 blocks
└── Layer (pipeline)     – transforms noise into biome IDs through chained layers
```

### Key source files

| File | Purpose |
|------|---------|
| `Biome.h` / `Biome.cpp` | Base class, static biome registry, mob spawns, default properties |
| `BiomeSource.h` / `BiomeSource.cpp` | Provides biomes for any (x, z) coordinate using the Layer pipeline |
| `FixedBiomeSource.h` | Single-biome source for superflat worlds |
| `BiomeDecorator.h` / `BiomeDecorator.cpp` | Feature placement: ores, trees, flowers, mushrooms, springs |
| `Layer.h` / `Layer.cpp` | Base layer class and `getDefaultLayers()` pipeline builder |
| `BiomeInitLayer.h` / `BiomeInitLayer.cpp` | Assigns initial biome IDs from a set of starter biomes |
| `BiomeOverrideLayer.h` | Debug layer that overrides biome data from a 216x216 byte array |

---

## Biome base class

`Biome` stores all per-biome properties and keeps a static registry of 256 biome slots. Each biome gets created in `Biome::staticCtor()` using a builder-style chain.

### Properties

| Field | Type | Description |
|-------|------|-------------|
| `id` | `const int` | Numeric biome ID (0-255), index into `Biome::biomes[]` |
| `m_name` | `wstring` | Display name |
| `color` | `int` | Map color (RGB hex) |
| `topMaterial` | `byte` | Surface block ID (default: grass) |
| `material` | `byte` | Sub-surface block ID (default: dirt) |
| `temperature` | `float` | Temperature value; controls snow/rain threshold |
| `downfall` | `float` | Rainfall amount; affects humidity classification |
| `depth` | `float` | Base terrain height (negative = below sea level) |
| `scale` | `float` | Terrain height variation |
| `leafColor` | `int` | Leaf tint color |
| `m_grassColor` | `eMinecraftColour` | Grass color enum (loaded from texture pack) |
| `m_foliageColor` | `eMinecraftColour` | Foliage color enum |
| `m_waterColor` | `eMinecraftColour` | Water color enum |
| `m_skyColor` | `eMinecraftColour` | Sky color enum |
| `decorator` | `BiomeDecorator *` | Controls feature placement counts |

### Climate logic

- **Snow**: A biome has snow if rain is enabled and `temperature < 0.15f`.
- **Rain**: A biome has rain if `_hasRain == true` and it doesn't snow.
- **Humidity**: A biome counts as humid when `downfall > 0.85f`.

Colors for grass, foliage, water, and sky are loaded from the texture pack's color table using per-biome `eMinecraftColour` enums instead of being computed from temperature/downfall like vanilla Java Edition does. This is a 4J Studios change.

---

## Biome registry

All 23 biomes (`BIOME_COUNT = 23`) are created in `Biome::staticCtor()`. Here's the full table straight from the source code:

| ID | Name | Class | Temp | Downfall | Depth | Scale | Surface | Snow | Rain |
|----|------|-------|------|----------|-------|-------|---------|------|------|
| 0 | Ocean | `OceanBiome` | 0.5 | 0.5 | -1.0 | 0.4 | grass/dirt | no | yes |
| 1 | Plains | `PlainsBiome` | 0.8 | 0.4 | 0.1 | 0.3 | grass/dirt | no | yes |
| 2 | Desert | `DesertBiome` | 2.0 | 0.0 | 0.1 | 0.2 | sand/sand | no | no |
| 3 | Extreme Hills | `ExtremeHillsBiome` | 0.2 | 0.3 | 0.3 | 1.5 | grass/dirt | no | yes |
| 4 | Forest | `ForestBiome` | 0.7 | 0.8 | 0.1 | 0.3 | grass/dirt | no | yes |
| 5 | Taiga | `TaigaBiome` | 0.05 | 0.8 | 0.1 | 0.4 | grass/dirt | yes | no |
| 6 | Swampland | `SwampBiome` | 0.8 | 0.9 | -0.2 | 0.1 | grass/dirt | no | yes |
| 7 | River | `RiverBiome` | 0.5 | 0.5 | -0.5 | 0.0 | grass/dirt | no | yes |
| 8 | Hell | `HellBiome` | 2.0 | 0.0 | 0.1 | 0.3 | grass/dirt | no | no |
| 9 | Sky (The End) | `TheEndBiome` | 0.5 | 0.5 | 0.1 | 0.3 | dirt/dirt | no | no |
| 10 | Frozen Ocean | `OceanBiome` | 0.0 | 0.5 | -1.0 | 0.5 | grass/dirt | yes | no |
| 11 | Frozen River | `RiverBiome` | 0.0 | 0.5 | -0.5 | 0.0 | grass/dirt | yes | no |
| 12 | Ice Plains | `IceBiome` | 0.0 | 0.5 | 0.1 | 0.3 | grass/dirt | yes | no |
| 13 | Ice Mountains | `IceBiome` | 0.0 | 0.5 | 0.3 | 1.3 | grass/dirt | yes | no |
| 14 | Mushroom Island | `MushroomIslandBiome` | 0.9 | 1.0 | 0.2 | 1.0 | mycelium/dirt | no | yes |
| 15 | Mushroom Island Shore | `MushroomIslandBiome` | 0.9 | 1.0 | -1.0 | 0.1 | mycelium/dirt | no | yes |
| 16 | Beach | `BeachBiome` | 0.8 | 0.4 | 0.0 | 0.1 | sand/sand | no | yes |
| 17 | Desert Hills | `DesertBiome` | 2.0 | 0.0 | 0.3 | 0.8 | sand/sand | no | no |
| 18 | Forest Hills | `ForestBiome` | 0.7 | 0.8 | 0.3 | 0.7 | grass/dirt | no | yes |
| 19 | Taiga Hills | `TaigaBiome` | 0.05 | 0.8 | 0.3 | 0.8 | grass/dirt | yes | no |
| 20 | Extreme Hills Edge | `ExtremeHillsBiome` | 0.2 | 0.3 | 0.2 | 0.8 | grass/dirt | no | yes |
| 21 | Jungle | `JungleBiome` | 1.2 | 0.9 | 0.2 | 0.4 | grass/dirt | no | yes |
| 22 | Jungle Hills | `JungleBiome` | 1.2 | 0.9 | 1.8 | 0.5 | grass/dirt | no | yes |

---

## Biome subclasses

Each subclass tweaks mob spawns, decorator counts, tree types, and/or decoration behavior.

### PlainsBiome (ID 1)

- Trees are disabled (`treeCount = -999`)
- Lots of grass (10), extra flowers (4)
- Default friendly mob spawns

### DesertBiome (IDs 2, 17)

- Clears all friendly mob spawns (no passive mobs)
- Surface: sand over sand
- No trees, dead bushes (2), reeds (50), cacti (10)
- Custom `decorate()`: 1/1000 chance per chunk to place a `DesertWellFeature`

### ExtremeHillsBiome (IDs 3, 20)

- Clears the `friendlies` list only (Sheep, Pig, Cow removed; chickens still spawn through `friendlies_chicken`)
- Custom `decorate()`: generates emerald ore (3-8 veins per chunk, Y range 4 to `genDepth / 4`)
- `GENERATE_EMERALD_ORE` is a compile-time constant set to `true`

### ForestBiome (IDs 4, 18)

- Wolves added to `friendlies_wolf` (weight 5)
- Trees: 10 per chunk; 1/5 chance birch, 1/10 chance fancy oak, otherwise normal oak
- Grass count: 2

### TaigaBiome (IDs 5, 19)

- Wolves added (weight 8)
- Trees: 10 per chunk; 1/3 chance pine, otherwise spruce
- Temperature set to 0.05 (snow-covered)
- Grass count: 1

### SwampBiome (ID 6)

- Trees: 2 per chunk, always `SwampTreeFeature`
- Flowers are disabled (`flowerCount = -999`)
- Dead bushes (1), mushrooms (8), reeds (10), clay (1), waterlilies (4)

### RiverBiome (IDs 7, 11)

- Clears `friendlies`, `friendlies_chicken`, and `friendlies_wolf` (no passive land mobs on rivers)
- Inline constructor in header; no extra decoration

### HellBiome (ID 8)

- Clears all default mobs
- Enemies: Ghast (weight 50), Zombie Pigman (weight 100), Magma Cube (weight 1)
- No rain

### TheEndBiome (ID 9)

- Clears all default mobs; adds Enderman (weight 10) as enemy
- Surface: dirt/dirt
- Uses `TheEndBiomeDecorator` instead of the default decorator
- `TheEndBiomeDecorator` places obsidian spike features and the end podium; spike data is stored in the static `SpikeValA[8]` array with chunk coordinates, position, and radius

### OceanBiome (IDs 0, 10)

- Clears `friendlies`, `friendlies_chicken`, and `friendlies_wolf` (no passive land mobs)
- Inline constructor in header

### IceBiome (IDs 12, 13)

- No extra customization beyond the base class; snow coverage is set through `setSnowCovered()` in `staticCtor()`

### MushroomIslandBiome (IDs 14, 15)

- Clears all mob lists (enemies, friendlies, water creatures)
- Adds Mooshroom to `friendlies_mushroomcow` (weight 8, groups of 4-8)
- Surface: mycelium
- Trees/flowers/grass all set to `-100` (basically disabled); mushrooms (1), huge mushrooms (1)

### BeachBiome (ID 16)

- Clears `friendlies` and `friendlies_chicken` (Sheep, Pig, Cow, Chicken removed; `friendlies_wolf` isn't cleared but wolves are never added to beaches anyway)
- Surface: sand/sand
- Trees disabled (`treeCount = -999`), dead bushes (0), reeds (0), cacti (0)

### JungleBiome (IDs 21, 22)

- High tree count (50), grass (25), flowers (4)
- Adds Ocelot to `enemies` (weight 2, groups of 1) and extra Chickens to `friendlies` (weight 10, groups of 4). Note: added to the main `friendlies` list, not `friendlies_chicken`
- Tree selection: 1/10 fancy oak, 1/2 ground bush, 1/3 mega jungle tree, otherwise normal jungle tree with vines
- Custom `getGrassFeature()`: 1/4 chance fern, otherwise tall grass
- Custom `decorate()`: places 50 `VinesFeature` per chunk after the base decoration

### RainforestBiome

- Not assigned to any biome ID in `staticCtor()`; seems to be an unused/legacy biome class
- Tree selection: 1/3 fancy oak, otherwise normal oak

---

## Mob spawning

The base `Biome` constructor sets up default spawn lists:

| Category | Mobs | Weights |
|----------|------|---------|
| `friendlies` | Sheep (12), Pig (10), Cow (8) | groups of 4 |
| `friendlies_chicken` | Chicken (10) | groups of 4 |
| `enemies` | Spider (10), Zombie (10), Skeleton (10), Creeper (10), Slime (10), Enderman (1) | groups of 4 (Enderman: 1-4) |
| `waterFriendlies` | Squid (10) | groups of 4 |

4J Studios split chickens, wolves, and mooshrooms into their own `MobCategory` lists (`friendlies_chicken`, `friendlies_wolf`, `friendlies_mushroomcow`) for tighter spawn control. The `getMobs()` method looks at the `MobCategory` to return the right list.

---

## BiomeDecorator

`BiomeDecorator` handles per-chunk feature placement. Each biome can override decorator counts in its constructor.

### Default decorator counts

| Feature | Count | Description |
|---------|-------|-------------|
| `treeCount` | 0 | Trees per chunk (10% bonus chance for +1) |
| `flowerCount` | 2 | Yellow flower placements (1/4 chance rose) |
| `grassCount` | 1 | Tall grass placements |
| `deadBushCount` | 0 | Dead bush placements |
| `mushroomCount` | 0 | Mushroom placement attempts |
| `reedsCount` | 0 | Sugar cane placements |
| `cactusCount` | 0 | Cactus placements |
| `waterlilyCount` | 0 | Waterlily placements |
| `hugeMushrooms` | 0 | Huge mushroom placements |
| `sandCount` | 3 | Sand patches |
| `clayCount` | 1 | Clay patches |
| `gravelCount` | 1 | Gravel patches |
| `liquids` | true | Whether to place water/lava springs |

### Ore generation

`decorateOres()` places ores with these settings:

| Ore | Veins/chunk | Vein size | Max height |
|-----|------------|-----------|------------|
| Dirt | 20 | 32 | genDepth |
| Gravel | 10 | 32 | genDepth |
| Coal | 20 | 16 | genDepth |
| Iron | 20 | 8 | genDepth/2 |
| Gold | 2 | 8 | genDepth/4 |
| Redstone | 8 | 7 | genDepth/8 |
| Diamond | 1 | 7 | genDepth/8 |
| Lapis Lazuli | 1 | 6 | Average around genDepth/8 |

Lapis uses `decorateDepthAverage()` for a triangular distribution centered at `genDepth/8`.

### Decoration order

1. Ores
2. Sand, clay, gravel patches
3. Trees (count + 10% bonus)
4. Huge mushrooms
5. Flowers (yellow + rose)
6. Tall grass
7. Dead bushes
8. Waterlilies
9. Mushrooms (brown + red)
10. Additional brown/red mushroom attempts (global, outside biome count)
11. Sugar cane (biome count + 10 extra)
12. Pumpkins (1/32 chance)
13. Cacti
14. Water springs (50 per chunk)
15. Lava springs (20 per chunk)

---

## Layer pipeline

Biome selection is driven by a chain of `Layer` objects, built in `Layer::getDefaultLayers()`. Each layer transforms an integer grid (`intArray`) representing biome IDs or terrain categories.

### Layer base class

`Layer` uses a linear congruential generator (LCG) with the constant `6364136223846793005` for deterministic pseudo-random output. The `initRandom(x, y)` method seeds per-cell randomness, and `nextRandom(max)` returns values in `[0, max)`.

The PS Vita build includes a special fast-divide optimization (`libdivide`) for the modulo operation in `nextRandom()`.

### Pipeline construction

The full layer chain for normal world generation:

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
  -> [branch: river pipeline]
  -> [branch: biome pipeline]
```

**River branch:**
```
  -> ZoomLayer (1x)
  -> RiverInitLayer(100)
  -> ZoomLayer (zoomLevel + 2 times)
  -> RiverLayer(1)
  -> SmoothLayer(1000)
```

**Biome branch:**
```
  -> ZoomLayer (1x)
  -> BiomeInitLayer(200)
  -> ZoomLayer (2x)
  -> RegionHillsLayer(1000)
  -> [zoomLevel iterations of ZoomLayer, with:]
      i=0: AddIslandLayer(3), AddMushroomIslandLayer(5)
      i=1: GrowMushroomIslandLayer(5), ShoreLayer(1000), SwampRiversLayer(1000)
  -> SmoothLayer(1000)
  -> RiverMixerLayer(100)  [merges river + biome]
  -> [optional BiomeOverrideLayer for debug]
  -> VoronoiZoom(10)       [final zoom for block-level precision]
```

The `zoomLevel` is normally 4, or 6 for `LevelType::lvl_largeBiomes`.

### Layer types

| Layer | Purpose |
|-------|---------|
| `IslandLayer` | Initial noise: random land (1) vs ocean (0) |
| `FuzzyZoomLayer` | 2x zoom with random interpolation |
| `ZoomLayer` | Standard 2x zoom with bilinear-like interpolation |
| `AddIslandLayer` | Randomly converts ocean cells to land |
| `AddSnowLayer` | Marks cold regions (value 3+4) for snow biomes |
| `AddMushroomIslandLayer` | Places mushroom island biome in isolated ocean |
| `GrowMushroomIslandLayer` | Expands mushroom islands by region-growing (4J custom) |
| `BiomeInitLayer` | Assigns actual biome IDs from the starter biome set |
| `RegionHillsLayer` | Converts base biomes to their hills variants |
| `ShoreLayer` | Adds beach/shore transitions |
| `SwampRiversLayer` | Integrates swamp-adjacent rivers |
| `RiverInitLayer` | Seeds the river noise pattern |
| `RiverLayer` | Generates river biome from noise |
| `RiverMixerLayer` | Combines river and biome layers |
| `SmoothLayer` | Smooths biome boundaries |
| `VoronoiZoom` | Final cell-based zoom for block-level biome resolution |
| `BiomeOverrideLayer` | Debug: overrides biomes from a 216x216 byte array |

### BiomeInitLayer starter biomes

The set of biomes available for initial assignment depends on `LevelType`:

- **lvl_normal_1_1** (pre-1.2.3): Desert, Forest, Extreme Hills, Swampland, Plains, Taiga (6 biomes)
- **Other level types**: Same plus Jungle (7 biomes)

Cold regions (snow layer value >= 2) are limited to Taiga or Ice Plains.

### 4J Studios modifications to the layer pipeline

- **Mushroom islands**: Moved 3 zoom levels later than vanilla Java, making them roughly 1/8 the original size. A custom `GrowMushroomIslandLayer` then region-grows them back into compact shapes that fit within the console world boundaries.
- **Shore layer**: Applied at zoom iteration 1 instead of 0.
- **Large biomes**: `zoomLevel` bumped from 4 to 6 for `lvl_largeBiomes`.

---

## BiomeSource

`BiomeSource` is the main way to query biomes at world coordinates. It holds two `Layer` references:

- `layer`: the main biome layer (used for `getBiomeBlock()`)
- `zoomedLayer`: the Voronoi-zoomed layer (used for block-level precision)

### Key methods

| Method | Description |
|--------|-------------|
| `getBiome(x, z)` | Returns the biome at block coordinates |
| `getBiomeBlock(x, z, w, h)` | Returns a rectangular array of biomes |
| `getTemperature(x, y, z)` | Temperature at a position (scaled by altitude) |
| `getDownfall(x, z)` | Downfall value at a position |
| `containsOnly(x, z, r, allowed)` | Checks if an area only has the specified biomes (used by structure placement) |
| `findBiome(x, z, r, toFind, random)` | Searches for a specific biome within a radius |
| `findSeed(generator)` | Static method that searches for a valid seed (PS Vita has early-out support) |

### FixedBiomeSource

Used for superflat worlds. Always returns the same biome with constant temperature and downfall values. Every spatial query returns that fixed biome.

### BiomeCache

`BiomeCache` caches biome data in 256x256 block regions so the system doesn't have to re-run the layer pipeline for the same area. `BiomeSource` creates and manages this cache internally.

## MinecraftConsoles Differences

The biome system is basically the same between LCEMP and MC. Both have 23 biomes (`BIOME_COUNT = 23`) with the same IDs, names, and properties. The biome registry, layer pipeline, and decorator system are identical in structure.

The one notable difference is that MC's `SwampBiome` now participates in the scattered feature system for witch hut generation. The swamp biome's enemy list can include Witch spawns near witch hut structures. In LCEMP, swamps don't have any special structure-related spawning.

Otherwise, the biome classes, decorator counts, and mob spawn lists are the same across both codebases.
