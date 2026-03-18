---
title: AI & Goals
description: Mob AI behavior system in LCE.
---

LCE uses a priority-based goal system for mob AI. Each mob owns two `GoalSelector` instances, one for general behaviors and one for targeting. Each selector manages a list of `Goal` objects that compete for execution based on priority and control flag compatibility.

## Goal (base class)

Every AI behavior inherits from `Goal` and implements its lifecycle methods:

| Method | Default | Purpose |
|---|---|---|
| `canUse()` | (pure virtual) | Returns `true` if this goal should start |
| `canContinueToUse()` | Calls `canUse()` | Returns `true` if this goal should keep running |
| `canInterrupt()` | Returns `true` | Whether higher-priority goals can preempt this one |
| `start()` | No-op | Called once when the goal begins executing |
| `stop()` | No-op | Called once when the goal stops executing |
| `tick()` | No-op | Called every tick while the goal is running |
| `setRequiredControlFlags(flags)` | (none) | Sets the bitmask of control channels this goal uses |
| `getRequiredControlFlags()` | Returns `0` | Returns the control flag bitmask |
| `setLevel(level)` | No-op | 4J addition: updates level pointer when loading from schematics |

### Control flags

Goals declare which "control channels" they need through a bitmask passed to `setRequiredControlFlags()`. Two goals can run at the same time only if their control flags don't overlap (bitwise AND is zero). This prevents things like two movement goals from conflicting with each other.

The three control flags are defined in `Control.h`:

| Flag | Value | What it controls |
|---|---|---|
| `MoveControlFlag` | 1 (bit 0) | Walking, pathfinding, speed changes |
| `LookControlFlag` | 2 (bit 1) | Head rotation, looking at targets |
| `JumpControlFlag` | 4 (bit 2) | Jumping, leaping |

The `TargetGoal` base class defines `TargetFlag = 1` as a separate flag for targeting behaviors. Since target goals go in a different `GoalSelector` than movement goals, the flag value overlapping with `MoveControlFlag` does not cause conflicts.

### Control flag assignments

Here is what every built-in goal uses:

| Goal | Control Flags |
|---|---|
| `FloatGoal` | Jump |
| `PanicGoal` | Move |
| `RandomStrollGoal` | Move + Look |
| `FleeSunGoal` | Move |
| `MoveIndoorsGoal` | Move |
| `MoveThroughVillageGoal` | Move |
| `MoveTowardsRestrictionGoal` | Move |
| `MoveTowardsTargetGoal` | Move |
| `MeleeAttackGoal` | Move + Look |
| `ArrowAttackGoal` | Move + Look |
| `LeapAtTargetGoal` | Jump + Move |
| `OzelotAttackGoal` | Move + Look |
| `SwellGoal` | Move |
| `AvoidPlayerGoal` | Move |
| `TemptGoal` | Move + Look |
| `FollowOwnerGoal` | Move + Look |
| `FollowParentGoal` | (none set explicitly) |
| `BreedGoal` | Move + Look |
| `SitGoal` | Jump + Move |
| `BegGoal` | Look |
| `EatTileGoal` | Move + Look + Jump |
| `ControlledByPlayerGoal` | Move + Look + Jump |
| `LookAtPlayerGoal` | Look |
| `RandomLookAroundGoal` | (none set explicitly) |
| `DoorInteractGoal` | (none set explicitly) |
| `OfferFlowerGoal` | Move + Look |
| All targeting goals | TargetFlag (1) |

## GoalSelector

The scheduler that manages and ticks a set of goals.

### Internal structure

Goals are wrapped in `InternalGoal` objects that store:
- `prio`: integer priority (lower = higher priority)
- `goal`: pointer to the `Goal` instance
- `canDeletePointer`: ownership flag for memory management (4J addition)

Two lists are maintained:
- `goals`: all registered goals
- `usingGoals`: goals currently executing

### Tick behavior

Every `newGoalRate` ticks (default: 3), the selector runs a full evaluation cycle:

1. **For each registered goal:**
   - If it's currently running and either `canUseInSystem()` fails or `canContinueToUse()` returns false, call `stop()` and remove from `usingGoals`
   - If it's not running and both `canUseInSystem()` and `canUse()` pass, add to start list and `usingGoals`
2. **Call `start()` on all newly added goals**
3. **Call `tick()` on all running goals**

On non-evaluation ticks, only `canContinueToUse()` is checked for running goals, stopping any that return false.

### Priority and compatibility

`canUseInSystem(goal)` checks whether a goal can run given the current set of active goals:

- Against **higher-priority** (lower number) running goals: the candidate is blocked if their control flags overlap (`canCoExist` returns false)
- Against **lower-priority** (higher number) running goals: the candidate is blocked if the lower-priority goal's `canInterrupt()` returns false

