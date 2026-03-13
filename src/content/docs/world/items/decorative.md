---
title: Decorative & Placement Items
description: Paintings, item frames, signs, buckets, dyes, maps, books, beds, and other placeable items.
---

## HangingEntityItem (Paintings & Item Frames)

**Files:** `Minecraft.World/HangingEntityItem.h`, `Minecraft.World/HangingEntityItem.cpp`

Places hanging entities on walls. Two variants exist:

| Item | ID | Entity |
|------|----|--------|
| Painting | 321 | `Painting` |
| Item Frame | 389 | `ItemFrame` |

## SignItem

**Files:** `Minecraft.World/SignItem.h`, `Minecraft.World/SignItem.cpp`

Places a sign tile entity. ID: **323**.

## BedItem

**Files:** `Minecraft.World/BedItem.h`, `Minecraft.World/BedItem.cpp`

Places a bed on the ground. ID: **355**.

## BucketItem

**Files:** `Minecraft.World/BucketItem.h`, `Minecraft.World/BucketItem.cpp`

| Item | ID | Notes |
|------|----|-------|
| Empty Bucket | 325 | Stack size 16 |
| Water Bucket | 326 | Stack size 1 |
| Lava Bucket | 327 | Stack size 1 |

## MilkBucketItem

**Files:** `Minecraft.World/MilkBucketItem.h`, `Minecraft.World/MilkBucketItem.cpp`

Clears all mob effects when consumed. Crafting remainder is an empty bucket. ID: **335**.

## DyePowderItem

**Files:** `Minecraft.World/DyePowderItem.h`, `Minecraft.World/DyePowderItem.cpp`

16 dye colors differentiated by `auxValue`. ID: **351**.

## MapItem

**Files:** `Minecraft.World/MapItem.h`, `Minecraft.World/MapItem.cpp`

Extends `ComplexItem` (which sets `isComplex() = true` for special network handling). Maps are 128x128 pixels. Map data is stored in `MapItemSavedData` and updated via `getUpdatePacket()`. ID: **358**.

## BookItem

**Files:** `Minecraft.World/BookItem.h`, `Minecraft.World/BookItem.cpp`

Used in enchanting table recipe. ID: **340**.

## DoorItem

**Files:** `Minecraft.World/DoorItem.h`, `Minecraft.World/DoorItem.cpp`

| Item | ID |
|------|----|
| Wood Door | 324 |
| Iron Door | 330 |

## Other Placeable Items

| Item Class | Item | ID | Notes |
|------------|------|----|-------|
| `FlintAndSteelItem` | Flint and Steel | 259 | Places fire on block face; durability based |
| `TilePlanterItem` | String | 287 | Places tripwire |
| `TilePlanterItem` | Sugar Cane | 338 | Places sugar cane tile |
| `TilePlanterItem` | Cake | 354 | Places cake tile |
| `TilePlanterItem` | Redstone Repeater | 356 | Places diode tile |
| `TilePlanterItem` | Brewing Stand | 379 | Places brewing stand tile |
| `TilePlanterItem` | Cauldron | 380 | Places cauldron tile |
| `TilePlanterItem` | Flower Pot | 390 | Places flower pot tile |
| `SkullItem` | Skull | 397 | Multiple skull types via aux value |
| `BoatItem` | Boat | 333 | Places boat entity |
| `MinecartItem` | Minecart | 328 | Places minecart entity |
| `MinecartItem` | Chest Minecart | 342 | Minecart with chest |
| `MinecartItem` | Furnace Minecart | 343 | Minecart with furnace |

## Decorative Item ID Summary

| ID | Item | Type |
|----|------|------|
| 259 | Flint and Steel | FlintAndSteelItem |
| 281 | Bowl | Item |
| 287 | String | TilePlanterItem |
| 321 | Painting | HangingEntityItem |
| 323 | Sign | SignItem |
| 324 | Wood Door | DoorItem |
| 325 | Empty Bucket | BucketItem |
| 326 | Water Bucket | BucketItem |
| 327 | Lava Bucket | BucketItem |
| 328 | Minecart | MinecartItem |
| 330 | Iron Door | DoorItem |
| 333 | Boat | BoatItem |
| 335 | Milk | MilkBucketItem |
| 338 | Sugar Cane | TilePlanterItem |
| 340 | Book | BookItem |
| 342 | Chest Minecart | MinecartItem |
| 343 | Furnace Minecart | MinecartItem |
| 345 | Compass | CompassItem |
| 347 | Clock | ClockItem |
| 351 | Dye | DyePowderItem |
| 354 | Cake | TilePlanterItem |
| 355 | Bed | BedItem |
| 356 | Redstone Repeater | TilePlanterItem |
| 358 | Map | MapItem |
| 379 | Brewing Stand | TilePlanterItem |
| 380 | Cauldron | TilePlanterItem |
| 389 | Item Frame | HangingEntityItem |
| 390 | Flower Pot | TilePlanterItem |
| 397 | Skull | SkullItem |
