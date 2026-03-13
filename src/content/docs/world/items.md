---
title: Items
description: Complete documentation of the LCEMP item system.
---

The item system in LCE is built around the `Item` base class. All non-block items are registered with numeric IDs starting at **256** (item constructor parameter `id` is offset by +256 internally). The global registry holds up to **32,000** slots.

## Core Architecture

### Item Base Class

**Files:** `Minecraft.World/Item.h`, `Minecraft.World/Item.cpp`

#### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `ITEM_NUM_COUNT` | 32000 | Maximum possible items in the registry |
| `MAX_STACK_SIZE` | 64 | Default max stack size (from `Container::LARGE_MAX_STACK_SIZE`) |
| `ICON_COLUMNS` | 16 | Columns in the item texture atlas |

#### Key Member Variables

| Variable | Type | Access | Purpose |
|----------|------|--------|---------|
| `id` | `const int` | public | Unique item identifier (256 + constructor param) |
| `maxStackSize` | `int` | protected | Maximum number per inventory slot (default 64) |
| `maxDamage` | `int` | private | Maximum durability (0 = indestructible) |
| `icon` | `Icon*` | protected | Texture icon reference |
| `m_iBaseItemType` | `int` | protected | Crafting menu item type classification |
| `m_iMaterial` | `int` | protected | Crafting menu material classification |
| `m_handEquipped` | `bool` | protected | Whether item renders hand-equipped |
| `m_isStackedByData` | `bool` | protected | Whether aux data differentiates stack types |
| `craftingRemainingItem` | `Item*` | private | Item left in crafting grid after use (e.g., empty bucket) |
| `potionBrewingFormula` | `wstring` | private | Potion brewing modifier string |
| `descriptionId` | `unsigned int` | private | Localized name string ID |
| `m_textureName` | `wstring` | private | Texture resource name |

#### Constructor

```cpp
Item::Item(int id) : id(256 + id)
```

The constructor offsets the provided ID by 256 and registers the item into the global `items` array at that index. Default `maxStackSize` is 64, and `maxDamage` is 0. A conflict check prints a debug message if the slot is already occupied.

#### Builder-Pattern Setters

All setter methods return `this` (or `Item*`) to enable chaining:

```cpp
Item *setTextureName(const wstring &name);
Item *setMaxStackSize(int max);
Item *setBaseItemTypeAndMaterial(int iType, int iMaterial);
Item *setMaxDamage(int maxDamage);
Item *setDescriptionId(unsigned int id);
Item *setUseDescriptionId(unsigned int id);
Item *setCraftingRemainingItem(Item *craftingRemainingItem);
Item *setPotionBrewingFormula(const wstring &formula);
Item *setStackedByData(bool isStackedByData);
Item *handEquipped();
```

#### Key Virtual Methods

| Method | Default Behavior | Purpose |
|--------|-----------------|---------|
| `useOn(...)` | Returns `false` | Called when item is used on a block face |
| `use(...)` | Returns the item unchanged | Called on right-click in air |
| `useTimeDepleted(...)` | Returns the item unchanged | Called when use duration finishes (eating, drinking) |
| `getDestroySpeed(...)` | Returns `1.0f` | Mining speed multiplier against a tile |
| `hurtEnemy(...)` | Returns `false` | Called when hitting a mob; returns true if damage was dealt |
| `mineBlock(...)` | Returns `false` | Called when a block is mined with this item |
| `getAttackDamage(...)` | Returns `1` | Base attack damage value |
| `canDestroySpecial(...)` | Returns `false` | Whether this tool can harvest a specific tile |
| `getUseAnimation(...)` | Returns `UseAnim_none` | Animation type when using |
| `getUseDuration(...)` | Returns `0` | How long the use action takes in ticks |
| `releaseUsing(...)` | No-op | Called when use button is released early (bow charging) |
| `isHandEquipped()` | Returns `m_handEquipped` | Render as hand-held tool |
| `isFoil(...)` | Returns `false` | Whether the item has an enchantment glint |
| `getRarity(...)` | Returns `Rarity::common` | Item rarity (affects name color) |
| `isEnchantable(...)` | Returns `false` | Whether item can be enchanted |
| `getEnchantmentValue()` | Returns `0` | Enchantability score |
| `isValidRepairItem(...)` | Returns `false` | Whether the given item can repair this one in an anvil |
| `isComplex()` | Returns `false` | Whether item needs special network sync (maps) |
| `appendHoverText(...)` | No-op | Add lines to the item tooltip |

#### UseAnim Enum

**File:** `Minecraft.World/UseAnim.h`

```cpp
enum UseAnim {
    UseAnim_none,   // No animation
    UseAnim_eat,    // Eating food
    UseAnim_drink,  // Drinking potions
    UseAnim_block,  // Blocking with sword
    UseAnim_bow     // Drawing a bow
};
```

#### Rarity Levels

**File:** `Minecraft.World/Rarity.h`

| Rarity | Usage |
|--------|-------|
| `common` | Most items |
| `uncommon` | Enchanted items |
| `rare` | Golden apples (aux 0) |
| `epic` | Enchanted golden apples (aux > 0), music discs |

### ItemInstance

