---
title: Blocks (Tiles)
description: Complete documentation of the tile/block system in Minecraft.World.
---

The block system in LCE is built around the `Tile` base class. All blocks are called "tiles" internally. There are approximately **176 tile types** registered in a static array of 4,096 slots.

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
| `_isTicking` | `bool` | Has regular tick() updates |
| `_isEntityTile` | `bool` | Has associated TileEntity |
| `material` | `Material*` | Physical material properties |
| `soundType` | `const SoundType*` | Sound effects |
| `friction` | `float` | Surface friction coefficient |
| `gravity` | `float` | Gravity effect on entities |
| `xx0, yy0, zz0, xx1, yy1, zz1` | `double` | Bounding box coordinates |

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

## Sound Types

Pre-defined sound types used by tiles:

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

Each `SoundType` contains: `eMaterialSound`, break/step/place sound IDs, `volume`, and `pitch`.

## Render Shapes

Every tile has a render shape that determines how it's drawn:

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

## Complete Tile ID Registry

All tiles are statically initialized in `Tile::staticCtor()`:

| ID | Internal Name | Class | Destroy Time | Notes |
|----|--------------|-------|-------------|-------|
| 1 | rock | `StoneTile` | 1.5s | Stone, drops cobblestone |
| 2 | grass | `GrassTile` | 0.6s | Biome-colored, spreads to dirt |
| 3 | dirt | `DirtTile` | 0.5s | Basic soil |
| 4 | stoneBrick | `Tile` | 2.0s | Cobblestone |
| 5 | wood | `WoodTile` | 2.0s | Planks, 4 wood type variants |
| 6 | sapling | `Sapling` | 0.0s | 4 tree types, grows into trees |
| 7 | unbreakable | `Tile` | -1.0 | Bedrock, indestructible |
| 8 | water | `LiquidTileDynamic` | — | Flowing water |
| 9 | calmWater | `LiquidTileStatic` | — | Still water |
| 10 | lava | `LiquidTileDynamic` | — | Flowing lava, emits light |
| 11 | calmLava | `LiquidTileStatic` | — | Still lava, emits light |
| 12 | sand | `HeavyTile` | 0.5s | Falls with gravity |
| 13 | gravel | `GravelTile` | 0.6s | Falls, chance to drop flint |
| 14 | goldOre | `OreTile` | 3.0s | Gold ore |
| 15 | ironOre | `OreTile` | 3.0s | Iron ore |
| 16 | coalOre | `OreTile` | 3.0s | Coal ore |
| 17 | treeTrunk | `TreeTile` | 2.0s | Logs, 4 wood types, rotatable |
| 18 | leaves | `LeafTile` | 0.2s | 4 types, decay system |
| 19 | sponge | `Sponge` | 0.6s | Absorbs water |
| 20 | glass | `GlassTile` | 0.3s | Transparent, no drop |
| 21 | lapisOre | `OreTile` | 3.0s | Lapis lazuli ore |
| 22 | lapisBlock | `Tile` | 3.0s | Lapis block |
| 23 | dispenser | `DispenserTile` | 3.5s | TileEntity, 6 facing dirs |
| 24 | sandStone | `SandStoneTile` | 0.8s | 3 variants |
| 25 | musicBlock | `MusicTile` | 0.8s | Note block, TileEntity |
| 26 | bed | `BedTile` | 0.2s | 2-block, head/foot |
| 27 | goldenRail | `RailTile` | 0.7s | Powered rail |
| 28 | detectorRail | `DetectorRailTile` | 0.7s | Emits signal on entity |
| 29 | pistonStickyBase | `PistonBaseTile` | — | Sticky piston |
| 30 | web | `WebTile` | 4.0s | Slows entities |
| 31 | tallgrass | `TallGrass` | 0.0s | 3 types: shrub/grass/fern |
| 32 | deadBush | `DeadBushTile` | 0.0s | Drops sticks |
| 33 | pistonBase | `PistonBaseTile` | — | Normal piston |
| 34 | pistonExtension | `PistonExtensionTile` | — | Piston arm |
| 35 | cloth | `ClothTile` | 0.8s | Wool, 16 colors |
| 36 | pistonMovingPiece | `PistonMovingPiece` | — | Dynamic piston head |
| 37 | flower | `Bush` | 0.0s | Dandelion |
| 38 | rose | `Bush` | 0.0s | Poppy |
| 39 | mushroom1 | `Mushroom` | 0.0s | Brown mushroom, light=1 |
| 40 | mushroom2 | `Mushroom` | 0.0s | Red mushroom |
| 41 | goldBlock | `MetalTile` | 3.0s | Gold block |
| 42 | ironBlock | `MetalTile` | 5.0s | Iron block |
| 43 | stoneSlab | `StoneSlabTile` | — | Double stone slab |
| 44 | stoneSlabHalf | `StoneSlabTile` | — | Stone half slab |
| 45 | redBrick | `Tile` | 2.0s | Bricks |
| 46 | tnt | `TntTile` | 0.0s | Explodes on redstone |
| 47 | bookshelf | `BookshelfTile` | 1.5s | Drops books |
| 48 | mossStone | `Tile` | 2.0s | Mossy cobblestone |
| 49 | obsidian | `ObsidianTile` | 50.0s | Very hard |
| 50 | torch | `TorchTile` | — | Light level 14 |
| 51 | fire | `FireTile` | — | Spreads, animates |
| 52 | mobSpawner | `MobSpawnerTile` | 5.0s | TileEntity, spawns mobs |
| 53 | stairs_wood | `StairTile` | — | Oak wood stairs |
| 54 | chest | `ChestTile` | 2.5s | TileEntity, can double |
| 55 | redStoneDust | `RedStoneDustTile` | — | Signal wire, power 0-15 |
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
| 67 | stairs_stone | `StairTile` | — | Stone stairs |
| 68 | wallSign | `SignTile` | 1.0s | Wall sign, TileEntity |
| 69 | lever | `LeverTile` | 0.5s | 6 orientations, redstone |
| 70 | pressurePlate_stone | `PressurePlateTile` | 0.5s | Mobs only |
| 71 | door_iron | `DoorTile` | 5.0s | Iron door, needs redstone |
| 72 | pressurePlate_wood | `PressurePlateTile` | 0.5s | All entities |
| 73 | redStoneOre | `RedStoneOreTile` | 3.0s | Emits particles |
| 74 | redStoneOre_lit | `RedStoneOreTile` | 3.0s | Glowing, light=9 |
| 75 | notGate_off | `NotGateTile` | — | Redstone torch off |
| 76 | notGate_on | `NotGateTile` | — | Redstone torch on, light=7 |
| 77 | button | `ButtonTile` | 0.5s | Stone button |
| 78 | topSnow | `TopSnowTile` | 0.1s | Snow layer |
| 79 | ice | `IceTile` | 0.5s | Slippery, transparent |
| 80 | snow | `SnowTile` | 0.2s | Snow block |
| 81 | cactus | `CactusTile` | 0.4s | Damages entities, grows |
| 82 | clay | `ClayTile` | 0.6s | Drops clay balls |
| 83 | reeds | `ReedTile` | 0.0s | Sugar cane, grows to 3 |
| 84 | recordPlayer | `RecordPlayerTile` | 2.0s | Jukebox, TileEntity |
| 85 | fence | `FenceTile` | 2.0s | Oak fence |
| 86 | pumpkin | `PumpkinTile` | 1.0s | Rotatable |
| 87 | hellRock | `HellStoneTile` | 0.4s | Netherrack |
| 88 | hellSand | `HellSandTile` | 0.5s | Soul sand, slows entities |
| 89 | lightGem | `LightGemTile` | 0.3s | Glowstone, light=15 |
| 90 | portalTile | `PortalTile` | -1.0 | Nether portal, light=11 |
| 91 | litPumpkin | `PumpkinTile` | 1.0s | Jack o'Lantern, light=15 |
| 92 | cake | `CakeTile` | 0.5s | 6 eating stages |
| 93 | diode_off | `DiodeTile` | — | Repeater off, 4 delays |
| 94 | diode_on | `DiodeTile` | — | Repeater on, 4 delays |
| 95 | aprilFoolsJoke | `LockedChestTile` | — | Locked chest, light emitting |
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
| 107 | fenceGate | `FenceGateTile` | 2.0s | Rotatable |
| 108 | stairs_bricks | `StairTile` | — | Brick stairs |
| 109 | stairs_stoneBrickSmooth | `StairTile` | — | Stone brick stairs |
| 110 | mycel | `MycelTile` | 0.6s | Mycelium |
| 111 | waterLily | `WaterlilyTile` | 0.0s | Lily pad |
| 112 | netherBrick | `Tile` | 2.0s | Nether brick block |
| 113 | netherFence | `FenceTile` | 2.0s | Nether brick fence |
| 114 | stairs_netherBricks | `StairTile` | — | Nether brick stairs |
| 115 | netherStalk | `NetherStalkTile` | 0.0s | Nether wart, 4 stages |
| 116 | enchantTable | `EnchantmentTableTile` | 5.0s | TileEntity |
| 117 | brewingStand | `BrewingStandTile` | 0.5s | TileEntity, light=1 |
| 118 | cauldron | `CauldronTile` | 2.0s | Water storage |
| 119 | endPortalTile | `TheEndPortal` | -1.0 | End portal |
| 120 | endPortalFrameTile | `TheEndPortalFrameTile` | -1.0 | End portal frame, light=1 |
| 121 | whiteStone | `Tile` | 3.0s | End stone |
| 122 | dragonEgg | `EggTile` | 3.0s | Teleports when hit, light=1 |
| 123 | redstoneLight | `RedlightTile` | 0.3s | Redstone lamp off |
| 124 | redstoneLight_lit | `RedlightTile` | 0.3s | Redstone lamp on |
| 125 | woodSlab | `WoodSlabTile` | — | Double wood slab |
| 126 | woodSlabHalf | `WoodSlabTile` | — | Wood half slab |
| 127 | cocoa | `CocoaTile` | 0.2s | Cocoa beans, 3 stages |
| 128 | stairs_sandstone | `StairTile` | — | Sandstone stairs |
| 129 | emeraldOre | `OreTile` | 3.0s | Emerald ore |
| 130 | enderChest | `EnderChestTile` | 22.5s | TileEntity, light=7 |
| 131 | tripWireSource | `TripWireSourceTile` | — | Tripwire hook |
| 132 | tripWire | `TripWireTile` | — | Tripwire line |
| 133 | emeraldBlock | `MetalTile` | 5.0s | Emerald block |
| 134 | woodStairsDark | `StairTile` | — | Spruce stairs |
| 135 | woodStairsBirch | `StairTile` | — | Birch stairs |
| 136 | woodStairsJungle | `StairTile` | — | Jungle stairs |
| 139 | cobbleWall | `WallTile` | — | Stone/cobble wall |
| 140 | flowerPot | `FlowerPotTile` | 0.0s | Holds plants |
| 141 | carrots | `CarrotTile` | 0.0s | 8 growth stages |
| 142 | potatoes | `PotatoTile` | 0.0s | 8 growth stages |
| 143 | button_wood | `ButtonTile` | 0.5s | Wood button |
| 144 | skull | `SkullTile` | 1.0s | Mob heads |
| 145 | anvil | `AnvilTile` | 5.0s | 3 damage states, falls |
| 153 | netherQuartz | `OreTile` | 3.0s | Nether quartz ore |
| 155 | quartzBlock | `QuartzBlockTile` | 0.8s | Quartz, variants |
| 156 | stairs_quartz | `StairTile` | — | Quartz stairs |
| 171 | woolCarpet | `WoolCarpetTile` | 0.1s | 16 colors |