`canCoExist(goalA, goalB)` returns true when `(goalA.flags & goalB.flags) == 0`.

When a new higher-priority goal starts, conflicting lower-priority goals are not stopped right away. They get removed lazily on the next evaluation cycle when `canUseInSystem()` fails for them.

### Configuration

- `addGoal(priority, goal, canDeletePointer)`: registers a goal at the given priority. The `canDeletePointer` flag (default `true`) controls whether the selector owns the goal memory.
- `setNewGoalRate(rate)`: changes how often full evaluation happens (default every 3 ticks)
- `setLevel(level)`: sends a level pointer change to all goals (4J addition for schematic loading)

## TargetGoal (base class for targeting)

Abstract base for goals that pick an attack target. Provides shared logic for target validation.

**Constructor:** `TargetGoal(Mob *mob, float within, bool mustSee, bool mustReach = false)`

| Parameter | Purpose |
|---|---|
| `mob` | The mob that owns this goal |
| `within` | Maximum search/follow distance |
| `mustSee` | If true, target must be visible (line of sight) |
| `mustReach` | If true, target must be pathable |

**Key behavior:**
- `canAttack(target, allowInvulnerable)`: checks that the target is alive, within range, and optionally visible/reachable. For tamed animals, it also checks that the target is not the owner or the owner's other pet.
- Maintains a `reachCache` with three states: `EmptyReachCache` (0), `CanReachCache` (1), `CantReachCache` (2). The cache avoids expensive pathfinding checks every tick.
- `unseenTicks` tracks how long since the target was last visible, up to `UnseenMemoryTicks` (60). After 60 ticks without seeing the target, the goal gives up.
- On `start()`, sets the mob's target via `mob->setTarget()`
- On `stop()`, clears the mob's target

## All goal types (full reference)

### Movement goals

#### FloatGoal

Makes mobs swim when in water or lava.

| | |
|---|---|
| **Constructor** | `FloatGoal(Mob *mob)` |
| **Flags** | `JumpControlFlag` |
| **canUse** | Returns true when `mob->isInWater()` or `mob->isInLava()` |
| **tick** | Calls `mob->getJumpControl()->jump()`. Due to the jump control's random factor, the mob jumps about 80% of ticks, which creates a bobbing effect. |

#### PanicGoal

Flees at increased speed when hurt.

| | |
|---|---|
| **Constructor** | `PanicGoal(PathfinderMob *mob, float speed)` |
| **Flags** | `MoveControlFlag` |
| **canUse** | Returns true when `mob->getLastHurtByMob() != NULL`. Picks a random flee position using `RandomPos::getPos(mob, 5, 4)`. |
| **start** | Begins pathfinding to the chosen position at `speed` |
| **canContinueToUse** | Returns true while the navigation path is not done |

#### RandomStrollGoal

Wanders randomly when idle.

