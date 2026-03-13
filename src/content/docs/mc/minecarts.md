---
title: "Minecart Variants"
description: "Chest, hopper, furnace, spawner, and TNT minecarts."
---

This page covers the minecart entity system in MinecraftConsoles, including the base `Minecart` class, the `MinecartContainer` abstraction, and each specialized variant.

## Base Minecart

**Source files:** `Minecart.h/cpp`

All minecart variants inherit from `Minecart`, which extends `Entity`.

### Type constants

| Constant | Value | Variant |
|----------|-------|---------|
| `TYPE_RIDEABLE` | 0 | Player-rideable minecart |
| `TYPE_CHEST` | 1 | Chest minecart |
| `TYPE_FURNACE` | 2 | Furnace (powered) minecart |
| `TYPE_TNT` | 3 | TNT minecart |
| `TYPE_SPAWNER` | 4 | Spawner minecart |
| `TYPE_HOPPER` | 5 | Hopper minecart |

### Synched data IDs

| ID | Field | Purpose |
|----|-------|---------|
| 17 | `DATA_ID_HURT` | Hurt animation time |
| 18 | `DATA_ID_HURTDIR` | Hurt direction |
| 19 | `DATA_ID_DAMAGE` | Accumulated damage |
| 20 | `DATA_ID_DISPLAY_TILE` | Custom display tile ID |
| 21 | `DATA_ID_DISPLAY_OFFSET` | Display tile Y offset |
| 22 | `DATA_ID_CUSTOM_DISPLAY` | Whether custom display is active |

### Factory method

`createMinecart()` is a static factory that creates the right variant based on the type integer.

### Core behavior

- **Collision**: Minecarts have both a collide-against box (for other entities pushing them) and a collide box (for physics). They are pushable.
- **Ride height**: `getRideHeight()` sets the passenger offset.
- **Damage**: `hurt()` animates the hurt effect and accumulates damage. `destroy()` is called when the minecart breaks; variants override this to drop their specific loot.
- **Movement**: `tick()` handles interpolation, rail following, and natural slowdown. `moveAlongTrack()` does rail-specific movement using an exit direction lookup table (`EXITS`). `comeOffTrack()` handles derailed movement with speed capping.
- **Activation**: `activateMinecart()` is called when the minecart passes over an activator rail. The base implementation does nothing; TNT and hopper minecarts override it.
- **Entity pushing**: `push()` handles minecart-to-entity and minecart-to-minecart collisions, with a `m_bHasPushedCartThisTick` guard (a 4J addition) to prevent double-pushing in one tick.

### Client interpolation

`lerpTo()` and `lerpMotion()` handle smooth position and rotation interpolation over a given number of steps, using stored `lx`, `ly`, `lz`, `lyr`, `lxr` values.

### Custom display

Each variant provides `getDefaultDisplayTile()`, `getDefaultDisplayData()`, and `getDefaultDisplayOffset()`. The display can be overridden at runtime via `setDisplayTile()`, `setDisplayData()`, and `setDisplayOffset()`, with `hasCustomDisplay()` tracking whether a custom override is active.

## MinecartContainer

**Source files:** `MinecartContainer.h/cpp`

`MinecartContainer` is an intermediate class that combines `Minecart` with the `Container` interface, providing shared inventory logic for the chest and hopper variants.

### Inventory

- **36 slots** initialized as `ItemInstanceArray(9 * 4)`.
- Max stack size: `LARGE_MAX_STACK_SIZE` (64).
- All slots accept any item (`canPlaceItem()` always returns `true`).

### Item drop on destruction

Both `destroy()` and `remove()` go through all container slots and spawn the contents as `ItemEntity` instances. The `remove()` method checks a `dropEquipment` flag, which is set to `false` during dimension changes to prevent duplication.

### Natural slowdown

`applyNaturalSlowdown()` adjusts the deceleration based on how full the container is:

```
emptiness = SIGNAL_MAX - getRedstoneSignalFromContainer(this)
keep = 0.98 + (emptiness * 0.001)
xd *= keep
zd *= keep
```

