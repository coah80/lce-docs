---
title: Container Menus
description: Inventory management and container menu system in LCE.
---

LCE uses a two-layer container system: **Container** objects hold the raw item data, and **AbstractContainerMenu** subclasses manage the GUI logic, slot layout, click handling, and sync between server and client.

## Container (data layer)

`Container` is the pure-virtual interface that every item-holding object implements. It defines the basic storage contract.

**Key constants and methods:**

| Method | Purpose |
|---|---|
| `getContainerSize()` | Number of item slots |
| `getItem(slot)` | Read an item from a slot |
| `removeItem(slot, count)` | Split `count` items off a slot. Returns the removed items, or null if the slot is empty. All implementations include 4J's duplication fix: if the resulting count is 0 or less, returns null. |
| `removeItemNoUpdate(slot)` | Remove the entire stack without triggering listeners |
| `setItem(slot, item)` | Write an item into a slot. Clamps count to `getMaxStackSize()` if it exceeds it. |
| `getMaxStackSize()` | Default is `LARGE_MAX_STACK_SIZE` (64) |
| `getName()` | Returns a localization string ID for the container name |
| `setChanged()` | Mark the container as dirty for saving |
| `stillValid(player)` | Whether the player can still interact (usually a 64-block distance check: `distanceToSqr() > 8 * 8`) |
| `startOpen()` / `stopOpen()` | Lifecycle hooks (used by chests for animation, empty in most other containers) |

### Container implementations

| Class | Purpose | Notes |
|---|---|---|
| `SimpleContainer` | General-purpose fixed-size storage | Supports `ContainerListener` callbacks via `addListener()` / `removeListener()`. Has a `name` (localization ID), `size`, `items` array, and a `listeners` vector. |
| `CraftingContainer` | 2D crafting grid | Wraps a width/height grid. Notifies its parent `AbstractContainerMenu` on changes via `slotsChanged()`. |
| `ResultContainer` | Single-slot output | Used for crafting and repair results. |
| `CompoundContainer` | Merges two containers | Delegates to `c1` and `c2` based on slot index. Used for double chests. If the slot index is less than `c1`'s size, reads from `c1`; otherwise reads from `c2` with an offset. |
| `MerchantContainer` | Villager trade slots | 3 slots: two payment, one result. Calls `updateSellItem()` on changes. Tracks `activeRecipe` and `selectionHint`. |
| `EnchantmentContainer` | Enchanting table input | Extends `SimpleContainer` with a max stack size of 1 and menu callbacks. |
| `RepairContainer` | Anvil input slots | Extends `SimpleContainer`. Triggers `RepairMenu::createResult()` on changes via `enable_shared_from_this<RepairContainer>`. |
| `PlayerEnderChestContainer` | Per-player ender chest | Extends `SimpleContainer`. Persists through NBT with `setItemsByTag()` / `createTag()`. Tracks the currently active `EnderChestTileEntity`. |

## AbstractContainerMenu (GUI layer)

`AbstractContainerMenu` is the base class for all inventory screens. It owns a list of `Slot` objects, tracks last-known slot contents for change detection, and manages a list of `ContainerListener` observers.

### Fields

| Field | Type | Purpose |
|---|---|---|
| `slots` | `vector<Slot*>*` | All slots in the menu |
| `lastSlots` | `vector<shared_ptr<ItemInstance>>*` | Snapshot of each slot's contents for change detection |
| `containerId` | `int` | Menu ID for network sync |
| `changeUid` | `short` | Backup/rollback version number (private) |
| `m_bNeedsRendered` | `bool` | 4J addition: whether the UI needs a render update |
| `containerListeners` | `vector<ContainerListener*>*` | Observers that get notified on changes |
| `unSynchedPlayers` | `unordered_set<shared_ptr<Player>>` | Players whose client state is out of date |

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