| | |
|---|---|
| **Constructor** | `RandomStrollGoal(PathfinderMob *mob, float speed)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **canUse** | Only activates with a 1/120 chance when the mob has been idle for less than 5 seconds (`noActionTime < 100`). Uses `RandomPos::getPos(mob, 10, 7)` to find a destination. Also supports extra wandering for despawn detection (see entities page). |
| **start** | Begins pathfinding to the random destination at `speed` |
| **canContinueToUse** | Returns true while navigation is not done |

#### FleeSunGoal

Moves to a shaded area when exposed to sunlight.

| | |
|---|---|
| **Constructor** | `FleeSunGoal(PathfinderMob *mob, float speed)` |
| **Flags** | `MoveControlFlag` |
| **canUse** | Only when it's daytime, the mob is on fire, and the mob's position is under open sky. Tries 10 random positions within range looking for one with a solid block overhead. |
| **start** | Pathfinds to the shaded position at `speed` |
| **canContinueToUse** | Returns true while navigation is not done |

#### MoveIndoorsGoal

Moves toward a village door during rain or at night.

| | |
|---|---|
| **Constructor** | `MoveIndoorsGoal(PathfinderMob *mob)` |
| **Flags** | `MoveControlFlag` |
| **canUse** | Activates at night or during rain with a 1/50 random chance. Finds the nearest village door within range. |
| **start** | Pathfinds to the inside position of the nearest door |
| **canContinueToUse** | Returns true while navigation is not done |

#### MoveThroughVillageGoal

Navigates between village doors during pathfinding.

| | |
|---|---|
| **Constructor** | `MoveThroughVillageGoal(PathfinderMob *mob, float speed, bool onlyAtNight)` |
| **Flags** | `MoveControlFlag` |
| **canUse** | Finds an unvisited village door and creates a path to it. Keeps a visited list so it doesn't loop between the same doors. |
| **start** | Begins pathfinding to the next door at `speed` |
| **canContinueToUse** | Returns true while navigation is not done and the mob hasn't reached the door |
| **stop** | Adds the current door to the visited list |

#### MoveTowardsRestrictionGoal

Returns toward the mob's home position.

| | |
|---|---|
| **Constructor** | `MoveTowardsRestrictionGoal(PathfinderMob *mob, float speed)` |
| **Flags** | `MoveControlFlag` |
| **canUse** | Returns true when the mob has a restriction center set and the mob is outside its restriction radius. Uses `RandomPos::getPosTowards()` biased toward the restriction center. |
| **start** | Pathfinds toward the home position at `speed` |
| **canContinueToUse** | Returns true while navigation is not done |

#### MoveTowardsTargetGoal

Moves toward the current attack target.

| | |
|---|---|
| **Constructor** | `MoveTowardsTargetGoal(PathfinderMob *mob, float speed, float within)` |
| **Flags** | `MoveControlFlag` |
| **canUse** | Returns true when the mob has a target and is farther than `within` blocks from it. Uses `RandomPos::getPosTowards()` biased toward the target. |
| **start** | Pathfinds toward the biased position at `speed` |
| **canContinueToUse** | Returns true while navigation is not done |

#### ControlledByPlayerGoal

Lets a rider (player with carrot on a stick) steer the mob.

| | |
|---|---|
| **Constructor** | `ControlledByPlayerGoal(Mob *mob, float maxSpeed, float walkSpeed)` |
| **Flags** | `MoveControlFlag + LookControlFlag + JumpControlFlag` |
| **Constants** | `MIN_BOOST_TIME = 140 ticks (7s)`, `MAX_BOOST_TIME = 700 ticks (35s)` |
| **canUse** | Returns true when the mob has a rider that is a player holding a carrot on a stick |
| **tick** | Steers the mob based on the rider's look direction. Handles speed boosting when the player uses the carrot on a stick item. Auto-detects cliffs and obstacles using `PathFinder::isFree`. Randomly breaks the carrot on a stick when boosting ends. |
| **Other methods** | `boost()` starts a speed boost, `isBoosting()` checks boost state, `canBoost()` checks if a boost is available |

### Combat goals

#### MeleeAttackGoal

Pathfinds to target and attacks in melee range.

| | |
|---|---|
| **Constructors** | `MeleeAttackGoal(Mob *mob, float speed, bool trackTarget)` or `MeleeAttackGoal(Mob *mob, eINSTANCEOF attackType, float speed, bool trackTarget)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **Parameters** | `speed`: movement speed modifier. `trackTarget`: if true, constantly recalculates path to moving target. `attackType`: optional eINSTANCEOF filter so the goal only activates against a specific entity type. |
| **canUse** | Returns true when the mob has a target (optionally filtered by `attackType`) and can create a path to it |
| **tick** | Recalculates the path every 4-11 ticks (random jitter to avoid all mobs pathing on the same frame). Attack cooldown is 20 ticks. Melee hit radius is `(bbWidth * 2)^2`. Looks at the target while approaching. |
| **stop** | Clears the path and stops navigation |

The `attackType` filter is how the Zombie handles different priorities for players vs villagers. Two `MeleeAttackGoal` instances at different priorities, each with a different `attackType`, let the mob prefer one target type over another.

#### ArrowAttackGoal

Ranged attack for mobs that shoot projectiles.

| | |
|---|---|
| **Constructor** | `ArrowAttackGoal(Mob *mob, float speed, int projectileType, int attackInterval)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **Constants** | `ArrowType = 1`, `SnowballType = 2` |
| **Parameters** | `speed`: movement speed while approaching. `projectileType`: determines which projectile to fire. `attackInterval`: minimum ticks between shots. |
| **canUse** | Returns true when the mob has a target |
| **tick** | Tracks the target and maintains distance. Attack radius is 10 blocks squared. Requires 20 ticks of continuous line of sight before firing the first shot. After that, fires at `attackInterval` intervals. Calls `fireAtTarget()` which creates the appropriate projectile based on `projectileType`. |
| **stop** | Clears the target reference. `seeTime` and `attackTime` are not reset in `stop()`. |

#### LeapAtTargetGoal

Leaps at the target when within range. Used by wolves.

| | |
|---|---|
| **Constructor** | `LeapAtTargetGoal(Mob *mob, float yd)` |
| **Flags** | `JumpControlFlag + MoveControlFlag` |
| **Parameters** | `yd`: the upward velocity component of the leap |
| **canUse** | Returns true with a 1/5 random chance when the target is 2-4 blocks away and the mob is on the ground |
| **start** | Directly sets the mob's `xd`, `zd`, and `yd` motion values to leap toward the target. The horizontal components are calculated from the direction to the target, clamped to reasonable values. |
| **canContinueToUse** | Returns false once the mob is back on the ground |

#### OzelotAttackGoal

Ocelot-specific pounce attack with variable speed.

| | |
|---|---|
| **Constructor** | `OzelotAttackGoal(Mob *mob)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **canUse** | Returns true when the mob has a target |
| **tick** | Uses three different speeds depending on distance: normal walk speed when far, sprint speed when close, and a slower sneak speed at mid range. Creates a stalking/pounce behavior. Attack cooldown uses the same 20 tick timing as melee. |
| **stop** | Resets the attack timer |

