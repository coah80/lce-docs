---
title: Blocks (Tiles)
description: Complete documentation of the tile/block system in Minecraft.World.
---

The block system in LCE is built around the `Tile` base class. Internally, all blocks are called "tiles." There are about **176 tile types** registered in a static array of 4,096 slots.

## Core Architecture

### Tile Base Class

**Files:** `Minecraft.World/Tile.h`, `Minecraft.World/Tile.cpp`

#### Constants
| Constant | Value | Purpose |
|----------|-------|---------|
| `TILE_NUM_COUNT` | 4096 | Maximum possible tiles |
| `TILE_NUM_MASK` | 0xFFF | Bit mask for tile IDs |
| `TILE_NUM_SHIFT` | 12 | Bit shift position |
| `INDESTRUCTIBLE_DESTROY_TIME` | -1.0f | Marks unbreakable blocks |

#### Key Member Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `id` | `int` | Unique tile identifier (0-4095) |
| `destroySpeed` | `float` | Time to break in ticks |
| `explosionResistance` | `float` | Resistance to explosions |
| `isInventoryItem` | `bool` | Whether tile can be held as item |
| `collectStatistics` | `bool` | Whether to track in statistics |
| `_isTicking` | `bool` | Has regular tick() updates |
| `_isEntityTile` | `bool` | Has associated TileEntity |
| `m_iMaterial` | `int` | Creative inventory material category |
| `m_iBaseItemType` | `int` | Creative inventory tab category |
| `material` | `Material*` | Physical material properties |
| `soundType` | `const SoundType*` | Sound effects |
| `friction` | `float` | Surface friction coefficient (default 0.6) |
| `gravity` | `float` | Gravity effect on entities |
| `icon` | `Icon*` | Block texture icon |
| `descriptionId` | `unsigned int` | Localization string ID for the block name |
| `useDescriptionId` | `unsigned int` | Localization string ID for the "use" action (4J addition) |
| `m_textureName` | `wstring` | Texture resource name |
| *(via ThreadStorage TLS)* `xx0, yy0, zz0, xx1, yy1, zz1` | `double` | Bounding box coordinates (originally direct members, moved to per-thread `ThreadStorage` via TLS by 4J for thread safety) |

#### ThreadStorage (4J Addition)

4J moved the bounding box coordinates into thread-local storage so that different threads can set block shapes without stomping on each other. Each thread calls `CreateNewThreadStorage()` to get its own copy, and `ReleaseThreadStorage()` when done.

```cpp
class ThreadStorage {
    double xx0, yy0, zz0, xx1, yy1, zz1;
    int tileId;
};
static DWORD tlsIdxShape;  // TLS slot index
```

#### Static Arrays (indexed by tile ID)

```cpp
static Tile **tiles;                           // Global tile registry
static bool solid[4096];                       // Is the block solid?
static int lightBlock[4096];                   // Light blocking (0-15)
static bool transculent[4096];                 // Is transparent?
static int lightEmission[4096];                // Light output (0-15)
static unsigned char _sendTileData[4096];      // Data bits to network sync
static bool mipmapEnable[4096];                // Enable mipmapping?
static bool propagate[4096];                   // Propagate updates?
```

The `_sendTileData` array was originally a simple `bool` in Java. 4J changed it to an unsigned char acting as a bitfield so it can indicate which specific data bits matter for network sync.

## Sound Types

Pre-defined sound types that tiles can use:

| Sound Type | Usage |
|-----------|-------|
| `SOUND_NORMAL` | Stone/default blocks |
| `SOUND_WOOD` | Wooden blocks |
| `SOUND_GRAVEL` | Gravel and dirt |
| `SOUND_GRASS` | Grass blocks |
| `SOUND_STONE` | Stone variants |
| `SOUND_METAL` | Metal blocks (higher pitch) |
| `SOUND_GLASS` | Glass blocks |
| `SOUND_CLOTH` | Wool/cloth |
| `SOUND_SAND` | Sand |
| `SOUND_SNOW` | Snow |
| `SOUND_LADDER` | Ladders |
| `SOUND_ANVIL` | Anvils |

Each `SoundType` contains: `eMaterialSound`, break/step/place sound IDs, `volume`, and `pitch`. The constructor is:

```cpp
SoundType(eMATERIALSOUND_TYPE eMaterialSound, float volume, float pitch,
          int iBreakSound = -1, int iPlaceSound = -1);
```

## Render Shapes

Every tile has a render shape that controls how it gets drawn:

| Constant | Value | Example |
|----------|-------|---------|
| `SHAPE_INVISIBLE` | -1 | Air, invisible blocks |
| `SHAPE_BLOCK` | 0 | Full cube (stone, dirt) |
| `SHAPE_CROSS_TEXTURE` | 1 | X-shape (flowers, tall grass) |
| `SHAPE_TORCH` | 2 | Torch |
| `SHAPE_FIRE` | 3 | Fire |
| `SHAPE_WATER` | 4 | Water/lava |
| `SHAPE_RED_DUST` | 5 | Redstone dust |
| `SHAPE_ROWS` | 6 | Crop rows |
| `SHAPE_DOOR` | 7 | Doors |
| `SHAPE_LADDER` | 8 | Ladder |
| `SHAPE_RAIL` | 9 | Rails |
| `SHAPE_STAIRS` | 10 | Stairs |
| `SHAPE_FENCE` | 11 | Fences |
| `SHAPE_LEVER` | 12 | Lever |
| `SHAPE_CACTUS` | 13 | Cactus |
| `SHAPE_BED` | 14 | Bed |
| `SHAPE_DIODE` | 15 | Repeater |
| `SHAPE_PISTON_BASE` | 16 | Piston base |
| `SHAPE_PISTON_EXTENSION` | 17 | Piston arm |
| `SHAPE_IRON_FENCE` | 18 | Iron bars |
| `SHAPE_STEM` | 19 | Pumpkin/melon stem |
| `SHAPE_VINE` | 20 | Vines |
| `SHAPE_FENCE_GATE` | 21 | Fence gate |
| `SHAPE_ENTITYTILE_ANIMATED` | 22 | Animated tile entities |
| `SHAPE_LILYPAD` | 23 | Lily pad |
| `SHAPE_CAULDRON` | 24 | Cauldron |
| `SHAPE_BREWING_STAND` | 25 | Brewing stand |
| `SHAPE_PORTAL_FRAME` | 26 | End portal frame |
| `SHAPE_EGG` | 27 | Dragon egg |
| `SHAPE_COCOA` | 28 | Cocoa beans |
| `SHAPE_TRIPWIRE_SOURCE` | 29 | Tripwire hook |
| `SHAPE_TRIPWIRE` | 30 | Tripwire |
| `SHAPE_TREE` | 31 | Logs (with rotation) |
| `SHAPE_WALL` | 32 | Cobblestone wall |
| `SHAPE_FLOWER_POT` | 33 | Flower pot |
| `SHAPE_BEACON` | 34 | Beacon |
| `SHAPE_ANVIL` | 35 | Anvil |
| `SHAPE_QUARTZ` | 39 | Quartz block |

