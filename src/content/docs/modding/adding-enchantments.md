---
title: Adding Enchantments
description: Step-by-step guide to adding new enchantments to LCEMP.
---

This guide covers the LCEMP enchantment system: how to create enchantment subclasses, register them, define cost curves, implement damage/protection modifiers, set up compatibility rules, and how the enchanting table's selection algorithm works.

## Enchantment System Overview

The enchantment system spans several files in `Minecraft.World/`:

| File | Purpose |
|------|---------|
| `Enchantment.h` / `.cpp` | Base class, static registry, frequency constants |
| `EnchantmentCategory.h` | Item type categories (armor, weapon, digger, bow) |
| `EnchantmentInstance.h` | Pairs an enchantment with a level (used in selection) |
| `EnchantmentHelper.h` / `.cpp` | Static utilities: damage calculation, enchanting table algorithm |
| `EnchantmentMenu.h` | The enchanting table container/UI |
| Subclasses | `ProtectionEnchantment`, `DamageEnchantment`, `ThornsEnchantment`, etc. |

## Step 1: Create an Enchantment Subclass

### Header (`Minecraft.World/MyEnchantment.h`)

```cpp
#pragma once
#include "Enchantment.h"

class MyEnchantment : public Enchantment
{
public:
    MyEnchantment(int id, int frequency);

    virtual int getMinCost(int level);
    virtual int getMaxCost(int level);
    virtual int getMaxLevel();

    // Override one or both of these for combat enchantments:
    virtual int getDamageProtection(int level, DamageSource *source);
    virtual int getDamageBonus(int level, shared_ptr<Mob> target);

    // Override for custom compatibility rules:
    virtual bool isCompatibleWith(Enchantment *other) const;
};
```

### Implementation (`Minecraft.World/MyEnchantment.cpp`)

```cpp
#include "MyEnchantment.h"

MyEnchantment::MyEnchantment(int id, int frequency)
    : Enchantment(id, frequency, EnchantmentCategory::weapon)
{
    setDescriptionId(IDS_ENCHANTMENT_MY_ENCH);
}

int MyEnchantment::getMinCost(int level)
{
    return 5 + (level - 1) * 10;
}

int MyEnchantment::getMaxCost(int level)
{
    return getMinCost(level) + 20;
}

int MyEnchantment::getMaxLevel()
{
    return 3;
}

int MyEnchantment::getDamageBonus(int level, shared_ptr<Mob> target)
{
    // Example: flat bonus per level
    return level * 2;
}

bool MyEnchantment::isCompatibleWith(Enchantment *other) const
{
    // Incompatible with other damage enchantments
    return dynamic_cast<DamageEnchantment *>(other) == NULL;
}
```

## Step 2: The Enchantment Base Class

The `Enchantment` constructor automatically registers itself into the global `enchantments[256]` array:

```cpp
Enchantment::Enchantment(int id, int frequency,
    const EnchantmentCategory *category)
    : id(id), frequency(frequency), category(category)
{
    _init(id);  // Stores 'this' in enchantments[id]
}
```

If you use a duplicate ID, it triggers `__debugbreak()` in debug builds.

### Key Virtual Methods

| Method | Default | Purpose |
|--------|---------|---------|
| `getMinLevel()` | 1 | Minimum enchantment level |
| `getMaxLevel()` | 1 | Maximum enchantment level |
| `getMinCost(level)` | `1 + level * 10` | Minimum enchantment value for this level to show up |
| `getMaxCost(level)` | `getMinCost(level) + 5` | Maximum enchantment value for this level |
| `getFrequency()` | Constructor arg | Weight in random selection |
| `getDamageProtection(level, source)` | 0 | Damage reduction points |
| `getDamageBonus(level, target)` | 0 | Extra damage dealt |
| `isCompatibleWith(other)` | `this != other` | Can coexist on the same item |
| `canEnchant(item)` | Delegates to category | Whether this enchantment applies to the item |

### Frequency Constants

Frequency controls how likely the enchantment is to be picked from the candidate pool (higher = more common):

| Constant | Value | Examples |
|----------|-------|---------|
| `FREQ_COMMON` | 10 | Protection, Sharpness, Efficiency, Power |
| `FREQ_UNCOMMON` | 5 | Fire Protection, Smite, Knockback, Unbreaking |
| `FREQ_RARE` | 2 | Blast Protection, Fire Aspect, Looting, Fortune, Flame, Punch |
| `FREQ_VERY_RARE` | 1 | Silk Touch, Thorns, Infinity |

## Step 3: Enchantment Categories

