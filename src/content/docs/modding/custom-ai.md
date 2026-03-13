---
title: Custom AI Behaviors
description: How the Goal system works and how to write custom mob AI in LCE.
---

Every mob in LCE that uses the new AI system (`useNewAi()` returns `true`) gets its behavior from **Goals**. A Goal is just a class that says "can I run right now?" and then does stuff every tick while it's active. The engine picks which goals to run based on priority and what they conflict with.

This page covers how the whole system works, all the built-in goals, and how to write your own.

## How The Goal System Works

Every `Mob` has two `GoalSelector` instances:

- **`goalSelector`** handles movement and actions (walking, attacking, looking around, eating)
- **`targetSelector`** handles picking who to attack

Both work the same way. You register goals with a priority number, and the selector figures out which ones can run at the same time.

### GoalSelector Tick Loop

Every tick, the `GoalSelector` does this:

1. Every 3 ticks (controlled by `newGoalRate`), it goes through all registered goals
2. For each goal that's currently running: check if it should stop (via `canContinueToUse()` or system conflicts)
3. For each goal that's not running: check if it can start (`canUse()` and no system conflicts)
4. Call `start()` on anything new
5. Call `tick()` on everything that's active

On the 2 ticks between full checks, it only checks `canContinueToUse()` on already-running goals and stops any that return `false`.

### Priority

Lower number = higher priority. A goal with priority 0 beats a goal with priority 5.

When a higher-priority goal wants to start, it can kick out lower-priority goals, but only if the lower-priority goal's `canInterrupt()` returns `true` (which it does by default).

```cpp
goalSelector.addGoal(0, new FloatGoal(this));           // Most important
goalSelector.addGoal(1, new MeleeAttackGoal(this, 1.0, true));
goalSelector.addGoal(2, new RandomStrollGoal(this, 1.0));
goalSelector.addGoal(3, new LookAtPlayerGoal(this, typeid(Player), 8));  // Least important
```

### Control Flags (Mutex)

Goals declare which "control channels" they need using `setRequiredControlFlags()`. Two goals can run at the same time only if their flags don't overlap. The flags are defined in `Control.h`:

```cpp
class Control
{
public:
    static const int MoveControlFlag = 1;  // Bit 0: movement
    static const int LookControlFlag = 2;  // Bit 1: head rotation
    static const int JumpControlFlag = 4;  // Bit 2: jumping
};
```

The co-existence check is a simple bitwise AND:

```cpp
bool GoalSelector::canCoExist(InternalGoal *goalA, InternalGoal *goalB)
{
    return (goalA->goal->getRequiredControlFlags() &
            goalB->goal->getRequiredControlFlags()) == 0;
}
```

So a goal using `MoveControlFlag` can run alongside a goal using `JumpControlFlag`, but two goals that both need `MoveControlFlag` cannot. If they have the same priority though, the system won't interrupt the one that's already running.

Here's what various built-in goals use:

| Goal | Flags |
|------|-------|
| `FloatGoal` | Jump |
| `PanicGoal` | Move |
| `RandomStrollGoal` | Move + Look |
| `MeleeAttackGoal` | Move + Look |
| `LookAtPlayerGoal` | Look |
| `LeapAtTargetGoal` | Jump + Move |
| `TemptGoal` | Move + Look |
| `EatTileGoal` | Move + Look + Jump |
| `ControlledByPlayerGoal` | Move + Look + Jump |

Target goals use a separate flag (`TargetGoal::TargetFlag = 1`) so they don't conflict with movement goals. Since target goals go in `targetSelector` (a separate `GoalSelector`), they only compete with each other.

## The Goal Base Class

Every goal extends this:

```cpp
class Goal
{
protected:
    Goal();

public:
    virtual ~Goal() {}
    virtual bool canUse() = 0;        // Can this goal start? (pure virtual)
    virtual bool canContinueToUse();   // Should it keep running? (defaults to canUse())
    virtual bool canInterrupt();       // Can higher-priority goals stop this? (defaults to true)
    virtual void start();              // Called once when the goal begins
    virtual void stop();               // Called once when the goal ends
    virtual void tick();               // Called every tick while active
    virtual void setRequiredControlFlags(int flags);
    virtual int getRequiredControlFlags();
};
```

The only method you **must** override is `canUse()`. Everything else has a default.

### Lifecycle

1. **`canUse()`** returns `true` -> the goal is eligible to start
2. **`start()`** is called once
3. **`tick()`** is called every tick
4. **`canContinueToUse()`** is checked periodically. If it returns `false`...
5. **`stop()`** is called once, and the goal goes dormant

## All Built-in Goals

