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

There's also a `MAX_NAME_LENGTH` constant set to `64`.

The class stores a static `AttributeNames[]` array that maps attribute IDs to their localized display name resource IDs.

### BaseAttribute

The concrete implementation that stores the attribute's ID, default value, and syncable flag.

- Constructor takes `(eATTRIBUTE_ID id, double defaultValue)` and is `protected`, so only subclasses use it
- `setSyncable(bool)` marks an attribute for client synchronization, returns `this` for chaining
- By default, attributes are **not** synced to the client

### RangedAttribute

Extends `BaseAttribute` with `minValue` and `maxValue` bounds. The `sanitizeValue` method clamps values to `[minValue, maxValue]`. Constructor takes `(id, defaultValue, minValue, maxValue)`.

4J removed the legacy name import system (`importLegacyName`/`getImportLegacyName`) that was in Java Edition since they don't use string-based attribute names.

## Attribute IDs

The `eATTRIBUTE_ID` enum gets serialized into save data, so the values must never be reordered. New attributes are always appended after the existing entries. A trailing `eAttributeId_COUNT` value tracks the total number of attributes.

| Enum constant | Purpose | Default | Range |
|---|---|---|---|
| `eAttributeId_GENERIC_MAXHEALTH` | Maximum health points | Varies by mob | Varies |
| `eAttributeId_GENERIC_FOLLOWRANGE` | AI follow/detection range | Varies by mob | Varies |
| `eAttributeId_GENERIC_KNOCKBACKRESISTANCE` | Resistance to knockback | Varies by mob | 0.0 to 1.0 |
| `eAttributeId_GENERIC_MOVEMENTSPEED` | Base movement speed | Varies by mob | Varies |
| `eAttributeId_GENERIC_ATTACKDAMAGE` | Base attack damage | Varies by mob | Varies |
| `eAttributeId_HORSE_JUMPSTRENGTH` | Horse jump power | 0.7 | 0.0 to 2.0 |
| `eAttributeId_ZOMBIE_SPAWNREINFORCEMENTS` | Zombie reinforcement chance | Varies | 0.0 to 1.0 |

The first five are shared monster attributes (registered on all living entities). The last two are entity-specific. The horse jump strength is a `RangedAttribute` with client sync enabled.

A comment in the source marks the boundary between 1.6.4 attributes and where future 1.8+ attributes would go.

### Platform-specific hashing

On Orbis (PlayStation), the `attrAttrModMap` typedef uses `std::hash<int>` explicitly because the platform's standard library doesn't provide a default hash for the enum type. Other platforms rely on the implicit enum-to-int conversion.

## Attribute modifiers

`AttributeModifier` represents a named adjustment applied to an attribute instance. Each modifier has:

- **`eMODIFIER_ID id`**, an enum-based identity (replaces Java Edition UUIDs)
- **`double amount`**, the modification amount
- **`int operation`**, how the amount is applied (see below)
- **`bool serialize`**, whether the modifier is written to save data
- **`wstring name`**, a display name (used for hover text in tooltips)

Two constructors exist:

- `AttributeModifier(double amount, int operation)` creates an anonymous modifier
- `AttributeModifier(eMODIFIER_ID id, double amount, int operation)` creates a named modifier

The private `_init()` method sets defaults for all fields.

### Operations

| Constant | Value | Calculation |
|---|---|---|
| `OPERATION_ADDITION` | 0 | Adds `amount` to the base value |
| `OPERATION_MULTIPLY_BASE` | 1 | Multiplies the base value by `(1 + amount)` |
| `OPERATION_MULTIPLY_TOTAL` | 2 | Multiplies the final value by `(1 + amount)` |

The constant `TOTAL_OPERATIONS = 3` tracks the count. Operations are applied in order: all additions first, then base multiplications, then total multiplications.

### Modifier IDs

The `eMODIFIER_ID` enum is also serialized, so the ordering is stable. A trailing `eModifierId_COUNT` tracks the total.

