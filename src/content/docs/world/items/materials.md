---
title: Raw Materials
description: Ingots, gems, redstone dust, glowstone dust, and other crafting ingredients registered as simple Item instances.
---

Raw materials are the crafting ingredients and resource items in LCE. Most of them are just plain `Item` instances registered in `Item::staticCtor()` with no special subclass. A few have their own classes for placement or potion brewing.

## Simple Material Items

These items are registered as `new Item(id)` with builder-pattern config. They don't override `useOn`, `use`, or any other methods beyond their stack and texture settings.

| Item | ID | Class | Notes |
|------|----|-------|-------|
| Diamond | 264 | `Item` | Repair item for Diamond tier |
| Iron Ingot | 265 | `Item` | Repair item for Iron tier; `eBaseItemType_treasure`, `eMaterial_iron` |
| Gold Ingot | 266 | `Item` | Repair item for Gold tier; `eBaseItemType_treasure`, `eMaterial_gold` |
| Stick | 280 | `Item` | Crafting ingredient for tools, torches, fences |
| Bowl | 281 | `Item` | Crafting ingredient for mushroom stew |
| Feather | 288 | `Item` | Crafting ingredient for arrows |
| Gunpowder | 289 | `Item` | Brewing formula: `MOD_GUNPOWDER` |
| Wheat | 296 | `Item` | Crafting ingredient for bread, cake |
| Flint | 318 | `Item` | Crafting ingredient for flint and steel, arrows |
| Leather | 334 | `Item` | Repair item for Leather armor |
| Brick | 336 | `Item` | Crafting ingredient for brick blocks |
| Clay Ball | 337 | `Item` | Smelts into brick |
| Paper | 339 | `Item` | Crafting ingredient for books, maps |
| Slime Ball | 341 | `Item` | Crafting ingredient for sticky pistons, magma cream |
| Glowstone Dust | 348 | `Item` | Brewing formula: `MOD_GLOWSTONE` |
| Bone | 352 | `Item` | Crafts into bone meal (dye aux 15) |
| Sugar | 353 | `Item` | Brewing formula: `MOD_SUGAR` |
| Blaze Rod | 369 | `Item` | Crafts into blaze powder |
| Ghast Tear | 370 | `Item` | Brewing formula: `MOD_GHASTTEARS` |
| Gold Nugget | 371 | `Item` | 9 craft into gold ingot |
| Fermented Spider Eye | 376 | `Item` | Brewing formula: `MOD_FERMENTEDEYE` |
| Blaze Powder | 377 | `Item` | Brewing formula: `MOD_BLAZEPOWDER` |
| Magma Cream | 378 | `Item` | Brewing formula: `MOD_MAGMACREAM` |
| Glistering Melon | 382 | `Item` | Brewing formula: `MOD_SPECKLEDMELON` |
| Emerald | 388 | `Item` | Villager trading currency |
| Nether Brick (item) | 405 | `Item` | Crafts into nether brick blocks |
| Nether Quartz | 406 | `Item` | Crafts into quartz blocks |

## Special Material Classes

These materials have their own subclasses with extra behavior.

### CoalItem

**Files:** `Minecraft.World/CoalItem.h`, `Minecraft.World/CoalItem.cpp`

| Property | Value |
|----------|-------|
| ID | 263 |
| Stacked By Data | Yes |

Uses `auxValue` to tell apart Coal (0) and Charcoal (1). Each variant has its own texture and description string.

### RedStoneItem

**Files:** `Minecraft.World/RedStoneItem.h`, `Minecraft.World/RedStoneItem.cpp`

| Property | Value |
|----------|-------|
| ID | 331 |
| Brewing Formula | `MOD_REDSTONE` |

Overrides `useOn` to place redstone dust tile (`Tile::redStoneDust`) on the target block face. Also works as a potion brewing ingredient.

### SeedItem

**Files:** `Minecraft.World/SeedItem.h`, `Minecraft.World/SeedItem.cpp`

Seeds are plantable items that place crop tiles on farmland.

| Item | ID | Places |
|------|----|--------|
| Wheat Seeds | 295 | Wheat crop tile |
| Pumpkin Seeds | 361 | Stem tile (pumpkin) |
| Melon Seeds | 362 | Stem tile (melon) |
| Nether Wart | 372 | Nether stalk tile; brewing formula: `MOD_NETHERWART` |

### Arrow

| Property | Value |
|----------|-------|
| ID | 262 |
| Class | `Item` |

A simple item with no special behavior. Gets consumed by `BowItem` when firing. See [Combat Items](/lce-docs/world/items/combat/) for bow mechanics.

## Potion Brewing Ingredients

Several material items are tagged with potion brewing formulas through `setPotionBrewingFormula()`. You can put these items in a brewing stand to modify potions.

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

See [Effects (Potions)](/lce-docs/world/effects/) for the full potion system.

## MinecraftConsoles differences

MinecraftConsoles adds one new material item and renames another:

### New items

- **Nether Star** (`netherStar`) is added as a drop from the Wither boss. It's a `SimpleFoiledItem`, meaning it always shows the enchantment glint effect. Used as a crafting ingredient for beacons.

### Renamed items

- `sulphur` is renamed to `gunpowder` to match vanilla Minecraft naming.

The rest of the raw materials (ingots, gems, redstone, glowstone dust, sticks, brewing ingredients, etc.) are the same between the two codebases. Same IDs, same brewing formulas, same properties.
