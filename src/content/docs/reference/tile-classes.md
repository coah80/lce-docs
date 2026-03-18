---
title: Tile Class Index
description: Index of all Tile (block) subclasses in LCE.
---

In LCE, blocks are called "Tiles." Every block type is a subclass of `Tile` (defined in `Minecraft.World/Tile.h`). Some tiles inherit from intermediate base classes that share common behavior.

## Inheritance Hierarchy (LCEMP)

```
Tile
 +-- Bush
 |    +-- CropTile
 |    |    +-- CarrotTile
 |    |    +-- PotatoTile
 |    +-- DeadBushTile
 |    +-- Mushroom
 |    +-- NetherStalkTile
 |    +-- Sapling
 |    +-- StemTile
 |    +-- TallGrass
 |    +-- WaterlilyTile
 +-- DirectionalTile
 |    +-- BedTile
 |    +-- CocoaTile
 |    +-- DiodeTile
 |    +-- FenceGateTile
 |    +-- PumpkinTile
 +-- EntityTile
 |    +-- BrewingStandTile
 |    +-- ChestTile
 |    +-- DispenserTile
 |    +-- EnchantmentTableTile
 |    +-- EnderChestTile
 |    +-- FurnaceTile
 |    +-- MobSpawnerTile
 |    +-- MusicTile
 |    +-- PistonMovingPiece
 |    +-- RecordPlayerTile
 |    +-- SignTile
 |    +-- SkullTile
 |    +-- TheEndPortal
 +-- HalfSlabTile
 |    +-- StoneSlabTile
 |    +-- WoodSlabTile
 +-- HalfTransparentTile
 |    +-- CoralTile
 |    +-- GlassTile
 |    +-- IceTile
 |    +-- PortalTile
 +-- HeavyTile
 |    +-- AnvilTile
 |    +-- GravelTile
 +-- StoneTile
 |    +-- ObsidianTile
 +-- TorchTile
 |    +-- NotGateTile
 +-- TransparentTile
 |    +-- LeafTile
 +-- (direct Tile subclasses -- see table below)
```

## Changes in MinecraftConsoles

The MinecraftConsoles repo refactored several parts of the tile hierarchy:

```
Tile
 +-- BaseEntityTile (NEW - replaces some EntityTile usage)
 |    +-- BeaconTile (NEW)
 |    +-- DaylightDetectorTile (NEW)
 |    +-- EnchantmentTableTile (moved from EntityTile)
 |    +-- HopperTile (NEW)
 |    +-- NoteBlockTile (replaces MusicTile)
 +-- BaseRailTile (NEW - replaces RailTile as parent)
 |    +-- DetectorRailTile (moved from RailTile)
 |    +-- PoweredRailTile (NEW - replaces RailTile for powered/activator)
 |    +-- RailTile (now extends BaseRailTile)
 +-- BasePressurePlateTile (NEW)
 |    +-- PressurePlateTile
 |    +-- WeightedPressurePlateTile (NEW)
 +-- ColoredTile (NEW - replaces ClothTile)
 +-- ComparatorTile (NEW - extends DiodeTile + EntityTile)
 +-- DiodeTile -> RepeaterTile (renamed)
 +-- DropperTile (NEW)
 +-- HayBlockTile (NEW)
 +-- JukeboxTile (replaces RecordPlayerTile)
 +-- NetherrackTile (replaces HellStoneTile)
 +-- NetherWartTile (replaces NetherStalkTile)
 +-- PoweredMetalTile (NEW)
 +-- RotatedPillarTile (NEW)
 |    +-- TreeTile (moved from direct Tile subclass)
 +-- SoulSandTile (replaces HellSandTile)
 +-- StoneButtonTile (NEW - extends ButtonTile)
 +-- WoodButtonTile (NEW - extends ButtonTile)
```

## Complete Tile Class Table (LCEMP)