#### SwellGoal

Creeper-specific. Starts swelling when near a target, stops when target moves away.

| | |
|---|---|
| **Constructor** | `SwellGoal(Creeper *creeper)` |
| **Flags** | `MoveControlFlag` |
| **canUse** | Returns true when the creeper has a target within 3 blocks |
| **start** | Stops the creeper's navigation (it stands still while swelling) |
| **tick** | If the target moves beyond 7 blocks or is no longer visible, calls `stop()`. Otherwise lets the creeper's swell timer continue. |
| **stop** | Clears the target reference. The swell direction is reset to -1 inside `tick()` when the target is null or out of range. |

### Targeting goals

#### NearestAttackableTargetGoal

Finds the nearest entity of a given type within range.

| | |
|---|---|
| **Constructor** | `NearestAttackableTargetGoal(Mob *mob, const type_info& targetType, float within, int randomInterval, bool mustSee, bool mustReach = false)` |
| **Flags** | `TargetFlag` |
| **Parameters** | `targetType`: C++ type_info for the target class. `within`: search range. `randomInterval`: if > 0, only runs the search with a `1/randomInterval` random chance per check. `mustSee`/`mustReach`: passed to `TargetGoal` base. |
| **canUse** | If `randomInterval > 0`, randomly skips checks. For `Player` type, uses the optimized `getNearestAttackablePlayer()`. For other types, searches entities in a box around the mob, sorts them by distance using `DistComp`, and picks the closest valid one. |
| **start** | Sets the mob's target to the found entity |

The `DistComp` comparator sorts entities by distance from the mob, closest first. This is how the mob picks the nearest valid target instead of just any random one.

#### HurtByTargetGoal

Targets whatever mob last hurt this mob.

| | |
|---|---|
| **Constructor** | `HurtByTargetGoal(Mob *mob, bool alertSameType)` |
| **Flags** | `TargetFlag` |
| **Parameters** | `alertSameType`: if true, nearby mobs of the same type will also target the attacker |
| **canUse** | Returns true when `mob->getLastHurtByMob()` returns a new attacker (different from the previously stored one). Uses `canAttack()` to validate the target. Search range is 16 blocks. |
| **start** | Sets the mob's target. If `alertSameType` is true, searches nearby mobs of the same class and sets their target to the attacker too. |
| **tick** | Checks if the stored attacker has changed and updates accordingly |

#### DefendVillageTargetGoal

Iron golem targets mobs that attacked a villager.

| | |
|---|---|
| **Constructor** | `DefendVillageTargetGoal(VillagerGolem *golem)` |
| **Flags** | `TargetFlag` |
| **canUse** | Checks the golem's village for a recent aggressor. Uses `canAttack()` to validate the target. |
| **start** | Sets the golem's target to the village aggressor |

#### OwnerHurtByTargetGoal

Tamed animal targets whatever hurt its owner.

| | |
|---|---|
| **Constructor** | `OwnerHurtByTargetGoal(TamableAnimal *tameAnimal)` |
| **Flags** | `TargetFlag` |
| **canUse** | Returns true when the owner's `lastHurtByMob` is set and is a valid target. Search range is 32 blocks. |
| **start** | Sets the pet's target to whatever hurt the owner |

#### OwnerHurtTargetGoal

Tamed animal targets whatever its owner attacked.

| | |
|---|---|
| **Constructor** | `OwnerHurtTargetGoal(TamableAnimal *tameAnimal)` |
| **Flags** | `TargetFlag` |
| **canUse** | Returns true when the owner's `lastHurtMob` is set and is a valid target. Search range is 32 blocks. |
| **start** | Sets the pet's target to whatever the owner last attacked |

#### NonTameRandomTargetGoal

Targets random entities, but only if the animal is not tamed.

| | |
|---|---|
| **Constructor** | `NonTameRandomTargetGoal(TamableAnimal *mob, const type_info& targetType, float within, int randomInterval, bool mustSee)` |
| **Flags** | `TargetFlag` |
| **canUse** | Returns false if the animal is tamed. Otherwise defers to `NearestAttackableTargetGoal::canUse()`. |

This is how wild wolves hunt sheep but tamed wolves don't.

### Interaction goals

#### LookAtPlayerGoal

Looks at nearby entities of a given type.