### Movement / Action Goals

These go in `goalSelector`.

| Goal | What It Does |
|------|-------------|
| `FloatGoal` | Jumps when in water or lava to stay afloat |
| `PanicGoal` | Runs to a random spot when hurt or on fire |
| `RandomStrollGoal` | Wanders to a random nearby position |
| `RandomLookAroundGoal` | Looks in a random direction while idle |
| `LookAtPlayerGoal` | Stares at a nearby player (or other entity type) |
| `InteractGoal` | Like `LookAtPlayerGoal` but for specific entity types with higher chance |
| `MeleeAttackGoal` | Paths to the target and punches it |
| `LeapAtTargetGoal` | Jumps at the current target (wolf pounce) |
| `AvoidPlayerGoal` | Runs away from a specific entity type |
| `FleeSunGoal` | Finds shade when the sun is out (skeletons) |
| `RestrictSunGoal` | Restricts pathfinding to avoid sunlit areas |
| `BreakDoorGoal` | Breaks down doors (zombie on hard mode) |
| `OpenDoorGoal` | Opens and closes doors |
| `DoorInteractGoal` | Base class for door goals |
| `MoveIndoorsGoal` | Walks inside the nearest building |
| `MoveThroughVillageGoal` | Patrols through village paths |
| `MoveTowardsRestrictionGoal` | Returns to a home position when too far away |
| `MoveTowardsTargetGoal` | Walks toward the mob's current target |
| `FollowOwnerGoal` | Follows the owner, teleports if too far (wolves, cats) |
| `FollowParentGoal` | Baby animals follow their parent |
| `TemptGoal` | Follows a player holding a specific item (wheat, fish, etc.) |
| `BreedGoal` | Finds a partner and makes babies |
| `EatTileGoal` | Eats grass (sheep) |
| `BegGoal` | Wolf tilts head when player holds food |
| `SitGoal` | Sits when told to (tameable animals) |
| `SwellGoal` | Creeper inflates when near a target |
| `OfferFlowerGoal` | Iron golem holds out a flower to villager kids |
| `TakeFlowerGoal` | Villager kid takes flower from iron golem |
| `PlayGoal` | Villager kids running around |
| `MakeLoveGoal` | Villagers make new villagers |
| `TradeWithPlayerGoal` | Villager looks at the player who's trading with them |
| `LookAtTradingPlayerGoal` | Same idea but from the trading screen |
| `OcelotSitOnTileGoal` | Cat sits on beds and furnaces |
| `OcelotAttackGoal` | Ocelot's sneaky attack pattern |
| `RunAroundLikeCrazyGoal` | Untamed horse bucks the player off |
| `ControlledByPlayerGoal` | Player steering a saddled pig |
| `RestrictOpenDoorGoal` | Prevents pathing through open doors |
| `RangedAttackGoal` | Shoots projectiles (skeletons, snow golems, witches) |

### Target Goals

These go in `targetSelector` and decide **who** to attack. They all extend `TargetGoal`.

| Goal | What It Does |
|------|-------------|
| `HurtByTargetGoal` | Targets whatever just hurt this mob. Can alert nearby mobs of the same type |
| `NearestAttackableTargetGoal` | Finds the closest entity of a specific type within range |
| `DefendVillageTargetGoal` | Iron golem targets whoever is attacking the village |
| `OwnerHurtByTargetGoal` | Tamed animal targets whatever hurt its owner |
| `OwnerHurtTargetGoal` | Tamed animal targets whatever its owner just hit |
| `NonTameRandomTargetGoal` | Wild animal randomly targets a specific type (wild wolf vs sheep) |

## Writing a Custom Goal

Let's say you want a mob that guards a specific area and charges at intruders. Here's the full process.

### Step 1: Header

```cpp
#pragma once
#include "Goal.h"

class PathfinderMob;

class GuardAreaGoal : public Goal
{
private:
    PathfinderMob *mob;
    double guardX, guardY, guardZ;
    double guardRadius;
    double speedModifier;
    weak_ptr<LivingEntity> intruder;
    int scanCooldown;

public:
    GuardAreaGoal(PathfinderMob *mob, double gx, double gy, double gz,
                  double radius, double speed);

    virtual bool canUse();
    virtual bool canContinueToUse();
    virtual void start();
    virtual void stop();
    virtual void tick();
};
```

### Step 2: Implementation