:::note[Gap at 36-38]
Shape values 36, 37, and 38 are not defined in LCEMP. They were probably reserved for later features or used in later console updates.
:::

## Complete Tile ID Registry

All tiles are set up in `Tile::staticCtor()`:

| ID | Internal Name | Class | Destroy Time | Notes |
|----|--------------|-------|-------------|-------|
| 1 | rock | `StoneTile` | 1.5s | Stone, drops cobblestone |
| 2 | grass | `GrassTile` | 0.6s | Biome-colored, spreads to dirt |
| 3 | dirt | `DirtTile` | 0.5s | Basic soil |
| 4 | stoneBrick | `Tile` | 2.0s | Cobblestone |
| 5 | wood | `WoodTile` | 2.0s | Planks, 4 wood type variants |
| 6 | sapling | `Sapling` | 0.0s | 4 tree types, grows into trees |
| 7 | unbreakable | `Tile` | -1.0 | Bedrock, indestructible |
| 8 | water | `LiquidTileDynamic` | -- | Flowing water |
| 9 | calmWater | `LiquidTileStatic` | -- | Still water |
| 10 | lava | `LiquidTileDynamic` | -- | Flowing lava, emits light |
| 11 | calmLava | `LiquidTileStatic` | -- | Still lava, emits light |
| 12 | sand | `HeavyTile` | 0.5s | Falls with gravity |
| 13 | gravel | `GravelTile` | 0.6s | Falls, chance to drop flint |
| 14 | goldOre | `OreTile` | 3.0s | Gold ore |
| 15 | ironOre | `OreTile` | 3.0s | Iron ore |
| 16 | coalOre | `OreTile` | 3.0s | Coal ore |
| 17 | treeTrunk | `TreeTile` | 2.0s | Logs, 4 wood types, rotatable |
| 18 | leaves | `LeafTile` | 0.2s | 4 types, decay system |
| 19 | sponge | `Sponge` | 0.6s | Absorbs water (range=2) |
| 20 | glass | `GlassTile` | 0.3s | Transparent, no drop |
| 21 | lapisOre | `OreTile` | 3.0s | Lapis lazuli ore |
| 22 | lapisBlock | `Tile` | 3.0s | Lapis block |
| 23 | dispenser | `DispenserTile` | 3.5s | TileEntity, 6 facing dirs |
| 24 | sandStone | `SandStoneTile` | 0.8s | 3 variants |
| 25 | musicBlock | `MusicTile` | 0.8s | Note block, TileEntity |
| 26 | bed | `BedTile` | 0.2s | 2-block, head/foot |
| 27 | goldenRail | `RailTile` | 0.7s | Powered rail |
| 28 | detectorRail | `DetectorRailTile` | 0.7s | Emits signal on entity |
| 29 | pistonStickyBase | `PistonBaseTile` | -- | Sticky piston |
| 30 | web | `WebTile` | 4.0s | Slows entities |
| 31 | tallgrass | `TallGrass` | 0.0s | 3 types: shrub/grass/fern |
| 32 | deadBush | `DeadBushTile` | 0.0s | Drops sticks |
| 33 | pistonBase | `PistonBaseTile` | -- | Normal piston |
| 34 | pistonExtension | `PistonExtensionTile` | -- | Piston arm |
| 35 | cloth | `ClothTile` | 0.8s | Wool, 16 colors |
| 36 | pistonMovingPiece | `PistonMovingPiece` | -- | Dynamic piston head |
| 37 | flower | `Bush` | 0.0s | Dandelion |
| 38 | rose | `Bush` | 0.0s | Poppy |
| 39 | mushroom1 | `Mushroom` | 0.0s | Brown mushroom, light=1 |
| 40 | mushroom2 | `Mushroom` | 0.0s | Red mushroom |
| 41 | goldBlock | `MetalTile` | 3.0s | Gold block |
| 42 | ironBlock | `MetalTile` | 5.0s | Iron block |
| 43 | stoneSlab | `StoneSlabTile` | -- | Double stone slab |
| 44 | stoneSlabHalf | `StoneSlabTile` | -- | Stone half slab |
| 45 | redBrick | `Tile` | 2.0s | Bricks |
| 46 | tnt | `TntTile` | 0.0s | Explodes on redstone |
| 47 | bookshelf | `BookshelfTile` | 1.5s | Drops books |
| 48 | mossStone | `Tile` | 2.0s | Mossy cobblestone |
| 49 | obsidian | `ObsidianTile` | 50.0s | Very hard, extends StoneTile |
| 50 | torch | `TorchTile` | -- | Light level 14 |
| 51 | fire | `FireTile` | -- | Spreads, animates |
| 52 | mobSpawner | `MobSpawnerTile` | 5.0s | TileEntity, spawns mobs |
| 53 | stairs_wood | `StairTile` | -- | Oak wood stairs |
| 54 | chest | `ChestTile` | 2.5s | TileEntity, can double |
| 55 | redStoneDust | `RedStoneDustTile` | -- | Signal wire, power 0-15 |
| 56 | diamondOre | `OreTile` | 3.0s | Diamond ore |
| 57 | diamondBlock | `MetalTile` | 5.0s | Diamond block |
| 58 | workBench | `WorkbenchTile` | 2.5s | Crafting table |
| 59 | crops | `CropTile` | 0.0s | Wheat, 8 growth stages |
| 60 | farmland | `FarmTile` | 0.6s | Tilled dirt |
| 61 | furnace | `FurnaceTile` | 3.5s | TileEntity, unlit |
| 62 | furnace_lit | `FurnaceTile` | 3.5s | TileEntity, lit, light=13 |
| 63 | sign | `SignTile` | 1.0s | Standing sign, TileEntity |
| 64 | door_wood | `DoorTile` | 3.0s | Wood door, 2-block |
| 65 | ladder | `LadderTile` | 0.4s | Climbable |
| 66 | rail | `RailTile` | 0.7s | Normal rail |
| 67 | stairs_stone | `StairTile` | -- | Stone stairs |
| 68 | wallSign | `SignTile` | 1.0s | Wall sign, TileEntity |
| 69 | lever | `LeverTile` | 0.5s | 6 orientations, redstone |
| 70 | pressurePlate_stone | `PressurePlateTile` | 0.5s | Mobs only |
| 71 | door_iron | `DoorTile` | 5.0s | Iron door, needs redstone |
| 72 | pressurePlate_wood | `PressurePlateTile` | 0.5s | All entities |
| 73 | redStoneOre | `RedStoneOreTile` | 3.0s | Emits particles |
| 74 | redStoneOre_lit | `RedStoneOreTile` | 3.0s | Glowing, light=9 |
| 75 | notGate_off | `NotGateTile` | -- | Redstone torch off |
| 76 | notGate_on | `NotGateTile` | -- | Redstone torch on, light=7 |
| 77 | button | `ButtonTile` | 0.5s | Stone button |
| 78 | topSnow | `TopSnowTile` | 0.1s | Snow layer |
| 79 | ice | `IceTile` | 0.5s | Slippery, transparent |
| 80 | snow | `SnowTile` | 0.2s | Snow block |
| 81 | cactus | `CactusTile` | 0.4s | Damages entities, grows |
| 82 | clay | `ClayTile` | 0.6s | Drops clay balls |
| 83 | reeds | `ReedTile` | 0.0s | Sugar cane, grows to 3 |
| 84 | recordPlayer | `RecordPlayerTile` | 2.0s | Jukebox, TileEntity |
| 85 | fence | `FenceTile` | 2.0s | Oak fence |
| 86 | pumpkin | `PumpkinTile` | 1.0s | Rotatable, extends DirectionalTile |
| 87 | hellRock | `HellStoneTile` | 0.4s | Netherrack |
| 88 | hellSand | `HellSandTile` | 0.5s | Soul sand, slows entities |
| 89 | lightGem | `LightGemTile` | 0.3s | Glowstone, light=15 |
| 90 | portalTile | `PortalTile` | -1.0 | Nether portal, light=11 |
| 91 | litPumpkin | `PumpkinTile` | 1.0s | Jack o'Lantern, light=15 |
| 92 | cake | `CakeTile` | 0.5s | 6 eating stages |
| 93 | diode_off | `DiodeTile` | -- | Repeater off, 4 delays |
| 94 | diode_on | `DiodeTile` | -- | Repeater on, 4 delays |
| 95 | aprilFoolsJoke | `LockedChestTile` | -- | Locked chest, light emitting |
| 96 | trapdoor | `TrapDoorTile` | 3.0s | Wood trapdoor |
| 97 | monsterStoneEgg | `StoneMonsterTile` | 0.75s | Silverfish stone |
| 98 | stoneBrickSmooth | `SmoothStoneBrickTile` | 1.5s | Stone bricks |
| 99 | hugeMushroom1 | `HugeMushroomTile` | 0.2s | Huge brown mushroom |
| 100 | hugeMushroom2 | `HugeMushroomTile` | 0.2s | Huge red mushroom |
| 101 | ironFence | `ThinFenceTile` | 5.0s | Iron bars |
| 102 | thinGlass | `ThinFenceTile` | 0.3s | Glass pane |
| 103 | melon | `MelonTile` | 1.0s | Melon block |
| 104 | pumpkinStem | `StemTile` | 0.0s | Grows pumpkins |
| 105 | melonStem | `StemTile` | 0.0s | Grows melons |
| 106 | vine | `VineTile` | 0.2s | 4-directional, climbable |
| 107 | fenceGate | `FenceGateTile` | 2.0s | Rotatable, extends DirectionalTile |
| 108 | stairs_bricks | `StairTile` | -- | Brick stairs |
| 109 | stairs_stoneBrickSmooth | `StairTile` | -- | Stone brick stairs |
| 110 | mycel | `MycelTile` | 0.6s | Mycelium |
| 111 | waterLily | `WaterlilyTile` | 0.0s | Lily pad, extends Bush |
| 112 | netherBrick | `Tile` | 2.0s | Nether brick block |
| 113 | netherFence | `FenceTile` | 2.0s | Nether brick fence |
| 114 | stairs_netherBricks | `StairTile` | -- | Nether brick stairs |
| 115 | netherStalk | `NetherStalkTile` | 0.0s | Nether wart, 4 stages, extends Bush |
| 116 | enchantTable | `EnchantmentTableTile` | 5.0s | TileEntity |
| 117 | brewingStand | `BrewingStandTile` | 0.5s | TileEntity, light=1 |
| 118 | cauldron | `CauldronTile` | 2.0s | Water storage |
| 119 | endPortalTile | `TheEndPortal` | -1.0 | End portal |
| 120 | endPortalFrameTile | `TheEndPortalFrameTile` | -1.0 | End portal frame, light=1 |
| 121 | whiteStone | `Tile` | 3.0s | End stone |
| 122 | dragonEgg | `EggTile` | 3.0s | Teleports when hit, light=1 |
| 123 | redstoneLight | `RedlightTile` | 0.3s | Redstone lamp off |
| 124 | redstoneLight_lit | `RedlightTile` | 0.3s | Redstone lamp on |
| 125 | woodSlab | `WoodSlabTile` | -- | Double wood slab |
| 126 | woodSlabHalf | `WoodSlabTile` | -- | Wood half slab |
| 127 | cocoa | `CocoaTile` | 0.2s | Cocoa beans, 3 stages, extends DirectionalTile |
| 128 | stairs_sandstone | `StairTile` | -- | Sandstone stairs |
| 129 | emeraldOre | `OreTile` | 3.0s | Emerald ore |
| 130 | enderChest | `EnderChestTile` | 22.5s | TileEntity, light=7 |
| 131 | tripWireSource | `TripWireSourceTile` | -- | Tripwire hook |
| 132 | tripWire | `TripWireTile` | -- | Tripwire line |
| 133 | emeraldBlock | `MetalTile` | 5.0s | Emerald block |
| 134 | woodStairsDark | `StairTile` | -- | Spruce stairs |
| 135 | woodStairsBirch | `StairTile` | -- | Birch stairs |
| 136 | woodStairsJungle | `StairTile` | -- | Jungle stairs |
| 139 | cobbleWall | `WallTile` | -- | Stone/cobble wall |
| 140 | flowerPot | `FlowerPotTile` | 0.0s | Holds plants |
| 141 | carrots | `CarrotTile` | 0.0s | 8 growth stages, extends CropTile |
| 142 | potatoes | `PotatoTile` | 0.0s | 8 growth stages, extends CropTile |
| 143 | button_wood | `ButtonTile` | 0.5s | Wood button |
| 144 | skull | `SkullTile` | 1.0s | Mob heads, TileEntity, max 40 per world |
| 145 | anvil | `AnvilTile` | 5.0s | 3 damage states, falls, extends HeavyTile |
| 153 | netherQuartz | `OreTile` | 3.0s | Nether quartz ore |
| 155 | quartzBlock | `QuartzBlockTile` | 0.8s | Quartz, variants |
| 156 | stairs_quartz | `StairTile` | -- | Quartz stairs |
| 171 | woolCarpet | `WoolCarpetTile` | 0.1s | 16 colors |

