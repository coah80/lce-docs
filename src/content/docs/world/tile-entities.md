---
title: Tile Entities
description: Block entities that store extra data in LCE.
---

Tile entities are blocks that need more data than the basic tile ID and 4-bit data value can hold. They attach to a world position `(x, y, z)` and persist through NBT serialization.

## Base class: TileEntity

All tile entities inherit from `TileEntity`, which provides position tracking, NBT persistence, tick behavior, and a static registry for deserialization. It also inherits from `enable_shared_from_this<TileEntity>` so tile entities can safely hand out `shared_ptr` references to themselves.

### Fields

| Field | Type | Purpose |
|---|---|---|
| `level` | `Level*` | Pointer to the owning world |
| `x`, `y`, `z` | `int` | Block coordinates |
| `data` | `int` | Cached block data value (lazy-loaded from world, -1 when unset) |
| `tile` | `Tile*` | Cached tile type (lazy-loaded from world, null when unset) |
| `remove` | `bool` | Marked for removal (private, accessed through `isRemoved()` / `setRemoved()` / `clearRemoved()`) |
| `renderRemoveStage` | `byte` | 4J-added staged removal for rendering (Keep, FlaggedAtChunk, Remove) |

### Constructor

The constructor zeros everything out:

- `level` = NULL, `x` = `y` = `z` = 0
- `remove` = false, `data` = -1, `tile` = NULL
- `renderRemoveStage` = `e_RenderRemoveStageKeep`

Java's `TileEntity` had no explicit constructor, but 4J added one because C++ needs the member variables initialized to something.

### Core methods

| Method | Purpose |
|---|---|
| `load(CompoundTag*)` | Reads `x`, `y`, `z` from NBT |
| `save(CompoundTag*)` | Looks up the string ID in `classIdMap` from `GetType()`, then writes `id`, `x`, `y`, `z` to NBT. If the type isn't in the map, it returns early (with a TODO comment about exception handling). |
| `tick()` | Called each game tick (empty by default) |
| `setChanged()` | Refreshes `data` from the world, then calls `level->tileEntityChanged(x, y, z, shared_from_this())` to mark the chunk dirty |
| `clearCache()` | Resets cached `tile` to NULL and `data` to -1 |
| `getUpdatePacket()` | Returns a network packet for client sync (null by default, overridden by sign, spawner, skull, etc.) |
| `triggerEvent(b0, b1)` | Handles block events like chest lid animation (empty by default) |
| `clone()` | Pure virtual. Every subclass must implement deep copy (4J addition). The base `clone(shared_ptr<TileEntity>)` helper copies `level`, `x`, `y`, `z`, `data`, and `tile` to the target. |
| `distanceToSqr(x, y, z)` | Returns squared distance from the tile entity center (block pos + 0.5) to the given point |
| `getData()` | Lazy-loads block data from the world if `data` is -1, then returns it |
| `setData(data)` | Sets the cached data and calls `level->setData(x, y, z, data)` |
| `getTile()` | Lazy-loads the `Tile*` from the world tile array if null |
| `hasLevel()` | Returns whether `level` is non-null |
| `isRemoved()` / `setRemoved()` / `clearRemoved()` | Manage the `remove` flag |

### Static registry

The `staticCtor()` method registers all tile entity types with a string ID and a factory function. It uses two maps:

- **`idCreateMap`**: `wstring` -> factory function pointer. Used when loading from NBT.
- **`classIdMap`**: `eINSTANCEOF` -> `wstring`. Used when saving to NBT.

`setId()` adds entries to both maps. There's a check for duplicate IDs (the exception is commented out, replaced with an empty if-block).

When loading from NBT, `loadStatic()` reads the `id` string tag, looks it up in `idCreateMap`, creates the right subclass through the factory function, and calls `load()` on it. In debug builds, unknown IDs get a debug printf. In release they're silently skipped.

**Registered IDs:**

