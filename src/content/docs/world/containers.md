---
title: Container Menus
description: Inventory management and container menu system in LCEMP.
---

LCEMP uses a two-layer container system: **Container** objects hold raw item data, and **AbstractContainerMenu** subclasses manage the GUI logic, slot layout, click handling, and synchronization between server and client.

## Container (data layer)

`Container` is the pure-virtual interface every item-holding object implements. It defines the fundamental storage contract.

**Key constants and methods:**

| Method | Purpose |
|---|---|
| `getContainerSize()` | Number of item slots |
| `getItem(slot)` | Read an item from a slot |
| `removeItem(slot, count)` | Split `count` items off a slot |
| `removeItemNoUpdate(slot)` | Remove without triggering listeners |
| `setItem(slot, item)` | Write an item into a slot |
| `getMaxStackSize()` | Default is `LARGE_MAX_STACK_SIZE` (64) |
| `setChanged()` | Mark the container as dirty for saving |
| `stillValid(player)` | Whether the player can still interact |
| `startOpen()` / `stopOpen()` | Lifecycle hooks (used by chests for animation) |

### Container implementations

| Class | Purpose | Notes |
|---|---|---|
| `SimpleContainer` | General-purpose fixed-size storage | Supports `ContainerListener` callbacks. Used as the base for many specialized containers. |
| `CraftingContainer` | 2D crafting grid | Wraps a width/height grid. Notifies its parent `AbstractContainerMenu` on changes. |
| `ResultContainer` | Single-slot output | Used for crafting and repair results. |
| `CompoundContainer` | Merges two containers | Delegates to `c1` and `c2` based on slot index. Used for double chests. |
| `MerchantContainer` | Villager trade slots | 3 slots: two payment, one result. Calls `updateSellItem()` on changes. Tracks `activeRecipe` and `selectionHint`. |
| `EnchantmentContainer` | Enchanting table input | Extends `SimpleContainer` with a max stack size of 1 and menu callbacks. |
| `RepairContainer` | Anvil input slots | Extends `SimpleContainer`. Triggers `RepairMenu::createResult()` on changes. |
| `PlayerEnderChestContainer` | Per-player ender chest | Extends `SimpleContainer`. Persists via NBT through `setItemsByTag()` / `createTag()`. Tracks the currently active `EnderChestTileEntity`. |

## AbstractContainerMenu (GUI layer)

`AbstractContainerMenu` is the base class for all inventory screens. It owns a list of `Slot` objects, tracks last-known slot contents for change detection, and manages a list of `ContainerListener` observers.

### Container ID constants

| Constant | Value | Meaning |
|---|---|---|
| `CONTAINER_ID_CARRIED` | -1 | The item on the cursor |
| `CONTAINER_ID_INVENTORY` | 0 | The player's own inventory |
| `CONTAINER_ID_CREATIVE` | -2 | Creative mode virtual inventory |
| `CLICKED_OUTSIDE` | -999 | Click was outside the GUI window |

### Click types

| Constant | Value | Behavior |
|---|---|---|
| `CLICK_PICKUP` | 0 | Normal left/right click to pick up or place items |
| `CLICK_QUICK_MOVE` | 1 | Shift-click to transfer between sections |
| `CLICK_SWAP` | 2 | Number-key swap with hotbar |
| `CLICK_CLONE` | 3 | Middle-click clone (creative mode only) |

### Core methods

- **`addSlot(Slot*)`** -- Registers a slot, assigning it a sequential index.
- **`broadcastChanges()`** -- Compares each slot against `lastSlots` and fires `ContainerListener::slotChanged()` on differences.
- **`clicked(slotIndex, buttonNum, clickType, player)`** -- The central click dispatcher. Handles pickup, quick-move, swap, and clone logic. Manages carried items via the player's `Inventory`.
- **`quickMoveStack(player, slotIndex)`** -- Virtual. Subclasses override to define shift-click transfer rules between slot regions.
- **`moveItemStackTo(itemStack, start, end, backwards)`** -- Helper that moves items into a slot range, first trying to stack with existing items, then filling empty slots.
- **`removed(player)`** -- Drops any carried item when the menu closes.
- **`stillValid(player)`** -- Pure virtual. Each subclass defines the distance/validity check.
- **`mayCombine(slot, item)`** -- Hook for dyeable armor and damaged item combination (4J addition).

### Synchronization

