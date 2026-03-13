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

### GoalSelector internals

The `GoalSelector` wraps each goal in an `InternalGoal` struct that stores three things:

- `prio`: the priority number (lower = more important)
- `goal`: pointer to the `Goal` instance
- `canDeletePointer`: whether the selector owns the memory and should delete it on cleanup (4J addition, defaults to `true`)

Two lists track goals:

- `goals`: every registered goal
- `usingGoals`: only the goals that are currently running

The `canDeletePointer` flag matters when a goal is shared. For example, the Wolf stores its `SitGoal` as a member variable so it can call `sitGoal->wantToSit()` from outside the AI system. In that case you'd pass `false` to `addGoal()` so the selector doesn't try to delete a pointer that the mob still needs.

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
| `SitGoal` | Jump + Move |
| `ArrowAttackGoal` | Move + Look |
| `AvoidPlayerGoal` | Move |
| `BreedGoal` | Move + Look |
| `FollowOwnerGoal` | Move + Look |
| `OfferFlowerGoal` | Move + Look |
| `BegGoal` | Look |

Target goals use a separate flag (`TargetGoal::TargetFlag = 1`) so they don't conflict with movement goals. Since target goals go in `targetSelector` (a separate `GoalSelector`), they only compete with each other.

### The `canUseInSystem` check

This is the core of goal arbitration. When a goal wants to start, the selector runs `canUseInSystem()` against every currently active goal:

1. For each **higher-priority** active goal (lower number): if `canCoExist()` returns false (flags overlap), the candidate is blocked. It can't interrupt something more important.
2. For each **lower-priority** active goal (higher number): if the lower-priority goal's `canInterrupt()` returns false, the candidate is blocked. Some goals refuse to be interrupted.

If the candidate passes all checks, it can start. Any lower-priority goals whose flags conflict get their `stop()` called and are removed from `usingGoals`.

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
| `ArrowAttackGoal` | Ranged attack with arrows or snowballs |
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
| `OzelotAttackGoal` | Ocelot's sneaky attack pattern |
| `ControlledByPlayerGoal` | Player steering a saddled pig |
| `RestrictOpenDoorGoal` | Prevents pathing through open doors |

For detailed constructor parameters, control flags, and behavior specifics for every single goal, see the [AI & Goals reference](/world/ai-goals/).

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

## The Pathfinding System

Goals don't move mobs directly. They call into the navigation and control systems which handle the actual movement. Understanding these systems is important for writing goals that move around.

### PathNavigation

Every `Mob` with pathfinding has a `PathNavigation` instance. This is the main interface goals use to move the mob.

**Constructor:** `PathNavigation(Mob *mob, Level *level, float maxDist)`

The `maxDist` parameter sets the maximum pathfinding range. If the destination is farther than this, pathfinding won't even try.

#### Navigation settings

| Method | Default | What it does |
|---|---|---|
| `setAvoidWater(bool)` | varies | If true, paths won't go through water |
| `setCanOpenDoors(bool)` | false | If true, paths can go through closed doors |
| `setCanPassDoors(bool)` | varies | If true, paths can go through open doors |
| `setAvoidSun(bool)` | false | If true, trims paths to avoid sunlit blocks |
| `setCanFloat(bool)` | varies | If true, allows paths through water (for swimming mobs) |
| `setSpeed(float)` | varies | Base movement speed multiplier |

#### Key methods

```cpp
// Move to a position
mob->getNavigation()->moveTo(double x, double y, double z, float speed);

// Move to an entity (auto-updates the destination)
mob->getNavigation()->moveTo(shared_ptr<Mob> target, float speed);

// Create a path without starting to walk it
Path *path = mob->getNavigation()->createPath(shared_ptr<Mob> target);
Path *path = mob->getNavigation()->createPath(double x, double y, double z);

// Start walking a pre-built path
mob->getNavigation()->moveTo(Path *path, float speed);

// Stop all movement
mob->getNavigation()->stop();

// Check if the mob has finished its current path
bool done = mob->getNavigation()->isDone();
```

#### Stuck detection

