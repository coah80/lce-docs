---
title: "Attribute System"
description: "The attribute and combat tracking system in MinecraftConsoles."
---

The attribute system gives entities configurable, modifiable numeric properties like max health and movement speed. It's a C++ port of the Java Edition 1.6 attribute system, adapted by 4J Studios to use enum-based IDs instead of string names, and further maintained in MinecraftConsoles.

**Key source files:** `Attribute.h`, `BaseAttribute.h`, `RangedAttribute.h`, `AttributeModifier.h`, `AttributeInstance.h`, `ModifiableAttributeInstance.h`, `BaseAttributeMap.h`, `SharedMonsterAttributes.h`, `CombatTracker.h`, `CombatEntry.h` (all in `Minecraft.World/`).

## Attribute hierarchy

### Attribute (abstract base)

`Attribute` is a pure virtual class that defines the interface for all attributes:

- `getId()` returns an `eATTRIBUTE_ID` enum value (used for serialization instead of string names)
- `sanitizeValue(double)` clamps a value to a valid range
- `getDefaultValue()` returns the initial value
- `isClientSyncable()` whether this attribute is sent to the client
- `getName(eATTRIBUTE_ID)` static helper that returns a localized string resource ID

### BaseAttribute

The concrete implementation that stores the attribute's ID, default value, and syncable flag. Has `setSyncable(bool)` to mark an attribute for client synchronization.

### RangedAttribute

Extends `BaseAttribute` with `minValue` and `maxValue` bounds. The `sanitizeValue` method clamps values to `[minValue, maxValue]`. Constructor takes `(id, defaultValue, minValue, maxValue)`.

## Attribute IDs

The `eATTRIBUTE_ID` enum gets serialized into save data, so the values must never be reordered. New attributes are always appended after the existing entries.

| Enum constant | Purpose |
|---|---|
| `eAttributeId_GENERIC_MAXHEALTH` | Maximum health points |
| `eAttributeId_GENERIC_FOLLOWRANGE` | AI follow/detection range |
| `eAttributeId_GENERIC_KNOCKBACKRESISTANCE` | Resistance to knockback |
| `eAttributeId_GENERIC_MOVEMENTSPEED` | Base movement speed |
| `eAttributeId_GENERIC_ATTACKDAMAGE` | Base attack damage |
| `eAttributeId_HORSE_JUMPSTRENGTH` | Horse jump power |
| `eAttributeId_ZOMBIE_SPAWNREINFORCEMENTS` | Zombie reinforcement chance |

## Attribute modifiers

`AttributeModifier` represents a named adjustment applied to an attribute instance. Each modifier has:

- **`eMODIFIER_ID id`**, an enum-based identity (replaces Java Edition UUIDs)
- **`double amount`**, the modification amount
- **`int operation`**, how the amount is applied (see below)
- **`bool serialize`**, whether the modifier is written to save data

### Operations

| Constant | Value | Calculation |
|---|---|---|
| `OPERATION_ADDITION` | 0 | Adds `amount` to the base value |
| `OPERATION_MULTIPLY_BASE` | 1 | Multiplies the base value by `(1 + amount)` |
| `OPERATION_MULTIPLY_TOTAL` | 2 | Multiplies the final value by `(1 + amount)` |

Operations are applied in order: all additions first, then base multiplications, then total multiplications.

### Modifier IDs

The `eMODIFIER_ID` enum is also serialized, so the ordering is stable:

| ID | Source |
|---|---|
| `eModifierId_ANONYMOUS` | Modifiers with no fixed identity (multiple allowed per attribute) |
| `eModifierId_ITEM_BASEDAMAGE` | Weapon/item base damage |
| `eModifierId_MOB_FLEEING` | Fleeing speed bonus |
| `eModifierId_MOB_SPRINTING` | Sprint speed bonus |
| `eModifierId_MOB_ENDERMAN_ATTACKSPEED` | Enderman attack speed |
| `eModifierId_MOB_PIG_ATTACKSPEED` | Pig attack speed |
| `eModifierId_MOB_WITCH_DRINKSPEED` | Witch potion drinking speed |
| `eModifierId_MOB_ZOMBIE_BABYSPEED` | Baby zombie speed bonus |
| `eModifierId_POTION_DAMAGEBOOST` | Strength potion effect |
| `eModifierId_POTION_HEALTHBOOST` | Health boost potion effect |
| `eModifierId_POTION_MOVESPEED` | Speed potion effect |
| `eModifierId_POTION_MOVESLOWDOWN` | Slowness potion effect |
| `eModifierId_POTION_WEAKNESS` | Weakness potion effect |