| | |
|---|---|
| **Constructors** | `LookAtPlayerGoal(Mob *mob, const type_info& lookAtType, float lookDistance)` or `LookAtPlayerGoal(Mob *mob, const type_info& lookAtType, float lookDistance, float probability)` |
| **Flags** | `LookControlFlag` |
| **Parameters** | `lookAtType`: what entity type to look at. `lookDistance`: max distance to notice. `probability`: chance per check to activate (default 0.02). |
| **canUse** | With `probability` chance, searches for the nearest entity of `lookAtType` within `lookDistance`. |
| **start** | Sets a random look time between 40-80 ticks |
| **tick** | Points the mob's look control at the target entity |
| **canContinueToUse** | Returns false when look time runs out or the target moves out of range |

#### LookAtTradingPlayerGoal

Villager looks at the player currently trading with them.

| | |
|---|---|
| **Constructor** | `LookAtTradingPlayerGoal(Villager *villager)` |
| **Flags** | `LookControlFlag` (inherited) |
| **canUse** | Returns true when the villager has an active trading partner |

Extends `LookAtPlayerGoal` and overrides `canUse()` to check for an active trade.

#### RandomLookAroundGoal

Randomly looks around when idle.

| | |
|---|---|
| **Constructor** | `RandomLookAroundGoal(Mob *mob)` |
| **Flags** | (none set) |
| **canUse** | Activates with a 1/6 random chance |
| **start** | Picks a random direction to look in and sets a look time of 20-40 ticks |
| **tick** | Points the mob's look control toward the random direction |
| **canContinueToUse** | Returns false when the look timer runs out |

Because this goal has no control flags, it can run alongside basically anything. That's intentional since looking around shouldn't block movement.

#### InteractGoal

Generic interaction behavior. Extends `LookAtPlayerGoal`.

| | |
|---|---|
| **Constructors** | `InteractGoal(Mob *mob, const type_info& lookAtType, float lookDistance)` or `InteractGoal(Mob *mob, const type_info& lookAtType, float lookDistance, float probability)` |
| **Flags** | `LookControlFlag` (inherited) |

Same as `LookAtPlayerGoal` but used in contexts where the mob is interacting rather than just looking.

#### TradeWithPlayerGoal

Villager engages in trade interaction.

| | |
|---|---|
| **Constructor** | `TradeWithPlayerGoal(Villager *mob)` |
| **Flags** | (none set) |
| **canUse** | Returns true when the villager has an active trading partner |
| **start** | Sets up the trade interaction state |
| **stop** | Cleans up the trade state |

#### BegGoal

Wolf begging behavior when a player holds food.

| | |
|---|---|
| **Constructor** | `BegGoal(Wolf *wolf, float lookDistance)` |
| **Flags** | `LookControlFlag` |
| **canUse** | Searches for a nearby player within `lookDistance` who is holding an interesting item. For untamed wolves that's a bone. For tamed wolves it's any food item. |
| **start** | Sets a random look time between 40-80 ticks. Calls `setDespawnProtected()` on the wolf (player interaction prevents despawning). |
| **tick** | Points the wolf's look control at the player |
| **canContinueToUse** | Returns false when the look timer expires or the player stops holding the item |

### Tame / pet goals

#### FollowOwnerGoal

Tamed animal follows its owner. Teleports if too far.

| | |
|---|---|
| **Constructor** | `FollowOwnerGoal(TamableAnimal *tamable, float speed, float startDistance, float stopDistance)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **Constants** | `TeleportDistance = 12` |
| **Parameters** | `speed`: movement speed. `startDistance`: distance to owner before the pet starts following. `stopDistance`: distance to stop at. |
| **canUse** | Returns true when the owner exists, the pet is not sitting, and the distance to the owner exceeds `startDistance`. Won't activate if the pet is ordered to sit. |
| **start** | Disables water avoidance on the navigation (so the pet can follow through water) and starts pathfinding to the owner. |
| **tick** | Re-paths periodically. If the distance exceeds `TeleportDistance` (12 blocks), attempts to teleport by searching a 5x5 grid around the owner for solid ground with air above. |
| **stop** | Re-enables water avoidance and stops navigation |

#### SitGoal

Tamed animal sits/stays when ordered.

| | |
|---|---|
| **Constructor** | `SitGoal(TamableAnimal *mob)` |
| **Flags** | `JumpControlFlag + MoveControlFlag` |
| **canUse** | Returns true when the mob is tamed. Won't sit if the owner is in danger (within `TeleportDistance` and the owner was recently hurt). |
| **start** | Stops navigation and puts the mob in the sitting pose |
| **stop** | Removes the sitting pose |
| **Other methods** | `wantToSit(bool)` toggles the sitting state from external code |

By claiming both Jump and Move flags, sitting prevents basically all other movement behaviors from running.

#### OcelotSitOnTileGoal

Ocelot-specific: sits on chests, beds, and furnaces.

| | |
|---|---|
| **Constructor** | `OcelotSitOnTileGoal(Ozelot *ocelot, float speed)` |
| **Flags** | (none set) |
| **Constants** | `GIVE_UP_TICKS`, `SIT_TICKS`, `SEARCH_RANGE`, `SIT_CHANCE` |
| **canUse** | Searches for a valid tile (chest, bed, or furnace) within range. The ocelot must be tamed. |
| **tick** | Pathfinds to the tile. Once on it, the ocelot sits down. After `SIT_TICKS`, the goal ends. |

### Breeding / social goals

#### BreedGoal

Finds a partner and breeds when in love mode.

| | |
|---|---|
| **Constructor** | `BreedGoal(Animal *animal, float speed)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **canUse** | Returns true when the animal is in love mode (`isInLove()`). Searches within 8 blocks for another animal of the same type that `canMate()` returns true for. |
| **tick** | Pathfinds to the partner and counts up `loveTime`. After 60 ticks (3 seconds), calls `breed()`. |
| **Breeding** | Awards 1-7 XP orbs. Sets both parents' age to 6000 ticks (5 minute breeding cooldown). Creates a baby with age -24000 ticks (20 minutes until adult). |
| **stop** | Resets the love timer |