:::note[Gaps in IDs]
IDs 137-138, 146-152, 154, 157-170 are unassigned in this version. These correspond to blocks added in later LCE updates and are filled in by MinecraftConsoles (see the MC differences section below).
:::

## Class Hierarchy

```
Tile (abstract base)
├── TransparentTile (allowSame flag, blocksLight virtual)
│   ├── LeafTile (4 types, decay system, fancy/fast toggle)
│   └── (no other direct subclasses in LCEMP)
├── HalfTransparentTile (allowSame flag, overlay texture)
│   ├── GlassTile
│   ├── IceTile
│   ├── CoralTile
│   └── PortalTile
├── HeavyTile (falling blocks, instaFall flag, checkSlide logic)
│   ├── AnvilTile (3 damage states)
│   └── GravelTile (flint drops)
├── EntityTile (has TileEntity via newTileEntity() pure virtual)
│   ├── ChestTile
│   ├── FurnaceTile
│   ├── SignTile
│   ├── MobSpawnerTile
│   ├── EnchantmentTableTile
│   ├── BrewingStandTile
│   ├── DispenserTile
│   ├── EnderChestTile
│   ├── RecordPlayerTile (jukebox)
│   ├── MusicTile (note block)
│   └── SkullTile (mob heads, max 40)
├── DirectionalTile (DIRECTION_MASK=0x3, getDirection helper)
│   ├── BedTile
│   ├── PumpkinTile (pumpkin + jack o'lantern)
│   ├── FenceGateTile
│   ├── DiodeTile (repeater)
│   └── CocoaTile
├── LiquidTile (flow physics, getFlow, getDepth, fizz)
│   ├── LiquidTileDynamic (flowing, iterative tick system)
│   └── LiquidTileStatic (still, converts to dynamic on neighbor change)
├── Bush (plants, mayPlaceOn, canSurvive, checkAlive)
│   ├── CropTile (wheat, getGrowthSpeed, growCropsToMax)
│   │   ├── CarrotTile
│   │   └── PotatoTile
│   ├── StemTile (pumpkin/melon)
│   ├── NetherStalkTile (nether wart)
│   ├── DeadBushTile
│   ├── WaterlilyTile (lily pad)
│   └── Mushroom (brown/red)
├── TorchTile (wall-mounted, checkCanSurvive)
│   └── NotGateTile (redstone torch, toggle frequency tracking)
├── FireTile (flameOdds/burnOdds arrays, spread logic)
├── RedStoneDustTile (power 0-15, signal propagation)
├── RailTile (inner Rail class for connections, usesDataBit)
│   └── DetectorRailTile
├── FenceTile (connectsTo, isFence static)
├── StairTile (delegates to base tile, UPSIDEDOWN_BIT)
├── PistonBaseTile (MAX_PUSH_DEPTH=12, sticky flag, TLS ignoreUpdate)
├── PistonExtensionTile
├── PistonMovingPiece
├── DoorTile
├── TrapDoorTile
├── PressurePlateTile
├── LeverTile
├── ButtonTile
├── CactusTile
├── VineTile
├── HalfSlabTile (TYPE_MASK=7, TOP_SLOT_BIT=8, fullSize flag)
│   ├── StoneSlabTile
│   └── WoodSlabTile
├── ThinFenceTile (iron bars, glass pane)
├── WallTile
├── OreTile (drops different item, XP on break)
├── StoneTile
│   └── ObsidianTile
├── GrassTile (MIN_BRIGHTNESS=4, biome colors, spreads to dirt)
├── DirtTile
├── MycelTile
├── FarmTile (wet/dry, isNearWater, fallOn converts back to dirt)
├── SandStoneTile (3 variants)
├── ClothTile (wool, 16 colors)
├── WoolCarpetTile (16 colors)
├── QuartzBlockTile (pillar variants)
├── TreeTile (log, 4 wood types, rotatable)
├── HugeMushroomTile
├── Sponge (RANGE=2)
├── CakeTile (6 stages)
├── CauldronTile (water level 0-3)
├── WorkbenchTile
├── BookshelfTile
├── TntTile
├── WebTile
├── ReedTile (sugar cane)
├── RedlightTile (redstone lamp)
├── RedStoneOreTile (glow on interact)
├── StoneMonsterTile (silverfish)
├── TopSnowTile
├── SnowTile
├── FlowerPotTile
├── TripWireSourceTile (hook)
├── TripWireTile (wire)
├── EggTile (dragon egg)
├── LockedChestTile (april fools)
├── TheEndPortal
├── TheEndPortalFrameTile
├── MelonTile
├── MetalTile (gold/iron/diamond/emerald blocks)
├── LightGemTile (glowstone)
├── HellStoneTile (netherrack)
├── HellSandTile (soul sand)
├── LadderTile
├── ClayTile
└── AirTile
```

