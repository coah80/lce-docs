---
title: Adding Items
description: Step-by-step guide to adding new items to LCEMP.
---

Items in LCEMP are managed by the `Item` class defined in `Minecraft.World/Item.h`. Every holdable object -- tools, food, materials, armor -- is an `Item` subclass registered in `Item::staticCtor()`. This guide covers creating and registering new items based on the actual source code.

## Overview of the Item System

The `Item` base class provides:

- A **numeric ID** -- the constructor parameter is offset by 256 (so `new Item(4)` creates ID 260)
- **Properties** like max stack size, max damage (durability), texture, description
- **Virtual methods** for behavior: `use()`, `useOn()`, `hurtEnemy()`, `mineBlock()`, etc.
- **Classification** via `eBaseItemType` and `eMaterial` enums for creative inventory sorting

All items are stored in `Item::items`, an `ItemArray` of size 32000:

```cpp
Item::Item(int id) : id( 256 + id )
{
    maxStackSize = 64;  // MAX_STACK_SIZE from Container
    maxDamage = 0;
    // ...
}
```

## Step 1: Create an Item Subclass

Create a header and implementation file in `Minecraft.World/`.

**`MyCustomItem.h`**
```cpp
#pragma once
#include "Item.h"

class Player;
class Level;
class Mob;

class MyCustomItem : public Item
{
public:
    MyCustomItem(int id);

    // Override whichever behaviors you need:
    virtual shared_ptr<ItemInstance> use(shared_ptr<ItemInstance> itemInstance,
                                         Level *level,
                                         shared_ptr<Player> player);
    virtual bool useOn(shared_ptr<ItemInstance> itemInstance,
                       shared_ptr<Player> player, Level *level,
                       int x, int y, int z, int face,
                       float clickX, float clickY, float clickZ,
                       bool bTestUseOnOnly = false);
    virtual bool hurtEnemy(shared_ptr<ItemInstance> itemInstance,
                           shared_ptr<Mob> mob,
                           shared_ptr<Mob> attacker);
};
```

**`MyCustomItem.cpp`**
```cpp
#include "stdafx.h"
#include "MyCustomItem.h"
#include "net.minecraft.world.entity.player.h"
#include "net.minecraft.world.level.h"

MyCustomItem::MyCustomItem(int id) : Item(id)
{
    // Item(id) sets this->id = 256 + id
    // Defaults: maxStackSize=64, maxDamage=0
}

shared_ptr<ItemInstance> MyCustomItem::use(shared_ptr<ItemInstance> itemInstance,
                                            Level *level,
                                            shared_ptr<Player> player)
{
    // Called when the player right-clicks with this item in hand
    // (not aiming at a block).
    return itemInstance;
}

bool MyCustomItem::useOn(shared_ptr<ItemInstance> itemInstance,
                          shared_ptr<Player> player, Level *level,
                          int x, int y, int z, int face,
                          float clickX, float clickY, float clickZ,
                          bool bTestUseOnOnly)
{
    // Called when the player right-clicks a block while holding this item.
    // Return true if the interaction was handled.
    return false;
}

bool MyCustomItem::hurtEnemy(shared_ptr<ItemInstance> itemInstance,
                              shared_ptr<Mob> mob,
                              shared_ptr<Mob> attacker)
{
    // Called when this item is used to hit a mob.
    // Return true to indicate the item was used in combat.
    // Optionally damage the item:
    // itemInstance->hurt(1, attacker);
    return false;
}
```

## Step 2: Register in Item::staticCtor()

Add your item to `Item::staticCtor()` in `Item.cpp`. You also need a static pointer and ID constant in `Item.h`.

**In `Item.h`**, add:

```cpp
// Static pointer (with the other static Item pointers)
static Item *myCustomItem;

// ID constant (pick an unused value)
static const int myCustomItem_Id = 407;
```

**In `Item.cpp`**, add:

```cpp
// Static definition (near the other static Item* definitions)
Item *Item::myCustomItem = NULL;

// Inside Item::staticCtor():
Item::myCustomItem = ( new MyCustomItem(151) )  // 256 + 151 = 407
    ->setTextureName(L"myCustomItem")
    ->setDescriptionId(IDS_ITEM_MY_CUSTOM)
    ->setUseDescriptionId(IDS_DESC_MY_CUSTOM);
```

Remember: the constructor parameter is `desired_id - 256`. So for item ID 407, pass 151.

## Step 3: Set Properties

All property setters return `Item*` for chaining.

### Stack Size