So a fuller container minecart slows down faster (lower `keep` multiplier).

### Player interaction

`interact()` opens the container UI for the player on the server side via `player->openContainer()`.

### NBT serialization

Items are saved as a `"Items"` list tag, with each entry containing a `"Slot"` byte and the item's compound data.

## MinecartChest

**Source files:** `MinecartChest.h/cpp`

The chest minecart is the simplest container variant.

| Property | Value |
|----------|-------|
| Type | `TYPE_CHEST` (1) |
| Container size | 27 slots (`9 * 3`) |
| Display tile | `Tile::chest` |
| Display offset | 8 |
| Loot on destroy | Drops a chest block |
| Container type | `ContainerOpenPacket::MINECART_CHEST` |

When destroyed, it calls `MinecartContainer::destroy()` (dropping all items) and also spawns a chest tile as loot via `spawnAtLocation()`.

## MinecartHopper

**Source files:** `MinecartHopper.h/cpp`

The hopper minecart combines `MinecartContainer` with the `Hopper` interface, so it can suck in items while moving.

| Property | Value |
|----------|-------|
| Type | `TYPE_HOPPER` (5) |
| Container size | 5 slots |
| Display tile | `Tile::hopper` |
| Display offset | 1 |
| Loot on destroy | Drops a hopper block |

### Cooldown

The hopper minecart has its own `MOVE_ITEM_SPEED`, set to **half** the tile hopper's speed:

```cpp
const int MinecartHopper::MOVE_ITEM_SPEED = HopperTileEntity::MOVE_ITEM_SPEED / 2;
```

