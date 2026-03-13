---
title: World Size
description: How world boundaries work in LCE, the size limit system, and how to change limits.
---

One of the biggest differences between Legacy Console Edition and Java/Bedrock is that LCE worlds have hard size limits. The world is a fixed grid of chunks, and you literally cannot go past the edge. This page explains how that works and what you can change.

## World Size Constants

The size constants are defined in `ChunkSource.h`. The values are in chunks (multiply by 16 to get blocks):

```cpp
// With _LARGE_WORLDS enabled (PS4, Xbox One, etc.)
#define LEVEL_MAX_WIDTH   (5*64)   // 320 chunks = 5120 blocks

// Without _LARGE_WORLDS (Xbox 360, PS3, Vita)
#define LEVEL_MAX_WIDTH  54        // 864 blocks only

#define LEVEL_MIN_WIDTH  54        // Can't go smaller than classic
#define LEVEL_LEGACY_WIDTH 54      // Original Xbox 360 / PS3 size
```

The `_LARGE_WORLDS` preprocessor flag controls whether the platform supports world sizes beyond the classic 864x864. On older hardware like Xbox 360 and PS3, this flag is off and you are stuck at 54 chunks.

## All World Sizes

When creating a world on platforms with `_LARGE_WORLDS`, the create world menu maps the size selection to chunk counts and Nether scales. Here are the exact values from `UIScene_CreateWorldMenu.cpp`:

| Size | Chunks (XZ) | Blocks (XZ) | Total Area | Nether Scale | Nether Chunks |
|---|---|---|---|---|---|
| Classic | 54 | 864 | 746,496 blocks | 3 | 18 |
| Small | 64 | 1,024 | 1,048,576 blocks | 3 | ~21 |
| Medium | 192 (3 x 64) | 3,072 | 9,437,184 blocks | 6 | 32 |
| Large | 320 (5 x 64) | 5,120 | 26,214,400 blocks | 8 | 40 |

On platforms without `_LARGE_WORLDS` (Xbox 360, PS3, Vita), there is only one size. The create world code skips the switch statement entirely and just uses:

```cpp
param->xzSize = LEVEL_MAX_WIDTH;      // 54
param->hellScale = HELL_LEVEL_MAX_SCALE; // 3
```

### The Create World Code

Here is the actual size selection code from `UIScene_CreateWorldMenu.cpp`:

```cpp
#ifdef _LARGE_WORLDS
switch(pClass->m_MoreOptionsParams.worldSize)
{
case 0:
    // Classic
    param->xzSize = 1 * 54;
    param->hellScale = 3;
    break;
case 1:
    // Small
    param->xzSize = 1 * 64;
    param->hellScale = 3;
    break;
case 2:
    // Medium
    param->xzSize = 3 * 64;
    param->hellScale = 6;
    break;
case 3:
    // Large
    param->xzSize = LEVEL_MAX_WIDTH;
    param->hellScale = HELL_LEVEL_MAX_SCALE;
    break;
};
#else
param->xzSize = LEVEL_MAX_WIDTH;
param->hellScale = HELL_LEVEL_MAX_SCALE;
#endif
```

Note that Large uses the `LEVEL_MAX_WIDTH` and `HELL_LEVEL_MAX_SCALE` defines rather than hardcoded numbers. This means if you change those defines, the Large world size changes with them.

## Nether Scaling

The Nether is always smaller than the Overworld, scaled down by a factor. The scale changes with world size:

```cpp
// Scale was 8 in the Java game, but that would make our nether tiny
// Every 1 block you move in the nether maps to HELL_LEVEL_SCALE blocks
// in the overworld

#ifdef _LARGE_WORLDS
#define HELL_LEVEL_MAX_SCALE 8
#else
#define HELL_LEVEL_MAX_SCALE 3
#endif
#define HELL_LEVEL_MIN_SCALE 3
#define HELL_LEVEL_LEGACY_SCALE 3

#define HELL_LEVEL_MAX_WIDTH (LEVEL_MAX_WIDTH / HELL_LEVEL_MAX_SCALE)
#define HELL_LEVEL_MIN_WIDTH 18
```

