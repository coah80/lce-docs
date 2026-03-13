---
title: Tile Entities
description: Block entities that store extra data in LCEMP.
---

Tile entities are blocks that need more data than the basic tile ID and 4-bit data value can hold. They attach to a world position `(x, y, z)` and persist through NBT serialization.

## Base class: TileEntity

All tile entities inherit from `TileEntity`, which provides position tracking, NBT persistence, tick behavior, and a static registry for deserialization.

### Fields

| Field | Type | Purpose |
|---|---|---|
| `level` | `Level*` | Pointer to the owning world |
| `x`, `y`, `z` | `int` | Block coordinates |
| `data` | `int` | Cached block data value (lazy-loaded from world, -1 when unset) |
| `tile` | `Tile*` | Cached tile type (lazy-loaded from world) |
| `remove` | `bool` | Marked for removal |
| `renderRemoveStage` | `byte` | 4J-added staged removal for rendering (Keep, FlaggedAtChunk, Remove) |

### Core methods

| Method | Purpose |
|---|---|
| `load(CompoundTag*)` | Reads `x`, `y`, `z` from NBT |
| `save(CompoundTag*)` | Writes `id`, `x`, `y`, `z` to NBT |
| `tick()` | Called each game tick (empty by default) |
| `setChanged()` | Marks the chunk dirty and notifies the level |
| `clearCache()` | Resets cached `tile` and `data` values |
| `getUpdatePacket()` | Returns a network packet for client sync (null by default) |
| `triggerEvent(b0, b1)` | Handles block events (empty by default) |
| `clone()` | Pure virtual. Every subclass must implement deep copy (4J addition) |

### Static registry

The `staticCtor()` method registers all tile entity types with a string ID and a factory function. When loading from NBT, `loadStatic()` looks up the `id` tag in the registry, creates the right subclass, and calls `load()`.

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

**Behavior:**
- Ticks every game tick to process smelting
- Tracks `litTime` (remaining fuel), `litDuration` (total fuel time), and `tickCount` (cook progress)
- `canBurn()` checks if the input can produce a result and the result slot has room
- `burn()` moves one input item to the result slot
- `getBurnDuration()` is a static method that returns fuel time for any item
- Tracks `m_charcoalUsed` for the "Renewable Energy" achievement (4J addition)

**NBT:** Saves `BurnTime`, `CookTime`, and the `Items` list tag.

### ChestTileEntity

Implements `TileEntity` and `Container` (27 slots).

**Behavior:**
- `checkNeighbors()` finds adjacent chests to form double chests (stores `n`, `e`, `w`, `s` weak pointers)
- `tick()` manages lid animation (`openness`, `oOpenness`) and plays open/close sounds
- `startOpen()` / `stopOpen()` increment/decrement `openCount` and fire `triggerEvent` for animation sync
- Supports bonus chest variant through the `isBonusChest` flag (4J addition)
- `tickInterval` throttles neighbor checks

**NBT:** Saves the `Items` list tag.

### DispenserTileEntity

Implements `TileEntity` and `Container` (9 slots).

**Behavior:**
- `getRandomSlot()` picks a random occupied slot for dispensing
- `removeProjectile(itemId)` searches slots for a matching projectile to fire
- `addItem(item)` finds the first available slot
- `AddItemBack(item, slot)` returns a dispensed item to a specific slot (4J addition)

**NBT:** Saves the `Items` list tag.

### BrewingStandTileEntity

Implements `TileEntity` and `Container` (4 slots: 3 bottles + 1 ingredient).

**Behavior:**
- Ticks to process brewing. `brewTime` counts down from 400.
- `isBrewable()` checks if the ingredient can change any bottle slot
- `doBrew()` applies the ingredient effect to all valid bottles
- `applyIngredient()` computes the new potion data value
- `getPotionBits()` returns a bitmask of which bottle slots are filled

**NBT:** Saves `BrewTime` and the `Items` list tag.

### SignTileEntity

Stores up to 4 lines of text (`MAX_SIGN_LINES`).

**Behavior:**
- Lines stored as `wstring m_wsmessages[4]`
- Supports editing state (`isEditable`), text verification (`m_bVerified`), and censorship (`m_bCensored`)
- `getUpdatePacket()` sends sign content to clients
- `StringVerifyCallback()` handles platform string verification

**NBT:** Saves `Text1` through `Text4`.

### MobSpawnerTileEntity

Controls mob spawning from a spawner block.