| String ID | Class | Type Enum |
|---|---|---|
| `"Furnace"` | `FurnaceTileEntity` | `eTYPE_FURNACETILEENTITY` |
| `"Chest"` | `ChestTileEntity` | `eTYPE_CHESTTILEENTITY` |
| `"EnderChest"` | `EnderChestTileEntity` | `eTYPE_ENDERCHESTTILEENTITY` |
| `"RecordPlayer"` | `RecordPlayerTile::Entity` | `eTYPE_RECORDPLAYERTILE` |
| `"Trap"` | `DispenserTileEntity` | `eTYPE_DISPENSERTILEENTITY` |
| `"Sign"` | `SignTileEntity` | `eTYPE_SIGNTILEENTITY` |
| `"MobSpawner"` | `MobSpawnerTileEntity` | `eTYPE_MOBSPAWNERTILEENTITY` |
| `"Music"` | `MusicTileEntity` | `eTYPE_MUSICTILEENTITY` |
| `"Piston"` | `PistonPieceEntity` | `eTYPE_PISTONPIECEENTITY` |
| `"Cauldron"` | `BrewingStandTileEntity` | `eTYPE_BREWINGSTANDTILEENTITY` |
| `"EnchantTable"` | `EnchantmentTableEntity` | `eTYPE_ENCHANTMENTTABLEENTITY` |
| `"Airportal"` | `TheEndPortalTileEntity` | `eTYPE_THEENDPORTALTILEENTITY` |
| `"Skull"` | `SkullTileEntity` | `eTYPE_SKULLTILEENTITY` |

## Tile entity types

### FurnaceTileEntity

Implements both `TileEntity` and `Container` (3 slots: input, fuel, result).

**Constants:**

- `BURN_INTERVAL` = 200 ticks (10 seconds * 20 tps)
- Slot enum: `INPUT_SLOT` = 0, `FUEL_SLOT` = 1, `RESULT_SLOT` = 2

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `litTime` | `int` | Remaining fuel burn ticks (counts down) |
| `litDuration` | `int` | Total fuel time for the current fuel item |
| `tickCount` | `int` | Cook progress (counts up to `BURN_INTERVAL`) |
| `m_charcoalUsed` | `bool` | 4J addition: true if charcoal was consumed while cooking the current stack (for the "Renewable Energy" achievement) |
| `items` | `ItemInstanceArray*` | 3-slot item array |

**Tick behavior:**

Each tick on the server side:

1. `litTime` decrements if above 0
2. If fuel ran out (`litTime == 0`) and `canBurn()` is true, consume a fuel item: set `litDuration` and `litTime` from `getBurnDuration()`, decrement the fuel stack, track charcoal usage for the achievement
3. If lit and `canBurn()`, increment `tickCount`. When it hits `BURN_INTERVAL` (200), call `burn()` to move one item from input to result
4. If the lit state changed, call `FurnaceTile::setLit()` to swap the block between lit and unlit furnace visually
5. If anything changed, call `setChanged()`

**`canBurn()` logic:**

Returns true if the input slot has an item with a valid smelting recipe, and the result slot either is empty, contains a matching item that isn't at max stack size, or can accept more of that result.

**`burn()` logic:**

Copies the smelting result into the result slot (creates a new stack or increments the existing one), then decrements the input slot.

**Fuel durations (in ticks, relative to `BURN_INTERVAL` = 200):**

| Fuel | Duration | Formula |
|---|---|---|
| Wood slab | 150 | `BURN_INTERVAL * 3 / 4` |
| Any wood-material block | 300 | `BURN_INTERVAL * 3 / 2` |
| Wooden tool / weapon / hoe | 200 | `BURN_INTERVAL` |
| Stick | 100 | `BURN_INTERVAL / 2` |
| Coal / charcoal | 1600 | `BURN_INTERVAL * 8` |
| Lava bucket | 20000 | `BURN_INTERVAL * 100` |
| Sapling | 100 | `BURN_INTERVAL / 2` |
| Blaze rod | 2400 | `BURN_INTERVAL * 12` |

Fuel items that have a `craftingRemainingItem` (like buckets) leave that item behind when consumed.

