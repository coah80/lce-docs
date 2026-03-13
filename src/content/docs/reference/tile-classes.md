---
title: Tile Class Index
description: Index of all Tile (block) subclasses in LCEMP.
---

In LCEMP, blocks are called "Tiles." Every block type is a subclass of `Tile` (defined in `Minecraft.World/Tile.h`). Some tiles inherit from intermediate base classes that share common behavior.

## Inheritance Hierarchy

```
Tile
 +-- Bush
 |    +-- CropTile
 |    |    +-- CarrotTile
 |    |    +-- PotatoTile
 |    +-- DeadBushTile
 |    +-- NetherStalkTile
 |    +-- StemTile
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
 |    +-- RecordPlayerTile
 |    +-- SignTile
 |    +-- SkullTile
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

## Complete Tile Class Table

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
| `MusicTile` | `EntityTile` | MusicTile.h | Note Block |
| `MycelTile` | `Tile` | MycelTile.h | Mycelium |
| `NetherStalkTile` | `Bush` | NetherStalkTile.h | Nether Wart |
| `NotGateTile` | `TorchTile` | NotGateTile.h | Redstone Torch (on/off) |
| `ObsidianTile` | `StoneTile` | ObsidianTile.h | Obsidian |
| `OreTile` | `Tile` | OreTile.h | Coal Ore, Iron Ore, Gold Ore, Diamond Ore, Lapis Ore, Emerald Ore |
| `PistonBaseTile` | `Tile` | PistonBaseTile.h | Piston, Sticky Piston |
| `PistonExtensionTile` | `Tile` | PistonExtensionTile.h | Piston Extension (arm) |
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
| `SignTile` | `EntityTile` | SignTile.h | Sign (standing / wall) |
| `SkullTile` | `EntityTile` | SkullTile.h | Mob Head / Skull |
| `SmoothStoneBrickTile` | `Tile` | SmoothStoneBrickTile.h | Stone Bricks (variants) |
| `SnowTile` | `Tile` | SnowTile.h | Snow Block |
| `SpringTile` | `Tile` | SpringTile.h | Spring / water source block |
| `StairTile` | `Tile` | StairTile.h | All stair variants |
| `StemTile` | `Bush` | StemTile.h | Pumpkin Stem, Melon Stem |
| `StoneMonsterTile` | `Tile` | StoneMonsterTile.h | Silverfish Stone (infested blocks) |
| `StoneSlabTile` | `HalfSlabTile` | StoneSlabTile.h | Stone slabs (all variants) |
| `StoneTile` | `Tile` | StoneTile.h | Stone, Cobblestone, Mossy Cobblestone |
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

**Total: 99 Tile classes** (including 8 abstract base classes)

## Notes

- `Bush` is declared in `Bush.h` / `Bush.cpp` and is a Tile subclass for plant-type blocks. It doesn't follow the `*Tile.h` naming convention.
- `LiquidTile` has two concrete subclasses (`LiquidTileDynamic` and `LiquidTileStatic`) defined in their own files, but they don't have separate `*Tile.h` headers.
- `FallingTile` (in `FallingTile.h`) extends `Entity`, not `Tile`. It's the falling-block entity (sand, gravel in motion), not a block type.
- The `Tile` base class itself is defined in `Tile.h` / `Tile.cpp` and holds the static tile registry (all block IDs are registered there).
- Related tile items (like `ClothTileItem`, `StoneSlabTileItem`, `TreeTileItem`) handle aux-data variants and live in separate files.

**Source directory:** `Minecraft.World/`