Anonymous modifiers are special: you can have multiple modifiers with `eModifierId_ANONYMOUS` on a single attribute instance, and they can't be removed by ID.

### Hover text

`AttributeModifier::getHoverText(eATTRIBUTE_ID)` generates colored HTML text for item tooltips. Positive modifiers show up in color `9` (blue), negative ones in color `c` (red). Multiply operations show percentages, while addition shows flat values.

## Attribute instances

### AttributeInstance (abstract)

The interface for a live attribute value on an entity. Provides `getBaseValue`, `setBaseValue`, `getValue` (computed with modifiers), and modifier management (`addModifier`, `removeModifier`, `getModifiers`).

### ModifiableAttributeInstance

The concrete implementation. It stores:

- A pointer to the owning `BaseAttributeMap`
- The `Attribute` definition
- Three modifier sets (one per operation type) plus an ID-to-modifier lookup map
- A cached computed value with a dirty flag

When modifiers change, the instance gets marked dirty and the next `getValue()` call triggers `calculateValue()`, which applies all three operation types in sequence.

## BaseAttributeMap

Manages an entity's full set of attribute instances. Stores instances in an `unordered_map<eATTRIBUTE_ID, AttributeInstance*>`.

Key methods:

- `getInstance(eATTRIBUTE_ID)` looks up an attribute instance by ID
- `registerAttribute(Attribute*)` creates and stores a new instance (pure virtual, implemented by subclasses)
- `getAttributes(vector<AttributeInstance*>&)` retrieves all instances
- `removeItemModifiers(shared_ptr<ItemInstance>)` / `addItemModifiers(shared_ptr<ItemInstance>)` batch add/remove modifiers from an equipped item

## SharedMonsterAttributes

A static utility class that defines the five standard monster attributes:

- `MAX_HEALTH`
- `FOLLOW_RANGE`
- `KNOCKBACK_RESISTANCE`
- `MOVEMENT_SPEED`
- `ATTACK_DAMAGE`

It also provides NBT serialization:

- `saveAttributes(BaseAttributeMap*)` writes all attribute instances to a `ListTag<CompoundTag>`
- `loadAttributes(BaseAttributeMap*, ListTag<CompoundTag>*)` reads attribute data back
- `loadAttributeModifier(CompoundTag*)` deserializes a single modifier

## Combat tracking

### CombatTracker

Tracks damage taken by a `LivingEntity` over time. Key state:

- `entries`, a list of `CombatEntry` records
- `inCombat` / `takingDamage`, status flags
- `nextLocation`, an enum for fall context (`GENERIC`, `LADDER`, `VINES`, `WATER`)

Timing constants (in ticks):

- `RESET_DAMAGE_STATUS_TIME` = 5 seconds
- `RESET_COMBAT_STATUS_TIME` = 15 seconds

Key methods:

- `prepareForDamage()` captures the current location context before damage is applied
- `recordDamage(DamageSource*, float health, float damage)` logs a new combat entry
- `getDeathMessagePacket()` builds a `ChatPacket` describing the cause of death (4J changed this from returning a plain string)
- `getKiller()` returns the entity responsible for the kill
- `getMostSignificantFall()` finds the fall entry that contributed the most to death

### CombatEntry

A single record of damage taken:

- `source`, the `DamageSource`
- `time`, the tick when damage occurred
- `health` / `damage`, health before hit and amount of damage
- `location`, fall context enum
- `fallDistance`, distance fallen

Has `isCombatRelated()` to filter for actual combat hits, and `getAttackerName()` for death messages.
