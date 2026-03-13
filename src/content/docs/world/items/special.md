---
title: Special Items
description: Spawn eggs, enchanted books, and other items with unique behaviors in LCE.
---

## MonsterPlacerItem (Spawn Eggs)

**File:** `Minecraft.World/MonsterPlacerItem.h`, `Minecraft.World/MonsterPlacerItem.cpp`

Uses `auxValue` to determine mob type. ID: **383**. Has two sprite layers for the egg's base and overlay colors.

### Spawn Limit Checks

Spawn eggs enforce population limits with detailed failure codes:

| Result | Meaning |
|--------|---------|
| `eSpawnResult_OK` | Spawn succeeded |
| `eSpawnResult_FailTooManyPigsCowsSheepCats` | Passive mob limit |
| `eSpawnResult_FailTooManyChickens` | Chicken limit |
| `eSpawnResult_FailTooManySquid` | Squid limit |
| `eSpawnResult_FailTooManyWolves` | Wolf limit |
| `eSpawnResult_FailTooManyMooshrooms` | Mooshroom limit |
| `eSpawnResult_FailTooManyAnimals` | Global animal limit |
| `eSpawnResult_FailTooManyMonsters` | Monster limit |
| `eSpawnResult_FailTooManyVillagers` | Villager limit |
| `eSpawnResult_FailCantSpawnInPeaceful` | Hostile mob on Peaceful |

The static method `spawnMobAt(Level*, int mobId, double x, double y, double z, int *piResult)` handles the actual spawning with result reporting (the `piResult` parameter was added by 4J Studios). A companion static method `canSpawn(int auxVal, Level*, int *piResult)` is used by dispensers.

## EnchantedBookItem

**File:** `Minecraft.World/EnchantedBookItem.h`, `Minecraft.World/EnchantedBookItem.cpp`

Stores enchantments in NBT under the `StoredEnchantments` tag (separate from regular enchantments). Always has a foil effect (`isFoil` returns true). Stack size is 1. ID: **403**.

Key methods:
- `getEnchantments()` -- reads the `StoredEnchantments` list tag
- `addEnchantment()` -- appends an enchantment to the stored list
- `createForEnchantment()` -- creates a book with a specific enchantment
- `createForRandomLoot()` -- generates a randomly enchanted book for dungeon chests
- `createForRandomTreasure()` -- creates a `WeighedTreasure` entry for loot tables

## CoalItem

**Files:** `Minecraft.World/CoalItem.h`, `Minecraft.World/CoalItem.cpp`

Differentiates Coal (aux 0) and Charcoal (aux 1) via `auxValue`. ID: **263**.

## DyePowderItem

**Files:** `Minecraft.World/DyePowderItem.h`, `Minecraft.World/DyePowderItem.cpp`

16 colors differentiated by `auxValue`. Includes bone meal (aux 15) with special fertilizer behavior. ID: **351**.

## ComplexItem / MapItem

**Files:** `Minecraft.World/ComplexItem.h`, `Minecraft.World/MapItem.h`

`ComplexItem` sets `isComplex() = true` for special network handling. `MapItem` extends it, providing 128x128 pixel maps with data stored in `MapItemSavedData` and updates via `getUpdatePacket()`. ID: **358**.

## Other Special Items

| Item Class | Item | ID | Notes |
|------------|------|----|-------|
| `SaddleItem` | Saddle | 329 | Equips on pigs; stack size 1 |
| `CompassItem` | Compass | 345 | Points toward world spawn |
| `ClockItem` | Clock | 347 | Shows time of day |
| `EnderEyeItem` | Eye of Ender | 381 | Locates strongholds and fills portal frames |
| `CarrotOnAStickItem` | Carrot on a Stick | 398 | Controls saddled pigs |
| `BottleItem` | Glass Bottle | 374 | Collects water for brewing |
