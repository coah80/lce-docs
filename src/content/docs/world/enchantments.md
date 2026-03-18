---
title: Enchantments
description: The LCE enchantment system and all enchantment types.
---

import { Aside } from '@astrojs/starlight/components';

The enchantment system is built around the `Enchantment` base class and a static array of 256 possible enchantment slots. Each enchantment has an ID, a frequency (rarity weight), a category that controls which items it can go on, and cost/level ranges used during the enchanting table selection process.

**Key source files:** `Minecraft.World/Enchantment.h`, `Minecraft.World/EnchantmentHelper.h`, `Minecraft.World/EnchantmentCategory.h`, `Minecraft.World/EnchantmentInstance.h`, `Minecraft.World/EnchantmentMenu.h`, `Minecraft.World/RepairMenu.h`

## Enchantment registry

All enchantments get set up in `Enchantment::staticCtor()` and stored in a static array of 256 entries. A `validEnchantments` vector is built by going through that array and collecting non-null entries.

```cpp
static EnchantmentArray enchantments; // 256 slots
static vector<Enchantment *> validEnchantments;
```

Duplicate IDs trigger a debug break (`"Duplicate enchantment id!"`). In non-content-package builds, this hits `__debugbreak()`. Content package builds just print the message and keep going.

The `validEnchantments` list is what the enchanted book loot system and creative menu use to pick random enchantments.

## Rarity frequencies

Each enchantment has a frequency constant that controls how often it shows up during random enchantment selection. This is the weight used in `WeighedRandom` selection:

| Constant | Value | Examples |
|---|---|---|
| `FREQ_COMMON` | 10 | Protection, Sharpness, Efficiency, Power |
| `FREQ_UNCOMMON` | 5 | Fire Protection, Smite, Bane of Arthropods, Knockback, Unbreaking |
| `FREQ_RARE` | 2 | Blast Protection, Fire Aspect, Looting, Fortune, Punch, Flame |
| `FREQ_VERY_RARE` | 1 | Thorns, Silk Touch, Infinity |

A `FREQ_COMMON` enchantment is 10x more likely to be chosen than a `FREQ_VERY_RARE` one when both are in the candidate pool.

## All enchantment types

### Armor enchantments (IDs 0-7)

| ID | Name | Class | Type | Category | Max Level | Frequency |
|---|---|---|---|---|---|---|
| 0 | Protection | `ProtectionEnchantment` | ALL | `armor` | 4 | Common (10) |
| 1 | Fire Protection | `ProtectionEnchantment` | FIRE | `armor` | 4 | Uncommon (5) |
| 2 | Feather Falling | `ProtectionEnchantment` | FALL | `armor_feet` | 4 | Uncommon (5) |
| 3 | Blast Protection | `ProtectionEnchantment` | EXPLOSION | `armor` | 4 | Rare (2) |
| 4 | Projectile Protection | `ProtectionEnchantment` | PROJECTILE | `armor` | 4 | Uncommon (5) |
| 5 | Respiration | `OxygenEnchantment` | - | `armor_head` | 3 | Rare (2) |
| 6 | Aqua Affinity | `WaterWorkerEnchantment` | - | `armor_head` | 1 | Rare (2) |
| 7 | Thorns | `ThornsEnchantment` | - | `armor_torso` | 3 | Very Rare (1) |

### Weapon enchantments (IDs 16-21)

| ID | Name | Class | Type | Category | Max Level | Frequency |
|---|---|---|---|---|---|---|
| 16 | Sharpness | `DamageEnchantment` | ALL | `weapon` | 5 | Common (10) |
| 17 | Smite | `DamageEnchantment` | UNDEAD | `weapon` | 5 | Uncommon (5) |
| 18 | Bane of Arthropods | `DamageEnchantment` | ARTHROPODS | `weapon` | 5 | Uncommon (5) |
| 19 | Knockback | `KnockbackEnchantment` | - | `weapon` | 2 | Uncommon (5) |
| 20 | Fire Aspect | `FireAspectEnchantment` | - | `weapon` | 2 | Rare (2) |
| 21 | Looting | `LootBonusEnchantment` | - | `weapon` | 3 | Rare (2) |

