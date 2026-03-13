---
title: "Redstone Mechanics"
description: "Comparators, repeaters, and daylight detectors in MinecraftConsoles."
---

This page documents the redstone signal system, comparator logic, repeater delays, daylight detection, and powered rails as implemented in the MinecraftConsoles codebase.

## Signal constants

The `Redstone` class defines the fundamental signal range used throughout the redstone system:

| Constant | Value | Purpose |
|----------|-------|---------|
| `SIGNAL_NONE` | `0` | No signal / off |
| `SIGNAL_MIN` | `0` | Minimum signal strength |
| `SIGNAL_MAX` | `15` | Maximum signal strength |

All redstone components clamp their output to this 0--15 range.

## DiodeTile base class

Both the comparator and repeater inherit from `DiodeTile`, which itself extends `DirectionalTile`. `DiodeTile` provides the shared machinery for directional redstone components:

- **Directionality** -- Uses a 2-bit `DIRECTION_MASK` in the tile data to encode the facing of the component.
- **On/off state** -- Maintained via a boolean `on` field. Two tile IDs exist per component (one for the powered variant, one for the unpowered variant), returned by the pure-virtual `getOnTile()` and `getOffTile()` methods.
- **Input signal** -- `getInputSignal()` reads the redstone signal arriving from behind the component.
- **Alternate (side) signal** -- `getAlternateSignal()` and `getAlternateSignalAt()` read signals from the two sides, used for repeater locking and comparator subtract mode.
- **Tick scheduling** -- `checkTickOnNeighbor()` schedules a game tick when a neighbor changes, with optional priority support (`shouldPrioritize()`).
- **Locking** -- `isLocked()` returns whether a side signal locks the component (base implementation always returns `false`; the repeater overrides it).

The static helper `isDiode()` checks whether a given tile ID belongs to any diode-type component.

## Comparator

**Source files:** `ComparatorTile.h/cpp`, `ComparatorTileEntity.h/cpp`

The comparator extends both `DiodeTile` and `EntityTile`, requiring a tile entity to persist its output signal.

### Data bits

| Bit | Mask | Purpose |
|-----|------|---------|
| Bit 2 | `0x4` (`BIT_OUTPUT_SUBTRACT`) | Subtract mode enabled |
| Bit 3 | `0x8` (`BIT_IS_LIT`) | Comparator is visually lit |

The bottom two bits encode direction (inherited from `DiodeTile`).

### Modes

The comparator supports two modes, toggled by right-clicking (`use()`):

- **Compare mode** (default) -- Output equals the input signal, but only when the input is greater than or equal to the side (alternate) signal.
- **Subtract mode** (`BIT_OUTPUT_SUBTRACT` set) -- Output equals `max(input - alternate, 0)`.

The mode check is performed by `isReversedOutputSignal()`, which tests `(data & BIT_OUTPUT_SUBTRACT) == BIT_OUTPUT_SUBTRACT`. Despite the name, "reversed" means subtract mode is active.

### Signal calculation

`calculateOutputSignal()` implements the core logic:

```
if not subtract mode:
    return input signal
else:
    return max(input - alternate, SIGNAL_NONE)
```

`shouldTurnOn()` determines whether the comparator should be lit:

1. If the input signal is at maximum (15), always on.
2. If the input signal is zero, always off.
3. Otherwise, on when the input is greater than or equal to the alternate (side) signal.

### Analog input detection

`getInputSignal()` goes beyond basic redstone signal reading. After obtaining the standard diode input, it checks whether the tile behind the comparator `hasAnalogOutputSignal()`. If so, it reads the analog output (used for containers like chests and hoppers). If the immediate tile is a solid block, it checks one tile further for an analog source -- this enables reading through blocks.

### Turn-on delay

The comparator has a fixed turn-on delay of **2 redstone ticks** (returned by `getTurnOnDelay()`).

### Tile entity

`ComparatorTileEntity` stores a single `int output` field, persisted in NBT as `"OutputSignal"`. The tile entity is used by `getOutputSignal()` and `setOutputSignal()` to cache the comparator's last computed output, enabling the signal to be read by neighbors without recomputation.

### Tick behavior

When `tick()` fires, the comparator cleans up legacy "on" tile IDs by converting them to the off tile with `BIT_IS_LIT` set, then calls `refreshOutputState()`. This method:

1. Recalculates the output signal.
2. Updates the tile entity's stored output.
3. Flips `BIT_IS_LIT` on or off as needed.
4. Notifies neighbors in front of the comparator.

### Placement and removal

`onPlace()` calls the parent `DiodeTile::onPlace()` and creates a new `ComparatorTileEntity`. `onRemove()` removes the tile entity and updates front neighbors.

## Repeater

**Source files:** `RepeaterTile.h/cpp`

The repeater extends `DiodeTile` without requiring a tile entity.

### Delay system

The repeater supports four delay settings, stored in the upper bits of the tile data:

| Data bits | Mask | Purpose |
|-----------|------|---------|
| Bits 0--1 | `DIRECTION_MASK` | Facing direction |
| Bits 2--3 | `DELAY_MASK` (inverse of direction mask) | Delay index (0--3) |

The `DELAY_SHIFT` is `2`, so the delay index is extracted as `(data & DELAY_MASK) >> 2`.