`EnchantmentCategory` decides which items an enchantment can go on:

| Category | Constant | Items |
|----------|----------|-------|
| All items | `EnchantmentCategory::all` | Everything |
| Any armor | `EnchantmentCategory::armor` | Helmets, chestplates, leggings, boots |
| Boots only | `EnchantmentCategory::armor_feet` | Boots |
| Leggings only | `EnchantmentCategory::armor_legs` | Leggings |
| Chestplate only | `EnchantmentCategory::armor_torso` | Chestplates |
| Helmet only | `EnchantmentCategory::armor_head` | Helmets |
| Weapons | `EnchantmentCategory::weapon` | Swords (and axes via override) |
| Diggers | `EnchantmentCategory::digger` | Pickaxes, shovels, axes |
| Bows | `EnchantmentCategory::bow` | Bows |

The category check happens through `EnchantmentCategory::canEnchant(Item *item)`.

### Overriding canEnchant

Some enchantments override `canEnchant` to work on items outside their category. For example, `DamageEnchantment` (Sharpness/Smite/Bane) also works on axes:

```cpp
bool DamageEnchantment::canEnchant(shared_ptr<ItemInstance> item)
{
    HatchetItem *hatchet = dynamic_cast<HatchetItem *>(item->getItem());
    if (hatchet) return true;
    return Enchantment::canEnchant(item);
}
```

Similarly, `ThornsEnchantment` has category `armor_torso` but overrides `canEnchant` to accept any `ArmorItem`:

```cpp
bool ThornsEnchantment::canEnchant(shared_ptr<ItemInstance> item)
{
    ArmorItem *armor = dynamic_cast<ArmorItem *>(item->getItem());
    if (armor) return true;
    return Enchantment::canEnchant(item);
}
```

## Step 4: Register the Enchantment

Add your enchantment to `Enchantment::staticCtor()` in `Minecraft.World/Enchantment.cpp`:

```cpp
// 1. Declare in Enchantment.h:
static Enchantment *myEnchantment;

// 2. Initialize in Enchantment.cpp (top of file):
Enchantment *Enchantment::myEnchantment = NULL;

// 3. Create in staticCtor():
void Enchantment::staticCtor()
{
    // ... existing enchantments ...

    myEnchantment = new MyEnchantment(64, FREQ_UNCOMMON);

    // The loop at the end collects all non-null entries
    // into validEnchantments automatically:
    for (unsigned int i = 0; i < 256; ++i)
    {
        Enchantment *enchantment = enchantments[i];
        if (enchantment != NULL)
        {
            validEnchantments.push_back(enchantment);
        }
    }
}
```

### Enchantment ID Ranges

Vanilla enchantments use these ID ranges:

| Range | Category |
|-------|----------|
| 0-7 | Armor enchantments |
| 16-21 | Weapon enchantments |
| 32-35 | Tool/digger enchantments |
| 48-51 | Bow enchantments |

Pick an ID that doesn't collide with existing enchantments. IDs 0-255 are valid.

## Step 5: Compatibility Rules

The `isCompatibleWith()` method controls which enchantments can live on the same item. The enchanting table algorithm removes incompatible candidates when building multi-enchantment results.

### Default Behavior

```cpp
bool Enchantment::isCompatibleWith(Enchantment *other) const
{
    return this != other;  // Only incompatible with itself
}
```

### Protection Enchantment Compatibility

