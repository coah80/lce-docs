---
title: Custom Potions & Brewing
description: How LCEMP's potion system works, and how to add new effects, ingredients, and brewing recipes.
---

This guide covers the LCEMP potion and brewing system end to end: how `MobEffect` defines status effects, how `MobEffectInstance` tracks duration and amplifier on a mob, how the bitfield-based brewing chain works, how splash potions apply area damage, and how to add your own custom effects and ingredients.

## Key Files

| File | Purpose |
|------|---------|
| `MobEffect.h` / `.cpp` | Base effect class, static registry of all 19 effects |
| `InstantenousMobEffect.h` | Subclass for instant effects (Heal, Harm) |
| `MobEffectInstance.h` / `.cpp` | An active effect on a mob: ID + duration + amplifier |
| `PotionBrewing.h` / `.cpp` | Bitfield brewing system, formula parser, effect resolution |
| `PotionItem.h` / `.cpp` | The potion item: drinking, throwing, tooltips, colors |
| `ThrownPotion.h` / `.cpp` | Splash potion projectile entity |
| `BrewingStandTileEntity.h` / `.cpp` | The brewing stand block: ticking, applying ingredients |
| `Mob.h` / `.cpp` | Effect storage on entities, tick loop, speed/jump modifiers |
| `Item.h` / `.cpp` | `setPotionBrewingFormula()` on ingredient items |

## How MobEffect Works

`MobEffect` is the base class for all status effects. Each effect gets a numeric ID, a color, and a harmful/beneficial flag. The class stores all effects in a static array:

```cpp
static const int NUM_EFFECTS = 32;
static MobEffect *effects[NUM_EFFECTS];
```

The constructor automatically registers the effect into this array at its ID slot:

```cpp
MobEffect::MobEffect(int id, bool isHarmful, eMinecraftColour color)
    : id(id), _isHarmful(isHarmful), color(color)
{
    descriptionId = -1;
    m_postfixDescriptionId = -1;
    icon = e_MobEffectIcon_None;
    _isDisabled = false;

    effects[id] = this;

    if (isHarmful)
        durationModifier = .5;
    else
        durationModifier = 1.0;
}
```

Notice that harmful effects default to half duration modifier. This means potions with harmful effects last shorter by default.

### The Effect Registry

All 19 vanilla effects are created as static globals in `MobEffect.cpp`. Each one chains together setters in a builder pattern:

```cpp
MobEffect *MobEffect::movementSpeed =
    (new MobEffect(1, false, eMinecraftColour_Effect_MovementSpeed))
        ->setDescriptionId(IDS_POTION_MOVESPEED)
        ->setPostfixDescriptionId(IDS_POTION_MOVESPEED_POSTFIX)
        ->setIcon(MobEffect::e_MobEffectIcon_Speed);

MobEffect *MobEffect::poison =
    (new MobEffect(19, true, eMinecraftColour_Effect_Poison))
        ->setDescriptionId(IDS_POTION_POISON)
        ->setPostfixDescriptionId(IDS_POTION_POISON_POSTFIX)
        ->setDurationModifier(.25)
        ->setIcon(MobEffect::e_MobEffectIcon_Poison);
```

### Complete Effect Table