| ID | Source | Typical attribute |
|---|---|---|
| `eModifierId_ANONYMOUS` | Modifiers with no fixed identity (multiple allowed per attribute) | Any |
| `eModifierId_ITEM_BASEDAMAGE` | Weapon/item base damage | Attack damage |
| `eModifierId_MOB_FLEEING` | Fleeing speed bonus | Movement speed |
| `eModifierId_MOB_SPRINTING` | Sprint speed bonus | Movement speed |
| `eModifierId_MOB_ENDERMAN_ATTACKSPEED` | Enderman attack speed | Movement speed |
| `eModifierId_MOB_PIG_ATTACKSPEED` | Pig attack speed | Movement speed |
| `eModifierId_MOB_WITCH_DRINKSPEED` | Witch potion drinking speed | Movement speed |
| `eModifierId_MOB_ZOMBIE_BABYSPEED` | Baby zombie speed bonus | Movement speed |
| `eModifierId_POTION_DAMAGEBOOST` | Strength potion effect | Attack damage |
| `eModifierId_POTION_HEALTHBOOST` | Health boost potion effect | Max health |
| `eModifierId_POTION_MOVESPEED` | Speed potion effect | Movement speed |
| `eModifierId_POTION_MOVESLOWDOWN` | Slowness potion effect | Movement speed |
| `eModifierId_POTION_WEAKNESS` | Weakness potion effect | Attack damage |

Anonymous modifiers are special: you can have multiple modifiers with `eModifierId_ANONYMOUS` on a single attribute instance, and they can't be removed by ID. This is noted in a detailed comment in the source explaining the difference from Java Edition's UUID-based system.

### Hover text

`AttributeModifier::getHoverText(eATTRIBUTE_ID)` generates colored HTML text for item tooltips. It takes the target attribute ID to look up the attribute name. Positive modifiers show up in color `9` (blue), negative ones in color `c` (red). Multiply operations show percentages, while addition shows flat values. The return type is `HtmlString`, a MinecraftConsoles-specific type for formatted UI text.

### Comparison and serialization

- `equals(AttributeModifier*)` compares modifiers by ID, amount, operation, and name
- `isSerializable()` checks the `serialize` flag
- `setSerialize(bool)` controls whether the modifier persists to save data, returns `this` for chaining
- `toString()` generates a debug string representation

## Attribute instances

### AttributeInstance (abstract)

The interface for a live attribute value on an entity. Provides:

- `getBaseValue` / `setBaseValue` for the raw unmodified value
- `getValue` computes the final value with all modifiers applied
- `getModifiers(int operation)` returns the modifier set for a specific operation type
- `getModifiers(unordered_set&)` fills a set with all modifiers across all operations
- `getModifier(eMODIFIER_ID)` looks up a specific modifier by ID
- `addModifiers(unordered_set*)` / `addModifier(AttributeModifier*)` for adding
- `removeModifier(AttributeModifier*)` / `removeModifier(eMODIFIER_ID)` / `removeModifiers()` for removing

### ModifiableAttributeInstance

The concrete implementation. It stores:

- A pointer to the owning `BaseAttributeMap`
- The `Attribute` definition
- Three modifier sets (one per operation type) as `unordered_set<AttributeModifier*>[TOTAL_OPERATIONS]`
- An ID-to-modifier lookup map as `unordered_map<unsigned int, AttributeModifier*>`
- A cached computed value with a `dirty` flag

When modifiers change, the instance gets marked dirty via `setDirty()` and the next `getValue()` call triggers `calculateValue()`, which applies all three operation types in sequence:

1. Start with the base value
2. Add all `OPERATION_ADDITION` amounts
3. Multiply the running total by `(1 + sum of OPERATION_MULTIPLY_BASE amounts)`
4. Multiply the running total by each `(1 + OPERATION_MULTIPLY_TOTAL amount)` individually

The destructor cleans up all owned modifier objects.

## BaseAttributeMap

Manages an entity's full set of attribute instances. Stores instances in an `unordered_map<eATTRIBUTE_ID, AttributeInstance*>` (with platform-specific `std::hash<int>` on Orbis).

Key methods:

- `getInstance(Attribute*)` / `getInstance(eATTRIBUTE_ID)` looks up an attribute instance
- `registerAttribute(Attribute*)` creates and stores a new instance (pure virtual, implemented by subclasses)
- `getAttributes(vector<AttributeInstance*>&)` retrieves all instances
- `removeItemModifiers(shared_ptr<ItemInstance>)` / `addItemModifiers(shared_ptr<ItemInstance>)` batch add/remove modifiers from an equipped item
- `onAttributeModified(ModifiableAttributeInstance*)` callback when an attribute changes

4J changed the item modifier functions into specialized methods instead of the more generic approach in Java Edition.

