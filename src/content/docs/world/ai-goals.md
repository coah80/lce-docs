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

The `TargetGoal` base class defines `TargetFlag = 1` as a standard flag for targeting behaviors.

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

### Configuration

- `addGoal(priority, goal, canDeletePointer)`: registers a goal at the given priority. The `canDeletePointer` flag (default `true`) controls whether the selector owns the goal memory.
- `setNewGoalRate(rate)`: changes how often full evaluation happens (default every 3 ticks)
- `setLevel(level)`: sends a level pointer change to all goals (4J addition for schematic loading)

## TargetGoal (base class for targeting)

Abstract base for goals that pick an attack target. Provides shared logic for target validation.

**Constructor parameters:** `mob`, `within` (search range), `mustSee`, `mustReach`

**Key behavior:**
- `canAttack(target, allowInvulnerable)`: checks that the target is alive, in range, and optionally visible/reachable
- Maintains a `reachCache` with three states: Empty (0), CanReach (1), CantReach (2)
- `unseenTicks` tracks how long since the target was last visible, up to `UnseenMemoryTicks` (60)
- On `start()`, sets the mob's target
- On `stop()`, clears the mob's target

## All goal types

### Movement goals

| Goal | Description |
|---|---|
| `FloatGoal` | Makes mobs swim when in water. Calls jump when submerged. |
| `PanicGoal` | Flees at increased `speed` when hurt. Finds a random nearby position. |
| `RandomStrollGoal` | Wanders randomly. Picks a random destination within range. |
| `FleeSunGoal` | Moves to a shaded area when exposed to sunlight. |
| `MoveIndoorsGoal` | Moves toward a village door during rain or at night. |
| `MoveThroughVillageGoal` | Navigates between village doors during pathfinding. |
| `MoveTowardsRestrictionGoal` | Returns toward the mob's home position. |
| `MoveTowardsTargetGoal` | Moves toward the current attack target. |
| `ControlledByPlayerGoal` | Allows a rider (player with carrot on stick) to steer the mob. |

### Combat goals

| Goal | Description |
|---|---|
| `MeleeAttackGoal` | Pathfinds to target and attacks in melee range. Recalculates path periodically. Can filter by `attackType`. |
| `ArrowAttackGoal` | Ranged attack. Supports `ArrowType` (1) and `SnowballType` (2) projectiles. Configurable `attackInterval`. |
| `LeapAtTargetGoal` | Leaps at the target when within range. |
| `OzelotAttackGoal` | Ocelot-specific pounce attack. |
| `SwellGoal` | Creeper-specific. Starts swelling when near a target, stops when target moves away. |

### Targeting goals

| Goal | Description |
|---|---|
| `NearestAttackableTargetGoal` | Finds the nearest entity of a given type within range. Uses `DistComp` comparator for distance sorting. Optionally checks with a `randomInterval`. |
| `HurtByTargetGoal` | Targets whatever mob last hurt this mob. If `alertSameType` is true, alerts nearby mobs of the same type. |
| `DefendVillageTargetGoal` | Iron golem targets mobs that attacked a villager. |
| `OwnerHurtByTargetGoal` | Tamed animal targets whatever hurt its owner. |
| `OwnerHurtTargetGoal` | Tamed animal targets whatever its owner attacked. |
| `NonTameRandomTargetGoal` | Targets random entities, but only if the animal is not tamed. |

### Interaction goals

| Goal | Description |
|---|---|
| `LookAtPlayerGoal` | Looks at nearby entities of a given type. Configurable `lookDistance` and `probability`. |
| `LookAtTradingPlayerGoal` | Villager looks at the player currently trading with them. |
| `RandomLookAroundGoal` | Randomly looks around when idle. |
| `InteractGoal` | Generic interaction behavior (extends `LookAtPlayerGoal`). |
| `TradeWithPlayerGoal` | Villager engages in trade interaction. |
| `BegGoal` | Wolf begging behavior when a player holds food. |