#### FollowParentGoal

Baby animals follow their parent.

| | |
|---|---|
| **Constructor** | `FollowParentGoal(Animal *animal, float speed)` |
| **Flags** | (none set explicitly) |
| **canUse** | Only works for baby animals (age < 0). Searches for the nearest adult of the same type within 8 blocks. |
| **tick** | Pathfinds to the parent. Re-paths periodically. |
| **canContinueToUse** | Returns false if the parent moves beyond 16 blocks (gives up) or closer than 3 blocks (close enough). |

#### TemptGoal

Follows a player holding a specific item.

| | |
|---|---|
| **Constructor** | `TemptGoal(PathfinderMob *mob, float speed, int itemId, bool canScare)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **Parameters** | `speed`: follow speed. `itemId`: the item ID that attracts this mob. `canScare`: if true, the mob stops following when the player moves fast within 6 blocks. |
| **canUse** | Searches for a player within 10 blocks holding the `itemId`. Won't activate during the 100-tick cooldown after the last tempt ended. |
| **start** | Disables water avoidance. Calls `setDespawnProtected()`. |
| **tick** | Looks at the player and pathfinds toward them at `speed` |
| **stop** | Re-enables water avoidance. Starts the 100-tick `calmDown` cooldown. |
| **Other methods** | `isRunning()` returns whether the goal is currently active. Used by breeding logic to check if an animal is being led by a player. |

#### MakeLoveGoal

Villager-specific breeding/love behavior.

| | |
|---|---|
| **Constructor** | `MakeLoveGoal(Villager *villager)` |
| **Flags** | (none set) |
| **canUse** | Returns true when the villager can breed and the village needs more villagers. |
| **tick** | Finds a partner, pathfinds to them, and after a timer, spawns a baby villager. |

#### PlayGoal

Young villagers play/run around.

| | |
|---|---|
| **Constructor** | `PlayGoal(Villager *mob, float speed)` |
| **Flags** | (none set) |
| **canUse** | Only works for young villagers. Finds another young villager to play with. |
| **tick** | Runs around near the play partner, bouncing between positions. The `playTime` counter limits how long they play. |

### Door goals

#### DoorInteractGoal

Base class for door interaction. Pathfinds to doors.

| | |
|---|---|
| **Constructor** | `DoorInteractGoal(Mob *mob)` |
| **Flags** | (none set) |
| **canUse** | Searches nearby blocks for a door. Returns true if a door is found within range along the mob's path. |
| **tick** | Checks if the mob has passed through the door by comparing its position to the door's open direction. |

#### OpenDoorGoal

Opens doors and closes them after a delay.

| | |
|---|---|
| **Constructor** | `OpenDoorGoal(Mob *mob, bool closeDoorAfter)` |
| **Flags** | (inherited from DoorInteractGoal, none) |
| **Parameters** | `closeDoorAfter`: if true, the mob will close the door 20 ticks after passing through |
| **start** | Opens the door |
| **stop** | Closes the door (if `closeDoorAfter` is true) |
| **tick** | Counts down the `forgetTime`. After 20 ticks, the door closes. |

#### BreakDoorGoal

Breaks down doors (used by zombies).

| | |
|---|---|
| **Constructor** | `BreakDoorGoal(Mob *mob)` |
| **Flags** | (inherited from DoorInteractGoal, none) |
| **Constants** | `DOOR_BREAK_TIME = 240 ticks (12 seconds)` |
| **canUse** | Same as `DoorInteractGoal::canUse()` but also checks that the difficulty is Hard |
| **tick** | Increments `breakTime` and plays the zombie door-breaking sound. Shows break progress particles. After `DOOR_BREAK_TIME` ticks, destroys the door block. |
| **stop** | Resets the break progress |

#### RestrictOpenDoorGoal

Prevents mobs from going through open doors.

| | |
|---|---|
| **Constructor** | `RestrictOpenDoorGoal(PathfinderMob *mob)` |
| **Flags** | (none set) |
| **canUse** | Returns true when the mob is near a village door that is currently open |
| **start** | Sets a path restriction to avoid the open door's position |
| **stop** | Clears the path restriction |

### Environment goals

#### RestrictSunGoal

Restricts the mob to shaded areas.

| | |
|---|---|
| **Constructor** | `RestrictSunGoal(PathfinderMob *mob)` |
| **Flags** | (none set) |
| **canUse** | Returns true when it's daytime |
| **start** | Enables sun avoidance on the navigation (`setAvoidSun(true)`) |
| **stop** | Disables sun avoidance |

#### EatTileGoal

Sheep-specific: eats grass blocks.

| | |
|---|---|
| **Constructor** | `EatTileGoal(Mob *mob)` |
| **Flags** | `MoveControlFlag + LookControlFlag + JumpControlFlag` |
| **Constants** | `EAT_ANIMATION_TICKS = 40 (2 seconds)` |
| **canUse** | Random chance: 1/1000 for adults, 1/50 for babies. The mob must be standing on grass or tall grass. |
| **start** | Starts the eating animation. Broadcasts an entity event to clients. |
| **tick** | Counts down the `eatAnimationTick`. When it hits 0, eats tall grass (removes the block) or converts a grass block to dirt. |
| **Other methods** | `getEatAnimationTick()` returns the current animation progress, used by the renderer for the head-dip animation. |

Claiming all three control flags (Move + Look + Jump) means the mob completely freezes while eating.

#### OfferFlowerGoal

Iron golem offers a flower to a villager child.

| | |
|---|---|
| **Constructor** | `OfferFlowerGoal(VillagerGolem *golem)` |
| **Flags** | `MoveControlFlag + LookControlFlag` |
| **Constants** | `OFFER_TICKS = 400 (20 seconds)` |
| **canUse** | Activates during daytime with a 1/8000 chance. Searches for a young villager within 6 blocks. |
| **tick** | Looks at the villager child. Counts up to `OFFER_TICKS`. |
| **stop** | Clears the offer state |

#### TakeFlowerGoal

Villager child takes a flower from an iron golem.

| | |
|---|---|
| **Constructor** | `TakeFlowerGoal(Villager *villager)` |
| **Flags** | (none set) |
| **canUse** | Returns true when a nearby iron golem is offering a flower |
| **tick** | Pathfinds to the golem. When close enough, takes the flower. |

### Avoid goals

#### AvoidPlayerGoal

Runs away from a nearby player or entity.

| | |
|---|---|
| **Constructor** | `AvoidPlayerGoal(PathfinderMob *mob, const type_info& avoidType, float maxDist, float walkSpeed, float sprintSpeed)` |
| **Flags** | `MoveControlFlag` |
| **Parameters** | `avoidType`: what entity type to flee from. `maxDist`: detection range. `walkSpeed`: speed when the threat is far. `sprintSpeed`: speed when the threat is within 7 blocks. |
| **canUse** | Searches for the nearest entity of `avoidType` within `maxDist`. For tamed animals, won't avoid players (they're family). Uses `RandomPos::getPosAvoid()` to find a direction away from the threat. |
| **tick** | Adjusts speed based on distance to the threat. If the entity is within 7 blocks, uses `sprintSpeed`. Otherwise uses `walkSpeed`. |
| **stop** | Clears the avoidance path |

Despite the name, this works for avoiding any entity type, not just players. Ocelots use it to avoid players, and cats skip it since they're tamed.

## Mob AI setup pattern

Mobs register goals in their constructor with priorities. A typical zombie looks like:

```
goalSelector.addGoal(0, FloatGoal)
goalSelector.addGoal(1, BreakDoorGoal)
goalSelector.addGoal(2, MeleeAttackGoal(Player))
goalSelector.addGoal(3, MeleeAttackGoal(Villager))
goalSelector.addGoal(4, MoveTowardsRestrictionGoal)
goalSelector.addGoal(5, MoveThroughVillageGoal)
goalSelector.addGoal(6, RandomStrollGoal)
goalSelector.addGoal(7, LookAtPlayerGoal)
goalSelector.addGoal(7, RandomLookAroundGoal)