## Materials System

Materials define physical properties that multiple tiles share:

```cpp
class Material {
    MaterialColor *color;
    bool _flammable;
    bool _replaceable;
    bool _neverBuildable;
    bool _isAlwaysDestroyable;
    int pushReaction;       // 0=push, 1=destroy, 2=block
    bool destroyedByHand;
};
```

### Key Material Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `isLiquid()` | `bool` | Is this a liquid material? |
| `letsWaterThrough()` | `bool` | Can water flow through? |
| `isSolid()` | `bool` | Is physically solid? |
| `blocksLight()` | `bool` | Blocks light propagation? |
| `blocksMotion()` | `bool` | Blocks entity movement? |
| `isFlammable()` | `bool` | Can burn? |
| `isReplaceable()` | `bool` | Can be overwritten by placement? |
| `isSolidBlocking()` | `bool` | Blocks solid rendering? |
| `isAlwaysDestroyable()` | `bool` | Breakable by any tool? |
| `getPushReaction()` | `int` | Piston behavior (0/1/2) |
| `isDestroyedByHand()` | `bool` | Drops when broken by hand? |

### Push Reaction Constants

```cpp
static const int PUSH_NORMAL = 0;   // Can be pushed
static const int PUSH_DESTROY = 1;  // Destroyed when pushed
static const int PUSH_BLOCK = 2;    // Cannot be pushed at all
```

### Pre-defined Materials

