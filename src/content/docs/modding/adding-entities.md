---
title: Adding Entities
description: Step-by-step guide to adding new entities to LCEMP.
---

This guide walks you through creating a new mob entity in LCEMP. We'll cover the class hierarchy, registration, AI goals, synched data, spawning rules, and client-side rendering.

## Entity Class Hierarchy

Every entity in LCEMP inherits from `Entity` (`Minecraft.World/Entity.h`). Here's the full mob hierarchy:

```
Entity
└── Mob                    # Health, AI, effects, equipment
    └── PathfinderMob      # Pathfinding, attack targets
        ├── Monster        # Hostile mobs (burns in daylight, dark spawn checks)
        │   ├── Zombie
        │   ├── Skeleton
        │   ├── Creeper
        │   └── ...
        └── AgableMob      # Baby/adult system, breeding
            └── Animal     # Passive mobs (food, love mode, despawn protection)
                ├── Cow
                ├── Pig
                ├── Sheep
                └── TamableAnimal  # Taming, sitting, owner
                    ├── Wolf
                    └── Ozelot
```

Pick whichever base class matches the behavior you want:

| Base Class | Use When |
|-----------|----------|
| `Monster` | Hostile mob that attacks players, spawns in the dark |
| `Animal` | Passive mob that can breed, follows food items |
| `TamableAnimal` | Animal that can be tamed and owned by a player |
| `PathfinderMob` | Neutral mob with pathfinding but no breeding/hostility |
| `Mob` | Non-pathfinding mob (e.g., water creatures) |

## Step 1: Add an eINSTANCEOF Type

LCEMP uses an `eINSTANCEOF` enum instead of C++ `dynamic_cast` to identify entity types at runtime. Add a new entry to the enum in `Minecraft.World/Definitions.h` (or wherever the full enum is defined):

```cpp
// In the eINSTANCEOF enum
eTYPE_MY_MOB,
```

Every entity class overrides `GetType()` to return its enum value. This is how the engine does type checks without `dynamic_cast`:

```cpp
eINSTANCEOF GetType() { return eTYPE_MY_MOB; }
```

## Step 2: Create the Mob Class

Here's a hostile mob example based on how `Zombie` is set up:

### Header (`Minecraft.World/MyMob.h`)

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

### Implementation (`Minecraft.World/MyMob.cpp`)

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

For a **passive mob** (like a Cow), extend `Animal` and use passive goals instead:

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

## Step 4: Synched Entity Data

`SynchedEntityData` keeps mob state in sync between server and client. Data items are defined with typed IDs:

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

`Zombie` uses IDs 12-14 (baby, villager, converting). `Creeper` uses 16-17 (swell direction, powered). `Wolf` uses 18-20 (health, interested, collar color). Pick IDs that don't collide with your parent class chain.

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

## Step 5: Register with EntityIO

In `Minecraft.World/EntityIO.cpp`, add your mob to `EntityIO::staticCtor()`:

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

The `setId` function registers your mob in five maps at once:

| Map | Key | Value |
|-----|-----|-------|
| `idCreateMap` | String ID (`L"MyMob"`) | Factory function |
| `classIdMap` | `eINSTANCEOF` | String ID |
| `numCreateMap` | Numeric ID (`110`) | Factory function |
| `numClassMap` | Numeric ID | `eINSTANCEOF` |
| `classNumMap` | `eINSTANCEOF` | Numeric ID |

The six-argument version also adds the mob to `idsSpawnableInCreative` for the spawn egg UI. Numeric IDs follow vanilla conventions: monsters are 50-63, animals are 90-99.

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

LCEMP has console-specific spawn limits defined in `MobCategory.h`:

| Category | Hard Limit | With Breeding | With Spawn Egg |
|----------|-----------|---------------|----------------|
| `monster` | 50 | N/A | 70 |
| `creature` | 50 | 70 | 90 |
| `waterCreature` | 5 | N/A | 13 |
| `creature_chicken` | 8 | 16 | 26 |
| `creature_wolf` | 8 | 16 | 26 |
| `creature_mushroomcow` | 2 | 22 | 30 |

### canSpawn() Override

Hostile mobs (`Monster`) check light level and sky access through `isDarkEnoughToSpawn()` and `canSpawn()`. Passive mobs (`Animal`) look for grass blocks and light level. Override `canSpawn()` if you want custom spawn conditions:

```cpp
bool MyMob::canSpawn()
{
    // Example: only spawn above Y=60
    return y > 60 && Monster::canSpawn();
}
```

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

### Texture Registration

Set `textureIdx` in your mob's constructor to a texture name constant (defined in `Textures.h`). Add your texture constant and load the actual texture in the client's texture system.

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