| ID | Static Name | Harmful | Duration Modifier | Notes |
|----|-------------|---------|-------------------|-------|
| 1 | `movementSpeed` | No | 1.0 | Speed |
| 2 | `movementSlowdown` | Yes | 0.5 | Slowness |
| 3 | `digSpeed` | No | 1.5 | Haste |
| 4 | `digSlowdown` | Yes | 0.5 | Mining Fatigue |
| 5 | `damageBoost` | No | 1.0 | Strength |
| 6 | `heal` | No | 1.0 | Instant Health (InstantenousMobEffect) |
| 7 | `harm` | Yes | 0.5 | Instant Damage (InstantenousMobEffect) |
| 8 | `jump` | No | 1.0 | Jump Boost |
| 9 | `confusion` | Yes | 0.25 | Nausea |
| 10 | `regeneration` | No | 0.25 | Regeneration |
| 11 | `damageResistance` | No | 1.0 | Resistance |
| 12 | `fireResistance` | No | 1.0 | Fire Resistance |
| 13 | `waterBreathing` | No | 1.0 | Water Breathing |
| 14 | `invisibility` | No | 1.0 | Invisibility |
| 15 | `blindness` | Yes | 0.25 | Blindness |
| 16 | `nightVision` | No | 1.0 | Night Vision |
| 17 | `hunger` | Yes | 0.5 | Hunger |
| 18 | `weakness` | Yes | 0.5 | Weakness |
| 19 | `poison` | Yes | 0.25 | Poison |
| 20-31 | `reserved_20` through `reserved_31` | -- | -- | All NULL, open for custom effects |

The reserved slots (20-31) are already there waiting for you. You just need to fill them in.

## MobEffectInstance: Effects on Entities

`MobEffectInstance` is the runtime container for an active effect on a mob. It holds three things:

- **id** (byte): Which `MobEffect` this is
- **duration** (short): Ticks remaining
- **amplifier** (byte): Potency level (0 = level I, 1 = level II, etc.)

### The Tick Loop

Every game tick, `Mob::tickEffects()` iterates through `activeEffects` (an `unordered_map<int, MobEffectInstance *>`). For each effect, it calls `MobEffectInstance::tick()`:

```cpp
bool MobEffectInstance::tick(shared_ptr<Mob> target)
{
    if (duration > 0)
    {
        if (MobEffect::effects[id]->isDurationEffectTick(duration, amplifier))
        {
            applyEffect(target);
        }
        tickDownDuration();
    }
    return duration > 0;
}
```

When `tick()` returns false (duration ran out), the effect gets removed from the mob.

### isDurationEffectTick: When Effects Fire

Not every effect runs every tick. `isDurationEffectTick()` controls the interval:

```cpp
bool MobEffect::isDurationEffectTick(int remainingDuration, int amplification)
{
    if (id == regeneration->id || id == poison->id)
    {
        // Tick intervals: 25, 12, 6.. (halved per amplifier level)
        int interval = 25 >> amplification;
        if (interval > 0)
            return (remainingDuration % interval) == 0;
        return true;
    }
    else if (id == hunger->id)
    {
        return true;  // Every single tick
    }
    return false;
}
```

So Regeneration I heals every 25 ticks (1.25 seconds), Regeneration II heals every 12 ticks, and so on. Poison works the same way. Hunger fires every tick.

### applyEffectTick: What Effects Actually Do

This is where the real work happens:

```cpp
void MobEffect::applyEffectTick(shared_ptr<Mob> mob, int amplification)
{
    if (id == regeneration->id)
    {
        if (mob->getHealth() < mob->getMaxHealth())
            mob->heal(1);
    }
    else if (id == poison->id)
    {
        if (mob->getHealth() > 1)  // Poison can't kill you
            mob->hurt(DamageSource::magic, 1);
    }
    else if (id == hunger->id && dynamic_pointer_cast<Player>(mob) != NULL)
    {
        dynamic_pointer_cast<Player>(mob)->causeFoodExhaustion(
            FoodConstants::EXHAUSTION_MINE * (amplification + 1));
    }
    else if ((id == heal->id && !mob->isInvertedHealAndHarm())
          || (id == harm->id && mob->isInvertedHealAndHarm()))
    {
        mob->heal(6 << amplification);
    }
    else if ((id == harm->id && !mob->isInvertedHealAndHarm())
          || (id == heal->id && mob->isInvertedHealAndHarm()))
    {
        mob->hurt(DamageSource::magic, 6 << amplification);
    }
}
```