The four delay values in redstone ticks:

| Index | Base delay | Actual delay (`base * 2`) |
|-------|-----------|---------------------------|
| 0 | 1 | 2 game ticks |
| 1 | 2 | 4 game ticks |
| 2 | 3 | 6 game ticks |
| 3 | 4 | 8 game ticks |

`getTurnOnDelay()` returns `DELAYS[index] * 2`.

### Cycling delay

Right-clicking (`use()`) increments the delay index by 1, wrapping around from index 3 back to 0. The operation preserves the direction bits and sets `UPDATE_ALL` for both client and server updates.

### Locking

The repeater overrides `isLocked()` to return `true` when `getAlternateSignal() > SIGNAL_NONE` -- meaning a side signal from another diode locks the repeater's current output state.

`isAlternateInput()` restricts side inputs to other diode tiles only (via `isDiode()`), so only repeaters and comparators can lock a repeater.

### Render offsets

The four delay render offsets position the movable torch visually:

```
{-1/16, 1/16, 3/16, 5/16}
```

### Particle effects

When powered (`on == true`), `animateTick()` spawns `reddust` particles on either the receiver or transmitter end of the repeater, with the position offset based on the current delay setting.

## Daylight detector

**Source files:** `DaylightDetectorTile.h/cpp`, `DaylightDetectorTileEntity.h/cpp`

The daylight detector is a `BaseEntityTile` that emits a redstone signal proportional to the sky light level.

### Shape

The detector is a flat slab with a height of 6/16 of a block. It is not a full cube (`isCubeShaped()` returns `false`) and is not solid (`isSolidRender()` returns `false`).

### Signal strength calculation

`updateSignalStrength()` computes the output signal:

1. Skips entirely if the dimension has a ceiling (`dimension->hasCeiling`).
2. Reads the sky brightness at the block's position, minus the current sky darkening.
3. Factors in the sun's angle using `cos(sunAngle)`, with the angle tilted 20% toward zenith for a smoother day/night transition.
4. Clamps the result to the range `[0, SIGNAL_MAX]`.
5. Updates the tile data only if the value changed, with `UPDATE_ALL` propagation.

`getSignal()` simply reads and returns the stored tile data, meaning the data byte itself holds the signal strength (0--15).

### Tile entity tick

`DaylightDetectorTileEntity::tick()` runs every second (`getGameTime() % TICKS_PER_SECOND == 0`) on the server side, calling `updateSignalStrength()` on its parent tile. This means the signal updates once per second rather than every game tick.

### Textures

Two textures are registered: `_top` for the upper face and `_side` for all other faces.

## Powered rails

**Source files:** `PoweredRailTile.h/cpp`, `BaseRailTile.h/cpp`

### BaseRailTile foundation

All rail types inherit from `BaseRailTile`, which provides:

- **Direction constants** -- `DIR_FLAT_Z` (0), `DIR_FLAT_X` (1), plus slopes (2--5) and curves (6--9).
- **Data bit** -- `RAIL_DATA_BIT` (0x8) is used by powered and detector rails to store their active state. Regular rails use the full data range for direction.
- **Direction mask** -- `RAIL_DIRECTION_MASK` (0x7) extracts direction from tiles that use the data bit.
- **Rail detection** -- `isRail()` checks if a tile ID is any rail type: normal rail, golden (powered) rail, detector rail, or activator rail.

The inner `Rail` class handles connection logic:

- Each rail can have up to **2 connections** to neighboring rails.
- Rails auto-connect to neighbors during placement via `place()`.
- Slope detection checks one block above for rails in the X and Z directions.
- Curved directions (6--9) are only available to rails that don't use the data bit (i.e., normal rails).
- Piston push reaction is overridden to `PUSH_NORMAL` instead of the decoration material default.

The `neighborChanged()` method checks structural validity: the rail pops off if the block below it is not solid, or if a sloped rail loses its supporting block at the upper end.

### PoweredRailTile

The powered rail extends `BaseRailTile` with `usesDataBit = true`. It uses bit 3 (`RAIL_DATA_BIT`) to store the powered/unpowered state.

**Power propagation:**

`updateState()` determines the powered state from three sources:

1. Direct redstone neighbor signal (`hasNeighborSignal()`).
2. Forward chain search (`findPoweredRailSignal(level, ..., true, 0)`).
3. Backward chain search (`findPoweredRailSignal(level, ..., false, 0)`).

The chain search (`findPoweredRailSignal()`) recursively follows connected powered rails up to a depth of **8 rails**. At each step:

- It moves forward or backward along the rail's axis, handling slopes by adjusting the Y coordinate.
- `isSameRailWithPower()` verifies the neighbor is the same rail type, checks directional compatibility, and either confirms a direct redstone signal or recurses deeper.

When the powered state changes, the rail updates its data and notifies neighbors. For sloped rails (directions 2--5), it also updates neighbors at `y + 1`.

**Textures:**

Two textures are used: the default `icon` for unpowered and `iconPowered` (registered as `_powered` suffix) for the active state.

## Related pages

- [Hoppers and Droppers](/lcemp-docs/mc/hoppers-droppers/) -- Hopper mechanics including analog output for comparators
- [Minecart Variants](/lcemp-docs/mc/minecarts/) -- Powered rail interaction with minecarts