targetSelector.addGoal(1, HurtByTargetGoal)
targetSelector.addGoal(2, NearestAttackableTargetGoal(Player))
targetSelector.addGoal(2, NearestAttackableTargetGoal(Villager))
```

Lower priority numbers take precedence. Goals at the same priority level can coexist if their control flags don't conflict.

### Example: Cow AI setup

```
goalSelector.addGoal(0, FloatGoal)
goalSelector.addGoal(1, PanicGoal(0.38))
goalSelector.addGoal(2, BreedGoal(0.2))
goalSelector.addGoal(3, TemptGoal(0.25, wheat, false))
goalSelector.addGoal(4, FollowParentGoal(0.25))
goalSelector.addGoal(5, RandomStrollGoal(0.2))
goalSelector.addGoal(6, LookAtPlayerGoal(Player, 6))
goalSelector.addGoal(7, RandomLookAroundGoal)
```

No target goals since cows don't attack anything. Panic is high priority so the cow runs from danger before doing anything else.

### Example: Wolf AI setup

```
goalSelector.addGoal(1, FloatGoal)
goalSelector.addGoal(2, SitGoal)
goalSelector.addGoal(3, LeapAtTargetGoal(0.4))
goalSelector.addGoal(4, MeleeAttackGoal(1.0, true))
goalSelector.addGoal(5, FollowOwnerGoal(1.0, 10, 2))
goalSelector.addGoal(6, BreedGoal(1.0))
goalSelector.addGoal(7, RandomStrollGoal(1.0))
goalSelector.addGoal(8, BegGoal(8))
goalSelector.addGoal(9, LookAtPlayerGoal(Player, 8))
goalSelector.addGoal(9, RandomLookAroundGoal)

