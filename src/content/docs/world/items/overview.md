---
title: Item System Overview
description: Core architecture of the LCEMP item system, including the base Item class, ItemInstance, registration, and ID offset.
---

The item system in LCE is built around the `Item` base class. Every non-block item gets a numeric ID starting at **256** (the `id` you pass to the constructor gets +256 added internally). The global registry has room for up to **32,000** slots.

## Sub-Pages

- [Tools & Weapons](/lcemp-docs/world/items/tools/) - Swords, pickaxes, axes, shovels, hoes, shears. Tool tiers, durability, speed, damage.
- [Armor](/lcemp-docs/world/items/armor/) - All armor materials, defense values, durability, slots, leather dyeing.
- [Food](/lcemp-docs/world/items/food/) - Nutrition, saturation, effects, all food types.
- [Combat Items](/lcemp-docs/world/items/combat/) - Bow, arrows, snowballs, ender pearls, fire charges, potions.
- [Music Discs](/lcemp-docs/world/items/music-discs/) - All disc IDs, field names, how records work.
- [Decorative & Placement](/lcemp-docs/world/items/decorative/) - Paintings, item frames, signs, buckets, dyes, maps, books, beds.
- [Raw Materials](/lcemp-docs/world/items/materials/) - Ingots, diamonds, redstone, glowstone dust, string, leather, and crafting ingredients.
- [Special Items](/lcemp-docs/world/items/special/) - Spawn eggs, enchanted books, written books, fireworks, name tags.

## Item Base Class

**Files:** `Minecraft.World/Item.h`, `Minecraft.World/Item.cpp`

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `ITEM_NUM_COUNT` | 32000 | Maximum possible items in the registry |
| `MAX_STACK_SIZE` | 64 | Default max stack size (from `Container::LARGE_MAX_STACK_SIZE`) |
| `ICON_COLUMNS` | 16 | Columns in the item texture atlas |

### Key Member Variables

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

### Constructor

```cpp
Item::Item(int id) : id(256 + id)
```

The constructor takes the given ID, adds 256 to it, and registers the item into the global `items` array at that index. By default, `maxStackSize` is 64 and `maxDamage` is 0. If the slot is already taken, a debug message gets printed.

### Builder-Pattern Setters

All setter methods return `this` (or `Item*`) so you can chain them together:

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

### Key Virtual Methods

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
| `isFoil(...)` | Returns `true` if `itemInstance->isEnchanted()` | Whether the item has an enchantment glint |
| `getRarity(...)` | Returns `Rarity::rare` if enchanted, otherwise `Rarity::common` | Item rarity (affects name color) |
| `isEnchantable(...)` | Returns `true` if stack size is 1 and item can be depleted | Whether item can be enchanted |
| `getEnchantmentValue()` | Returns `0` | Enchantability score |
| `isValidRepairItem(...)` | Returns `false` | Whether the given item can repair this one in an anvil |
| `isComplex()` | Returns `false` | Whether item needs special network sync (maps) |
| `appendHoverText(...)` | No-op | Add lines to the item tooltip |

### UseAnim Enum

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

### Rarity Levels

**File:** `Minecraft.World/Rarity.h`

| Rarity | Usage |
|--------|-------|
| `common` | Most items |
| `uncommon` | Enchanted items, enchanted books (with stored enchantments) |
| `rare` | Golden apples (aux 0), music discs |
| `epic` | Enchanted golden apples (aux > 0) |

## ItemInstance

**Files:** `Minecraft.World/ItemInstance.h`, `Minecraft.World/ItemInstance.cpp`

`ItemInstance` represents a specific stack of items sitting in an inventory or out in the world. It wraps an `Item` with a count, auxiliary data, and NBT tag data.

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

All items get registered in `Item::staticCtor()` inside `Item.cpp`. This method creates each item with `new`, sets properties through builder-pattern chaining, and the `Item` constructor automatically drops each item into the global `Item::items` array at index `256 + id`.

