---
title: Entities
description: Complete documentation of the LCE entity system.
---

The LCE entity system covers every dynamic object in the world: players, mobs, items, projectiles, vehicles, and special objects like lightning bolts and experience orbs. Each entity lives in its own header and source file under `Minecraft.World/`.

## Class Hierarchy

The entity class hierarchy branches out from the root `Entity` class, with `Mob` being the main branch for living creatures.

```
Entity (abstract)
├── Mob (living entities)
│   ├── PathfinderMob (AI-driven navigation)
│   │   ├── AgableMob (can age / breed)
│   │   │   ├── Animal (+ Creature interface)
│   │   │   │   ├── Cow
│   │   │   │   │   └── MushroomCow
│   │   │   │   ├── Pig
│   │   │   │   ├── Sheep
│   │   │   │   ├── Chicken
│   │   │   │   └── TamableAnimal
│   │   │   │       ├── Wolf
│   │   │   │       └── Ozelot
│   │   │   └── Villager (+ Npc, Merchant interfaces)
│   │   ├── Monster (+ Enemy interface)
│   │   │   ├── Zombie
│   │   │   │   └── PigZombie
│   │   │   ├── Skeleton
│   │   │   ├── Creeper
│   │   │   ├── Spider
│   │   │   │   └── CaveSpider
│   │   │   ├── EnderMan
│   │   │   ├── Silverfish
│   │   │   ├── Blaze
│   │   │   └── Giant
│   │   ├── WaterAnimal (+ Creature interface)
│   │   │   └── Squid
│   │   └── Golem (+ Creature interface)
│   │       ├── VillagerGolem (Iron Golem)
│   │       └── SnowMan (Snow Golem)
│   ├── Slime (+ Enemy interface)
│   │   └── LavaSlime (Magma Cube)
│   ├── FlyingMob
│   │   └── Ghast (+ Enemy interface)
│   ├── BossMob
│   │   └── EnderDragon
│   └── Player (+ CommandSender interface)
├── ItemEntity (dropped items)
├── ExperienceOrb
├── HangingEntity (abstract)
│   ├── Painting
│   └── ItemFrame
├── GlobalEntity
│   └── LightningBolt
├── PrimedTnt
├── FallingTile (falling sand/gravel)
├── Minecart
├── Boat
├── EnderCrystal
└── Projectiles (Arrow, Fireball, SmallFireball, Snowball,
    ThrownEnderpearl, EyeOfEnderSignal, ThrownPotion,
    ThrownExpBottle, DragonFireball)
```

### Base Class Responsibilities

Each base class adds a layer of functionality:

| Base Class | What It Adds |
|-----------|-------------|
| `Entity` | Position, motion, rotation, bounding box, fire, water, air supply, synched data, save/load, collision, riding |
| `Mob` | Health, death, AI (GoalSelector), effects, equipment, look/move/jump controls, pathfinding, sensing, knockback, sounds |
| `PathfinderMob` | A* navigation with configurable range (default 16 blocks), attack target tracking, walk target scoring, wander support |
| `AgableMob` | Baby/adult system with an age timer, `getBreedOffspring()` for producing babies |
| `Animal` | Love mode, breeding, food items, despawn protection, grass-block spawn checks |
| `TamableAnimal` | Owner tracking, tame/sit flags, `getOwner()`, sitting state via synched data |
| `Monster` | Hostile behavior, burns in daylight, dark spawn checks via `isDarkEnoughToSpawn()`, attack damage, difficulty scaling |
| `FlyingMob` | No gravity, flying movement physics, no fall damage |
| `BossMob` | Boss bar, special death handling |

### Marker Interfaces

A few empty or near-empty classes act as markers for classification:

| Interface | File | Purpose |
|-----------|------|---------|
| `Creature` | `Creature.h` | Marks non-hostile living entities |
| `Enemy` | `Enemy.h` | Marks hostile entities; defines XP reward constants |
| `Npc` | `Npc.h` | Marks NPC entities (extends `Creature`) |
| `CommandSender` | `CommandSender.h` | Allows sending commands (used by `Player`) |
| `Merchant` | `Merchant.h` | Trading interface (implemented by `Villager`) |

## Entity Type Enum (`eINSTANCEOF`)

Defined in `Class.h`, the `eINSTANCEOF` enum replaces Java's `instanceof` with a bitfield-based type system. 4J Studios added this to skip dynamic casts on console hardware. Every entity class overrides `virtual eINSTANCEOF GetType()` to return its type constant.

The values are set up as a bitfield so a single bitwise AND can check category membership:

| Bit / Mask | Category | Purpose |
|-----------|----------|---------|
| `0x100` | `eTYPE_WATERANIMAL` | Water creatures |
| `0x200` | `eTYPE_ANIMAL` | Land animals |
| `0x400` | `eTYPE_MONSTER` | Hostile monsters |
| `0x800` | `eTYPE_ENEMY` | Enemy marker |
| `0x1000` | `eTYPE_VILLAGERGOLEM` | Iron Golem (not a shared category bit; `SnowMan` uses animal bits instead) |
| `0x2000` | `eTYPE_AGABLE_MOB` | Ageable/breedable mobs |
| `0x8000` | `eTYPE_PLAYER` | Players |
| `0x40000` | `eTYPE_PROJECTILE` | Projectiles |
| `0x80000` | `eTYPE_ANIMALS_SPAWN_LIMIT_CHECK` | Animals counted for spawn limits |
| `0x100000` | `eTYPE_OTHERS` | Misc entities (no category bits) |

Specific mob types combine these category bits. For example, `eTYPE_COW = 0x82201` has the `ANIMALS_SPAWN_LIMIT_CHECK`, `AGABLE_MOB`, and `ANIMAL` bits set, while `eTYPE_CHICKEN = 0x2206` doesn't have the `ANIMALS_SPAWN_LIMIT_CHECK` bit because chickens have a separate spawn cap.

### How Type Checks Work

Because the types are bitfields, you can check category membership with a simple AND:

```cpp
// Check if an entity is any kind of monster
if ((entity->GetType() & eTYPE_MONSTER) == eTYPE_MONSTER) { ... }

// Check if it's a specific type
if (entity->GetType() == eTYPE_ZOMBIE) { ... }

// MeleeAttackGoal uses this to filter targets
if (attackType != eTYPE_NOTSET && (attackType & bestTarget->GetType()) != attackType)
    return false;
```

This is way faster than `dynamic_cast` on console hardware, which is the whole reason 4J added it.

### Complete Entity Type ID Table

Registered in `EntityIO::staticCtor()`, each entity has a string ID and a numeric ID for network serialization:

| Numeric ID | String ID | `eINSTANCEOF` | Class |
|-----------|-----------|---------------|-------|
| 1 | `Item` | `eTYPE_ITEMENTITY` | `ItemEntity` |
| 2 | `XPOrb` | `eTYPE_EXPERIENCEORB` | `ExperienceOrb` |
| 9 | `Painting` | `eTYPE_PAINTING` | `Painting` |
| 10 | `Arrow` | `eTYPE_ARROW` | `Arrow` |
| 11 | `Snowball` | `eTYPE_SNOWBALL` | `Snowball` |
| 12 | `Fireball` | `eTYPE_FIREBALL` | `Fireball` |
| 13 | `SmallFireball` | `eTYPE_SMALL_FIREBALL` | `SmallFireball` |
| 14 | `ThrownEnderpearl` | `eTYPE_THROWNENDERPEARL` | `ThrownEnderpearl` |
| 15 | `EyeOfEnderSignal` | `eTYPE_EYEOFENDERSIGNAL` | `EyeOfEnderSignal` |
| 16 | `ThrownPotion` | `eTYPE_THROWNPOTION` | `ThrownPotion` |
| 17 | `ThrownExpBottle` | `eTYPE_THROWNEXPBOTTLE` | `ThrownExpBottle` |
| 18 | `ItemFrame` | `eTYPE_ITEM_FRAME` | `ItemFrame` |
| 20 | `PrimedTnt` | `eTYPE_PRIMEDTNT` | `PrimedTnt` |
| 21 | `FallingSand` | `eTYPE_FALLINGTILE` | `FallingTile` |
| 40 | `Minecart` | `eTYPE_MINECART` | `Minecart` |
| 41 | `Boat` | `eTYPE_BOAT` | `Boat` |
| 48 | `Mob` | `eTYPE_MOB` | `Mob` |
| 49 | `Monster` | `eTYPE_MONSTER` | `Monster` |
| 50 | `Creeper` | `eTYPE_CREEPER` | `Creeper` |
| 51 | `Skeleton` | `eTYPE_SKELETON` | `Skeleton` |
| 52 | `Spider` | `eTYPE_SPIDER` | `Spider` |
| 53 | `Giant` | `eTYPE_GIANT` | `Giant` |
| 54 | `Zombie` | `eTYPE_ZOMBIE` | `Zombie` |
| 55 | `Slime` | `eTYPE_SLIME` | `Slime` |
| 56 | `Ghast` | `eTYPE_GHAST` | `Ghast` |
| 57 | `PigZombie` | `eTYPE_PIGZOMBIE` | `PigZombie` |
| 58 | `Enderman` | `eTYPE_ENDERMAN` | `EnderMan` |
| 59 | `CaveSpider` | `eTYPE_CAVESPIDER` | `CaveSpider` |
| 60 | `Silverfish` | `eTYPE_SILVERFISH` | `Silverfish` |
| 61 | `Blaze` | `eTYPE_BLAZE` | `Blaze` |
| 62 | `LavaSlime` | `eTYPE_LAVASLIME` | `LavaSlime` |
| 63 | `EnderDragon` | `eTYPE_ENDERDRAGON` | `EnderDragon` |
| 90 | `Pig` | `eTYPE_PIG` | `Pig` |
| 91 | `Sheep` | `eTYPE_SHEEP` | `Sheep` |
| 92 | `Cow` | `eTYPE_COW` | `Cow` |
| 93 | `Chicken` | `eTYPE_CHICKEN` | `Chicken` |
| 94 | `Squid` | `eTYPE_SQUID` | `Squid` |
| 95 | `Wolf` | `eTYPE_WOLF` | `Wolf` |
| 96 | `MushroomCow` | `eTYPE_MUSHROOMCOW` | `MushroomCow` |
| 97 | `SnowMan` | `eTYPE_SNOWMAN` | `SnowMan` |
| 98 | `Ozelot` | `eTYPE_OZELOT` | `Ozelot` |
| 99 | `VillagerGolem` | `eTYPE_VILLAGERGOLEM` | `VillagerGolem` |
| 120 | `Villager` | `eTYPE_VILLAGER` | `Villager` |
| 200 | `EnderCrystal` | `eTYPE_ENDER_CRYSTAL` | `EnderCrystal` |
| 1000 | `DragonFireball` | `eTYPE_DRAGON_FIREBALL` | `DragonFireball` |

Entities with spawn egg colors are registered through the overloaded `setId()` that takes `eMinecraftColour` parameters and a name ID, populating `EntityIO::idsSpawnableInCreative`.

## Entity Registry (`EntityIO`)

`EntityIO` (`EntityIO.h` / `EntityIO.cpp`) is the entity factory and registry. It keeps several parallel lookup maps:

| Map | Key | Value | Purpose |
|-----|-----|-------|---------|
| `idCreateMap` | `wstring` (string ID) | `entityCreateFn` | Create entity by string ID |
| `numCreateMap` | `int` (numeric ID) | `entityCreateFn` | Create entity by numeric ID |
| `classIdMap` | `eINSTANCEOF` | `wstring` | Get string ID from type enum |
| `classNumMap` | `eINSTANCEOF` | `int` | Get numeric ID from type enum |
| `numClassMap` | `int` | `eINSTANCEOF` | Get type enum from numeric ID |
| `idNumMap` | `wstring` | `int` | Get numeric ID from string ID |

Each entity class has a static `create(Level *level)` factory function stored as a function pointer (`entityCreateFn`). The key creation methods are:

- **`newEntity(wstring id, Level*)`**: Create by string ID (used when loading from NBT)
- **`loadStatic(CompoundTag*, Level*)`**: Load from NBT tag (reads the `"id"` string, creates the entity, then calls `entity->load()`)
- **`newById(int id, Level*)`**: Create by numeric ID (used in network packets)
- **`newByEnumType(eINSTANCEOF, Level*)`**: Create by type enum (used by the mob spawner)

If `getId()` can't find a string ID, it defaults to numeric ID `90` (Pig). This is a fun little fallback. If your entity type isn't registered properly, it just becomes a pig.

## Synched Entity Data

`SynchedEntityData` (`SynchedEntityData.h`) is the system that syncs entity state from server to client using a compact binary protocol.

### Data Types

| Type Constant | Value | C++ Type |
|---------------|-------|----------|
| `TYPE_BYTE` | 0 | `byte` |
| `TYPE_SHORT` | 1 | `short` |
| `TYPE_INT` | 2 | `int` |
| `TYPE_FLOAT` | 3 | `float` |
| `TYPE_STRING` | 4 | `wstring` |
| `TYPE_ITEMINSTANCE` | 5 | `shared_ptr<ItemInstance>` |
| `TYPE_POS` | 6 | `Pos*` |