```cpp
->setMaxStackSize(16)   // Default is 64
->setMaxStackSize(1)    // Non-stackable (tools, weapons, armor)
```

### Durability

```cpp
->setMaxDamage(250)     // Item breaks after 250 uses. Setting this implies maxStackSize=1.
```

Tier-based durability for tools (from `Item::Tier`):

| Tier | Uses | Speed | Damage Bonus | Enchantability |
|------|------|-------|--------------|----------------|
| WOOD | 59 | 2 | 0 | 15 |
| STONE | 131 | 4 | 1 | 5 |
| IRON | 250 | 6 | 2 | 14 |
| DIAMOND | 1561 | 8 | 3 | 10 |
| GOLD | 32 | 12 | 0 | 22 |

### Display

```cpp
->setTextureName(L"myItem")                    // Texture lookup name
->setDescriptionId(IDS_ITEM_MY_ITEM)           // Localized name string ID
->setUseDescriptionId(IDS_DESC_MY_ITEM)        // Localized description string ID
->handEquipped()                                // Render held in hand like a tool
```

### Creative Inventory

```cpp
->setBaseItemTypeAndMaterial(eBaseItemType_treasure, eMaterial_diamond)
```

Common `eBaseItemType` values for items:

| Type | Usage |
|------|-------|
| `eBaseItemType_sword` | Swords |
| `eBaseItemType_shovel` | Shovels |
| `eBaseItemType_pickaxe` | Pickaxes |
| `eBaseItemType_hatchet` | Axes |
| `eBaseItemType_hoe` | Hoes |
| `eBaseItemType_helmet` / `chestplate` / `leggings` / `boots` | Armor |
| `eBaseItemType_bow` | Bows and arrows |
| `eBaseItemType_treasure` | Ingots, gems, nuggets |
| `eBaseItemType_seed` | Seeds |
| `eBaseItemType_utensil` | Buckets, bottles |
| `eBaseItemType_devicetool` | Flint and steel, shears |
| `eBaseItemType_pockettool` | Compass, clock, map |
| `eBaseItemType_rod` | Fishing rod, carrot on a stick |
| `eBaseItemType_HangingItem` | Paintings, item frames, signs |
| `eBaseItemType_giltFruit` | Golden apple, golden carrot |

Common `eMaterial` values:

| Material | Usage |
|----------|-------|
| `eMaterial_wood` | Wood-tier items |
| `eMaterial_stone` | Stone-tier items |
| `eMaterial_iron` | Iron-tier items |
| `eMaterial_gold` | Gold-tier items |
| `eMaterial_diamond` | Diamond-tier items |
| `eMaterial_cloth` | Leather items |
| `eMaterial_chain` | Chain armor |
| `eMaterial_emerald` | Emerald items |

### Crafting Remainder

```cpp
->setCraftingRemainingItem(Item::bucket_empty)  // Leaves empty bucket after crafting
```

### Potion Brewing

```cpp
->setPotionBrewingFormula(PotionBrewing::MOD_REDSTONE)  // Acts as brewing ingredient
```

## Creating Tool Items

Tools use the `Item::Tier` system for durability, speed, and damage. Each tool type has a dedicated subclass.

### Weapon (Sword)

From `WeaponItem.h`:

```cpp
class WeaponItem : public Item
{
    int damage;
    const Tier *tier;
public:
    WeaponItem(int id, const Tier *tier);
    virtual bool hurtEnemy(...);   // Damages item by 1 per hit
    virtual bool mineBlock(...);   // Damages item by 2 per block mined
    virtual int getAttackDamage(shared_ptr<Entity> entity);
    virtual bool canDestroySpecial(Tile *tile);  // Swords cut webs
};
```

The constructor sets `maxStackSize = 1`, durability from the tier, and `damage = 4 + tier->getAttackDamageBonus()`.

Registration example:

```cpp
Item::sword_iron = ( new WeaponItem(11, _Tier::IRON) )
    ->setBaseItemTypeAndMaterial(eBaseItemType_sword, eMaterial_iron)
    ->setTextureName(L"swordIron")
    ->setDescriptionId(IDS_ITEM_SWORD_IRON)
    ->setUseDescriptionId(IDS_DESC_SWORD);
```

### Pickaxe

From `PickaxeItem.h`:

```cpp
class PickaxeItem : public DiggerItem
{
public:
    PickaxeItem(int id, const Tier *tier);
    virtual bool canDestroySpecial(Tile *tile);
    virtual float getDestroySpeed(shared_ptr<ItemInstance> itemInstance, Tile *tile);
};
```