| Class | Parent | Header File | Block(s) Implemented |
|-------|--------|-------------|---------------------|
| `AirTile` | `Tile` | AirTile.h | Air (ID 0) |
| `AnvilTile` | `HeavyTile` | AnvilTile.h | Anvil |
| `BedTile` | `DirectionalTile` | BedTile.h | Bed |
| `BookshelfTile` | `Tile` | BookshelfTile.h | Bookshelf |
| `BrewingStandTile` | `EntityTile` | BrewingStandTile.h | Brewing Stand |
| `ButtonTile` | `Tile` | ButtonTile.h | Stone Button, Wood Button |
| `CactusTile` | `Tile` | CactusTile.h | Cactus |
| `CakeTile` | `Tile` | CakeTile.h | Cake |
| `CarrotTile` | `CropTile` | CarrotTile.h | Carrots |
| `CauldronTile` | `Tile` | CauldronTile.h | Cauldron |
| `ChestTile` | `EntityTile` | ChestTile.h | Chest, Trapped Chest |
| `ClayTile` | `Tile` | ClayTile.h | Clay Block |
| `ClothTile` | `Tile` | ClothTile.h | Wool (all colors) |
| `CocoaTile` | `DirectionalTile` | CocoaTile.h | Cocoa Pods |
| `CoralTile` | `HalfTransparentTile` | CoralTile.h | Coral blocks |
| `CropTile` | `Bush` | CropTile.h | Wheat |
| `DeadBushTile` | `Bush` | DeadBushTile.h | Dead Bush |
| `DetectorRailTile` | `RailTile` | DetectorRailTile.h | Detector Rail |
| `DiodeTile` | `DirectionalTile` | DiodeTile.h | Redstone Repeater (on/off) |
| `DirectionalTile` | `Tile` | DirectionalTile.h | Base class for directional blocks |
| `DirtTile` | `Tile` | DirtTile.h | Dirt |
| `DispenserTile` | `EntityTile` | DispenserTile.h | Dispenser, Dropper |
| `DoorTile` | `Tile` | DoorTile.h | Wooden Door, Iron Door |
| `EggTile` | `Tile` | EggTile.h | Dragon Egg |
| `EnchantmentTableTile` | `EntityTile` | EnchantmentTableTile.h | Enchanting Table |
| `EnderChestTile` | `EntityTile` | EnderChestTile.h | Ender Chest |
| `EntityTile` | `Tile` | EntityTile.h | Base class for blocks with tile entities |
| `FarmTile` | `Tile` | FarmTile.h | Farmland |
| `FenceGateTile` | `DirectionalTile` | FenceGateTile.h | Fence Gate |
| `FenceTile` | `Tile` | FenceTile.h | Fence, Nether Brick Fence |
| `FireTile` | `Tile` | FireTile.h | Fire |
| `FlowerPotTile` | `Tile` | FlowerPotTile.h | Flower Pot |
| `FurnaceTile` | `EntityTile` | FurnaceTile.h | Furnace (lit/unlit) |
| `GlassTile` | `HalfTransparentTile` | GlassTile.h | Glass |
| `GrassTile` | `Tile` | GrassTile.h | Grass Block |
| `GravelTile` | `HeavyTile` | GravelTile.h | Gravel |
| `HalfSlabTile` | `Tile` | HalfSlabTile.h | Base class for slab blocks |
| `HalfTransparentTile` | `Tile` | HalfTransparentTile.h | Base class for semi-transparent blocks |
| `HeavyTile` | `Tile` | HeavyTile.h | Base class for gravity-affected blocks |
| `HellSandTile` | `Tile` | HellSandTile.h | Soul Sand |
| `HellStoneTile` | `Tile` | HellStoneTile.h | Netherrack |
| `HugeMushroomTile` | `Tile` | HugeMushroomTile.h | Huge Brown / Red Mushroom |
| `IceTile` | `HalfTransparentTile` | IceTile.h | Ice |
| `LadderTile` | `Tile` | LadderTile.h | Ladder |
| `LeafTile` | `TransparentTile` | LeafTile.h | Leaves (all tree types) |
| `LeverTile` | `Tile` | LeverTile.h | Lever |
| `LightGemTile` | `Tile` | LightGemTile.h | Glowstone |
| `LiquidTile` | `Tile` | LiquidTile.h | Water, Lava (base class) |
| `LockedChestTile` | `Tile` | LockedChestTile.h | Locked Chest (unused / April Fools) |
| `MelonTile` | `Tile` | MelonTile.h | Melon Block |
| `MetalTile` | `Tile` | MetalTile.h | Iron Block, Gold Block, Diamond Block, Emerald Block, Lapis Block |
| `MobSpawnerTile` | `EntityTile` | MobSpawnerTile.h | Monster Spawner |
| `Mushroom` | `Bush` | Mushroom.h | Small Mushrooms (IDs 39, 40) |
| `MusicTile` | `EntityTile` | MusicTile.h | Note Block |
| `MycelTile` | `Tile` | MycelTile.h | Mycelium |
| `NetherStalkTile` | `Bush` | NetherStalkTile.h | Nether Wart |
| `NotGateTile` | `TorchTile` | NotGateTile.h | Redstone Torch (on/off) |
| `ObsidianTile` | `StoneTile` | ObsidianTile.h | Obsidian |
| `OreTile` | `Tile` | OreTile.h | Coal Ore, Iron Ore, Gold Ore, Diamond Ore, Lapis Ore, Emerald Ore |
| `PistonBaseTile` | `Tile` | PistonBaseTile.h | Piston, Sticky Piston |
| `PistonExtensionTile` | `Tile` | PistonExtensionTile.h | Piston Extension (arm) |
| `PistonMovingPiece` | `EntityTile` | PistonMovingPiece.h | Moving Piston Piece (ID 36) |
| `PortalTile` | `HalfTransparentTile` | PortalTile.h | Nether Portal |
| `PotatoTile` | `CropTile` | PotatoTile.h | Potatoes |
| `PressurePlateTile` | `Tile` | PressurePlateTile.h | Stone Pressure Plate, Wooden Pressure Plate |
| `PumpkinTile` | `DirectionalTile` | PumpkinTile.h | Pumpkin, Jack o'Lantern |
| `QuartzBlockTile` | `Tile` | QuartzBlockTile.h | Block of Quartz (variants) |
| `RailTile` | `Tile` | RailTile.h | Rail, Powered Rail, Activator Rail |
| `RecordPlayerTile` | `EntityTile` | RecordPlayerTile.h | Jukebox |
| `RedlightTile` | `Tile` | RedlightTile.h | Redstone Lamp (on/off) |
| `RedStoneDustTile` | `Tile` | RedStoneDustTile.h | Redstone Wire |
| `RedStoneOreTile` | `Tile` | RedStoneOreTile.h | Redstone Ore (lit/unlit) |
| `ReedTile` | `Tile` | ReedTile.h | Sugar Cane |
| `SandStoneTile` | `Tile` | SandStoneTile.h | Sandstone (variants) |
| `Sapling` | `Bush` | Sapling.h | Oak/Spruce/Birch/Jungle Saplings (ID 6) |
| `SignTile` | `EntityTile` | SignTile.h | Sign (standing / wall) |
| `SkullTile` | `EntityTile` | SkullTile.h | Mob Head / Skull |
| `SmoothStoneBrickTile` | `Tile` | SmoothStoneBrickTile.h | Stone Bricks (variants) |
| `SnowTile` | `Tile` | SnowTile.h | Snow Block |
| `Sponge` | `Tile` | Sponge.h | Sponge (ID 19) |
| `SpringTile` | `Tile` | SpringTile.h | Spring / water source block |
| `StairTile` | `Tile` | StairTile.h | All stair variants |
| `StemTile` | `Bush` | StemTile.h | Pumpkin Stem, Melon Stem |
| `StoneMonsterTile` | `Tile` | StoneMonsterTile.h | Silverfish Stone (infested blocks) |
| `StoneSlabTile` | `HalfSlabTile` | StoneSlabTile.h | Stone slabs (all variants) |
| `StoneTile` | `Tile` | StoneTile.h | Stone (ID 1) |
| `TallGrass` | `Bush` | TallGrass.h | Tall Grass/Fern (ID 31) |
| `TheEndPortal` | `EntityTile` | TheEndPortal.h | End Portal (ID 119) |
| `TheEndPortalFrameTile` | `Tile` | TheEndPortalFrameTile.h | End Portal Frame |
| `ThinFenceTile` | `Tile` | ThinFenceTile.h | Glass Pane, Iron Bars |
| `TntTile` | `Tile` | TntTile.h | TNT |
| `TopSnowTile` | `Tile` | TopSnowTile.h | Snow Layer |
| `TorchTile` | `Tile` | TorchTile.h | Torch |
| `TransparentTile` | `Tile` | TransparentTile.h | Base class for non-solid transparent blocks |
| `TrapDoorTile` | `Tile` | TrapDoorTile.h | Trapdoor |
| `TreeTile` | `Tile` | TreeTile.h | Wood / Log (all tree types) |
| `TripWireSourceTile` | `Tile` | TripWireSourceTile.h | Tripwire Hook |
| `TripWireTile` | `Tile` | TripWireTile.h | Tripwire (string) |
| `VineTile` | `Tile` | VineTile.h | Vines |
| `WallTile` | `Tile` | WallTile.h | Cobblestone Wall, Mossy Wall |
| `WaterlilyTile` | `Bush` | WaterLilyTile.h | Lily Pad |
| `WebTile` | `Tile` | WebTile.h | Cobweb |
| `WoodSlabTile` | `HalfSlabTile` | WoodSlabTile.h | Wooden slabs (all variants) |
| `WoodTile` | `Tile` | WoodTile.h | Planks (all wood types) |
| `WoolCarpetTile` | `Tile` | WoolCarpetTile.h | Carpet (all colors) |
| `WorkbenchTile` | `Tile` | WorkbenchTile.h | Crafting Table |

