---
title: Special Items
description: Spawn eggs, enchanted books, skulls, flint and steel, saddles, and other items with unique mechanics.
---

Special items have unique mechanics that do not fit neatly into the tool, armor, food, or combat categories.

## MonsterPlacerItem (Spawn Eggs)

**Files:** `Minecraft.World/MonsterPlacerItem.h`, `Minecraft.World/MonsterPlacerItem.cpp`

| Property | Value |
|----------|-------|
| ID | 383 |
| Stack Size | 16 |
| Stacked By Data | Yes |
| Sprite Layers | 2 (base + overlay) |

Uses `auxValue` to determine mob type. The item name is dynamically constructed by looking up the entity name via `EntityIO::getNameId()` and inserting it into a `{*CREATURE*}` placeholder.

Egg colors are read from `EntityIO::idsSpawnableInCreative` -- each spawnable mob entry has `eggColor1` (base) and `eggColor2` (overlay spot color).

Note: The stack size is 16 on LCE (vs. 64 on PC), as noted in the source: *"brought forward. It is 64 on PC, but we'll never be able to place that many."*

### Spawn Limit System

Before spawning, the `canSpawn` method checks entity-type-specific population limits. This is a **LCE-specific** addition to prevent excessive entity counts on console hardware.

| Result Code | Meaning |
|-------------|---------|
| `eSpawnResult_OK` | Spawn succeeded |
| `eSpawnResult_FailTooManyPigsCowsSheepCats` | Passive mob limit (pigs, cows, sheep, ocelots) |
| `eSpawnResult_FailTooManyChickens` | Chicken limit |
| `eSpawnResult_FailTooManySquid` | Squid limit |
| `eSpawnResult_FailTooManyWolves` | Wolf limit |
| `eSpawnResult_FailTooManyMooshrooms` | Mooshroom limit |
| `eSpawnResult_FailTooManyAnimals` | Global animal limit |
| `eSpawnResult_FailTooManyMonsters` | Monster limit |
| `eSpawnResult_FailTooManyVillagers` | Villager limit |
| `eSpawnResult_FailCantSpawnInPeaceful` | Hostile mob on Peaceful difficulty |

Each failure code triggers a localized message to the player (e.g., `IDS_MAX_CHICKENS_SPAWNED`).

The `canSpawn` method dispatches by entity type using a switch:
- `eTYPE_CHICKEN`, `eTYPE_WOLF`, `eTYPE_VILLAGER`, `eTYPE_MUSHROOMCOW`, `eTYPE_SQUID` each have dedicated checks
- Other animals matching `eTYPE_ANIMALS_SPAWN_LIMIT_CHECK` fall through to the generic passive mob limit
- Monsters matching `eTYPE_MONSTER` check difficulty (Peaceful rejects hostile mobs) then the monster population limit

### Placement Behavior

When used on a block face:
1. Position is offset by the face direction via `Facing::STEP_X/Y/Z`
2. Special case: using on a fence or nether fence adds a 0.5 Y offset
3. `spawnMobAt` creates the entity, sets a random Y rotation, marks it as despawn-protected, and calls `finalizeMobSpawn`
4. In Creative mode, the item is not consumed
5. In debug mode, using on a mob spawner tile sets the spawner's entity type

### Dispenser Support

The static `canSpawn` method (4J addition) allows dispensers to use spawn eggs, performing the same population limit checks.

## EnchantedBookItem

**Files:** `Minecraft.World/EnchantedBookItem.h`, `Minecraft.World/EnchantedBookItem.cpp`

| Property | Value |
|----------|-------|
| ID | 403 |
| Stack Size | 1 |
| Foil Effect | Always (`isFoil` returns `true`) |
| Enchantable | No (`isEnchantable` returns `false`) |
| NBT Tag | `StoredEnchantments` |
| Rarity | `uncommon` (if has enchantments), `common` (if empty) |

Stores enchantments in NBT under the `StoredEnchantments` tag (separate from the regular `ench` tag used by tools and armor). The `addEnchantment` method either upgrades an existing enchantment's level or appends a new one.

### Key Methods

| Method | Purpose |
|--------|---------|
| `getEnchantments(item)` | Reads the `StoredEnchantments` list tag from NBT |
| `addEnchantment(item, enchant)` | Adds or upgrades an enchantment in the stored list |
| `createForEnchantment(enchant)` | Creates a book with a specific enchantment |
| `createForEnchantment(enchant, items)` | Creates books for all levels of an enchantment |
| `createForRandomLoot(random)` | Picks a random valid enchantment at a random level for dungeon chests |
| `createForRandomTreasure(random)` | Creates a `WeighedTreasure` entry for weighted loot tables |
| `createForRandomTreasure(random, min, max, weight)` | Same with custom count range and weight |

The tooltip displays all stored enchantments using `Enchantment::getFullname()`.

## FlintAndSteelItem

**Files:** `Minecraft.World/FlintAndSteelItem.h`, `Minecraft.World/FlintAndSteelItem.cpp`

| Property | Value |
|----------|-------|
| ID | 259 |
| Max Durability | 64 |
| Stack Size | 1 |

Places fire on the adjacent block face. If used on air above obsidian, attempts to create a Nether portal via `PortalTile::trySpawnPortal()`. Consumes 1 durability per use.

## SaddleItem

**Files:** `Minecraft.World/SaddleItem.h`, `Minecraft.World/SaddleItem.cpp`

| Property | Value |
|----------|-------|
| ID | 329 |
| Stack Size | 1 |

Equips on pigs via `interactEnemy`. Cannot be recovered after placement.

## CarrotOnAStickItem

**Files:** `Minecraft.World/CarrotOnAStickItem.h`, `Minecraft.World/CarrotOnAStickItem.cpp`

| Property | Value |
|----------|-------|
| ID | 398 |
| Max Durability | 25 |
| Stack Size | 1 |

Controls saddled pigs. When used while riding a pig, boosts the pig's speed. Consumes durability on boost.

## BottleItem (Glass Bottles)

**Files:** `Minecraft.World/BottleItem.h`, `Minecraft.World/BottleItem.cpp`

| Property | Value |
|----------|-------|
| ID | 374 |
| Stack Size | 64 |

Right-click on a water source block fills the bottle, converting it into a water bottle (potion with base aux value). Used as the starting ingredient for potion brewing.

## MilkBucketItem

**Files:** `Minecraft.World/MilkBucketItem.h`, `Minecraft.World/MilkBucketItem.cpp`

| Property | Value |
|----------|-------|
| ID | 335 |
| Stack Size | 1 |
| Crafting Remainder | Empty Bucket |

Clears all mob effects when consumed. The crafting remaining item is set to the empty bucket.

## Other Special Items

| Item | ID | Class | Notes |
|------|----|-------|-------|
| Compass | 345 | `CompassItem` | Points toward world spawn; `eBaseItemType_pockettool` |
| Clock | 347 | `ClockItem` | Shows time of day; `eBaseItemType_pockettool` |
| Eye of Ender | 381 | `EnderEyeItem` | Locates strongholds; fills portal frames; `eBaseItemType_pockettool` |
| Boat | 333 | `BoatItem` | Places a boat entity on water |
| Minecart | 328 | `MinecartItem` | Places minecart on rails |
| Chest Minecart | 342 | `MinecartItem` | Minecart with chest |
| Furnace Minecart | 343 | `MinecartItem` | Minecart with furnace |