The navigation system has built-in stuck detection. Every 100 ticks, it checks if the mob has moved at least 1.5 blocks from its last check position. If the mob hasn't moved enough, the path is considered stuck and gets cleared. This prevents mobs from walking into walls forever.

The waypoint radius (how close the mob needs to get to a path node before moving on to the next one) is based on `bbWidth * 0.5f`. Wider mobs have bigger waypoint radii.

#### Sun trimming

When `avoidSun` is true, the navigation trims the end of any path that passes through blocks exposed to direct sunlight. This is how skeletons stop short of sunlit areas.

### PathFinder (A* algorithm)

Under the hood, `PathNavigation` uses a `PathFinder` that implements A* pathfinding.

**Constructor:** `PathFinder(LevelSource *level, bool canPassDoors, bool canOpenDoors, bool avoidWater, bool canFloat)`

The pathfinder uses:
- A `BinaryHeap` as the open set (priority queue for the A* frontier)
- An `unordered_map<int, Node*>` for all visited nodes (using a hash key based on block coordinates)
- A `NodeArray` for neighbor lookups

#### Node types

Each block in the pathfinding grid gets a type that determines traversability:

| Constant | Value | Meaning |
|---|---|---|
| `TYPE_TRAP` | -4 | Dangerous block (fire, cactus). Avoided but passable. |
| `TYPE_FENCE` | -3 | Fence or wall. Not passable. |
| `TYPE_LAVA` | -2 | Lava. Not passable unless the mob is immune. |
| `TYPE_WATER` | -1 | Water. Passable if `canFloat` or not `avoidWater`. |
| `TYPE_BLOCKED` | 0 | Solid block. Not passable. |
| `TYPE_OPEN` | 1 | Air above solid ground. Passable. |
| `TYPE_WALKABLE` | 2 | Walkable surface. Passable. |

The `isFree()` method classifies blocks into these types. It checks multiple blocks for the entity's full bounding box since large mobs need more than one block of clearance.

#### Path results

The A* search returns a `Path` object containing an ordered list of `Node` positions. Goals that create paths own the memory and need to delete them when they're done. The navigation system also manages its own path and handles cleanup internally.

### Control Objects

Goals don't set mob velocity directly. Instead they talk to control objects that handle smooth movement and rotation each tick.

#### MoveControl

Handles forward movement toward a target position.

| | |
|---|---|
| **Constants** | `MIN_SPEED = 0.0005f` (below this, the mob stops), `MAX_TURN = 30` degrees per tick |
| **Key method** | `setWantedPosition(x, y, z, speed)` |
| **Tick behavior** | Calculates direction to the wanted position, smoothly rotates using `rotlerp` (limited to `MAX_TURN` degrees per tick), applies forward speed. When the target Y is above the mob, triggers a jump automatically. |

#### LookControl

Handles head rotation toward a target.

| | |
|---|---|
| **Key methods** | `setLookAt(entity, yMax, xMax)` or `setLookAt(x, y, z, yMax, xMax)` |
| **Parameters** | `yMax`: max Y rotation per tick, `xMax`: max X (pitch) rotation per tick |
| **Tick behavior** | Smoothly rotates the head toward the look target within the rotation limits |

#### JumpControl

Simple jump trigger.

| | |
|---|---|
| **Key method** | `jump()` sets a flag |
| **Tick behavior** | If the flag is set, calls the mob's jump method and clears the flag |

#### BodyControl

Handles body rotation to match head direction over time. The body gradually rotates toward wherever the head is looking.

#### Sensing

Caches line-of-sight results per tick for performance.

| | |
|---|---|
| **Key method** | `canSee(entity)` |
| **Caching** | Maintains `seen` and `unseen` vectors. Results are cached for the current tick. Both vectors are cleared at the start of each new tick. |

Always use `mob->getSensing()->canSee(target)` in your goals instead of doing manual raycasts. Multiple goals checking the same target in the same tick will reuse the cached result.

### RandomPos utility

Many goals need to pick a random position. The `RandomPos` class has three methods for this:

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

4J added a `quadrant` parameter to `getPos()` for directed wandering (used by the animal despawn detection system). All methods return `nullptr` if they can't find a valid spot, so always check.