### Digger/tool enchantments (IDs 32-35)

| ID | Name | Class | Type | Category | Max Level | Frequency |
|---|---|---|---|---|---|---|
| 32 | Efficiency | `DiggingEnchantment` | - | `digger` | 5 | Common (10) |
| 33 | Silk Touch | `UntouchingEnchantment` | - | `digger` | 1 | Very Rare (1) |
| 34 | Unbreaking | `DigDurabilityEnchantment` | - | `digger` | 3 | Uncommon (5) |
| 35 | Fortune | `LootBonusEnchantment` | - | `digger` | 3 | Rare (2) |

### Bow enchantments (IDs 48-51)

| ID | Name | Class | Type | Category | Max Level | Frequency |
|---|---|---|---|---|---|---|
| 48 | Power | `ArrowDamageEnchantment` | - | `bow` | 5 | Common (10) |
| 49 | Punch | `ArrowKnockbackEnchantment` | - | `bow` | 2 | Rare (2) |
| 50 | Flame | `ArrowFireEnchantment` | - | `bow` | 1 | Rare (2) |
| 51 | Infinity | `ArrowInfiniteEnchantment` | - | `bow` | 1 | Very Rare (1) |

### Available ID ranges

IDs 8-15, 22-31, 36-47, and 52-255 are all unused and free for custom enchantments.

## Enchantment categories

`EnchantmentCategory` controls which item types an enchantment can be applied to. Category matching uses `dynamic_cast` checks against the item class hierarchy:

| Category | Accepts |
|---|---|
| `all` | Any item |
| `armor` | Any `ArmorItem` |
| `armor_head` | `ArmorItem` with `SLOT_HEAD` |
| `armor_torso` | `ArmorItem` with `SLOT_TORSO` |
| `armor_legs` | `ArmorItem` with `SLOT_LEGS` |
| `armor_feet` | `ArmorItem` with `SLOT_FEET` |
| `weapon` | Any `WeaponItem` |
| `digger` | Any `DiggerItem` |
| `bow` | Any `BowItem` |

Some enchantment subclasses override `canEnchant()` to accept more items beyond their category:

- **DamageEnchantment** (Sharpness/Smite/Bane): also accepts `HatchetItem` (axes)
- **DiggingEnchantment** (Efficiency): also accepts shears
- **UntouchingEnchantment** (Silk Touch): also accepts shears
- **ThornsEnchantment**: category is `armor_torso` but overrides to accept any `ArmorItem`
- **DigDurabilityEnchantment** (Unbreaking): also accepts any damageable item

## Compatibility rules

The base `Enchantment::isCompatibleWith()` returns `true` for any enchantment that isn't the same instance (`this != other`). Subclasses add restrictions:

- **Protection types** are mutually exclusive (only one of Protection, Fire Protection, Blast Protection, Projectile Protection can exist), except Feather Falling works with all other protection types.
- **Damage types** are mutually exclusive (only one of Sharpness, Smite, Bane of Arthropods).
- **Silk Touch** and **Fortune** are mutually exclusive. Each one checks for incompatibility with the other by ID.

## Damage and protection formulas

### Protection enchantments

All protection types compute a base value then apply a type-specific multiplier:

```
base = (6 + level * level) / 3.0
```

| Type | Multiplier | Applies when | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|---|---|
| ALL (Protection) | 0.75x | All damage (unless bypasses invulnerability) | 1 | 2 | 3 | 5 |
| FIRE | 1.25x | Damage source is fire | 2 | 3 | 5 | 9 |
| FALL | 2.5x | Damage source is `DamageSource::fall` | 5 | 6 | 10 | 18 |
| EXPLOSION | 1.5x | Damage source is explosion | 3 | 4 | 6 | 11 |
| PROJECTILE | 1.5x | Damage source is projectile | 3 | 4 | 6 | 11 |

The total protection across all armor pieces is capped at 25. After capping, the final value is randomized:

