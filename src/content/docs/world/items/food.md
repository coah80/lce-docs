---
title: Food
description: FoodItem and its subclasses, covering nutrition, saturation, food constants, exhaustion, and all food items with their stats and effects.
---

Food items restore hunger and saturation when you eat them. The system is built around `FoodItem` and its subclasses: `BowlFoodItem`, `SeedFoodItem`, and `GoldenAppleItem`.

## FoodItem

**Files:** `Minecraft.World/FoodItem.h`, `Minecraft.World/FoodItem.cpp`

### Constructor

```cpp
FoodItem(int id, int nutrition, float saturationModifier, bool isMeat);
```

The constructor calls `Item(id)` (which does `this->id = 256 + id`) and then stores the food-specific fields. It also sets `tabToDisplayOn` to the food creative tab.

There is a second constructor that also takes an `Item *craftingRemainingItem` parameter, used for foods that leave something behind (like bowls).

### Member variables

| Field | Type | Description |
|-------|------|-------------|
| `nutrition` | `int` | Hunger points restored |
| `saturationModifier` | `float` | Multiplied by `nutrition * 2` to get saturation restored |
| `isMeat` | `bool` | Whether wolves can eat it |
| `canAlwaysEat` | `bool` | If `true`, edible even when hunger is full. Default `false` |
| `effectId` | `int` | Status effect applied after eating. 0 means no effect |
| `effectDuration` | `int` | Duration of the status effect in seconds |
| `effectAmplifier` | `int` | Amplifier for the status effect (0 = level I, 1 = level II, etc.) |
| `effectProbability` | `float` | Chance (0.0 to 1.0) the effect is applied |

### How eating works

The eating flow goes through several methods:

1. **`use()`** checks `canEat()`. If the player can eat (hunger not full, or `canAlwaysEat` is set), calls `player->startUsingItem()` which begins the eating animation timer.

2. **Eating duration** is the constant `EAT_DURATION = (int)(20 * 1.6f)` which is **32 ticks** (about 1.6 seconds). The `getUseDuration()` method returns this value. The animation is `UseAnim_eat`.

3. **`useTimeDepleted()`** runs when the timer finishes:
   - Decrements the item count by 1
   - Calls `player->eat(nutrition, saturationModifier)` which adds hunger and saturation to the player's food data
   - Plays the `random.burp` sound at volume 0.5, pitch between 0.9 and 1.0
   - Calls `addEatEffect()` to apply any status effect

4. **`addEatEffect()`** checks `effectId != 0`, rolls against `effectProbability`, and if it passes, applies a `MobEffectInstance` with the stored id, duration (converted to ticks by multiplying by 20), and amplifier.

### Property setters

```cpp
FoodItem *setEatEffect(int effectId, int durationSec, int amplifier, float probability);
FoodItem *setCanAlwaysEat();
```

Both return `this` for chaining.

## FoodConstants

**Files:** `Minecraft.World/FoodConstants.h`, `Minecraft.World/FoodConstants.cpp`

This class holds all the constants that control the hunger system. There are no instances of this class. Everything is static.

