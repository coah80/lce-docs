---
title: Armor
description: ArmorItem class, armor materials, defense values, durability multipliers, slot system, and leather dyeing via NBT.
---

The armor system uses `ArmorItem` to handle wearable protection. There are five material tiers and four equipment slots.

## ArmorItem

**Files:** `Minecraft.World/ArmorItem.h`, `Minecraft.World/ArmorItem.cpp`

Each `ArmorItem` is built with an `ArmorMaterial`, a slot index, and a render index. Durability is calculated as `healthPerSlot[slot] * material.durabilityMultiplier`. Defense and enchantability come from the material.

## ArmorMaterial

**Defined in:** `ArmorItem::ArmorMaterial` (nested class in `ArmorItem.h`)

Each material defines a durability multiplier, per-slot defense values, and enchantability.

```cpp
const ArmorMaterial *CLOTH   = new ArmorMaterial( 5, {1,3,2,1}, 15);
const ArmorMaterial *CHAIN   = new ArmorMaterial(15, {2,5,4,1}, 12);
const ArmorMaterial *IRON    = new ArmorMaterial(15, {2,6,5,2},  9);
const ArmorMaterial *GOLD    = new ArmorMaterial( 7, {2,5,3,1}, 25);
const ArmorMaterial *DIAMOND = new ArmorMaterial(33, {3,8,6,3}, 10);
```

| Material | Durability Multiplier | Defense (H/C/L/B) | Enchantability | Repair Item |
|----------|----------------------|-------------------|----------------|-------------|
| Cloth (Leather) | 5 | 1 / 3 / 2 / 1 | 15 | Leather (334) |
| Chain | 15 | 2 / 5 / 4 / 1 | 12 | Iron Ingot (265) |
| Iron | 15 | 2 / 6 / 5 / 2 | 9 | Iron Ingot (265) |
| Gold | 7 | 2 / 5 / 3 / 1 | 25 | Gold Ingot (266) |
| Diamond | 33 | 3 / 8 / 6 / 3 | 10 | Diamond (264) |

**Total defense for a full set:** Leather 7, Chain 12, Iron 15, Gold 11, Diamond 20.

## Armor Slots

| Constant | Value | Slot Name |
|----------|-------|-----------|
| `SLOT_HEAD` | 0 | Helmet |
| `SLOT_TORSO` | 1 | Chestplate |
| `SLOT_LEGS` | 2 | Leggings |
| `SLOT_FEET` | 3 | Boots |

## Health Per Slot (Base Durability)

Durability is calculated as `healthPerSlot[slot] * durabilityMultiplier`.

| Slot | Base Health |
|------|-------------|
| Helmet | 11 |
| Chestplate | 16 |
| Leggings | 15 |
| Boots | 13 |

## Complete Armor Table

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

**Repair items:** Leather uses `leather` (334), Chain and Iron use `ironIngot` (265), Gold uses `goldIngot` (266), Diamond uses `diamond` (264).

## Leather Armor Dyeing

Leather armor (`ArmorMaterial::CLOTH`) supports custom colors through NBT. The color data lives at `tag.display.color` as an integer. The `DEFAULT_LEATHER_COLOR` falls back to `eMinecraftColour_Armour_Default_Leather_Colour`.

Leather armor uses two sprite layers (base + overlay) for dyeing. The base layer gets tinted with the custom color, while the overlay renders untinted for detail.

Dyeing happens through the `ArmorDyeRecipe` crafting recipe, which combines leather armor with one or more `DyePowderItem` instances. Check out [Crafting & Recipes](/lcemp-docs/world/crafting/) for more on that.
