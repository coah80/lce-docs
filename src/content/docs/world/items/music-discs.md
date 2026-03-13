---
title: Music Discs
description: RecordingItem class, all disc IDs (2256-2267), track names, and jukebox interaction.
---

Music discs are implemented by `RecordingItem` and interact with jukebox tiles (`RecordPlayerTile`) to play music.

## RecordingItem

**Files:** `Minecraft.World/RecordingItem.h`, `Minecraft.World/RecordingItem.cpp`

Each `RecordingItem` stores a `recording` string (e.g., `"13"`, `"cat"`, `"blocks"`) that identifies the track. All discs share these properties:

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

The `recording` field is declared as `const std::wstring` and is `public` (4J changed it from `protected` in the Java source because they needed to access it externally).

## Jukebox Interaction

When a disc is used on a jukebox tile (`Tile::recordPlayer`), the `useOn` method:

1. Checks that the target tile is a jukebox with data value 0 (no disc inserted)
2. Calls `RecordPlayerTile::setRecord()` to insert the disc, passing the item ID
3. Fires `LevelEvent::SOUND_PLAY_RECORDING` with the item ID as the data parameter
4. Decrements the item stack count
5. Awards the `musicToMyEars` statistic via `GenericStats`

The disc is only inserted on the server side (`level->isClientSide` check). The `bTestUseOnOnly` parameter (a 4J addition) allows the UI to check if the interaction would succeed without actually performing it, enabling tooltip display.

### Tooltip

The `appendHoverText` method formats the artist and track name as `"C418 - <recording>"` with the rare rarity color applied via HTML formatting:

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

The disc with ID 2267 (`"where are we now"`) is noted in the source as *"not playable in the PC game, but is fine in ours"* -- this is a Legacy Console Edition exclusive music disc.

## Icon Registration

Each disc registers its own icon using the pattern `record_<recording>`:

```cpp
void RecordingItem::registerIcons(IconRegister *iconRegister)
{
    icon = iconRegister->registerIcon(L"record_" + recording);
}
```

This means the texture files are named `record_13`, `record_cat`, `record_blocks`, etc.