Notice the `isInvertedHealAndHarm()` check. Undead mobs return true for this, which makes Heal damage them and Harm heal them. Classic Minecraft behavior.

### Updating an Existing Effect

When a mob already has an effect and gets the same one again, `MobEffectInstance::update()` picks the better one:

```cpp
void MobEffectInstance::update(MobEffectInstance *takeOver)
{
    if (takeOver->amplifier > this->amplifier)
    {
        this->amplifier = takeOver->amplifier;
        this->duration = takeOver->duration;
    }
    else if (takeOver->amplifier == this->amplifier
          && this->duration < takeOver->duration)
    {
        this->duration = takeOver->duration;
    }
}
```

Higher amplifier always wins. Same amplifier, longer duration wins.

## The Brewing System (Bitfield Magic)

This is the most interesting part. LCEMP uses a **simplified** bitfield-based brewing system (4J's version, not the original Notch bit-twiddling madness). Every potion is represented by a 15-bit integer. Ingredients work by flipping specific bits in that integer according to a formula string.

### The Potion Bitfield

The 15-bit brew value encodes everything about a potion:

| Bits | Purpose |
|------|---------|
| 0-3 | Effect identifier (which potion effect) |
| 4 | Enabler bit (set by Nether Wart) |
| 5 | Amplifier flag (set by Glowstone) |
| 6 | Duration extension (set by Redstone) |
| 7 | Unused in simplified brewing |
| 13 | Functional potion marker |
| 14 | Throwable bit (set by Gunpowder, makes it a splash potion) |

### Brewing Formulas

Each ingredient item has a formula string that says which bits to set or clear. The formula language works like this:

| Symbol | Meaning |
|--------|---------|
| `+N` | Set bit N |
| `-N` | Clear bit N |
| `!N` | Toggle bit N |
| `&N` | Require bit N to be set (otherwise brewing fails) |
| `&!N` | Require bit N to be clear |

Here are all the ingredient formulas (simplified brewing mode):

```cpp
const wstring PotionBrewing::MOD_NETHERWART    = L"+4&!13";
const wstring PotionBrewing::MOD_SUGAR          = L"-0+1-2-3&4-4+13";
const wstring PotionBrewing::MOD_GHASTTEARS     = L"+0-1-2-3&4-4+13";
const wstring PotionBrewing::MOD_SPIDEREYE      = L"-0-1+2-3&4-4+13";
const wstring PotionBrewing::MOD_FERMENTEDEYE   = L"-0+3-4+13";
const wstring PotionBrewing::MOD_SPECKLEDMELON  = L"+0-1+2-3&4-4+13";
const wstring PotionBrewing::MOD_BLAZEPOWDER    = L"+0-1-2+3&4-4+13";
const wstring PotionBrewing::MOD_GOLDENCARROT   = L"-0+1+2-3+13&4-4";
const wstring PotionBrewing::MOD_MAGMACREAM     = L"+0+1-2-3&4-4+13";
const wstring PotionBrewing::MOD_REDSTONE        = L"-5+6-7";
const wstring PotionBrewing::MOD_GLOWSTONE       = L"+5-6-7";
const wstring PotionBrewing::MOD_GUNPOWDER       = L"+14";
```

Let's trace through an example. Start with a Water Bottle (brew value 0). Add Nether Wart (`+4&!13`): this sets bit 4 if bit 13 is clear. Bit 13 is clear on a water bottle, so now brew = `0b10000` = 16. This is an Awkward Potion.

Now add Sugar (`-0+1-2-3&4-4+13`): requires bit 4 (`&4`), clears bits 0/2/3, sets bit 1, clears bit 4, sets bit 13. Result: `0b10000000000010` = 8194. That's a Potion of Swiftness.

### How Formulas Map to Effects

The `PotionBrewing::staticCtor()` method sets up two maps: `potionEffectDuration` and `potionEffectAmplifier`. These map effect IDs to formula strings that get evaluated against the brew value to determine if the effect is present, and how strong it is:

```cpp
// Duration formulas (which bits must be set for this effect to be active)
potionEffectDuration[regeneration->getId()]    = L"0 & !1 & !2 & !3 & 0+6";
potionEffectDuration[movementSpeed->getId()]   = L"!0 & 1 & !2 & !3 & 1+6";
potionEffectDuration[fireResistance->getId()]  = L"0 & 1 & !2 & !3 & 0+6";
potionEffectDuration[heal->getId()]            = L"0 & !1 & 2 & !3";
potionEffectDuration[poison->getId()]          = L"!0 & !1 & 2 & !3 & 2+6";
potionEffectDuration[weakness->getId()]        = L"!0 & !1 & !2 & 3 & 3+6";
potionEffectDuration[harm->getId()]            = L"!0 & !1 & 2 & 3";
potionEffectDuration[movementSlowdown->getId()]= L"!0 & 1 & !2 & 3 & 3+6";
potionEffectDuration[damageBoost->getId()]     = L"0 & !1 & !2 & 3 & 3+6";
potionEffectDuration[nightVision->getId()]     = L"!0 & 1 & 2 & !3 & 2+6";
potionEffectDuration[invisibility->getId()]    = L"!0 & 1 & 2 & 3 & 2+6";

// Amplifier formulas (bit 5 = glowstone was added)
potionEffectAmplifier[movementSpeed->getId()]   = L"5";
potionEffectAmplifier[regeneration->getId()]     = L"5";
potionEffectAmplifier[damageBoost->getId()]      = L"5";
potionEffectAmplifier[poison->getId()]           = L"5";
potionEffectAmplifier[harm->getId()]             = L"5";
potionEffectAmplifier[heal->getId()]             = L"5";
// ... and more
```

The duration formula is what `getEffects()` evaluates. If the parsed result is greater than 0, the effect is active on this potion. The duration in ticks is then computed:

```cpp
// 3, 8, 13, 18.. minutes
duration = (TICKS_PER_SECOND * 60) * (duration * 3 + (duration - 1) * 2);
duration >>= amplifier;
duration = (int) Math::round((double) duration * effect->getDurationModifier());

if ((brew & THROWABLE_MASK) != 0)
{
    duration = (int) Math::round((double) duration * .75 + .5);
}
```

Splash potions get 75% duration compared to drinkable ones.

### Items and Their Formulas

Each ingredient item has its formula set during item registration in `Item.cpp`:

```cpp
Item::sugar       = (new Item(97))->setPotionBrewingFormula(PotionBrewing::MOD_SUGAR);
Item::ghastTear   = (new Item(114))->setPotionBrewingFormula(PotionBrewing::MOD_GHASTTEARS);
Item::spiderEye   = (new FoodItem(119, ...))->setPotionBrewingFormula(PotionBrewing::MOD_SPIDEREYE);
Item::blazePowder = (new Item(121))->setPotionBrewingFormula(PotionBrewing::MOD_BLAZEPOWDER);
// etc.
```

The brewing stand checks `item->hasPotionBrewingFormula()` to decide if something can be used as an ingredient.

## The Brewing Stand

`BrewingStandTileEntity` handles the actual brewing process. It has 4 slots: 3 potion slots (bottom) and 1 ingredient slot (top).

### The Tick Loop

Every tick, if `isBrewable()` returns true, a 20-second countdown starts:

```cpp
void BrewingStandTileEntity::tick()
{
    if (brewTime > 0)
    {
        brewTime--;
        if (brewTime == 0)
        {
            doBrew();  // Apply the ingredient
            setChanged();
        }
        else if (!isBrewable())
        {
            brewTime = 0;  // Ingredient was removed
        }
    }
    else if (isBrewable())
    {
        brewTime = TICKS_PER_SECOND * BREWING_TIME_SECONDS; // 400 ticks
        ingredientId = items[INGREDIENT_SLOT]->id;
    }
}
```

### Applying an Ingredient

When brewing completes, `doBrew()` calls `applyIngredient()` on each potion slot:

```cpp
int BrewingStandTileEntity::applyIngredient(
    int currentBrew, shared_ptr<ItemInstance> ingredient)
{
    if (Item::items[ingredient->id]->hasPotionBrewingFormula())
    {
        return PotionBrewing::applyBrew(
            currentBrew,
            Item::items[ingredient->id]->getPotionBrewingFormula());
    }
    return currentBrew;
}
```

The `applyBrew()` function parses the formula string and flips bits accordingly. If a requirement (`&`) fails, the brew value returns 0 (no change).

## Drinkable vs Splash Potions

The throwable bit (bit 14) is the only difference between drinkable and splash potions. Gunpowder's formula is simply `+14`, which sets that bit.

### Drinking a Potion

When you drink a potion, `PotionItem::useTimeDepleted()` runs:

```cpp
shared_ptr<ItemInstance> PotionItem::useTimeDepleted(
    shared_ptr<ItemInstance> instance, Level *level, shared_ptr<Player> player)
{
    if (!player->abilities.instabuild) instance->count--;

    if (!level->isClientSide)
    {
        vector<MobEffectInstance *> *effects = getMobEffects(instance);
        if (effects != NULL)
        {
            for (auto it = effects->begin(); it != effects->end(); ++it)
            {
                player->addEffect(new MobEffectInstance(*it));
            }
        }
    }

    // Return empty glass bottle
    if (!player->abilities.instabuild)
    {
        if (instance->count <= 0)
            return shared_ptr<ItemInstance>(new ItemInstance(Item::glassBottle));
        else
            player->inventory->add(
                shared_ptr<ItemInstance>(new ItemInstance(Item::glassBottle)));
    }
    return instance;
}
```

The drink animation takes 32 ticks (1.6 seconds).

### Throwing a Splash Potion

When `PotionItem::use()` detects the throwable bit, it spawns a `ThrownPotion` projectile instead of starting the drink animation:

```cpp
if (isThrowable(instance->getAuxValue()))
{
    if (!player->abilities.instabuild) instance->count--;
    level->playSound(player, eSoundType_RANDOM_BOW, 0.5f, ...);
    if (!level->isClientSide)
        level->addEntity(shared_ptr<ThrownPotion>(
            new ThrownPotion(level, player, instance->getAuxValue())));
    return instance;
}
```

### Splash Potion Hit

When a `ThrownPotion` hits something, `onHit()` applies effects to all mobs in a 4-block radius:

```cpp
void ThrownPotion::onHit(HitResult *res)
{
    if (!level->isClientSide)
    {
        vector<MobEffectInstance *> *mobEffects =
            Item::potion->getMobEffects(potionValue);

        if (mobEffects != NULL && !mobEffects->empty())
        {
            AABB *aoe = bb->grow(SPLASH_RANGE, SPLASH_RANGE / 2, SPLASH_RANGE);
            vector<shared_ptr<Entity>> *entities =
                level->getEntitiesOfClass(typeid(Mob), aoe);

            for (auto it = entities->begin(); it != entities->end(); ++it)
            {
                shared_ptr<Mob> e = dynamic_pointer_cast<Mob>(*it);
                double dist = distanceToSqr(e);
                if (dist < SPLASH_RANGE_SQ)
                {
                    double scale = 1.0 - (sqrt(dist) / SPLASH_RANGE);
                    if (e == res->entity)
                        scale = 1;  // Direct hit = full strength

                    for (auto itMEI = mobEffects->begin(); ...)
                    {
                        MobEffectInstance *effect = *itMEI;
                        int id = effect->getId();
                        if (MobEffect::effects[id]->isInstantenous())
                        {
                            // Instant effects scale by distance
                            MobEffect::effects[id]->applyInstantenousEffect(
                                this->owner, e, effect->getAmplifier(), scale);
                        }
                        else
                        {
                            // Duration effects: scale duration by distance
                            int duration = (int)(scale * effect->getDuration() + .5);
                            if (duration > TICKS_PER_SECOND)
                                e->addEffect(new MobEffectInstance(
                                    id, duration, effect->getAmplifier()));
                        }
                    }
                }
            }
        }
        // Spawn splash particles
        level->levelEvent(LevelEvent::PARTICLES_POTION_SPLASH, ...);
        remove();
    }
}
```

The key detail: effects at distance get reduced duration (scaled linearly by distance from impact). Instant effects get reduced potency instead. A direct hit always gets full strength.

## Particle System

Mobs with active effects emit colored particles. In `Mob::tickEffects()`, every other tick (50% chance), a `mobSpell` particle gets spawned with the blended color of all active effects:

```cpp
if (random->nextBoolean())
{
    int colorValue = entityData->getInteger(DATA_EFFECT_COLOR_ID);
    if (colorValue > 0)
    {
        double red   = (double)((colorValue >> 16) & 0xff) / 255.0;
        double green = (double)((colorValue >> 8)  & 0xff) / 255.0;
        double blue  = (double)((colorValue >> 0)  & 0xff) / 255.0;

        level->addParticle(eParticleType_mobSpell,
            x + (random->nextDouble() - 0.5) * bbWidth,
            y + random->nextDouble() * bbHeight - heightOffset,
            z + (random->nextDouble() - 0.5) * bbWidth,
            red, green, blue);
    }
}
```

The color is computed by `PotionBrewing::getColorValue()`, which blends colors from all active effects weighted by amplifier level (higher amplifier = that color counts more toward the blend).

Each `MobEffect` has a color set via `eMinecraftColour` in its constructor. When the `effectsDirty` flag is set (after adding or removing effects), the combined color gets recalculated and synced to clients through entity data.

## How Effects Modify Gameplay

Several parts of `Mob` check for active effects and change behavior:

### Movement Speed

```cpp
float Mob::getWalkingSpeedModifier()
{
    float speed = 1.0f;
    if (hasEffect(MobEffect::movementSpeed))
        speed *= 1.0f + .2f * (getEffect(MobEffect::movementSpeed)->getAmplifier() + 1);
    if (hasEffect(MobEffect::movementSlowdown))
        speed *= 1.0f - .15f * (getEffect(MobEffect::movementSlowdown)->getAmplifier() + 1);
    return speed;
}
```

Speed I gives +20% speed per amplifier level. Slowness gives -15% per level.

### Jump Boost

```cpp
void Mob::jumpFromGround()
{
    yd = 0.42f;
    if (hasEffect(MobEffect::jump))
        yd += (getEffect(MobEffect::jump)->getAmplifier() + 1) * .1f;
}
```

Each jump boost level adds 0.1 to the base Y velocity.

### Damage Resistance

In `Mob::getDamageAfterMagicAbsorb()`, resistance reduces incoming damage:

```cpp
if (hasEffect(MobEffect::damageResistance))
{
    int absorbValue = (getEffect(MobEffect::damageResistance)->getAmplifier() + 1) * 5;
    int absorb = 25 - absorbValue;
    int v = (damage) * absorb + dmgSpill;
    damage = v / 25;
}
```

### Other Checks

- **Fire Resistance**: Blocks fire/lava damage entirely in `Mob::hurt()`
- **Water Breathing**: Prevents drowning in `Mob::aiStep()`
- **Invisibility**: Sets the mob's invisible flag
- **Weakness**: Sets the mob's weakened flag

## Creating a Custom MobEffect

### Step 1: Pick an ID

IDs 20-31 are reserved and set to NULL. Pick one of those.

### Step 2: Add the Effect

In `MobEffect.cpp`, replace one of the reserved slots:

```cpp
MobEffect *MobEffect::reserved_20 =
    (new MobEffect(20, false, eMinecraftColour_Effect_MovementSpeed))
        ->setDescriptionId(IDS_POTION_MY_EFFECT)
        ->setPostfixDescriptionId(IDS_POTION_MY_EFFECT_POSTFIX)
        ->setIcon(MobEffect::e_MobEffectIcon_Speed);
```

You will also want to rename the static pointer in `MobEffect.h`:

```cpp
// Change this:
static MobEffect *reserved_20;

// To this:
static MobEffect *myCustomEffect;
```

And update the `.cpp` file to match.

### Step 3: Add a Color

If you want a unique particle color, you will need to add a new `eMinecraftColour` constant for your effect. Use that in the constructor instead of borrowing an existing color.

### Step 4: Implement the Effect Logic

Add your effect's behavior to `applyEffectTick()`:

```cpp
void MobEffect::applyEffectTick(shared_ptr<Mob> mob, int amplification)
{
    // ... existing effects ...

    else if (id == myCustomEffect->id)
    {
        // Example: heal 2 HP per tick
        if (mob->getHealth() < mob->getMaxHealth())
            mob->heal(2 * (amplification + 1));
    }
}
```

If your effect needs to fire on a schedule (like Regeneration does every 25 ticks), also add it to `isDurationEffectTick()`:

```cpp
bool MobEffect::isDurationEffectTick(int remainingDuration, int amplification)
{
    // ... existing effects ...

    else if (id == myCustomEffect->id)
    {
        int interval = 40 >> amplification;  // 40, 20, 10 ticks...
        if (interval > 0)
            return (remainingDuration % interval) == 0;
        return true;
    }

    return false;
}
```

If your effect should be active constantly (like speed or jump boost), you don't need to touch `isDurationEffectTick()` at all. Just check for it directly in the relevant gameplay code (like `getWalkingSpeedModifier()`).

### Step 5: For Instant Effects

If you want an instant effect (like Heal or Harm), subclass `InstantenousMobEffect` instead:

```cpp
// MyInstantEffect.h
#pragma once
#include "MobEffect.h"

class MyInstantEffect : public MobEffect
{
public:
    MyInstantEffect(int id, bool isHarmful, eMinecraftColour color);
    bool isInstantenous();
    bool isDurationEffectTick(int remainingDuration, int amplification);
};
```

`InstantenousMobEffect` just returns true from `isInstantenous()` and true from `isDurationEffectTick()`. For instant effects, implement your logic in `applyInstantenousEffect()` instead of `applyEffectTick()`.

## Adding a New Brewing Ingredient

### Step 1: Write a Formula

Figure out which bits your ingredient should flip. Refer to the bit layout and the effect-to-bit mapping in `staticCtor()`.

For example, say you want a new ingredient that makes a Potion of Haste (dig speed, effect ID 3). Looking at the existing patterns, bits 0-3 encode the effect type. You need to pick a unique combination of bits 0-3 that isn't taken, then require bit 4 (enabler) and set bit 13 (functional marker).

### Step 2: Define the Formula Constant

Add your formula to `PotionBrewing.h` and `PotionBrewing.cpp`:

```cpp
// PotionBrewing.h
static const wstring MOD_MYINGREDIENT;

// PotionBrewing.cpp (inside the #if _SIMPLIFIED_BREWING block)
const wstring PotionBrewing::MOD_MYINGREDIENT = L"+0+1+2-3&4-4+13";
```

### Step 3: Assign the Formula to an Item

In `Item.cpp`, when creating (or modifying) the item, chain `setPotionBrewingFormula()`:

```cpp
Item::myNewItem = (new Item(200))
    ->setTextureName(L"myNewItem")
    ->setDescriptionId(IDS_ITEM_MY_NEW_ITEM)
    ->setPotionBrewingFormula(PotionBrewing::MOD_MYINGREDIENT);
```

That's it. The brewing stand will now accept this item as an ingredient, because `hasPotionBrewingFormula()` checks if the formula string is non-empty.

### Step 4: Add Duration and Amplifier Formulas

If your new brew value should produce a new effect, you need to add entries to the duration and amplifier maps in `PotionBrewing::staticCtor()`:

```cpp
potionEffectDuration.insert(intStringMap::value_type(
    MobEffect::myCustomEffect->getId(),
    L"0 & 1 & 2 & !3 & 0+6"  // Bits 0,1,2 set, bit 3 clear
));

// If you want glowstone to boost it:
potionEffectAmplifier.insert(intStringMap::value_type(
    MobEffect::myCustomEffect->getId(),
    L"5"  // Bit 5 = amplifier flag
));
```

## Modifying the Existing Brewing Chain

### Changing What an Ingredient Does

Just edit the formula string. For example, to make Sugar also set bit 5 (amplifier):

```cpp
// Before:
const wstring PotionBrewing::MOD_SUGAR = L"-0+1-2-3&4-4+13";

// After:
const wstring PotionBrewing::MOD_SUGAR = L"-0+1-2-3&4-4+13+5";
```

### Changing Effect Duration

The base duration formula is: `(TICKS_PER_SECOND * 60) * (duration * 3 + (duration - 1) * 2)`. This gives 3 minutes for duration=1, 8 minutes for duration=2, etc. The result then gets halved per amplifier level and scaled by the effect's `durationModifier`.

To change how long a specific effect lasts, you can:

1. Change the `durationModifier` on the `MobEffect` (affects all potions with this effect)
2. Change the duration formula in `staticCtor()` (affects which bit patterns produce longer durations)
3. Modify the duration calculation in `getEffects()` directly

### Removing an Ingredient

Set the item's formula to an empty string, or just don't call `setPotionBrewingFormula()` on it.

## Network Sync

When a server adds or removes an effect on a mob, it sends packets to clients:

- `UpdateMobEffectPacket`: Sends effect ID, amplifier, and duration
- `RemoveMobEffectPacket`: Sends the effect ID to remove

The `Mob::onEffectAdded()` and `Mob::onEffectRemoved()` methods handle sending these packets. Effects also get saved to NBT when the world saves:

```cpp
// Saving:
tag->putByte(L"Id", (BYTE) effect->getId());
tag->putByte(L"Amplifier", (BYTE) effect->getAmplifier());
tag->putInt(L"Duration", effect->getDuration());

// Loading:
int id = effectTag->getByte(L"Id");
int amplifier = effectTag->getByte(L"Amplifier");
int duration = effectTag->getInt(L"Duration");
activeEffects.insert(..., new MobEffectInstance(id, duration, amplifier));
```

## Quick Reference: Ingredient to Effect

| Ingredient | Formula Constant | Potion Produced |
|------------|-----------------|-----------------|
| Nether Wart | `MOD_NETHERWART` | Awkward Potion (base for all) |
| Sugar | `MOD_SUGAR` | Swiftness |
| Ghast Tear | `MOD_GHASTTEARS` | Regeneration |
| Spider Eye | `MOD_SPIDEREYE` | Poison |
| Fermented Spider Eye | `MOD_FERMENTEDEYE` | Weakness (or inverts other potions) |
| Glistering Melon | `MOD_SPECKLEDMELON` | Instant Health |
| Blaze Powder | `MOD_BLAZEPOWDER` | Strength |
| Golden Carrot | `MOD_GOLDENCARROT` | Night Vision |
| Magma Cream | `MOD_MAGMACREAM` | Fire Resistance |
| Redstone | `MOD_REDSTONE` | Extends duration |
| Glowstone | `MOD_GLOWSTONE` | Increases amplifier (level II) |
| Gunpowder | `MOD_GUNPOWDER` | Makes it a splash potion |
