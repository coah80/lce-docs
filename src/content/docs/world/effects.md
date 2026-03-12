---
title: Effects (Potions)
description: Status effects and the potion/brewing system in LCEMP.
---

The status effect system is built around three main classes: `MobEffect` (the effect type definition), `MobEffectInstance` (an active effect on a mob with duration and amplifier), and `PotionBrewing` (the bit-manipulation system that maps potion data values to effects).

**Key source files:** `Minecraft.World/MobEffect.h`, `Minecraft.World/MobEffectInstance.h`, `Minecraft.World/PotionBrewing.h`, `Minecraft.World/BrewingStandTileEntity.h`, `Minecraft.World/PotionItem.h`

## Effect registry

Effects are stored in a static array of 32 slots (`MobEffect::effects[32]`). Each effect is constructed with an ID, a harmful/beneficial flag, and a color enum value.

## All effect types

| ID | Static name | Harmful | Icon | Duration modifier |
|---|---|---|---|---|
| 1 | `movementSpeed` | No | Speed | 1.0 (default) |
| 2 | `movementSlowdown` | Yes | Slowness | 0.5 (harmful default) |
| 3 | `digSpeed` | No | Haste | 1.5 |
| 4 | `digSlowdown` | Yes | Mining Fatigue | 0.5 |
| 5 | `damageBoost` | No | Strength | 1.0 |
| 6 | `heal` | No | (none) | 1.0 (instantaneous) |
| 7 | `harm` | Yes | (none) | 0.5 (instantaneous) |
| 8 | `jump` | No | Jump Boost | 1.0 |
| 9 | `confusion` | Yes | Nausea | 0.25 |
| 10 | `regeneration` | No | Regeneration | 0.25 |
| 11 | `damageResistance` | No | Resistance | 1.0 |
| 12 | `fireResistance` | No | Fire Resistance | 1.0 |
| 13 | `waterBreathing` | No | Water Breathing | 1.0 |
| 14 | `invisibility` | No | Invisibility | 1.0 |
| 15 | `blindness` | Yes | Blindness | 0.25 |
| 16 | `nightVision` | No | Night Vision | 1.0 |
| 17 | `hunger` | Yes | Hunger | 0.5 |
| 18 | `weakness` | Yes | Weakness | 0.5 |
| 19 | `poison` | Yes | Poison | 0.25 |
| 20--31 | `reserved_20` ... `reserved_31` | --- | --- | Not initialized (NULL) |

IDs 6 and 7 (Heal and Harm) are `InstantenousMobEffect` subclasses, meaning they apply immediately rather than ticking over time.

## Duration modifier

The `durationModifier` field scales the base duration calculated by `PotionBrewing`. Harmful effects default to `0.5`, beneficial to `1.0`. Some effects override this:

- Haste: `1.5` (longer than normal)
- Nausea, Regeneration, Blindness, Poison: `0.25` (much shorter)

## MobEffectInstance

`MobEffectInstance` represents an active effect applied to a mob. It stores three fields, all sent over the network:

| Field | Network type | Description |
|---|---|---|
| `id` | byte | The effect ID from the MobEffect table |
| `duration` | short | Remaining ticks |
| `amplifier` | byte | Potency level (0 = weakest) |

### Tick behavior

Each game tick, `MobEffectInstance::tick()` is called on the mob's active effects:

1. Check if the effect's `isDurationEffectTick()` returns true for the current remaining duration and amplifier.
2. If yes, call `applyEffect()` which delegates to `MobEffect::applyEffectTick()`.
3. Decrement duration by 1.
4. Return `true` if duration is still positive (effect continues).

### Effect application logic

The `applyEffectTick()` method handles periodic effects:

- **Regeneration**: Heals 1 HP if below max health.
- **Poison**: Deals 1 magic damage if health is above 1 (cannot kill).
- **Hunger**: Causes food exhaustion equal to `EXHAUSTION_MINE * (amplifier + 1)` every tick.
- **Heal** (on undead) / **Harm** (on non-undead): Deals `6 << amplifier` magic damage.
- **Harm** (on undead) / **Heal** (on non-undead): Heals `6 << amplifier` HP.

The heal/harm inversion for undead mobs is handled through `mob->isInvertedHealAndHarm()`.

### Tick intervals

Regeneration and Poison tick at intervals of `25 >> amplifier` ticks (25, 12, 6... ticks). Hunger ticks every single tick. Instantaneous effects (`heal`, `harm`) always tick when duration >= 1.

### Update rules

When the same effect is applied again, `MobEffectInstance::update()` follows these rules:

- If the new amplifier is **higher**, replace both amplifier and duration.
- If the amplifier is **equal** and the new duration is **longer**, extend the duration.
- Otherwise, keep the existing effect unchanged.

### Hash code

4J changed the hash code from just the ID to a combined value encoding all three fields:

```cpp
(id & 0xff) | ((amplifier & 0xff) << 8) | ((duration & 0xffff) << 16)
```

## Instantaneous effects

`InstantenousMobEffect` (subclass of `MobEffect`) overrides two methods:

- `isInstantenous()` returns `true`
- `isDurationEffectTick()` returns `true` when `remainingDuration >= 1`

