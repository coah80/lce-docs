---
title: Raw Materials & Crafting Ingredients
description: Ingots, diamonds, redstone, glowstone dust, string, leather, and other crafting materials.
---

These items serve primarily as crafting ingredients, raw materials, or intermediary components. They use the base `Item` class or simple subclasses with minimal custom behavior.

## Ore Products & Ingots

| ID | Item | Type | Notes |
|----|------|------|-------|
| 263 | Coal | CoalItem | Coal (aux 0) and Charcoal (aux 1) via aux value |
| 264 | Diamond | Item | Repairs diamond tools/armor |
| 265 | Iron Ingot | Item | Repairs iron tools/armor |
| 266 | Gold Ingot | Item | Repairs gold tools/armor |
| 371 | Gold Nugget | Item | 9 craft into 1 gold ingot |
| 388 | Emerald | Item | Villager trading currency |
| 405 | Nether Brick (item) | Item | Used in nether brick recipes |
| 406 | Nether Quartz | Item | Used in quartz block recipes |

## Crafting Components

| ID | Item | Type | Notes |
|----|------|------|-------|
| 280 | Stick | Item | Fundamental crafting ingredient |
| 288 | Feather | Item | Arrow crafting |
| 289 | Gunpowder | Item | TNT, fire charges; brewing formula `MOD_GUNPOWDER` |
| 296 | Wheat | Item | Bread, cake crafting |
| 318 | Flint | Item | Arrow and flint & steel crafting |
| 334 | Leather | Item | Leather armor, books; repairs leather armor |
| 336 | Brick | Item | Brick block crafting |
| 337 | Clay Ball | Item | Brick smelting |
| 339 | Paper | Item | Maps, books |
| 341 | Slime Ball | Item | Sticky pistons, leads |
| 352 | Bone | Item | Bone meal (dye) source |
| 353 | Sugar | Item | Cake, pumpkin pie; brewing formula `MOD_SUGAR` |

## Nether & Brewing Materials

| ID | Item | Type | Notes |
|----|------|------|-------|
| 348 | Glowstone Dust | Item | Brewing formula `MOD_GLOWSTONE` |
| 369 | Blaze Rod | Item | Blaze powder, brewing stands |
| 370 | Ghast Tear | Item | Brewing formula `MOD_GHASTTEARS` |
| 376 | Fermented Spider Eye | Item | Brewing formula `MOD_FERMENTEDEYE` |
| 377 | Blaze Powder | Item | Brewing formula `MOD_BLAZEPOWDER` |
| 378 | Magma Cream | Item | Brewing formula `MOD_MAGMACREAM` |
| 382 | Glistering Melon | Item | Brewing formula `MOD_SPECKLEDMELON` |

## Redstone Components

| ID | Item | Type | Notes |
|----|------|------|-------|
| 331 | Redstone | RedStoneItem | Places redstone dust; brewing formula `MOD_REDSTONE` |

## Seeds

| ID | Item | Type | Notes |
|----|------|------|-------|
| 295 | Wheat Seeds | SeedItem | Plants wheat on farmland |
| 361 | Pumpkin Seeds | SeedItem | Plants pumpkin stem on farmland |
| 362 | Melon Seeds | SeedItem | Plants melon stem on farmland |
| 372 | Nether Wart | SeedItem | Plants on soul sand; brewing formula `MOD_NETHERWART` |

## Utility Items

| ID | Item | Type | Notes |
|----|------|------|-------|
| 329 | Saddle | SaddleItem | Equips on pigs; stack size 1 |
| 374 | Glass Bottle | BottleItem | Collects water for brewing |
| 381 | Eye of Ender | EnderEyeItem | Locates strongholds, fills portal frames |
| 398 | Carrot on a Stick | CarrotOnAStickItem | Controls saddled pigs |