```
final = ((sum + 1) >> 1) + random.nextInt((sum >> 1) + 1)
```

So with a sum of 25, the final protection is between 13 and 25.

**Fire Protection** also reduces burn time by `level * 15%`. **Blast Protection** reduces explosion knockback by `level * 15%`. These are handled in `ProtectionEnchantment::getFireAfterDampener()` and `getExplosionKnockbackAfterDampener()`.

### Damage enchantments

The `getDamageBonus()` method returns a per-level bonus that feeds into a randomized total:

| Type | Bonus per level | Formula | Condition |
|---|---|---|---|
| ALL (Sharpness) | 2.75 | `floor(level * 2.75)` | Always |
| UNDEAD (Smite) | 4.5 | `floor(level * 4.5)` | Target is undead mob type |
| ARTHROPODS (Bane) | 4.5 | `floor(level * 4.5)` | Target is arthropod mob type |

**Level-by-level values:**

| Level | Sharpness | Smite/Bane (vs matching type) |
|---|---|---|
| 1 | 2 | 4 |
| 2 | 5 | 9 |
| 3 | 8 | 13 |
| 4 | 11 | 18 |
| 5 | 13 | 22 |

The sum of all damage bonuses from all enchantments on the held item gets randomized: `1 + random.nextInt(sum)`. So Sharpness V gives a random bonus between 1 and 13 per hit.

### Bow enchantments

**Power** (ArrowDamageEnchantment) does not override `getDamageBonus()`. The bow damage boost is handled separately in the arrow entity code, not through the enchantment iteration system. The enchantment just needs its level read via `getEnchantmentLevel()`.

**Punch** (ArrowKnockbackEnchantment) adds knockback to arrows. The level is read directly from the item.

**Flame** (ArrowFireEnchantment) sets arrows on fire. It's a simple boolean check (level > 0).

**Infinity** (ArrowInfiniteEnchantment) prevents arrow consumption. Also a simple boolean check.

### Thorns

Thorns has a `15% * level` chance to trigger on each hit. When it triggers, it deals 1-4 random damage to the attacker (or `level - 10` if the level is over 10). The trigger and damage logic:

```cpp
// 15% chance per level
bool shouldHit = random.nextFloat() < 0.15f * level;

// Damage: 1-4 random, or level-10 if level > 10
int damage = (level > 10) ? (level - 10) : (1 + random.nextInt(4));
```

Thorns always costs durability when the wearer gets hit. If it triggers, the armor loses 3 durability. If it doesn't trigger, the armor still loses 1 durability. This extra durability cost is on top of the normal damage durability loss.

The total thorns level is read from all equipment slots combined, but only one random armor piece (the one with thorns) takes the durability hit.

### Unbreaking

`DigDurabilityEnchantment::shouldIgnoreDurabilityDrop()` decides if a durability loss should be skipped:

```cpp
// Armor has a 60% chance to NOT benefit from Unbreaking
if (isArmor && random.nextFloat() < 0.6f) return false;

// Otherwise: level/(level+1) chance to skip
return random.nextInt(level + 1) > 0;
```

| Level | Skip chance (non-armor) | Skip chance (armor) |
|---|---|---|
| 1 | 50% | 20% |
| 2 | 66.7% | 26.7% |
| 3 | 75% | 30% |

### Other enchantment effects

These enchantments are checked by specific helper methods in `EnchantmentHelper`. Each one reads the enchantment level from the relevant item:

| Helper Method | Enchantment | What it checks | Source |
|---|---|---|---|
| `getKnockbackBonus()` | Knockback | Held item | Level = bonus knockback |
| `getFireAspect()` | Fire Aspect | Carried item | Level = fire ticks (level * 4 seconds) |
| `getOxygenBonus()` | Respiration | Armor | Level = extra air supply |
| `getDiggingBonus()` | Efficiency | Held item | Level = mining speed bonus |
| `getDigDurability()` | Unbreaking | Held item | Level = durability save chance |
| `hasSilkTouch()` | Silk Touch | Held item | Boolean: level > 0 |
| `getDiggingLootBonus()` | Fortune | Held item | Level = extra drop chance |
| `getKillingLootBonus()` | Looting | Held item | Level = extra mob drop chance |
| `hasWaterWorkerBonus()` | Aqua Affinity | Armor | Boolean: level > 0 |
| `getArmorThorns()` | Thorns | All equipment slots | Level = thorns chance |

