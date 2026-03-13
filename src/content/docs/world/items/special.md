---
title: Special Items
description: Spawn eggs, enchanted books, skulls, flint and steel, saddles, and other items with unique mechanics.
---

These items have unique mechanics that don't really fit into the tool, armor, food, or combat categories.

## MonsterPlacerItem (Spawn Eggs)

**Files:** `Minecraft.World/MonsterPlacerItem.h`, `Minecraft.World/MonsterPlacerItem.cpp`

| Property | Value |
|----------|-------|
| ID | 383 |
| Stack Size | 16 |
| Stacked By Data | Yes |
| Sprite Layers | 2 (base + overlay) |

The `auxValue` determines what mob type gets spawned. The item name is built dynamically by looking up the entity name through `EntityIO::getNameId()` and plugging it into a `{*CREATURE*}` placeholder.

Egg colors come from `EntityIO::idsSpawnableInCreative`, where each spawnable mob entry has `eggColor1` (base) and `eggColor2` (overlay spot color).

Note: The stack size is 16 on LCE (vs. 64 on PC). The source says: *"brought forward. It is 64 on PC, but we'll never be able to place that many."*

### Spawn Limit System

Before spawning anything, the `canSpawn` method checks entity-type-specific population limits. This is an **LCE-specific** addition to keep entity counts from getting out of hand on console hardware.

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

Each failure code shows a localized message to the player (like `IDS_MAX_CHICKENS_SPAWNED`).

The `canSpawn` method dispatches by entity type with a switch:
- `eTYPE_CHICKEN`, `eTYPE_WOLF`, `eTYPE_VILLAGER`, `eTYPE_MUSHROOMCOW`, `eTYPE_SQUID` each have their own checks
- Other animals matching `eTYPE_ANIMALS_SPAWN_LIMIT_CHECK` fall through to the generic passive mob limit
- Monsters matching `eTYPE_MONSTER` check difficulty first (Peaceful rejects hostile mobs) and then check the monster population limit

### Placement Behavior

When used on a block face:
1. Position is offset by the face direction using `Facing::STEP_X/Y/Z`
2. Special case: using on a fence or nether fence adds a 0.5 Y offset
3. `spawnMobAt` creates the entity, sets a random Y rotation, marks it as despawn-protected, and calls `finalizeMobSpawn`
4. In Creative mode, the item isn't consumed
5. In debug mode, using on a mob spawner tile sets the spawner's entity type

### Dispenser Support

The static `canSpawn` method (a 4J addition) lets dispensers use spawn eggs too, running the same population limit checks.

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

Enchantments are stored in NBT under the `StoredEnchantments` tag (separate from the regular `ench` tag that tools and armor use). The `addEnchantment` method either upgrades an existing enchantment's level or adds a new one.

### Key Methods

| Method | Purpose |
|--------|---------|
| `getEnchantments(item)` | Reads the `StoredEnchantments` list tag from NBT |
| `addEnchantment(item, enchant)` | Adds or upgrades an enchantment in the stored list |
| `createForEnchantment(enchant)` | Creates a book with a specific enchantment |
| `createForEnchantment(enchant, items)` | Creates books for all levels of an enchantment |
| `createForRandomLoot(random)` | Picks a random valid enchantment at a random level for dungeon chests |
| `createForRandomTreasure(random)` | Creates a `WeighedTreasure` entry for weighted loot tables |
| `createForRandomTreasure(random, min, max, weight)` | Same but with custom count range and weight |

The tooltip shows all stored enchantments using `Enchantment::getFullname()`.

## FlintAndSteelItem

**Files:** `Minecraft.World/FlintAndSteelItem.h`, `Minecraft.World/FlintAndSteelItem.cpp`

| Property | Value |
|----------|-------|
| ID | 259 |
| Max Durability | 64 |
| Stack Size | 1 |

Places fire on the adjacent block face. If used on air above obsidian, it tries to create a Nether portal through `PortalTile::trySpawnPortal()`. Uses 1 durability each time.

## SaddleItem

**Files:** `Minecraft.World/SaddleItem.h`, `Minecraft.World/SaddleItem.cpp`

| Property | Value |
|----------|-------|
| ID | 329 |
| Stack Size | 1 |

Goes on pigs through `interactEnemy`. Once placed, you can't get it back.

## CarrotOnAStickItem

**Files:** `Minecraft.World/CarrotOnAStickItem.h`, `Minecraft.World/CarrotOnAStickItem.cpp`

| Property | Value |
|----------|-------|
| ID | 398 |
| Max Durability | 25 |
| Stack Size | 1 |

Controls saddled pigs. When you use it while riding a pig, it boosts the pig's speed and costs some durability.

## BottleItem (Glass Bottles)

**Files:** `Minecraft.World/BottleItem.h`, `Minecraft.World/BottleItem.cpp`

| Property | Value |
|----------|-------|
| ID | 374 |
| Stack Size | 64 |

Right-click on a water source block to fill the bottle, turning it into a water bottle (potion with base aux value). This is the starting ingredient for potion brewing.

## MilkBucketItem

**Files:** `Minecraft.World/MilkBucketItem.h`, `Minecraft.World/MilkBucketItem.cpp`

| Property | Value |
|----------|-------|
| ID | 335 |
| Stack Size | 1 |
| Crafting Remainder | Empty Bucket |

Clears all mob effects when you drink it. The crafting remaining item is set to the empty bucket.

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