Here is the math for each world size:

| World Size | Overworld Chunks | Nether Scale | Nether Chunks | Nether Blocks |
|---|---|---|---|---|
| Classic | 54 | 3 | 18 | 288 |
| Small | 64 | 3 | ~21 | ~336 |
| Medium | 192 | 6 | 32 | 512 |
| Large | 320 | 8 | 40 | 640 |

The comment in `ChunkSource.h` says "Scale was 8 in the Java game, but that would make our nether tiny." On Java, 1 Nether block = 8 Overworld blocks. 4J kept that ratio for Large worlds but lowered it for smaller worlds so the Nether would not be tiny.

### The End

The End is always fixed at 18 chunks regardless of world size:

```cpp
#define END_LEVEL_SCALE 3
// 4J Stu - Fix the size of the end for all platforms
// 54 / 3 = 18
#define END_LEVEL_MAX_WIDTH 18
#define END_LEVEL_MIN_WIDTH 18
```

The original code had `END_LEVEL_MAX_WIDTH` calculated from `LEVEL_MAX_WIDTH / END_LEVEL_SCALE`, but that line is commented out. 4J decided to just fix the End at 18 chunks for every platform and every world size.

## How Size is Stored

The world size is stored in `LevelData` as `m_xzSize` (in chunks). It gets saved to the NBT data as `XZSize` and the Nether scale as `HellScale`:

```cpp
// LevelData.cpp - saving
tag->putInt(L"XZSize", m_xzSize);
tag->putInt(L"HellScale", m_hellScale);

// LevelData.cpp - loading
m_xzSize = tag->getInt(L"XZSize");
m_hellScale = tag->getInt(L"HellScale");

// Clamped to valid range
m_xzSize = min(m_xzSize, LEVEL_MAX_WIDTH);
m_xzSize = max(m_xzSize, LEVEL_MIN_WIDTH);
```

There is also validation to make sure the Nether is not too big:

```cpp
int hellXZSize = m_xzSize / m_hellScale;
while (hellXZSize > HELL_LEVEL_MAX_WIDTH && m_hellScale < HELL_LEVEL_MAX_SCALE)
{
    ++m_hellScale;
    hellXZSize = m_xzSize / m_hellScale;
}
```

This loop increases the Nether scale until the Nether fits within `HELL_LEVEL_MAX_WIDTH` (40 chunks). It is a safety check for when save data gets corrupted or manually edited.

## How Dimensions Get Their Size

Each dimension asks `LevelData` for its size. The Overworld and End use the value directly, but the Nether divides by the hell scale:

```cpp
// Dimension.cpp - Overworld
int Dimension::getXZSize()
{
    return level->getLevelData()->getXZSize();
}

// HellDimension.cpp - Nether
int HellDimension::getXZSize()
{
    return ceil(
        static_cast<float>(level->getLevelData()->getXZSize()) /
        level->getLevelData()->getHellScale()
    );
}
```

The `ChunkSource` base class also stores `m_XZSize` and uses it to reject chunk requests outside the boundary.

## World Expansion (Large Worlds)

On platforms with `_LARGE_WORLDS`, players can expand their world after creation. When you increase the world size, the old boundary gets a "moat" (an ocean edge) and new terrain generates beyond it:

```cpp
// LevelData.cpp - world expansion
int newWorldSize = app.GetGameNewWorldSize();
int newHellScale = app.GetGameNewHellScale();
m_hellScaleOld = m_hellScale;
m_xzSizeOld = m_xzSize;

if (newWorldSize > m_xzSize)
{
    bool bUseMoat = app.GetGameNewWorldSizeUseMoat();
    switch (m_xzSize)
    {
    case LEVEL_WIDTH_CLASSIC:  m_classicEdgeMoat = bUseMoat;  break;
    case LEVEL_WIDTH_SMALL:    m_smallEdgeMoat = bUseMoat;    break;
    case LEVEL_WIDTH_MEDIUM:   m_mediumEdgeMoat = bUseMoat;   break;
    default: assert(0); break;
    }
    m_xzSize = newWorldSize;
    m_hellScale = newHellScale;
}
```

