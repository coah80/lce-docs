---
title: Enchantments
description: The LCEMP enchantment system and all enchantment types.
---

The enchantment system is built around the `Enchantment` base class and a static array of 256 possible enchantment slots. Each enchantment has an ID, a frequency (rarity weight), a category that determines which items it can apply to, and cost/level ranges used during the enchanting table selection process.

**Key source files:** `Minecraft.World/Enchantment.h`, `Minecraft.World/EnchantmentHelper.h`, `Minecraft.World/EnchantmentCategory.h`, `Minecraft.World/EnchantmentInstance.h`

## Enchantment registry

All enchantments are initialized in `Enchantment::staticCtor()` and stored in a static array of 256 entries. A `validEnchantments` vector is built by iterating that array and collecting non-null entries.

```cpp
static EnchantmentArray enchantments; // 256 slots
static vector<Enchantment *> validEnchantments;
```

Duplicate IDs trigger a debug break (`"Duplicate enchantment id!"`).

## Rarity frequencies

Each enchantment is assigned a frequency constant that controls how likely it is to appear during random enchantment selection:

| Constant | Value | Examples |
|---|---|---|
| `FREQ_COMMON` | 10 | Protection, Sharpness, Efficiency, Power |
| `FREQ_UNCOMMON` | 5 | Fire Protection, Smite, Bane of Arthropods, Knockback, Unbreaking |
| `FREQ_RARE` | 2 | Blast Protection, Fire Aspect, Looting, Fortune, Punch, Flame |
| `FREQ_VERY_RARE` | 1 | Thorns, Silk Touch, Infinity |

## All enchantment types

### Armor enchantments (IDs 0--7)

| ID | Static name | Class | Category | Max Level | Frequency |
|---|---|---|---|---|---|
| 0 | `allDamageProtection` | `ProtectionEnchantment` (ALL) | `armor` | 4 | Common |
| 1 | `fireProtection` | `ProtectionEnchantment` (FIRE) | `armor` | 4 | Uncommon |
| 2 | `fallProtection` | `ProtectionEnchantment` (FALL) | `armor_feet` | 4 | Uncommon |
| 3 | `explosionProtection` | `ProtectionEnchantment` (EXPLOSION) | `armor` | 4 | Rare |
| 4 | `projectileProtection` | `ProtectionEnchantment` (PROJECTILE) | `armor` | 4 | Uncommon |
| 5 | `drownProtection` | `OxygenEnchantment` | `armor_head` | 3 | Rare |
| 6 | `waterWorker` | `WaterWorkerEnchantment` | `armor_head` | 1 | Rare |
| 7 | `thorns` | `ThornsEnchantment` | `armor_torso` | 3 | Very Rare |

### Weapon enchantments (IDs 16--21)

| ID | Static name | Class | Category | Max Level | Frequency |
|---|---|---|---|---|---|
| 16 | `damageBonus` | `DamageEnchantment` (ALL) | `weapon` | 5 | Common |
| 17 | `damageBonusUndead` | `DamageEnchantment` (UNDEAD) | `weapon` | 5 | Uncommon |
| 18 | `damageBonusArthropods` | `DamageEnchantment` (ARTHROPODS) | `weapon` | 5 | Uncommon |
| 19 | `knockback` | `KnockbackEnchantment` | `weapon` | 2 | Uncommon |
| 20 | `fireAspect` | `FireAspectEnchantment` | `weapon` | 2 | Rare |
| 21 | `lootBonus` | `LootBonusEnchantment` | `weapon` | 3 | Rare |

### Digger/tool enchantments (IDs 32--35)

| ID | Static name | Class | Category | Max Level | Frequency |
|---|---|---|---|---|---|
| 32 | `diggingBonus` | `DiggingEnchantment` | `digger` | 5 | Common |
| 33 | `untouching` | `UntouchingEnchantment` | `digger` | 1 | Very Rare |
| 34 | `digDurability` | `DigDurabilityEnchantment` | `digger` | 3 | Uncommon |
| 35 | `resourceBonus` | `LootBonusEnchantment` | `digger` | 3 | Rare |

### Bow enchantments (IDs 48--51)

