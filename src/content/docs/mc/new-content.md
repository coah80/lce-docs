---
title: "New Blocks & Items"
description: "Blocks and items added in MinecraftConsoles but not in LCEMP."
---

MinecraftConsoles adds several blocks and items that aren't in the LCEMP base. This page documents each addition based on the actual source code.

## New blocks

### StainedGlassBlock

**File**: `Minecraft.World/StainedGlassBlock.h`, `.cpp`

Extends `HalfTransparentTile`. Provides 16 color variants using dye-based texture names.

| Property | Value |
|----------|-------|
| Base class | `HalfTransparentTile` |
| Material | Passed via constructor (glass) |
| Render layer | `1` (translucent) |
| Cube shaped | `false` |
| Silk touchable | `true` |
| Resource count | `0` (drops nothing without silk touch) |
| Icon variants | 16 (one per dye color) |

Texture registration iterates `ICONS_LENGTH` (16) and registers icons using `DyePowderItem::COLOR_TEXTURES` mapped through `getItemAuxValueForBlockData()`, which inverts the data bits (`~data & 0xf`).

### StainedGlassPaneBlock

**File**: `Minecraft.World/StainedGlassPaneBlock.h`, `.cpp`

Extends `ThinFenceTile`. The pane variant of stained glass with both face icons and edge icons.

| Property | Value |
|----------|-------|
| Base class | `ThinFenceTile` |
| Render layer | `1` (translucent) |
| Icon arrays | `ICONS[16]` (face) and `EDGE_ICONS[16]` (edge/top) |

Registers both face textures (`glass_<color>`) and edge textures (`glass_pane_top_<color>`) for all 16 variants.

### HayBlockTile

**File**: `Minecraft.World/HayBlockTile.h`, `.cpp`

Extends `RotatedPillarTile`. A directional block with top and side textures, just like logs.

| Property | Value |
|----------|-------|
| Base class | `RotatedPillarTile` |
| Material | `grass` |
| Render shape | `SHAPE_TREE` (pillar rendering) |
| Textures | `hay_block_top`, `hay_block_side` |

### NoteBlockTile

**File**: `Minecraft.World/NoteBlockTile.h`, `.cpp`

Extends `BaseEntityTile`. A tile entity that plays musical notes and responds to redstone.

| Property | Value |
|----------|-------|
| Base class | `BaseEntityTile` |
| Material | `wood` |
| Tile entity | `MusicTileEntity` |

**Behavior**:

- **Redstone signal** (`neighborChanged`): When a neighbor signal changes, plays the note if the signal transitions to on.
- **Right-click** (`use`): Increments the note pitch via `mte->tune()` and plays the note.
- **Left-click** (`attack`): Plays the current note without changing pitch.
- **Note rendering** (`triggerEvent`): Calculates pitch as `pow(2, (note - 12) / 12.0)` and picks an instrument sound based on the block below (harp, bass drum, snare, hat, bass). Spawns a `note` particle.

4J added a `soundOnly` parameter to `use()` and a `TestUse()` method for tooltip display.

### JukeboxTile

**File**: `Minecraft.World/JukeboxTile.h`, `.cpp`

Extends `BaseEntityTile`. Plays and ejects music discs.

| Property | Value |
|----------|-------|
| Base class | `BaseEntityTile` |
| Material | `wood` |
| Tile entity | `JukeboxTile::Entity` (nested class) |
| Analog output | Yes (comparator signal based on disc ID) |
| Textures | `jukebox_side`, `jukebox_top` |

**JukeboxTile::Entity** stores a `shared_ptr<ItemInstance> record` and handles save/load using both the `RecordItem` compound tag and the legacy `Record` integer tag.

**Behavior**:

- **Right-click**: Ejects the current disc if one is present (data value `1` means occupied).
- **Disc ejection** (`dropRecording`): Fires `SOUND_PLAY_RECORDING` level event, clears the record, and spawns the disc as an `ItemEntity`.
- **Block removal** (`onRemove`): Ejects the disc before the block is destroyed.
- **Comparator output**: Returns `record->id + 1 - Item::record_01_Id` when a disc is present.

## New items

### LeashItem

**File**: `Minecraft.World/LeashItem.h`, `.cpp`

Lets players tie leashed mobs to fence posts.

| Property | Value |
|----------|-------|
| Base class | `Item` |
| Key method | `useOn()` binds leashed mobs to a fence |

