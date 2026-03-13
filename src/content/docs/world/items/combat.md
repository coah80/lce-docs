---
title: Combat Items
description: Bow draw mechanics, ender pearls, snowballs, fire charges, potions, and other projectile items.
---

Combat items encompass ranged weapons and throwable projectiles. For melee weapons (swords), see [Tools & Weapons](/lcemp-docs/world/items/tools/).

## BowItem

**Files:** `Minecraft.World/BowItem.h`, `Minecraft.World/BowItem.cpp`

| Property | Value |
|----------|-------|
| ID | 261 |
| Max Durability | 384 |
| Max Draw Duration | 20 ticks (1 second) |
| Enchantability | 1 |
| Stack Size | 1 |
| Use Animation | `UseAnim_bow` |

### Draw Mechanics

The bow uses `releaseUsing` rather than `useTimeDepleted` -- power is calculated when the player releases the use button:

```cpp
float pow = timeHeld / (float)MAX_DRAW_DURATION;
pow = ((pow * pow) + pow * 2) / 3;
// Clamped to [0.1, 1.0]
```

The arrow entity is created with velocity `pow * 2.0f`. Full-draw arrows (pow == 1.0) are flagged as **critical**.

The maximum use duration is `20 * 60 * 60` ticks (one hour), giving the player unlimited time to hold the draw.

### Enchantment Support

| Enchantment | Effect |
|-------------|--------|
| Power (`arrowBonus`) | Adds `level * 0.5 + 0.5` to arrow base damage |
| Punch (`arrowKnockback`) | Sets arrow knockback to enchantment level |
| Flame (`arrowFire`) | Sets arrow on fire for 100 ticks |
| Infinity (`arrowInfinite`) | Fires without consuming arrows; arrows drop with `PICKUP_CREATIVE_ONLY` |

Creative mode and Infinity enchantment both allow firing without consuming arrows from inventory.

### Durability

Consumes **1 durability per shot**, applied via `itemInstance->hurt(1, player)`.

### Draw Icons

Three pull textures are registered (`bow_pull_0`, `bow_pull_1`, `bow_pull_2`) for the draw animation stages. The `getDrawnIcon(int amount)` method returns the appropriate icon based on draw progress.

## PotionItem

**Files:** `Minecraft.World/PotionItem.h`, `Minecraft.World/PotionItem.cpp`

| Property | Value |
|----------|-------|
| ID | 373 |
| Drink Duration | 32 ticks |
| Stack Size | 1 |
| Use Animation | `UseAnim_drink` |

Potions use `auxValue` to encode potion type and modifiers. Throwable (splash) potions are determined by `isThrowable(auxValue)`. When thrown, a `ThrownPotion` entity is created.

The item has multiple sprite layers (base + overlay for liquid color) and caches mob effects per aux value in an `unordered_map<int, vector<MobEffectInstance*>*>`.

For the full potion effect system, see [Effects (Potions)](/lcemp-docs/world/effects/).

## Throwable Items

All throwable items follow a similar pattern: right-click calls `use()`, which decrements the stack, plays a bow-like sound, and spawns a projectile entity on the server side.

### SnowballItem

**Files:** `Minecraft.World/SnowballItem.h`, `Minecraft.World/SnowballItem.cpp`

| Property | Value |
|----------|-------|
| ID | 332 |
| Stack Size | 16 |
| Projectile Entity | `Snowball` |

Spawns a `Snowball` entity on use. Deals knockback but no damage to most mobs; deals 3 damage to Blazes.

### EnderpearlItem

**Files:** `Minecraft.World/EnderpearlItem.h`, `Minecraft.World/EnderpearlItem.cpp`

| Property | Value |
|----------|-------|
| ID | 368 |
| Stack Size | 16 |
| Projectile Entity | `ThrownEnderpearl` |

Spawns a `ThrownEnderpearl` entity on use. Teleports the player to the impact location and deals 5 fall damage. Cannot be thrown while riding an entity (`player->riding != NULL`). Creative mode does not consume the pearl.

### EggItem

| Property | Value |
|----------|-------|
| ID | 344 |
| Stack Size | 16 |
| Projectile Entity | `ThrownEgg` |

Spawns a `ThrownEgg` entity. Has a 1/8 chance of spawning a chicken on impact, with a further 1/32 chance of spawning four chickens.

### ExperienceItem (Bottle o' Enchanting)

| Property | Value |
|----------|-------|
| ID | 384 |
| Stack Size | 64 |
| Projectile Entity | `ThrownExpBottle` |

Spawns a `ThrownExpBottle` entity that releases experience orbs on impact.

## FireChargeItem

**Files:** `Minecraft.World/FireChargeItem.h`, `Minecraft.World/FireChargeItem.cpp`

| Property | Value |
|----------|-------|
| ID | 385 |
| Stack Size | 64 |
| Crafting Type | `eBaseItemType_torch` |

Unlike other combat items, fire charges use `useOn` rather than `use` -- they must be targeted at a block face. The fire charge places a fire block at the adjacent position and plays the `FIRE_IGNITE` sound. Consumed on use (not in Creative mode).

Has a secondary icon (`dragonFireball`) for aux value > 0, used by the Ender Dragon's fireball projectile.

## Potion Brewing Ingredients

Several items are tagged with potion brewing formulas via `setPotionBrewingFormula()`. See [Raw Materials](/lcemp-docs/world/items/materials/) for the full brewing ingredient table.

## Combat Item ID Registry

| ID | Item | Type |
|----|------|------|
| 261 | Bow | BowItem |
| 262 | Arrow | Item |
| 332 | Snowball | SnowballItem |
| 344 | Egg | EggItem |
| 368 | Ender Pearl | EnderpearlItem |
| 373 | Potion | PotionItem |
| 384 | Bottle o' Enchanting | ExperienceItem |
| 385 | Fire Charge | FireChargeItem |