**Files:** `Minecraft.World/ItemInstance.h`, `Minecraft.World/ItemInstance.cpp`

`ItemInstance` represents a specific stack of items in an inventory or the world. It wraps an `Item` with count, auxiliary data, and NBT tag data.

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `int` | Item ID |
| `count` | `int` | Stack count |
| `auxValue` | `int` | Auxiliary/damage value |
| `tag` | `CompoundTag*` | NBT data (enchantments, display, etc.) |
| `popTime` | `int` | Pickup animation timer |
| `frame` | `shared_ptr<ItemFrame>` | Reference to the item frame holding this item |

Key operations: `copy()`, `hurt()`, `save()`/`load()` for NBT serialization, `enchant()`, `isEnchanted()`, `getHoverName()`, `getRepairCost()`.

## Item Registration System

All items are registered in `Item::staticCtor()` inside `Item.cpp`. The method creates each item via `new`, sets properties through builder-pattern chaining, and the `Item` constructor automatically inserts each item into the global `Item::items` array at index `256 + id`.

```cpp
// Example from staticCtor():
Item::sword_wood = (new WeaponItem(12, _Tier::WOOD))
    ->setBaseItemTypeAndMaterial(eBaseItemType_sword, eMaterial_wood)
    ->setTextureName(L"swordWood")
    ->setDescriptionId(IDS_ITEM_SWORD_WOOD)
    ->setUseDescriptionId(IDS_DESC_SWORD);
```

After `staticCtor()`, `Item::staticInit()` is called separately (after other static constructors like Recipes) which builds item statistics via `Stats::buildItemStats()`.

## Class Hierarchy

```
Item (base class)
  |
  +-- WeaponItem          (swords)
  +-- DiggerItem           (base for mining tools)
  |     +-- PickaxeItem
  |     +-- ShovelItem
  |     +-- HatchetItem    (axes)
  +-- HoeItem
  +-- ArmorItem
  +-- FoodItem
  |     +-- BowlFoodItem       (mushroom stew)
  |     +-- GoldenAppleItem
  |     +-- SeedFoodItem        (carrots, potatoes)
  +-- BowItem
  +-- FishingRodItem
  +-- ShearsItem
  +-- BucketItem
  +-- FlintAndSteelItem
  +-- EnderpearlItem
  +-- PotionItem
  +-- BedItem
  +-- DoorItem
  +-- SignItem
  +-- SeedItem
  +-- TilePlanterItem      (places a tile: cake, redstone repeater, etc.)
  +-- TileItem             (block-as-item wrapper)
  +-- ComplexItem
  |     +-- MapItem
  +-- RecordingItem        (music discs)
  +-- EnchantedBookItem
  +-- MonsterPlacerItem    (spawn eggs)
  +-- BookItem
  +-- BottleItem           (glass bottles)
  +-- CoalItem
  +-- DyePowderItem
  +-- RedStoneItem
  +-- SaddleItem
  +-- SnowballItem
  +-- EggItem
  +-- BoatItem
  +-- MinecartItem
  +-- CompassItem
  +-- ClockItem
  +-- EnderEyeItem
  +-- ExperienceItem       (bottle o' enchanting)
  +-- FireChargeItem
  +-- HangingEntityItem    (paintings, item frames)
  +-- SkullItem
  +-- MilkBucketItem
  +-- CarrotOnAStickItem
```

## Tool System

### Tool Tiers

**Defined in:** `Item::Tier` (nested class in `Item.h`)

Each tier defines mining level, durability, mining speed, attack damage bonus, and enchantability.

```cpp
const Tier *WOOD    = new Tier(0,   59, 2.0f, 0, 15);
const Tier *STONE   = new Tier(1,  131, 4.0f, 1,  5);
const Tier *IRON    = new Tier(2,  250, 6.0f, 2, 14);
const Tier *DIAMOND = new Tier(3, 1561, 8.0f, 3, 10);
const Tier *GOLD    = new Tier(0,   32, 12.0f, 0, 22);
```

| Tier | Level | Durability | Speed | Damage Bonus | Enchantability | Repair Item |
|------|-------|-----------|-------|-------------|----------------|-------------|
| Wood | 0 | 59 | 2.0 | +0 | 15 | Planks (`Tile::wood`) |
| Stone | 1 | 131 | 4.0 | +1 | 5 | Cobblestone (`Tile::stoneBrick`) |
| Iron | 2 | 250 | 6.0 | +2 | 14 | Iron Ingot (265) |
| Diamond | 3 | 1561 | 8.0 | +3 | 10 | Diamond (264) |
| Gold | 0 | 32 | 12.0 | +0 | 22 | Gold Ingot (266) |

Gold has the highest mining speed (12.0) and enchantability (22) but the lowest durability (32) and mining level (0, same as Wood).

### WeaponItem (Swords)

**Files:** `Minecraft.World/WeaponItem.h`, `Minecraft.World/WeaponItem.cpp`

Swords have a base damage of **4 + tier damage bonus**. They use `UseAnim_block` for blocking, with a maximum block duration of one hour (72,000 ticks). Swords cut cobwebs at speed 15.0 and all other blocks at 1.5.