**`stillValid()` check:** Verifies the tile entity is still at its position in the world and the player is within 64 blocks (8*8 squared distance).

**NBT:** Saves `BurnTime` (short), `CookTime` (short), `CharcoalUsed` (boolean), and the `Items` list tag. On load, `litDuration` is recalculated from the current fuel item via `getBurnDuration()`.

**Clone:** Deep-copies `litTime`, `tickCount`, `litDuration`, and all items.

### ChestTileEntity

Implements `TileEntity` and `Container` (27 slots, allocated as 36 internally).

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `items` | `ItemInstanceArray*` | Allocated as 36 slots (`9 * 4`), but `getContainerSize()` returns 27 (`9 * 3`) |
| `isBonusChest` | `bool` | 4J addition: marks the world spawn bonus chest |
| `hasCheckedNeighbors` | `bool` | Whether neighbor check has run |
| `n`, `e`, `w`, `s` | `weak_ptr<ChestTileEntity>` | Adjacent chests in each direction |
| `openness`, `oOpenness` | `float` | Current and previous lid animation state (0.0 to 1.0) |
| `openCount` | `int` | Number of players currently viewing this chest |
| `tickInterval` | `int` | Counter for periodic neighbor checks |

**Double chest discovery (`checkNeighbors()`):**

Scans all four adjacent blocks for chest tiles. If found, stores a `weak_ptr` to that neighbor's `ChestTileEntity`. Also calls `clearCache()` on any found neighbors to force them to re-check. This only runs once per cache cycle (gated by `hasCheckedNeighbors`).

**Tick behavior:**

1. Calls `checkNeighbors()` to find adjacent chests
2. Every 80 ticks (`tickInterval % 20 * 4`), would normally sync `openCount` via a tile event (commented out in the code)
3. Updates lid animation: if `openCount > 0`, ramps `openness` up by 0.1 per tick; if 0, ramps down
4. Plays chest open sound (at 0.2 volume, 4J reduced from default due to user reports of loudness) when `openness` goes from 0 to non-zero
5. Plays chest close sound when `openness` drops below 0.5

**`triggerEvent()`:** When `b0` equals `ChestTile::EVENT_SET_OPEN_COUNT`, sets `openCount` to `b1`. This is how the server syncs the animation state to clients.

**`startOpen()` / `stopOpen()`:** Increment/decrement `openCount` and fire a tile event to broadcast the change.

**`setRemoved()`:** Calls `clearCache()` and `checkNeighbors()` before the base removal, so adjacent chests update.

**`clearCache()`:** Calls the base `TileEntity::clearCache()` and also resets `hasCheckedNeighbors` to false.

**NBT:** Saves the `Items` list tag and `bonus` (boolean). On load, the slot byte is masked with `0xff`.

**Clone:** Deep-copies all items.

### DispenserTileEntity

Implements `TileEntity` and `Container` (9 slots).

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `items` | `ItemInstanceArray*` | 9-slot item array |
| `random` | `Random*` | For random slot selection |

**Methods:**

| Method | Purpose |
|---|---|
| `getRandomSlot()` | Uses reservoir sampling to pick a random occupied slot. Iterates all 9 slots, and for each non-null slot, picks it with probability `1/count` |
| `removeProjectile(itemId)` | Scans slots sequentially for a matching item ID, removes 1, and returns true if found |
| `addItem(item)` | Finds the first empty slot (null or id 0) and places the item there. Returns the slot index, or -1 if full |
| `AddItemBack(item, slot)` | 4J addition for spawn egg handling: if the slot already has a matching item, increments its count; if empty, places the item. Added because spawn eggs had usage limits that needed items returned |

**NBT:** Saves the `Items` list tag. Slot byte masked with `0xff` on load.

**Clone:** Deep-copies all items.

### BrewingStandTileEntity

Implements `TileEntity` and `Container` (4 slots: 3 bottles + 1 ingredient at `INGREDIENT_SLOT` = 3).

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `items` | `ItemInstanceArray` | 4-slot array (value type, not pointer) |
| `brewTime` | `int` | Counts down from 400 (20 seconds) to 0 |
| `lastPotionCount` | `int` | Cached bitmask of which bottle slots are filled |
| `ingredientId` | `int` | Item ID of the ingredient when brewing started |

