---
title: Effects (Potions)
description: Status effects and the potion/brewing system in LCE.
---

import { Aside } from '@astrojs/starlight/components';

The status effect system is built on three main classes: `MobEffect` (the effect type definition), `MobEffectInstance` (an active effect on a mob with duration and amplifier), and `PotionBrewing` (the bit-manipulation system that maps potion data values to effects).

**Key source files:** `Minecraft.World/MobEffect.h`, `Minecraft.World/MobEffectInstance.h`, `Minecraft.World/PotionBrewing.h`, `Minecraft.World/BrewingStandTileEntity.h`, `Minecraft.World/PotionItem.h`, `Minecraft.World/ThrownPotion.h`, `Minecraft.World/InstantenousMobEffect.h`, `Minecraft.World/Mob.cpp`, `Minecraft.Client/GameRenderer.cpp`

## Effect registry

Effects are stored in a static array of 32 slots (`MobEffect::effects[32]`). Each effect is created with an ID, a harmful/beneficial flag, and a color enum value. The constructor auto-registers into the array:

```cpp
MobEffect::MobEffect(int id, bool isHarmful, eMinecraftColour color)
{
    effects[id] = this;
    durationModifier = isHarmful ? 0.5 : 1.0;
}
```

Each effect is built using a chained setter pattern:

```cpp
MobEffect *MobEffect::movementSpeed =
    (new MobEffect(1, false, eMinecraftColour_Effect_MovementSpeed))
        ->setDescriptionId(IDS_POTION_MOVESPEED)
        ->setPostfixDescriptionId(IDS_POTION_MOVESPEED_POSTFIX)
        ->setIcon(MobEffect::e_MobEffectIcon_Speed);
```

## All effect types

| ID | Static name | Harmful | Duration Modifier | Icon Enum | Notes |
|---|---|---|---|---|---|
| 1 | `movementSpeed` | No | 1.0 | `e_MobEffectIcon_Speed` | Speed |
| 2 | `movementSlowdown` | Yes | 0.5 | `e_MobEffectIcon_Slowness` | Slowness |
| 3 | `digSpeed` | No | 1.5 | `e_MobEffectIcon_Haste` | Haste (longer than normal) |
| 4 | `digSlowdown` | Yes | 0.5 | `e_MobEffectIcon_MiningFatigue` | Mining Fatigue |
| 5 | `damageBoost` | No | 1.0 | `e_MobEffectIcon_Strength` | Strength |
| 6 | `heal` | No | 1.0 | None | Instant Health (`InstantenousMobEffect`) |
| 7 | `harm` | Yes | 0.5 | None | Instant Damage (`InstantenousMobEffect`) |
| 8 | `jump` | No | 1.0 | `e_MobEffectIcon_JumpBoost` | Jump Boost |
| 9 | `confusion` | Yes | 0.25 | `e_MobEffectIcon_Nausea` | Nausea (much shorter) |
| 10 | `regeneration` | No | 0.25 | `e_MobEffectIcon_Regeneration` | Regeneration (much shorter) |
| 11 | `damageResistance` | No | 1.0 | `e_MobEffectIcon_Resistance` | Resistance |
| 12 | `fireResistance` | No | 1.0 | `e_MobEffectIcon_FireResistance` | Fire Resistance |
| 13 | `waterBreathing` | No | 1.0 | `e_MobEffectIcon_WaterBreathing` | Water Breathing |
| 14 | `invisibility` | No | 1.0 | `e_MobEffectIcon_Invisiblity` | Invisibility |
| 15 | `blindness` | Yes | 0.25 | `e_MobEffectIcon_Blindness` | Blindness (much shorter) |
| 16 | `nightVision` | No | 1.0 | `e_MobEffectIcon_NightVision` | Night Vision |
| 17 | `hunger` | Yes | 0.5 | `e_MobEffectIcon_Hunger` | Hunger |
| 18 | `weakness` | Yes | 0.5 | `e_MobEffectIcon_Weakness` | Weakness |
| 19 | `poison` | Yes | 0.25 | `e_MobEffectIcon_Poison` | Poison (much shorter) |
| 20-31 | `reserved_20`...`reserved_31` | -- | -- | -- | All NULL, open for custom effects |

IDs 6 and 7 (Heal and Harm) are `InstantenousMobEffect` subclasses, meaning they apply immediately instead of ticking over time.