```cpp
#include "stdafx.h"
#include "net.minecraft.world.entity.h"
#include "net.minecraft.world.entity.ai.control.h"
#include "net.minecraft.world.entity.ai.navigation.h"
#include "net.minecraft.world.entity.player.h"
#include "net.minecraft.world.level.h"
#include "net.minecraft.world.phys.h"
#include "GuardAreaGoal.h"

GuardAreaGoal::GuardAreaGoal(PathfinderMob *mob, double gx, double gy,
                             double gz, double radius, double speed)
{
    this->mob = mob;
    this->guardX = gx;
    this->guardY = gy;
    this->guardZ = gz;
    this->guardRadius = radius;
    this->speedModifier = speed;
    this->scanCooldown = 0;

    // This goal controls both movement and head direction
    setRequiredControlFlags(Control::MoveControlFlag | Control::LookControlFlag);
}

bool GuardAreaGoal::canUse()
{
    // Only scan every 10 ticks to save performance
    if (--scanCooldown > 0) return false;
    scanCooldown = 10;

    // Look for a player inside our guard radius
    shared_ptr<Player> nearest = mob->level->getNearestPlayer(
        mob->shared_from_this(), guardRadius);

    if (nearest == nullptr) return false;

    // Check they're actually inside the guarded zone
    double dx = nearest->x - guardX;
    double dz = nearest->z - guardZ;
    if (dx * dx + dz * dz > guardRadius * guardRadius) return false;

    intruder = weak_ptr<LivingEntity>(nearest);
    return true;
}

bool GuardAreaGoal::canContinueToUse()
{
    shared_ptr<LivingEntity> target = intruder.lock();
    if (target == nullptr) return false;
    if (!target->isAlive()) return false;

    // Stop chasing if we get too far from the guard point
    double dx = mob->x - guardX;
    double dz = mob->z - guardZ;
    if (dx * dx + dz * dz > guardRadius * guardRadius * 4) return false;

    return true;
}

void GuardAreaGoal::start()
{
    // Begin pathfinding to the intruder
    mob->getNavigation()->moveTo(intruder.lock(), speedModifier);
}

void GuardAreaGoal::stop()
{
    intruder = weak_ptr<LivingEntity>();
    mob->getNavigation()->stop();
}

void GuardAreaGoal::tick()
{
    shared_ptr<LivingEntity> target = intruder.lock();
    if (target == nullptr) return;

    // Look at the intruder
    mob->getLookControl()->setLookAt(target, 30, 30);

    // Re-path every so often
    if (mob->getNavigation()->isDone())
    {
        mob->getNavigation()->moveTo(target, speedModifier);
    }
}
```

### Step 3: Register It

In your mob's constructor, add it to the goal selector:

```cpp
MyGuardMob::MyGuardMob(Level *level) : Monster(level)
{
    this->defineSynchedData();
    registerAttributes();
    setHealth(getMaxHealth());

    goalSelector.addGoal(0, new FloatGoal(this));
    goalSelector.addGoal(1, new GuardAreaGoal(this, spawnX, spawnY, spawnZ, 16.0, 1.2));
    goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.0, true));
    goalSelector.addGoal(3, new MoveTowardsRestrictionGoal(this, 0.8));
    goalSelector.addGoal(4, new RandomStrollGoal(this, 0.6));
    goalSelector.addGoal(5, new LookAtPlayerGoal(this, typeid(Player), 8));
    goalSelector.addGoal(6, new RandomLookAroundGoal(this));

    targetSelector.addGoal(1, new HurtByTargetGoal(this, false));
}
```

## Target Goals vs Movement Goals

This is a common point of confusion, so let's be clear about the two selectors.

**`targetSelector`** only decides *who* the mob wants to attack. It sets the mob's target via `mob->setTarget()`. The goals here should extend `TargetGoal` and use `TargetGoal::TargetFlag` as their control flag.

**`goalSelector`** handles everything else: moving, attacking, looking, eating, sitting, etc. Combat goals like `MeleeAttackGoal` read the target that was set by the target selector and then handle actually walking over and hitting them.

This split means you can change targeting logic without touching attack logic, and the other way around. For example, the Wolf has:

```cpp
// Target selection: who should I fight?
targetSelector.addGoal(1, new OwnerHurtByTargetGoal(this));   // Defend my owner
targetSelector.addGoal(2, new OwnerHurtTargetGoal(this));     // Attack what my owner attacks
targetSelector.addGoal(3, new HurtByTargetGoal(this, true));  // Fight back if hit
targetSelector.addGoal(4, new NonTameRandomTargetGoal(this, typeid(Sheep), 200, false)); // Hunt sheep

// Action: how do I fight?
goalSelector.addGoal(3, new LeapAtTargetGoal(this, 0.4));     // Pounce
goalSelector.addGoal(4, new MeleeAttackGoal(this, 1.0, true)); // Bite
```