This works out to **4 ticks** (vs. the tile hopper's 8 ticks), so minecart hoppers transfer items twice as fast.

### Enable/disable via activator rail

`activateMinecart()` toggles the `enabled` flag. When the activator rail is powered, the hopper is **disabled** (`newEnabled = !state`). This matches vanilla behavior where a redstone signal turns hoppers off.

### Tick behavior

Each tick (server side, while alive and enabled):

1. Decrements `cooldownTime`.
2. If not on cooldown, calls `suckInItems()`.
3. On successful intake, resets cooldown to `MOVE_ITEM_SPEED` (4 ticks).

### Item collection

`suckInItems()` works two ways:

1. **Container above**: Delegates to `HopperTileEntity::suckInItems(this)`, which checks for containers in the block above.
2. **Loose items**: Searches for `ItemEntity` instances in a slightly expanded bounding box (`bb->grow(0.25, 0, 0.25)`) and absorbs the first one found.

### Player interaction

`interact()` opens the hopper UI via `player->openHopper()`.

### NBT

Saves and loads `"TransferCooldown"` in addition to the base container data.

## MinecartFurnace

**Source files:** `MinecartFurnace.h/cpp`

The furnace minecart is a self-propelled minecart that doesn't have an inventory.

| Property | Value |
|----------|-------|
| Type | `TYPE_FURNACE` (2) |
| Display tile | `Tile::furnace_lit` |
| Display data | 2 |

### Fuel system

The furnace minecart uses a simple fuel counter (`int fuel`) and tracks its push direction (`xPush`, `zPush`).

- **Synched data**: `DATA_ID_FUEL` (ID 16) stores a byte indicating whether the furnace has fuel, synced to clients for rendering.
- **Adding fuel**: Right-clicking (`interact()`) with coal adds `TICKS_PER_SECOND * 180` ticks of fuel (3 minutes at 20 TPS = 3600 ticks). The push direction is set toward the player's position relative to the minecart.
- **Tick**: Each tick, fuel decrements by 1. When fuel hits zero, push forces are cleared. While fueled, large smoke particles spawn above the minecart (25% chance per tick).

### Movement

`moveAlongTrack()` applies the push direction after the base rail movement. The push vector is normalized and aligned with the minecart's current velocity direction. If the push opposes the current motion, the push gets zeroed out.

`applyNaturalSlowdown()` works differently from container minecarts:

- **Fueled**: Velocity is dampened by 0.8, then a push force of 0.05 is applied in the push direction.
- **Not fueled**: Standard 0.98 dampening.

### Destruction

When destroyed (not by explosion), the minecart drops a furnace block as loot.

### NBT

| Tag | Type | Purpose |
|-----|------|---------|
| `"PushX"` | Double | X push direction |
| `"PushZ"` | Double | Z push direction |
| `"Fuel"` | Short | Remaining fuel ticks |

## MinecartSpawner

**Source files:** `MinecartSpawner.h/cpp`

The spawner minecart carries a mob spawner that runs while the minecart moves.

| Property | Value |
|----------|-------|
| Type | `TYPE_SPAWNER` (4) |
| Display tile | `Tile::mobSpawner` |

### Inner spawner

`MinecartMobSpawner` is a private inner class extending `BaseMobSpawner`. It bridges the spawner logic to the minecart entity:

- `getLevel()` returns the minecart's level.
- `getX()`, `getY()`, `getZ()` return the minecart's floored position.
- `broadcastEvent()` sends entity events through the minecart.

### Tick

`tick()` calls both `Minecart::tick()` and `spawner->tick()`, keeping the mob spawner active as the minecart moves.

### Entity events

`handleEntityEvent()` forwards events to the spawner's `onEventTriggered()`, which handles client-side spawn particle effects.

### NBT

The spawner's data is saved and loaded via `spawner->save(tag)` and `spawner->load(tag)`, embedding the spawner configuration directly in the minecart's compound tag.

## MinecartTNT

**Source files:** `MinecartTNT.h/cpp`

The TNT minecart explodes under various conditions.

| Property | Value |
|----------|-------|
| Type | `TYPE_TNT` (3) |
| Display tile | `Tile::tnt` |
| Fuse time | 80 ticks (4 seconds) |
| Event ID | `EVENT_PRIME` (10) |

### Priming

The fuse starts at `-1` (not primed). The minecart can be primed by:

- **Activator rail**: `activateMinecart()` calls `primeFuse()` when `state` is true and the fuse isn't already active.
- **Programmatic**: `primeFuse()` sets `fuse = 80`, broadcasts the prime event, and plays the fuse sound. Priming is gated by the `eGameHostOption_TNT` game option.

### Tick behavior

Each tick while primed (`fuse > 0`):

1. Fuse decrements by 1.
2. Smoke particles spawn above the minecart.
3. When fuse reaches 0, `explode()` is called.

Also, if the minecart collides horizontally (`horizontalCollision`) with enough speed (`speedSqr >= 0.01`), it explodes immediately.

### Explosion

`explode()` creates a level explosion with power based on speed:

```
speed = sqrt(speedSqr), capped at 5
power = 4 + random(1.5) * speed
```

The explosion can start fires (`true` parameter). The minecart is removed after exploding. If the TNT game option is disabled, the minecart is just removed without an explosion.

### Fall damage

`causeFallDamage()` triggers an explosion when the fall distance is 3 or more blocks, with power scaled by `(distance / 10)^2`.

### Destruction

When destroyed by damage:

- If TNT is disabled or the source is not an explosion: drops a TNT block.
- If the source is fire, an explosion, or the minecart has speed: explodes.

### Explosion resistance override

When primed, the TNT minecart reduces explosion resistance of rail tiles to 0 and prevents rails from being destroyed by the explosion. This keeps the track intact beneath the detonation.

### NBT

| Tag | Type | Purpose |
|-----|------|---------|
| `"TNTFuse"` | Int | Current fuse value (-1 if not primed) |

## MinecartRideable

**Source file:** `MinecartRideable.h`

The rideable minecart is the simplest variant with type `TYPE_RIDEABLE` (0). Its `interact()` method lets a player mount the minecart. No container, no special behavior, no additional save data.

## Related pages

- [Redstone Mechanics](/lce-docs/mc/redstone/) for powered rail signal propagation
- [Hoppers and Droppers](/lce-docs/mc/hoppers-droppers/) for the tile hopper transfer logic shared with MinecartHopper