| Method | Purpose |
|---|---|
| `addSlot(Slot*)` | Registers a slot, giving it a sequential `index`. Returns the slot pointer. |
| `addSlotListener(ContainerListener*)` | Adds a listener and immediately sends it the current state of all slots |
| `getItems()` | Returns the `lastSlots` vector |
| `sendData(id, value)` | Sends a data value to all listeners via `ContainerListener::dataChanged()` |
| `broadcastChanges()` | Compares each slot against `lastSlots` using `ItemInstance::matches()`. For any changed slot, fires `ContainerListener::slotChanged()` and updates the snapshot. Resets `m_bNeedsRendered`. |
| `needsRendered()` | Returns `m_bNeedsRendered` (4J addition) |
| `clickMenuButton(player, buttonId)` | Virtual. Used by enchanting and beacon menus for button-based interactions. Returns false by default. |
| `getSlotFor(container, index)` | Finds a slot by its backing container and index using `Slot::isAt()` |
| `getSlot(index)` | Direct slot access by menu index |
| `quickMoveStack(player, slotIndex)` | Virtual. Subclasses override this to define shift-click transfer rules between slot regions. |
| `clicked(slotIndex, buttonNum, clickType, player)` | The main click dispatcher. Handles pickup, quick-move, swap, and clone logic. Manages carried items through the player's `Inventory`. Returns the item that was in the slot before the click. |
| `mayCombine(slot, item)` | Hook for dyeable armor and damaged item combination (4J addition). Returns false by default. |
| `loopClick(slotIndex, buttonNum, quickKeyHeld, player)` | Virtual. For iterating click behavior (protected). |
| `removed(player)` | Drops any carried item when the menu closes |
| `slotsChanged()` | Virtual. Called when a backing container changes. 4J simplified this to take no arguments (used to take a `Container*`). |
| `setItem(slot, item)` | Sets a specific slot's contents |
| `setAll(items)` | Sets all slot contents from an array |
| `setData(id, value)` | Virtual. Sets a data value and notifies listeners. |
| `backup(inventory)` | Creates a `MenuBackup` snapshot and returns the `changeUid` |
| `isSynched(player)` / `setSynched(player, bool)` | Manage the `unSynchedPlayers` set |
| `stillValid(player)` | Pure virtual. Each subclass defines the distance/validity check. |
| `moveItemStackTo(itemStack, start, end, backwards)` | Helper that moves items into a slot range, first trying to stack with existing items, then filling empty slots. The `backwards` flag reverses the scan order. Returns true if any items were moved. |
| `isOverrideResultClick(slotNum, buttonNum)` | Virtual. Returns false by default. |
| `getSize()` | 4J addition: returns the slot count as `unsigned int` |

### Synchronization

The menu tracks `unSynchedPlayers`, a set of players whose client state is out of date. `isSynched()` and `setSynched()` control this flag. Change detection uses `ItemInstance::matches()` to compare current slot contents against `lastSlots` snapshots.

`MenuBackup` provides transactional rollback support, storing snapshots keyed by `changeUid`. It supports `save()`, `rollback()`, and `deleteBackup()`.

## Slot

`Slot` connects a `Container` position to a screen coordinate. Each slot holds a reference to its parent container, a slot index, and an `(x, y)` position for rendering.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `container` | `shared_ptr<Container>` | The backing container |
| `slot` | `int` | The slot index within the container (private) |
| `index` | `int` | The slot's position in the menu's slot list |
| `x`, `y` | `int` | Screen position for rendering |

**Key methods:**

| Method | Purpose |
|---|---|
| `mayPlace(item)` | Whether the item can go here (returns true by default, overridden for type-restricted slots) |
| `mayPickup(player)` | Whether the player can take the item out (returns true by default) |
| `getMaxStackSize()` | Stack limit for this slot (delegates to container by default) |
| `set(item)` / `getItem()` | Read/write the slot contents through the backing container |
| `hasItem()` | Whether the slot is non-empty |
| `remove(count)` | Split items off the slot via `container->removeItem()` |
| `onTake(player, item)` | Callback after a player takes items (used for achievements, XP drops) |
| `onQuickCraft(picked, original)` | Called during quick-craft to track amounts |
| `checkTakeAchievements(picked)` | Protected. Fires achievement checks after taking items. |
| `swap(other)` | Swap contents with another slot |
| `mayCombine(item)` | 4J addition for item combination support (returns false by default) |
| `combine(item)` | 4J addition that does the combination (returns the item unchanged by default) |
| `isAt(container, index)` | Identity check: returns true if this slot's backing container and slot index match |
| `setChanged()` | Calls `container->setChanged()` |
| `getNoItemIcon()` | Returns the icon to show in an empty slot (null by default) |

Specialized slot subclasses exist within menus. For example, `BrewingStandMenu::PotionSlot` only allows bottles and caps stack size at 1, while `BrewingStandMenu::IngredientsSlot` only accepts valid brewing ingredients.

## Menu subclasses

### InventoryMenu

The player's own inventory screen. Has a 2x2 crafting grid, 4 armor slots, 27 main inventory slots, and 9 hotbar slots.

| Region | Constant | Range |
|---|---|---|
| Result | `RESULT_SLOT` | 0 |
| Crafting grid | `CRAFT_SLOT_START` .. `CRAFT_SLOT_END` | 1-4 |
| Armor | `ARMOR_SLOT_START` .. `ARMOR_SLOT_END` | 5-8 |
| Main inventory | `INV_SLOT_START` .. `INV_SLOT_END` | 9-35 |
| Hotbar | `USE_ROW_SLOT_START` .. `USE_ROW_SLOT_END` | 36-44 |

Overrides `slotsChanged()` to re-check crafting recipes. Supports `mayCombine` for dyeable armor.

### CraftingMenu

The 3x3 crafting table screen. Tied to a world position for the `stillValid()` distance check. Drops crafting grid contents on close through `removed()`.

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

- **`PotionSlot`**: Only takes potion bottles, max stack 1. Fires an achievement on take.
- **`IngredientsSlot`**: Only takes valid brewing ingredients, max stack 1.