### Hunger and saturation caps

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_FOOD` | 20 | Maximum hunger bar value |
| `MAX_SATURATION` | 20.0 | Maximum saturation (equals `MAX_FOOD` cast to float) |
| `START_SATURATION` | 5.0 | Saturation when you spawn or respawn (`MAX_SATURATION / 4`) |
| `SATURATION_FLOOR` | 2.5 | Minimum saturation threshold (`MAX_SATURATION / 8`) |

### Exhaustion and healing

| Constant | Value | Description |
|----------|-------|-------------|
| `EXHAUSTION_DROP` | 4.0 | When total exhaustion reaches this, saturation drops by 1 (or hunger drops by 1 if saturation is 0) |
| `HEALTH_TICK_COUNT` | 80 | Ticks between health changes from food (4 seconds) |
| `HEAL_LEVEL` | 18 | Hunger must be at or above 18 to regenerate health |
| `STARVE_LEVEL` | 0 | Hunger at or below 0 causes starvation damage |

### Saturation modifiers

These constants are used when registering food items. The actual saturation restored is `nutrition * saturationModifier * 2`.

| Constant | Value | Used By |
|----------|-------|---------|
| `FOOD_SATURATION_POOR` | 0.1 | Cookies, rotten flesh |
| `FOOD_SATURATION_LOW` | 0.3 | Apples, raw meats, melon, poisonous potato, pumpkin pie |
| `FOOD_SATURATION_NORMAL` | 0.6 | Bread, cooked fish, cooked chicken, carrot, baked potato |
| `FOOD_SATURATION_GOOD` | 0.8 | Cooked pork, cooked beef, spider eye |
| `FOOD_SATURATION_MAX` | 1.0 | Not used by any food in the current code |
| `FOOD_SATURATION_SUPERNATURAL` | 1.2 | Golden apple, golden carrot |

### Exhaustion values

These control how fast your hunger bar drains. Every action adds to a running exhaustion total. When the total hits `EXHAUSTION_DROP` (4.0), it resets and one saturation (or hunger) point is consumed.

| Action | Exhaustion | Constant |
|--------|-----------|----------|
| Jump | 0.2 | `EXHAUSTION_JUMP` |
| Sprint + Jump | 0.8 | `EXHAUSTION_SPRINT_JUMP` (= `JUMP * 4`) |
| Mine a block | 0.025 | `EXHAUSTION_MINE` |
| Attack | 0.3 | `EXHAUSTION_ATTACK` |
| Take damage | 0.1 | `EXHAUSTION_DAMAGE` |
| Walk (per meter) | 0.01 | `EXHAUSTION_WALK` |
| Sprint (per meter) | 0.1 | `EXHAUSTION_SPRINT` (= `WALK * 10`) |
| Swim (per meter) | 0.015 | `EXHAUSTION_SWIM` |

Note that `EXHAUSTION_SPRINT_JUMP` and `EXHAUSTION_SPRINT` are computed from other constants, not hardcoded separately.

## Complete food table

| Food | ID | Nutrition | Saturation Mod | Saturation Restored | Is Meat | Eat Effect |
|------|----|-----------|---------------|---------------------|---------|------------|
| Apple | 260 | 4 | 0.3 (Low) | 2.4 | No | -- |
| Mushroom Stew | 282 | 6 | 0.6 (Normal) | 7.2 | No | Returns bowl |
| Bread | 297 | 5 | 0.6 (Normal) | 6.0 | No | -- |
| Raw Porkchop | 319 | 3 | 0.3 (Low) | 1.8 | Yes | -- |
| Cooked Porkchop | 320 | 8 | 0.8 (Good) | 12.8 | Yes | -- |
| Golden Apple | 322 | 4 | 1.2 (Supernatural) | 9.6 | No | See below |
| Raw Fish | 349 | 2 | 0.3 (Low) | 1.2 | No | -- |
| Cooked Fish | 350 | 5 | 0.6 (Normal) | 6.0 | No | -- |
| Cookie | 357 | 2 | 0.1 (Poor) | 0.4 | No | -- |
| Melon Slice | 360 | 2 | 0.3 (Low) | 1.2 | No | -- |
| Raw Beef | 363 | 3 | 0.3 (Low) | 1.8 | Yes | -- |
| Cooked Beef (Steak) | 364 | 8 | 0.8 (Good) | 12.8 | Yes | -- |
| Raw Chicken | 365 | 2 | 0.3 (Low) | 1.2 | Yes | 30% Hunger I 30s |
| Cooked Chicken | 366 | 6 | 0.6 (Normal) | 7.2 | Yes | -- |
| Rotten Flesh | 367 | 4 | 0.1 (Poor) | 0.8 | Yes | 80% Hunger I 30s |
| Spider Eye | 375 | 2 | 0.8 (Good) | 3.2 | No | 100% Poison I 5s |
| Carrot | 391 | 4 | 0.6 (Normal) | 4.8 | No | Plantable (SeedFoodItem) |
| Potato | 392 | 1 | 0.3 (Low) | 0.6 | No | Plantable (SeedFoodItem) |
| Baked Potato | 393 | 6 | 0.6 (Normal) | 7.2 | No | -- |
| Poisonous Potato | 394 | 2 | 0.3 (Low) | 1.2 | No | 60% Poison I 5s |
| Golden Carrot | 396 | 6 | 1.2 (Supernatural) | 14.4 | No | Potion ingredient only |
| Pumpkin Pie | 400 | 8 | 0.3 (Low) | 4.8 | No | -- |

The "Saturation Restored" column is calculated as `nutrition * saturationModifier * 2`.

## BowlFoodItem

**File:** `Minecraft.World/BowlFoodItem.h`

Extends `FoodItem`. The constructor sets `maxStackSize = 1` (bowls of stew do not stack).

When you finish eating, `useTimeDepleted()` gives you back an empty bowl (`Item::bowl`, ID 281). Used for mushroom stew (ID 282).

## GoldenAppleItem

**Files:** `Minecraft.World/GoldenAppleItem.h`, `Minecraft.World/GoldenAppleItem.cpp`

The constructor calls `setStackedByData(true)` so regular and enchanted golden apples stack separately based on aux value.

### Variants

| Variant | Aux Value | Rarity | Foil (Glint) |
|---------|-----------|--------|-------------|
| Regular | 0 | `rare` (aqua color) | No |
| Enchanted | >0 | `epic` (magenta color) | Yes |

### Eat effects

`addEatEffect()` is overridden with special behavior:

- **Enchanted (aux > 0):** Regeneration IV for 30 seconds (amplifier 3), Damage Resistance for 300 seconds (amplifier 0), Fire Resistance for 300 seconds (amplifier 0).
- **Regular (aux == 0):** Falls through to the base `FoodItem::addEatEffect()`, which applies Regeneration I for 5 seconds (set during registration with `setEatEffect`).

Both variants have `canAlwaysEat` set to `true`, so you can eat them even when your hunger bar is full.

### isFoil

`isFoil()` returns `true` when `auxValue > 0`, which makes the enchanted golden apple render with the shimmery enchantment glint effect.

## SeedFoodItem

**Files:** `Minecraft.World/SeedFoodItem.h`, `Minecraft.World/SeedFoodItem.cpp`

Extends `FoodItem` and can be both eaten and planted on farmland.

### Constructor

```cpp
SeedFoodItem(int id, int nutrition, float satMod, int resultId, int targetLand);
```

| Parameter | Description |
|-----------|-------------|
| `resultId` | The tile ID that gets placed when you plant (e.g., carrot crop tile) |
| `targetLand` | The tile ID this can be planted on (farmland) |

### Planting behavior

`useOn()` checks:
1. The face must be the top face (UP).
2. The player must be able to use the block.
3. The player must be able to use the block above.
4. The block at the position must be `targetLand` (farmland).
5. The block above must be air.

If all pass, it places the `resultId` tile above the farmland and decrements the item count. If the player is not looking at a valid planting spot, the food just gets eaten through the normal `FoodItem::use()` path.

### SeedFoodItem items

| Item | ID | Nutrition | Plants |
|------|----|-----------|--------|
| Carrot | 391 | 4 | Carrot crop tile |
| Potato | 392 | 1 | Potato crop tile |

## MinecraftConsoles differences

The food system is the same between LCEMP and MinecraftConsoles. Same `FoodItem` class, same nutrition values, same saturation modifiers, same exhaustion constants. No new food items are added in the MinecraftConsoles version.

The golden apple mechanics, bowl food, and seed food subclasses are all identical.
