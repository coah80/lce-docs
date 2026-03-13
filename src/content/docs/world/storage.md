---
title: Level Storage & IO
description: How LCE saves and loads world data.
---

LCE uses a layered storage system with abstract interfaces for level and chunk persistence, console-specific save file wrappers, and an NBT (Named Binary Tag) format for structured data.

## Storage architecture

### LevelStorageSource

The top-level factory that manages world listings and creates `LevelStorage` instances.

| Method | Purpose |
|---|---|
| `selectLevel(saveFile, levelId, createPlayerDir)` | Opens a world and returns a `LevelStorage` |
| `getLevelList()` | Returns summaries of all saved worlds |
| `getDataTagFor(saveFile, levelId)` | Reads `LevelData` without fully loading |
| `isNewLevelIdAcceptable(levelId)` | Checks if a world name is valid (no reserved names, no conflicts) |
| `deleteLevel(levelId)` | Removes a saved world |
| `renameLevel(levelId, newName)` | Renames a saved world |
| `isConvertible(saveFile, levelId)` / `requiresConversion()` | Checks if a world needs a format upgrade |
| `convertLevel(saveFile, levelId, progress)` | Does the format conversion |

Implementations: `McRegionLevelStorageSource`, `MemoryLevelStorageSource`.

### LevelStorage

The main interface for world persistence.

| Method | Purpose |
|---|---|
| `prepareLevel()` | Loads or creates `LevelData` |
| `checkSession()` | Makes sure the save session is still owned by this instance |
| `createChunkStorage(dimension)` | Returns a `ChunkStorage` for the given dimension |
| `saveLevelData(levelData)` | Writes world metadata |
| `saveLevelData(levelData, players)` | Writes world metadata with player list |
| `getPlayerIO()` | Returns the `PlayerIO` for player save/load |
| `closeAll()` | Flushes and closes all storage handles |
| `getDataFile(id)` | Resolves a named data file path |
| `getSaveFile()` | Returns the underlying `ConsoleSaveFile` |
| `flushSaveFile(autosave)` | Flushes pending writes to the save file |
| `getAuxValueForMap(xuid, dimension, centreXC, centreZC, scale)` | Map item ID lookup (4J addition) |

**Dimension folder constants:**
- `NETHER_FOLDER` = `"DIM-1"`
- `ENDER_FOLDER` = `"DIM1/"`

### LevelStorage implementations

#### DirectoryLevelStorage

The main storage backend. Inherits both `LevelStorage` and `PlayerIO`.

**Key features:**
- Keeps a `sessionId` for ownership validation
- Manages per-player save directories and data file paths
- Handles map data mappings through `MapDataMappings` (tracks PlayerUID-to-map-ID associations)
- For large worlds (`_LARGE_WORLDS`), uses a `PlayerMappings` class with per-player hash maps; for standard worlds, uses a fixed-size `MapDataMappings` struct
- `saveMapIdLookup()` persists map ID assignments
- `deleteMapFilesForPlayer()` cleans up map data when a player leaves
- `resetNetherPlayerPositions()` resets player positions in the Nether dimension
- `m_cachedSaveData` provides an in-memory cache for data files using `ByteArrayOutputStream`

**Map data constants (standard worlds):**
- `MAXIMUM_MAP_SAVE_DATA` = 256
- `MAP_OVERWORLD_DEFAULT_INDEX` = 255
- `MAP_NETHER_DEFAULT_INDEX` = 254
- `MAP_END_DEFAULT_INDEX` = 253

**Map data constants (large worlds):**
- `MAXIMUM_MAP_SAVE_DATA` = 8192
- Default indices at 65535, 65534, 65533

#### McRegionLevelStorage

Extends `DirectoryLevelStorage` for the McRegion save format. Sets `MCREGION_VERSION_ID = 0x4abc`. Overrides `createChunkStorage()` to return `McRegionChunkStorage` instances and handles level data saving with player lists.

#### MemoryLevelStorage

An in-memory implementation for testing or temporary worlds. Nothing gets saved to disk.

#### MockedLevelStorage

Test double for unit testing storage behavior.

## Chunk storage

### ChunkStorage interface

| Method | Purpose |
|---|---|
| `load(level, x, z)` | Loads a chunk at the given chunk coordinates |
| `save(level, levelChunk)` | Saves chunk block data |
| `saveEntities(level, levelChunk)` | Saves entities and tile entities separately |
| `tick()` | Periodic maintenance |
| `flush()` | Forces all pending writes |
| `WaitForAll()` | Blocks until all async saves finish (4J addition) |
| `WaitIfTooManyQueuedChunks()` | Back-pressure for the save queue (4J addition) |

### McRegionChunkStorage

The main chunk storage implementation using the McRegion file format.

- Uses a `RegionFileCache` for the underlying `.mcr` region files
- Keeps an `m_entityData` cache mapping chunk keys to byte arrays
- Supports threaded saving with up to 3 save threads (`s_saveThreads`) and a `s_chunkDataQueue`
- `loadEntities()` restores entities from the cached `m_entityData` map
- Thread-safe through `CRITICAL_SECTION cs_memory`

Other implementations: `MemoryChunkStorage`, `OldChunkStorage` (legacy format), `ZonedChunkStorage`.

## LevelData

`LevelData` stores all world metadata. It gets serialized to/from `CompoundTag` for NBT persistence.

### NBT tags