**Max stack size:** Returns 1 (not the default 64). Each slot only holds one item.

**Tick behavior:**

1. If `brewTime > 0`, decrement it. When it hits 0, call `doBrew()`. If the brew becomes invalid mid-process (ingredient removed or changed), reset `brewTime` to 0.
2. If `brewTime == 0` and `isBrewable()` returns true, start a new brew: set `brewTime` = 400 (20 seconds * 20 tps) and record `ingredientId`.
3. Update `lastPotionCount` bitmask via `getPotionBits()`. If it changed, write it to the block data value.

**`isBrewable()` logic:**

Checks if the ingredient in slot 3 is valid (has a potion brewing formula). Then checks each of the 3 bottle slots: if it holds a potion, computes what the new brew value would be. If any slot would produce a different potion value, returns true.

There are two code paths: `SIMPLIFIED_BREWING` (the one actually used on console) and the old non-simplified path. The simplified path just checks `hasPotionBrewingFormula()`. The non-simplified path also handles water buckets and nether wart as special cases. The non-simplified path is compiled out with `#if !(_SIMPLIFIED_BREWING)`.

**`doBrew()` logic:**

For each bottle slot that would change, updates the potion's aux value. Then decrements the ingredient (or replaces it with a crafting remaining item like glass bottles).

**`applyIngredient()`:** Computes the new potion data value by calling `PotionBrewing::applyBrew()` with the ingredient's formula.

**`getPotionBits()`:** Returns a bitmask where bit 0 = bottle slot 0, bit 1 = slot 1, bit 2 = slot 2. This is stored in the block data value so the block renderer knows which bottles to show.

**NBT:** Saves `BrewTime` (short) and the `Items` list tag.

**Clone:** Deep-copies `brewTime`, `lastPotionCount`, `ingredientId`, and all items.

### SignTileEntity

Stores up to 4 lines of text (`MAX_SIGN_LINES` = 4).

**Constants:**

- `MAX_LINE_LENGTH` = 15 characters

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `m_wsmessages[4]` | `wstring[4]` | The four lines of sign text |
| `_isEditable` | `bool` | Whether the sign can currently be edited (true on creation, false after loading) |
| `m_bVerified` | `bool` | Whether the text has been verified by the platform's string verification service |
| `m_bCensored` | `bool` | Whether the text was flagged by verification |
| `m_iSelectedLine` | `int` | Currently selected line for editing (-1 when not editing) |

**String verification:**

Originally, online games would send sign text to the platform's string verification API before displaying it. `setChanged()` would kick off this process. But for TU14, 4J removed the requirement, so `setChanged()` now just sets `m_bVerified = true` immediately. The old verification code is still there but commented out.

`StringVerifyCallback()` was the async callback that received verification results. It would mark individual lines as censored if they failed the check, then queue a tile update through the server level.

**`getUpdatePacket()`:** Creates a `SignUpdatePacket` with the position, verified/censored flags, and a copy of the four lines.

**Load behavior:** Sets `_isEditable` to false (signs loaded from disk aren't editable), reads `Text1` through `Text4`, truncates any line over `MAX_LINE_LENGTH`, and sets `m_bVerified` to false so it can be re-verified (fix for bug #13531 where signs didn't censor after loading).

**NBT:** Saves `Text1` through `Text4`. Debug builds also print the sign text to the debug output.

**Clone:** Deep-copies all four message strings, `m_bVerified`, and `m_bCensored`.

### MobSpawnerTileEntity

Controls mob spawning from a spawner block.

**Constants:**