```cpp
// Example from staticCtor():
Item::sword_wood = (new WeaponItem(12, _Tier::WOOD))
    ->setBaseItemTypeAndMaterial(eBaseItemType_sword, eMaterial_wood)
    ->setTextureName(L"swordWood")
    ->setDescriptionId(IDS_ITEM_SWORD_WOOD)
    ->setUseDescriptionId(IDS_DESC_SWORD);
```

After `staticCtor()` runs, `Item::staticInit()` gets called separately (after other static constructors like Recipes) and builds item statistics through `Stats::buildItemStats()`.

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

## Material and Type Classification

The crafting menu uses two enums to sort items for filtering. These were added by 4J Studios for the console edition's crafting UI.

### eMaterial Enum

The crafting menu uses this to group items by material:

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

This groups items by what they actually do:

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
| 11 | `ingot` | (Defined but unused; iron/gold ingots use `treasure` instead) |
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
| 30 | `treasure` | Diamond, iron/gold ingots, gold nugget, emerald |
| 31 | `seed` | Seeds |
| 32 | `HangingItem` | Painting, item frame, sign |
| 33 | `button` | Buttons |
| 34 | `chest` | Chests |
| 35 | `rod` | Fishing rod, carrot on a stick |
| 36 | `giltFruit` | Golden apple, speckled melon |
| 37 | `carpet` | Carpets |

## MinecraftConsoles differences

MinecraftConsoles expands the item system pretty significantly. Here's what changes:

### New item classes

| Class | Purpose |
|---|---|
| `FireworksItem` | Firework rockets. Has NBT tag constants for firework data (`TAG_FIREWORKS`, `TAG_EXPLOSION`, `TAG_EXPLOSIONS`, `TAG_FLIGHT`). Explosion types go from `TYPE_SMALL` (0) through `TYPE_BURST` (4). Places a `FireworksRocketEntity` on use. |
| `FireworksChargeItem` | Firework stars. Multi-layer sprite with explosion tag reading for tooltip display. |
| `NameTagItem` | Name tags for naming mobs. Uses `interactEnemy` to apply the item's custom name to a mob. |
| `LeashItem` | Leads/leashes. `useOn` attaches leashed mobs to fences via `bindPlayerMobs`. Has a test method `bindPlayerMobsTest` for UI tooltip checks. |
| `EmptyMapItem` | Empty maps (separate from `MapItem`). Extends `ComplexItem` and creates a new map on `use()`. In LCEMP, map creation is handled within `MapItem` itself. |
| `SpawnEggItem` | Replaces `MonsterPlacerItem`. Same spawn limit system but adds `eSpawnResult_FailTooManyBats` for the new bat mob. The class name change reflects the vanilla Minecraft naming. |
| `SimpleFoiledItem` | A generic item that always shows the enchantment glint. Used for the Nether Star. |
| `WrittenBookItem` | Written (signed) books with title, author, and pages. Has validation for tag structure. In LCEMP, books don't have the signed/written variant. Note: the implementation exists only as a commented-out Java pseudocode block in the header. |

### Renamed items

Some items got renamed between LCEMP and MinecraftConsoles:

| LCEMP name | MinecraftConsoles name |
|---|---|
| `monsterPlacer` | `spawnEgg` |
| `sulphur` | `gunpowder` |
| `milk` | `bucket_milk` |
| `diode` | `repeater` |
| `netherStalkSeeds` | `netherwart_seeds` |
| `boots_cloth` / `helmet_cloth` / etc. | `boots_leather` / `helmet_leather` / etc. |

### New static item fields

These items exist in MinecraftConsoles but not LCEMP:

- `fireworks`, `fireworksCharge`
- `nameTag`, `lead` (leash)
- `netherStar`
- `horseArmorMetal`, `horseArmorGold`, `horseArmorDiamond`
- `minecart_hopper`, `minecart_tnt`
- `comparator` (separate from the diode/repeater)
- `emptyMap` (separate from filled map)

### Class hierarchy additions

The hierarchy gains `SpawnEggItem` (replacing `MonsterPlacerItem`), `FireworksItem`, `FireworksChargeItem`, `NameTagItem`, `LeashItem`, `SimpleFoiledItem`, `EmptyMapItem`, and `WrittenBookItem`.