**Total: 106 Tile classes** (including 8 abstract base classes)

## New Tile Classes (MinecraftConsoles)

These classes exist in the MinecraftConsoles repo but not in the LCEMP repo:

| Class | Parent | Block(s) Implemented |
|-------|--------|---------------------|
| `BaseEntityTile` | `Tile` | Abstract base for newer tile entity blocks |
| `BaseRailTile` | `Tile` | Abstract base for rail blocks |
| `BasePressurePlateTile` | `Tile` | Abstract base for pressure plates |
| `BeaconTile` | `BaseEntityTile` | Beacon |
| `ColoredTile` | `Tile` | Wool, Stained Clay (replaces `ClothTile`) |
| `ComparatorTile` | `DiodeTile` + `EntityTile` | Redstone Comparator (on/off) |
| `DaylightDetectorTile` | `BaseEntityTile` | Daylight Sensor |
| `DropperTile` | *(from DispenserTile)* | Dropper |
| `HayBlockTile` | `Tile` | Hay Bale |
| `HopperTile` | `BaseEntityTile` | Hopper |
| `JukeboxTile` | *(replaces RecordPlayerTile)* | Jukebox |
| `NetherrackTile` | `Tile` | Netherrack (replaces `HellStoneTile`) |
| `NetherWartTile` | `Bush` | Nether Wart (replaces `NetherStalkTile`) |
| `NoteBlockTile` | `BaseEntityTile` | Note Block (replaces `MusicTile`) |
| `PoweredMetalTile` | `Tile` | Block of Redstone |
| `PoweredRailTile` | `BaseRailTile` | Powered Rail, Activator Rail |
| `RepeaterTile` | `DirectionalTile` | Redstone Repeater (renamed from `DiodeTile`) |
| `RotatedPillarTile` | `Tile` | Abstract base for pillar blocks (logs, hay) |
| `SoulSandTile` | `Tile` | Soul Sand (replaces `HellSandTile`) |
| `StoneButtonTile` | `ButtonTile` | Stone Button |
| `WeightedPressurePlateTile` | `BasePressurePlateTile` | Weighted Pressure Plate (light/heavy) |
| `WoodButtonTile` | `ButtonTile` | Wooden Button |