| Tag Name | Type | Purpose |
|---|---|---|
| `RandomSeed` | Long | World generation seed |
| `generatorName` | String | Level generator type name |
| `generatorVersion` | Int | Generator version for replacements |
| `GameType` | Int | Game mode ID |
| `MapFeatures` | Boolean | Whether structures generate |
| `spawnBonusChest` | Boolean | Whether a bonus chest spawns |
| `SpawnX`, `SpawnY`, `SpawnZ` | Int | World spawn point |
| `Time` | Long | World tick time |
| `LastPlayed` | Long | Timestamp of last save |
| `SizeOnDisk` | Long | Save file size |
| `LevelName` | String | Display name of the world |
| `version` | Int | Save format version |
| `rainTime` | Int | Ticks until rain state changes |
| `raining` | Boolean | Current rain state |
| `thunderTime` | Int | Ticks until thunder state changes |
| `thundering` | Boolean | Current thunder state |
| `hardcore` | Boolean | Hardcore mode flag |
| `allowCommands` | Boolean | Cheats enabled |
| `initialized` | Boolean | Whether the world has finished initial setup |
| `newSeaLevel` | Boolean | Use post-1.8.2 sea level (4J addition) |
| `hasBeenInCreative` | Boolean | Disables achievements if true (4J addition) |
| `hasStronghold` | Boolean | Whether stronghold position is known (4J addition) |
| `StrongholdX`, `StrongholdY`, `StrongholdZ` | Int | Stronghold coordinates (4J addition) |
| `hasStrongholdEndPortal` | Boolean | Whether end portal position is known (4J addition) |
| `StrongholdEndPortalX`, `StrongholdEndPortalZ` | Int | End portal coordinates (4J addition) |
| `XZSize` | Int | World width in blocks (4J addition, console world size) |
| `HellScale` | Int | Nether-to-overworld scale ratio (4J addition) |

### Dimension constants

```
DIMENSION_NETHER    = -1
DIMENSION_OVERWORLD =  0
DIMENSION_END       =  1
```

### Console-specific fields

The `hasBeenInCreative` flag gets set to `true` whenever the game mode is switched to Creative or cheats are turned on. This flag prevents achievements from being awarded on worlds that have been in creative mode.

`XZSize` and `HellScale` are clamped between `LEVEL_MIN_WIDTH`/`LEVEL_MAX_WIDTH` and `HELL_LEVEL_MIN_SCALE`/`HELL_LEVEL_MAX_SCALE`. The Nether size is computed as `XZSize / HellScale`, with the scale auto-adjusted if the Nether would end up too big (`HELL_LEVEL_MAX_WIDTH`).

## NBT system

All structured data in LCE is stored using the NBT (Named Binary Tag) format.

### Tag types

| ID | Type | Class | Data |
|---|---|---|---|
| 0 | End | `EndTag` | Marks the end of a compound |
| 1 | Byte | `ByteTag` | Single byte |
| 2 | Short | `ShortTag` | 16-bit integer |
| 3 | Int | `IntTag` | 32-bit integer |
| 4 | Long | `LongTag` | 64-bit integer |
| 5 | Float | `FloatTag` | 32-bit float |
| 6 | Double | `DoubleTag` | 64-bit double |
| 7 | Byte Array | `ByteArrayTag` | Variable-length byte array |
| 8 | String | `StringTag` | Wide string |
| 9 | List | `ListTag<T>` | Typed list of tags |
| 10 | Compound | `CompoundTag` | Named map of tags |
| 11 | Int Array | `IntArrayTag` | Variable-length int array |

### CompoundTag

The main container type, stored as `unordered_map<wstring, Tag*>`. Provides typed put/get methods for all tag types.

- `load()` reads tags until it hits a `TAG_End`, with a safety limit of `MAX_COMPOUND_TAGS` (10,000)
- `copy()` does a deep copy of all contained tags
- `equals()` recursively compares all entries

### Serialization flow

Tags are read and written through `DataInput` / `DataOutput` streams. `Tag::readNamedTag()` reads a type byte, a name string, and then dispatches to the right `Tag` subclass's `load()` method. `Tag::writeNamedTag()` does the reverse.

## Player data

Player save/load goes through the `PlayerIO` interface:

| Method | Purpose |
|---|---|
| `save(player)` | Serializes player data to storage |
| `load(player)` | Reads player data and returns whether the player existed (4J change: returns `bool`) |
| `loadPlayerDataTag(xuid)` | Loads raw player NBT by Xbox UID |
| `clearOldPlayerFiles()` | Removes stale player data files (4J addition) |

`DirectoryLevelStorage` implements `PlayerIO` and stores player data in a dedicated subdirectory within the world folder.

## MinecraftConsoles Differences

The storage system is mostly the same between LCEMP and MC. Both use the same `LevelStorageSource` -> `LevelStorage` -> `ChunkStorage` hierarchy, the same McRegion format, and the same NBT tag types.

### Structure saved data

The biggest addition is `StructureFeatureSavedData`, which persists structure bounding boxes (villages, strongholds, witch huts, etc.) to the world save. In LCEMP, structure positions are only tracked in memory and get regenerated from the seed on load. MC actually writes them to NBT so the game can look them up later (important for things like witch hut spawning rules).

### Scoreboard saved data

MC adds `ScoreboardSaveData` for persisting scoreboard objectives, scores, and teams. LCEMP doesn't have a scoreboard system so this doesn't exist.

### ConsoleSaveFileSplit

One interesting difference going the other direction: LCEMP has `ConsoleSaveFileSplit.h/.cpp` which MC does not. This appears to be a save file splitting mechanism that was removed or refactored in the later MC version.

### Everything else

The `LevelData` tags, NBT system, player data IO, chunk storage with threaded saving, region file cache, and map data mappings are all the same across both codebases.