**Behavior:**
- Ticks to check `isNearPlayer()` (within `MAX_DIST`) and counts down `spawnDelay`
- `entityId` says what mob to spawn, with optional `spawnData` CompoundTag for extra configuration
- `delay()` resets the spawn timer between `minSpawnDelay` and `maxSpawnDelay`
- `fillExtraData()` applies `spawnData` to newly created entities
- `spawnCount` controls how many mobs spawn per trigger
- `displayEntity` is a cached reference for the client-side spinning preview
- `m_bEntityIdUpdated` tracks whether the entity ID was changed at runtime (4J addition)

**NBT:** Saves `EntityId`, `Delay`, `MinSpawnDelay`, `MaxSpawnDelay`, `SpawnCount`, and optionally `SpawnData`.

### MusicTileEntity (Note Block)

Simple tile entity with a single `note` value (0-24) and an `on` state.

**Behavior:**
- `tune()` cycles the note value
- `playNote()` triggers the sound at the block's position, with pitch based on `note`

**NBT:** Saves `note`.

### EnderChestTileEntity

Only tracks lid animation state. The actual inventory is per-player (`PlayerEnderChestContainer`).

**Behavior:**
- `tick()` manages `openness` / `oOpenness` animation like ChestTileEntity
- `startOpen()` / `stopOpen()` manage `openCount`
- `triggerEvent()` syncs animation to clients

**NBT:** No additional tags beyond base `TileEntity`.

### SkullTileEntity

Stores a player head or mob skull on a block.

**Fields:**
- `skullType`: one of Skeleton (0), Wither (1), Zombie (2), Char/Player (3), Creeper (4)
- `rotation`: placement rotation
- `extraType`: player name for player skulls

**NBT:** Saves `SkullType`, `Rot`, `ExtraType`.

### EnchantmentTableEntity

Manages the book animation on enchanting tables.

**Fields:** `time`, `flip`, `oFlip`, `flipT`, `flipA`, `open`, `oOpen`, `rot`, `oRot`, `tRot`

**Behavior:** `tick()` updates book page-flipping and rotation animation based on the nearby player's position.

**NBT:** No additional tags.

### TheEndPortalTileEntity

Minimal tile entity with no extra data or behavior. It just exists to mark end portal frame blocks.

### PistonPieceEntity

Tracks a block being moved by a piston.

**Fields:** `id` (tile ID), `data` (tile data), `facing`, `extending`, `_isSourcePiston`, `progress`, `progressO`

**Behavior:**
- `tick()` advances `progress` and calls `moveCollidedEntities()` to push entities in the piston's path
- `finalTick()` places the final block when extension is done

**NBT:** Saves `blockId`, `blockData`, `facing`, `extending`, `progress`.

## Render removal system

4J added a staged removal system for tile entities to prevent rendering artifacts:

1. **Keep** (`e_RenderRemoveStageKeep`): normal state
2. **FlaggedAtChunk** (`e_RenderRemoveStageFlaggedAtChunk`): marked at chunk level
3. **Remove** (`e_RenderRemoveStageRemove`): safe to remove from renderer

`upgradeRenderRemoveStage()` transitions from FlaggedAtChunk to Remove. `shouldRemoveForRender()` returns true only at the Remove stage.

## MinecraftConsoles Differences

MC goes from 13 registered tile entity types to 18. Here are the new ones:

| String ID | Class | Type Enum | Notes |
|---|---|---|---|
| `"Control"` | `CommandBlockEntity` | `eTYPE_COMMANDBLOCKTILEENTITY` | Stores and executes commands |
| `"Beacon"` | `BeaconTileEntity` | `eTYPE_BEACONTILEENTITY` | Beacon block with effect area |
| `"DLDetector"` | `DaylightDetectorTileEntity` | `eTYPE_DAYLIGHTDETECTORTILEENTITY` | Outputs redstone based on sunlight |
| `"Hopper"` | `HopperTileEntity` | `eTYPE_HOPPERTILEENTITY` | Item transfer between containers |
| `"Comparator"` | `ComparatorTileEntity` | `eTYPE_COMPARATORTILEENTITY` | Stores redstone comparator state |

MC also changes a few existing ones:

- The **Dispenser** tile entity gets a sibling: `DropperTileEntity` (string ID `"Dropper"`, type `eTYPE_DROPPERTILEENTITY`). The dropper works like a dispenser but just drops items instead of shooting them.
- The **RecordPlayer** tile entity class gets renamed from `RecordPlayerTile::Entity` to `JukeboxTile::Entity` in MC. Same tile entity, different outer class name.
- MC adds `BaseMobSpawner` as a shared base class. In LCEMP the spawner logic lives entirely in `MobSpawnerTileEntity`, but MC extracts it so it can be reused for spawner minecarts.

So the total goes from 13 in LCEMP to 19 in MC (13 original + Dropper + Command Block + Beacon + Daylight Detector + Hopper + Comparator).
