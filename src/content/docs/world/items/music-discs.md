---
title: Music Discs
description: All music disc IDs, field names, and how RecordingItem works in LCE.
---

## RecordingItem

**Files:** `Minecraft.World/RecordingItem.h`, `Minecraft.World/RecordingItem.cpp`

Each disc stores a `recording` string (e.g., `"13"`, `"cat"`, `"blocks"`). The `useOn` method interacts with jukeboxes (`RecordPlayerTile`): when used on a jukebox with data 0, the disc is inserted, count is decremented, and a `SOUND_PLAY_RECORDING` level event is fired.

All discs have `Rarity::rare` (overridden via `getRarity()`). Stack size is 1 (set in the constructor). Texture icons are registered as `"record_" + recording`.

The tooltip displays the artist and track name via `appendHoverText`, formatted with the rarity color.

## Complete Music Disc Table

| ID | Recording Field | Description |
|----|----------------|-------------|
| 2256 | `"13"` | C418 - 13 |
| 2257 | `"cat"` | C418 - cat |
| 2258 | `"blocks"` | C418 - blocks |
| 2259 | `"chirp"` | C418 - chirp |
| 2260 | `"far"` | C418 - far |
| 2261 | `"mall"` | C418 - mall |
| 2262 | `"mellohi"` | C418 - mellohi |
| 2263 | `"stal"` | C418 - stal |
| 2264 | `"strad"` | C418 - strad |
| 2265 | `"ward"` | C418 - ward |
| 2266 | `"11"` | C418 - 11 |
| 2267 | `"where are we now"` | LCE-exclusive disc |

The disc with ID 2267 (`"where are we now"`) is noted in the source as "not playable in the PC game, but is fine in ours" -- a Legacy Console Edition exclusive music disc.

## How Records Work

1. Player right-clicks a jukebox tile (`RecordPlayerTile`) with a music disc
2. `RecordingItem::useOn()` checks if the tile at the position is `Tile::recordPlayer` with data 0 (empty)
3. The disc's item ID is passed to `RecordPlayerTile::setRecord()` which stores it in the tile data
4. A `LevelEvent::SOUND_PLAY_RECORDING` event is fired with the item ID, triggering audio playback on the client
5. The disc's `ItemInstance::count` is decremented (removing it from the player's inventory)
6. The `musicToMyEars` achievement is awarded to the player