Broadcasts `brewTime` as data ID 0.

### EnchantmentMenu

Single input slot (`INGREDIENT_SLOT` = 0, max stack 1). Followed by player inventory slots starting at `INV_SLOT_START` (1) through hotbar ending at `USE_ROW_SLOT_END`.

Generates three random enchantment `costs[]` based on nearby bookshelves when `slotsChanged()` is called. The `m_costsChanged` flag (4J addition) tracks whether costs need to be re-broadcast.

`clickMenuButton()` applies the chosen enchantment at index `i` (0-2), spending player XP. Uses a `Random` seeded by `nameSeed`.

### MerchantMenu

Three slots: two payment inputs (`PAYMENT1_SLOT` = 0, `PAYMENT2_SLOT` = 1) and one result output (`RESULT_SLOT` = 2). Wraps a `Merchant` (villager) and a `MerchantContainer`.

Screen coordinates for the trade slots:
- `SELLSLOT1_X` = 36, `SELLSLOT2_X` = 62, `BUYSLOT_X` = 120
- `ROW1_Y` = 24, `ROW2_Y` = 53

The `setSelectionHint()` method syncs the selected trade recipe from the trade list GUI. `getMerchant()` is a 4J addition.

### RepairMenu (Anvil)

Two input slots (`INPUT_SLOT` = 0, `ADDITIONAL_SLOT` = 1) and one result slot (`RESULT_SLOT` = 2).

Computes `cost` (XP levels) through `createResult()`. Supports item renaming with `setItemName()`. The `DATA_TOTAL_COST` (0) data ID broadcasts the repair cost to listeners. Tracks `repairItemCountCost` for the number of items consumed in the repair.

`slotsChanged()` is overloaded: one version takes a `Container*` and triggers `createResult()`, the other uses the base class's no-arg version.

### TrapMenu (Dispenser/Dropper)

Simple 9-slot grid wrapping a `DispenserTileEntity`. No special slot logic beyond standard quick-move between dispenser and inventory.

### ContainerMenu (Generic chest)

Used for single and double chests. Calculates `containerRows` from the container size and creates the right slot grid. Calls `startOpen()` / `stopOpen()` for chest animations.

## MinecraftConsoles differences

MC adds several new container menus that LCEMP doesn't have:

### New menu types

| Menu | Purpose | Notes |
|---|---|---|
| `BeaconMenu` | Beacon block UI | Has a `PaymentSlot` that only accepts emeralds, diamonds, gold ingots, and iron ingots with max stack size 1. Tracks `levels`, `primaryPower`, and `secondaryPower` as copied values for client-side display. |
| `HopperMenu` | Hopper inventory | 5-slot container starting at `CONTENTS_SLOT_START` (0). Wraps a `Container` (the hopper). |
| `HorseInventoryMenu` | Horse/donkey inventory | Manages a `HorseSaddleSlot` (only accepts saddles), a `HorseArmorSlot` (only accepts horse armor, with an `isActive()` check), and optional chest inventory for horses. |
| `FireworksMenu` | Fireworks crafting | 1 result slot + 9 crafting slots + player inventory. Tracks `m_canMakeFireworks`, `m_canMakeCharge`, and `m_canMakeFade` to validate ingredient placement via `isValidIngredient()`. Has `canTakeItemForPickAll()` to control pick-all behavior. |
| `AnvilMenu` | Anvil (separate file) | In LCEMP, the anvil logic lives inside `RepairMenu`. MC extracts it into its own `AnvilMenu` class file. |

### New container types

- **`AnimalChest`**: Extends `SimpleContainer`. Used by horses and donkeys. Takes a name and size in the constructor. Has a second constructor with an explicit `iTitle` param and `hasCustomName` flag (4J addition).
- **`WorldlyContainer`**: An interface extending `Container` that adds sided inventory access. Defines three pure virtual methods:
  - `getSlotsForFace(face)`: returns which slot indices are accessible from a given block face
  - `canPlaceItemThroughFace(slot, item, face)`: whether an item can be inserted from that face
  - `canTakeItemThroughFace(slot, item, face)`: whether an item can be extracted from that face

  Used by hoppers and droppers for sided inventory access. LCEMP doesn't have this concept.
- **`Hopper`** (interface): Extends `Container` (with virtual inheritance). Defines `getLevel()`, `getLevelX/Y/Z()` for position. `HopperTileEntity` and `MinecartHopper` both implement this.

### Existing menu changes

The `TrapMenu` in LCEMP only handles dispensers. In MC, it also covers droppers through the new `DropperTileEntity`. The menu logic is the same since droppers use the same 9-slot layout.

In MC, `FurnaceTileEntity` and `BrewingStandTileEntity` change from inheriting `Container` to inheriting `WorldlyContainer`, adding face-based slot access for hopper integration.

The core `AbstractContainerMenu`, `Container`, `Slot`, and synchronization systems are the same across both codebases.