## Enchantment cost curves

Every enchantment has `getMinCost(level)` and `getMaxCost(level)` methods that define the range of enchantment values at which a given level shows up in the enchanting table. Here are the exact formulas from the source:

### Protection enchantments

The protection types use lookup arrays indexed by type:

| Type | `minCost` base | `levelCost` per level | `maxCost` span |
|---|---|---|---|
| ALL (Protection) | 1 | 11 | +20 |
| FIRE | 10 | 8 | +12 |
| FALL (Feather Falling) | 5 | 6 | +10 |
| EXPLOSION (Blast Protection) | 5 | 8 | +12 |
| PROJECTILE | 3 | 6 | +15 |

Formula: `minCost = base + (level - 1) * levelCost`, `maxCost = minCost + span`

**Protection (ALL) cost ranges:**

| Level | Min Cost | Max Cost |
|---|---|---|
| 1 | 1 | 21 |
| 2 | 12 | 32 |
| 3 | 23 | 43 |
| 4 | 34 | 54 |

### Damage enchantments

| Type | `minCost` base | `levelCost` | `maxCost` span |
|---|---|---|---|
| ALL (Sharpness) | 1 | 11 | +20 |
| UNDEAD (Smite) | 5 | 8 | +20 |
| ARTHROPODS (Bane) | 5 | 8 | +20 |

**Sharpness cost ranges:**

| Level | Min Cost | Max Cost |
|---|---|---|
| 1 | 1 | 21 |
| 2 | 12 | 32 |
| 3 | 23 | 43 |
| 4 | 34 | 54 |
| 5 | 45 | 65 |

### Other enchantment costs

| Enchantment | Min Cost Formula | Max Cost Formula | Notes |
|---|---|---|---|
| Knockback | `5 + 20 * (level - 1)` | `base.getMinCost(level) + 50` | Uses base class minCost for maxCost |
| Fire Aspect | `10 + 20 * (level - 1)` | `base.getMinCost(level) + 50` | |
| Looting/Fortune | `15 + (level - 1) * 9` | `base.getMinCost(level) + 50` | Same class for both |
| Efficiency | `1 + 10 * (level - 1)` | `base.getMinCost(level) + 50` | |
| Silk Touch | `15` (flat) | `base.getMinCost(level) + 50` | Single level |
| Unbreaking | `5 + (level - 1) * 8` | `base.getMinCost(level) + 50` | |
| Respiration | `10 * level` | `minCost + 30` | |
| Aqua Affinity | `1` (flat) | `minCost + 40` | Single level |
| Thorns | `10 + 20 * (level - 1)` | `base.getMinCost(level) + 50` | Uses base class minCost for maxCost |
| Power | `1 + (level - 1) * 10` | `minCost + 15` | |
| Punch | `12 + (level - 1) * 20` | `minCost + 25` | |
| Flame | `20` (flat) | `50` | Single level |
| Infinity | `20` (flat) | `50` | Single level |

<Aside type="note">
Several enchantments use `Enchantment::getMinCost(level)` (the base class version: `1 + level * 10`) for their max cost calculation, which is different from calling `this->getMinCost(level)`. This means the max cost window moves at a different rate than the min cost. This looks intentional.
</Aside>

## Enchanting table mechanics

Managed by `EnchantmentMenu` and `EnchantmentHelper`.

### Bookshelf detection

When you place an item on the enchanting table, `EnchantmentMenu::slotsChanged()` counts bookshelves. The algorithm scans a 5x5 area around the table at both y and y+1 height:

1. For each position in a 3x3 ring around the table (skipping the center)
2. Check if the two blocks between the table and the edge are both air
3. If so, check if the block at 2x distance is a bookshelf (at both y and y+1)
4. For corner positions, also check the two adjacent edge positions

Bookshelves cap at 15 for cost calculation purposes.

A fresh random seed (`nameSeed`) is generated each time an item is placed. This seed drives the enchantment glyphs shown in the UI.

### Cost calculation

`EnchantmentHelper::getEnchantmentCost()` computes the XP level cost for each of the 3 enchanting table slots:

```
selected = random(8) + 1 + (bookcases / 2) + random(bookcases + 1)

Slot 0 (top):    max(selected / 3, 1)
Slot 1 (middle): max(selected, bookcases * 2)
Slot 2 (bottom): selected
```

With 0 bookshelves, `selected` ranges from 1 to 8. With 15 bookshelves, `selected` ranges from 8 to 30.

**Cost ranges by bookshelf count:**

| Bookshelves | Slot 0 (top) | Slot 1 (middle) | Slot 2 (bottom) |
|---|---|---|---|
| 0 | 1-2 | 1-8 | 1-8 |
| 5 | 1-6 | 10-18 | 3-18 |
| 10 | 2-8 | 20-25 | 6-25 |
| 15 | 2-10 | 30 | 8-30 |

The item must have a positive `getEnchantmentValue()` to be enchantable at all. Items with enchantment value 0 return a cost of 0 (not enchantable).

### Enchantment selection algorithm

`EnchantmentHelper::selectEnchantment()` figures out which enchantments and levels get applied. Here is the full process:

**Step 1: Calculate the effective enchantment value**

```cpp
itemBonus = item.getEnchantmentValue();
itemBonus /= 2;
itemBonus = 1 + random(itemBonus/2 + 1) + random(itemBonus/2 + 1);
enchantmentValue = itemBonus + enchantmentCost;
```

**Step 2: Apply random deviation**

```cpp
deviation = (random.nextFloat() + random.nextFloat() - 1.0) * 0.15;
realValue = (int)(enchantmentValue * (1.0 + deviation) + 0.5);
if (realValue < 1) realValue = 1;
```

This gives a +/-15% random spread on the final value.

**Step 3: Find candidate enchantments**

For each registered enchantment, check every level from `getMinLevel()` to `getMaxLevel()`. If `realValue` falls within `[getMinCost(level), getMaxCost(level)]`, that enchantment at that level is a candidate. If multiple levels match, the highest one wins (later iterations overwrite earlier ones in the map).

Books skip the category check, so any enchantment can appear on a book.

**Step 4: Pick the first enchantment**

Use weighted random selection (by frequency) to pick one enchantment from the candidates.

**Step 5: Roll for bonus enchantments**

```cpp
bonusChance = realValue;
while (random.nextInt(50) <= bonusChance) {
    // Remove candidates incompatible with already-picked enchantments
    // Pick another weighted random enchantment
    bonusChance >>= 1;  // Halve the chance each round
}
```

Each round, the chance of getting another enchantment drops. With `realValue = 30`, the first round has a 30/50 = 60% chance, the second round 15/50 = 30%, the third 7/50 = 14%, and so on.

**Step 6: Apply to item**

For books, only one randomly chosen enchantment from the result set is applied (the rest are discarded). For regular items, all selected enchantments are applied.

### Enchanted books

When a book is enchanted, it becomes an `EnchantedBookItem` (item ID changes from `book_Id` to `enchantedBook_Id`). Only one enchantment from the selection is kept (picked randomly via `random.nextInt(newEnchantment->size())`). This is different from regular items which get all selected enchantments.

Enchanted books store their enchantments under the `"StoredEnchantments"` tag instead of `"ench"`. The `EnchantedBookItem::addEnchantment()` method has dedup logic: if the book already has the enchantment at a lower level, it upgrades instead of adding a duplicate.

## Anvil combining rules

The `RepairMenu::createResult()` method handles all anvil logic. The anvil has two input slots (input and addition) and one output slot.

### Cost calculation

