---
title: Combat Items
description: Bow, arrows, snowballs, ender pearls, fire charges, potions, and other combat-related items.
---

## BowItem

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

## FishingRodItem

**Files:** `Minecraft.World/FishingRodItem.h`, `Minecraft.World/FishingRodItem.cpp`

| Property | Value |
|----------|-------|
| Max Durability | 64 |
| Stack Size | 1 |
| Hand Equipped | Yes |
| Mirrored Art | Yes |

Right-click toggles between casting and reeling. When cast, creates a `FishingHook` entity. When reeled, calls `FishingHook::retrieve()` and applies durability damage equal to the return value.

## PotionItem

**Files:** `Minecraft.World/PotionItem.h`, `Minecraft.World/PotionItem.cpp`

| Property | Value |
|----------|-------|
| Drink Duration | 32 ticks |
| Stack Size | 1 (default) |
| Use Animation | `UseAnim_drink` |

Potions use `auxValue` to encode potion type and modifiers. Throwable (splash) potions are determined by `isThrowable(auxValue)`. The item has multiple sprite layers (base + overlay for liquid color) and caches mob effects per aux value in an `unordered_map<int, vector<MobEffectInstance*>*>`.

## Throwable Items

| Item Class | Item | ID | Notes |
|------------|------|----|-------|
| `SnowballItem` | Snowball | 332 | Throwable projectile |
| `EggItem` | Egg | 344 | Throwable; chance to spawn chicken |
| `EnderpearlItem` | Ender Pearl | 368 | Throwable; teleports player; stack size 16 |
| `ExperienceItem` | Bottle o' Enchanting | 384 | Throwable; spawns experience orbs |
| `FireChargeItem` | Fire Charge | 385 | Places fire; classified as torch type for crafting menu |

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

## Combat Item ID Registry

| ID | Item | Type |
|----|------|------|
| 261 | Bow | BowItem |
| 262 | Arrow | Item |
| 332 | Snowball | SnowballItem |
| 344 | Egg | EggItem |
| 346 | Fishing Rod | FishingRodItem |
| 368 | Ender Pearl | EnderpearlItem |
| 373 | Potion | PotionItem |
| 384 | Bottle o' Enchanting | ExperienceItem |
| 385 | Fire Charge | FireChargeItem |
