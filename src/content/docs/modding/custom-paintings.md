---
title: Custom Paintings
description: How to add new painting motives to LCE, including the motive registry, size system, texture atlas, and rendering.
---

Paintings in LCE are entities that hang on walls. Each painting has a "motive" that controls what image it shows and how big it is. This guide covers how the whole system works and how to add your own paintings.

## How Paintings Work

The painting system has a few moving parts:

1. **Motive** - Defines the painting's name, pixel size, and position on the texture atlas
2. **Painting entity** - A `HangingEntity` that holds a reference to one motive
3. **Placement logic** - When a player places a painting, the game figures out which motives fit the available wall space and picks one at random
4. **Renderer** - Reads the motive's UV offsets and draws the right chunk of the texture atlas

The class hierarchy looks like this:

```
Entity
└── HangingEntity      # Wall-mounted entities (direction, survives check)
    ├── Painting       # The painting entity
    └── ItemFrame      # Item frames use the same base
```

## The Motive Class

`Painting::Motive` is a small inner class defined in `Minecraft.World/Painting.h`. Each motive has five fields:

```cpp
class Motive
{
public:
    static const Motive *values[];
    static const int MAX_MOTIVE_NAME_LENGTH;

    const wstring name;   // motive name, saved to NBT
    const int w, h;       // pixel dimensions (16 = 1 block)
    const int uo, vo;     // UV offset into the texture atlas

    Motive(wstring name, int w, int h, int uo, int vo)
        : name(name), w(w), h(h), uo(uo), vo(vo) {};
};
```

The `w` and `h` values are in pixels, not blocks. So a 1x1 block painting is `16, 16` and a 4x4 block painting is `64, 64`.

The `uo` and `vo` values tell the renderer where to find this painting's image on the 256x256 texture atlas (`art/kz.png`).

## All Vanilla Motives

Here's every motive registered in the `Motive::values[]` array (`Minecraft.World/Painting.cpp`):

### 1x1 Paintings (16x16 pixels)

| Name | UV Offset (uo, vo) |
|------|-------------------|
| `Kebab` | 0, 0 |
| `Aztec` | 16, 0 |
| `Alban` | 32, 0 |
| `Aztec2` | 48, 0 |
| `Bomb` | 64, 0 |
| `Plant` | 80, 0 |
| `Wasteland` | 96, 0 |

### 2x1 Paintings (32x16 pixels)

| Name | UV Offset (uo, vo) |
|------|-------------------|
| `Pool` | 0, 32 |
| `Courbet` | 32, 32 |
| `Sea` | 64, 32 |
| `Sunset` | 96, 32 |
| `Creebet` | 128, 32 |

### 1x2 Paintings (16x32 pixels)

| Name | UV Offset (uo, vo) |
|------|-------------------|
| `Wanderer` | 0, 64 |
| `Graham` | 16, 64 |

### 2x2 Paintings (32x32 pixels)

| Name | UV Offset (uo, vo) |
|------|-------------------|
| `Match` | 0, 128 |
| `Bust` | 32, 128 |
| `Stage` | 64, 128 |
| `Void` | 96, 128 |
| `SkullAndRoses` | 128, 128 |
| `Wither` | 160, 128 |

### 4x2 Paintings (64x32 pixels)

| Name | UV Offset (uo, vo) |
|------|-------------------|
| `Fighters` | 0, 96 |

### 4x4 Paintings (64x64 pixels)

| Name | UV Offset (uo, vo) |
|------|-------------------|
| `Pointer` | 0, 192 |
| `Pigscene` | 64, 192 |
| `BurningSkull` | 128, 192 |

### 4x3 Paintings (64x48 pixels)

| Name | UV Offset (uo, vo) |
|------|-------------------|
| `Skeleton` | 192, 64 |
| `DonkeyKong` | 192, 112 |

## How Placement Picks a Motive

When a player right-clicks a wall with a painting item, `HangingEntityItem::useOn()` creates a `Painting` and calls `PaintingPostConstructor()`. This is where the magic happens:

```cpp
void Painting::PaintingPostConstructor(int dir)
{
    vector<Motive *> *survivableMotives = new vector<Motive *>();
    for (int i = 0; i < LAST_VALUE; i++)
    {
        this->motive = (Motive *)Motive::values[i];
        setDir(dir);
        if (survives())
        {
            survivableMotives->push_back(this->motive);
        }
    }
    if (!survivableMotives->empty())
    {
        this->motive = survivableMotives->at(
            random->nextInt((int)survivableMotives->size())
        );
    }
    setDir(dir);
}
```

It loops through every motive, temporarily assigns it, calls `setDir()` to calculate the bounding box at that size, and then calls `survives()` to check if the painting actually fits. Every motive that fits gets added to a list, and then one is picked at random.

### The Survives Check

`HangingEntity::survives()` in `Minecraft.World/HangingEntity.cpp` does two things:

1. **Solid wall check** - Every block behind the painting (based on `w/16` x `h/16` block grid) must be solid material
2. **No entity overlap** - The painting's bounding box can't overlap with any other `HangingEntity` (no stacking paintings or overlapping item frames)

```cpp
bool HangingEntity::survives()
{
    if (level->getCubes(shared_from_this(), bb)->size() != 0)
    {
        return false;
    }
    else
    {
        int ws = max(1, getWidth() / 16);
        int hs = max(1, getHeight() / 16);
        // ...checks every block position for solid material...
        // ...checks for overlapping HangingEntities...
    }
    return true;
}
```

So if you have a 3-block wide, 2-block tall wall of solid blocks, the game will only offer motives that are 3x2 blocks or smaller.

## The Texture Atlas

All painting textures live in one 256x256 atlas file loaded as `art/kz.png` (referenced in code as `TN_ART_KZ`). The renderer in `PaintingRenderer.cpp` binds this texture before drawing:

```cpp
bindTexture(TN_ART_KZ);  // loads art/kz.png
```

Each motive's `uo` and `vo` tell the renderer which region of the atlas to sample. The UV math in the renderer divides by 256.0 to convert pixel offsets to texture coordinates:

```cpp
float fu0 = (uo + w - (xs) * 16) / 256.0f;
float fu1 = (uo + w - (xs + 1) * 16) / 256.0f;
float fv0 = (vo + h - (ys) * 16) / 256.0f;
float fv1 = (vo + h - (ys + 1) * 16) / 256.0f;
```

The back side of every painting uses a fixed texture region at pixel column 192 (12 * 16) on the atlas. That's the brown "back of canvas" look.

## Adding a New Painting

Let's add a custom 2x2 painting called "MyArt".

### Step 1: Add the Enum Value

In `Minecraft.World/Painting.h`, add your new motive to the `MotiveEnum` before `LAST_VALUE`:

```cpp
enum MotiveEnum {
    Kebab = 0,
    Aztec,
    Alban,
    // ...existing motives...
    DonkeyKong,

    MyArt,         // your new painting

    LAST_VALUE
};
```

`LAST_VALUE` is used as the loop bound in `PaintingPostConstructor`, so putting your entry before it is all you need to include it in placement.

### Step 2: Register the Motive

In `Minecraft.World/Painting.cpp`, add a new entry to the `Motive::values[]` array. The position in the array must match the enum order:

```cpp
const _Motive *Painting::Motive::values[] = {
    // ...existing motives...
    new _Motive(L"DonkeyKong", 64, 48, 12 * 16, 7 * 16),

    new _Motive(L"MyArt", 32, 32, 0 * 16, 10 * 16),  // 2x2, at (0, 160) on atlas
};
```

The constructor args are: `name, width, height, uo, vo`.

Pick a `uo`/`vo` that points to an unused region of the atlas. The vanilla paintings leave some gaps you can use, or you can expand into empty space.

### Step 3: Update MAX_MOTIVE_NAME_LENGTH If Needed

If your motive name is longer than 13 characters (the length of "SkullAndRoses"), update the constant:

```cpp
const int Painting::Motive::MAX_MOTIVE_NAME_LENGTH = 13;
// Change to your name's length if it's longer
```

This is used by `AddPaintingPacket` when reading the motive name from the network. If your name is too long, it gets truncated and the painting won't load right.

### Step 4: Add the Texture

Edit the `art/kz.png` texture atlas and draw your painting at the UV offset you picked. For a 2x2 painting (32x32 pixels), you need a 32x32 pixel region at your chosen offset.

The atlas is 256x256. Here's a rough layout of what's used:

```
Row 0   (vo=0):    7 small 1x1 paintings
Row 2   (vo=32):   5 wide 2x1 paintings
Row 4   (vo=64):   2 tall 1x2 paintings + 2 console-exclusive 4x3s at x=192
Row 6   (vo=96):   1 wide 4x2 painting (Fighters)
Row 8   (vo=128):  6 medium 2x2 paintings
Row 12  (vo=192):  3 large 4x4 paintings
```

Column 192 (x=192) row 0 is reserved for the back-of-painting texture. Don't put art there.

### Step 5: Build and Test

Place a painting on a wall that's at least 2x2 blocks. Keep breaking and replacing it until the game randomly picks your motive. Since selection is random from all motives that fit, you might need a few tries.

## The Painting Entity

The `Painting` class (`Minecraft.World/Painting.h`) extends `HangingEntity`. Here are the key pieces:

### Construction

There are three constructors:

```cpp
// Basic - used by EntityIO when loading from save data
Painting(Level *level);

// Placement - used by HangingEntityItem, then call PaintingPostConstructor
Painting(Level *level, int xTile, int yTile, int zTile, int dir);

// Specific motive - used by client when receiving AddPaintingPacket
Painting(Level *level, int x, int y, int z, int dir, wstring motiveName);
```

The third constructor searches through all motives by name to find a match. This is how the client creates the right painting when the server tells it which motive was selected.

### Save/Load

Paintings save their motive name as an NBT string tag called `"Motive"`. On load, if the name doesn't match any known motive, it falls back to `Kebab`:

```cpp
void Painting::readAdditionalSaveData(CompoundTag *tag)
{
    wstring motiveName = tag->getString(L"Motive");
    for (int i = 0; i < LAST_VALUE; i++)
    {
        if (Motive::values[i]->name.compare(motiveName) == 0)
        {
            this->motive = (Motive *)Motive::values[i];
        }
    }
    if (this->motive == NULL) motive = (Motive *)Motive::values[Kebab];

    HangingEntity::readAdditionalSaveData(tag);
}
```

This fallback means if you remove a custom motive later, old worlds won't crash. They'll just show Kebab instead.

### Networking

The `AddPaintingPacket` sends the painting across the network with the motive name as a string, plus the tile position and direction. The client receives this in `ClientConnection::handleAddPainting()` and creates the entity using the name-based constructor:

```cpp
void ClientConnection::handleAddPainting(shared_ptr<AddPaintingPacket> packet)
{
    shared_ptr<Painting> painting = shared_ptr<Painting>(
        new Painting(level, packet->x, packet->y, packet->z,
                     packet->dir, packet->motive)
    );
    level->putEntity(packet->id, painting);
}
```

### Rendering

`PaintingRenderer` in `Minecraft.Client/PaintingRenderer.cpp` handles drawing. It binds the `art/kz.png` atlas, reads the motive's `w`, `h`, `uo`, `vo`, and tessellates a textured quad for each 16x16 block section of the painting. It also draws the back, top, bottom, and side faces using the back-of-canvas texture region.

The renderer iterates in a grid of 16x16 pixel chunks, so a 2x2 painting generates 4 quads for the front face (plus the back/edge quads for each).

## Entity Registration

The painting entity is registered in `EntityIO::staticCtor()` with entity ID 9:

```cpp
setId(Painting::create, eTYPE_PAINTING, L"Painting", 9);
```

You don't need to touch this when adding new motives. Entity registration is for the `Painting` entity type itself, not for individual motives.

## Tips

- **Odd sizes work** - You're not limited to power-of-two sizes. The console-exclusive `Skeleton` and `DonkeyKong` paintings are 64x48 (4x3 blocks). You could make a 48x16 (3x1) painting if you wanted.
- **The 256px atlas limit** - The atlas is 256x256 and the UV math divides by 256.0. If you need more space than the atlas has, you'd need to either change the atlas size and update the UV divisor in `PaintingRenderer`, or replace existing paintings you don't want.
- **Motive names must be unique** - The name is used for NBT save/load and network sync. Duplicate names will cause the wrong painting to show up.
- **Random selection is uniform** - Every motive that fits has an equal chance of being picked. If you add 20 custom 1x1 paintings, the vanilla 1x1s become much rarer on small walls.
