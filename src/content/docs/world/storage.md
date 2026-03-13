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
- Iterates up to `MINECRAFT_NET_MAX_PLAYERS` when loading map ID lookups

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

**Threading model:**
- Uses 3 save threads (`s_saveThreads[3]`), each on a different CPU core (`CPU_CORE_SAVE_THREAD_A/B/C`)
- Thread B runs at `THREAD_PRIORITY_BELOW_NORMAL` on Orbis because it shares a core with the Matching 2 library
- A shared `s_chunkDataQueue` (deque of `DataOutputStream*`) feeds work to the save threads
- `s_runningThreadCount` tracks how many threads are currently processing
- All access to the queue and counter is guarded by `cs_memory` (a critical section with spin count 5120)

**Back-pressure system:**
- `WaitIfTooManyQueuedChunks()` blocks if the queue grows past `MAX_QUEUE_SIZE` (12) and waits until it drops to `DESIRED_QUEUE_SIZE` (6)
- `WaitForAllSaves()` blocks until the queue is empty AND all running threads have finished
- Save threads sleep 1ms if there is more work to do, 100ms if idle

**Entity data caching:**
- Keeps an `m_entityData` map of `int64 -> byteArray` for per-chunk entity storage
- The chunk key is computed as `(x << 32) | (z & 0xFFFFFFFF)`
- Entity data is stored as serialized NBT in byte arrays
- When `SPLIT_SAVES` is defined, entities are saved to a separate `entities.dat` file during flush

**Region file creation:**
On construction, pre-creates region files for all three dimensions in a specific order that makes the initial level save fast:
```
DIM-1r.-1.-1.mcr, DIM-1r.0.-1.mcr, DIM-1r.0.0.mcr, DIM-1r.-1.0.mcr
DIM1/r.-1.-1.mcr, DIM1/r.0.-1.mcr, DIM1/r.0.0.mcr, DIM1/r.-1.0.mcr
r.-1.-1.mcr, r.0.-1.mcr, r.0.0.mcr, r.-1.0.mcr
```

Other implementations: `MemoryChunkStorage`, `OldChunkStorage` (legacy format), `ZonedChunkStorage`.

### How chunks are saved

The save path depends on the save file version:

**Compressed chunk storage** (version >= `SAVE_FILE_VERSION_COMPRESSED_CHUNK_STORAGE`):

1. Gets a `DataOutputStream` from `RegionFileCache::getChunkDataOutputStream()`
2. Calls `OldChunkStorage::save(levelChunk, level, dos)` which writes a binary format:
   - `short`: save file version number
   - `int`: chunk X coordinate
   - `int`: chunk Z coordinate
   - `long`: world time
   - Compressed block data (via `lc->writeCompressedBlockData()`)
   - Compressed data layer (via `lc->writeCompressedDataData()`)
   - Compressed sky light (via `lc->writeCompressedSkyLightData()`)
   - Compressed block light (via `lc->writeCompressedBlockLightData()`)
   - Height map (raw byte array, 16x16)
   - `short`: terrain populated flags (bitfield)
   - Biome data (raw byte array)
   - NBT compound tag containing entities, tile entities, and tile ticks
3. The `DataOutputStream` is pushed to `s_chunkDataQueue` for async compression and writing

**Legacy NBT format** (older save versions):

1. Creates a `CompoundTag` with a `"Level"` child
2. Writes all chunk data as named NBT tags (see "Chunk NBT tags" below)
3. Writes through `NbtIo::write()` to the output stream
4. Cleans up synchronously

### Chunk NBT tags

When chunks are saved in the NBT format:

| Tag Name | Type | Purpose |
|---|---|---|
| `xPos` | Int | Chunk X coordinate |
| `zPos` | Int | Chunk Z coordinate |
| `LastUpdate` | Long | World time when last saved |
| `Blocks` | ByteArray | Block IDs, 32768 bytes (16x16x128) |
| `Data` | ByteArray | Block data values, 16384 bytes (nibble-packed) |
| `SkyLight` | ByteArray | Sky light levels, 16384 bytes (nibble-packed) |
| `BlockLight` | ByteArray | Block light levels, 16384 bytes (nibble-packed) |
| `HeightMap` | ByteArray | Per-column height, 256 bytes (16x16) |
| `TerrainPopulatedFlags` | Short | Bitfield for which neighbors have been populated. Changed from Java's `TerrainPopulated` boolean. |
| `Biomes` | ByteArray | Per-column biome IDs |
| `Entities` | List of Compound | All entities in this chunk |
| `TileEntities` | List of Compound | All tile entities (chests, signs, etc.) |
| `TileTicks` | List of Compound | Pending block tick updates |