## SharedMonsterAttributes

A static utility class that defines the five standard monster attributes:

- `MAX_HEALTH`
- `FOLLOW_RANGE`
- `KNOCKBACK_RESISTANCE`
- `MOVEMENT_SPEED`
- `ATTACK_DAMAGE`

These are static `Attribute*` pointers, typically `RangedAttribute` instances created during initialization.

### NBT serialization

- `saveAttributes(BaseAttributeMap*)` writes all attribute instances to a `ListTag<CompoundTag>`
- `saveAttribute(AttributeInstance*)` serializes a single attribute (private)
- `saveAttributeModifier(AttributeModifier*)` serializes a single modifier (private)
- `loadAttributes(BaseAttributeMap*, ListTag<CompoundTag>*)` reads attribute data back
- `loadAttribute(AttributeInstance*, CompoundTag*)` deserializes a single attribute (private)
- `loadAttributeModifier(CompoundTag*)` deserializes a single modifier (public, used by other systems)

## How mobs use attributes

Every `LivingEntity` creates a `BaseAttributeMap` during construction and registers the shared monster attributes via `registerAttributes()`. Specific mob types override `registerAttributes()` to set custom default values:

- **Horses** register `JUMP_STRENGTH` and `ZOMBIE_SPAWNREINFORCEMENTS` on top of the standard five
- **Witches** add a `SPEED_MODIFIER_DRINKING` modifier for potion-drinking animation slowdown
- **Bats** set custom max health and movement speed defaults
- **Wither Boss** sets high max health, follow range, and movement speed

When a mob equips or unequips an item (weapon, armor), the attribute map's `addItemModifiers` / `removeItemModifiers` methods apply or remove the item's modifiers in bulk.

## Combat tracking

### CombatTracker

Tracks damage taken by a `LivingEntity` over time. Key state:

- `entries`, a list of `CombatEntry*` records
- `mob`, pointer to the owning entity
- `lastDamageTime`, tick of the most recent hit
- `inCombat` / `takingDamage`, status flags
- `nextLocation`, an enum for fall context

The location enum (replacing a Java string):

| Constant | Value | Meaning |
|---|---|---|
| `eLocation_GENERIC` | 0 | Default / no special location |
| `eLocation_LADDER` | 1 | On a ladder |
| `eLocation_VINES` | 2 | On vines |
| `eLocation_WATER` | 3 | In water |

Timing constants (in ticks):

- `RESET_DAMAGE_STATUS_TIME` = `TICKS_PER_SECOND * 5` (100 ticks / 5 seconds)
- `RESET_COMBAT_STATUS_TIME` = `TICKS_PER_SECOND * 15` (300 ticks / 15 seconds)

Key methods:

- `prepareForDamage()` captures the current location context before damage is applied
- `recordDamage(DamageSource*, float health, float damage)` logs a new combat entry
- `getDeathMessagePacket()` builds a `ChatPacket` describing the cause of death (4J changed this from returning a plain string to returning a full packet)
- `getKiller()` returns the `LivingEntity` responsible for the kill as a shared pointer
- `getMostSignificantFall()` finds the fall entry that contributed the most to death (private)
- `getFallLocation(CombatEntry*)` maps a combat entry to its fall location enum (private)
- `isTakingDamage()` / `isInCombat()` return the current status flags
- `resetPreparedStatus()` / `recheckStatus()` handle timeout-based state transitions (private)

### CombatEntry

A single record of damage taken:

- `source`, the `DamageSource*`
- `time`, the tick when damage occurred
- `health`, health before the hit
- `damage`, amount of damage dealt
- `location`, fall context enum
- `fallDistance`, distance fallen

Methods:

- `getSource()` / `getTime()` / `getDamage()` / `getHealthBeforeDamage()` / `getHealthAfterDamage()` for field access
- `isCombatRelated()` filters for actual combat hits (vs. environmental damage)
- `getAttackerName()` for death messages
- `getLocation()` returns the fall context enum
- `getFallDistance()` returns the stored fall distance

## Differences from LCEMP

LCEMP does not have the attribute system at all. There's no `Attribute`, `AttributeModifier`, `BaseAttributeMap`, `SharedMonsterAttributes`, `CombatTracker`, or `CombatEntry` in the LCEMP codebase. Mob stats in LCEMP are handled with simpler direct values rather than the modifier-based system.