| Material | Solid | Liquid | Flammable | Replaceable | Push Reaction |
|----------|-------|--------|-----------|-------------|---------------|
| `air` | No | No | No | Yes | -- |
| `stone` | Yes | No | No | No | Push |
| `dirt` | Yes | No | No | No | Push |
| `grass` | Yes | No | No | No | Push |
| `wood` | Yes | No | Yes | No | Push |
| `metal` | Yes | No | No | No | Push |
| `heavyMetal` | Yes | No | No | No | Block |
| `water` | No | Yes | No | Yes | -- |
| `lava` | No | Yes | No | Yes | -- |
| `leaves` | Yes | No | Yes | No | Destroy |
| `plant` | No | No | No | No | Destroy |
| `replaceable_plant` | No | No | No | Yes | Destroy |
| `sponge` | Yes | No | No | No | Push |
| `cloth` | Yes | No | Yes | No | Push |
| `fire` | No | No | No | Yes | Destroy |
| `sand` | Yes | No | No | No | Push |
| `glass` | Yes | No | No | No | Push |
| `buildable_glass` | Yes | No | No | No | Push |
| `explosive` | Yes | No | Yes | No | Push |
| `ice` | Yes | No | No | No | Push |
| `snow` | Yes | No | No | No | Push |
| `topSnow` | No | No | No | Yes | Destroy |
| `cactus` | Yes | No | No | No | Destroy |
| `clay` | Yes | No | No | No | Push |
| `portal` | No | No | No | No | Block |
| `cake` | Yes | No | No | No | Destroy |
| `decoration` | No | No | No | No | Destroy |
| `clothDecoration` | No | No | Yes | No | Push |
| `coral` | Yes | No | No | No | Destroy |
| `vegetable` | Yes | No | No | No | Destroy |
| `egg` | Yes | No | No | No | Destroy |
| `web` | Yes | No | No | No | Destroy |
| `piston` | Yes | No | No | No | Block |

## Complete Virtual Methods Reference

Here is every virtual method on the `Tile` base class, grouped by what they do.

### Construction and Properties

```cpp
// Called after construction to finalize the tile's setup
virtual void init();

// Builder-pattern setters (return Tile* for chaining)
virtual Tile *setSoundType(const SoundType *soundType);
virtual Tile *setLightBlock(int i);
virtual Tile *setLightEmission(float f);
virtual Tile *setExplodeable(float explosionResistance);
virtual Tile *setDestroyTime(float destroySpeed);
virtual Tile *setIndestructible();
virtual Tile *setTicking(bool tick);
virtual Tile *disableMipmap();
virtual Tile *setNotCollectStatistics();
virtual Tile *sendTileData(unsigned char importantMask = 15);
virtual Tile *setDescriptionId(unsigned int id);
virtual Tile *setUseDescriptionId(unsigned int id);  // 4J addition
```

### Rendering

```cpp
virtual Icon *getTexture(int face, int data);                          // Texture per face and metadata
virtual Icon *getTexture(int face);                                     // Texture per face only
virtual Icon *getTexture(LevelSource *level, int x, int y, int z, int face); // World-aware texture
virtual bool shouldRenderFace(LevelSource *level, int x, int y, int z, int face); // Skip hidden faces
virtual bool isSolidFace(LevelSource *level, int x, int y, int z, int face);     // Is this face solid?
virtual bool isSolidRender(bool isServerLevel = false);                // Needs solid rendering?
virtual bool isCubeShaped();                                            // Is a full cube?
virtual int getRenderLayer();                                           // 0=solid, 1=cutout, 2=transparent
virtual int getRenderShape();                                           // Which shape to draw
virtual int getColor() const;                                           // Base tint color
virtual int getColor(int auxData);                                      // Color per metadata
virtual int getColor(LevelSource *level, int x, int y, int z);         // Position-based color (biomes)
virtual int getColor(LevelSource *level, int x, int y, int z, int data); // 4J addition: color with data
virtual float getBrightness(LevelSource *level, int x, int y, int z);  // Brightness override
virtual int getLightColor(LevelSource *level, int x, int y, int z, int tileId = -1); // Light color (4J)
virtual float getShadeBrightness(LevelSource *level, int x, int y, int z); // Shadow brightness (4J)
virtual void prepareRender(Level *level, int x, int y, int z);         // Pre-render setup
virtual void animateTick(Level *level, int x, int y, int z, Random *random); // Client-side particles
virtual void registerIcons(IconRegister *iconRegister);                 // Register texture icons
virtual wstring getTileItemIconName();                                  // Item icon name
```

### Shape and Collision

```cpp
virtual void setShape(float x0, float y0, float z0, float x1, float y1, float z1); // Set bounding box
virtual void updateShape(LevelSource *level, int x, int y, int z, int forceData = -1,
                          shared_ptr<TileEntity> forceEntity = shared_ptr<TileEntity>());
virtual void updateDefaultShape();                                      // Reset to default shape
virtual double getShapeX0();  // Read bounding box from TLS
virtual double getShapeX1();
virtual double getShapeY0();
virtual double getShapeY1();
virtual double getShapeZ0();
virtual double getShapeZ1();
virtual AABB *getTileAABB(Level *level, int x, int y, int z);          // Selection box
virtual AABB *getAABB(Level *level, int x, int y, int z);              // Collision box
virtual void addAABBs(Level *level, int x, int y, int z, AABB *box, AABBList *boxes,
                       shared_ptr<Entity> source);                      // Multiple collision boxes
virtual HitResult *clip(Level *level, int xt, int yt, int zt, Vec3 *a, Vec3 *b); // Raytrace
virtual bool isPathfindable(LevelSource *level, int x, int y, int z);  // Can mobs walk through?
```

### Destruction and Drops

```cpp
virtual float getDestroySpeed(Level *level, int x, int y, int z);
virtual float getDestroyProgress(shared_ptr<Player> player, Level *level, int x, int y, int z);
virtual int getResource(int data, Random *random, int playerBonusLevel);       // Item ID to drop
virtual int getResourceCount(Random *random);                                   // How many
virtual int getResourceCountForLootBonus(int bonusLevel, Random *random);       // Fortune bonus
virtual int getSpawnResourcesAuxValue(int data);                                // Aux value for dropped item
virtual void spawnResources(Level *level, int x, int y, int z, int data, int playerBonusLevel);
virtual void spawnResources(Level *level, int x, int y, int z, int data, float odds, int playerBonusLevel);
virtual void destroy(Level *level, int x, int y, int z, int data);             // Block broken
virtual void playerDestroy(Level *level, shared_ptr<Player> player, int x, int y, int z, int data);
virtual void playerWillDestroy(Level *level, int x, int y, int z, int data, shared_ptr<Player> player);
virtual bool isSilkTouchable();                                                 // Silk Touch works?
virtual shared_ptr<ItemInstance> getSilkTouchItemInstance(int data);             // Silk Touch drop
virtual int cloneTileId(Level *level, int x, int y, int z);                    // Pick block ID
virtual int cloneTileData(Level *level, int x, int y, int z);                  // Pick block data
```

### Tick and Updates