### Wire Format

Each data entry is keyed by an ID. The ID and type are packed into a single byte:

- **Bits 0-4**: Data item ID (max value `MAX_ID_VALUE = ~TYPE_MASK & 0xFF = 31`)
- **Bits 5-7**: Data type (0-6)
- **EOF marker**: `0x7F`
- **Max string length**: 64 characters

### DataItem Internals

Each `DataItem` stores its value as separate typed fields rather than a generic `Object` like Java. The 4J port just keeps `value_byte`, `value_int`, `value_short`, `value_wstring`, and `value_itemInstance` as separate members. This avoids any boxing/unboxing overhead on console hardware.

The `SynchedEntityData` class itself stores items in an `unordered_map<int, shared_ptr<DataItem>>` keyed by data ID. It provides typed getters: `getByte()`, `getShort()`, `getInteger()`, `getFloat()`, `getString()`, `getItemInstance()`, and `getPos()`.

### How Entities Register Data

Each entity calls `defineSynchedData()` (a pure virtual in `Entity`) to register its synched fields. The base `Entity` defines:

| ID | Type | Field |
|----|------|-------|
| 0 | byte | `DATA_SHARED_FLAGS_ID`, a bitfield of shared flags |
| 1 | short | `DATA_AIR_SUPPLY_ID`, air supply |

`Mob` adds:

| ID | Type | Field |
|----|------|-------|
| 8 | int | `DATA_EFFECT_COLOR_ID`, potion effect color |

`AgableMob` adds:

| ID | Type | Field |
|----|------|-------|
| 12 | int | `DATA_AGE_ID`, entity age |

`Animal` adds:

| ID | Type | Field |
|----|------|-------|
| 13 | int | `DATA_IN_LOVE`, love/breeding state |

Specific mobs define additional IDs starting from 16:

| Mob | ID(s) | Fields |
|-----|--------|--------|
| `Creeper` | 16, 17 | Swell direction, is powered |
| `Spider` | 16 | Climbing flags |
| `Zombie` | 12, 13, 14 | Baby, villager, converting |
| `EnderMan` | 16, 17, 18 | Carry item ID, carry data, creepy state |
| `Ghast` | 16 | Is charging |
| `Blaze` | 16 | Flags (charged state) |
| `Pig` | 16 | Has saddle |
| `Sheep` | 16 | Wool color and sheared state |
| `Wolf` | 18, 19, 20 | Health, interested, collar color |
| `TamableAnimal` | 16, 17 | Flags (tame/sitting), owner UUID |
| `Villager` | 16 | Profession ID |
| `VillagerGolem` | 16 | Flags (player-created) |
| `Slime` | 16 | Size |
| `EnderDragon` | 16, 17 | Synched health, synched action |
| `Player` | 16, 17 | Player flags, running state |
| `Minecart` | 16, 17, 18, 19 | Fuel, hurt, hurt direction, damage |
| `Boat` | 17, 18, 19 | Hurt, hurt direction, damage |
| `ItemEntity` | 10 | The item stack |

### Shared Entity Flags (ID 0)

The base `Entity` class uses a single byte at ID 0 as a bitfield:

| Bit | Constant | Meaning |
|-----|----------|---------|
| 0 | `FLAG_ONFIRE` | Entity is on fire |
| 1 | `FLAG_SNEAKING` | Entity is sneaking |
| 2 | `FLAG_RIDING` | Entity is riding another |
| 3 | `FLAG_SPRINTING` | Entity is sprinting |
| 4 | `FLAG_USING_ITEM` | Entity is using an item |
| 5 | `FLAG_INVISIBLE` | Entity is invisible |
| 6 | `FLAG_IDLEANIM` | Idle animation state |
| 7 | `FLAG_EFFECT_WEAKENED` | Weakened by potion (4J addition for the cure villager tooltip) |

These flags are read/written through `getSharedFlag(bit)` and `setSharedFlag(bit, value)`. Both are protected methods, so only Entity and its friends (like `Gui`) can use them directly. Public accessors like `isSneaking()`, `isSprinting()`, `isInvisible()` wrap these.

### Dirty Tracking

Each `DataItem` has a `dirty` flag. When a value changes through `set()`, the item gets marked dirty. `packDirty()` returns only the changed items for delta updates. `packAll()` serializes everything (used on initial sync). The `SetEntityDataPacket` carries these updates over the network.

The `SynchedEntityData` class also tracks a global `m_isDirty` flag so the server can quickly check if any data changed without scanning every item.

## Collision System

### Bounding Boxes

Every entity has an axis-aligned bounding box (`AABB *bb`) that defines its collision volume. The `setSize(float w, float h)` method sets `bbWidth` and `bbHeight`, then rebuilds the AABB around the entity's current position.

Two key virtual methods control entity-to-entity collision:

- **`getCollideBox()`**: Returns the AABB that other entities collide with when moving. Most entities return `nullptr` (no collision). `Boat` and `Minecart` override this to return their AABB so players can ride into them.
- **`getCollideAgainstBox(Entity)`**: Returns the AABB used when checking if two entities are overlapping for push physics. `Boat` and `Minecart` return their AABB here too.

### Entity Movement

`Entity::move(xa, ya, za)` is the core movement method. It does:

1. Check if stuck in a web (cuts speed to 5% if so)
2. Get all tile collision boxes from the level in the movement path
3. Resolve Y axis first, then X, then Z against those boxes
4. Also check entity collision boxes (`getCollideAgainstBox`)
5. Update the AABB to the new position
6. Set `onGround`, `horizontalCollision`, `verticalCollision` flags
7. Play step sounds, check fall damage, check inside tiles (portals, tripwires, etc.)
8. Apply friction and web stuck slowdown

The `noEntityCubes` parameter (a 4J addition) lets the movement skip entity collision boxes for performance in certain situations.

### Push Physics

When entities overlap, `Entity::push(Entity)` applies separation forces. The force is based on the overlap distance. `isPushable()` controls whether an entity can be pushed at all. Mobs are pushable, dropped items are not.

## Damage System

### DamageSource

`DamageSource` (`DamageSource.h`) represents what caused the damage. It uses static singleton instances for environmental damage and factory methods for entity-caused damage.

#### Static Damage Sources