| Sword | ID | Total Damage | Durability |
|-------|----|-------------|------------|
| Wood | 268 | 4 (4+0) | 59 |
| Stone | 272 | 5 (4+1) | 131 |
| Iron | 267 | 6 (4+2) | 250 |
| Diamond | 276 | 7 (4+3) | 1561 |
| Gold | 283 | 4 (4+0) | 32 |

Durability costs: **1 per hit** on enemy, **2 per block mined** (only if block has nonzero destroy speed).

### DiggerItem (Base Mining Tool)

**Files:** `Minecraft.World/DiggerItem.h`, `Minecraft.World/DiggerItem.cpp`

Base class for pickaxes, shovels, and axes. Each subclass defines a list of "diggable" tiles that receive the tier's speed bonus. The attack damage is `baseAttackDamage + tier.getAttackDamageBonus()`.

Durability costs: **2 per hit** on enemy, **1 per block mined** (only if block has nonzero destroy speed).

### PickaxeItem

**Files:** `Minecraft.World/PickaxeItem.h`, `Minecraft.World/PickaxeItem.cpp`

Base attack damage parameter: **2** (total = 2 + tier bonus).

**Diggable tiles (22):** Stone Brick, Stone Slab, Stone Slab Half, Rock, Sandstone, Mossy Cobblestone, Iron Ore, Iron Block, Coal Ore, Gold Block, Gold Ore, Diamond Ore, Diamond Block, Ice, Netherrack, Lapis Ore, Lapis Block, Redstone Ore, Lit Redstone Ore, Rail, Detector Rail, Golden Rail.

Also gets speed bonus on any tile with `Material::metal`, `Material::heavyMetal`, or `Material::stone`.

**Mining level requirements:**

| Block | Min Tier Level |
|-------|---------------|
| Obsidian | 3 (Diamond only) |
| Diamond Ore/Block | 2 (Iron+) |
| Emerald Ore/Block | 2 (Iron+) |
| Gold Ore/Block | 2 (Iron+) |
| Redstone Ore | 2 (Iron+) |
| Iron Ore/Block | 1 (Stone+) |
| Lapis Ore/Block | 1 (Stone+) |
| Any stone material | 0 (Any pickaxe) |
| Any metal/heavy metal | 0 (Any pickaxe) |

### ShovelItem

**Files:** `Minecraft.World/ShovelItem.h`, `Minecraft.World/ShovelItem.cpp`

Base attack damage parameter: **1** (total = 1 + tier bonus).

**Diggable tiles (10):** Grass, Dirt, Sand, Gravel, Top Snow, Snow, Clay, Farmland, Soul Sand, Mycelium.

Can harvest Top Snow and Snow blocks (via `canDestroySpecial`).

### HatchetItem (Axe)

**Files:** `Minecraft.World/HatchetItem.h`, `Minecraft.World/HatchetItem.cpp`

Base attack damage parameter: **3** (total = 3 + tier bonus).

**Diggable tiles (8):** Planks, Bookshelf, Logs, Chest, Stone Slab, Stone Slab Half, Pumpkin, Lit Pumpkin.

Also gets speed bonus on any tile with `Material::wood`.

### HoeItem

**Files:** `Minecraft.World/HoeItem.h`, `Minecraft.World/HoeItem.cpp`

Hoes convert grass and dirt blocks to farmland when used on them (face != 0, air above). They do not have a diggable tile list since they are not mining tools. Durability is set to the tier's uses, and **1 durability** is consumed per use.

| Hoe | ID | Durability |
|-----|----|-----------|
| Wood | 290 | 59 |
| Stone | 291 | 131 |
| Iron | 292 | 250 |
| Diamond | 293 | 1561 |
| Gold | 294 | 32 |

## Armor System

### ArmorMaterial

**Defined in:** `ArmorItem::ArmorMaterial` (nested class in `ArmorItem.h`)

Each material defines a durability multiplier, per-slot defense values, and enchantability.

```cpp
const ArmorMaterial *CLOTH   = new ArmorMaterial( 5, {1,3,2,1}, 15);
const ArmorMaterial *CHAIN   = new ArmorMaterial(15, {2,5,4,1}, 12);
const ArmorMaterial *IRON    = new ArmorMaterial(15, {2,6,5,2},  9);
const ArmorMaterial *GOLD    = new ArmorMaterial( 7, {2,5,3,1}, 25);
const ArmorMaterial *DIAMOND = new ArmorMaterial(33, {3,8,6,3}, 10);
```

### Armor Slots

| Constant | Value |
|----------|-------|
| `SLOT_HEAD` | 0 |
| `SLOT_TORSO` | 1 |
| `SLOT_LEGS` | 2 |
| `SLOT_FEET` | 3 |

### Health Per Slot (Base Durability)

Used to calculate total durability: `healthPerSlot[slot] * durabilityMultiplier`.

| Slot | Base Health |
|------|-------------|
| Helmet | 11 |
| Chestplate | 16 |
| Leggings | 15 |
| Boots | 13 |

### Complete Armor Table