The `applyInstantenousEffect()` method handles splash potion scaling --- the `scale` parameter (based on distance from the splash) multiplies the base `6 << amplifier` value.

## Duration formatting

`MobEffect::formatDuration()` converts the remaining duration in ticks to a `M:SS` string using `SharedConstants::TICKS_PER_SECOND`.

## Network packets

Two packet types handle effect synchronization:

- `UpdateMobEffectPacket` -- sent when an effect is applied or updated
- `RemoveMobEffectPacket` -- sent when an effect expires or is removed

## Potion brewing system

LCEMP uses a **bit-manipulation brewing system** where each potion's data value is a 15-bit integer. The bits encode which effects the potion grants, their duration/amplifier, and whether the potion is throwable.

### Simplified brewing mode

LCEMP compiles with `SIMPLIFIED_BREWING = true` (a compile-time constant). This removes the `boil()`, `shake()`, and `stirr()` operations from the original Java brewing system and uses direct bit formulas instead.

### Bit layout

| Bits | Purpose |
|---|---|
| 0--3 | Effect identifier |
| 4 | Enabler bit (set by Nether Wart) |
| 5 | Amplifier-related |
| 6--7 | Duration-related |
| 13 | Functional potion marker |
| 14 | Throwable (splash) flag |

### Brewing ingredients

Each ingredient has a formula string that manipulates the potion's bit pattern via `PotionBrewing::applyBrew()`:

| Ingredient | Formula | Effect |
|---|---|---|
| Nether Wart | `+4&!13` | Sets bit 4 (enabler), requires bit 13 off |
| Sugar | `-0+1-2-3&4-4+13` | Speed potion base |
| Ghast Tears | `+0-1-2-3&4-4+13` | Regeneration potion base |
| Spider Eye | `-0-1+2-3&4-4+13` | Poison potion base |
| Fermented Spider Eye | `-0+3-4+13` | Inverts/corrupts potions |
| Glistering Melon | `+0-1+2-3&4-4+13` | Healing potion base |
| Blaze Powder | `+0-1-2+3&4-4+13` | Strength potion base |
| Magma Cream | `+0+1-2-3&4-4+13` | Fire Resistance potion base |
| Golden Carrot | `-0+1+2-3+13&4-4` | Night Vision potion base |
| Redstone | `-5+6-7` | Increases duration |
| Glowstone | `+5-6-7` | Increases amplifier |
| Gunpowder | `+14` | Makes potion throwable (splash) |

### Formula syntax

The `applyBrew()` function parses formula strings character by character:

- `+N` -- Set bit N
- `-N` -- Clear bit N
- `!N` -- Toggle bit N
- `&N` -- Require bit N to be set (if not, brewing fails and returns 0)
- `&!N` -- Require bit N to be off

### Effect resolution

`PotionBrewing::getEffects()` determines which `MobEffectInstance` objects a potion data value produces. For each registered effect, it evaluates a duration formula string against the potion bits. The duration formulas use `&` (AND) operators and bit references:

| Effect | Duration formula |
|---|---|
| Regeneration | `0 & !1 & !2 & !3 & 0+6` |
| Speed | `!0 & 1 & !2 & !3 & 1+6` |
| Fire Resistance | `0 & 1 & !2 & !3 & 0+6` |
| Healing | `0 & !1 & 2 & !3` |
| Poison | `!0 & !1 & 2 & !3 & 2+6` |
| Weakness | `!0 & !1 & !2 & 3 & 3+6` |
| Harming | `!0 & !1 & 2 & 3` |
| Slowness | `!0 & 1 & !2 & 3 & 3+6` |
| Strength | `0 & !1 & !2 & 3 & 3+6` |
| Night Vision | `!0 & 1 & 2 & !3 & 2+6` |
| Invisibility | `!0 & 1 & 2 & 3 & 2+6` |

The resolved duration is calculated as: `TICKS_PER_SECOND * 60 * (duration * 3 + (duration - 1) * 2)`, yielding durations of 3, 8, 13, 18... minutes. Duration is then halved per amplifier level, multiplied by the effect's `durationModifier`, and reduced by 25% for splash (throwable) potions.

### Amplifier formulas

Certain effects can have their amplifier increased (by Glowstone dust). The amplifier is resolved from bit 5:

Effects with amplifier support: Speed, Haste, Strength, Regeneration, Harming, Healing, Resistance, Poison.

### Brewing stand

The `BrewingStandTileEntity` handles the brewing process:

- **4 slots**: 3 potion slots (0--2) and 1 ingredient slot (3)
- **Brew time**: 20 seconds (`TICKS_PER_SECOND * BREWING_TIME_SECONDS`)
- Each tick, if `brewTime > 0`, it decrements. When it hits 0, `doBrew()` applies the ingredient formula to all potion slots.
- Brewing is validated by `isBrewable()`: the ingredient must have a potion brewing formula, and at least one potion slot must produce a different result.
- Max stack size is 1 per slot.

### Potion color

Potion colors are computed by blending the colors of all active effects, weighted by amplifier level. The result is cached per brew value for performance.