| Source | Description | Properties |
|--------|-------------|------------|
| `inFire` | Standing in fire | Fire |
| `onFire` | Burning | Fire, bypasses armor |
| `lava` | In lava | Fire |
| `inWall` | Suffocating in a block | Bypasses armor |
| `drown` | Drowning | Bypasses armor |
| `starve` | Starvation | Bypasses armor |
| `cactus` | Cactus damage | |
| `fall` | Fall damage | Bypasses armor |
| `outOfWorld` | Falling into the void | Bypasses armor, bypasses invulnerability |
| `genericSource` | Generic damage | Bypasses armor |
| `explosion` | Explosion | Scales with difficulty |
| `controlledExplosion` | Player-caused explosion | |
| `magic` | Magic damage | Bypasses armor, magic |
| `dragonbreath` | Dragon breath | Bypasses armor |
| `wither` | Wither effect | Bypasses armor |
| `anvil` | Falling anvil | |
| `fallingBlock` | Falling block | |

#### Factory Methods for Entity Damage

| Method | Returns | Purpose |
|--------|---------|---------|
| `mobAttack(Mob)` | `EntityDamageSource` | Melee mob attack |
| `playerAttack(Player)` | `EntityDamageSource` | Player melee attack |
| `arrow(Arrow, Entity)` | `IndirectEntityDamageSource` | Arrow damage |
| `fireball(Fireball, Entity)` | `IndirectEntityDamageSource` | Fireball damage |
| `thrown(Entity, Entity)` | `IndirectEntityDamageSource` | Thrown projectile damage |
| `indirectMagic(Entity, Entity)` | `IndirectEntityDamageSource` | Indirect magic damage |
| `thorns(Entity)` | `EntityDamageSource` | Thorns enchantment damage |

#### DamageSource Properties

| Property | Method | Effect |
|----------|--------|--------|
| `_bypassArmor` | `isBypassArmor()` | Damage ignores armor |
| `_bypassInvul` | `isBypassInvul()` | Damage ignores invulnerability frames |
| `isFireSource` | `isFire()` | Source is fire-based |
| `_isProjectile` | `isProjectile()` | Source is a projectile |
| `_scalesWithDifficulty` | `scalesWithDifficulty()` | Damage scales with difficulty |
| `_isMagic` | `isMagic()` | Magic damage |
| `exhaustion` | `getFoodExhaustion()` | Food exhaustion caused (default `EXHAUSTION_ATTACK`, set to 0 when `bypassArmor` is called) |

#### DamageSource Class Hierarchy

```
DamageSource
└── EntityDamageSource (damage from an entity)
    └── IndirectEntityDamageSource (damage from a projectile with an owner)
```

`EntityDamageSource` stores a `shared_ptr<Entity>` to the attacker. `getEntity()` returns it. `scalesWithDifficulty()` returns `true` for mob attacks but `false` for player attacks.

`IndirectEntityDamageSource` stores both the direct entity (the projectile) and the owner. `getDirectEntity()` returns the projectile, `getEntity()` returns the owner. This is how kill credit goes to the player who shot an arrow, not the arrow itself.

### Armor Calculation Pipeline

When `Mob::hurt()` is called, the damage goes through several stages:

1. **`hurtArmor(damage)`**: Reduces durability on the mob's armor items.
2. **`getDamageAfterArmorAbsorb(source, damage)`**: Reduces damage based on `getArmorValue()` (0-20 scale). Skipped if `source.isBypassArmor()`.
3. **`getDamageAfterMagicAbsorb(source, damage)`**: Applies enchantment-based damage reduction. Skipped if `source.isBypassArmor()`.
4. **`actuallyHurt(source, damage)`**: Applies the final damage to health.

`Player` overrides `getArmorValue()` to compute armor value from equipped `ArmorItem` pieces and overrides `hurtArmor()` to damage the inventory armor items.

### Entity Damage Telemetry

4J Studios added `EEntityDamageType` for tracking player death stats:

| Enum Value | Cause |
|------------|-------|
| `eEntityDamageType_Entity` | Killed by entity |
| `eEntityDamageType_Fall` | Fall damage |
| `eEntityDamageType_Fire` | Fire |
| `eEntityDamageType_Lava` | Lava |
| `eEntityDamageType_Water` | Drowning |
| `eEntityDamageType_Suffocate` | Suffocation |
| `eEntityDamageType_OutOfWorld` | Void |
| `eEntityDamageType_Cactus` | Cactus |

### MobType Enum

Defined in `MobType.h`, this enum is used by damage enchantments to apply bonus damage:

| Value | Meaning |
|-------|---------|
| `UNDEFINED` | Default |
| `UNDEAD` | Undead mobs (Zombie, Skeleton, PigZombie) |
| `ARTHROPOD` | Arthropods (Spider, CaveSpider, Silverfish) |

Mobs override `getMobType()` to return the right value. For example, `Zombie::getMobType()` returns `UNDEAD`, and `Spider::getMobType()` returns `ARTHROPOD`.

## Entity Lifecycle

### Creation and ID Assignment

Entity IDs are split into two ranges (a 4J console optimization):

- **Small IDs (0-2047)**: For network-tracked entities. Allocated from a bitfield (`entityIdUsedFlags[2048/32]`) on the server thread only. Only needs 11 bits in network packets.
- **Large IDs (2048+)**: For particles and other non-tracked entities. Assigned from an incrementing counter that wraps at `0x7FFFFFF` back to 2048.

Thread-local storage (`TlsGetValue(tlsIdx)`) makes sure small IDs are only allocated from the server thread.

### Entity Constructor Flow

Every entity constructor follows this pattern:

1. Call `Entity(level, useSmallId)` which runs `_init(useSmallId)` to assign an entity ID
2. Call `defineSynchedData()` to register synched fields. This is done in the most-derived constructor because virtual dispatch doesn't work in base constructors in C++.
3. Set `health = getMaxHealth()` after synched data is ready
4. Set up texture, bounding box size, and navigation options
5. Register AI goals (for mobs)

The zombie constructor is a good example:

```cpp
Zombie::Zombie(Level *level) : Monster(level)
{
    this->defineSynchedData();
    health = getMaxHealth();
    this->textureIdx = TN_MOB_ZOMBIE;
    runSpeed = 0.23f;
    attackDamage = 4;
    setSize(bbWidth, bbHeight);
    getNavigation()->setCanOpenDoors(true);

    // AI goals...
    goalSelector.addGoal(0, new FloatGoal(this));
    goalSelector.addGoal(1, new BreakDoorGoal(this));
    // ... etc
}
```

### Tick

The core update loop:

1. **`Entity::tick()`**: Calls `baseTick()`, the entry point for per-tick updates.
2. **`Entity::baseTick()`**: Handles:
   - Fire timer and fire damage (`lavaHurt()`, `burn()`)
   - Water state (`updateInWaterState()`)
   - Air supply (drowning): decreases by 1 per tick when submerged, deals 2 damage every tick at 0 supply. Total air supply is `20 * 15 = 300` ticks (15 seconds).
   - Web stuck state
   - Portal handling
   - Tick counter increment
