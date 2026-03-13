---
title: Decorative & Placement Items
description: Paintings, item frames, signs, beds, buckets, dyes, maps, and books. Items that place entities or blocks in the world.
---

These items create entities or blocks when you use them on surfaces. They span a bunch of different classes.

## HangingEntityItem (Paintings & Item Frames)

**Files:** `Minecraft.World/HangingEntityItem.h`, `Minecraft.World/HangingEntityItem.cpp`

| Item | ID | Entity Type |
|------|----|------------|
| Painting | 321 | `eTYPE_PAINTING` |
| Item Frame | 389 | `eTYPE_ITEM_FRAME` |

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

| Item | ID | Content |
|------|----|---------|
| Empty Bucket | 325 | 0 (air) |
| Water Bucket | 326 | Water tile ID |
| Lava Bucket | 327 | Lava tile ID |

Each `BucketItem` is created with a `content` tile ID. Empty buckets stack to 16; filled buckets stack to 1. Right-click with an empty bucket on a water or lava source to pick it up. Right-click with a filled bucket to place the liquid at the target position through `emptyBucket()`.

## MilkBucketItem

**Files:** `Minecraft.World/MilkBucketItem.h`, `Minecraft.World/MilkBucketItem.cpp`

| Property | Value |
|----------|-------|
| ID | 335 |
| Stack Size | 1 |
| Crafting Remainder | Empty Bucket |

Clears all mob effects when you drink it. The crafting remaining item is set to the empty bucket.

## DyePowderItem (Dyes)

**Files:** `Minecraft.World/DyePowderItem.h`, `Minecraft.World/DyePowderItem.cpp`

| Property | Value |
|----------|-------|
| ID | 351 |
| Variants | 16 (via aux value) |
| Stacked By Data | Yes |

Uses `auxValue` 0-15 to represent 16 dye colors. Each color has its own texture (`COLOR_TEXTURES`), description ID (`COLOR_DESCS`), and RGB value (`COLOR_RGB`). Here are all 16 color constants:

| Aux | Color | Aux | Color |
|-----|-------|-----|-------|
| 0 | Black | 8 | Gray |
| 1 | Red | 9 | Pink |
| 2 | Green | 10 | Lime |
| 3 | Brown | 11 | Yellow |
| 4 | Blue (Lapis) | 12 | Light Blue |
| 5 | Purple | 13 | Magenta |
| 6 | Cyan | 14 | Orange |
| 7 | Silver (Light Gray) | 15 | White (Bone Meal) |

Aux value 15 (bone meal / white dye) has special `useOn` behavior that applies bone meal growth to crops and saplings. Aux value 4 (lapis lazuli) is used for enchanting. The `interactEnemy` method lets you dye sheep by right-clicking them.

## MapItem

**Files:** `Minecraft.World/MapItem.h`, `Minecraft.World/MapItem.cpp`

| Property | Value |
|----------|-------|
| ID | 358 |
| Image Size | 128 x 128 pixels |
| Base Class | `ComplexItem` |

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

| Item | ID |
|------|----|
| Wood Door | 324 |
| Iron Door | 330 |

Places a two-block-tall door tile. Wood doors can be opened by hand; iron doors need redstone.

## SkullItem

**Files:** `Minecraft.World/SkullItem.h`, `Minecraft.World/SkullItem.cpp`

| Property | Value |
|----------|-------|
| ID | 397 |
| Variants | 5 (via aux value) |
| Stacked By Data | Yes |

Uses `auxValue` 0-4 to represent five skull types. Each one has its own icon (`ICON_NAMES`) and description string (`NAMES`). Places a `SkullTile` and `SkullTileEntity` on the target block.

## Other Placement Items

| Item | ID | Class | Notes |
|------|----|-------|-------|
| Cake | 354 | `TilePlanterItem` | Places cake tile, stack size 64 (4J changed from 1, Jens approved) |
| Redstone Repeater | 356 | `TilePlanterItem` | Places diode tile |
| Flower Pot | 390 | `TilePlanterItem` | Places flower pot tile |
| Brewing Stand | 379 | `TilePlanterItem` | Places brewing stand tile |
| Cauldron | 380 | `TilePlanterItem` | Places cauldron tile |
| String | 287 | `TilePlanterItem` | Places tripwire when used on a block |
| Sugar Cane | 338 | `TilePlanterItem` | Places reed tile on sand/dirt near water |

`TilePlanterItem` is a general-purpose class that places a given tile when used on a block face. Each instance is created with the target tile ID.