```cpp
virtual void tick(Level *level, int x, int y, int z, Random *random);            // Regular updates
virtual void neighborChanged(Level *level, int x, int y, int z, int type);       // Adjacent block changed
virtual void addLights(Level *level, int x, int y, int z);                       // Light update
virtual int getTickDelay();                                                        // Tick frequency
virtual bool shouldTileTick(Level *level, int x, int y, int z);                  // 4J: skip tick if nothing to do
virtual void levelTimeChanged(Level *level, __int64 delta, __int64 newTime);      // 4J: time-based updates
virtual void handleRain(Level *level, int x, int y, int z);                       // Rain interaction
```

### Interaction

```cpp
virtual bool use(Level *level, int x, int y, int z, shared_ptr<Player> player,
                  int clickedFace, float clickX, float clickY, float clickZ,
                  bool soundOnly = false);                                          // Right-click
virtual bool TestUse();                                                             // Can use at all?
virtual bool TestUse(Level *level, int x, int y, int z, shared_ptr<Player> player); // Can use here?
virtual void attack(Level *level, int x, int y, int z, shared_ptr<Player> player);  // Left-click
virtual void stepOn(Level *level, int x, int y, int z, shared_ptr<Entity> entity);  // Walked on
virtual void fallOn(Level *level, int x, int y, int z, shared_ptr<Entity> entity, float dist); // Fell on
virtual void entityInside(Level *level, int x, int y, int z, shared_ptr<Entity> entity); // Inside block
```

### Placement

```cpp
virtual bool mayPlace(Level *level, int x, int y, int z, int face);               // Can place on face?
virtual bool mayPlace(Level *level, int x, int y, int z);                          // Can place here?
virtual bool mayPick(int data, bool liquid);                                        // Can target for picking?
virtual bool mayPick();                                                             // Can target at all?
virtual bool canSurvive(Level *level, int x, int y, int z);                        // Can exist here?
virtual void onPlace(Level *level, int x, int y, int z);                           // Just placed
virtual void onRemove(Level *level, int x, int y, int z, int id, int data);        // Being removed
virtual void onRemoving(Level *level, int x, int y, int z, int data);              // About to remove
virtual int getPlacedOnFaceDataValue(Level *level, int x, int y, int z, int face,
                                      float clickX, float clickY, float clickZ, int itemValue);
virtual void setPlacedBy(Level *level, int x, int y, int z, shared_ptr<Mob> by);   // Who placed it
virtual void finalizePlacement(Level *level, int x, int y, int z, int data);       // Post-placement setup
```

### Redstone

```cpp
virtual bool isSignalSource();                                          // Emits redstone?
virtual bool getSignal(LevelSource *level, int x, int y, int z);       // Has any signal?
virtual bool getSignal(LevelSource *level, int x, int y, int z, int dir); // Signal per direction
virtual bool getDirectSignal(Level *level, int x, int y, int z, int dir); // Direct power
```

### Physics

```cpp
virtual float getExplosionResistance(shared_ptr<Entity> source);
virtual void wasExploded(Level *level, int x, int y, int z);
virtual int getPistonPushReaction();  // 0=push, 1=destroy, 2=block
virtual void handleEntityInside(Level *level, int x, int y, int z,
                                  shared_ptr<Entity> e, Vec3 *velocity);
```

### Misc

```cpp
virtual wstring getName();                                               // Display name
virtual unsigned int getDescriptionId(int iData = -1);                   // Localization ID
virtual unsigned int getUseDescriptionId();                              // 4J: "use" localization ID
virtual void triggerEvent(Level *level, int x, int y, int z, int b0, int b1); // Block events
virtual bool isCollectStatistics();                                      // Track in stats?
virtual bool isTicking();                                                // Has tick updates?
virtual bool isEntityTile();                                             // Has TileEntity?
// Helper (not virtual):
int getFaceFlags(LevelSource *level, int x, int y, int z);             // AP: fast face culling
static bool isSolidBlockingTile(int t);
static bool isFaceVisible(Level *level, int x, int y, int z, int f);
```

## Behavior Deep Dives

### Fire Spread System

`FireTile` keeps two arrays indexed by tile ID:

| Array | Purpose |
|-------|---------|
| `flameOdds[]` | How easily each block catches fire |
| `burnOdds[]` | How fast each block burns away |

Flame and burn constants:

| Constant | Value | Meaning |
|----------|-------|---------|
| `FLAME_INSTANT` | 60 | Catches fire very easily |
| `FLAME_EASY` | 30 | Catches fire easily |
| `FLAME_MEDIUM` | 15 | Moderate flammability |
| `FLAME_HARD` | 5 | Hard to catch fire |
| `BURN_INSTANT` | 100 | Burns away instantly |
| `BURN_EASY` | 60 | Burns away quickly |
| `BURN_MEDIUM` | 20 | Burns at moderate speed |
| `BURN_HARD` | 5 | Burns slowly |
| `BURN_NEVER` | 0 | Never burns away |

Key methods: `setFlammable(id, flame, burn)`, `isFlammable(tile)`, `getFlammability(level, x, y, z, odds)`, `canBurn(level, x, y, z)`, `checkBurnOut(level, x, y, z, chance, random, age)`, and `isValidFireLocation(level, x, y, z)`.

### Leaf Decay

`LeafTile` uses bit flags in the metadata:
- **Bit 3** (`UPDATE_LEAF_BIT = 8`): Needs a decay check
- **Bit 2** (`PERSISTENT_LEAF_BIT = 4`): Player-placed, won't decay
- **Bits 0-1** (`LEAF_TYPE_MASK = 3`): Leaf type (0=oak, 1=evergreen, 2=birch, 3=jungle)

Leaves decay if they're more than 4 blocks (`REQUIRED_WOOD_RANGE`) away from any log block. The decay check uses a flood-fill buffer (`checkBuffer`) to search for nearby logs.

4J added a `shouldTileTick()` override so the game can skip adding leaves to the tick list when no decay check is actually needed.

### Crop Growth

`CropTile` growth speed depends on:
- Light level (must be >= `MAX_BRIGHTNESS - 6`)
- Adjacent farmland blocks
- Water hydration of farmland
- Random tick probability

The `getGrowthSpeed()` private method calculates the growth rate based on these factors. `growCropsToMax()` instantly sets the crop to full growth (used by bone meal).

`CropTile` also has `getBaseSeedId()` and `getBasePlantId()` virtual methods that subclasses like `CarrotTile` and `PotatoTile` override to return their specific seed and plant item IDs.

### Farmland Behavior

`FarmTile` has special behaviors:
- **Wet/dry state**: stored in metadata, controlled by `isNearWater()` which checks for water within 4 blocks horizontally
- **Crop check**: `isUnderCrops()` detects if a crop is growing on top
- **Entity damage**: `fallOn()` reverts farmland to dirt when entities land on it
- **Dehydration**: `tick()` gradually dries out farmland that isn't near water and doesn't have crops