| Piece | ID | Material | Defense | Durability | Enchantability |
|-------|-----|----------|---------|-----------|----------------|
| Leather Helmet | 298 | Cloth | 1 | 55 | 15 |
| Leather Chestplate | 299 | Cloth | 3 | 80 | 15 |
| Leather Leggings | 300 | Cloth | 2 | 75 | 15 |
| Leather Boots | 301 | Cloth | 1 | 65 | 15 |
| Chain Helmet | 302 | Chain | 2 | 165 | 12 |
| Chain Chestplate | 303 | Chain | 5 | 240 | 12 |
| Chain Leggings | 304 | Chain | 4 | 225 | 12 |
| Chain Boots | 305 | Chain | 1 | 195 | 12 |
| Iron Helmet | 306 | Iron | 2 | 165 | 9 |
| Iron Chestplate | 307 | Iron | 6 | 240 | 9 |
| Iron Leggings | 308 | Iron | 5 | 225 | 9 |
| Iron Boots | 309 | Iron | 2 | 195 | 9 |
| Diamond Helmet | 310 | Diamond | 3 | 363 | 10 |
| Diamond Chestplate | 311 | Diamond | 8 | 528 | 10 |
| Diamond Leggings | 312 | Diamond | 6 | 495 | 10 |
| Diamond Boots | 313 | Diamond | 3 | 429 | 10 |
| Gold Helmet | 314 | Gold | 2 | 77 | 25 |
| Gold Chestplate | 315 | Gold | 5 | 112 | 25 |
| Gold Leggings | 316 | Gold | 3 | 105 | 25 |
| Gold Boots | 317 | Gold | 1 | 91 | 25 |

**Total defense by full set:** Leather 7, Chain 12, Iron 15, Gold 11, Diamond 20.

**Repair items:** Leather uses `leather` (334), Chain and Iron use `ironIngot` (265), Gold uses `goldIngot` (266), Diamond uses `diamond` (264).

### Leather Armor Dyeing

Leather armor (`ArmorMaterial::CLOTH`) supports custom colors via NBT. Color data is stored at `tag.display.color` as an integer. The `DEFAULT_LEATHER_COLOR` falls back to `eMinecraftColour_Armour_Default_Leather_Colour`. Leather armor has two sprite layers (base + overlay) to support dyeing.

## Food System

### FoodItem

**Files:** `Minecraft.World/FoodItem.h`, `Minecraft.World/FoodItem.cpp`

Food items restore hunger and saturation when eaten. The eat duration is **32 ticks** (`20 * 1.6`).

#### FoodConstants