Each entry in `TileTicks` has:
- `i` (Int): tile/block ID
- `x`, `y`, `z` (Int): block position
- `t` (Int): delay in ticks relative to world time

The terrain populated flags use a bitfield where each direction has its own bit, plus `sTerrainPopulatedAllNeighbours` and `sTerrainPostPostProcessed`. Old saves that used a boolean are converted: if the value is >= 1, it gets all flags set.

### How chunks are loaded

1. `McRegionChunkStorage::load()` calls `RegionFileCache::getChunkDataInputStream()` to get the decompressed data
2. For compressed storage format: calls `OldChunkStorage::load(level, dis)` which reads the binary format in the same order it was written
3. For NBT format: reads the `CompoundTag`, validates it has `"Level"` and `"Blocks"` tags, then calls `OldChunkStorage::load(level, tag)`
4. Validates the chunk is at the right coordinates. If it is not, it deletes the chunk and returns null (the old code tried to relocate it, but that was commented out because data gets freed during load).
5. Loads entities from either the inline NBT or the separate `entities.dat` cache

### Thread-local storage for chunk serialization

`OldChunkStorage` uses thread-local storage (TLS) for its scratch buffers:

```cpp
class ThreadStorage {
    byteArray blockData;      // CHUNK_TILE_COUNT bytes
    byteArray dataData;       // HALF_CHUNK_TILE_COUNT bytes
    byteArray skyLightData;   // HALF_CHUNK_TILE_COUNT bytes
    byteArray blockLightData; // HALF_CHUNK_TILE_COUNT bytes
};
```

- The main thread calls `CreateNewThreadStorage()` to allocate the default TLS
- Save threads call `CreateNewThreadStorage()` to get their own copy
- Connection read threads call `UseDefaultThreadStorage()` to share the default
- `ReleaseThreadStorage()` frees per-thread storage (but not the default)

This avoids dynamic allocation in hot paths and prevents contention between the 3 save threads.

## McRegion file format

The McRegion format stores chunks in region files, each covering a 32x32 chunk area.

### Region file naming

Region files are named `r.X.Z.mcr` where X and Z are the region coordinates (chunk coordinate >> 5). They live in:
- Overworld: root of the save folder
- Nether: `DIM-1/` subfolder
- End: `DIM1/` subfolder

### Region file layout

Each region file is divided into 4096-byte sectors:

| Sector | Content |
|---|---|
| 0 | Chunk offset table (1024 ints, 4 bytes each) |
| 1 | Chunk timestamp table (1024 ints, 4 bytes each) |
| 2+ | Chunk data |

The offset table has one entry per chunk position (x + z * 32). Each entry is packed as:
- **Upper 24 bits** (byte offset >> 8): sector number where the chunk data starts
- **Lower 8 bits** (byte offset & 0xFF): number of sectors the chunk occupies

An offset of 0 means the chunk has not been saved.

### Chunk data format (on disk)

LCE uses a custom format different from Java Edition. Each chunk's data in the region file has:

```
[4 bytes: compressed length]  -- high bit set means RLE compression
[4 bytes: decompressed length]
[N bytes: compressed data]
```

The high bit of the compressed length (`0x80000000`) flags RLE compression:
- If set: data was compressed with `CompressLZXRLE()`
- If not set: data was compressed with standard `Compress()` (LZX)

This differs from Java which uses a 4-byte length, 1-byte compression type (gzip or deflate), then data.

### Sector allocation

When a chunk is written:

1. Compresses the data using `Compression::CompressLZXRLE()`. Allocates `length + 2048` bytes for the output buffer to handle cases where "compression" actually makes small chunks bigger.
2. Computes sectors needed: `(compLength + CHUNK_HEADER_SIZE) / SECTOR_BYTES + 1`. The header is 8 bytes (two ints).
3. If the chunk fits in its existing allocation, overwrites in place.
4. If it does not fit, marks old sectors as free, then scans for a contiguous run of free sectors large enough.
5. If no free run is found, appends new sectors at the end of the file.
6. Zeroes freed sectors so the file compresses better at the platform level.
7. Updates the offset and timestamp tables.
8. Maximum chunk size is 256 sectors (1 MB). Chunks that compress to more than this are silently dropped.

### Region file bounds

`outOfBounds()` rejects chunk coordinates outside 0-31 in either axis. The offset lookup is `offsets[x + z * 32]`.

### Endianness

If `isSaveEndianDifferent()` returns true (the save was created on a different platform), the region file reads go through `System::ReverseULONG()` and `System::ReverseINT()` to swap byte order. This allows cross-platform save file conversion.

### RegionFileCache

The `RegionFileCache` class manages open `RegionFile` objects with a max cache size of 256. It has:

- A static default cache (`s_defaultCache`) for normal game use
- Instance methods prefixed with `_` for when you need a separate cache (e.g., save file conversion)
- `getChunkDataInputStream()`: opens the region file, reads and decompresses chunk data
- `getChunkDataOutputStream()`: creates a `ChunkBuffer` (a `ByteArrayOutputStream` subclass) that writes to the region file when `close()` is called

## LevelData

`LevelData` stores all world metadata. It gets serialized to/from `CompoundTag` for NBT persistence.

### NBT tags

| Tag Name | Type | Purpose |
|---|---|---|
| `RandomSeed` | Long | World generation seed |
| `generatorName` | String | Level generator type name (e.g., "default", "flat", "largeBiomes") |
| `generatorVersion` | Int | Generator version for replacements. If the generator `hasReplacement()`, looks up the right version. |
| `GameType` | Int | Game mode ID (0=survival, 1=creative, 2=adventure) |
| `MapFeatures` | Boolean | Whether structures generate. Defaults to true if missing. |
| `spawnBonusChest` | Boolean | Whether a bonus chest spawns |
| `SpawnX`, `SpawnY`, `SpawnZ` | Int | World spawn point |
| `Time` | Long | World tick time. Initialized to -1 for new worlds to detect uninitialized state. |
| `LastPlayed` | Long | Timestamp of last save (set to `System::currentTimeMillis()` on save) |
| `SizeOnDisk` | Long | Save file size |
| `LevelName` | String | Display name of the world |
| `version` | Int | Save format version |
| `rainTime` | Int | Ticks until rain state changes |
| `raining` | Boolean | Current rain state |
| `thunderTime` | Int | Ticks until thunder state changes |
| `thundering` | Boolean | Current thunder state |
| `hardcore` | Boolean | Hardcore mode flag |
| `allowCommands` | Boolean | Cheats enabled. Defaults to `true` if game type is Creative and the tag is missing. |
| `initialized` | Boolean | Whether the world has finished initial setup. Defaults to true if missing. |
| `newSeaLevel` | Boolean | Use post-1.8.2 sea level (4J addition). Only true for newly created maps. Defaults to false on load. |
| `hasBeenInCreative` | Boolean | Disables achievements if true (4J addition). Set when switching to Creative or enabling cheats. |
| `hasStronghold` | Boolean | Whether stronghold position is known (4J addition) |
| `StrongholdX`, `StrongholdY`, `StrongholdZ` | Int | Stronghold coordinates (4J addition). Set to 0 if `hasStronghold` is false. |
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

The `hasBeenInCreative` flag is set in `setGameType()`:

```cpp
hasBeenInCreative = hasBeenInCreative || (gameType == GameType::CREATIVE) || app.GetGameHostOption(eGameHostOption_CheatsEnabled) > 0;
```

Once set, it never goes back to false. This permanently prevents achievements from being awarded on that world.

`XZSize` is clamped between `LEVEL_MIN_WIDTH` and `LEVEL_MAX_WIDTH`. `HellScale` is clamped between `HELL_LEVEL_MIN_SCALE` and `HELL_LEVEL_MAX_SCALE`. The Nether size is computed as `XZSize / HellScale`, with the scale auto-adjusted upward if the Nether would end up bigger than `HELL_LEVEL_MAX_WIDTH`:

```cpp
int hellXZSize = m_xzSize / m_hellScale;
while (hellXZSize > HELL_LEVEL_MAX_WIDTH && m_hellScale < HELL_LEVEL_MAX_SCALE) {
    ++m_hellScale;
    hellXZSize = m_xzSize / m_hellScale;
}
```

### Tags that LCE does not save

LCE removed the `Player` compound tag from `LevelData`. Java Edition stores the single-player's position, inventory, etc. inside level.dat. LCE stores player data separately through the `PlayerIO` system, since there are always multiple players.

The `dimension` field is read but never written (removed in TU9 because it was never accurate).

## NBT system

All structured data in LCE is stored using the NBT (Named Binary Tag) format.

### Tag types

| ID | Type | Class | Stored Data |
|---|---|---|---|
| 0 | End | `EndTag` | Marks the end of a compound. No payload. |
| 1 | Byte | `ByteTag` | Single signed byte |
| 2 | Short | `ShortTag` | 16-bit signed integer |
| 3 | Int | `IntTag` | 32-bit signed integer |
| 4 | Long | `LongTag` | 64-bit signed integer |
| 5 | Float | `FloatTag` | 32-bit IEEE 754 float |
| 6 | Double | `DoubleTag` | 64-bit IEEE 754 double |
| 7 | Byte Array | `ByteArrayTag` | Length-prefixed array of bytes |
| 8 | String | `StringTag` | UTF-16 wide string (not UTF-8 like Java Edition) |
| 9 | List | `ListTag<T>` | Typed list of tags (all same type) |
| 10 | Compound | `CompoundTag` | Named map of tags (any type) |
| 11 | Int Array | `IntArrayTag` | Length-prefixed array of 32-bit ints |

### Wire format

Each named tag on disk is:

```
[1 byte: tag type ID]
[2 bytes: name length (UTF-16 chars)]
[N*2 bytes: name string (UTF-16)]
[variable: tag payload]
```

For `TAG_End` (type 0), only the type byte is written, no name or payload.

### How tags are read

`Tag::readNamedTag()` reads a single named tag from a `DataInput` stream:

1. Reads the type byte. If 0, returns an `EndTag`.
2. If 255 (invalid), returns an `EndTag` as a safety measure.
3. Reads the name as a UTF-16 string via `dis->readUTF()`.
4. Creates the right tag type via `Tag::newTag()`.
5. Calls `tag->load(dis)` to read the payload.

**Safety limits:**
- Maximum nesting depth: **256**. Uses thread-local (`__declspec(thread)`) depth counter.
- Maximum total tags per read operation: **32768** (`MAX_TOTAL_TAGS`). Also thread-local.
- Both limits return an `EndTag` when exceeded, stopping the parse.

### How tags are written

`Tag::writeNamedTag()` writes:
1. The tag's type ID byte
2. If not `TAG_End`, the tag's name via `dos->writeUTF()`
3. The tag's payload via `tag->write(dos)`

### CompoundTag

The main container type, stored as `unordered_map<wstring, Tag*>`. Provides typed put/get methods for all tag types.

**Loading:**
- Reads tags in a loop until it hits a `TAG_End`
- Safety limit of `MAX_COMPOUND_TAGS` (10,000) entries per compound
- Tags are indexed by name in the hash map

**Writing:**
- Iterates the map and writes each tag via `Tag::writeNamedTag()`
- Writes a `TAG_End` byte at the end

**Memory management:**
- Destructor deletes all contained tags
- `copy()` does a deep copy of all entries
- `equals()` recursively compares all entries (size check first, then per-key comparison)
- `getCompound()` and `getList()` return a new empty tag if the key is not found (careful: this leaks if you do not check `contains()` first)

**Typed accessors:**

| Method | Tag Type | Default if Missing |
|---|---|---|
| `getByte(name)` | ByteTag | 0 |
| `getShort(name)` | ShortTag | 0 |
| `getInt(name)` | IntTag | 0 |
| `getLong(name)` | LongTag | 0 |
| `getFloat(name)` | FloatTag | 0.0f |
| `getDouble(name)` | DoubleTag | 0.0 |
| `getString(name)` | StringTag | "" |
| `getByteArray(name)` | ByteArrayTag | empty array |
| `getIntArray(name)` | IntArrayTag | empty array |
| `getBoolean(name)` | ByteTag | false (getByte != 0) |
| `getCompound(name)` | CompoundTag | new empty CompoundTag |
| `getList(name)` | ListTag | new empty ListTag |