<Aside type="note">
The icon enum has a typo in the source: `e_MobEffectIcon_Invisiblity` (missing an 'i'). The color enum also has one: `eMinecraftColour_Effect_Invisiblity`. These are consistent throughout the codebase.
</Aside>

## Duration modifier

The `durationModifier` field scales the base duration calculated by `PotionBrewing`. Harmful effects default to `0.5`, beneficial ones to `1.0`. Some effects override this:

- **Haste**: `1.5` (longer than normal)
- **Nausea, Regeneration, Blindness, Poison**: `0.25` (much shorter)

## MobEffectInstance

`MobEffectInstance` represents an active effect on a mob. It stores three fields, all sent over the network:

| Field | Network type | Description |
|---|---|---|
| `id` | byte | The effect ID from the MobEffect table |
| `duration` | short | Remaining ticks |
| `amplifier` | byte | Potency level (0 = level I, 1 = level II, etc.) |

Multiple constructors exist: `(id)`, `(id, duration)`, and `(id, duration, amplifier)`. There is also a copy constructor `(MobEffectInstance *copy)`.

### Tick behavior

Each game tick, `Mob::tickEffects()` iterates through `activeEffects` (an `unordered_map<int, MobEffectInstance *>`). For each effect:

1. Call `MobEffectInstance::tick()` on the effect
2. Inside `tick()`, check if `isDurationEffectTick()` returns true for the current remaining duration and amplifier
3. If yes, call `applyEffect()` which hands off to `MobEffect::applyEffectTick()`
4. Decrement duration by 1
5. Return `true` if duration is still positive (effect keeps going)
6. When `tick()` returns false, the server erases the effect and calls `onEffectRemoved()`

### Tick intervals

Not every effect fires every tick. `isDurationEffectTick()` controls the schedule:

| Effect | Tick interval formula | Level I | Level II | Level III | Level IV |
|---|---|---|---|---|---|
| Regeneration | `25 >> amplifier` ticks | Every 25 ticks (1.25s) | Every 12 ticks | Every 6 ticks | Every 3 ticks |
| Poison | `25 >> amplifier` ticks | Every 25 ticks (1.25s) | Every 12 ticks | Every 6 ticks | Every 3 ticks |
| Hunger | Every tick | Every tick | Every tick | Every tick | Every tick |
| Heal/Harm | When `duration >= 1` | Instant | Instant | Instant | Instant |
| All others | Never fires `applyEffectTick` | - | - | - | - |

Effects like Speed, Jump Boost, and Resistance don't use `applyEffectTick()` at all. They're checked directly in the relevant gameplay code (movement, jumping, damage calculation).

### Effect application logic

The `applyEffectTick()` method handles periodic effects:

| Effect | What it does | Can kill? |
|---|---|---|
| Regeneration | Heals 1 HP if below max health | No |
| Poison | Deals 1 magic damage if health > 1 | No (stops at half a heart) |
| Hunger | Causes food exhaustion of `EXHAUSTION_MINE * (amplifier + 1)` every tick | No (only on players) |
| Heal (on non-undead) | Heals `6 << amplifier` HP (6, 12, 24, 48...) | No |
| Harm (on non-undead) | Deals `6 << amplifier` magic damage | Yes |
| Heal (on undead) | Deals `6 << amplifier` magic damage | Yes |
| Harm (on undead) | Heals `6 << amplifier` HP | No |

The heal/harm inversion for undead mobs is handled through `mob->isInvertedHealAndHarm()`.

### Update rules

When the same effect is applied again, `MobEffectInstance::update()` follows these rules:

- If the new amplifier is **higher**, replace both amplifier and duration
- If the amplifier is **equal** and the new duration is **longer**, extend the duration
- Otherwise, keep the existing effect as is

Lower amplifier never replaces higher amplifier, even if the duration is longer.

### Hash code

4J changed the hash code from just the ID to a combined value encoding all three fields:

```cpp
(id & 0xff) | ((amplifier & 0xff) << 8) | ((duration & 0xffff) << 16)
```

This is used by the potion item's `getUniquePotionValues()` method to find all unique potion combinations from the brew value space.

## Instantaneous effects

`InstantenousMobEffect` (subclass of `MobEffect`) overrides two methods:

- `isInstantenous()` returns `true`
- `isDurationEffectTick()` returns `true` when `remainingDuration >= 1`

