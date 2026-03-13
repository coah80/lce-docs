---
title: "Hoppers & Droppers"
description: "Hopper and dropper tile entities and menus."
---

This page covers the hopper and dropper systems in MinecraftConsoles, including item transfer mechanics, cooldown timers, container interaction, redstone control, and the hopper menu UI.

## Hopper interface

**Source file:** `Hopper.h`

The `Hopper` abstract class extends `Container` and defines the interface for anything that acts as a hopper (both the tile entity and the minecart hopper):

- `getLevel()` returns the world reference.
- `getLevelX()`, `getLevelY()`, `getLevelZ()` are position accessors for item pickup.

## HopperTile

**Source files:** `HopperTile.h/cpp`

`HopperTile` extends `BaseEntityTile` and manages the block-level behavior of hoppers.

### Data bits

| Mask | Constant | Purpose |
|------|----------|---------|
| `0x7` | `MASK_ATTACHED` | Attached face direction (which way the hopper outputs) |
| `0x8` | `MASK_TOGGLE` | Disabled by redstone when set |

### Placement direction

`getPlacedOnFaceDataValue()` sets the hopper's output direction to the opposite of the face it was placed against. If the result would be `UP`, it gets forced to `DOWN` since hoppers never output upward.

### Redstone control

`checkPoweredState()` runs on placement and whenever a neighbor changes. It checks `hasNeighborSignal()`:

- **No redstone signal**: Hopper is enabled (toggle bit clear).
- **Redstone signal present**: Hopper is disabled (toggle bit set).

The helper `isTurnedOn()` checks `(data & MASK_TOGGLE) != MASK_TOGGLE`, so the hopper is active when the toggle bit is **not** set.

### Collision shape

The hopper has a complex collision model built from five AABBs in `addAABBs()`:

1. A top basin (full width, 10/16 tall).
2. Four thin walls (2/16 thick) on each side, extending to full height.

### Custom naming

If the item used to place the hopper has a custom hover name, it gets passed to the tile entity via `setCustomName()`.

### Analog output

`hasAnalogOutputSignal()` returns `true`, and `getAnalogOutputSignal()` delegates to `AbstractContainerMenu::getRedstoneSignalFromContainer()`. This is what lets comparators read the hopper's fullness level.

### Block removal

When the hopper block is broken, `onRemove()` goes through all container slots and spawns each item stack as `ItemEntity` instances in the world with randomized positions and velocities, then calls `updateNeighbourForOutputSignal()` to let comparators know.

### Textures

Three textures are registered: `hopper_outside`, `hopper_top`, and `hopper_inside` (used by the renderer for the inner funnel).

## HopperTileEntity

**Source files:** `HopperTileEntity.h/cpp`

The tile entity handles item storage, transfer logic, and cooldown management.

### Container

- **5 slots** initialized as `ItemInstanceArray(5)`.
- Max stack size: `LARGE_MAX_STACK_SIZE` (64).
- Validation distance: player must be within 8 blocks (`distanceToSqr <= 64`).

### Cooldown system

| Constant | Value | Purpose |
|----------|-------|---------|
| `MOVE_ITEM_SPEED` | `8` | Ticks between item transfers |

The `cooldownTime` field starts at `-1`. The `tick()` method decrements it each tick. When cooldown hits zero or below, `tryMoveItems()` is called. A successful transfer resets the cooldown to `MOVE_ITEM_SPEED` (8 ticks).

### Item transfer flow

`tryMoveItems()` runs only when the hopper is enabled (`isTurnedOn()`) and not on cooldown:

1. **Eject**: `ejectItems()` tries to push one item from any hopper slot into the attached container.
2. **Suck**: `suckInItems()` tries to pull one item from the container above.

If either operation succeeds, the cooldown resets to 8 ticks.

### Ejecting items

`ejectItems()` gets the container at the attached face position via `getAttachedContainer()`. For each non-empty slot, it:

1. Copies the original item (for rollback).
2. Removes 1 item from the slot.
3. Calls `addItem()` on the destination container with the opposite facing.
4. If the destination rejects the item, restores the original.

### Sucking items

`suckInItems()` works in two modes:

1. **Container above**: If `getSourceContainer()` finds a container one block above, it goes through the source's slots (respecting `WorldlyContainer` face restrictions with `getSlotsForFace(DOWN)`). For each item, `tryTakeInItemFromSlot()` pulls one item.
2. **Loose items**: If there's no container above, `getItemAt()` searches for `ItemEntity` instances in the block above and absorbs them.

### WorldlyContainer support

The hopper respects `WorldlyContainer` interfaces for both input and output. `canPlaceItemInContainer()` and `canTakeItemFromContainer()` check `canPlaceItemThroughFace()` and `canTakeItemThroughFace()` respectively, which allows sided inventory restrictions (like furnaces).

### Item merging

`tryMoveInItem()` handles placing items into a destination slot:

- If the slot is empty, the item goes in directly.
- If the slot has a matching item (same ID, aux value, and tags), items get merged up to the max stack size.
- When an item is added to another hopper, that hopper's cooldown also gets set to `MOVE_ITEM_SPEED`.

`canMergeItems()` validates merge compatibility: matching item ID, matching aux value, count within stack limit, and matching NBT tags.

### Container discovery

`getContainerAt()` searches for a container at a given position:

1. First checks for a tile entity implementing `Container`.
2. Special-cases `ChestTileEntity` to get the merged double-chest container via `ChestTile::getContainer()`.
3. If no tile entity container is found, it searches for entity-based containers (e.g., minecart chests) in the block's AABB, picking one at random if multiple exist.

### NBT serialization

| Tag | Type | Purpose |
|-----|------|---------|
| `"Items"` | List of CompoundTags | Inventory contents (each with `"Slot"` byte) |
| `"TransferCooldown"` | Int | Current cooldown value |
| `"CustomName"` | String | Optional custom name |

## HopperMenu

**Source files:** `HopperMenu.h/cpp`

The hopper menu provides a 5-slot container interface.

### Slot layout

| Range | Constant | Purpose |
|-------|----------|---------|
| 0 to 4 | `CONTENTS_SLOT_START` | Hopper inventory (5 slots) |
| 5 to 31 | `INV_SLOT_START` | Player inventory (27 slots) |
| 32 to 40 | `USE_ROW_SLOT_START` | Player hotbar (9 slots) |

The hopper slots are laid out horizontally at pixel position `(44 + slot * 18, 20)` with the player inventory starting 51 pixels below.

### Quick-move (shift-click)

`quickMoveStack()` moves items between the hopper and player inventory:

- From hopper slots: moves to player inventory (preferring the far end first).
- From player inventory: moves into hopper slots.

## DropperTile

**Source files:** `DropperTile.h/cpp`

The dropper extends `DispenserTile`, inheriting the dispenser's facing system (`FACING_MASK = 0x7`, `TRIGGER_BIT = 8`) and redstone activation logic.

### Key differences from dispenser

The dropper overrides `getDispenseMethod()` to always return `DefaultDispenseItemBehavior`, regardless of the item type. The dispenser uses item-specific behaviors (like shooting arrows or placing boats), but the dropper uses the same generic drop behavior for everything.

### Dropper-to-container transfer

`dispenseFrom()` contains the dropper's unique logic:

1. Gets a random occupied slot from the `DispenserTileEntity`.
2. Checks for a container at the position the dropper faces.
3. **Container found**: Uses `HopperTileEntity::addItem()` to transfer one item into the adjacent container, respecting facing. If the transfer fails, the original item is preserved.
4. **No container**: Falls back to `DefaultDispenseItemBehavior::dispense()`, which drops the item into the world.

### Tile entity

`DropperTileEntity` extends `DispenserTileEntity` and only overrides `getName()` to return the dropper-specific localization string (`IDS_CONTAINER_DROPPER`).

### Textures

The dropper registers its own front textures (`_front_horizontal` and `_front_vertical`) but shares the furnace side and top textures with the dispenser.

## Related pages

- [Redstone Mechanics](/lce-docs/mc/redstone/) for comparator analog signal reading from hoppers
- [Minecart Variants](/lce-docs/mc/minecarts/) for the minecart hopper and minecart chest