The old size is preserved in `m_xzSizeOld` so the chunk generator knows where the old edge was and can place the moat. There are separate moat flags for each expansion boundary (`m_classicEdgeMoat`, `m_smallEdgeMoat`, `m_mediumEdgeMoat`) so the world remembers which edges have moats even after multiple expansions.

### Expansion Paths

You can only expand upward, never shrink. The valid expansion paths are:

- Classic (54) to Small (64) to Medium (192) to Large (320)
- Classic (54) to Medium (192) to Large (320)
- Classic (54) to Large (320)
- Small (64) to Medium (192) to Large (320)
- Small (64) to Large (320)
- Medium (192) to Large (320)

Each expansion updates both the Nether scale and the world size. The moat option lets the player choose whether the old boundary gets an ocean border or just blends into the new terrain.

## Changing the World Size Limit

### Making Existing Sizes Bigger

The simplest change is bumping `LEVEL_MAX_WIDTH`. If you change it from `(5*64)` to, say, `(8*64)`, you can support worlds up to 8192 blocks wide. But keep in mind:

- Memory usage scales with the square of the world size (double the width = 4x the chunks)
- The chunk cache and save system need to handle the extra data
- Maps (`MapItem`) have hardcoded zoom levels based on the expected world sizes

### Adding a New Size Tier

To add a new "Huge" world size option:

**Step 1:** Add the constant in `ChunkSource.h`:

```cpp
#define LEVEL_WIDTH_HUGE  (8*64)   // 8192 blocks
```

And update the max:

```cpp
#define LEVEL_MAX_WIDTH  (8*64)
```

**Step 2:** Add a host option value in `App_enums.h`:

```cpp
enum EGameHostOptionWorldSize
{
    e_worldSize_Classic,
    e_worldSize_Small,
    e_worldSize_Medium,
    e_worldSize_Large,
    e_worldSize_Huge,     // new
    e_worldSize_Unknown
};
```

**Step 3:** Wire up the LevelData loading to recognize it:

```cpp
case LEVEL_WIDTH_HUGE:
    hostOptionworldSize = e_worldSize_Huge;
    break;
```

**Step 4:** Add the case to `UIScene_CreateWorldMenu.cpp`:

```cpp
case 4:
    // Huge
    param->xzSize = 8 * 64;
    param->hellScale = 8;  // or whatever you want
    break;
```

**Step 5:** Add the appropriate Nether scale. You could keep it at 8 (same as Large) or go higher. The maximum useful scale depends on how small you want the Nether to feel.

### Removing the Size Limit Entirely

You could technically set `LEVEL_MAX_WIDTH` to something enormous, but the engine was designed around fixed-size worlds. Things that will break or need rethinking:

- The **chunk storage** format assumes the world fits in memory
- **Entity tracking** is designed for a known maximum distance
- **Maps** assume specific zoom levels for the world boundaries
- The **save file format** stores all chunks, not just modified ones
- **Multiplayer** syncs chunk data based on the known world bounds

It is not impossible, but it is a significant engineering effort. You would basically need to rewrite the chunk loading to be on-demand instead of all-at-once.

## Key Files

| File | What it does |
|---|---|
| `ChunkSource.h` | Size constants (`LEVEL_MAX_WIDTH`, `HELL_LEVEL_MAX_SCALE`, etc.) and `ChunkSource` base class |
| `LevelData.h/.cpp` | Stores and loads `m_xzSize`, `m_hellScale`, moat flags, and old size values |
| `Dimension.cpp` | Returns world size for the Overworld |
| `HellDimension.cpp` | Returns scaled world size for the Nether |
| `UIScene_CreateWorldMenu.cpp` | Maps UI size selection to chunk counts and Nether scales |
| `LevelSettings.h/.cpp` | Initial settings when creating a new world |
| `App_enums.h` | World size host option values (`EGameHostOptionWorldSize`) |