3. **`Mob::tick()`**: Adds on top of the base with:
   - `superTick()` for base Entity tick
   - AI step (`aiStep()`)
   - Body rotation updates
   - Effect ticking (`tickEffects()`)
   - Death handling (`tickDeath()` when `deathTime > 0`)
4. **`Mob::aiStep()`**: Handles:
   - Despawn checking (`checkDespawn()`)
   - Sensing updates (`sensing->tick()` clears the seen/unseen caches each tick)
   - Target selection
   - Goal selector ticks (`goalSelector.tick()`, `targetSelector.tick()`)
   - Navigation and movement controls (`lookControl->tick()`, `moveControl->tick()`, `jumpControl->tick()`)
   - Travel physics (`travel()`)

### Save and Load

Entities serialize to NBT `CompoundTag` structures:

**`Entity::save(CompoundTag*)`** writes:
- `"id"`: String entity type ID (from `EntityIO`)
- Then calls `saveWithoutId()`:
  - `"Pos"`: DoubleList of x, y, z
  - `"Motion"`: DoubleList of xd, yd, zd (clamped to abs <= 10.0 on load)
  - `"Rotation"`: FloatList of yRot, xRot
  - `"FallDistance"`: float
  - `"Fire"`: short (fire timer)
  - `"Air"`: short (air supply)
  - `"OnGround"`: boolean
  - Then calls `addAdditonalSaveData()` (virtual, overridden by each entity)

**`Entity::load(CompoundTag*)`** reads:
- Position, motion, rotation from the lists above
- Clamps motion values to `abs <= 10.0`
- Reads fall distance, fire, air supply, on-ground state
- Calls `readAdditionalSaveData()` (virtual, overridden by each entity)

**`EntityIO::loadStatic(CompoundTag*, Level*)`** is the entry point for loading any entity from NBT. It reads the `"id"` string, creates the entity through the factory, then calls `entity->load()`.

### Death

1. **`Mob::die(DamageSource*)`**: Called when health reaches zero:
   - Awards XP to the killing player (if `lastHurtByPlayer` is set)
   - Calls `dropDeathLoot()` to spawn item drops
   - Calls `dropRareDeathLoot()` for rare loot (affected by Looting enchantment)
   - Awards kill score via `sourceEntity->awardKillScore()`
   - Notifies the killer via `sourceEntity->killed()`
2. **`Mob::tickDeath()`**: Called each tick while `deathTime` counts up:
   - Increments `deathTime`
   - At `deathTime == 20`, calls `remove()` to despawn the entity
3. **`Entity::remove()`**: Marks the entity as `removed = true`, freeing its small ID.

### Despawn Checking

`Mob::checkDespawn()` runs every tick through `aiStep()`. The 4J console version adds despawn protection for animals:

- Animals default to `despawnProtected = true` when spawned
- `Animal::updateDespawnProtectedState()` tracks how far an animal has wandered using `m_minWanderX/Z` and `m_maxWanderX/Z`
- If an animal wanders more than `MAX_WANDER_DISTANCE` (20 tiles) from where it was last protected, it loses protection and can be despawned
- The "extra wandering" system (`Entity::tickExtraWandering()`) periodically picks up to 3 entities at a time (`EXTRA_WANDER_MAX`) to wander for 30 seconds (`EXTRA_WANDER_TICKS`), figuring out whether they're enclosed in a farm
- `isExtraWanderingEnabled()` and `getWanderingQuadrant()` are used by `RandomStrollGoal` to make these chosen entities wander in a specific direction

Several goals also call `setDespawnProtected()` when they detect a nearby player, like `TemptGoal` and `BegGoal`. The idea is: if a player is interacting with this mob, don't despawn it.

## Mob Spawning System

`MobSpawner` (`MobSpawner.h` / `MobSpawner.cpp`) handles natural mob spawning. The console version differs quite a bit from Java edition.

### Mob Categories

Defined in `MobCategory` (`MobCategory.h`), each category has a spawn material and hard cap:

| Category | Friendly | Material | Hard Limit |
|----------|----------|----------|------------|
| `monster` | No | Air | 50 |
| `creature` | Yes | Air | 50 |
| `waterCreature` | Yes | Water | 5 |
| `creature_wolf` | Yes | Air | 8 |
| `creature_chicken` | Yes | Air | 8 |
| `creature_mushroomcow` | Yes | Air | 2 |

4J Studios broke wolves, chickens, and mooshrooms into separate categories so they could control spawning more precisely. Breeding and spawn eggs let you go past the base limits:

| Entity | Natural | + Breeding | + Spawn Egg |
|--------|---------|------------|-------------|
| Animals (total) | 50 | 70 | 90 |
| Chickens | 8 | 16 | 26 |
| Wolves | 8 | 16 | 26 |
| Mooshrooms | 2 | 22 | 30 |
| Monsters | 50 | | 70 |
| Squid | 5 | | 13 |
| Villagers | 35 | 35 | 50 |
| Snow Golems | 16 | | |
| Iron Golems | 16 | | |

### Spawn Tick Algorithm

`MobSpawner::tick()` runs each server tick:

1. **Build the chunk poll set**: Iterates outward from each player in a spiral (radius 8 chunks). Chunks at the edge are flagged to prevent spawning at the boundary.
2. **For each mob category**: Check if the global count is below the hard limit.
3. **For each eligible chunk**: Pick a random position. If the position works:
   - Must be at least `MIN_SPAWN_DISTANCE` (24 blocks) from any player
   - Must be at least 24 blocks from the world spawn
   - Must pass `isSpawnPositionOk()` checks
4. **50% rule**: No single mob type can take more than 50% of its category's total limit (prevents one type from taking over).
5. **Special rules**:
   - Ghasts are capped at 4
   - Endermen in The End get a higher cap, scaled by difficulty
6. **Post-spawn**: `finalizeMobSettings()` handles special cases:
   - 1% chance for a Spider to spawn with a Skeleton jockey
   - Sheep get a random wool color
   - Ocelots have a 1-in-7 chance to spawn with 2 kittens

### Spawn Position Validation

Different mob types have different spawn requirements:

- **Monsters**: Must pass `isDarkEnoughToSpawn()` (light level check) and `canSpawn()` (block checks)
- **Animals**: Need a grass block below and light level >= 9
- **Water mobs**: Need deep, wide water: 5 blocks deep and at least 5 blocks wide in all cardinal directions
- **Custom checks**: Any mob can override `canSpawn()` for special conditions

### Biome Mob Lists

