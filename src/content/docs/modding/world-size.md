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

#define LEVEL_WIDTH_CLASSIC  54    // 864 blocks (Xbox 360/PS3 original)
#define LEVEL_WIDTH_SMALL    64    // 1024 blocks
#define LEVEL_WIDTH_MEDIUM   (3*64) // 3072 blocks
#define LEVEL_WIDTH_LARGE    (5*64) // 5120 blocks

// Without _LARGE_WORLDS (Xbox 360, PS3, Vita)
#define LEVEL_MAX_WIDTH  54        // 864 blocks only

#define LEVEL_MIN_WIDTH  54        // Can't go smaller than classic
```

The `_LARGE_WORLDS` preprocessor flag controls whether the platform supports world sizes beyond the classic 864x864. On older hardware like Xbox 360 and PS3, this flag is off and you're stuck at 54 chunks.

### Nether Scaling

The Nether is always smaller than the Overworld, scaled down by a factor. The scale changes with world size:

```cpp
// Nether scale factors
#define HELL_LEVEL_SCALE_CLASSIC  3   // 54/3 = 18 chunks
#define HELL_LEVEL_SCALE_SMALL    3   // 64/3 ~ 21 chunks
#define HELL_LEVEL_SCALE_MEDIUM   6   // 192/6 = 32 chunks
#define HELL_LEVEL_SCALE_LARGE    8   // 320/8 = 40 chunks

#define HELL_LEVEL_MAX_SCALE  8
#define HELL_LEVEL_MIN_SCALE  3
#define HELL_LEVEL_MAX_WIDTH  (LEVEL_MAX_WIDTH / HELL_LEVEL_MAX_SCALE)
#define HELL_LEVEL_MIN_WIDTH  18
```

The End is always fixed at 18 chunks regardless of world size:

```cpp
#define END_LEVEL_SCALE      3
#define END_LEVEL_MAX_WIDTH  18
#define END_LEVEL_MIN_WIDTH  18
```

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

There's also validation to make sure the Nether isn't too big:

```cpp
int hellXZSize = m_xzSize / m_hellScale;
while (hellXZSize > HELL_LEVEL_MAX_WIDTH && m_hellScale < HELL_LEVEL_MAX_SCALE)
{
    ++m_hellScale;
    hellXZSize = m_xzSize / m_hellScale;
}
```

## World Expansion (Large Worlds)

On platforms with `_LARGE_WORLDS`, players can expand their world. When you increase the world size, the old boundary gets a "moat" (an ocean edge) and new terrain generates beyond it:

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

The old size is preserved in `m_xzSizeOld` so the chunk generator knows where the old edge was and can place the moat.

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

**Step 4:** Add the appropriate Nether scale:

```cpp
#define HELL_LEVEL_SCALE_HUGE  8   // or whatever you want
```

### Removing the Size Limit Entirely

You technically could set `LEVEL_MAX_WIDTH` to something enormous, but the engine was designed around fixed-size worlds. Things that will break or need rethinking:

- The **chunk storage** format assumes the world fits in memory
- **Entity tracking** is designed for a known maximum distance
- **Maps** assume specific zoom levels for the world boundaries
- The **save file format** stores all chunks, not just modified ones
- **Multiplayer** syncs chunk data based on the known world bounds

It's not impossible, but it's a significant engineering effort. You'd basically need to rewrite the chunk loading to be on-demand instead of all-at-once.

## Key Files

| File | What it does |
|---|---|
| `ChunkSource.h` | Size constants and ChunkSource base class |
| `LevelData.h/.cpp` | Stores and loads `m_xzSize` and `m_hellScale` |
| `Dimension.cpp` | Returns world size for the Overworld |
| `HellDimension.cpp` | Returns scaled world size for the Nether |
| `LevelSettings.h/.cpp` | Initial settings when creating a new world |
| `App_enums.h` | World size host option values |