Registration:

```cpp
Item::pickAxe_diamond = ( new PickaxeItem(22, _Tier::DIAMOND) )
    ->setBaseItemTypeAndMaterial(eBaseItemType_pickaxe, eMaterial_diamond)
    ->setTextureName(L"pickaxeDiamond")
    ->setDescriptionId(IDS_ITEM_PICKAXE_DIAMOND)
    ->setUseDescriptionId(IDS_DESC_PICKAXE);
```

Other tool types follow the same pattern: `ShovelItem`, `HatchetItem` (axes), and `HoeItem`.

## Creating Armor Items

`ArmorItem` takes an armor material, a texture index, and a slot:

```cpp
class ArmorItem : public Item
{
public:
    static const int SLOT_HEAD = 0;
    static const int SLOT_TORSO = 1;
    static const int SLOT_LEGS = 2;
    static const int SLOT_FEET = 3;

    ArmorItem(int id, const ArmorMaterial *armorType, int icon, int slot);
};
```

Armor materials defined in `ArmorItem::ArmorMaterial`:

| Material | Used For |
|----------|----------|
| `ArmorMaterial::CLOTH` | Leather armor |
| `ArmorMaterial::CHAIN` | Chain armor |
| `ArmorMaterial::IRON` | Iron armor |
| `ArmorMaterial::GOLD` | Gold armor |
| `ArmorMaterial::DIAMOND` | Diamond armor |

Registration example (iron helmet):

```cpp
Item::helmet_iron = (ArmorItem *)( ( new ArmorItem(50,
    ArmorItem::ArmorMaterial::IRON, 2, ArmorItem::SLOT_HEAD) )
    ->setBaseItemTypeAndMaterial(eBaseItemType_helmet, eMaterial_iron)
    ->setTextureName(L"helmetIron")
    ->setDescriptionId(IDS_ITEM_HELMET_IRON)
    ->setUseDescriptionId(IDS_DESC_HELMET_IRON) );
```

Note the cast to `ArmorItem *` -- this is needed because the chained setters return `Item*`.

## Creating Food Items

`FoodItem` adds eating behavior. Constructor:

```cpp
FoodItem(int id, int nutrition, float saturationMod, bool isMeat);
```

Saturation modifier constants from `FoodConstants`:

| Constant | Value |
|----------|-------|
| `FOOD_SATURATION_POOR` | 0.1 |
| `FOOD_SATURATION_LOW` | 0.3 |
| `FOOD_SATURATION_NORMAL` | 0.6 |
| `FOOD_SATURATION_GOOD` | 0.8 |
| `FOOD_SATURATION_MAX` | 1.0 |
| `FOOD_SATURATION_SUPERNATURAL` | 1.2 |

The `isMeat` flag categorizes the food for wolves (they only eat meat).

Additional food methods:

```cpp
->setEatEffect(MobEffect::hunger->id, 30, 0, .8f)  // Status effect on eat
//             effectId, durationSeconds, amplifier, probability
->setCanAlwaysEat()  // Can eat even when food bar is full (golden apple)
```

Registration examples:

```cpp
// Simple food
Item::bread = ( new FoodItem(41, 5, FoodConstants::FOOD_SATURATION_NORMAL, false) )
    ->setTextureName(L"bread")
    ->setDescriptionId(IDS_ITEM_BREAD)
    ->setUseDescriptionId(IDS_DESC_BREAD);

// Meat with low saturation
Item::porkChop_raw = ( new FoodItem(63, 3, FoodConstants::FOOD_SATURATION_LOW, true) )
    ->setTextureName(L"porkchopRaw")
    ->setDescriptionId(IDS_ITEM_PORKCHOP_RAW)
    ->setUseDescriptionId(IDS_DESC_PORKCHOP_RAW);

// Food with negative effect
Item::chicken_raw = (new FoodItem(109, 2, FoodConstants::FOOD_SATURATION_LOW, true))
    ->setEatEffect(MobEffect::hunger->id, 30, 0, .3f)
    ->setTextureName(L"chickenRaw")
    ->setDescriptionId(IDS_ITEM_CHICKEN_RAW)
    ->setUseDescriptionId(IDS_DESC_CHICKEN_RAW);

// Food with poison effect
Item::spiderEye = (new FoodItem(119, 2, FoodConstants::FOOD_SATURATION_GOOD, false))
    ->setEatEffect(MobEffect::poison->id, 5, 0, 1.0f)
    ->setTextureName(L"spiderEye")
    ->setDescriptionId(IDS_ITEM_SPIDER_EYE)
    ->setUseDescriptionId(IDS_DESC_SPIDER_EYE);

// Golden apple: always edible, supernatural saturation, regeneration effect
Item::apple_gold = ( new GoldenAppleItem(66, 4,
    FoodConstants::FOOD_SATURATION_SUPERNATURAL, false) )
    ->setCanAlwaysEat()
    ->setEatEffect(MobEffect::regeneration->id, 5, 0, 1.0f)
    ->setBaseItemTypeAndMaterial(eBaseItemType_giltFruit, eMaterial_apple)
    ->setTextureName(L"appleGold")
    ->setDescriptionId(IDS_ITEM_APPLE_GOLD);
```