Each biome has lists of mobs that can spawn there, stored as `MobSpawnerData` objects with a type, weight, and min/max group size. The base `Biome` constructor sets up default lists (zombies, skeletons, spiders for monsters; sheep, pigs, cows, chickens for friendlies). Specific biomes override or extend these.

### Bed Enemy Spawning

`MobSpawner::attackSleepingPlayers()` runs when players try to sleep. It pathfinds from a random position to the player's bed:

- Eligible enemy types: Spider, Zombie, Skeleton
- Uses `PathFinder` to check if a valid path exists to the bed
- If a path is found, the mob is placed at the bed and the player gets woken up

## Entity Events

`EntityEvent` (`EntityEvent.h`) defines byte constants for client-side event notifications sent through `EntityEventPacket`:

| Constant | Value | Event |
|----------|-------|-------|
| `JUMP` | 1 | Entity jumped |
| `HURT` | 2 | Entity was hurt |
| `DEATH` | 3 | Entity died |
| `START_ATTACKING` | 4 | Started attacking |
| `STOP_ATTACKING` | 5 | Stopped attacking |
| `TAMING_FAILED` | 6 | Taming attempt failed |
| `TAMING_SUCCEEDED` | 7 | Taming succeeded |
| `SHAKE_WETNESS` | 8 | Wolf shaking off water |
| `USE_ITEM_COMPLETE` | 9 | Finished using item |
| `EAT_GRASS` | 10 | Sheep eating grass |
| `OFFER_FLOWER` | 11 | Iron Golem offering flower |
| `LOVE_HEARTS` | 12 | Love heart particles |
| `VILLAGER_ANGRY` | 13 | Angry villager particles |
| `VILLAGER_HAPPY` | 14 | Happy villager particles |
| `WITCH_HAT_MAGIC` | 15 | Witch hat magic effect |
| `ZOMBIE_CONVERTING` | 16 | Zombie converting to villager |
| `FIREWORKS_EXPLODE` | 17 | Fireworks explosion |
| `IN_LOVE_HEARTS` | 18 | In-love heart particles |

Events are broadcast with `level->broadcastEntityEvent(entity, eventId)` on the server side. The client receives them through `handleEntityEvent(byte)` which each entity overrides to trigger the right visual effect. For example, the Zombie handles `ZOMBIE_CONVERTING` to play the remedy sound effect.

## Player Entity

`Player` (`Player.h`) extends `Mob` and adds a lot of extra functionality.

### Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_NAME_LENGTH` | 20 | Maximum player name length (16 + 4) |
| `MAX_HEALTH` | 20 | Maximum health points |
| `SWING_DURATION` | 6 | Arm swing animation ticks |
| `SLEEP_DURATION` | 100 | Ticks required to sleep |
| `WAKE_UP_DURATION` | 10 | Wake-up animation ticks |
| `DEATHFADE_DURATION` | 21 | Death fade animation ticks (4J addition) |

### Player Privileges

The `EPlayerGamePrivileges` enum (a 4J addition) is a bitfield stored in an `unsigned int` that controls trust-based permissions:

| Privilege | Bit | Description |
|-----------|-----|-------------|
| `CannotMine` | 0 | Prevents mining |
| `CannotBuild` | 1 | Prevents placing blocks |
| `CannotAttackMobs` | 2 | Prevents attacking mobs |
| `CannotAttackPlayers` | 3 | Prevents attacking players |
| `Op` | 4 | Operator status |
| `CanFly` | 5 | Flight permission |
| `ClassicHunger` | 6 | Classic hunger mode |
| `Invisible` | 7 | Invisibility |
| `Invulnerable` | 8 | Invulnerability |
| `CreativeMode` | 9 | Creative mode (network transfer only) |
| `CannotAttackAnimals` | 10 | Prevents attacking animals |
| `CanUseDoorsAndSwitches` | 11 | Door/switch permission |
| `CanUseContainers` | 12 | Container access permission |
| `CanToggleInvisible` | 13 | Can toggle invisibility |
| `CanToggleFly` | 14 | Can toggle flight |
| `CanToggleClassicHunger` | 15 | Can toggle classic hunger |
| `CanTeleport` | 16 | Can teleport |

### Player-Specific Features

- **Inventory**: `shared_ptr<Inventory> inventory` and an Ender Chest inventory (`PlayerEnderChestContainer`)
- **Food system**: `FoodData` tracks hunger, saturation, and exhaustion
- **Experience**: `experienceLevel`, `totalExperience`, `experienceProgress`
- **Sleeping**: Full bed sleeping system with `BedSleepingResult` enum (`OK`, `NOT_POSSIBLE_HERE`, `NOT_POSSIBLE_NOW`, `TOO_FAR_AWAY`, `OTHER_PROBLEM`, `NOT_SAFE`)
- **Abilities**: `Abilities` object for game mode abilities (fly, instabuild, etc.)
- **Custom skins**: `EDefaultSkins` (8 default skins), custom skin IDs, custom capes
- **Fishing**: `shared_ptr<FishingHook> fishing`
- **Guest system**: `isGuest()` for guest players
- **Map visibility**: `canShowOnMaps()` respects invisible privilege
- **XUID/UUID**: Platform-specific player identification

### Player Armor Calculation

`Player::getArmorValue()` adds up the defense values from all equipped `ArmorItem` pieces. `getArmorCoverPercentage()` calculates what percentage of armor slots are filled, which is used for enchantment calculations.

## AI System (Goal Selectors)

Mobs use a goal-based AI system through `GoalSelector` (`GoalSelector.h`). Each `Mob` has two selectors:

- **`goalSelector`**: Behavior goals (movement, interaction, idle actions)
- **`targetSelector`**: Target selection goals (who to attack)

### GoalSelector Architecture

Goals get wrapped in `InternalGoal` objects with a priority number. Each tick, the selector:

1. Checks which goals can start (`canUseInSystem()`)
2. Checks which running goals can keep going (`canContinueToUse()`)
3. Checks co-existence rules (`canCoExist()`) between goals

Lower priority numbers take precedence. Goals are added with `addGoal(priority, goal)`.

### AI Control Systems

Each `Mob` creates several control objects in its constructor:

| Control | Class | Purpose |
|---------|-------|---------|
| `lookControl` | `LookControl` | Head rotation toward targets. Has `setLookAt(entity, yMax, xMax)` and `setLookAt(x, y, z, yMax, xMax)`. Ticks every frame to smoothly rotate the head toward the wanted position. |
| `moveControl` | `MoveControl` | Movement velocity and direction. `setWantedPosition(x, y, z, speed)` tells the mob where to go. On tick, it calculates the rotation and sets the mob's speed. Stops if distance is less than `MIN_SPEED_SQR`. Triggers jump if target is above. |
| `jumpControl` | `JumpControl` | Jump triggering. `jump()` sets a flag, `tick()` triggers the actual jump. |
| `bodyControl` | `BodyControl` | Body rotation alignment |
| `navigation` | `PathNavigation` | A* pathfinding (configurable range, defaults to 16 blocks) |
| `sensing` | `Sensing` | Line-of-sight checks with per-tick caching. Maintains `seen` and `unseen` lists that are cleared every tick. |