### Liquid Flow

`LiquidTile` (water/lava) handles flow physics. The base class provides:

```cpp
virtual Vec3 *getFlow(LevelSource *level, int x, int y, int z);  // Flow direction
virtual int getDepth(Level *level, int x, int y, int z);         // Flow level
virtual int getRenderedDepth(LevelSource *level, int x, int y, int z);
virtual void fizz(Level *level, int x, int y, int z);            // Lava + water = obsidian
```

`LiquidTileDynamic` (flowing) adds:
- `trySpreadTo()`: Attempts to spread to a neighbor
- `getSlopeDistance()`: Pathfinds to find the nearest drop for water flow direction
- `getSpread()`: Determines which of 4 horizontal directions to flow
- `isWaterBlocking()`: Checks if a block stops water
- `canSpreadTo()`: Whether flow can enter a position
- `setStatic()`: Converts to `LiquidTileStatic` when flow stops
- **4J iterative tick**: `iterativeTick()` uses a deque (`m_tilesToTick`) to process liquid spread iteratively instead of recursively, avoiding stack overflows

`LiquidTileStatic` (still) converts back to `LiquidTileDynamic` via `setDynamic()` when a neighbor changes. It also checks `isFlammable()` on neighbors to potentially start fires near still lava.

### Piston Mechanics

`PistonBaseTile` can push up to **12 blocks** (`MAX_PUSH_DEPTH`) in a line:

```cpp
bool createPush(Level *level, int sx, int sy, int sz, int facing);
static bool canPush(Level *level, int sx, int sy, int sz, int facing);
static bool isPushable(int block, Level *level, int cx, int cy, int cz, bool allowDestroyable);
```

Key constants and flags:
- `EXTENDED_BIT = 8`: Metadata flag for extended state
- `UNDEFINED_FACING = 7`: No direction set yet
- `TRIGGER_EXTEND = 0` / `TRIGGER_CONTRACT = 1`: Event parameters
- `PLATFORM_THICKNESS`: The thickness of the piston platform

It can't push obsidian, bedrock, or tile entities (chests, furnaces, etc.). The `isSticky` flag controls whether the piston pulls blocks back. 4J added TLS for the `ignoreUpdate` flag to make piston updates thread-safe.

The facing direction is determined by `getNewFacing()` which checks the player's look direction when placing.

### Tripwire System

Max tripwire length is **42 blocks** (`WIRE_DIST_MAX = 2 + 40`, which is 2 hooks plus 40 wire blocks). `TripWireSourceTile` scans for the paired hook and activates when an entity crosses the wire.

Data bits:
- `MASK_DIR = 0x3`: Direction (2 bits)
- `MASK_ATTACHED = 0x4`: Is attached to matching hook
- `MASK_POWERED = 0x8`: Is powered/triggered

Key methods: `calculateState()` does the main wire scanning and state update, `notifyNeighbors()` sends updates along the wire axis, and `checkCanSurvive()` verifies the hook has a solid wall behind it.

### Redstone Wire

`RedStoneDustTile` stores the power level (0-15) in the data value. Power drops by 1 for each block it travels. Signal propagation uses:

```cpp
void updatePowerStrength(Level *level, int x, int y, int z);
void updatePowerStrength(Level *level, int x, int y, int z, int xFrom, int yFrom, int zFrom);
int checkTarget(Level *level, int x, int y, int z, int target);
void checkCornerChangeAt(Level *level, int x, int y, int z);
```

The `shouldSignal` flag prevents infinite loops during signal propagation. The `toUpdate` set (using `TilePos` with custom hash) tracks positions that need neighbor notifications after a power change.

Static helpers `shouldConnectTo()` and `shouldReceivePowerFrom()` check if a neighboring block at a given direction should have a wire connection or receive power.

### Redstone Torch (NotGateTile)

`NotGateTile` extends `TorchTile` and tracks recent toggles to prevent burnout oscillation:
- `RECENT_TOGGLE_TIMER = 60` ticks (3 seconds)
- `MAX_RECENT_TOGGLES = 8`

A static map `recentToggles` (keyed by `Level*`) stores a deque of `Toggle` records with position and timestamp. If a torch toggles more than 8 times in 60 ticks, it stops responding. 4J added `removeLevelReferences()` to clean up when a level is destroyed.

### Rail System

`RailTile` has an inner `Rail` class that manages track connections:
- `connections`: vector of connected rail positions
- `updateConnections()`: figures out rail direction from neighbors
- `connectsTo()` / `canConnectTo()`: checks if two rails can link
- `countPotentialConnections()`: counts nearby rails
- `place()`: finalizes the rail's direction and powered state

Constants:
- `DIR_FLAT_Z = 0`, `DIR_FLAT_X = 1`: Flat rail directions
- `RAIL_DATA_BIT = 8`: Used by powered/detector rails
- `RAIL_DIRECTION_MASK = 7`: Direction bits

`DetectorRailTile` extends `RailTile` and emits a redstone signal when a minecart rolls over it.

### Stair Tile

`StairTile` is interesting because it delegates most of its behavior to a `base` tile. When you create stairs from cobblestone, the stair tile wraps the cobblestone tile and forwards calls like `getTexture()`, `getExplosionResistance()`, and `tick()` to it.

Constants:
- `UPSIDEDOWN_BIT = 4`: Metadata flag for upside-down stairs
- `DIR_EAST = 0`, `DIR_WEST = 1`, `DIR_SOUTH = 2`, `DIR_NORTH = 3`

The stair shape is built from multiple AABBs using `setBaseShape()`, `setStepShape()`, and `setInnerPieceShape()`. Dead space columns (`DEAD_SPACES[8][2]`) define which parts of the cube to remove.

### Slab System

`HalfSlabTile` manages both single and double slabs:
- `TYPE_MASK = 7`: Lower 3 bits store slab type
- `TOP_SLOT_BIT = 8`: Whether placed on top half
- `fullSize`: Whether this is the double-slab variant

`getPlacedOnFaceDataValue()` determines whether to place on top or bottom based on where the player clicked. `StoneSlabTile` and `WoodSlabTile` extend it with type-specific textures and names.

### Skull System

`SkullTile` has a hard limit: `MAX_SKULL_TILES = 40` per world. Data bits:
- `PLACEMENT_MASK = 0x7`: Placement direction
- `NO_DROP_BIT = 0x8`: Suppress drops (used when wither spawns)

The `checkMobSpawn()` method checks if placing a wither skull completes a wither pattern and spawns the Wither boss.

## TileEntity System

