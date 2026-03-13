---
title: Food
description: FoodItem and its subclasses, covering nutrition, saturation, food constants, exhaustion, and all food items with their stats and effects.
---

Food items restore hunger and saturation when you eat them. The system is built around `FoodItem` and its subclasses: `BowlFoodItem`, `SeedFoodItem`, and `GoldenAppleItem`.

## FoodItem

**Files:** `Minecraft.World/FoodItem.h`, `Minecraft.World/FoodItem.cpp`

Eating takes **32 ticks** (`20 * 1.6`) and plays the `UseAnim_eat` animation. You can only eat food when your hunger bar isn't full, unless `canAlwaysEat` is set (like with golden apples).

Each food item is created with:
- **nutrition** - hunger points restored
- **saturationModifier** - multiplied by `nutrition * 2` to get the saturation restored
- **isMeat** - whether wolves can eat it

## FoodConstants

**Files:** `Minecraft.World/FoodConstants.h`, `Minecraft.World/FoodConstants.cpp`

### Hunger and Saturation Caps

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_FOOD` | 20 | Maximum hunger bar |
| `MAX_SATURATION` | 20.0 | Maximum saturation |

### Saturation Modifiers

| Constant | Value | Used By |
|----------|-------|---------|
| `FOOD_SATURATION_POOR` | 0.1 | Cookies, rotten flesh |
| `FOOD_SATURATION_LOW` | 0.3 | Apples, raw meats, melon |
| `FOOD_SATURATION_NORMAL` | 0.6 | Bread, cooked fish, cooked chicken |
| `FOOD_SATURATION_GOOD` | 0.8 | Cooked pork, cooked beef |
| `FOOD_SATURATION_MAX` | 1.0 | (Not used by any food in the current code) |
| `FOOD_SATURATION_SUPERNATURAL` | 1.2 | Golden apple, golden carrot |

### Exhaustion Values

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

## Complete Food Table

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

## BowlFoodItem

**File:** `Minecraft.World/BowlFoodItem.h`

This extends `FoodItem` and overrides `useTimeDepleted` to give you back an empty bowl (ID 281) after eating. Used for mushroom stew (ID 282).

## GoldenAppleItem

**Files:** `Minecraft.World/GoldenAppleItem.h`, `Minecraft.World/GoldenAppleItem.cpp`

The `auxValue` tells apart regular and enchanted golden apples:

| Variant | Aux Value | Rarity | Effects |
|---------|-----------|--------|---------|
| Regular | 0 | `rare` | Regeneration I for 5 seconds |
| Enchanted | >0 | `epic` | Regeneration IV 30s, Damage Resistance 300s, Fire Resistance 300s |

The enchanted version renders with a foil (glint) effect. Both variants have `canAlwaysEat` set, so you can eat them even when your hunger bar is full.

## SeedFoodItem

**Files:** `Minecraft.World/SeedFoodItem.h`, `Minecraft.World/SeedFoodItem.cpp`

This extends `FoodItem` and can be both eaten and planted on farmland (it overrides `useOn`). Used for:

| Item | ID | Nutrition | Plants |
|------|----|-----------|--------|
| Carrot | 391 | 4 | Carrot crop tile |
| Potato | 392 | 1 | Potato crop tile |

## MinecraftConsoles differences

The food system is the same between LCE and MinecraftConsoles. Same `FoodItem` class, same nutrition values, same saturation modifiers, same exhaustion constants. No new food items are added in the MinecraftConsoles version.

The golden apple mechanics, bowl food, and seed food subclasses are all identical.