`ProtectionEnchantment` has a more specific rule. Protection types are mutually exclusive (you can't have both Protection and Fire Protection), but Feather Falling works with all other protection types:

```cpp
bool ProtectionEnchantment::isCompatibleWith(Enchantment *other) const
{
    ProtectionEnchantment *pe =
        dynamic_cast<ProtectionEnchantment *>(other);
    if (pe != NULL)
    {
        if (pe->type == this->type) return false;
        if (this->type == FALL || pe->type == FALL) return true;
        return false;
    }
    return Enchantment::isCompatibleWith(other);
}
```

### Damage Enchantment Compatibility

All damage enchantments (Sharpness, Smite, Bane of Arthropods) are mutually exclusive:

```cpp
bool DamageEnchantment::isCompatibleWith(Enchantment *other) const
{
    return dynamic_cast<DamageEnchantment *>(other) == NULL;
}
```

## Step 6: Damage and Protection Modifiers

### Protection Modifiers

`getDamageProtection()` returns a protection value that feeds into `EnchantmentHelper::getDamageProtection()`. The total across all armor pieces is capped at 25, then randomized:

```cpp
// From EnchantmentHelper.cpp:
// Sum all protection values from armor pieces
if (sum > 25) sum = 25;
return ((sum + 1) >> 1) + random.nextInt((sum >> 1) + 1);
```

Here's how `ProtectionEnchantment` calculates protection based on type:

```cpp
int ProtectionEnchantment::getDamageProtection(
    int level, DamageSource *source)
{
    if (source->isBypassInvul()) return 0;

    float protect = (6 + level * level) / 3.0f;

    if (type == ALL)       return floor(protect * 0.75f);
    if (type == FIRE)      return floor(protect * 1.25f);  // fire only
    if (type == FALL)      return floor(protect * 2.5f);   // fall only
    if (type == EXPLOSION) return floor(protect * 1.5f);   // explosion only
    if (type == PROJECTILE)return floor(protect * 1.5f);   // projectile only
    return 0;
}
```

### Damage Modifiers

`getDamageBonus()` returns extra damage dealt to a target. The `DamageEnchantment` class checks the target's `MobType`:

```cpp
int DamageEnchantment::getDamageBonus(
    int level, shared_ptr<Mob> target)
{
    if (type == ALL)
        return floor(level * 2.75f);        // Sharpness
    if (type == UNDEAD && target->getMobType() == UNDEAD)
        return floor(level * 4.5f);          // Smite
    if (type == ARTHROPODS && target->getMobType() == ARTHROPOD)
        return floor(level * 4.5f);          // Bane of Arthropods
    return 0;
}
```

The total bonus gets randomized in `EnchantmentHelper::getDamageBonus()`:

```cpp
if (sum > 0)
{
    return 1 + random.nextInt(sum);
}
return 0;
```

### Thorns: A Special Case

`ThornsEnchantment` doesn't use `getDamageProtection` or `getDamageBonus`. Instead, it has static helper methods that are called from the damage pipeline:

```cpp
// 15% chance per level to reflect damage
bool ThornsEnchantment::shouldHit(int level, Random *random)
{
    if (level <= 0) return false;
    return random->nextFloat() < 0.15f * level;
}

// Reflected damage: 1-4 random, or (level - 10) if level > 10
int ThornsEnchantment::getDamage(int level, Random *random)
{
    if (level > 10) return level - 10;
    return 1 + random->nextInt(4);
}
```

## Step 7: Hook Into the Damage Pipeline

To make your enchantment actually do something, you need to connect it with `EnchantmentHelper`. The helper uses an **iteration pattern** that walks through all enchantments on an item:

```cpp
// EnchantmentHelper iterates enchantments on items via:
void runIterationOnItem(EnchantmentIterationMethod &method,
    shared_ptr<ItemInstance> piece);

void runIterationOnInventory(EnchantmentIterationMethod &method,
    ItemInstanceArray inventory);
```

For protection and damage enchantments, the base class `getDamageProtection()` and `getDamageBonus()` methods get called automatically by the existing iteration methods. You don't need any extra wiring.

For special effects (like Thorns), add a helper function in `EnchantmentHelper`:

```cpp
// In EnchantmentHelper.h:
static int getMyEnchantmentLevel(shared_ptr<Inventory> inventory);

// In EnchantmentHelper.cpp:
int EnchantmentHelper::getMyEnchantmentLevel(
    shared_ptr<Inventory> inventory)
{
    return getEnchantmentLevel(
        Enchantment::myEnchantment->id,
        inventory->getSelected());
}
```

Then call this from the relevant game logic (like `Mob::hurt()`, `Mob::doHurtTarget()`, etc.).

## The Enchanting Table Algorithm

Understanding how the enchanting table picks enchantments is useful for tuning your enchantment's cost curves.

### Step 1: Calculate the Enchantment Cost

`EnchantmentHelper::getEnchantmentCost()` figures out the enchantment value for each of the three table slots:

```cpp
int getEnchantmentCost(Random *random, int slot,
    int bookcases, shared_ptr<ItemInstance> item)
{
    int itemValue = item->getItem()->getEnchantmentValue();
    if (itemValue <= 0) return 0;  // Not enchantable

    if (bookcases > 15) bookcases = 15;  // Cap at 15

    int selected = random->nextInt(8) + 1
                 + (bookcases >> 1)
                 + random->nextInt(bookcases + 1);

    if (slot == 0) return max(selected / 3, 1);  // Top slot (cheapest)
    if (slot == 1) return max(selected, bookcases * 2);  // Middle slot (guaranteed minimum)
    return selected;                               // Bottom slot (raw value)
}
```

### Step 2: Select Enchantments

`EnchantmentHelper::selectEnchantment()` picks which enchantments and levels to apply:

1. **Calculate item bonus**: Take the item's enchantment value, halve it, then add two random rolls.
2. **Combine with cost**: `enchantmentValue = itemBonus + enchantmentCost`
3. **Apply deviation**: Random +/-15% adjustment.
4. **Find candidates**: For each registered enchantment, check if `realValue` falls within `[getMinCost(level), getMaxCost(level)]` for any valid level.
5. **Weighted selection**: Pick the first enchantment using weighted random (by `getFrequency()`).
6. **Bonus enchantments**: Loop with `random.nextInt(50) <= bonusChance`, halving `bonusChance` each time. Each iteration removes candidates that are incompatible with already-selected enchantments (using `isCompatibleWith()`) and picks another weighted random enchantment from what's left.

```cpp
// Simplified flow:
while (random->nextInt(50) <= bonusChance)
{
    // Remove incompatible enchantments
    // Pick another random enchantment
    bonusChance >>= 1;  // Halve the chance each round
}
```

### Step 3: Apply to Item

`EnchantmentHelper::enchantItem()` applies the selected enchantments. If the item is a book, it becomes an enchanted book instead.

### Tuning Your Enchantment's Appearance

The cost curve (`getMinCost` / `getMaxCost`) determines at what enchanting table levels your enchantment shows up:

| Parameter | Effect |
|-----------|--------|
| Lower `getMinCost` | Appears at lower enchanting levels |
| Wider cost window (`maxCost - minCost`) | More likely to be selected |
| Higher `getFrequency` | More likely to be picked from candidates |
| Lower `getMaxLevel` | Fewer level variants competing for the same cost range |

## Existing Enchantment Reference

### Armor Enchantments (IDs 0-7)

| ID | Name | Class | Category | Freq | Max Level |
|----|------|-------|----------|------|-----------|
| 0 | Protection | `ProtectionEnchantment` (ALL) | `armor` | 10 | 4 |
| 1 | Fire Protection | `ProtectionEnchantment` (FIRE) | `armor` | 5 | 4 |
| 2 | Feather Falling | `ProtectionEnchantment` (FALL) | `armor_feet` | 5 | 4 |
| 3 | Blast Protection | `ProtectionEnchantment` (EXPLOSION) | `armor` | 2 | 4 |
| 4 | Projectile Protection | `ProtectionEnchantment` (PROJECTILE) | `armor` | 5 | 4 |
| 5 | Respiration | `OxygenEnchantment` | `armor` | 2 | 3 |
| 6 | Aqua Affinity | `WaterWorkerEnchantment` | `armor` | 2 | 1 |
| 7 | Thorns | `ThornsEnchantment` | `armor_torso` | 1 | 3 |

### Weapon Enchantments (IDs 16-21)

| ID | Name | Class | Category | Freq | Max Level |
|----|------|-------|----------|------|-----------|
| 16 | Sharpness | `DamageEnchantment` (ALL) | `weapon` | 10 | 5 |
| 17 | Smite | `DamageEnchantment` (UNDEAD) | `weapon` | 5 | 5 |
| 18 | Bane of Arthropods | `DamageEnchantment` (ARTHROPODS) | `weapon` | 5 | 5 |
| 19 | Knockback | `KnockbackEnchantment` | `weapon` | 5 | 2 |
| 20 | Fire Aspect | `FireAspectEnchantment` | `weapon` | 2 | 2 |
| 21 | Looting | `LootBonusEnchantment` | `weapon` | 2 | 3 |

### Tool Enchantments (IDs 32-35)

| ID | Name | Class | Category | Freq | Max Level |
|----|------|-------|----------|------|-----------|
| 32 | Efficiency | `DiggingEnchantment` | `digger` | 10 | 5 |
| 33 | Silk Touch | `UntouchingEnchantment` | `digger` | 1 | 1 |
| 34 | Unbreaking | `DigDurabilityEnchantment` | `digger` | 5 | 3 |
| 35 | Fortune | `LootBonusEnchantment` | `digger` | 2 | 3 |

### Bow Enchantments (IDs 48-51)

| ID | Name | Class | Category | Freq | Max Level |
|----|------|-------|----------|------|-----------|
| 48 | Power | `ArrowDamageEnchantment` | `bow` | 10 | 5 |
| 49 | Punch | `ArrowKnockbackEnchantment` | `bow` | 2 | 2 |
| 50 | Flame | `ArrowFireEnchantment` | `bow` | 2 | 1 |
| 51 | Infinity | `ArrowInfiniteEnchantment` | `bow` | 1 | 1 |