`TileEntity` is the base class for blocks that need persistent data beyond the 4-bit metadata. It's stored separately from the block grid and can hold complex state.

```cpp
class TileEntity : public enable_shared_from_this<TileEntity> {
    Level *level;
    int x, y, z;
    int data;
    Tile *tile;
    bool remove;
    unsigned char renderRemoveStage;  // 4J added

    virtual void load(CompoundTag *tag);
    virtual void save(CompoundTag *tag);
    virtual void tick();
    virtual shared_ptr<Packet> getUpdatePacket();
    virtual void triggerEvent(int b0, int b1);
    virtual void clearCache();
    virtual shared_ptr<TileEntity> clone() = 0;  // 4J addition
};
```

4J added the `clone()` pure virtual method so tile entities can be deep-copied (needed for their chunk caching system). They also added `RenderRemoveStage` for managing tile entity removal during rendering.

The `EntityTile` base class connects tiles to tile entities:

```cpp
class EntityTile : public Tile {
    virtual void onPlace(Level *level, int x, int y, int z);     // Creates the TileEntity
    virtual void onRemove(Level *level, int x, int y, int z, ...); // Removes it
    virtual shared_ptr<TileEntity> newTileEntity(Level *level) = 0; // Factory method
    virtual void triggerEvent(Level *level, int x, int y, int z, int b0, int b1);
};
```

### TileEntity Types in LCEMP

| TileEntity Class | Used By | Stores |
|-----------------|---------|--------|
| `ChestTileEntity` | Chest, Ender Chest | Inventory items (implements Container) |
| `FurnaceTileEntity` | Furnace | Smelting items, fuel, cook time (implements Container) |
| `DispenserTileEntity` | Dispenser | Inventory items (implements Container) |
| `BrewingStandTileEntity` | Brewing Stand | Potions, ingredient, brew time (implements Container) |
| `MobSpawnerTileEntity` | Mob Spawner | Mob type, spawn delay, range |
| `SignTileEntity` | Sign (standing + wall) | 4 lines of text |
| `MusicTileEntity` | Note Block | Note pitch |
| `SkullTileEntity` | Skull/Head | Skull type, rotation |
| `EnderChestTileEntity` | Ender Chest | Shared inventory |
| `TheEndPortalTileEntity` | End Portal | (minimal state) |
| `RecordPlayerTile::Entity` | Jukebox | Record item ID |

## TileItem System

When tiles become items in inventory, they use `TileItem`:

```cpp
class TileItem : public Item {
    int tileId;
    virtual bool useOn(...);  // Place tile in world
};
```

Specialized TileItem variants:
| Class | Used For |
|-------|----------|
| `ClothTileItem` | Wool (16 colors) |
| `TreeTileItem` | Logs (4 wood types) |
| `MultiTextureTileItem` | Sandstone, quartz variants |
| `StoneSlabTileItem` | Slabs that combine |
| `SaplingTileItem` | 4 sapling types |
| `LeafTileItem` | 4 leaf types |
| `PistonTileItem` | Sticky vs normal |
| `ColoredTileItem` | Tall grass variants, lily pads |
| `AuxDataTileItem` | Generic metadata-based variants |
| `SmoothStoneBrickTileItem` | Stone brick variants |
| `StoneMonsterTileItem` | Silverfish stone variants |
| `AnvilTileItem` | Anvil damage states (extends MultiTextureTileItem) |
| `WaterLilyTileItem` | Lily pad placement (extends ColoredTileItem) |

## Block Data (Metadata)

Most tiles store 4 bits of metadata (0-15). Here are the common uses:

| Usage | Example Tiles |
|-------|--------------|
| Rotation (0-3) | Stairs, repeaters, logs, pistons |
| Growth stage (0-7) | Wheat, carrots, potatoes |
| Color (0-15) | Wool, carpet |
| Open/closed flag | Doors, trapdoors, fence gates |
| Powered flag | Repeaters, lamps, rails |
| Facing direction | Dispensers, furnaces, chests |
| Damage state | Anvils (0-2) |
| Water level | Cauldrons (0-3) |
| Leaf type + flags | Leaves (bits 0-1=type, bit 2=persistent, bit 3=update) |
| Slab position | Half slabs (bits 0-2=type, bit 3=top) |
| Power level (0-15) | Redstone dust |
| Wire state | Tripwire (bits 0-1=dir, bit 2=attached, bit 3=powered) |

## MinecraftConsoles Differences

MC fills in many of the unassigned tile IDs that are empty in LCEMP. Here's what gets added:

| ID | Name | Class | Notes |
|----|------|-------|-------|
| 95 | stained_glass | `StainedGlassBlock` | Replaces the locked chest (April Fools joke). 16 colors. |
| 137 | command_block | `CommandBlock` | Indestructible, 6M explosion resistance |
| 138 | beacon | `BeaconTile` | Full light emission, tile entity |
| 146 | trapped_chest | -- | Trapped chest (emits redstone) |
| 147 | weightedPlate_light | `WeightedPressurePlateTile` | Gold pressure plate, analog signal |
| 148 | weightedPlate_heavy | `WeightedPressurePlateTile` | Iron pressure plate, analog signal |
| 149 | comparator_off | `ComparatorTile` | Redstone comparator (off state) |
| 150 | comparator_on | `ComparatorTile` | Redstone comparator (on state), light=10 |
| 151 | daylightDetector | `DaylightDetectorTile` | Outputs signal based on sunlight |
| 152 | redstoneBlock | -- | Block of redstone |
| 154 | hopper | `HopperTile` | Item transport, tile entity |
| 155 | quartzBlock | `QuartzBlockTile` | Already in LCEMP at this ID |
| 157 | activatorRail | `PoweredRailTile` | Activator rail |
| 158 | dropper | `DropperTile` | Like a dispenser but just drops items |
| 159 | stained_clay | `ColoredTile` | Stained hardened clay, 16 colors |
| 160 | stained_glass_pane | `StainedGlassPaneBlock` | Stained glass pane, 16 colors |
| 170 | hayBlock | `HayBlockTile` | Hay bale, rotatable pillar |
| 172 | hardened_clay | `Tile` | Plain hardened clay block |

MC also adds a `ColoredTile` base class that handles blocks with 16 color variants (wool, stained clay, stained glass). In LCEMP, wool uses `ClothTile` instead.

The `BasePressurePlateTile` and `BaseRailTile` classes are new in MC, providing shared base functionality that LCEMP handles directly in `PressurePlateTile` and `RailTile`.

The `BaseEntityTile` class is another MC addition that provides a shared base for tile entity blocks. LCEMP uses `EntityTile` in its hierarchy instead.

MC also adds `RepeaterTile` and `ComparatorTile` as separate source files. In LCEMP, the repeater logic lives entirely in `DiodeTile`.