:::note[Gaps in IDs]
IDs 137-138, 146-152, 154, 157-170 are unassigned in this version. These may correspond to blocks added in later LCE updates.
:::

## Class Hierarchy

```
Tile (abstract base)
├── TransparentTile
│   ├── LeafTile
│   └── HalfTransparentTile
│       └── PortalTile
├── HeavyTile (falling blocks)
│   ├── AnvilTile
│   └── GravelTile
├── EntityTile (has TileEntity)
│   ├── ChestTile
│   ├── FurnaceTile
│   ├── SignTile
│   ├── MobSpawnerTile
│   ├── EnchantmentTableTile
│   ├── BrewingStandTile
│   ├── DispenserTile
│   └── EnderChestTile
├── LiquidTile
│   ├── LiquidTileDynamic
│   └── LiquidTileStatic
├── Bush (plants)
│   ├── CropTile (wheat)
│   ├── CarrotTile
│   ├── PotatoTile
│   ├── StemTile (pumpkin/melon)
│   └── NetherStalkTile
├── FireTile
├── RedStoneDustTile
├── RailTile / DetectorRailTile
├── FenceTile
├── StairTile
├── PistonBaseTile
├── TorchTile / NotGateTile
├── DoorTile / TrapDoorTile
├── PressurePlateTile
├── LeverTile / ButtonTile
├── CactusTile / VineTile
├── HalfSlabTile
│   ├── StoneSlabTile
│   └── WoodSlabTile
├── ThinFenceTile (iron bars, glass pane)
├── WallTile
└── ... (many more specialized tiles)
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

### Pre-defined Materials

| Material | Solid | Liquid | Flammable | Replaceable | Push Reaction |
|----------|-------|--------|-----------|-------------|---------------|
| `air` | No | No | No | Yes | — |
| `stone` | Yes | No | No | No | Push |
| `dirt` | Yes | No | No | No | Push |
| `grass` | Yes | No | No | No | Push |
| `wood` | Yes | No | Yes | No | Push |
| `metal` | Yes | No | No | No | Push |
| `heavyMetal` | Yes | No | No | No | Block |
| `water` | No | Yes | No | Yes | — |
| `lava` | No | Yes | No | Yes | — |
| `leaves` | Yes | No | Yes | No | Destroy |
| `plant` | No | No | No | No | Destroy |
| `replaceable_plant` | No | No | No | Yes | Destroy |
| `cloth` | Yes | No | Yes | No | Push |
| `fire` | No | No | No | Yes | Destroy |
| `sand` | Yes | No | No | No | Push |
| `glass` | Yes | No | No | No | Push |
| `explosive` | Yes | No | Yes | No | Push |
| `ice` | Yes | No | No | No | Push |
| `snow` | Yes | No | No | No | Push |
| `topSnow` | No | No | No | Yes | Destroy |
| `cactus` | Yes | No | No | No | Destroy |
| `clay` | Yes | No | No | No | Push |
| `portal` | No | No | No | No | Block |
| `cake` | Yes | No | No | No | Destroy |
| `sponge` | Yes | No | No | No | Push |
| `decoration` | No | No | No | No | Destroy |
| `clothDecoration` | No | No | Yes | No | Push |
| `buildable_glass` | Yes | No | No | No | Push |
| `coral` | Yes | No | No | No | Destroy |
| `vegetable` | Yes | No | No | No | Destroy |
| `egg` | Yes | No | No | No | Destroy |
| `web` | Yes | No | No | No | Destroy |
| `piston` | Yes | No | No | No | Block |

## Key Virtual Methods

### Rendering

```cpp
virtual Icon *getTexture(int face, int data);       // Texture per face & metadata
virtual bool shouldRenderFace(...);                  // Skip hidden faces
virtual bool isSolidRender(bool isServerLevel);      // Needs solid rendering?
virtual int getRenderLayer();                        // 0=solid, 1=cutout, 2=transparent
virtual int getRenderShape();                        // Which shape to draw
virtual int getColor(LevelSource*, int x, int y, int z);  // Tint color (biomes)
```

### Destruction & Drops

```cpp
virtual float getDestroySpeed(Level*, int x, int y, int z);
virtual float getDestroyProgress(shared_ptr<Player>, Level*, int x, int y, int z);
virtual int getResource(int data, Random*, int fortuneLevel);       // Item ID to drop
virtual int getResourceCount(Random*);                               // How many
virtual int getResourceCountForLootBonus(int fortune, Random*);      // Fortune bonus
virtual void spawnResources(Level*, int x, int y, int z, int data, float odds, int fortune);
virtual bool isSilkTouchable();                                      // Silk Touch works?
virtual shared_ptr<ItemInstance> getSilkTouchItemInstance(int data);  // Silk Touch drop
```

### Tick & Updates

```cpp
virtual void tick(Level*, int x, int y, int z, Random*);            // Regular updates
virtual void animateTick(Level*, int x, int y, int z, Random*);     // Client-side particles
virtual void neighborChanged(Level*, int x, int y, int z, int type); // Adjacent block changed
virtual int getTickDelay();                                           // Tick frequency
```

### Interaction

```cpp
virtual bool use(Level*, int x, int y, int z, shared_ptr<Player>, int face, ...);  // Right-click
virtual void attack(Level*, int x, int y, int z, shared_ptr<Player>);              // Left-click
virtual void stepOn(Level*, int x, int y, int z, shared_ptr<Entity>);              // Walked on
virtual void fallOn(Level*, int x, int y, int z, shared_ptr<Entity>, float dist);  // Fell on
virtual void entityInside(Level*, int x, int y, int z, shared_ptr<Entity>);        // Inside block
```

### Placement

```cpp
virtual bool mayPlace(Level*, int x, int y, int z);                           // Can place here?
virtual bool canSurvive(Level*, int x, int y, int z);                         // Can exist here?
virtual void onPlace(Level*, int x, int y, int z);                            // Just placed
virtual void onRemove(Level*, int x, int y, int z, int id, int data);         // Being removed
virtual int getPlacedOnFaceDataValue(Level*, ..., int face, float cx, cy, cz); // Metadata from placement
```

### Redstone

```cpp
virtual bool isSignalSource();                                          // Emits redstone?
virtual bool getSignal(LevelSource*, int x, int y, int z, int dir);    // Signal strength
virtual bool getDirectSignal(Level*, int x, int y, int z, int dir);    // Direct power
```

### Physics

```cpp
virtual float getExplosionResistance(shared_ptr<Entity> source);
virtual void wasExploded(Level*, int x, int y, int z);
virtual int getPistonPushReaction();  // 0=push, 1=destroy, 2=block
virtual void handleEntityInside(Level*, ..., shared_ptr<Entity>, Vec3 *velocity);
```

## Behavior Deep Dives

### Fire Spread System

`FireTile` maintains two arrays indexed by tile ID:

| Array | Purpose |
|-------|---------|
| `flameOdds[]` | How easily each block catches fire |
| `burnOdds[]` | How fast each block burns away |

Fire difficulty affects spread rate with constants like `FLAME_INSTANT`, `FLAME_EASY`, `FLAME_MEDIUM`, `FLAME_HARD` and corresponding `BURN_*` values.

### Leaf Decay

`LeafTile` uses bit flags in metadata:
- **Bit 3** (`UPDATE_LEAF_BIT = 8`): Needs decay check
- **Bit 2** (`PERSISTENT_LEAF_BIT = 4`): Player-placed, won't decay

Leaves decay if farther than 4 blocks (`REQUIRED_WOOD_RANGE`) from any log block.

### Crop Growth

`CropTile` growth speed depends on:
- Light level (must be >= `MAX_BRIGHTNESS - 6`)
- Adjacent farmland blocks
- Water hydration of farmland
- Random tick probability

### Liquid Flow

`LiquidTile` (water/lava) handles flow physics:
```cpp
virtual Vec3 *getFlow(LevelSource*, int x, int y, int z);  // Flow direction
virtual void updateLiquid(Level*, int x, int y, int z);     // Spread logic
virtual void fizz(Level*, int x, int y, int z);             // Lava + water = obsidian
virtual int getDepth(Level*, int x, int y, int z);          // Flow level
```

### Piston Mechanics

`PistonBaseTile` can push up to **12 blocks** in a line:
```cpp
bool createPush(Level*, int sx, int sy, int sz, int facing);
static bool canPush(Level*, int sx, int sy, int sz, int facing);
static bool isPushable(int block, Level*, int cx, int cy, int cz, bool allowDestroyable);
```

Cannot push: obsidian, bedrock, tile entities (chests, furnaces, etc.)

### Tripwire System

Max tripwire length: **42 blocks** (`WIRE_DIST_MAX`). `TripWireSourceTile` scans for the paired hook and activates when an entity crosses the wire.

### Redstone Wire

`RedStoneDustTile` stores power level (0-15) in the data value. Power decreases by 1 per block traveled. Signal propagation uses:
```cpp
void updatePowerStrength(Level*, int x, int y, int z);
int checkTarget(Level*, int x, int y, int z, int target);
void checkCornerChangeAt(Level*, int x, int y, int z);
```

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
| `ColoredTileItem` | Tall grass variants |

## Block Data (Metadata)

Most tiles store 4 bits of metadata (0-15). Common uses:

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
