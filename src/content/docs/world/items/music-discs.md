---
title: Music Discs
description: RecordingItem class, all disc IDs (2256-2267), track names, and jukebox interaction.
---

Music discs are handled by `RecordingItem` and work with jukebox tiles (`RecordPlayerTile`) to play music.

## RecordingItem

**Files:** `Minecraft.World/RecordingItem.h`, `Minecraft.World/RecordingItem.cpp`

Each `RecordingItem` stores a `recording` string (like `"13"`, `"cat"`, `"blocks"`) that identifies the track. All discs share these properties:

| Property | Value |
|----------|-------|
| Stack Size | 1 |
| Rarity | `rare` |
| Texture Pattern | `record_` + recording name |

### Constructor

```cpp
RecordingItem::RecordingItem(int id, const wstring& recording) : Item(id), recording(recording)
{
    this->maxStackSize = 1;
}
```

The `recording` field is a `const std::wstring` and is `public` (4J changed it from `protected` in the Java source because they needed to access it from outside the class).

## Jukebox Interaction

When you use a disc on a jukebox tile (`Tile::recordPlayer`), the `useOn` method does the following:

1. Checks that the target tile is a jukebox with data value 0 (meaning no disc is currently inserted)
2. Calls `RecordPlayerTile::setRecord()` to insert the disc, passing the item ID
3. Fires `LevelEvent::SOUND_PLAY_RECORDING` with the item ID as the data parameter
4. Decreases the item stack count
5. Awards the `musicToMyEars` statistic through `GenericStats`

The disc only gets inserted on the server side (`level->isClientSide` check). The `bTestUseOnOnly` parameter (a 4J addition) lets the UI check whether the interaction would work without actually doing it, which is how tooltip display works.

### Tooltip

The `appendHoverText` method formats the artist and track name as `"C418 - <recording>"` with the rare rarity color applied through HTML formatting. The color comes from `getRarity()`, which always returns `Rarity::rare`:

```cpp
eMinecraftColour rarityColour = getRarity(shared_ptr<ItemInstance>())->color;
int colour = app.GetHTMLColour(rarityColour);
wchar_t formatted[256];
swprintf(formatted, 256, L"<font color=\"#%08x\">%ls</font>", colour, L"C418 - ", recording.c_str());
```

The raw (unformatted) recording name is also pushed to the `unformattedStrings` vector for accessibility purposes.

## Complete Disc Registry

| ID | Static Field | Recording String | Internal Index | Notes |
|----|-------------|-----------------|----------------|-------|
| 2256 | `record_01` | `"13"` | 2000 | Ambient/cave sounds |
| 2257 | `record_02` | `"cat"` | 2001 | Upbeat synthesizer |
| 2258 | `record_03` | `"blocks"` | 2002 | Upbeat electronic |
| 2259 | `record_04` | `"chirp"` | 2003 | Retro chiptune |
| 2260 | `record_05` | `"far"` | 2004 | Calm ambient |
| 2261 | `record_06` | `"mall"` | 2005 | Mellow retro |
| 2262 | `record_07` | `"mellohi"` | 2006 | Slow haunting melody |
| 2263 | `record_09` | `"stal"` | 2007 | Jazz piano |
| 2264 | `record_10` | `"strad"` | 2008 | Tropical/upbeat |
| 2265 | `record_11` | `"ward"` | 2009 | Starts with record noise, then upbeat |
| 2266 | `record_12` | `"11"` | 2010 | Broken/corrupted recording |
| 2267 | `record_08` | `"where are we now"` | 2011 | LCE-exclusive disc |

The "Internal Index" column shows the constructor argument passed to `RecordingItem`. This is the internal numbering, not the item ID. The item IDs in the `Item.h` constants (`record_01_Id` through `record_12_Id`) map to the standard 2256-2267 range.

Note the quirky naming: the static field `record_08` holds the "where are we now" disc (ID 2267), while `record_09` through `record_12` hold "stal" through "11". This is because the LCE-exclusive disc was added after the others and got the `_08` slot, pushing the numbering out of order.

The disc with ID 2267 (`"where are we now"`) is noted in the source as *"not playable in the PC game, but is fine in ours"*. This is a Legacy Console Edition exclusive music disc.

## Icon Registration

Each disc registers its own icon using the pattern `record_<recording>`:

```cpp
void RecordingItem::registerIcons(IconRegister *iconRegister)
{
    icon = iconRegister->registerIcon(L"record_" + recording);
}
```

So the texture files are named `record_13`, `record_cat`, `record_blocks`, etc.

## MinecraftConsoles differences

The music disc system (`RecordingItem`) is the same between LCEMP and MinecraftConsoles. Same 12 disc IDs (2256-2267), same recording names, same constructor index values (2000-2011), same jukebox interaction through `RecordPlayerTile`, same tooltip formatting.

The LCE-exclusive disc "where are we now" (ID 2267) is present in both codebases. The quirky `record_08`/`record_09` field naming is also the same.

MinecraftConsoles does rename `JukeboxTile` as a separate header (it gets its own `JukeboxTile.h` file), but the functionality is the same `RecordPlayerTile` system that LCEMP uses. The only API difference is that `setTextureName` is renamed to `setIconName` in MinecraftConsoles, but this is a codebase-wide rename, not specific to music discs.