The total cost has two parts: **price** (the work being done) and **tax** (based on existing enchantments and prior work penalty).

```
cost = tax + price
```

The tax starts with the sum of both items' `baseRepairCost` values. This value doubles (roughly) each time an item goes through the anvil, making repeated anvil use progressively more expensive.

### Repairing with materials

If the addition item is a valid repair material for the input item:
1. Each unit of repair material fixes `maxDamage / 4` durability
2. Price goes up by `max(1, repairAmount / 100) + numEnchantments` per unit consumed
3. Multiple units can be used in one operation

### Combining two items

If two items of the same type are combined:
1. Durability is merged: `remaining1 + remaining2 + maxDamage * 12%`
2. Enchantments are merged following the rules below

### Enchantment merging

For each enchantment on the addition item:
1. Check if it's compatible with the input item (`canEnchant()`, unless in creative mode)
2. Check if it conflicts with any existing enchantment on the input (`isCompatibleWith()`)
3. If incompatible, charge the cost but skip the enchantment
4. If compatible, merge the levels:
   - Same enchantment at the same level: level goes up by 1
   - Same enchantment at different levels: take the higher level
   - New enchantment: add it at its level
5. Level is capped at `getMaxLevel()` for the enchantment

### Enchantment cost per level

The price per enchantment level depends on rarity:

| Rarity | Fee per level |
|---|---|
| Common (10) | 1 |
| Uncommon (5) | 2 |
| Rare (2) | 4 |
| Very Rare (1) | 8 |

If using an enchanted book as the addition, the fee is halved (minimum 1). The tax from existing enchantments is also halved when using a book.

### Cost cap

If the total cost hits 40 or above, the result is blocked (unless in creative mode). There is one special case: if the only operation is renaming and the cost would be 40+, it gets capped to 39.

### Naming

Renaming costs 7 XP for damageable items, or `count * 5` for stackable items. If the item already has a custom name, half the naming cost is added to the tax.

### Prior work penalty

Every time an item goes through the anvil, its `baseRepairCost` increases:

```cpp
newBaseCost = max(input.baseRepairCost, addition.baseRepairCost);
if (hasCustomName) newBaseCost -= 9;
if (newBaseCost < 0) newBaseCost = 0;
newBaseCost += 2;
```

This penalty stacks, making items progressively more expensive to modify.

## NBT storage

Enchantments are stored on items as NBT data using `"ench"` tags. Each enchantment is a `CompoundTag` with two short values:

- `TAG_ENCH_ID` - the enchantment's numeric ID
- `TAG_ENCH_LEVEL` - the level

These live in a `ListTag<CompoundTag>` under the `"ench"` key on the item.

### Level display

The `getLevelString()` method maps levels 1-10 to roman numeral string IDs (`IDS_ENCHANTMENT_LEVEL_1` through `IDS_ENCHANTMENT_LEVEL_10`). Levels above 10 fall back to the level 1 string (the default case in the switch). The tooltip is built by `getFullname()` which combines the enchantment name and level string, wrapped in an HTML color tag.

## EnchantmentHelper methods

These static methods on `EnchantmentHelper` check for enchantments during gameplay. They use an iterator pattern that walks through all enchantments on an item or inventory:

- `runIterationOnItem()` - iterates enchantments on a single item
- `runIterationOnInventory()` - iterates enchantments across all items in an inventory (armor array)
- `getDamageProtection()` - sums protection from armor, caps at 25, randomizes
- `getDamageBonus()` - sums damage bonus from held item, randomizes if > 0

## MinecraftConsoles differences

The enchantment system is the same between LCEMP and MC. Both register the exact same 22 enchantments (IDs 0-7, 16-21, 32-35, 48-51) with the same frequencies, categories, max levels, and formulas.

No new enchantments are added in MC. The enchanting table mechanics, compatibility rules, damage/protection formulas, and cost calculations are all identical.

The only indirect difference is that MC's attribute system (`SharedMonsterAttributes`, `AttributeModifier`) could theoretically interact with enchantment effects differently, but the actual enchantment code itself is unchanged.