The menu tracks `unSynchedPlayers` -- a set of players whose client state is out of date. `isSynched()` and `setSynched()` control this flag. Change detection uses `ItemInstance::matches()` to compare current slot contents against `lastSlots` snapshots.

`MenuBackup` provides transactional rollback support, storing snapshots keyed by `changeUid`. It supports `save()`, `rollback()`, and `deleteBackup()`.

## Slot

`Slot` connects a `Container` position to a screen coordinate. Each slot holds a reference to its parent container, a slot index, and an `(x, y)` position for rendering.

**Key methods:**

| Method | Purpose |
|---|---|
| `mayPlace(item)` | Whether the item can be placed here (overridden for type-restricted slots) |
| `mayPickup(player)` | Whether the player can take the item out |
| `getMaxStackSize()` | Stack limit for this slot (delegates to container by default) |
| `set(item)` / `getItem()` | Read/write the slot contents |
| `remove(count)` | Split items off the slot |
| `onTake(player, item)` | Callback after a player takes items (used for achievements, XP) |
| `swap(other)` | Swap contents with another slot |
| `mayCombine(item)` | 4J addition for item combination support |
| `combine(item)` | 4J addition that performs the combination |
| `isAt(container, index)` | Identity check for finding a slot by its backing container and index |

Specialized slot subclasses exist within menus. For example, `BrewingStandMenu::PotionSlot` restricts placement to bottles and caps stack size at 1, while `BrewingStandMenu::IngredientsSlot` only accepts valid brewing ingredients.

## Menu subclasses

### InventoryMenu

The player's own inventory screen. Contains a 2x2 crafting grid, 4 armor slots, 27 main inventory slots, and 9 hotbar slots.

| Region | Constant | Range |
|---|---|---|
| Result | `RESULT_SLOT` | 0 |
| Crafting grid | `CRAFT_SLOT_START` .. `CRAFT_SLOT_END` | 1--4 |
| Armor | `ARMOR_SLOT_START` .. `ARMOR_SLOT_END` | 5--8 |
| Main inventory | `INV_SLOT_START` .. `INV_SLOT_END` | 9--35 |
| Hotbar | `USE_ROW_SLOT_START` .. `USE_ROW_SLOT_END` | 36--44 |

Overrides `slotsChanged()` to re-check crafting recipes. Supports `mayCombine` for dyeable armor.

### CraftingMenu

The 3x3 crafting table screen. Tied to a world position for the `stillValid()` distance check. Drops crafting grid contents on close via `removed()`.

### FurnaceMenu

Wraps a `FurnaceTileEntity`. Three data values are tracked and broadcast to listeners:

| Data ID | Meaning |
|---|---|
| 0 | `tickCount` (cook progress) |
| 1 | `litDuration` (total fuel time) |
| 2 | `litTime` (remaining fuel time) |

Shift-click logic routes fuel items to the fuel slot, smeltable items to the ingredient slot, and results to the player inventory.

### BrewingStandMenu

Wraps a `BrewingStandTileEntity`. Uses custom slot classes:

- **`PotionSlot`** -- Restricts to potion bottles, max stack 1. Fires an achievement on take.
- **`IngredientsSlot`** -- Restricts to valid brewing ingredients, max stack 1.

Broadcasts `brewTime` as data ID 0.

### EnchantmentMenu

Single input slot (max stack 1). Generates three random enchantment `costs[]` based on nearby bookshelves. `clickMenuButton()` applies the chosen enchantment, consuming player XP. Uses a `Random` seeded by `nameSeed`.

### MerchantMenu

Three slots: two payment inputs and one result output. Wraps a `Merchant` (villager) and a `MerchantContainer`. The `setSelectionHint()` method syncs the selected trade recipe from the trade list GUI.

### RepairMenu (Anvil)

Two input slots and one result slot. Computes `cost` (XP levels) via `createResult()`. Supports item renaming through `setItemName()`. The `DATA_TOTAL_COST` (0) data ID broadcasts the repair cost to listeners.

### TrapMenu (Dispenser/Dropper)

Simple 9-slot grid wrapping a `DispenserTileEntity`. No special slot logic beyond standard quick-move between dispenser and inventory.

### ContainerMenu (Generic chest)

Used for single and double chests. Calculates `containerRows` from the container size and creates the appropriate slot grid. Calls `startOpen()` / `stopOpen()` for chest animations.
