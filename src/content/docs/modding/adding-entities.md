---
title: Adding Entities
description: Step-by-step guide to adding new entities to LCE.
---

This guide walks you through creating new entities in LCE. We cover every type: hostile mobs, passive mobs, projectiles, vehicles, and item entities. Each follows the same basic pipeline of defining the class, registering it with `EntityIO`, and hooking up rendering.

## Entity Class Hierarchy

Every entity in LCE inherits from `Entity` (`Minecraft.World/Entity.h`). Here's the full hierarchy:

```
Entity
├── Mob                    # Health, AI, effects, equipment
│   └── PathfinderMob      # Pathfinding, attack targets
│       ├── Monster        # Hostile mobs (burns in daylight, dark spawn checks)
│       │   ├── Zombie
│       │   ├── Skeleton
│       │   ├── Creeper
│       │   └── ...
│       └── AgableMob      # Baby/adult system, breeding
│           └── Animal     # Passive mobs (food, love mode, despawn protection)
│               ├── Cow
│               ├── Pig
│               ├── Sheep
│               └── TamableAnimal  # Taming, sitting, owner
│                   ├── Wolf
│                   └── Ozelot
├── Arrow                  # Arrow projectile
├── Snowball               # Snowball projectile
├── Fireball               # Ghast fireball
├── SmallFireball           # Blaze fireball
├── ThrownEnderpearl       # Ender pearl projectile
├── ThrownPotion           # Splash potion projectile
├── ThrownExpBottle        # Experience bottle projectile
├── EyeOfEnderSignal       # Eye of ender (flies toward stronghold)
├── DragonFireball          # Dragon fireball
├── Boat                   # Rideable boat
├── Minecart               # Minecart (rideable, chest, furnace variants)
├── ItemEntity             # Dropped items
├── ExperienceOrb          # XP orbs
├── Painting               # Hanging paintings
├── ItemFrame              # Item frames
├── PrimedTnt              # Lit TNT block
├── FallingTile            # Falling sand/gravel
└── EnderCrystal           # End crystal
```

Pick whichever base class matches the behavior you want:

| Base Class | Use When |
|-----------|----------|
| `Monster` | Hostile mob that attacks players, spawns in the dark |
| `Animal` | Passive mob that can breed, follows food items |
| `TamableAnimal` | Animal that can be tamed and owned by a player |
| `PathfinderMob` | Neutral mob with pathfinding but no breeding/hostility |
| `Mob` | Non-pathfinding mob (e.g., water creatures) |
| `Entity` | Non-living entity (projectile, vehicle, dropped item, decoration) |

## Step 1: Add an eINSTANCEOF Type

LCE uses an `eINSTANCEOF` enum instead of C++ `dynamic_cast` to identify entity types at runtime. Add a new entry to the enum in `Minecraft.World/Definitions.h` (or wherever the full enum is defined):

```cpp
// In the eINSTANCEOF enum
eTYPE_MY_MOB,
```

Every entity class overrides `GetType()` to return its enum value. This is how the engine does type checks without `dynamic_cast`:

```cpp
eINSTANCEOF GetType() { return eTYPE_MY_MOB; }
```

## Step 2: Create the Entity Class

The pattern differs depending on what kind of entity you're making.

### Hostile mob

Here's a hostile mob example based on how `Zombie` is set up:

#### Header (`Minecraft.World/MyMob.h`)

```cpp
#pragma once
#include "Monster.h"

class MyMob : public Monster
{
public:
    eINSTANCEOF GetType() { return eTYPE_MY_MOB; }
    static Entity *create(Level *level) { return new MyMob(level); }

    MyMob(Level *level);

    virtual int getMaxHealth();

protected:
    virtual bool useNewAi();
    virtual void defineSynchedData();
    virtual int getAmbientSound();
    virtual int getHurtSound();
    virtual int getDeathSound();
    virtual int getDeathLoot();
    virtual void dropDeathLoot(bool wasKilledByPlayer, int playerBonusLevel);

public:
    virtual void addAdditonalSaveData(CompoundTag *tag);
    virtual void readAdditionalSaveData(CompoundTag *tag);
};
```