The target goals pick the enemy. The action goals do the actual fighting.

## Custom Pathfinding Logic

Most goals use the mob's `PathNavigation` to get around. Here are the key methods:

```cpp
// Move to a position
mob->getNavigation()->moveTo(double x, double y, double z, double speed);

// Move to an entity (auto-updates the destination)
mob->getNavigation()->moveTo(shared_ptr<Entity> target, double speed);

// Create a path without starting to walk it
Path *path = mob->getNavigation()->createPath(shared_ptr<Entity> target);
Path *path = mob->getNavigation()->createPath(double x, double y, double z);

// Start walking a pre-built path
mob->getNavigation()->moveTo(Path *path, double speed);

// Stop all movement
mob->getNavigation()->stop();

// Check if the mob has finished its current path
bool done = mob->getNavigation()->isDone();

// Navigation settings
mob->getNavigation()->setCanOpenDoors(true);
mob->getNavigation()->setAvoidWater(true);
mob->getNavigation()->setCanFloat(true);
mob->getNavigation()->setSpeedModifier(1.5);
```

For finding random positions (used by wander and panic goals), there's a utility class:

```cpp
// Random position within range
Vec3 *pos = RandomPos::getPos(shared_ptr<PathfinderMob> mob, int xzRange, int yRange);

// Random position biased toward a specific point
Vec3 *pos = RandomPos::getPosTowards(shared_ptr<PathfinderMob> mob,
    int xzRange, int yRange, Vec3 *towards);

// Random position away from a specific point
Vec3 *pos = RandomPos::getPosAvoid(shared_ptr<PathfinderMob> mob,
    int xzRange, int yRange, Vec3 *avoid);
```

These all return `nullptr` if they can't find a valid spot, so always check.

### Restriction System

Mobs can have a "home" point and a radius they shouldn't wander past:

```cpp
// Set a home point
mob->restrictTo(x, y, z, radius);

// Check if the mob is within its restriction zone
mob->isWithinRestriction();
mob->isWithinRestriction(x, y, z);

// Get the home point
Pos *home = mob->getRestrictCenter();
```

`MoveTowardsRestrictionGoal` uses this to make mobs return home when they stray too far. The Iron Golem uses it to stay near its village.

## Common Patterns

### Making a Mob Flee From Something

Use `AvoidPlayerGoal`. Despite the name, it works for any entity type:

```cpp
// Run from creepers. 8 block detection range, walk speed 1.0, sprint speed 1.2
goalSelector.addGoal(1, new AvoidPlayerGoal(this, typeid(Creeper), 8.0f, 1.0, 1.2));
```

It finds the nearest entity of that type, picks a random position *away* from it, and runs there. When the entity gets close (within 7 blocks), the mob switches to the sprint speed.

For custom flee logic, look at `PanicGoal` as a simpler template. It just picks a random spot and runs when hurt:

```cpp
bool PanicGoal::canUse()
{
    if (mob->getLastHurtByMob() == nullptr && !mob->isOnFire()) return false;
    const Vec3 *pos = RandomPos::getPos(
        dynamic_pointer_cast<PathfinderMob>(mob->shared_from_this()), 5, 4);
    if (pos == nullptr) return false;
    posX = pos->x;
    posY = pos->y;
    posZ = pos->z;
    return true;
}
```

### Making a Mob Follow Players

Use `TemptGoal` if you want the mob to follow a player holding a specific item:

```cpp
// Follow players holding wheat at speed 0.25
goalSelector.addGoal(3, new TemptGoal(this, 0.25, Item::wheat_Id, false));
```

The last parameter (`canScare`) makes the mob stop following if the player moves too quickly while close.

For a pet that always follows its owner, use `FollowOwnerGoal`:

```cpp
// Follow owner, start at 10 blocks, stop at 2 blocks, teleport at 12+
goalSelector.addGoal(5, new FollowOwnerGoal(this, 1.0, 10, 2));
```

This also handles teleporting the pet to the owner when pathfinding fails and they're far away.

### Making a Mob Guard an Area

Combine `MoveTowardsRestrictionGoal` with the restriction system:

```cpp
// In constructor
mob->restrictTo(homeX, homeY, homeZ, 16);
goalSelector.addGoal(4, new MoveTowardsRestrictionGoal(this, 1.0));
```

The mob will wander freely within 16 blocks of home, but always drift back if it strays. Pair this with an attack goal and a target goal for a full guard setup.

The Iron Golem does exactly this, with `DefendVillageTargetGoal` picking village attackers as targets.

### Combining Multiple Behaviors

The trick is getting the priorities right. Here's how the Wolf layers its behaviors:

```cpp
goalSelector.addGoal(1, new FloatGoal(this));              // Don't drown
goalSelector.addGoal(2, sitGoal, false);                   // Obey sit command
goalSelector.addGoal(3, new LeapAtTargetGoal(this, 0.4));  // Pounce at enemies
goalSelector.addGoal(4, new MeleeAttackGoal(this, 1.0, true));  // Bite enemies
goalSelector.addGoal(5, new FollowOwnerGoal(this, 1.0, 10, 2)); // Follow owner
goalSelector.addGoal(6, new BreedGoal(this, 1.0));         // Make puppies
goalSelector.addGoal(7, new RandomStrollGoal(this, 1.0));  // Wander
goalSelector.addGoal(8, new BegGoal(this, 8));             // Tilt head at food
goalSelector.addGoal(9, new LookAtPlayerGoal(this, typeid(Player), 8)); // Look around
goalSelector.addGoal(9, new RandomLookAroundGoal(this));   // Look around randomly
```

Notice that two goals can share the same priority (9 here). They'll coexist as long as their control flags don't overlap.

The general pattern for priority ordering:

1. **Survival** (floating, panic) at the top
2. **Owner commands** (sit) right after
3. **Combat** (attack, leap) in the middle
4. **Social** (follow owner, breed, tempt) below combat
5. **Idle** (wander, look around) at the bottom

### Same Priority Trick

The Zombie registers two `MeleeAttackGoal` instances at different priorities:

```cpp
goalSelector.addGoal(2, new MeleeAttackGoal(this, eTYPE_PLAYER, 1.0, false));
goalSelector.addGoal(3, new MeleeAttackGoal(this, eTYPE_VILLAGER, 1.0, true));
```

The first one only activates when the target is a Player (checked via the `attackType` filter). The second only activates for Villagers. Since they're at different priorities, the zombie prefers attacking players over villagers. This is a clean way to handle multiple attack preferences without writing a custom goal.

## Writing a Custom Target Goal

Target goals extend `TargetGoal` instead of `Goal` directly. The base class gives you:

- `canAttack(target, allowInvulnerable)` to check if a target is valid (alive, reachable, visible, not an ally)
- `getFollowDistance()` to get the mob's follow range attribute
- Automatic tracking of unseen targets (remembers them for 60 ticks)
- Reach caching so pathfinding checks don't run every tick

Here's a simple target goal that targets any mob below half health (a "vulture" behavior):

```cpp
#pragma once
#include "TargetGoal.h"

class TargetWeakenedMobGoal : public TargetGoal
{
private:
    weak_ptr<LivingEntity> target;

public:
    TargetWeakenedMobGoal(PathfinderMob *mob)
        : TargetGoal(mob, true, false)  // mustSee=true, mustReach=false
    {
        setRequiredControlFlags(TargetGoal::TargetFlag);
    }

    bool canUse()
    {
        double range = getFollowDistance();
        vector<shared_ptr<Entity>> *entities = mob->level->getEntitiesOfClass(
            typeid(LivingEntity),
            mob->bb->grow(range, 4, range),
            nullptr);

        if (entities == nullptr || entities->empty())
        {
            delete entities;
            return false;
        }

        // Find the weakest mob
        shared_ptr<LivingEntity> weakest = nullptr;
        for (auto &e : *entities)
        {
            shared_ptr<LivingEntity> le = dynamic_pointer_cast<LivingEntity>(e);
            if (le == nullptr) continue;
            if (le->getHealth() > le->getMaxHealth() * 0.5f) continue;
            if (!canAttack(le, false)) continue;
            weakest = le;
            break;
        }

        delete entities;
        if (weakest == nullptr) return false;
        target = weak_ptr<LivingEntity>(weakest);
        return true;
    }

    void start()
    {
        mob->setTarget(target.lock());
        TargetGoal::start();
    }
};
```

## Tips

- Always clean up `Path*` pointers. The navigation system allocates them with `new`, and your goal owns them after calling `createPath()`. Delete them in your destructor and when replacing them.
- Use `weak_ptr<Entity>` for target references. Entities can die or get removed at any time. Holding a `shared_ptr` keeps dead entities in memory.
- Keep `canUse()` cheap. It runs every 3 ticks for every registered goal on every mob. Add cooldown counters if you need expensive checks.
- `canContinueToUse()` defaults to calling `canUse()`. Override it with a simpler check when possible, since it runs more often.
- Test priority ordering carefully. If two goals fight over the same control flags, the one with the higher priority (lower number) always wins.
- Use `mob->getSensing()->canSee(target)` for line-of-sight checks rather than rolling your own.
