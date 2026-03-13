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

The `appendHoverText` method formats the artist and track name as `"C418 - <recording>"` with the rare rarity color applied through HTML formatting:

```cpp
swprintf(formatted, 256, L"<font color=\"#%08x\">%ls</font>", colour, L"C418 - ", recording.c_str());
```

## Complete Disc Registry

| ID | Field Name | Track Name | Notes |
|----|-----------|------------|-------|
| 2256 | `"13"` | 13 | Ambient/cave sounds |
| 2257 | `"cat"` | Cat | Upbeat synthesizer |
| 2258 | `"blocks"` | Blocks | Upbeat electronic |
| 2259 | `"chirp"` | Chirp | Retro chiptune |
| 2260 | `"far"` | Far | Calm ambient |
| 2261 | `"mall"` | Mall | Mellow retro |
| 2262 | `"mellohi"` | Mellohi | Slow haunting melody |
| 2263 | `"stal"` | Stal | Jazz piano |
| 2264 | `"strad"` | Strad | Tropical/upbeat |
| 2265 | `"ward"` | Ward | Starts with record noise, then upbeat |
| 2266 | `"11"` | 11 | Broken/corrupted recording |
| 2267 | `"where are we now"` | Where Are We Now | LCE-exclusive disc |

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

The music disc system (`RecordingItem`) is the same between LCE and MinecraftConsoles. Same 12 disc IDs (2256-2267), same recording names, same jukebox interaction through `RecordPlayerTile`, same tooltip formatting.

The LCE-exclusive disc "where are we now" (ID 2267) is present in both codebases.

MinecraftConsoles does rename `JukeboxTile` as a separate header (it gets its own `JukeboxTile.h` file), but the functionality is the same `RecordPlayerTile` system that LCE uses.
