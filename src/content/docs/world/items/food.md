---
title: Food Items
description: Food nutrition, saturation, effects, and all food types in LCE.
---

## FoodItem

**Files:** `Minecraft.World/FoodItem.h`, `Minecraft.World/FoodItem.cpp`

Food items restore hunger and saturation when eaten. The eat duration is **32 ticks** (`20 * 1.6`).

## FoodConstants

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

## Exhaustion Values

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

Extends `FoodItem`. Overrides `useTimeDepleted` to return an empty bowl after eating. Used for mushroom stew (ID 282).

## GoldenAppleItem

**Files:** `Minecraft.World/GoldenAppleItem.h`, `Minecraft.World/GoldenAppleItem.cpp`

Uses `auxValue` to differentiate regular (0) and enchanted (>0) golden apples. Enchanted variant has `Rarity::epic`, renders with foil effect, and grants Regeneration IV for 30s, Damage Resistance for 300s, and Fire Resistance for 300s. The `canAlwaysEat` flag is set, allowing consumption even with a full hunger bar.

## SeedFoodItem

**File:** `Minecraft.World/SeedFoodItem.h`

Extends `FoodItem`. Can be both eaten and planted on farmland (overrides `useOn`). Used for carrots (ID 391) and potatoes (ID 392).