targetSelector.addGoal(1, OwnerHurtByTargetGoal)
targetSelector.addGoal(2, OwnerHurtTargetGoal)
targetSelector.addGoal(3, HurtByTargetGoal(true))
targetSelector.addGoal(4, NonTameRandomTargetGoal(Sheep, 16, 200, false))
```

The wolf shows off multiple target goals in priority order: defend owner first, then retaliate, then hunt sheep (only when wild).

## Mob control objects

Every mob that uses the new AI system has a set of control objects that goals use to actually make the mob do things. Goals don't move the mob directly. They tell the control objects what to do, and the control objects handle the actual movement/rotation each tick.

### MoveControl

Handles movement toward a target position.

| | |
|---|---|
| **Constants** | `MIN_SPEED = 0.0005f`, `MAX_TURN = 30 degrees` |
| **Key method** | `setWantedPosition(x, y, z, speed)` tells the mob where to go |
| **Tick behavior** | Calculates direction to target, smoothly rotates the mob (up to `MAX_TURN` degrees per tick via `rotlerp`), applies forward speed. Triggers a jump when the target is above the mob. |

### LookControl

Handles head rotation toward a target.

| | |
|---|---|
| **Key methods** | `setLookAt(entity, yMax, xMax)` or `setLookAt(x, y, z, yMax, xMax)` |
| **Parameters** | `yMax`: max Y-axis rotation per tick. `xMax`: max X-axis (pitch) rotation per tick. |
| **Tick behavior** | Smoothly rotates the head toward the target within the rotation limits |

### JumpControl

Handles jumping.

| | |
|---|---|
| **Key method** | `jump()` sets a flag that makes the mob jump on the next tick |
| **Tick behavior** | If the jump flag is set, calls the mob's jump method. Clears the flag after. |

### Sensing

Caches line-of-sight results for performance.

| | |
|---|---|
| **Key method** | `canSee(entity)` returns true if the mob has line of sight to the entity |
| **Caching** | Maintains `seen` and `unseen` vectors. Results are cached for the current tick and cleared at the start of each new tick. |

Goals should use `mob->getSensing()->canSee(target)` instead of doing their own line-of-sight calculations. The cache prevents the same raycast from running multiple times per tick when multiple goals check the same target.

## MinecraftConsoles Differences

MC adds two new AI goal types that LCEMP doesn't have:

### RunAroundLikeCrazyGoal

Used by horses when they're being tamed. Makes the horse run around wildly to try to throw off the player. Once the horse is tamed, this goal stops firing.

### RangedAttackGoal

A new ranged attack goal that's separate from the existing `ArrowAttackGoal`. In LCEMP, `ArrowAttackGoal` handles both arrow-type and snowball-type ranged attacks. MC splits this out so `RangedAttackGoal` can be used by the Witch (for potion throwing) and the Skeleton (using the `RangedAttackMob` interface).

MC also adds `OcelotAttackGoal` as a separate file pair. In LCEMP, this goal exists but its source may be structured slightly differently.

### New mob AI setups

Since MC adds new mobs (Witch, Wither Boss, Bat, Horse), those mobs each bring their own goal configurations. For example:

- **Witch** uses `RangedAttackGoal` for potion attacks and standard movement/targeting goals
- **Horse** uses `RunAroundLikeCrazyGoal` during taming, plus the usual `PanicGoal`, `BreedGoal`, `FollowParentGoal`, and `RandomStrollGoal`
- **Wither Boss** has its own attack patterns (not simple goal-based AI)
- **Bat** has minimal AI since it just flies around randomly