When used on a fence tile, it searches a 7-block radius for mobs leashed to the player, creates or finds a `LeashFenceKnotEntity` at that position, and attaches them. Has a `bindPlayerMobsTest()` method for tooltip prediction without side effects.

### NameTagItem

**File**: `Minecraft.World/NameTagItem.h`, `.cpp`

Lets you name mobs.

| Property | Value |
|----------|-------|
| Base class | `Item` |
| Key method | `interactEnemy()` |

When the item has a custom hover name and is used on a `Mob`, it sets the mob's custom name and calls `setPersistenceRequired()` to prevent despawning. Decrements the stack.

### EmptyMapItem

**File**: `Minecraft.World/EmptyMapItem.h`, `.cpp`

Creates a new map when used.

| Property | Value |
|----------|-------|
| Base class | `ComplexItem` |
| Key method | `use()` |

Creates a new `ItemInstance` of `Item::map` with aux value `-1`, calls `Item::map->onCraftedBy()` to initialize it, then decrements the empty map stack. If the player's stack isn't empty afterward, the new map is added to inventory or dropped.

### SpawnEggItem

**File**: `Minecraft.World/SpawnEggItem.h`, `.cpp`

Spawns mobs when used on a block or dispensed.

| Property | Value |
|----------|-------|
| Base class | `Item` |
| Multi-sprite | Yes (base + overlay for two-tone coloring) |
| Key methods | `useOn()`, `use()`, `spawnMobAt()` |

Has a detailed `_eSpawnResult` enum with console-specific failure reasons:

- `FailTooManyPigsCowsSheepCats`
- `FailTooManyChickens`
- `FailTooManySquid`
- `FailTooManyBats`
- `FailTooManyWolves`
- `FailTooManyMooshrooms`
- `FailTooManyAnimals`
- `FailTooManyMonsters`
- `FailTooManyVillagers`
- `FailCantSpawnInPeaceful`

`spawnMobAt()` includes a 4J-added `piResult` parameter for reporting spawn failures back to the dispenser system.

### SimpleFoiledItem

**File**: `Minecraft.World/SimpleFoiledItem.h`, `.cpp`

A simple item that always renders with the enchantment glint ("foil").

| Property | Value |
|----------|-------|
| Base class | `Item` |
| Behavior | `isFoil()` always returns `true` |

Used for items like the Nether Star that should always look enchanted.

### FireworksItem

**File**: `Minecraft.World/FireworksItem.h`, `.cpp`

The firework rocket item with full NBT tag support.

| Property | Value |
|----------|-------|
| Base class | `Item` |
| Key method | `useOn()` |
| Tooltip | `appendHoverText()` displays firework properties |

Defines NBT tag constants:

| Constant | Tag name |
|----------|----------|
| `TAG_FIREWORKS` | Fireworks |
| `TAG_EXPLOSION` | Explosion |
| `TAG_EXPLOSIONS` | Explosions |
| `TAG_FLIGHT` | Flight |
| `TAG_E_TYPE` | Type |
| `TAG_E_TRAIL` | Trail |
| `TAG_E_FLICKER` | Flicker |
| `TAG_E_COLORS` | Colors |
| `TAG_E_FADECOLORS` | FadeColors |

Firework explosion types:

| Type | Value |
|------|-------|
| `TYPE_SMALL` | 0 |
| `TYPE_BIG` | 1 |
| `TYPE_STAR` | 2 |
| `TYPE_CREEPER` | 3 |
| `TYPE_BURST` | 4 |

### FireworksChargeItem

**File**: `Minecraft.World/FireworksChargeItem.h`, `.cpp`

The firework star item used in crafting firework rockets.

| Property | Value |
|----------|-------|
| Base class | `Item` |
| Multi-sprite | Yes (base + colored overlay) |
| Key methods | `getColor()`, `appendHoverText()` |

Reads explosion data from the item's NBT tag to determine display color and tooltip text.

## Registration

These blocks and items are registered in the global `Tile` and `Item` static initialization (in `Tile.cpp` and `Item.cpp` respectively). The stained glass and hay block tiles follow the standard `Tile::tiles[]` array pattern, while items use `Item::items[]` with their numeric IDs.

For more details on fireworks, see the [Fireworks](/lce-docs/mc/fireworks/) page. For horse-related items (armor, saddles), see the [Horses](/lce-docs/mc/horses/) page.