The internal `generateRandomPos()` method tries 10 random positions and picks the one with the best `getWalkTargetValue()` score. This means mobs tend to wander toward "nice" areas. For passive mobs, grassy well-lit areas score higher. For hostile mobs, dark areas score higher.

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

It finds the nearest entity of that type, picks a random position *away* from it using `RandomPos::getPosAvoid()`, and runs there. When the entity gets close (within 7 blocks), the mob switches from `walkSpeed` to `sprintSpeed`.

For tamed animals, the goal automatically skips players since the pet shouldn't flee from people.

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

The last parameter (`canScare`) makes the mob stop following if the player moves too quickly while close. When `canScare` is true and the player moves within 6 blocks, the mob gets scared and backs off. There's also a 100-tick cooldown after the goal stops before it can start again.

`TemptGoal` also disables water avoidance while active (so the mob can follow through water) and calls `setDespawnProtected()` to prevent the mob from despawning while being led.

For a pet that always follows its owner, use `FollowOwnerGoal`:

```cpp
// Follow owner, start at 10 blocks, stop at 2 blocks, teleport at 12+
goalSelector.addGoal(5, new FollowOwnerGoal(this, 1.0, 10, 2));
```

This also handles teleporting the pet to the owner when pathfinding fails and they're far away. The teleport searches a 5x5 grid around the owner for solid ground with air above. Water avoidance is disabled while following.

### Making a Mob Guard an Area

Combine `MoveTowardsRestrictionGoal` with the restriction system:

```cpp
// In constructor
mob->restrictTo(homeX, homeY, homeZ, 16);
goalSelector.addGoal(4, new MoveTowardsRestrictionGoal(this, 1.0));
```

The mob will wander freely within 16 blocks of home, but always drift back if it strays. Pair this with an attack goal and a target goal for a full guard setup.

The Iron Golem does exactly this, with `DefendVillageTargetGoal` picking village attackers as targets.

### Making a Mob With Ranged Attacks

Use `ArrowAttackGoal` for projectile attacks:

```cpp
// Shoot arrows. Speed 0.25, arrow type, fire every 60 ticks
goalSelector.addGoal(2, new ArrowAttackGoal(this, 0.25f, ArrowAttackGoal::ArrowType, 60));

// Or throw snowballs
goalSelector.addGoal(2, new ArrowAttackGoal(this, 0.25f, ArrowAttackGoal::SnowballType, 20));
```

The mob needs 20 ticks of continuous line of sight before it fires its first shot. This prevents mobs from shooting through walls when they briefly see a player. After the first shot, it fires at the `attackInterval` rate. The attack radius is 10 blocks squared.

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

Notice that two goals can share the same priority (9 here). They'll coexist as long as their control flags don't overlap. `LookAtPlayerGoal` uses `LookControlFlag` and `RandomLookAroundGoal` uses no flags, so they can both be active at priority 9 without conflict.

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

### Multi-speed movement

`OzelotAttackGoal` shows how to make a mob change speeds based on range. It uses three different speed values: a walk speed when far away, a sprint speed when close, and a sneak speed at mid range. This creates a stalk-and-pounce behavior where the ocelot creeps up slowly and then dashes in for the attack.

You can do the same thing in a custom goal by checking the distance to the target in your `tick()` and calling `mob->getNavigation()->setSpeed()` with different values.

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
- Keep `canUse()` cheap. It runs every 3 ticks for every registered goal on every mob. Add cooldown counters if you need expensive checks (like the `scanCooldown` in the GuardAreaGoal example).
- `canContinueToUse()` defaults to calling `canUse()`. Override it with a simpler check when possible, since it runs more often (every tick on non-evaluation ticks).
- Test priority ordering carefully. If two goals fight over the same control flags, the one with the higher priority (lower number) always wins.
- Use `mob->getSensing()->canSee(target)` for line-of-sight checks rather than rolling your own. The caching saves work.
- When goals need shared state (like `SitGoal` needing to be toggled from the interact method), store the goal as a member variable on the mob and pass `canDeletePointer = false` to `addGoal()`.
- The `setLevel()` override exists on many goals as a 4J addition for schematic loading. If your goal stores a `Level*` pointer, override `setLevel()` so it gets updated when the entity is loaded from a schematic.