The `applyInstantenousEffect()` method handles splash potion scaling. The `scale` parameter (based on distance from the splash) multiplies the base `6 << amplifier` value:

```cpp
int amount = (int)(scale * (double)(6 << amplifier) + 0.5);
```

If a source mob exists, harm damage is attributed to `DamageSource::indirectMagic(target, source)`, which means the thrower gets credit for the kill.

## How effects modify gameplay

### Movement speed

```cpp
float speed = 1.0f;
if (hasEffect(MobEffect::movementSpeed))
    speed *= 1.0f + 0.2f * (amplifier + 1);
if (hasEffect(MobEffect::movementSlowdown))
    speed *= 1.0f - 0.15f * (amplifier + 1);
```

| Effect | Level I | Level II | Level III |
|---|---|---|---|
| Speed | +20% | +40% | +60% |
| Slowness | -15% | -30% | -45% |

### Jump boost

```cpp
yd = 0.42f;  // base jump velocity
if (hasEffect(MobEffect::jump))
    yd += (amplifier + 1) * 0.1f;
```

Each level adds 0.1 to the base Y velocity. Jump Boost I gives 0.52, Jump Boost II gives 0.62, etc.

### Damage resistance

Resistance reduces incoming damage before armor:

```cpp
int absorbValue = (amplifier + 1) * 5;
int absorb = 25 - absorbValue;
damage = (damage * absorb + dmgSpill) / 25;
```

| Level | Reduction |
|---|---|
| I | 20% |
| II | 40% |
| III | 60% |
| IV | 80% |
| V | 100% (immune) |

### Other gameplay effects

- **Fire Resistance**: Blocks fire/lava damage entirely in `Mob::hurt()`
- **Water Breathing**: Prevents drowning in `Mob::aiStep()`
- **Invisibility**: Sets the mob's invisible flag via `setInvisible(true)` when effects are synced
- **Weakness**: Sets the mob's weakened flag via `setWeakened(true)`
- **Blindness**: Prevents sprinting (checked in `LocalPlayer`). Also affects fog rendering (see rendering section)
- **Nausea**: Interacts with the portal animation. If the player has nausea, the portal rotation multiplier drops from 20 to 7

## How effects render

### Particles

Mobs with active effects emit colored particles. In `Mob::tickEffects()`, every other tick (50% chance via `random->nextBoolean()`), a `mobSpell` particle gets spawned:

```cpp
int colorValue = entityData->getInteger(DATA_EFFECT_COLOR_ID);
if (colorValue > 0) {
    double red   = ((colorValue >> 16) & 0xff) / 255.0;
    double green = ((colorValue >>  8) & 0xff) / 255.0;
    double blue  = ((colorValue >>  0) & 0xff) / 255.0;

    level->addParticle(eParticleType_mobSpell,
        x + (random->nextDouble() - 0.5) * bbWidth,
        y + random->nextDouble() * bbHeight - heightOffset,
        z + (random->nextDouble() - 0.5) * bbWidth,
        red, green, blue);
}
```

The particle spawns within the mob's bounding box, with its color set by the RGB components of the blended effect color.

### Effect color blending

The color is computed by `PotionBrewing::getColorValue()`. It blends colors from all active effects, weighted by amplifier level. Higher amplifier means that effect's color counts more toward the blend:

```cpp
for (each active effect) {
    int potionColor = colourTable.getColor(effect.getColor());
    for (int potency = 0; potency <= effect.getAmplifier(); potency++) {
        red   += ((potionColor >> 16) & 0xff) / 255.0f;
        green += ((potionColor >>  8) & 0xff) / 255.0f;
        blue  += ((potionColor >>  0) & 0xff) / 255.0f;
        count++;
    }
}
// Average and convert back to 0-255
```

Each `MobEffect` has a color set via `eMinecraftColour` in its constructor. When `effectsDirty` is set (after adding or removing effects), the combined color gets recalculated on the server and synced to clients through entity data (synched data ID 8: `DATA_EFFECT_COLOR_ID`).

### Blindness screen effect

Blindness modifies the fog distance in `GameRenderer`. When the player has blindness:

- Fog distance is set to 5 blocks (instead of the normal render distance)
- The fog color darkens toward zero based on the player's Y position
- During the last 20 ticks of the effect, the fog gradually fades back to normal:

```cpp
if (duration < 20) {
    distance = 5.0f + (renderDistance - 5.0f) * (1.0f - duration / 20.0f);
}
```