### Tame / pet goals

| Goal | Description |
|---|---|
| `FollowOwnerGoal` | Tamed animal follows its owner. Teleports if distance exceeds `TeleportDistance` (12 blocks). Disables water avoidance while following. |
| `SitGoal` | Tamed animal sits/stays when ordered. `wantToSit(bool)` toggles the sitting state. |
| `OcelotSitOnTileGoal` | Ocelot-specific: sits on chests, beds, and furnaces. |

### Breeding / social goals

| Goal | Description |
|---|---|
| `BreedGoal` | Finds a partner and breeds when in love mode. |
| `FollowParentGoal` | Baby animals follow their parent. |
| `TemptGoal` | Follows a player holding a specific `itemId`. Tracks `canScare` flag and `calmDown` timer. Reports `isRunning()` state. |
| `MakeLoveGoal` | Villager-specific breeding/love behavior. |
| `PlayGoal` | Young villagers play/run around. |

### Door goals

| Goal | Description |
|---|---|
| `DoorInteractGoal` | Base class for door interaction. Pathfinds to doors. |
| `OpenDoorGoal` | Opens doors and closes them after a delay. |
| `BreakDoorGoal` | Breaks down doors (used by zombies). |
| `RestrictOpenDoorGoal` | Prevents mobs from going through open doors. |

### Environment goals

| Goal | Description |
|---|---|
| `RestrictSunGoal` | Restricts the mob to shaded areas. |
| `EatTileGoal` | Sheep-specific: eats grass blocks. |
| `OfferFlowerGoal` | Iron golem offers a flower to a villager child. |
| `TakeFlowerGoal` | Villager child takes a flower from an iron golem. |

### Avoid goals

| Goal | Description |
|---|---|
| `AvoidPlayerGoal` | Runs away from a nearby player or entity. |

## Mob AI setup pattern

Mobs register goals in their constructor with priorities. A typical zombie might look like:

```
goalSelector.addGoal(0, FloatGoal)
goalSelector.addGoal(1, BreakDoorGoal)
goalSelector.addGoal(2, MeleeAttackGoal)
goalSelector.addGoal(3, MoveTowardsRestrictionGoal)
goalSelector.addGoal(4, MoveThroughVillageGoal)
goalSelector.addGoal(5, RandomStrollGoal)
goalSelector.addGoal(6, LookAtPlayerGoal)
goalSelector.addGoal(7, RandomLookAroundGoal)

targetSelector.addGoal(1, HurtByTargetGoal)
targetSelector.addGoal(2, NearestAttackableTargetGoal)
```

Lower priority numbers take precedence. Goals at the same priority level can coexist if their control flags don't conflict.

## MinecraftConsoles Differences

MC adds two new AI goal types that LCE doesn't have:

### RunAroundLikeCrazyGoal

Used by horses when they're being tamed. Makes the horse run around wildly to try to throw off the player. Once the horse is tamed, this goal stops firing.

### RangedAttackGoal

A new ranged attack goal that's separate from the existing `ArrowAttackGoal`. In LCE, `ArrowAttackGoal` handles both arrow-type and snowball-type ranged attacks. MC splits this out so `RangedAttackGoal` can be used by the Witch (for potion throwing) and the Skeleton (using the `RangedAttackMob` interface).

MC also adds `OcelotAttackGoal` as a separate file pair. In LCE, this goal exists but its source may be structured slightly differently.

### New mob AI setups

Since MC adds new mobs (Witch, Wither Boss, Bat, Horse), those mobs each bring their own goal configurations. For example:

- **Witch** uses `RangedAttackGoal` for potion attacks and standard movement/targeting goals
- **Horse** uses `RunAroundLikeCrazyGoal` during taming, plus the usual `PanicGoal`, `BreedGoal`, `FollowParentGoal`, and `RandomStrollGoal`
- **Wither Boss** has its own attack patterns (not simple goal-based AI)
- **Bat** has minimal AI since it just flies around randomly