- `MAX_DIST` = 16 blocks (player activation range)

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `spawnDelay` | `int` | Ticks until next spawn attempt (starts at 20) |
| `entityId` | `wstring` | What mob to spawn (defaults to `"Pig"`, not `"Skeleton"` as the commented-out line suggests) |
| `spawnData` | `CompoundTag*` | Optional extra NBT data to apply to spawned entities |
| `minSpawnDelay` | `int` | Minimum delay between spawns (200 ticks / 10 seconds) |
| `maxSpawnDelay` | `int` | Maximum delay between spawns (800 ticks / 40 seconds) |
| `spawnCount` | `int` | How many mobs to spawn per trigger (default 4) |
| `displayEntity` | `shared_ptr<Entity>` | Cached entity reference for the client-side spinning preview |
| `spin`, `oSpin` | `double` | Client-side spinning animation values |
| `m_bEntityIdUpdated` | `bool` | 4J addition: tracks whether the entity ID was changed so `getDisplayEntity()` refreshes the cached preview |

**Tick behavior (client side):**

Checks `isNearPlayer()` first. If near, spawns smoke and flame particles at random positions within the block, and advances the `spin` animation (1000/220 degrees per tick, wrapping at 360).

**Tick behavior (server side):**

1. If `spawnDelay == -1`, call `delay()` to pick a new random delay
2. If `spawnDelay > 0`, decrement and return
3. For each of `spawnCount` attempts:
   - Create the entity from `entityId`
   - Count nearby entities of the same type in an 8x4x8 area. If 6 or more, call `delay()` and stop
   - 4J addition: also check global monster count against a cap of 60 (slightly higher than the main spawner's 50 limit)
   - Pick a random position within 4 blocks horizontally and 1 block vertically
   - If the mob can spawn there, call `fillExtraData()`, add to world, fire a `PARTICLES_MOBTILE_SPAWN` level event, and call `delay()`

**`fillExtraData()`:** If `spawnData` is set, saves the entity to a temporary CompoundTag, merges all tags from `spawnData` into it, then loads the entity back from the merged tag. This lets spawner NBT override entity properties.

**`delay()`:** Sets `spawnDelay` to a random value between `minSpawnDelay` and `maxSpawnDelay`.

**`getDisplayEntity()`:** Creates or refreshes the cached display entity. If `m_bEntityIdUpdated` is true, recreates it from the current `entityId` and applies `fillExtraData()`.

**`getUpdatePacket()`:** Saves full NBT to a `TileEntityDataPacket` with `TYPE_MOB_SPAWNER` (1).

**NBT:** Saves `EntityId`, `Delay`, `MinSpawnDelay`, `MaxSpawnDelay`, `SpawnCount`, and optionally `SpawnData`. On load, `m_bEntityIdUpdated` is set to true.

**Clone:** Copies `entityId` and `spawnDelay` only (not the full spawn config).

### MusicTileEntity (Note Block)

Simple tile entity with a single `note` value (0-24) and an `on` state.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `note` | `byte` | Note pitch, 0 to 24 |
| `on` | `bool` | Whether the note block is active |

**`tune()`:** Cycles the note value: `note = (note + 1) % 25`, then calls `setChanged()`.

**`playNote()`:** First checks that the block above is air. Then reads the material of the block below to pick an instrument:

| Material below | Instrument index |
|---|---|
| Default (anything else) | 0 (piano/harp) |
| Stone | 1 (bass drum) |
| Sand | 2 (snare) |
| Glass | 3 (clicks/sticks) |
| Wood | 4 (bass guitar) |

Fires a tile event with the instrument and note value.

**NBT:** Saves `note` (byte). On load, clamps to 0-24.

**Clone:** Copies `note`.

### RecordPlayerTile::Entity (Jukebox)

A nested class inside `RecordPlayerTile`. Stores the `record` field (item ID of the playing disc, 0 when empty).

**NBT:** Loads `Record` (int). Saves it only if `record > 0`.

**Clone:** Copies `record`.

### EnderChestTileEntity

Only tracks lid animation state. The actual inventory is per-player (`PlayerEnderChestContainer`).

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `openness`, `oOpenness` | `float` | Lid animation (0.0 to 1.0) |
| `openCount` | `int` | Number of players viewing |
| `tickInterval` | `int` | Periodic sync counter |

**Tick behavior:** Almost identical to `ChestTileEntity`: ramps `openness` up/down based on `openCount`, plays open/close sounds at 0.2 volume. Every 80 ticks, fires a tile event to sync `openCount`. The tile ID used is `Tile::enderChest_Id` instead of `Tile::chest_Id`.

**`triggerEvent()`:** Same as chest: sets `openCount` from event data.

**`startOpen()` / `stopOpen()`:** Increment/decrement `openCount` and fire tile events.

**`setRemoved()`:** Calls `clearCache()` before the base removal.

**`stillValid()`:** Same 64-block distance check as other containers.

**NBT:** No additional tags beyond base `TileEntity`.

**Clone:** Just copies the base fields (no extra data).

### SkullTileEntity

Stores a player head or mob skull on a block.

**Constants:**

| Constant | Value |
|---|---|
| `TYPE_SKELETON` | 0 |
| `TYPE_WITHER` | 1 |
| `TYPE_ZOMBIE` | 2 |
| `TYPE_CHAR` (Player) | 3 |
| `TYPE_CREEPER` | 4 |

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `skullType` | `int` | Which skull type (see constants above) |
| `rotation` | `int` | Placement rotation |
| `extraType` | `wstring` | Player name for player skulls |

**`getUpdatePacket()`:** Sends full NBT through `TileEntityDataPacket` with `TYPE_SKULL` (4).

**NBT:** Saves `SkullType`, `Rot`, `ExtraType`.

**Clone:** Copies `skullType`, `rotation`, `extraType`.

### EnchantmentTableEntity

Manages the book animation on enchanting tables.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `time` | `int` | Tick counter |
| `flip`, `oFlip` | `float` | Current and previous page flip position |
| `flipT`, `flipA` | `float` | Target flip position and flip acceleration |
| `open`, `oOpen` | `float` | Book open amount (0.0 to 1.0) |
| `rot`, `oRot` | `float` | Current and previous book rotation |
| `tRot` | `float` | Target rotation |
| `random` | `Random*` | For page flip randomization |

**Tick behavior:**

1. Finds the nearest player within 3 blocks
2. If a player is nearby: computes `tRot` from `atan2` to face the player, ramps `open` up by 0.1 per tick, and randomly changes `flipT` every 40 ticks (guaranteeing it picks a different page)
3. If no player nearby: slowly rotates `tRot` by 0.02 per tick, ramps `open` down by 0.1
4. Smoothly interpolates `rot` toward `tRot` at 40% speed per tick, wrapping around PI
5. Clamps `open` to 0.0-1.0
6. Updates page flip with a dampened spring: `flipA += (diff - flipA) * 0.9`, clamped to +/- 0.2

**NBT:** No additional tags.

**Clone:** Deep-copies all animation fields: `time`, `flip`, `oFlip`, `flipT`, `flipA`, `open`, `oOpen`, `rot`, `oRot`, `tRot`.

### TheEndPortalTileEntity

Minimal tile entity with no extra data or behavior. It just exists to mark end portal frame blocks. The clone method creates an empty copy with just the base fields.

### PistonPieceEntity

Tracks a block being moved by a piston.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `id` | `int` | Tile ID of the block being moved |
| `data` | `int` | Tile data of the block being moved |
| `facing` | `int` | Direction the piston is facing (index into `Facing::STEP_X/Y/Z`) |
| `extending` | `bool` | Whether the piston is extending (true) or retracting (false) |
| `_isSourcePiston` | `bool` | Whether this piece is the piston head itself |
| `progress`, `progressO` | `float` | Current and previous animation progress (0.0 to 1.0) |

**Constructors:**

- Default: zeros everything (for the tile entity loader)
- Parameterized: takes `id`, `data`, `facing`, `extending`, `isSourcePiston`

**Offset calculations:**

`getXOff()`, `getYOff()`, `getZOff()` compute the visual offset based on `progress` and `facing`:
- Extending: `(progress - 1.0) * STEP`
- Retracting: `(1.0 - progress) * STEP`

**`moveCollidedEntities()`:** Gets the AABB from `Tile::pistonMovingPiece->getAABB()` for the moving block, finds all entities in that area, and pushes them by `amount * STEP` in the facing direction. Uses a local vector copy to avoid iterator invalidation.

**Tick behavior:**

1. Save `progressO = progress`
2. If `progressO >= 1.0`, do a final move of entities by 0.25 blocks, remove the tile entity, and place the final block
3. Otherwise, advance `progress` by 0.5 (so the animation takes 2 ticks total)
4. If extending, push collided entities

**`finalTick()`:** Called for instant completion. Sets `progressO` and `progress` to 1.0, removes the tile entity, and places the final block. Only runs if `progressO < 1` and `level` is non-null.

**NBT:** Saves `blockId`, `blockData`, `facing`, `progress` (saves `progressO`, not `progress`), `extending`.

**Clone:** Deep-copies all fields including `_isSourcePiston`, `progress`, and `progressO`.

## Client sync via TileEntityDataPacket

Some tile entities send their full NBT state to clients through `TileEntityDataPacket`. The packet carries the tile entity position and a type constant:

| Type Constant | Value | Used By |
|---|---|---|
| `TYPE_MOB_SPAWNER` | 1 | `MobSpawnerTileEntity` |
| `TYPE_ADV_COMMAND` | 2 | `CommandBlockEntity` (MC only) |
| `TYPE_BEACON` | 3 | `BeaconTileEntity` (MC only) |
| `TYPE_SKULL` | 4 | `SkullTileEntity` |

Other tile entities use specialized packets (like `SignUpdatePacket` for signs) or `triggerEvent()` for simple state sync (like chest lid animation).

## Render removal system

4J added a staged removal system for tile entities to prevent rendering artifacts:

1. **Keep** (`e_RenderRemoveStageKeep`): normal state
2. **FlaggedAtChunk** (`e_RenderRemoveStageFlaggedAtChunk`): marked at chunk level
3. **Remove** (`e_RenderRemoveStageRemove`): safe to remove from renderer

`upgradeRenderRemoveStage()` transitions from FlaggedAtChunk to Remove. `shouldRemoveForRender()` returns true only at the Remove stage. This two-step process gives the renderer a frame to clean up before the tile entity is actually removed.

## Duplication glitch fix

4J added a fix across all container tile entities (`FurnaceTileEntity`, `ChestTileEntity`, `DispenserTileEntity`, `BrewingStandTileEntity`) in the `removeItem()` method. After splitting a stack, if the resulting item count is 0 or less, the method returns null instead of the empty item. This prevents a duplication exploit where players could get phantom items.

## MinecraftConsoles differences

MC goes from 13 registered tile entity types to 19. Here are the new ones:

| String ID | Class | Type Enum | Notes |
|---|---|---|---|
| `"Control"` | `CommandBlockEntity` | `eTYPE_COMMANDBLOCKTILEENTITY` | Stores and executes commands |
| `"Beacon"` | `BeaconTileEntity` | `eTYPE_BEACONTILEENTITY` | Beacon block with effect area |
| `"DLDetector"` | `DaylightDetectorTileEntity` | `eTYPE_DAYLIGHTDETECTORTILEENTITY` | Outputs redstone based on sunlight |
| `"Hopper"` | `HopperTileEntity` | `eTYPE_HOPPERTILEENTITY` | Item transfer between containers |
| `"Comparator"` | `ComparatorTileEntity` | `eTYPE_COMPARATORTILEENTITY` | Stores redstone comparator state |
| `"Dropper"` | `DropperTileEntity` | `eTYPE_DROPPERTILEENTITY` | Drops items instead of shooting them |

### CommandBlockEntity

Implements `TileEntity` and `CommandSender`. Stores a `command` string, a `name` (defaults to `"@"`), and a `successCount`. The `performCommand()` method is stubbed out with an `assert(false)` in the 4J code (they couldn't decide how to handle the command field on console). NBT saves `Command`, `SuccessCount`, and `CustomName`. Syncs to clients via `TileEntityDataPacket` with `TYPE_ADV_COMMAND` (2).

### BeaconTileEntity

Implements `TileEntity` and `Container` (1 slot for the payment item).

**Beacon effects by tier:**

| Tier | Effect 1 | Effect 2 |
|---|---|---|
| 1 | Speed | Haste |
| 2 | Resistance | Jump Boost |
| 3 | Strength | (none) |
| 4 | Regeneration | (none) |

**Tick behavior:** Every 4 seconds (or on the first tick when `levels < 0`), calls `updateShape()` to count pyramid layers, then `applyEffects()` to give nearby players the selected effects for 9 seconds. The effect range is `(levels * 10) + 10` blocks. At tier 4, if primary equals secondary power, the primary gets amplifier 1 (level II). If they differ, the secondary is applied separately at amplifier 0.

**`updateShape()`:** Checks `canSeeSky()` above the beacon. Then scans downward through up to 4 layers of the pyramid, checking that every block is iron, gold, diamond, or emerald. Sets `levels` to the highest complete layer, or 0 if none.

**Payment items:** Only accepts emeralds, diamonds, gold ingots, or iron ingots via `canPlaceItem()`. Max stack size is 1.

**NBT:** Saves `Primary`, `Secondary`, `Levels`. Syncs via `TileEntityDataPacket` with `TYPE_BEACON` (3).

### DaylightDetectorTileEntity

Minimal tile entity with no extra data. Just has a `tick()` method (the actual redstone output logic lives in the tile class, not the tile entity).

### HopperTileEntity

Implements `TileEntity` and `Hopper` (which extends `Container`). Has 5 slots.

**Fields:**

- `items`: 5-slot `ItemInstanceArray`
- `name`: custom name string (empty by default)
- `cooldownTime`: transfer cooldown (starts at -1, `MOVE_ITEM_SPEED` = 8 ticks between transfers)

**Tick behavior:** Calls `tryMoveItems()` each tick. This handles both pulling items from above (`suckInItems()`) and pushing items to the container the hopper faces (`ejectItems()`). Static helper methods handle the actual item transfer logic, including merging stacks and checking slot restrictions.

**Sided access:** Through the `Hopper` interface, provides `getLevelX/Y/Z()` for position and `getLevel()` for the world. `getAttachedContainer()` finds the container the hopper outputs to. `getSourceContainer()` finds the container above the hopper.

**NBT:** Saves `Items`, `TransferCooldown`, and optionally `CustomName`.

### ComparatorTileEntity

Very simple tile entity that stores a single `output` int value. Used by the redstone comparator to persist its signal strength.

**NBT:** Saves `OutputSignal` (int). Has `getOutputSignal()` and `setOutputSignal()` accessors.

### DropperTileEntity

Extends `DispenserTileEntity`. Same 9-slot container, same NBT format. The only difference is that `getName()` returns the dropper's display name instead of the dispenser's, and `GetType()` returns `eTYPE_DROPPERTILEENTITY`. The dropper drops items instead of shooting projectiles, but that behavior lives in the tile class, not the tile entity.

### Other MC changes

- The **RecordPlayer** tile entity class gets renamed from `RecordPlayerTile::Entity` to `JukeboxTile::Entity` in MC. Same tile entity, different outer class name.
- MC adds `BaseMobSpawner` as a shared base class. In LCEMP the spawner logic lives entirely in `MobSpawnerTileEntity`, but MC extracts it so it can be reused for spawner minecarts (`MinecartHopper`). `BaseMobSpawner` adds `spawnPotentials` (weighted random spawn list), `nextSpawnData`, `maxNearbyEntities`, `requiredPlayerRange`, `spawnRange`, and an event-based spawn animation system.
- The `BrewingStandTileEntity` changes from inheriting `Container` to inheriting `WorldlyContainer` (sided inventory) in MC.
- The `FurnaceTileEntity` also changes to `WorldlyContainer` in MC.

So the total goes from 13 in LCEMP to 19 in MC (13 original + Dropper + Command Block + Beacon + Daylight Detector + Hopper + Comparator).