**Files:** `Minecraft.World/FoodConstants.h`, `Minecraft.World/FoodConstants.cpp`

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_FOOD` | 20 | Maximum hunger bar |
| `MAX_SATURATION` | 20.0 | Maximum saturation |
| `FOOD_SATURATION_POOR` | 0.1 | Cookies, rotten flesh |
| `FOOD_SATURATION_LOW` | 0.3 | Apples, raw meats, melon |
| `FOOD_SATURATION_NORMAL` | 0.6 | Bread, cooked fish, cooked chicken |
| `FOOD_SATURATION_GOOD` | 0.8 | Cooked pork, cooked beef |
| `FOOD_SATURATION_MAX` | 1.0 | (Not used by any food in current code) |
| `FOOD_SATURATION_SUPERNATURAL` | 1.2 | Golden apple, golden carrot |

#### Exhaustion Values

| Action | Exhaustion |
|--------|-----------|
| `EXHAUSTION_JUMP` | 0.2 |
| `EXHAUSTION_SPRINT_JUMP` | 0.8 |
| `EXHAUSTION_MINE` | 0.025 |
| `EXHAUSTION_ATTACK` | 0.3 |
| `EXHAUSTION_DAMAGE` | 0.1 |
| `EXHAUSTION_WALK` | 0.01 |
| `EXHAUSTION_SPRINT` | 0.1 |
| `EXHAUSTION_SWIM` | 0.015 |

### Complete Food Table

| Food | ID | Nutrition | Saturation Mod | Is Meat | Eat Effect |
|------|----|-----------|---------------|---------|------------|
| Apple | 260 | 4 | 0.3 (Low) | No | -- |
| Mushroom Stew | 282 | 6 | 0.6 (Normal) | No | Returns bowl |
| Bread | 297 | 5 | 0.6 (Normal) | No | -- |
| Raw Porkchop | 319 | 3 | 0.3 (Low) | Yes | -- |
| Cooked Porkchop | 320 | 8 | 0.8 (Good) | Yes | -- |
| Golden Apple | 322 | 4 | 1.2 (Supernatural) | No | Regen I 5s (aux 0); Regen IV 30s + Resistance 300s + Fire Resistance 300s (aux > 0) |
| Raw Fish | 349 | 2 | 0.3 (Low) | No | -- |
| Cooked Fish | 350 | 5 | 0.6 (Normal) | No | -- |
| Cookie | 357 | 2 | 0.1 (Poor) | No | -- |
| Melon Slice | 360 | 2 | 0.3 (Low) | No | -- |
| Raw Beef | 363 | 3 | 0.3 (Low) | Yes | -- |
| Cooked Beef (Steak) | 364 | 8 | 0.8 (Good) | Yes | -- |
| Raw Chicken | 365 | 2 | 0.3 (Low) | Yes | 30% Hunger 30s |
| Cooked Chicken | 366 | 6 | 0.6 (Normal) | Yes | -- |
| Rotten Flesh | 367 | 4 | 0.1 (Poor) | Yes | 80% Hunger 30s |
| Spider Eye | 375 | 2 | 0.8 (Good) | No | 100% Poison 5s |
| Carrot | 391 | 4 | 0.6 (Normal) | No | Plantable (SeedFoodItem) |
| Potato | 392 | 1 | 0.3 (Low) | No | Plantable (SeedFoodItem) |
| Baked Potato | 393 | 6 | 0.6 (Normal) | No | -- |
| Poisonous Potato | 394 | 2 | 0.3 (Low) | No | 60% Poison 5s |
| Golden Carrot | 396 | 6 | 1.2 (Supernatural) | No | Potion ingredient |
| Pumpkin Pie | 400 | 8 | 0.3 (Low) | No | -- |

### BowlFoodItem

**File:** `Minecraft.World/BowlFoodItem.h`

Extends `FoodItem`. Overrides `useTimeDepleted` to return an empty bowl after eating. Used for mushroom stew (ID 282).

### GoldenAppleItem

**Files:** `Minecraft.World/GoldenAppleItem.h`, `Minecraft.World/GoldenAppleItem.cpp`

Uses `auxValue` to differentiate regular (0) and enchanted (>0) golden apples. Enchanted variant has `Rarity::epic`, renders with foil effect, and grants Regeneration IV for 30s, Damage Resistance for 300s, and Fire Resistance for 300s. The `canAlwaysEat` flag is set, allowing consumption even with a full hunger bar.

### SeedFoodItem

**File:** `Minecraft.World/SeedFoodItem.h`

Extends `FoodItem`. Can be both eaten and planted on farmland (overrides `useOn`). Used for carrots (ID 391) and potatoes (ID 392).

## Special Items

### BowItem

**Files:** `Minecraft.World/BowItem.h`, `Minecraft.World/BowItem.cpp`

| Property | Value |
|----------|-------|
| Max Durability | 384 |
| Max Draw Duration | 20 ticks (1 second) |
| Enchantability | 1 |
| Stack Size | 1 |
| Use Animation | `UseAnim_bow` |

Arrow power is calculated from draw time:

```cpp
float pow = timeHeld / (float)MAX_DRAW_DURATION;
pow = ((pow * pow) + pow * 2) / 3;
// Clamped to [0.1, 1.0]
```

Full-draw arrows are flagged as critical. Respects `Infinity`, `Power`, `Punch`, and `Flame` enchantments. Creative mode and Infinity enchantment allow firing without consuming arrows (arrows dropped with `PICKUP_CREATIVE_ONLY`).

### FishingRodItem

**Files:** `Minecraft.World/FishingRodItem.h`, `Minecraft.World/FishingRodItem.cpp`

| Property | Value |
|----------|-------|
| Max Durability | 64 |
| Stack Size | 1 |
| Hand Equipped | Yes |
| Mirrored Art | Yes |

Right-click toggles between casting and reeling. When cast, creates a `FishingHook` entity. When reeled, calls `FishingHook::retrieve()` and applies durability damage equal to the return value.

### PotionItem

**Files:** `Minecraft.World/PotionItem.h`, `Minecraft.World/PotionItem.cpp`

| Property | Value |
|----------|-------|
| Drink Duration | 32 ticks |
| Stack Size | 1 (default) |
| Use Animation | `UseAnim_drink` |

Potions use `auxValue` to encode potion type and modifiers. Throwable (splash) potions are determined by `isThrowable(auxValue)`. The item has multiple sprite layers (base + overlay for liquid color) and caches mob effects per aux value in an `unordered_map<int, vector<MobEffectInstance*>*>`.

### ShearsItem

**File:** `Minecraft.World/ShearsItem.h`

Overrides `canDestroySpecial`, `getDestroySpeed`, and `mineBlock` for efficient harvesting of leaves, wool, and cobweb.

### MonsterPlacerItem (Spawn Eggs)

**File:** `Minecraft.World/MonsterPlacerItem.h`

Uses `auxValue` to determine mob type. Has spawn limit checks with detailed failure codes:

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

Has two sprite layers for the egg's base and overlay colors.

### MapItem

**Files:** `Minecraft.World/MapItem.h`

Extends `ComplexItem` (which sets `isComplex() = true` for special network handling). Maps are 128x128 pixels. Map data is stored in `MapItemSavedData` and updated via `getUpdatePacket()`.

### RecordingItem (Music Discs)

**File:** `Minecraft.World/RecordingItem.h`

Each disc stores a `recording` string (e.g., `"13"`, `"cat"`, `"blocks"`). Uses `useOn` to interact with jukeboxes. All discs have `Rarity::rare` or higher.

### EnchantedBookItem

**File:** `Minecraft.World/EnchantedBookItem.h`

Stores enchantments in NBT under the `StoredEnchantments` tag (separate from regular enchantments). Always has a foil effect. Provides `createForRandomLoot()` and `createForRandomTreasure()` for dungeon chest generation. Stack size is 1.

### Other Notable Items

| Item Class | Item | ID | Notes |
|------------|------|----|-------|
| `FlintAndSteelItem` | Flint and Steel | 259 | Places fire on block face; durability based |
| `BucketItem` | Bucket | 325-327 | Empty/Water/Lava; filled buckets stack to 1, empty to 16 |
| `MilkBucketItem` | Milk | 335 | Clears mob effects; crafting remainder is empty bucket |
| `EnderpearlItem` | Ender Pearl | 368 | Throwable; stack size 16 |
| `EnderEyeItem` | Eye of Ender | 381 | Used to locate strongholds and fill portal frames |
| `ExperienceItem` | Bottle o' Enchanting | 384 | Throwable; spawns experience orbs |
| `FireChargeItem` | Fire Charge | 385 | Places fire; classified as torch type for crafting menu |
| `BottleItem` | Glass Bottle | 374 | Collects water for brewing |
| `SaddleItem` | Saddle | 329 | Equips on pigs; stack size 1 |
| `CarrotOnAStickItem` | Carrot on a Stick | 398 | Controls saddled pigs |
| `HangingEntityItem` | Painting / Item Frame | 321 / 389 | Places hanging entities on walls |
| `SkullItem` | Skull | 397 | Multiple skull types via aux value |
| `DyePowderItem` | Dye | 351 | 16 colors via aux value |
| `CoalItem` | Coal | 263 | Coal (0) and Charcoal (1) via aux value |
| `BookItem` | Book | 340 | Used in enchanting table recipe |
| `RedStoneItem` | Redstone | 331 | Places redstone dust; potion ingredient |
| `SeedItem` | Seeds | 295, 361, 362, 372 | Wheat, Pumpkin, Melon, Nether Wart |

## Material and Type Classification

The crafting menu uses two enums to categorize items for filtering. These were added by 4J Studios for the console edition's crafting UI.

### eMaterial Enum

Used by the crafting menu to group items by material:

| Value | Name | Example Items |
|-------|------|--------------|
| 0 | `undefined` | Generic items |
| 1 | `wood` | Wood tools, sticks, doors |
| 2 | `stone` | Stone tools |
| 3 | `iron` | Iron tools, iron armor, iron door |
| 4 | `gold` | Gold tools, gold armor, gold nugget |
| 5 | `diamond` | Diamond tools, diamond armor |
| 6 | `cloth` | Leather armor, painting |
| 7 | `chain` | Chain armor |
| 8 | `detector` | Detector rail |
| 9 | `lapis` | Lapis lazuli |
| 10 | `music` | Music discs |
| 11 | `dye` | Dye powder |
| 12 | `sand` | Sand-related |
| 13 | `brick` | Brick-related |
| 14 | `clay` | Clay-related |
| 15 | `snow` | Snow-related |
| 16 | `bow` | Bow |
| 17 | `arrow` | Arrows |
| 18 | `compass` | Compass |
| 19 | `clock` | Clock |
| 20 | `map` | Map |
| 21 | `pumpkin` | Pumpkin seeds |
| 22 | `glowstone` | Glowstone |
| 23 | `water` | Bucket (water) |
| 24 | `trap` | Trapdoor |
| 25 | `flintandsteel` | Flint and Steel |
| 26 | `shears` | Shears |
| 27 | `piston` | Piston |
| 28 | `stickypiston` | Sticky Piston |
| 29 | `gate` | Fence Gate |
| 30 | `stoneSmooth` | Smooth Stone |
| 31 | `netherbrick` | Nether Brick |
| 32 | `ender` | Eye of Ender |
| 33 | `glass` | Glass Bottle |
| 34 | `blaze` | Brewing Stand |
| 35 | `magic` | Enchanting-related |
| 36 | `melon` | Melon seeds, Speckled Melon |
| 37 | `setfire` | Fire Charge |
| 38 | `sprucewood` | Spruce wood stairs |
| 39 | `birchwood` | Birch wood stairs |
| 40 | `junglewood` | Jungle wood stairs |
| 41 | `emerald` | Emerald |
| 42 | `quartz` | Nether Quartz |
| 43 | `apple` | Golden Apple |
| 44 | `carrot` | Golden Carrot, Carrot on a Stick |

### eBaseItemType Enum

Classifies items by functional type:

| Value | Name | Example Items |
|-------|------|--------------|
| 0 | `undefined` | Generic items |
| 1 | `sword` | All swords |
| 2 | `shovel` | All shovels |
| 3 | `pickaxe` | All pickaxes |
| 4 | `hatchet` | All axes |
| 5 | `hoe` | All hoes |
| 6 | `door` | Wood door, iron door |
| 7 | `helmet` | All helmets |
| 8 | `chestplate` | All chestplates |
| 9 | `leggings` | All leggings |
| 10 | `boots` | All boots |
| 11 | `ingot` | Iron ingot, gold ingot |
| 12 | `rail` | Rails |
| 13 | `block` | Block items |
| 14 | `pressureplate` | Pressure plates |
| 15 | `stairs` | Stairs |
| 16 | `cloth` | Wool |
| 17 | `dyepowder` | Dye powder |
| 18 | `structwoodstuff` | Wood structure items |
| 19 | `structblock` | Structure blocks |
| 20 | `slab` | Double slabs |
| 21 | `halfslab` | Half slabs |
| 22 | `torch` | Torches, fire charges |
| 23 | `bow` | Bow, arrows |
| 24 | `pockettool` | Compass, clock, map, eye of ender |
| 25 | `utensil` | Buckets, bowl, cauldron, glass bottle |
| 26 | `piston` | Pistons |
| 27 | `devicetool` | Flint and steel, shears |
| 28 | `fence` | Fences |
| 29 | `device` | Brewing stand |
| 30 | `treasure` | Diamond, iron/gold ingots, emerald |
| 31 | `seed` | Seeds |
| 32 | `HangingItem` | Painting, item frame, sign |
| 33 | `button` | Buttons |
| 34 | `chest` | Chests |
| 35 | `rod` | Fishing rod, carrot on a stick |
| 36 | `giltFruit` | Golden apple, speckled melon |
| 37 | `carpet` | Carpets |

## Complete Item ID Registry

All item IDs as defined by `static const int` fields on the `Item` class:

### Tools (256-294)

| ID | Item | Type |
|----|------|------|
| 256 | Iron Shovel | ShovelItem |
| 257 | Iron Pickaxe | PickaxeItem |
| 258 | Iron Axe | HatchetItem |
| 259 | Flint and Steel | FlintAndSteelItem |
| 260 | Apple | FoodItem |
| 261 | Bow | BowItem |
| 262 | Arrow | Item |
| 263 | Coal | CoalItem |
| 264 | Diamond | Item |
| 265 | Iron Ingot | Item |
| 266 | Gold Ingot | Item |
| 267 | Iron Sword | WeaponItem |
| 268 | Wood Sword | WeaponItem |
| 269 | Wood Shovel | ShovelItem |
| 270 | Wood Pickaxe | PickaxeItem |
| 271 | Wood Axe | HatchetItem |
| 272 | Stone Sword | WeaponItem |
| 273 | Stone Shovel | ShovelItem |
| 274 | Stone Pickaxe | PickaxeItem |
| 275 | Stone Axe | HatchetItem |
| 276 | Diamond Sword | WeaponItem |
| 277 | Diamond Shovel | ShovelItem |
| 278 | Diamond Pickaxe | PickaxeItem |
| 279 | Diamond Axe | HatchetItem |
| 280 | Stick | Item |
| 281 | Bowl | Item |
| 282 | Mushroom Stew | BowlFoodItem |
| 283 | Gold Sword | WeaponItem |
| 284 | Gold Shovel | ShovelItem |
| 285 | Gold Pickaxe | PickaxeItem |
| 286 | Gold Axe | HatchetItem |
| 287 | String | TilePlanterItem |
| 288 | Feather | Item |
| 289 | Gunpowder | Item |
| 290 | Wood Hoe | HoeItem |
| 291 | Stone Hoe | HoeItem |
| 292 | Iron Hoe | HoeItem |
| 293 | Diamond Hoe | HoeItem |
| 294 | Gold Hoe | HoeItem |

### Food and Farming (295-297, 319-320, 349-350, 357, 360-367)

| ID | Item | Type |
|----|------|------|
| 295 | Wheat Seeds | SeedItem |
| 296 | Wheat | Item |
| 297 | Bread | FoodItem |
| 319 | Raw Porkchop | FoodItem |
| 320 | Cooked Porkchop | FoodItem |
| 349 | Raw Fish | FoodItem |
| 350 | Cooked Fish | FoodItem |
| 357 | Cookie | FoodItem |
| 360 | Melon Slice | FoodItem |
| 361 | Pumpkin Seeds | SeedItem |
| 362 | Melon Seeds | SeedItem |
| 363 | Raw Beef | FoodItem |
| 364 | Cooked Beef | FoodItem |
| 365 | Raw Chicken | FoodItem |
| 366 | Cooked Chicken | FoodItem |
| 367 | Rotten Flesh | FoodItem |

### Armor (298-317)

| ID | Item | Type |
|----|------|------|
| 298 | Leather Helmet | ArmorItem |
| 299 | Leather Chestplate | ArmorItem |
| 300 | Leather Leggings | ArmorItem |
| 301 | Leather Boots | ArmorItem |
| 302 | Chain Helmet | ArmorItem |
| 303 | Chain Chestplate | ArmorItem |
| 304 | Chain Leggings | ArmorItem |
| 305 | Chain Boots | ArmorItem |
| 306 | Iron Helmet | ArmorItem |
| 307 | Iron Chestplate | ArmorItem |
| 308 | Iron Leggings | ArmorItem |
| 309 | Iron Boots | ArmorItem |
| 310 | Diamond Helmet | ArmorItem |
| 311 | Diamond Chestplate | ArmorItem |
| 312 | Diamond Leggings | ArmorItem |
| 313 | Diamond Boots | ArmorItem |
| 314 | Gold Helmet | ArmorItem |
| 315 | Gold Chestplate | ArmorItem |
| 316 | Gold Leggings | ArmorItem |
| 317 | Gold Boots | ArmorItem |

### Materials and Misc (318-358)

| ID | Item | Type |
|----|------|------|
| 318 | Flint | Item |
| 321 | Painting | HangingEntityItem |
| 322 | Golden Apple | GoldenAppleItem |
| 323 | Sign | SignItem |
| 324 | Wood Door | DoorItem |
| 325 | Empty Bucket | BucketItem |
| 326 | Water Bucket | BucketItem |
| 327 | Lava Bucket | BucketItem |
| 328 | Minecart | MinecartItem |
| 329 | Saddle | SaddleItem |
| 330 | Iron Door | DoorItem |
| 331 | Redstone | RedStoneItem |
| 332 | Snowball | SnowballItem |
| 333 | Boat | BoatItem |
| 334 | Leather | Item |
| 335 | Milk | MilkBucketItem |
| 336 | Brick | Item |
| 337 | Clay Ball | Item |
| 338 | Sugar Cane | TilePlanterItem |
| 339 | Paper | Item |
| 340 | Book | BookItem |
| 341 | Slime Ball | Item |
| 342 | Chest Minecart | MinecartItem |
| 343 | Furnace Minecart | MinecartItem |
| 344 | Egg | EggItem |
| 345 | Compass | CompassItem |
| 346 | Fishing Rod | FishingRodItem |
| 347 | Clock | ClockItem |
| 348 | Glowstone Dust | Item |
| 351 | Dye | DyePowderItem |
| 352 | Bone | Item |
| 353 | Sugar | Item |
| 354 | Cake | TilePlanterItem |
| 355 | Bed | BedItem |
| 356 | Redstone Repeater | TilePlanterItem |
| 358 | Map | MapItem |
| 359 | Shears | ShearsItem |

### Nether and Brewing (368-384)

| ID | Item | Type |
|----|------|------|
| 368 | Ender Pearl | EnderpearlItem |
| 369 | Blaze Rod | Item |
| 370 | Ghast Tear | Item |
| 371 | Gold Nugget | Item |
| 372 | Nether Wart | SeedItem |
| 373 | Potion | PotionItem |
| 374 | Glass Bottle | BottleItem |
| 375 | Spider Eye | FoodItem |
| 376 | Fermented Spider Eye | Item |
| 377 | Blaze Powder | Item |
| 378 | Magma Cream | Item |
| 379 | Brewing Stand | TilePlanterItem |
| 380 | Cauldron | TilePlanterItem |
| 381 | Eye of Ender | EnderEyeItem |
| 382 | Glistering Melon | Item |
| 383 | Spawn Egg | MonsterPlacerItem |
| 384 | Bottle o' Enchanting | ExperienceItem |

### TU9+ Items (385-406)

| ID | Item | Type |
|----|------|------|
| 385 | Fire Charge | FireChargeItem |
| 388 | Emerald | Item |
| 389 | Item Frame | HangingEntityItem |
| 390 | Flower Pot | TilePlanterItem |
| 391 | Carrot | SeedFoodItem |
| 392 | Potato | SeedFoodItem |
| 393 | Baked Potato | FoodItem |
| 394 | Poisonous Potato | FoodItem |
| 396 | Golden Carrot | FoodItem |
| 397 | Skull | SkullItem |
| 398 | Carrot on a Stick | CarrotOnAStickItem |
| 400 | Pumpkin Pie | FoodItem |
| 403 | Enchanted Book | EnchantedBookItem |
| 405 | Nether Brick (item) | Item |
| 406 | Nether Quartz | Item |

### Music Discs (2256-2267)

| ID | Item | Recording |
|----|------|-----------|
| 2256 | Music Disc | "13" |
| 2257 | Music Disc | "cat" |
| 2258 | Music Disc | "blocks" |
| 2259 | Music Disc | "chirp" |
| 2260 | Music Disc | "far" |
| 2261 | Music Disc | "mall" |
| 2262 | Music Disc | "mellohi" |
| 2263 | Music Disc | "stal" |
| 2264 | Music Disc | "strad" |
| 2265 | Music Disc | "ward" |
| 2266 | Music Disc | "11" |
| 2267 | Music Disc | "where are we now" |

The disc with ID 2267 ("where are we now") is noted in the source as "not playable in the PC game, but is fine in ours" -- a LCE-exclusive music disc.

## Potion Brewing Ingredients

Several items are tagged with potion brewing formulas via `setPotionBrewingFormula()`:

| Item | ID | Brewing Formula |
|------|-----|----------------|
| Gunpowder | 289 | `MOD_GUNPOWDER` |
| Redstone | 331 | `MOD_REDSTONE` |
| Glowstone Dust | 348 | `MOD_GLOWSTONE` |
| Sugar | 353 | `MOD_SUGAR` |
| Ghast Tear | 370 | `MOD_GHASTTEARS` |
| Nether Wart | 372 | `MOD_NETHERWART` |
| Spider Eye | 375 | `MOD_SPIDEREYE` |
| Fermented Spider Eye | 376 | `MOD_FERMENTEDEYE` |
| Blaze Powder | 377 | `MOD_BLAZEPOWDER` |
| Magma Cream | 378 | `MOD_MAGMACREAM` |
| Glistering Melon | 382 | `MOD_SPECKLEDMELON` |
| Golden Carrot | 396 | `MOD_GOLDENCARROT` |