The eating duration is a constant `EAT_DURATION = (int)(20 * 1.6)` (about 32 ticks).

## Creating Simple Material Items

Many items have no special behavior -- they are just `new Item(id)` with properties set:

```cpp
// Simple crafting material
Item::diamond = ( new Item(8) )
    ->setBaseItemTypeAndMaterial(eBaseItemType_treasure, eMaterial_diamond)
    ->setTextureName(L"diamond")
    ->setDescriptionId(IDS_ITEM_DIAMOND)
    ->setUseDescriptionId(IDS_DESC_DIAMONDS);

// Hand-held item (renders like a tool)
Item::stick = ( new Item(24) )
    ->setTextureName(L"stick")
    ->handEquipped()
    ->setDescriptionId(IDS_ITEM_STICK)
    ->setUseDescriptionId(IDS_DESC_STICK);

// Stackable utility item with reduced stack size
Item::bucket_empty = ( new BucketItem(69, 0) )
    ->setBaseItemTypeAndMaterial(eBaseItemType_utensil, eMaterial_water)
    ->setTextureName(L"bucket")
    ->setDescriptionId(IDS_ITEM_BUCKET)
    ->setUseDescriptionId(IDS_DESC_BUCKET)
    ->setMaxStackSize(16);
```

## Key Virtual Methods Reference

| Method | When Called |
|--------|------------|
| `use(itemInstance, level, player)` | Right-click with item in hand (not aiming at a block) |
| `useOn(itemInstance, player, level, x, y, z, face, ...)` | Right-click on a block |
| `hurtEnemy(itemInstance, mob, attacker)` | Hit a mob with the item |
| `mineBlock(itemInstance, level, tile, x, y, z, owner)` | Break a block with the item |
| `getAttackDamage(entity)` | Query attack damage |
| `getDestroySpeed(itemInstance, tile)` | Query mining speed against a tile |
| `canDestroySpecial(tile)` | Whether this item can harvest the tile |
| `useTimeDepleted(itemInstance, level, player)` | Eating/drinking/blocking timer finishes |
| `getUseAnimation(itemInstance)` | Returns `UseAnim_eat`, `UseAnim_block`, etc. |
| `getUseDuration(itemInstance)` | How long in ticks the use action takes |
| `releaseUsing(itemInstance, level, player, durationLeft)` | Use action interrupted (e.g., bow release) |
| `inventoryTick(itemInstance, level, owner, slot, selected)` | Called each tick while in inventory |
| `getEnchantmentValue()` | Enchantability for enchanting table |
| `isValidRepairItem(source, repairItem)` | Whether repairItem can repair this item on an anvil |

## Complete Example: Adding a Ruby Item

**`Item.h`** additions:

```cpp
static Item *ruby;
static const int ruby_Id = 407;
```

**`Item.cpp`** additions:

```cpp
Item *Item::ruby = NULL;

// Inside Item::staticCtor():
Item::ruby = ( new Item(151) )  // 256 + 151 = 407
    ->setBaseItemTypeAndMaterial(eBaseItemType_treasure, eMaterial_emerald)
    ->setTextureName(L"ruby")
    ->setDescriptionId(IDS_ITEM_RUBY)
    ->setUseDescriptionId(IDS_DESC_RUBY);
```

This creates a simple gem item, similar to how emeralds and diamonds are registered. Pair it with a [Ruby Ore block](/lcemp-docs/modding/adding-blocks/) that drops this item.

## Related Guides

- [Getting Started](/lcemp-docs/modding/getting-started/) -- environment setup and the staticCtor pattern
- [Adding Blocks](/lcemp-docs/modding/adding-blocks/) -- create blocks that drop your custom items