**Total in MinecraftConsoles: ~127 Tile classes** (including ~12 abstract base classes)

## Notes

- `Bush` is declared in `Bush.h` / `Bush.cpp` and is a Tile subclass for plant-type blocks. It doesn't follow the `*Tile.h` naming convention.
- `LiquidTile` has two concrete subclasses (`LiquidTileDynamic` and `LiquidTileStatic`) defined in their own `.cpp` files, and they do have separate headers (`LiquidTileDynamic.h` and `LiquidTileStatic.h`).
- `FallingTile` (in `FallingTile.h`) extends `Entity`, not `Tile`. It's the falling-block entity (sand, gravel in motion), not a block type.
- The `Tile` base class itself is defined in `Tile.h` / `Tile.cpp` and holds the static tile registry (all block IDs are registered there).
- Related tile items (like `ClothTileItem`, `StoneSlabTileItem`, `TreeTileItem`) handle aux-data variants and live in separate files.
- In MinecraftConsoles, `TreeTile` extends `RotatedPillarTile` instead of `Tile` directly, which handles the log rotation based on placement axis.
- `ComparatorTile` has dual inheritance from both `DiodeTile` and `EntityTile` because it needs repeater-like directional behavior plus a tile entity for storing signal strength.

**Source directory:** `Minecraft.World/`