Blindness also prevents sprinting. The sprint check in `LocalPlayer` explicitly requires `!hasEffect(MobEffect::blindness)`.

### Night Vision screen effect

Night Vision brightens the lightmap. The brightness scale is 1.0 when the remaining duration is above 10 seconds. In the last 10 seconds, it starts flashing:

```cpp
if (duration > TICKS_PER_SECOND * 10)
    return 1.0f;
else {
    float flash = max(0.0f, (float)duration - a);
    return 0.7f + sin(flash * PI * 0.05f) * 0.3f;
}
```

This creates a pulsing fade effect when Night Vision is about to expire. The scale is applied to the fog color by finding the smallest color component and scaling all colors up so that component reaches 1.0.

### Nausea screen effect

Nausea doesn't have its own screen overlay. Instead, it modifies the portal animation. When the player has nausea, the portal effect renders with a rotation multiplier of 7 instead of 20 (slower rotation). In `Gui`, the portal overlay is suppressed entirely if the player has nausea, since the nausea effect in `GameRenderer` handles the visual distortion.

The nausea also causes the portal time counter to slowly fill up (`+= 1/150`) in `LocalPlayer`, which creates the warping visual even when the player isn't near a portal.

## Duration formatting

`MobEffect::formatDuration()` converts the remaining duration in ticks to a `M:SS` string using `SharedConstants::TICKS_PER_SECOND`. Single-digit seconds get a leading zero.

## Network packets

Two packet types handle effect synchronization:

- `UpdateMobEffectPacket`: sent when an effect is applied or updated
- `RemoveMobEffectPacket`: sent when an effect expires or is removed

The `Mob::onEffectAdded()`, `onEffectUpdated()`, and `onEffectRemoved()` methods all just set `effectsDirty = true`. The actual color sync and flag updates happen in `tickEffects()` when this dirty flag is processed.

Effects are also saved to NBT when the world saves:

```cpp
// Saving:
tag->putByte(L"Id", (BYTE) effect->getId());
tag->putByte(L"Amplifier", (BYTE) effect->getAmplifier());
tag->putInt(L"Duration", effect->getDuration());

// Loading:
int id = effectTag->getByte(L"Id");
int amplifier = effectTag->getByte(L"Amplifier");
int duration = effectTag->getInt(L"Duration");
```

## Potion brewing system

LCE uses a **bit-manipulation brewing system** where each potion's data value is a 15-bit integer. The bits encode which effects the potion gives, their duration/amplifier, and whether the potion is throwable.

### Simplified brewing mode

LCE compiles with `SIMPLIFIED_BREWING = true` (a compile-time constant, also defined as `_SIMPLIFIED_BREWING 1`). This removes the `boil()`, `shake()`, and `stirr()` operations from the original Notch brewing system and uses direct bit formulas instead. The non-simplified code path still exists in the source but is compiled out via `#if !(_SIMPLIFIED_BREWING)`.

### Bit layout

| Bits | Purpose |
|---|---|
| 0-3 | Effect identifier (which potion effect) |
| 4 | Enabler bit (set by Nether Wart) |
| 5 | Amplifier flag (set by Glowstone) |
| 6 | Duration extension (set by Redstone) |
| 7 | Unused in simplified brewing |
| 8-12 | Unused |
| 13 | Functional potion marker |
| 14 | Throwable (splash) flag (set by Gunpowder) |

The `BREW_MASK` is `0x7fff` (15 bits).

### Effect identifier bit patterns (bits 0-3)

From the source code comments:

| Bits 0-3 | Effect |
|---|---|
| `0001` | Regeneration |
| `0010` | Speed |
| `0011` | Fire Resistance |
| `0100` | Poison |
| `0101` | Healing |
| `0110` | Night Vision |
| `0111` | (unused) |
| `1000` | Weakness |
| `1001` | Strength |
| `1010` | Slowness |
| `1011` | (unused) |
| `1100` | Harming |
| `1101` | (unused) |
| `1110` | Invisibility |
| `1111` | (unused) |

### Brewing formulas

Each ingredient has a formula string that changes the potion's bit pattern through `PotionBrewing::applyBrew()`:

| Ingredient | Formula | What it does |
|---|---|---|
| Nether Wart | `+4&!13` | Sets bit 4 (enabler), requires bit 13 off |
| Sugar | `-0+1-2-3&4-4+13` | Speed potion base |
| Ghast Tear | `+0-1-2-3&4-4+13` | Regeneration potion base |
| Spider Eye | `-0-1+2-3&4-4+13` | Poison potion base |
| Fermented Spider Eye | `-0+3-4+13` | Inverts/corrupts potions |
| Glistering Melon | `+0-1+2-3&4-4+13` | Healing potion base |
| Blaze Powder | `+0-1-2+3&4-4+13` | Strength potion base |
| Magma Cream | `+0+1-2-3&4-4+13` | Fire Resistance potion base |
| Golden Carrot | `-0+1+2-3+13&4-4` | Night Vision potion base |
| Redstone | `-5+6-7` | Increases duration |
| Glowstone | `+5-6-7` | Increases amplifier |
| Gunpowder | `+14` | Makes potion throwable (splash) |

<Aside type="note">
4J's comment in the source notes that Gunpowder doesn't require bit 13, so you can make a (virtually useless) Splash Mundane potion by combining a water bottle with gunpowder. The original formula was `&13-13+14` but 4J removed the requirement because the creative menu doesn't use bit 13.
</Aside>

### Formula syntax

The `applyBrew()` function parses formula strings character by character:

| Symbol | Meaning |
|---|---|
| `+N` | Set bit N |
| `-N` | Clear bit N |
| `!N` | Toggle bit N |
| `&N` | Require bit N to be set (if not, brewing returns 0 = no change) |
| `&!N` | Require bit N to be off (if it's on, brewing returns 0) |

The parser processes each character sequentially. When it hits a digit, it builds a multi-digit number. When it hits an operator (`+`, `-`, `!`, `&`), it applies the pending operation and starts a new one. The `&` (require) check is special: if the requirement fails, the function returns 0 immediately and the potion doesn't change.

### Brewing walkthrough

Start with a Water Bottle (brew value = `0`):

1. **Add Nether Wart** (`+4&!13`): Set bit 4. Check `&!13` (bit 13 is off, ok). Result: `0b10000` = **16** (Awkward Potion)
2. **Add Sugar** (`-0+1-2-3&4-4+13`): Requires bit 4 (`&4`), clears bits 0/2/3, sets bit 1, clears bit 4, sets bit 13. Result: `0b10000000000010` = **8194** (Potion of Swiftness)
3. **Add Redstone** (`-5+6-7`): Clears bit 5, sets bit 6, clears bit 7. Result: **8258** (Potion of Swiftness, extended)
4. **Add Gunpowder** (`+14`): Sets bit 14. Result: **24642** (Splash Potion of Swiftness, extended)

### Effect resolution

`PotionBrewing::getEffects()` figures out which `MobEffectInstance` objects a potion data value produces. For each registered effect, it evaluates a duration formula string against the brew value bits:

| Effect | Duration formula | Bit pattern needed |
|---|---|---|
| Regeneration | `0 & !1 & !2 & !3 & 0+6` | Bit 0 on, bits 1,2,3 off |
| Speed | `!0 & 1 & !2 & !3 & 1+6` | Bit 1 on, bits 0,2,3 off |
| Fire Resistance | `0 & 1 & !2 & !3 & 0+6` | Bits 0,1 on, bits 2,3 off |
| Healing | `0 & !1 & 2 & !3` | Bits 0,2 on, bits 1,3 off |
| Poison | `!0 & !1 & 2 & !3 & 2+6` | Bit 2 on, bits 0,1,3 off |
| Weakness | `!0 & !1 & !2 & 3 & 3+6` | Bit 3 on, bits 0,1,2 off |
| Harming | `!0 & !1 & 2 & 3` | Bits 2,3 on, bits 0,1 off |
| Slowness | `!0 & 1 & !2 & 3 & 3+6` | Bits 1,3 on, bits 0,2 off |
| Strength | `0 & !1 & !2 & 3 & 3+6` | Bits 0,3 on, bits 1,2 off |
| Night Vision | `!0 & 1 & 2 & !3 & 2+6` | Bits 1,2 on, bits 0,3 off |
| Invisibility | `!0 & 1 & 2 & 3 & 2+6` | Bits 1,2,3 on, bit 0 off |

The duration formula uses `&` as AND between sub-expressions. The `N+M` syntax means "bit N plus bit M" which adds their values. The `!N` means "not bit N" (contributes 1 if bit is off, 0 if on).

### Duration calculation

When an effect's formula evaluates to > 0, the duration in ticks is:

```cpp
// Base duration in ticks
duration = (TICKS_PER_SECOND * 60) * (formulaResult * 3 + (formulaResult - 1) * 2);

// Halve per amplifier level
duration >>= amplifier;

// Apply the effect's duration modifier
duration = round(duration * effect->getDurationModifier());

// Splash potions get 75% duration
if (isThrowable)
    duration = round(duration * 0.75 + 0.5);
```

For a formula result of 1, the base is `TICKS_PER_SECOND * 60 * 3` = 3 minutes. For result 2, it's 8 minutes. For result 3, it's 13 minutes.

| Formula result | Base duration |
|---|---|
| 1 | 3 minutes |
| 2 | 8 minutes |
| 3 | 13 minutes |
| 4 | 18 minutes |

After the base calculation, the duration is halved for each amplifier level, then multiplied by the effect's `durationModifier` (e.g., 0.25 for Regeneration/Poison), and finally reduced by 25% for splash potions.

### Amplifier formulas

Certain effects can have their amplifier boosted by Glowstone dust. The amplifier is determined by evaluating bit 5:

Effects with amplifier support: Speed, Haste, Strength, Regeneration, Harming, Healing, Resistance, Poison.

All of these use the formula `"5"` which just reads bit 5. If Glowstone was added (setting bit 5), the amplifier is 1 (level II). Otherwise it's 0 (level I).

<Aside type="note">
Redstone (`-5+6-7`) and Glowstone (`+5-6-7`) are mutually exclusive by their formulas. Redstone clears bit 5 and sets bit 6. Glowstone sets bit 5 and clears bit 6. Applying one after the other will undo the first one's key bit.
</Aside>

## Potion appearance names

Non-functional potions (those without active effects) get a name from a 32-entry lookup table based on `getAppearanceValue()`. The names include things like Mundane, Awkward, Thick, and various quirky names (Uninteresting, Bland, Clear, Milky, etc.). The appearance value is computed from bits 5, 4, 3, 2, 1 of the brew value.

## Brewing stand

The `BrewingStandTileEntity` handles the brewing process. It has 4 slots: 3 potion slots (indices 0-2) and 1 ingredient slot (index 3).

### The tick loop

```
Every tick:
  If brewTime > 0:
    Decrement brewTime
    If brewTime hits 0: apply the ingredient (doBrew())
    If the recipe is no longer valid: reset brewTime to 0
    If the ingredient changed: reset brewTime to 0
  Else if a valid recipe exists:
    Start brewing: set brewTime to TICKS_PER_SECOND * 20 = 400 ticks
    Save the ingredient ID
```

Brew time is 20 seconds (400 ticks at 20 TPS).

### Brew validation

`isBrewable()` checks several things:

1. The ingredient slot must have an item with a potion brewing formula
2. At least one potion slot must produce a different result when the formula is applied
3. It specifically checks both the brew value change and the effects change, to avoid "brewing" that doesn't actually do anything

### Applying ingredients

When brewing completes, `doBrew()` applies the ingredient's formula to each potion slot:

```cpp
int newBrew = PotionBrewing::applyBrew(currentBrew, ingredient.formula);
```

The brew value is then normalized via `NORMALISE_POTION_AUXVAL()` macro and stored as the potion's aux value.

The ingredient item is consumed. If the ingredient has a crafting remaining item (like a bucket), that item replaces it. Otherwise, the count is decremented and the slot is cleared if it hits 0.

### Max stack size

The brewing stand's max stack size is 1 per slot. You can't stack potions in the brewing slots.

### Potion slot tracking

The brewing stand tracks which slots have potions via `getPotionBits()`, which returns a 3-bit value (one bit per slot). This is synced to the block data for rendering the bottles in the world.

## Drinkable vs splash potions

Bit 14 is the only difference. Gunpowder's formula (`+14`) sets this bit.

### Drinking a potion

The drink animation takes 32 ticks (1.6 seconds, defined by `DRINK_DURATION`). When depleted, `PotionItem::useTimeDepleted()`:

1. Decrements the stack count (unless creative)
2. Gets the effect list from `getMobEffects()`
3. Adds each effect to the player via `player->addEffect(new MobEffectInstance(...))`
4. Returns an empty glass bottle (or adds one to inventory if the stack isn't empty)

### Throwing a splash potion

When `PotionItem::use()` detects the throwable bit, it skips the drink animation and spawns a `ThrownPotion` projectile:

```cpp
level->addEntity(new ThrownPotion(level, player, instance->getAuxValue()));
```

The throw plays `eSoundType_RANDOM_BOW` at 0.5 volume.

### Splash potion projectile

`ThrownPotion` extends `Throwable` with custom physics:
- **Gravity**: 0.05 (heavier than arrows at 0.03)
- **Throw power**: 0.5 (slower than arrows)
- **Throw angle offset**: -20 degrees (arcs higher)

### Splash potion area of effect

When a `ThrownPotion` hits something, `onHit()` applies effects to all mobs in range:

**Range**: 4 blocks (`SPLASH_RANGE = 4.0`)

**Area**: The bounding box is grown by 4 blocks on X/Z and 2 blocks on Y (`bb->grow(4, 2, 4)`)

**Scaling**:
```cpp
double scale = 1.0 - (sqrt(distanceSquared) / 4.0);
if (entity == directHitEntity) scale = 1.0;  // Direct hit = full strength
```

For instant effects (Heal/Harm), the scale multiplies the heal/damage amount. For duration effects, the scale multiplies the duration. Duration effects with less than 1 second of scaled duration (below `TICKS_PER_SECOND`) are skipped entirely.

After applying effects, the potion spawns splash particles via `level->levelEvent(PARTICLES_POTION_SPLASH, ...)` and removes itself.

## Potion colors

The potion item's color for rendering comes from `PotionBrewing::getColorValue()`. Results are cached per brew value in a static `cachedColors` map for performance. The potion item has two sprite layers: the overlay (tinted with the potion color) and the base bottle (always white).

## Potion tooltips

`PotionItem::appendHoverText()` builds the tooltip lines:

1. Gets the effects list from `getMobEffects()`
2. For each effect, shows the name, potency level (II, III, IV), and duration in M:SS format
3. Harmful effects are shown in red (`eHTMLColor_c`), beneficial in gray (`eHTMLColor_7`)
4. Duration is only shown if it's longer than 1 second
5. If there are no effects, shows the "empty" string

## MinecraftConsoles differences

MC adds 4 new status effects on top of LCEMP's 19, filling in IDs 20-23:

| ID | Static name | Class | Harmful | Duration Modifier | Notes |
|---|---|---|---|---|---|
| 20 | `wither` | `MobEffect` | Yes | 0.25 | Deals 1 wither damage per tick interval. Like poison but uses `DamageSource::wither` and **can kill**. Tick interval: `40 >> amplifier` (40, 20, 10 ticks). |
| 21 | `healthBoost` | `HealthBoostMobEffect` | No | 1.0 | Increases max health through the attribute system. Uses `SharedMonsterAttributes::MAX_HEALTH` with `+4 HP per level` (OPERATION_ADDITION). |
| 22 | `absorption` | `AbsoptionMobEffect` | No | 1.0 | Adds temporary extra hearts that don't regenerate. Has its own subclass. |
| 23 | `saturation` | `InstantenousMobEffect` | No | 1.0 | Instant effect that restores hunger and saturation. Only works on players. |

In LCEMP, IDs 20-31 are all reserved null slots. MC fills in 20-23 and leaves 24-31 as null.

MC also makes big changes to how some base effects work:

- **Strength** becomes `AttackDamageMobEffect` (not plain `MobEffect`), using `SharedMonsterAttributes::ATTACK_DAMAGE` with a modifier of `3` (OPERATION_MULTIPLY_TOTAL)
- **Weakness** also becomes `AttackDamageMobEffect`, using `SharedMonsterAttributes::ATTACK_DAMAGE` with a modifier of `2` (OPERATION_ADDITION)
- **Slowness** uses `addAttributeModifier()` on `MOVEMENT_SPEED` with `-0.15` (OPERATION_MULTIPLY_TOTAL)
- **Health Boost** uses `addAttributeModifier()` on `MAX_HEALTH` with `+4` (OPERATION_ADDITION)

The Wither effect is used by the Wither Boss mob (also new in MC). The other three effects (Health Boost, Absorption, Saturation) come from golden apples and beacon effects.

The big structural difference is that MC uses the attribute modifier system for effects that change stats, while LCEMP checks for effects directly in gameplay code (like `getWalkingSpeedModifier()`).