### NbtIo

The `NbtIo` class handles reading and writing NBT trees:

| Method | Purpose |
|---|---|
| `read(DataInput*)` | Reads a single named CompoundTag from a stream. Returns null if root is not a compound. |
| `write(CompoundTag*, DataOutput*)` | Writes a named CompoundTag to a stream |
| `readCompressed(InputStream*)` | Reads from a stream (originally used GZIPInputStream, but 4J removed gzip) |
| `writeCompressed(CompoundTag*, OutputStream*)` | Writes through a 1024-byte buffered stream (originally used GZIPOutputStream, but 4J removed gzip) |
| `decompress(byteArray)` | Reads a CompoundTag from a byte buffer (originally decompressed gzip, now just reads raw) |
| `compress(CompoundTag*)` | Writes a CompoundTag to a byte buffer (originally compressed with gzip, now just writes raw) |

Note that LCE removed Java's gzip compression from NBT serialization. The comments say "was new GZIPInputStream" and "was new GZIPOutputStream" but the actual code just uses raw `DataInputStream` / `DataOutputStream`. Compression is handled at the region file level with LZX instead.

### String encoding difference

LCE uses **UTF-16** (`wstring`, `wchar_t`) for all string tags, not UTF-8 like Java Edition. The `DataInput::readUTF()` and `DataOutput::writeUTF()` methods read/write a short length prefix followed by UTF-16 characters. This means save files are not directly compatible between LCE and Java Edition at the string level.

## Player data

Player save/load goes through the `PlayerIO` interface:

| Method | Purpose |
|---|---|
| `save(player)` | Serializes player data to storage |
| `load(player)` | Reads player data and returns `bool` for whether the player existed (4J change: original returned void) |
| `loadPlayerDataTag(xuid)` | Loads raw player NBT by Xbox UID |
| `clearOldPlayerFiles()` | Removes stale player data files (4J addition) |

`DirectoryLevelStorage` implements `PlayerIO` and stores player data in a dedicated subdirectory within the world folder.

### What gets saved per player

Each player's data is serialized through `Entity::save()` and `Player`-specific save logic into a `CompoundTag` containing:

- Position (x, y, z as doubles in a list)
- Motion (xd, yd, zd as doubles in a list)
- Rotation (yRot, xRot as floats in a list)
- Health, food level, saturation
- Inventory contents (each slot as item ID, count, damage, NBT)
- Current dimension
- Game mode
- Abilities (flying, creative, etc.)
- Active potion effects
- Experience level and points
- Spawn position
- Player-specific XUIDs

### New player setup

When a player joins for the first time (`load()` returns true for new player), they get:
- A map item in inventory slot 9, centered on their position (or world origin for small worlds)
- Game rule post-processing via `app.getGameRuleDefinitions()->postProcessPlayer()`

## MinecraftConsoles differences

The storage system is mostly the same between LCEMP and MC. Both use the same `LevelStorageSource` -> `LevelStorage` -> `ChunkStorage` hierarchy, the same McRegion format, and the same NBT tag types.

### Structure saved data

The biggest addition is `StructureFeatureSavedData`, which persists structure bounding boxes (villages, strongholds, witch huts, etc.) to the world save. In LCEMP, structure positions are only tracked in memory and get regenerated from the seed on load. MC actually writes them to NBT so the game can look them up later (important for things like witch hut spawning rules).

### Scoreboard saved data

MC adds `ScoreboardSaveData` for persisting scoreboard objectives, scores, and teams. LCEMP doesn't have a scoreboard system so this doesn't exist.

### ConsoleSaveFileSplit

One interesting difference going the other direction: LCEMP has `ConsoleSaveFileSplit.h/.cpp` which MC does not. This appears to be a save file splitting mechanism that was removed or refactored in the later MC version.

### Everything else

The `LevelData` tags, NBT system, player data IO, chunk storage with threaded saving, region file cache, and map data mappings are all the same across both codebases.