### Sensing Cache

The `Sensing` class is a simple optimization. Every tick, it clears its `seen` and `unseen` entity lists. When `canSee(target)` is called, it first checks the cache. If the target isn't cached, it calls `mob->canSee(target)` (which does a raycast) and caches the result. This way, if multiple goals check visibility on the same target in the same tick, the raycast only happens once.

## Mob Reference

### Passive Mobs (Animals)

| Mob | Health | Inherits | Special Features |
|-----|--------|----------|-----------------|
| `Cow` | 10 | `Animal` | Milkable with bucket |
| `MushroomCow` | 10 | `Cow` | Shearable for mushrooms |
| `Pig` | 10 | `Animal` | Saddleable, controllable; lightning converts to PigZombie |
| `Sheep` | 8 | `Animal` | Shearable wool, dyeable; eats grass to regrow |
| `Chicken` | 4 | `Animal` | No fall damage, lays eggs |
| `Squid` | 10 | `WaterAnimal` | Water-only, tentacle animation |
| `Wolf` | 8/20 | `TamableAnimal` | Tameable, sittable, dyeable collar, angry mode |
| `Ozelot` | 10 | `TamableAnimal` | Tameable, 4 cat types, no fall damage |
| `Villager` | 20 | `AgableMob` + `Npc` + `Merchant` | 5 professions, trading, breeding |

### Hostile Mobs (Monsters)

| Mob | Health | Inherits | Special Features |
|-----|--------|----------|-----------------|
| `Zombie` | 20 | `Monster` | Baby variant, villager variant, villager conversion |
| `PigZombie` | 20 | `Zombie` | Anger system, alerts nearby PigZombies, carries gold sword |
| `Skeleton` | 20 | `Monster` | Carries bow, `UNDEAD` mob type |
| `Creeper` | 20 | `Monster` | Swell/explode mechanic, powered by lightning |
| `Spider` | 16 | `Monster` | Wall climbing, `ARTHROPOD` mob type, jockey host |
| `CaveSpider` | 12 | `Spider` | Smaller, applies poison on hit |
| `EnderMan` | 40 | `Monster` | Teleportation, block carrying, aggro on eye contact |
| `Silverfish` | 8 | `Monster` | Calls friends when hurt, `ARTHROPOD` mob type |
| `Blaze` | 20 | `Monster` | Flying attacks, fire projectiles, always lit |
| `Giant` | 100 | `Monster` | Giant zombie, no AI |
| `Slime` | varies | `Mob` + `Enemy` | Size-based health, splits on death |
| `LavaSlime` | varies | `Slime` | Nether variant, has armor, fire immune |
| `Ghast` | 10 | `FlyingMob` + `Enemy` | Flying, shoots fireballs |

### Utility Mobs (Golems)

| Mob | Health | Inherits | Special Features |
|-----|--------|----------|-----------------|
| `VillagerGolem` | 100 | `Golem` | Village defense, no fall damage, offers flowers |
| `SnowMan` | 4 | `Golem` | Throws snowballs, leaves snow trail |

### Boss Mobs

| Mob | Health | Inherits | Special Features |
|-----|--------|----------|-----------------|
| `EnderDragon` | varies | `BossMob` | Multi-part entity (head, neck, body, tail, wings), ender crystal healing, pathfinding AI with holding pattern / strafe / landing / sitting states |

### Non-Mob Entities

| Entity | Class | Key Features |
|--------|-------|-------------|
| `ItemEntity` | `Entity` | Dropped items. Has a 5-minute lifetime (`LIFETIME = 5 * 60 * 20`). Merges with nearby identical items. `DATA_ITEM` at synch ID 10 holds the item stack. Has health (destroyed by fire, lava, explosions). |
| `ExperienceOrb` | `Entity` | XP orbs. Attracted to nearby players. Has an age and value. |
| `Painting` | `HangingEntity` | Wall art. Picks from available motifs based on wall size. |
| `ItemFrame` | `HangingEntity` | Holds an item on a wall. Can rotate the displayed item. |
| `LightningBolt` | `GlobalEntity` | Lightning strike. Global entities are visible to all players regardless of distance. Lasts a few ticks, sets nearby blocks on fire. |
| `PrimedTnt` | `Entity` | Ticking TNT. Fuse timer counts down, then explodes. |
| `FallingTile` | `Entity` | Falling sand/gravel. Checks block below each tick, places itself when landing. |
| `Minecart` | `Entity` + `Container` | Rideable/chest/furnace types (all in one class via `type` field). Follows rails, has physics for powered rails and slopes. Synch IDs 16-19 for fuel, hurt, hurt direction, damage. |
| `Boat` | `Entity` | Water vehicle. Has acceleration and speed physics. Breaks on collision (drops planks and sticks). Synch IDs 17-19 for hurt, hurt direction, damage. |
| `EnderCrystal` | `Entity` | Heals the Ender Dragon. Explodes when destroyed. |

### Projectile Entities

| Entity | Description |
|--------|-------------|
| `Arrow` | Shot by skeletons and players. Sticks in blocks. Has pickup rules. Tracks its owner for kill credit. |
| `Fireball` | Shot by Ghasts. Explodes on impact. Can be deflected by hitting it. |
| `SmallFireball` | Shot by Blazes. Sets blocks on fire. Smaller explosion than Fireball. |
| `Snowball` | Thrown by players and Snow Golems. Deals knockback, 3 damage to Blazes. |
| `ThrownEnderpearl` | Teleports the thrower to the impact point. Deals 5 fall damage to the thrower. |
| `EyeOfEnderSignal` | Floats toward the nearest stronghold. Breaks or drops after a short flight. |
| `ThrownPotion` | Splash potion. Applies effects in an area on impact. |
| `ThrownExpBottle` | Drops XP orbs on impact. |
| `DragonFireball` | Shot by the Ender Dragon. Leaves lingering damage area. |

## Key Virtual Methods

These are the most important virtual methods that entity subclasses override:

| Method | Declared In | Purpose |
|--------|-------------|---------|
| `GetType()` | `Entity` | Returns `eINSTANCEOF` enum for type checking |
| `defineSynchedData()` | `Entity` | Register synched data fields |
| `tick()` | `Entity` | Per-tick update |
| `baseTick()` | `Entity` | Core tick logic (fire, water, air) |
| `hurt(DamageSource*, int)` | `Entity` | Take damage |
| `die(DamageSource*)` | `Mob` | Handle death |
| `getMaxHealth()` | `Mob` | Return maximum HP (pure virtual) |
| `aiStep()` | `Mob` | AI and physics update |
| `canSpawn()` | `Mob` | Validate spawn position |
| `readAdditionalSaveData(CompoundTag*)` | `Entity` | Load entity-specific NBT data |
| `addAdditonalSaveData(CompoundTag*)` | `Entity` | Save entity-specific NBT data |
| `getDeathLoot()` | `Mob` | Return item ID dropped on death |
| `dropDeathLoot(bool, int)` | `Mob` | Spawn death drops |
| `dropRareDeathLoot(int)` | `Mob` | Spawn rare drops (Looting-affected) |
| `getAmbientSound()` | `Mob` | Return ambient sound ID |
| `getHurtSound()` | `Mob` | Return hurt sound ID |
| `getDeathSound()` | `Mob` | Return death sound ID |
| `useNewAi()` | `Mob` | Whether to use goal-based AI (returns false by default!) |
| `getMobType()` | `Mob` | Return `MobType` for enchantment bonuses |
| `interact(Player)` | `Entity` | Handle player right-click interaction |
| `finalizeMobSpawn()` | `Mob` | Post-spawn initialization |
| `removeWhenFarAway()` | `Mob` | Whether to despawn when distant |
| `getExperienceReward(Player)` | `Mob` | XP dropped when killed by player |
| `getBreedOffspring(AgableMob)` | `AgableMob` | Create baby entity for breeding |
| `getWalkTargetValue(int, int, int)` | `PathfinderMob` | Score a position for wandering (monsters prefer dark, animals prefer grass) |
| `isDarkEnoughToSpawn()` | `Monster` | Light level check for natural spawning |
| `canBeControlledByRider()` | `Mob` | Whether a riding player can steer (Pig with carrot on stick) |
| `isFood(ItemInstance)` | `Animal` | Whether an item triggers love mode |
| `canMate(Animal)` | `Animal` | Whether two animals can breed together |

## Network Packets

Entity state gets communicated through several packet types:

| Packet | Purpose |
|--------|---------|
| `AddEntityPacket` | Spawn a non-mob entity |
| `AddMobPacket` | Spawn a mob entity |
| `AddPlayerPacket` | Spawn a player entity |
| `AddGlobalEntityPacket` | Spawn a global entity (lightning) |
| `AddPaintingPacket` | Spawn a painting |
| `AddExperienceOrbPacket` | Spawn an experience orb |
| `RemoveEntitiesPacket` | Despawn entities |
| `MoveEntityPacket` | Full position/rotation update |
| `MoveEntityPacketSmall` | Delta position update |
| `TeleportEntityPacket` | Absolute position teleport |
| `SetEntityDataPacket` | Synched entity data update |
| `SetEntityMotionPacket` | Velocity update |
| `SetEquippedItemPacket` | Equipment change |
| `SetRidingPacket` | Mount/dismount |
| `RotateHeadPacket` | Head rotation update |
| `EntityEventPacket` | Entity event (hurt, death, etc.) |
| `AnimatePacket` | Animation trigger |
| `InteractPacket` | Player interaction with entity |
| `MovePlayerPacket` | Player position update |

## MinecraftConsoles Differences

MC adds a bunch of new entity types that LCEMP doesn't have:

### New mobs

| Entity | Type | Numeric ID | Notes |
|--------|------|-----------|-------|
| `Witch` | Monster | 66 | Ranged potion attacks, uses `RangedAttackGoal` |
| `WitherBoss` | Boss | 64 | Second boss mob, multi-part entity like the Ender Dragon |
| `Bat` | Ambient | 65 | First ambient creature type, uses new `AmbientCreature` base class |
| `EntityHorse` | Animal | 100 | Covers horses, donkeys, mules, skeleton horses, and zombie horses (TYPE_DONKEY, TYPE_MULE, TYPE_SKELETON, TYPE_UNDEAD variants) |

### New non-mob entities

| Entity | Numeric ID | Notes |
|--------|-----------|-------|
| `LeashFenceKnotEntity` | 8 | Invisible entity on a fence post that holds a lead |
| `FireworksRocketEntity` | 22 | Fireworks rocket projectile |
| `MinecartChest` | 43 | Chest minecart |
| `MinecartFurnace` | 44 | Powered minecart |
| `MinecartTNT` | 45 | TNT minecart |
| `MinecartHopper` | 46 | Hopper minecart |
| `MinecartSpawner` | 47 | Spawner minecart |

In LCEMP, there's a single `Minecart` class (ID 40) and `Boat` class (ID 41). MC splits minecarts into typed subclasses with a shared `MinecartContainer` base for the ones that hold items.

### New base classes

MC adds several base classes that don't exist in LCEMP:

- **`AmbientCreature`**: Base class for ambient mobs like bats. Sits between `PathfinderMob` and specific ambient entities.
- **`MultiEntityMob`** / **`MultiEntityMobPart`**: For multi-part entities. LCEMP handled the Ender Dragon's parts differently.
- **`LivingEntity`**: MC seems to be starting to split `Mob` responsibilities. This file exists in MC but not LCEMP.
- **`Projectile`**: A shared interface/base for projectile entities.
- **`OwnableEntity`**: Interface for entities that can be owned (used by horses and tameable animals).

### Attribute system

MC adds a full attribute system for mobs. Instead of hardcoded health/speed/damage values, mobs register attributes with modifiers:

- `SharedMonsterAttributes` defines standard attributes like `MAX_HEALTH`, `FOLLOW_RANGE`, `KNOCKBACK_RESISTANCE`, `MOVEMENT_SPEED`, `ATTACK_DAMAGE`
- `AttributeModifier` can add, multiply, or scale attribute values
- `BaseAttributeMap` / `ServersideAttributeMap` manage per-entity attribute instances
- `UpdateAttributesPacket` syncs attribute values to clients

LCEMP doesn't have any of this. Health and speed are just direct member variables on the `Mob` class.

### Combat tracking

MC adds `CombatEntry` and `CombatTracker` classes for tracking combat events (who hit whom, when, with what). This feeds into death messages and the scoreboard system. LCEMP just has the basic `DamageSource` system.

### Entity selector

MC adds `EntitySelector` / `PlayerSelector` for command-style entity targeting (`@a`, `@e`, `@p`, `@r`). This works with the command block system that MC adds.