A couple important things here:
- The static `create` function is a **factory** that `EntityIO` uses to create mobs from save data or network packets.
- `useNewAi()` needs to return `true` to turn on the `GoalSelector`-based AI system.

#### Implementation (`Minecraft.World/MyMob.cpp`)

Here's the constructor pattern that `Cow` and `Zombie` both follow:

```cpp
#include "MyMob.h"
// Include AI goal headers
#include "net.minecraft.world.entity.ai.goal.h"
#include "net.minecraft.world.entity.ai.goal.target.h"
#include "net.minecraft.world.entity.ai.navigation.h"

MyMob::MyMob(Level *level) : Monster(level)
{
    // IMPORTANT: Call defineSynchedData() in your constructor.
    // It cannot be called from the Entity base ctor because
    // virtual dispatch is not yet available.
    this->defineSynchedData();

    // Set health after defineSynchedData
    health = getMaxHealth();

    // Texture index (register in Textures.h)
    this->textureIdx = TN_MOB_MY_MOB;

    // Movement and combat
    runSpeed = 0.25f;
    attackDamage = 5;

    // Bounding box
    setSize(0.6f, 1.8f);

    // Navigation options
    getNavigation()->setCanOpenDoors(true);

    // --- AI Goals (lower priority number = higher priority) ---
    goalSelector.addGoal(0, new FloatGoal(this));
    goalSelector.addGoal(1, new MeleeAttackGoal(this, eTYPE_PLAYER, runSpeed, false));
    goalSelector.addGoal(2, new MoveTowardsRestrictionGoal(this, runSpeed));
    goalSelector.addGoal(3, new RandomStrollGoal(this, runSpeed));
    goalSelector.addGoal(4, new LookAtPlayerGoal(this, typeid(Player), 8));
    goalSelector.addGoal(5, new RandomLookAroundGoal(this));

    // --- Targeting Goals ---
    targetSelector.addGoal(1, new HurtByTargetGoal(this, false));
    targetSelector.addGoal(2, new NearestAttackableTargetGoal(
        this, typeid(Player), 16, 0, true));
}
```

### Passive mob

For a passive mob (like a Cow), extend `Animal` and use passive goals instead:

```cpp
MyCow::MyCow(Level *level) : Animal(level)
{
    this->defineSynchedData();
    health = getMaxHealth();
    this->textureIdx = TN_MOB_MY_COW;
    this->setSize(0.9f, 1.3f);

    getNavigation()->setAvoidWater(true);
    goalSelector.addGoal(0, new FloatGoal(this));
    goalSelector.addGoal(1, new PanicGoal(this, 0.38f));
    goalSelector.addGoal(2, new BreedGoal(this, 0.2f));
    goalSelector.addGoal(3, new TemptGoal(this, 0.25f, Item::wheat_Id, false));
    goalSelector.addGoal(4, new FollowParentGoal(this, 0.25f));
    goalSelector.addGoal(5, new RandomStrollGoal(this, 0.2f));
    goalSelector.addGoal(6, new LookAtPlayerGoal(this, typeid(Player), 6));
    goalSelector.addGoal(7, new RandomLookAroundGoal(this));
}
```

Passive mobs need no `targetSelector` goals since they don't attack. They also need `getBreedOffspring()` and `isFood()` overrides for breeding.

### Tamable mob

For a tamable pet, extend `TamableAnimal`. This gives you owner tracking, sitting, and the whole taming flow:

```cpp
MyPet::MyPet(Level *level) : TamableAnimal(level)
{
    this->defineSynchedData();
    health = getMaxHealth();
    this->setSize(0.6f, 0.8f);

    // Store the sit goal so we can reference it from interaction code
    sitGoal = new SitGoal(this);

    goalSelector.addGoal(1, new FloatGoal(this));
    goalSelector.addGoal(2, sitGoal, false);  // false = don't delete, we manage this
    goalSelector.addGoal(3, new LeapAtTargetGoal(this, 0.4f));
    goalSelector.addGoal(4, new MeleeAttackGoal(this, 1.0f, true));
    goalSelector.addGoal(5, new FollowOwnerGoal(this, 1.0f, 10.0f, 2.0f));
    goalSelector.addGoal(6, new BreedGoal(this, 1.0f));
    goalSelector.addGoal(7, new RandomStrollGoal(this, 1.0f));
    goalSelector.addGoal(8, new LookAtPlayerGoal(this, typeid(Player), 8.0f));
    goalSelector.addGoal(9, new RandomLookAroundGoal(this));

    targetSelector.addGoal(1, new OwnerHurtByTargetGoal(this));
    targetSelector.addGoal(2, new OwnerHurtTargetGoal(this));
    targetSelector.addGoal(3, new HurtByTargetGoal(this, true));
}
```

Notice the `sitGoal` is stored as a member variable with `canDeletePointer = false` in `addGoal`. That's because the mob needs to call `sitGoal->wantToSit(true/false)` from its `interact()` method when the player right-clicks to toggle sitting.

### Projectile entity

Projectiles inherit directly from `Entity`. They don't use the AI system at all. Instead they override `tick()` to handle their own movement, collision, and damage.

Here's the basic pattern based on `Arrow`:

```cpp
#pragma once
#include "Entity.h"

class MyProjectile : public Entity
{
public:
    eINSTANCEOF GetType() { return eTYPE_MY_PROJECTILE; }
    static Entity *create(Level *level) { return new MyProjectile(level); }

    shared_ptr<Entity> owner;

    MyProjectile(Level *level);
    MyProjectile(Level *level, shared_ptr<Mob> shooter, float power);
    MyProjectile(Level *level, double x, double y, double z);

    void shoot(double xd, double yd, double zd, float pow, float uncertainty);

    virtual void tick();  // Handle movement, block/entity collision
    virtual void defineSynchedData();
    virtual void addAdditonalSaveData(CompoundTag *tag);
    virtual void readAdditionalSaveData(CompoundTag *tag);
};
```

The `tick()` override is where all the action happens. A typical projectile tick does:

1. Apply gravity to `yd` (unless it's a fireball)
2. Move by `(xd, yd, zd)` with collision checks
3. Check for block hits (tile collision), switch to embedded/stuck state
4. Check for entity hits using `level->getEntities()` and `AABB` intersection
5. Apply damage using `DamageSource::arrow()` or a custom damage source
6. Apply velocity drag (multiply by ~0.99 each tick in air, ~0.6 in water)
7. Handle removal after hitting something or after a lifetime timer

The `Arrow` class is a great reference. It has three constructors: one for save loading (just level), one for mob shooting (level + mob + power), and one for placement at a position. All arrows store their `owner` so the game can give kill credit.

### Vehicle entity

Vehicles like `Boat` and `Minecart` also extend `Entity` directly. They support riders through the entity riding system.

Key things a vehicle needs:

```cpp
// Let entities collide with it
virtual AABB *getCollideAgainstBox(shared_ptr<Entity> entity);
virtual AABB *getCollideBox();
virtual bool isPushable();

// Riding
virtual double getRideHeight();  // Y offset for the rider
virtual bool interact(shared_ptr<Player> player);  // Mount on right-click

// Network interpolation
virtual void lerpTo(double x, double y, double z, float yRot, float xRot, int steps);
virtual void lerpMotion(double xd, double yd, double zd);
```

The `Boat` uses synch data IDs 17-19 for hurt state, hurt direction, and damage. The `Minecart` has three types: `RIDEABLE` (0), `CHEST` (1), and `FURNACE` (2), selected via a `type` field. The chest variant also implements `Container` for inventory storage.

### Item entity

`ItemEntity` represents dropped items in the world. If you need a custom dropped item behavior, you could extend it:

```cpp
class MySpecialItem : public ItemEntity
{
public:
    eINSTANCEOF GetType() { return eTYPE_MY_SPECIAL_ITEM; }
    static Entity *create(Level *level) { return new MySpecialItem(level); }

    MySpecialItem(Level *level, double x, double y, double z,
                  shared_ptr<ItemInstance> item);

    virtual void tick();  // Custom behavior on top of normal item physics
};
```

`ItemEntity` already handles merging with nearby identical items, despawning after 5 minutes (`LIFETIME = 6000 ticks`), bobbing animation, and pickup by players. Synch data ID 10 stores the `ItemInstance` so clients know what to render.

## Step 3: The GoalSelector AI System

`Mob` has two `GoalSelector` instances:

| Selector | Purpose |
|----------|---------|
| `goalSelector` | General behavior (movement, attacks, looking around) |
| `targetSelector` | Target acquisition (who to attack, retaliation) |

### Goal Interface

Every AI goal extends the `Goal` base class (`Minecraft.World/Goal.h`):

```cpp
class Goal
{
public:
    virtual bool canUse() = 0;          // Should this goal activate?
    virtual bool canContinueToUse();    // Should it keep running?
    virtual bool canInterrupt();        // Can other goals preempt it?
    virtual void start();               // Called when goal activates
    virtual void stop();                // Called when goal deactivates
    virtual void tick();                // Called every tick while active
    virtual void setRequiredControlFlags(int flags);
    virtual int getRequiredControlFlags();
};
```

### How GoalSelector Works

Each tick, `GoalSelector::tick()` does the following:

1. Goes through all registered goals in priority order (lower number = higher priority).
2. Checks `canUse()` on inactive goals and `canContinueToUse()` on active ones.
3. Uses `canCoExist()` to figure out if multiple goals can run at the same time (based on control flags).
4. Goals with a lower priority number can interrupt goals with a higher number.

The `newGoalRate` field controls how often new goals are checked (set via `setNewGoalRate()`).

### Common Built-in Goals

| Goal Class | Purpose |
|-----------|---------|
| `FloatGoal` | Swim when in water |
| `MeleeAttackGoal` | Move to and attack a target |
| `PanicGoal` | Run away when hurt |
| `BreedGoal` | Find mate and breed |
| `TemptGoal` | Follow player holding a specific item |
| `FollowParentGoal` | Baby follows parent |
| `RandomStrollGoal` | Wander randomly |
| `LookAtPlayerGoal` | Face nearby player |
| `RandomLookAroundGoal` | Look in random directions |
| `MoveTowardsRestrictionGoal` | Stay near a restriction point |
| `MoveThroughVillageGoal` | Navigate through village paths |
| `BreakDoorGoal` | Break down doors (Zombies) |
| `HurtByTargetGoal` | Target whoever hurt this mob |
| `NearestAttackableTargetGoal` | Target nearest entity of a type |

See the [AI & Goals](/world/ai-goals/) page for the full reference on every goal, including constructor parameters, control flags, and behavior details.

## Step 4: Synched Entity Data

`SynchedEntityData` keeps entity state in sync between server and client. Data items are defined with typed IDs:

```cpp
// In your header, declare synch data IDs as static constants:
static const int DATA_MY_FLAG = 16;  // Start at 16+ to avoid base class IDs

// In defineSynchedData():
void MyMob::defineSynchedData()
{
    Monster::defineSynchedData();  // Always call parent first
    getEntityData()->define(DATA_MY_FLAG, (byte) 0);
}

// Read and write:
bool MyMob::hasMyFlag()
{
    return getEntityData()->getByte(DATA_MY_FLAG) == (byte) 1;
}

void MyMob::setMyFlag(bool value)
{
    getEntityData()->set(DATA_MY_FLAG, (byte)(value ? 1 : 0));
}
```

### Reserved Data IDs

The base classes already use these IDs, so don't reuse them:

| ID | Used By | Purpose |
|----|---------|---------|
| 0 | `Entity` | Shared flags (on fire, sneaking, sprinting, etc.) |
| 1 | `Entity` | Air supply |
| 8 | `Mob` | Effect color |
| 12 | `AgableMob` | Age |
| 13 | `Animal` | In-love state |

`Zombie` uses IDs 12-14 (baby, villager, converting). `Creeper` uses 16-17 (swell direction, powered). `Wolf` uses 18-20 (health, interested, collar color). `Arrow` uses ID 16 (crit flag). `Boat` uses 17-19 (hurt, hurt direction, damage). `Minecart` uses 16-19 (fuel, hurt, hurt direction, damage). Pick IDs that don't collide with your parent class chain.

### Supported Data Types

`SynchedEntityData` supports:

| Type Constant | C++ Type |
|--------------|----------|
| `TYPE_BYTE` (0) | `byte` |
| `TYPE_SHORT` (1) | `short` |
| `TYPE_INT` (2) | `int` |
| `TYPE_FLOAT` (3) | `float` |
| `TYPE_STRING` (4) | `wstring` |
| `TYPE_ITEMINSTANCE` (5) | `shared_ptr<ItemInstance>` |
| `TYPE_POS` (6) | `Pos *` |

The wire format packs each item as a single byte with 5 bits for the ID and 3 bits for the type, followed by the value bytes. `MAX_ID_VALUE` is 31, so you can have at most 32 synched data items per entity. The stream ends with an `EOF_MARKER` byte (0x7F). Strings are capped at `MAX_STRING_DATA_LENGTH` (64 characters).

## Step 5: Register with EntityIO

In `Minecraft.World/EntityIO.cpp`, add your entity to `EntityIO::staticCtor()`:

```cpp
void EntityIO::staticCtor()
{
    // ... existing registrations ...

    // Without spawn egg (like SnowMan):
    setId(MyMob::create, eTYPE_MY_MOB, L"MyMob", 110);

    // With spawn egg (for creative mode):
    setId(MyMob::create, eTYPE_MY_MOB, L"MyMob", 110,
          eMinecraftColour_Mob_MyMob_Colour1,
          eMinecraftColour_Mob_MyMob_Colour2,
          IDS_MY_MOB);
}
```

The `setId` function registers your entity in five maps at once:

| Map | Key | Value |
|-----|-----|-------|
| `idCreateMap` | String ID (`L"MyMob"`) | Factory function |
| `classIdMap` | `eINSTANCEOF` | String ID |
| `numCreateMap` | Numeric ID (`110`) | Factory function |
| `numClassMap` | Numeric ID | `eINSTANCEOF` |
| `classNumMap` | `eINSTANCEOF` | Numeric ID |

The seven-argument version also adds the mob to `idsSpawnableInCreative` for the spawn egg UI.

### Numeric ID Conventions

The existing IDs follow a pattern:

| ID Range | Entity Type |
|----------|------------|
| 1-2 | Item entities (ItemEntity=1, XPOrb=2) |
| 9-18 | Projectiles and decorations (Painting=9, Arrow=10, Snowball=11, etc.) |
| 20-21 | Physics entities (PrimedTnt=20, FallingTile=21) |
| 40-41 | Vehicles (Minecart=40, Boat=41) |
| 48-49 | Base mob types (Mob=48, Monster=49) |
| 50-63 | Hostile mobs (Creeper=50 through EnderDragon=63) |
| 90-99 | Passive mobs (Pig=90 through VillagerGolem=99) |
| 120 | Villager |
| 200 | EnderCrystal |
| 1000 | DragonFireball |

For non-mob entities (projectiles, vehicles, etc.), the same `setId` call works. Every entity type that can be saved/loaded or sent over the network needs a registration here.

## Step 6: Add Spawning Rules

### Biome Mob Spawning

Mobs spawn naturally based on per-biome mob lists. In the `Biome` constructor (`Minecraft.World/Biome.cpp`), default spawns are set up like this:

```cpp
// Default hostile mobs (all biomes):
enemies.push_back(new MobSpawnerData(eTYPE_SPIDER, 10, 4, 4));
enemies.push_back(new MobSpawnerData(eTYPE_ZOMBIE, 10, 4, 4));
// ...

// Default friendly mobs (all biomes):
friendlies.push_back(new MobSpawnerData(eTYPE_SHEEP, 12, 4, 4));
friendlies.push_back(new MobSpawnerData(eTYPE_PIG, 10, 4, 4));
```

`MobSpawnerData` takes four arguments:

| Parameter | Meaning |
|-----------|---------|
| `mobClass` | The `eINSTANCEOF` type to spawn |
| `probabilityWeight` | Relative spawn weight (higher = more common) |
| `minCount` | Minimum group size |
| `maxCount` | Maximum group size |

To add your mob to a specific biome, modify that biome's constructor (e.g., `ForestBiome.cpp`):

```cpp
ForestBiome::ForestBiome(int id) : Biome(id)
{
    // Existing spawns...
    enemies.push_back(new MobSpawnerData(eTYPE_MY_MOB, 8, 1, 3));
}
```

### Mob Categories and Limits

LCE has console-specific spawn limits defined in `MobCategory.h`:

| Category | Hard Limit | With Breeding | With Spawn Egg |
|----------|-----------|---------------|----------------|
| `monster` | 50 | N/A | 70 |
| `creature` | 50 | 70 | 90 |
| `waterCreature` | 5 | N/A | 13 |
| `creature_chicken` | 8 | 16 | 26 |
| `creature_wolf` | 8 | 16 | 26 |
| `creature_mushroomcow` | 2 | 22 | 30 |

Console editions have separate categories for wolves, chickens, and mooshrooms because those mobs have special gameplay purposes (taming, egg farms, mushroom stew). This prevents them from filling up the general creature cap.

### canSpawn() Override

Hostile mobs (`Monster`) check light level and sky access through `isDarkEnoughToSpawn()` and `canSpawn()`. Passive mobs (`Animal`) look for grass blocks and light level. Override `canSpawn()` if you want custom spawn conditions:

```cpp
bool MyMob::canSpawn()
{
    // Example: only spawn above Y=60
    return y > 60 && Monster::canSpawn();
}
```

### Animal Despawn Protection

Passive mobs have a special despawn protection system. `Animal` tracks how far the mob has wandered from its spawn point using `MAX_WANDER_DISTANCE` (20 blocks). If the animal wanders beyond this distance, `RandomStrollGoal` records extra wander data. The `isDespawnProtected()` check considers whether the animal has been interacted with by a player (bred, tempted, or named).

## Step 7: Save and Load Data

Override `addAdditonalSaveData` and `readAdditionalSaveData` to save custom state to NBT:

```cpp
void MyMob::addAdditonalSaveData(CompoundTag *tag)
{
    Monster::addAdditonalSaveData(tag);
    tag->putInt(L"MyCustomData", myCustomValue);
    if (hasMyFlag()) tag->putBoolean(L"MyFlag", true);
}

void MyMob::readAdditionalSaveData(CompoundTag *tag)
{
    Monster::readAdditionalSaveData(tag);
    myCustomValue = tag->getInt(L"MyCustomData");
    if (tag->getBoolean(L"MyFlag")) setMyFlag(true);
}
```

Non-mob entities work the same way. `Arrow` saves its position, motion, damage, and pickup state. `Boat` and `Minecart` save their type and damage. `ItemEntity` saves the item stack and age. Always call the parent class first.

## Step 8: Add a Renderer

On the client side, register a renderer in `Minecraft.Client/EntityRenderDispatcher.cpp`:

```cpp
EntityRenderDispatcher::EntityRenderDispatcher()
{
    // ... existing renderers ...

    // Using an existing model:
    renderers[eTYPE_MY_MOB] = new HumanoidMobRenderer(
        new ZombieModel(), 0.5f);

    // Or with a custom model:
    renderers[eTYPE_MY_MOB] = new MobRenderer(
        new MyMobModel(), 0.7f);
}
```

The `EntityRenderDispatcher` maps `eINSTANCEOF` values directly to `EntityRenderer` instances. Every entity type that can show up in the world **must** have a renderer here, since there's no fallback. The second parameter on most renderers is the shadow size.

### Existing Renderer/Model Pairings

| Mob | Renderer | Model |
|-----|----------|-------|
| Zombie | `ZombieRenderer` | `ZombieModel` |
| Skeleton | `HumanoidMobRenderer` | `SkeletonModel` |
| Creeper | `CreeperRenderer` | `CreeperModel` |
| Cow | `CowRenderer` | `CowModel` |
| Pig | `PigRenderer` | `PigModel` |
| Wolf | `WolfRenderer` | `WolfModel` |
| Spider | `SpiderRenderer` | `SpiderModel` |

Non-mob entities also need renderers. Projectiles typically use a simple sprite renderer. Boats and minecarts have their own model-based renderers.

### Texture Registration

Set `textureIdx` in your entity's constructor to a texture name constant (defined in `Textures.h`). Add your texture constant and load the actual texture in the client's texture system.

## Step 9: Implement Required Overrides

Depending on your base class, you'll need to implement these virtual functions:

### For All Mobs

```cpp
int getMaxHealth();                      // Total hit points
int getDeathLoot();                      // Item ID dropped on death
int getAmbientSound();                   // Sound enum for idle sound
int getHurtSound();                      // Sound enum when damaged
int getDeathSound();                     // Sound enum on death
void dropDeathLoot(bool, int);           // Custom loot drops
MobType getMobType();                    // UNDEFINED, UNDEAD, or ARTHROPOD
```

### For Animals (additionally)

```cpp
shared_ptr<AgableMob> getBreedOffspring(shared_ptr<AgableMob> target);
bool isFood(shared_ptr<ItemInstance> item);  // What item triggers love mode
```

### For Tamable Animals (additionally)

```cpp
virtual bool interact(shared_ptr<Player> player);  // Handle taming + sit toggle
```

### For Projectiles

```cpp
virtual void tick();                         // Movement, collision, damage
virtual void defineSynchedData();            // Synch data for client rendering
virtual void addAdditonalSaveData(CompoundTag *tag);
virtual void readAdditionalSaveData(CompoundTag *tag);
```

### For Vehicles

```cpp
virtual AABB *getCollideAgainstBox(shared_ptr<Entity> entity);
virtual AABB *getCollideBox();
virtual bool isPushable();
virtual double getRideHeight();
virtual bool interact(shared_ptr<Player> player);  // Mount/dismount
virtual void tick();                                // Physics, rail logic, etc.
virtual void positionRider();                       // Position the rider each tick
```

### MobType

The `MobType` enum (`Minecraft.World/MobType.h`) affects enchantment damage:

| Value | Meaning | Affected By |
|-------|---------|------------|
| `UNDEFINED` | Default | Sharpness only |
| `UNDEAD` | Zombies, skeletons | Smite bonus |
| `ARTHROPOD` | Spiders | Bane of Arthropods bonus |

## Complete Example: Hostile Mob

Check out the real `Zombie` implementation across these files for a complete reference:
- `Minecraft.World/Zombie.h` for the class declaration and synched data IDs
- `Minecraft.World/Zombie.cpp` for the constructor with AI goals and all overrides
- `Minecraft.World/EntityIO.cpp` for registration at ID 54 with spawn egg colors
- `Minecraft.Client/EntityRenderDispatcher.cpp` for the renderer at `eTYPE_ZOMBIE`

## Complete Example: Passive Mob

Check out the real `Cow` implementation:
- `Minecraft.World/Cow.h` extends `Animal`, declares `getBreedOffspring`
- `Minecraft.World/Cow.cpp` has passive AI goals, milking interaction, and loot drops
- `Minecraft.World/EntityIO.cpp` for registration at ID 92 with spawn egg colors
- `Minecraft.Client/EntityRenderDispatcher.cpp` has `CowRenderer` with `CowModel`

## Complete Example: Projectile

Check out the `Arrow` implementation:
- `Minecraft.World/Arrow.h` extends `Entity` directly, has three constructors (save load, mob shot, position)
- `Minecraft.World/Arrow.cpp` has full `tick()` with movement, block collision, entity collision, and pickup
- `Minecraft.World/EntityIO.cpp` for registration at ID 10 (no spawn egg since it's not a mob)

## All Registered Entity IDs

Here is every entity registered in `EntityIO::staticCtor()`:

| ID | String ID | eINSTANCEOF | Has Spawn Egg |
|---|---|---|---|
| 1 | `Item` | `eTYPE_ITEMENTITY` | No |
| 2 | `XPOrb` | `eTYPE_EXPERIENCEORB` | No |
| 9 | `Painting` | `eTYPE_PAINTING` | No |
| 10 | `Arrow` | `eTYPE_ARROW` | No |
| 11 | `Snowball` | `eTYPE_SNOWBALL` | No |
| 12 | `Fireball` | `eTYPE_FIREBALL` | No |
| 13 | `SmallFireball` | `eTYPE_SMALL_FIREBALL` | No |
| 14 | `ThrownEnderpearl` | `eTYPE_THROWNENDERPEARL` | No |
| 15 | `EyeOfEnderSignal` | `eTYPE_EYEOFENDERSIGNAL` | No |
| 16 | `ThrownPotion` | `eTYPE_THROWNPOTION` | No |
| 17 | `ThrownExpBottle` | `eTYPE_THROWNEXPBOTTLE` | No |
| 18 | `ItemFrame` | `eTYPE_ITEM_FRAME` | No |
| 20 | `PrimedTnt` | `eTYPE_PRIMEDTNT` | No |
| 21 | `FallingSand` | `eTYPE_FALLINGTILE` | No |
| 40 | `Minecart` | `eTYPE_MINECART` | No |
| 41 | `Boat` | `eTYPE_BOAT` | No |
| 48 | `Mob` | `eTYPE_MOB` | No |
| 49 | `Monster` | `eTYPE_MONSTER` | No |
| 50 | `Creeper` | `eTYPE_CREEPER` | Yes |
| 51 | `Skeleton` | `eTYPE_SKELETON` | Yes |
| 52 | `Spider` | `eTYPE_SPIDER` | Yes |
| 53 | `Giant` | `eTYPE_GIANT` | No |
| 54 | `Zombie` | `eTYPE_ZOMBIE` | Yes |
| 55 | `Slime` | `eTYPE_SLIME` | Yes |
| 56 | `Ghast` | `eTYPE_GHAST` | Yes |
| 57 | `PigZombie` | `eTYPE_PIGZOMBIE` | Yes |
| 58 | `Enderman` | `eTYPE_ENDERMAN` | Yes |
| 59 | `CaveSpider` | `eTYPE_CAVESPIDER` | Yes |
| 60 | `Silverfish` | `eTYPE_SILVERFISH` | Yes |
| 61 | `Blaze` | `eTYPE_BLAZE` | Yes |
| 62 | `LavaSlime` | `eTYPE_LAVASLIME` | Yes |
| 63 | `EnderDragon` | `eTYPE_ENDERDRAGON` | No |
| 90 | `Pig` | `eTYPE_PIG` | Yes |
| 91 | `Sheep` | `eTYPE_SHEEP` | Yes |
| 92 | `Cow` | `eTYPE_COW` | Yes |
| 93 | `Chicken` | `eTYPE_CHICKEN` | Yes |
| 94 | `Squid` | `eTYPE_SQUID` | Yes |
| 95 | `Wolf` | `eTYPE_WOLF` | Yes |
| 96 | `MushroomCow` | `eTYPE_MUSHROOMCOW` | Yes |
| 97 | `SnowMan` | `eTYPE_SNOWMAN` | No |
| 98 | `Ozelot` | `eTYPE_OZELOT` | Yes |
| 99 | `VillagerGolem` | `eTYPE_VILLAGERGOLEM` | No |
| 120 | `Villager` | `eTYPE_VILLAGER` | Yes |
| 200 | `EnderCrystal` | `eTYPE_ENDER_CRYSTAL` | No |
| 1000 | `DragonFireball` | `eTYPE_DRAGON_FIREBALL` | No |
