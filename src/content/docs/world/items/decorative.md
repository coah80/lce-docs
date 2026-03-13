---
title: Decorative & Placement Items
description: Paintings, item frames, signs, beds, buckets, dyes, maps, and books. Items that place entities or blocks in the world.
---

These items create entities or blocks when you use them on surfaces. They span a bunch of different classes.

## HangingEntityItem (Paintings & Item Frames)

**Files:** `Minecraft.World/HangingEntityItem.h`, `Minecraft.World/HangingEntityItem.cpp`

| Item | ID | Entity Type | Material |
|------|----|------------|----------|
| Painting | 321 | `eTYPE_PAINTING` | `eBaseItemType_HangingItem`, `eMaterial_cloth` |
| Item Frame | 389 | `eTYPE_ITEM_FRAME` | `eBaseItemType_HangingItem`, `eMaterial_glass` |

`HangingEntityItem` places a `HangingEntity` on a wall when used on a block face. It only works on side faces (top and bottom are rejected, meaning `Facing::DOWN` and `Facing::UP` won't work).

The `createEntity` method picks what to create based on entity type:
- `eTYPE_PAINTING` creates a `Painting` and calls `PaintingPostConstructor` to find a valid art size for the available wall space
- `eTYPE_ITEM_FRAME` creates an `ItemFrame`

The entity only gets added on the server side. If the server can't add the entity (limit reached), the player sees an `IDS_MAX_HANGINGENTITIES` message. When placement works, it awards a `blocksPlaced` statistic and decreases the item count.

## SignItem

**Files:** `Minecraft.World/SignItem.h`, `Minecraft.World/SignItem.cpp`

| Property | Value |
|----------|-------|
| ID | 323 |
| Stack Size | 16 |
| Base Item Type | `eBaseItemType_HangingItem` |
| Material | `eMaterial_wood` |

Places a sign tile on a block face. Wall signs go on side faces; standing signs go on the top face with rotation based on which way the player is facing. Creates a `SignTileEntity` to store the text.

## BedItem

**Files:** `Minecraft.World/BedItem.h`, `Minecraft.World/BedItem.cpp`

| Property | Value |
|----------|-------|
| ID | 355 |
| Stack Size | 1 |

Places a two-block bed oriented based on the player's facing direction. The bed takes up the target position (foot) and the block next to it (head). Both spots need to be empty and sitting on solid ground.

## BucketItem

**Files:** `Minecraft.World/BucketItem.h`, `Minecraft.World/BucketItem.cpp`

| Item | ID | Content | Base Type | Material |
|------|----|---------|-----------|----------|
| Empty Bucket | 325 | 0 (air) | `eBaseItemType_utensil` | `eMaterial_water` |
| Water Bucket | 326 | `Tile::water_Id` | - | - |
| Lava Bucket | 327 | `Tile::lava_Id` | - | - |

Each `BucketItem` is created with a `content` tile ID. Empty buckets stack to 16 (set explicitly via `setMaxStackSize(16)`); filled buckets stack to 1 (the default). Both water and lava buckets have their crafting remainder set to `Item::bucket_empty`. Right-click with an empty bucket on a water or lava source to pick it up. Right-click with a filled bucket to place the liquid at the target position through `emptyBucket()`.

## MilkBucketItem

**Files:** `Minecraft.World/MilkBucketItem.h`, `Minecraft.World/MilkBucketItem.cpp`

| Property | Value |
|----------|-------|
| ID | 335 |
| Stack Size | 1 |
| Drink Duration | 32 ticks (`(int)(20 * 1.6)`) |
| Use Animation | `UseAnim_drink` |
| Crafting Remainder | Empty Bucket |

Clears all mob effects when you drink it through `useTimeDepleted`. The crafting remaining item is set to the empty bucket.

## DyePowderItem (Dyes)

**Files:** `Minecraft.World/DyePowderItem.h`, `Minecraft.World/DyePowderItem.cpp`

| Property | Value |
|----------|-------|
| ID | 351 |
| Variants | 16 (via aux value) |
| Stacked By Data | Yes |
| Base Item Type | `eBaseItemType_dyepowder` |
| Material | `eMaterial_dye` |

Uses `auxValue` 0-15 to represent 16 dye colors. Each color has its own texture (`COLOR_TEXTURES`), description ID (`COLOR_DESCS`), use description ID (`COLOR_USE_DESCS`), and RGB value (`COLOR_RGB`). The constant `DYE_POWDER_ITEM_TEXTURE_COUNT = 16` defines how many icon textures get registered.

| Aux | Constant | Color | Texture | RGB |
|-----|----------|-------|---------|-----|
| 0 | `BLACK` | Black | `dyePowder_black` | `0x1e1b1b` |
| 1 | `RED` | Red | `dyePowder_red` | `0xb3312c` |
| 2 | `GREEN` | Green | `dyePowder_green` | `0x3b511a` |
| 3 | `BROWN` | Brown | `dyePowder_brown` | `0x51301a` |
| 4 | `BLUE` | Blue (Lapis) | `dyePowder_blue` | `0x253192` |
| 5 | `PURPLE` | Purple | `dyePowder_purple` | `0x7b2fbe` |
| 6 | `CYAN` | Cyan | `dyePowder_cyan` | `0xababab` |
| 7 | `SILVER` | Silver (Light Gray) | `dyePowder_silver` | `0x287697` |
| 8 | `GRAY` | Gray | `dyePowder_gray` | `0x434343` |
| 9 | `PINK` | Pink | `dyePowder_pink` | `0xd88198` |
| 10 | `LIME` | Lime | `dyePowder_lime` | `0x41cd34` |
| 11 | `YELLOW` | Yellow | `dyePowder_yellow` | `0xdecf2a` |
| 12 | `LIGHT_BLUE` | Light Blue | `dyePowder_lightBlue` | `0x6689d3` |
| 13 | `MAGENTA` | Magenta | `dyePowder_magenta` | `0xc354cd` |
| 14 | `ORANGE` | Orange | `dyePowder_orange` | `0xeb8844` |
| 15 | `WHITE` | White (Bone Meal) | `dyePowder_white` | `0xf0f0f0` |

Aux value 15 (bone meal / `WHITE`) has special `useOn` behavior. It applies bone meal growth to a bunch of different tiles: saplings, crops, mushrooms, pumpkin/melon stems, carrots, potatoes, cocoa, and grass blocks. On grass blocks, it scatters tall grass, flowers, and roses in a 128-attempt loop.

Aux value 3 (`BROWN`) also has special `useOn` behavior: it plants cocoa beans on jungle tree trunks (side faces only).

Aux value 4 (lapis lazuli) is used for enchanting. The `interactEnemy` method lets you dye sheep by right-clicking them. It converts the dye aux value to a tile-based color using `ClothTile::getTileDataForItemAuxValue`.

## MapItem

**Files:** `Minecraft.World/MapItem.h`, `Minecraft.World/MapItem.cpp`

| Property | Value |
|----------|-------|
| ID | 358 |
| Image Size | 128 x 128 (`IMAGE_WIDTH` x `IMAGE_HEIGHT`) |
| Base Class | `ComplexItem` |
| Base Item Type | `eBaseItemType_pockettool` |
| Material | `eMaterial_map` |

Extends `ComplexItem` (which sets `isComplex() = true` for special network handling). Map data is stored in `MapItemSavedData` and synced to clients through `getUpdatePacket()`. The `inventoryTick` method updates map data each tick while the map is in a player's inventory.

Maps get created through `onCraftedBy`, which sets up the saved data with the player's current position and dimension.

## BookItem

**Files:** `Minecraft.World/BookItem.h`, `Minecraft.World/BookItem.cpp`

| Property | Value |
|----------|-------|
| ID | 340 |
| Enchantability | 1 |
| Enchantable | Yes (when stack count is 1) |

A plain book used as a crafting ingredient for bookshelves and the enchanting table recipe. You can enchant it at an enchanting table (which converts it to an enchanted book). The `isEnchantable` method returns `true` only when `itemInstance->count == 1`.

## DoorItem

**Files:** `Minecraft.World/DoorItem.h`, `Minecraft.World/DoorItem.cpp`

| Item | ID | Door Material | Base Type | Material |
|------|----|--------------|-----------|----------|
| Wood Door | 324 | `Material::wood` | `eBaseItemType_door` | `eMaterial_wood` |
| Iron Door | 330 | `Material::metal` | `eBaseItemType_door` | `eMaterial_iron` |

Places a two-block-tall door tile. The constructor takes the door's `Material` to determine what door type to place. Wood doors can be opened by hand; iron doors need redstone.

## SkullItem

**Files:** `Minecraft.World/SkullItem.h`, `Minecraft.World/SkullItem.cpp`

| Property | Value |
|----------|-------|
| ID | 397 |
| Variants | 5 (`SKULL_COUNT`) |
| Stacked By Data | Yes |

Uses `auxValue` 0-4 to represent five skull types:

| Aux | Type | Icon Name | Description ID |
|-----|------|-----------|----------------|
| 0 | Skeleton | `skull_skeleton` | `IDS_ITEM_SKULL_SKELETON` |
| 1 | Wither Skeleton | `skull_wither` | `IDS_ITEM_SKULL_WITHER` |
| 2 | Zombie | `skull_zombie` | `IDS_ITEM_SKULL_ZOMBIE` |
| 3 | Character (Player) | `skull_char` | `IDS_ITEM_SKULL_CHARACTER` |
| 4 | Creeper | `skull_creeper` | `IDS_ITEM_SKULL_CREEPER` |

Places a `SkullTile` and `SkullTileEntity` on the target block. Can't be placed on the bottom face (`face == 0` returns false). If placed on the top face, the skull rotation is based on the player's Y rotation (16 possible rotations). The `SkullTileEntity` stores the skull type and an optional `SkullOwner` NBT tag for player heads. After placing a wither skull, `SkullTile::checkMobSpawn` checks if the Wither boss should be summoned.

## Other Placement Items

| Item | ID | Class | Target Tile | Notes |
|------|----|-------|-------------|-------|
| Cake | 354 | `TilePlanterItem` | `Tile::cake` | Stack size 64 (4J changed from 1, Jens approved 23/10/12) |
| Redstone Repeater | 356 | `TilePlanterItem` | `Tile::diode_off` | Places unpowered diode tile |
| Flower Pot | 390 | `TilePlanterItem` | `Tile::flowerPot` | Places flower pot tile |
| Brewing Stand | 379 | `TilePlanterItem` | `Tile::brewingStand` | `eBaseItemType_device`, `eMaterial_blaze` |
| Cauldron | 380 | `TilePlanterItem` | `Tile::cauldron` | `eBaseItemType_utensil`, `eMaterial_iron` |
| String | 287 | `TilePlanterItem` | `Tile::tripWire` | Places tripwire when used on a block |
| Sugar Cane | 338 | `TilePlanterItem` | `Tile::reeds` | Places reed tile on sand/dirt near water |

`TilePlanterItem` is a general-purpose class that places a given tile when used on a block face. Each instance is created with the target tile ID.

## MinecraftConsoles differences

MinecraftConsoles adds a bunch of new decorative/placement items:

### New items

- **`NameTagItem`** (ID 421) lets you name mobs by right-clicking them. Uses `interactEnemy` to apply the item stack's custom name to the target entity. It only works if the item has a custom hover name (`hasCustomHoverName()`) and the target is a `Mob`. Calls `setCustomName` and `setPersistenceRequired` on the mob, then consumes the stack.
- **`LeashItem`** (ID 420, `eBaseItemType_pockettool`) attaches leashed mobs to fence posts. The `useOn` method only works on tiles with `SHAPE_FENCE` render shape. It calls `bindPlayerMobs` to find all mobs within a 7-block range that are leashed to the player and ties them to a `LeashFenceKnotEntity` at the clicked position. If no knot exists yet, `LeashFenceKnotEntity::createAndAddKnot` creates one. There's also a `bindPlayerMobsTest` method that checks if the interaction would work without doing it (for tooltip display).
- **`EmptyMapItem`** (ID 395) is split out from `MapItem` as a separate class. It extends `ComplexItem` and creates a fresh map when you right-click. In LCEMP, the empty map and filled map are both handled by `MapItem`. MinecraftConsoles also adds `MapCloningRecipe` and `MapExtendingRecipe` as dedicated recipe classes.
- **`WrittenBookItem`** adds signed/written book support with title (max 16 chars via `TITLE_LENGTH`), author, and pages (max 50 pages via `MAX_PAGES`, 256 chars each via `PAGE_LENGTH`). Uses NBT tags `TAG_TITLE`, `TAG_AUTHOR`, and `TAG_PAGES`. Though in the source it's only present as commented-out Java pseudocode, it shows the intended structure. Always shows the foil effect.
- **Comparator** (ID 404) is a new `TilePlanterItem` that places `Tile::comparator_off`.

### Horse equipment

The new horse armor items are plain `Item` instances with stack size 1:

| Item | ID | Icon Name |
|------|----|-----------|
| Iron Horse Armor | 417 | `iron_horse_armor` |
| Gold Horse Armor | 418 | `gold_horse_armor` |
| Diamond Horse Armor | 419 | `diamond_horse_armor` |

These work with the `EntityHorse` entity through the `HorseInventoryMenu`. The horse inventory has slots for saddle (slot 0), armor (slot 1), and optionally 15 chest slots for donkeys/mules with chests.

### Leash fence knot entity

`LeashFenceKnotEntity` is added as a new hanging entity type for the visual knot that appears when you tie a leash to a fence. It has its own `LeashKnotModel` and `LeashKnotRenderer`. The static method `findKnotAt` looks for an existing knot at a position before creating a new one.