| ID | Static name | Class | Category | Max Level | Frequency |
|---|---|---|---|---|---|
| 48 | `arrowBonus` | `ArrowDamageEnchantment` | `bow` | 5 | Common |
| 49 | `arrowKnockback` | `ArrowKnockbackEnchantment` | `bow` | 2 | Rare |
| 50 | `arrowFire` | `ArrowFireEnchantment` | `bow` | 1 | Rare |
| 51 | `arrowInfinite` | `ArrowInfiniteEnchantment` | `bow` | 1 | Very Rare |

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

Some enchantment subclasses override `canEnchant()` to expand compatibility. For example, `DamageEnchantment` also accepts `HatchetItem`, `DiggingEnchantment` also accepts shears, `UntouchingEnchantment` (Silk Touch) also accepts shears, `ThornsEnchantment` accepts any `ArmorItem` (not just torso), and `DigDurabilityEnchantment` accepts any damageable item.

## Compatibility rules

The base `Enchantment::isCompatibleWith()` returns `true` for any enchantment that is not the same instance (`this != other`). Subclasses add restrictions:

- **Protection types** are mutually exclusive (only one of Protection, Fire Protection, Blast Protection, Projectile Protection can exist), except Feather Falling is compatible with all other protection types.
- **Damage types** are mutually exclusive (only one of Sharpness, Smite, Bane of Arthropods).
- **Silk Touch** and **Fortune** (resourceBonus) are mutually exclusive --- each checks incompatibility with the other.

## Damage and protection formulas

### Protection enchantments

All protection types compute a base value of `(6 + level^2) / 3.0` then apply a type-specific multiplier:

| Type | Multiplier | Applies when |
|---|---|---|
| ALL | 0.75x | Always (unless bypasses invulnerability) |
| FIRE | 1.25x | Damage source is fire |
| FALL | 2.5x | Damage source is `DamageSource::fall` |
| EXPLOSION | 1.5x | Damage source is explosion |
| PROJECTILE | 1.5x | Damage source is projectile |

The total protection across all armor pieces is capped at 25. Fire Protection also reduces burn time by `level * 15%`, and Blast Protection reduces explosion knockback by `level * 15%`.

### Damage enchantments

| Type | Total bonus at level | Condition |
|---|---|---|
| ALL (Sharpness) | `floor(level * 2.75)` | Always |
| UNDEAD (Smite) | `floor(level * 4.5)` | Target is undead mob type |
| ARTHROPODS (Bane) | `floor(level * 4.5)` | Target is arthropod mob type |

### Thorns

Thorns has a `15% * level` chance to trigger per hit. When triggered, it deals 1--4 random damage to the attacker (or `level - 10` if level exceeds 10). The thorns item takes 3 durability on trigger, 1 durability on non-trigger.

### Unbreaking

`DigDurabilityEnchantment::shouldIgnoreDurabilityDrop()` rolls `random.nextInt(level + 1) > 0` to skip durability loss. For armor items, there is an additional 60% chance that the durability drop is *not* ignored.

## Enchanting table mechanics

Managed by `EnchantmentMenu` and `EnchantmentHelper`.

### Cost calculation

`EnchantmentHelper::getEnchantmentCost()` computes the XP level cost for each of the 3 enchanting table slots. Bookshelves are capped at 15:

```
selected = random(8) + 1 + (bookcases / 2) + random(bookcases + 1)

Slot 0: max(selected / 3, 1)
Slot 1: max(selected, bookcases * 2)
Slot 2: selected
```

### Enchantment selection

`EnchantmentHelper::selectEnchantment()` determines which enchantments and levels are applied:

1. Compute an `itemBonus` from the item's enchantment value.
2. Add enchantment cost to get `enchantmentValue`.
3. Apply a random +/-15% deviation to get `realValue`.
4. Collect all available enchantments where `realValue` falls within `[minCost, maxCost]` for some level.
5. Pick the first enchantment using weighted random selection (by frequency).
6. Loop: while `random(50) <= bonusChance`, pick another compatible enchantment. `bonusChance` halves each iteration.

Enchantments are stored on items as NBT data using `"ench"` tags with `TAG_ENCH_ID` and `TAG_ENCH_LEVEL` short values. Books use a separate path through `EnchantedBookItem`.
