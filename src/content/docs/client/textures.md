---
title: "Textures & Resources"
description: "Texture loading and resource management in LCE."
---

LCE manages textures through several systems working together. `Textures` handles loading and binding, `TextureManager` provides a name-to-ID registry, `TexturePackRepository` manages texture pack selection, and a hierarchy of `TexturePack` implementations abstracts where resources come from.

## Textures

The `Textures` class is the main texture management interface, owned by the `Minecraft` instance. It handles loading images from disk, binding textures for rendering, and managing dynamic/animated textures.

### Texture name registry (TEXTURE_NAME enum)

All built-in textures are registered through the `TEXTURE_NAME` enum, which gives a compile-time ID to each texture resource. The enum has entries organized by version:

**Original textures:**

| Category | Examples |
|---|---|
| GUI | `TN_GUI_GUI`, `TN_GUI_ICONS` |
| Environment | `TN_ENVIRONMENT_CLOUDS`, `TN_ENVIRONMENT_RAIN`, `TN_ENVIRONMENT_SNOW` |
| Particles | `TN_PARTICLES` |
| Terrain | `TN_TERRAIN_MOON`, `TN_TERRAIN_SUN`, `TN_TERRAIN_MOON_PHASES` |
| Items | `TN_ITEM_ARROWS`, `TN_ITEM_BOAT`, `TN_ITEM_CART`, `TN_ITEM_SIGN`, `TN_ITEM_EXPERIENCE_ORB`, `TN_ITEM_BOOK` |
| Art | `TN_ART_KZ` (paintings) |
| Misc | `TN_MISC_MAPBG`, `TN_MISC_MAPICONS`, `TN_MISC_WATER`, `TN_MISC_FOOTSTEP`, `TN_MISC_EXPLOSION`, `TN_MISC_TUNNEL`, `TN_MISC_PARTICLEFIELD` |

**Mob textures (extensive list):**

| Mob | Texture names |
|---|---|
| Passive | `TN_MOB_CHICKEN`, `TN_MOB_COW`, `TN_MOB_PIG`, `TN_MOB_SHEEP`, `TN_MOB_SQUID`, `TN_MOB_WOLF` (+ tame/angry/collar), `TN_MOB_OZELOT` (+ cat variants), `TN_MOB_RED_COW` |
| Hostile | `TN_MOB_CREEPER`, `TN_MOB_GHAST` (+ fire), `TN_MOB_ZOMBIE`, `TN_MOB_PIGZOMBIE`, `TN_MOB_SKELETON`, `TN_MOB_SLIME`, `TN_MOB_SPIDER`, `TN_MOB_CAVE_SPIDER`, `TN_MOB_ENDERMAN` (+ eyes), `TN_MOB_SILVERFISH`, `TN_MOB_BLAZE`, `TN_MOB_LAVA`, `TN_MOB_WITHER_SKELETON`, `TN_MOB_ZOMBIE_VILLAGER` |
| NPCs | `TN_MOB_VILLAGER_VILLAGER`, `TN_MOB_VILLAGER_FARMER`, `TN_MOB_VILLAGER_LIBRARIAN`, `TN_MOB_VILLAGER_PRIEST`, `TN_MOB_VILLAGER_SMITH`, `TN_MOB_VILLAGER_BUTCHER`, `TN_MOB_VILLAGER_GOLEM` |
| Boss | `TN_MOB_ENDERDRAGON` (+ shuffle, beam, eyes, crystal) |
| Utility | `TN_MOB_SNOWMAN`, `TN_MOB_SADDLE`, `TN_MOB_SHEEP_FUR`, `TN_MOB_SPIDER_EYES` |
| Player skins | `TN_MOB_CHAR` through `TN_MOB_CHAR7` (8 default skins) |
| Effects | `TN_POWERED_CREEPER`, `TN__BLUR__MISC_GLINT`, `TN__BLUR__MISC_PUMPKINBLUR`, `TN__CLAMP__MISC_SHADOW` |

**Tile entity textures:**
`TN_TILE_CHEST`, `TN_TILE_LARGE_CHEST`, `TN_TILE_ENDER_CHEST`

**Atlases:**
`TN_GUI_ITEMS` (item sprite atlas), `TN_TERRAIN` (block texture atlas)

**Fonts:**
`TN_DEFAULT_FONT`, `TN_ALT_FONT`

The total count is `TN_COUNT`.

Each `TEXTURE_NAME` entry maps to a string path in the `preLoaded[]` array in `Textures.cpp`. During `loadIndexedTextures()`, the engine walks this array and loads every texture. The path gets a `.png` extension appended, and the texture is loaded through the active texture pack's `getImageResource()`.

### Key methods

| Method | Purpose |
|---|---|
| `bindTexture(const wstring&)` | Bind a texture by resource path |
| `bindTexture(int)` | Bind a texture by ID |
| `loadTexture(TEXTURE_NAME, const wstring&)` | Load and register a named texture |
| `loadTexturePixels(TEXTURE_NAME, const wstring&)` | Load pixel data for a named texture |
| `getTexture(BufferedImage*)` | Create a GPU texture from a `BufferedImage` |
| `replaceTexture(intArray, int w, int h, int id)` | Replace texture data in-place |
| `replaceTextureDirect(...)` | Optimized texture replacement (skips format conversion) |
| `releaseTexture(int id)` | Free a GPU texture |
| `tick(bool updateTextures, bool tickDynamics)` | Animate dynamic textures |
| `reloadAll()` | Reload all textures (after texture pack change) |
| `stitch()` | Rebuild the stitched terrain/item atlases |
| `getMissingIcon(int type)` | Get the purple/black missing texture icon |
| `readImage(TEXTURE_NAME, const wstring&)` | Load image through the active texture pack with fallback |

### How readImage works

`readImage()` is where the pack selection actually matters. It checks if the currently selected texture pack has the requested texture, and if so, loads from that pack. Otherwise it falls through to the default:

```cpp
BufferedImage* Textures::readImage(TEXTURE_NAME texId, const wstring& name)
{
    if (!skins->isUsingDefaultSkin() &&
        skins->getSelected()->hasFile(L"res/" + name, false))
    {
        img = skins->getSelected()->getImageResource(name, ...);
    }
    else
    {
        img = skins->getDefault()->getImageResource(name, ...);
    }
    return img;
}
```

Notice the `L"res/"` prefix check. Texture files in packs are expected to be under a `res/` directory.

### How reloadAll works

When the game loads or reloads textures (after a texture pack change, for example), this is the sequence:

1. `reloadAll()` gets called
2. All existing GPU texture IDs get released
3. The ID map and pixel cache are cleared
4. `loadIndexedTextures()` re-loads every entry in the `preLoaded[]` array (mob textures, environment, GUI, particles, etc.)
5. `stitch()` rebuilds both the terrain and items atlases

### HTTP and memory textures

For multiplayer skins and DLC content, `Textures` can load from remote sources:

```cpp
int loadHttpTexture(const wstring& url, const wstring& backup);
HttpTexture* addHttpTexture(const wstring& url, HttpTextureProcessor* processor);
int loadMemTexture(const wstring& url, const wstring& backup);
MemTexture* addMemTexture(const wstring& url, MemTextureProcessor* processor);
```

`HttpTexture` loads textures from URLs with a fallback. `MemTexture` loads from in-memory buffers (used for GTS/global texture storage player skins). Both support callback processors (`HttpTextureProcessor`, `MemTextureProcessor`) for post-load processing.

### Skin texture processors

| Class | Purpose |
|---|---|
| `MobSkinTextureProcessor` | Processes mob skin textures from HTTP sources |
| `MobSkinMemTextureProcessor` | Processes mob skin textures from memory buffers |

### Anaglyph conversion

When stereoscopic 3D is enabled, `Textures::anaglyph()` converts pixel data to the right color channel separation.

### Title update textures

`Textures::IsTUImage()` and `Textures::IsOriginalImage()` figure out whether a texture should be loaded from the title update drive or the original game disc. This is what lets texture replacements work through patches. The engine checks the title update path first (for patched textures), then falls back to the base path.

### Texture format and mipmapping

The static member `Textures::TEXTURE_FORMAT` controls the GPU texture format. Format selection via `setTextureFormat()` adapts to whatever the platform supports. Some textures use compressed 8-bit formats to save memory:

```cpp
// Clouds use a reduced format on Xbox
if (resourceName == L"environment/clouds.png")
    TEXTURE_FORMAT = C4JRender::TEXTURE_FORMAT_R1G1B1Ax;
// Pumpkin blur has no color, just alpha
else if (resourceName == L"%blur%/misc/pumpkinblur.png")
    TEXTURE_FORMAT = C4JRender::TEXTURE_FORMAT_R0G0B0Ax;
```

Mipmapping is controlled by `Textures::MIPMAP`. Most textures use mipmapping, but some are excluded:

- `environment/clouds.png`
- `%clamp%misc/shadow.png`
- `gui/icons.png`
- `gui/gui.png`
- `misc/footprint.png`

Cross-texture plants (flowers, saplings) also disable mipmapping with `->disableMipmap()` because mip chains make them look blurry.

### Pixel format

The pixel byte order depends on the platform:

```cpp
// Xbox: ARGB byte order
newPixels[i * 4 + 0] = (byte) a;
newPixels[i * 4 + 1] = (byte) r;
newPixels[i * 4 + 2] = (byte) g;
newPixels[i * 4 + 3] = (byte) b;

// Other platforms: RGBA byte order
newPixels[i * 4 + 0] = (byte) r;
newPixels[i * 4 + 1] = (byte) g;
newPixels[i * 4 + 2] = (byte) b;
newPixels[i * 4 + 3] = (byte) a;
```

## TextureManager

`TextureManager` is a singleton registry that maps string names to texture IDs and `Texture` objects:

```cpp
class TextureManager {
    static TextureManager* getInstance();

    int createTextureID();
    Texture* getTexture(const wstring& name);
    void registerName(const wstring& name, Texture* texture);
    void registerTexture(Texture* texture);
    void unregisterTexture(const wstring& name, Texture* texture);
    Stitcher* createStitcher(const wstring& name);
    vector<Texture*>* createTextures(const wstring& filename, bool mipmap);
    Texture* createTexture(const wstring& name, int mode, int width, int height, ...);
};
```

It provides the link between named resources and GPU texture handles. `createTextureID()` allocates a new OpenGL texture name. `createStitcher()` creates a `Stitcher` instance for atlas building.

The `createTextures()` method checks for animation definitions. If a `.txt` sidecar file exists for the texture, it treats the image as a vertical strip of animation frames.

## Pre-stitched texture atlases

This is where LCE really diverges from Java Edition. Java builds its texture atlas at runtime by stitching individual tile images together. LCE ships pre-stitched atlases and uses `PreStitchedTextureMap` instead:

```cpp
// 4J Added this class to stop having to do texture stitching at runtime
class PreStitchedTextureMap : public IconRegister
{
    stringIconMap texturesByName;
    BufferedImage* missingTexture;
    StitchedTexture* missingPosition;
    Texture* stitchResult;
    vector<StitchedTexture*> animatedTextures;
    vector<pair<wstring, wstring>> texturesToAnimate;

    void loadUVs();

public:
    void stitch();
    StitchedTexture* getTexture(const wstring& name);
    void cycleAnimationFrames();
    Texture* getStitchedTexture();
    Icon* registerIcon(const wstring& name);
    Icon* getMissingIcon();
    int getFlags() const;
};
```

`Textures` owns two `PreStitchedTextureMap` instances:

```cpp
terrain = new PreStitchedTextureMap(Icon::TYPE_TERRAIN, L"terrain", L"textures/blocks/", missingNo, true);
items = new PreStitchedTextureMap(Icon::TYPE_ITEM, L"items", L"textures/items/", missingNo, true);
```

The `true` at the end enables mipmapping for the atlas.

### How loadUVs works

All UV coordinates are hardcoded in `loadUVs()`. Each texture slot is mapped to a position on a 16x16 grid:

```cpp
float slotSize = 1.0f / 16.0f;
texturesByName.insert(stringIconMap::value_type(
    L"grass_top",
    new SimpleIcon(L"grass_top", slotSize*0, slotSize*0, slotSize*1, slotSize*1)
));
```

The four float parameters to `SimpleIcon` are `U0, V0, U1, V1`, which map to the top-left and bottom-right corners of the texture in UV space (0.0 to 1.0).

Some textures take up more than one slot. Flowing water and lava use 2x2 slots:

```cpp
texturesByName.insert(stringIconMap::value_type(
    L"water_flow",
    new SimpleIcon(L"water_flow", slotW*14, slotH*12, slotW*(14+2), slotH*(12+2))
));
```

### Icon registration

When a tile class calls `iconRegister->registerIcon(L"stone")`, the `PreStitchedTextureMap` looks up `"stone"` in its `texturesByName` map and returns the matching `Icon*` with its UV coordinates. If the name isn't found, you get the `missingNo` purple-black checkerboard and a `__debugbreak()` in debug builds.

### Animated atlas textures

Animated textures in the atlas (water, lava, fire, portal) work like this:

1. During `loadUVs()`, animated textures are registered in the `texturesToAnimate` list alongside their normal UV entry
2. The actual animation frames are loaded from separate image files (strips of frames stacked vertically)
3. Every tick, `cycleAnimationFrames()` advances each animated texture to its next frame by blitting the frame data onto the atlas

```cpp
// Registering an animated texture in loadUVs()
texturesByName.insert(stringIconMap::value_type(
    L"lava", new SimpleIcon(L"lava", slotW*13, slotH*14, slotW*14, slotH*15)
));
texturesToAnimate.push_back(pair<wstring, wstring>(L"lava", L"lava"));
```

The second value in the pair is the filename of the animation strip (loaded from `textures/blocks/lava.png`).

`StitchedTexture::cycleFrames()` supports two modes:

**Simple mode:** frames advance one at a time, looping back:

```cpp
frame = (frame + 1) % frames->size();
if (oldFrame != frame)
    source->blit(x, y, frames->at(frame), rotated);
```

**Override mode:** a custom frame sequence with per-frame durations, defined with `*` syntax (e.g., `4*10` means "frame 4 for 10 ticks"):

```
0,1,2,3,
4*10,5*10,
4*10,3,2,1,
0
```

The animated textures that ship with vanilla LCE:

| Texture Name | Description |
|---|---|
| `water` | Still water surface |
| `water_flow` | Flowing water (2x2 slots) |
| `lava` | Still lava surface |
| `lava_flow` | Flowing lava (2x2 slots) |
| `fire_0` | Fire layer 1 |
| `fire_1` | Fire layer 2 |
| `portal` | Nether portal effect |

Fire uses two separate animated layers that get composited by the renderer.

## Texture stitching classes

The texture atlas system combines many small textures into large atlases for efficient rendering:

| Class | Purpose |
|---|---|
| `Stitcher` | Packs textures into an atlas using a bin-packing algorithm |
| `StitchSlot` | Represents a slot within the stitched atlas |
| `StitchedTexture` | An individual texture within a stitched atlas, stores UV coordinates and animation state |
| `PreStitchedTextureMap` | Pre-built terrain and item texture maps with hardcoded UVs |
| `TextureMap` | Runtime texture atlas management (used less in LCE than Java) |

## The Icon system

`Icon` is the interface that provides UV coordinates for rendering:

```cpp
class Icon {
public:
    static const int TYPE_TERRAIN = 0;
    static const int TYPE_ITEM = 1;

    virtual float getU0(bool adjust = false) const = 0;
    virtual float getU1(bool adjust = false) const = 0;
    virtual float getV0(bool adjust = false) const = 0;
    virtual float getV1(bool adjust = false) const = 0;
    virtual int getWidth() const = 0;
    virtual int getHeight() const = 0;
};
```

The concrete implementation `StitchedTexture` stores the pixel position within the atlas and computes UVs:

```cpp
this->u0 = x / (float)source->getWidth();
this->u1 = (x + width) / (float)source->getWidth();
this->v0 = y / (float)source->getHeight();
this->v1 = (y + height) / (float)source->getHeight();
```

`SimpleIcon` is a simpler implementation that takes UV values directly. It also supports flags like `IS_GRASS_TOP` that tell the renderer to apply biome-dependent color tinting.

## Dynamic textures

Some textures animate each tick:

| Class | Purpose |
|---|---|
| `ClockTexture` | Clock item face rotation based on time of day |
| `CompassTexture` | Compass needle direction based on spawn point angle |

These get updated during `Textures::tick()` when `tickDynamics` is true. They compute new pixel data each frame and upload it to the GPU via `replaceTexture()`.

## BufferedImage

`BufferedImage` is the CPU-side image container used for loading and working with texture data before uploading to the GPU. It stores pixel data as integer arrays. It can load from:

- File paths (PNG from disk)
- DLC packs (via `DLCPack` pointer and path)
- Raw pixel data (integer array with width/height)

## TexturePack hierarchy

`TexturePack` is the abstract base for resource sources:

```cpp
class TexturePack {
    virtual bool hasData() = 0;
    virtual void load(Textures* textures) = 0;
    virtual void unload(Textures* textures) = 0;
    virtual InputStream* getResource(const wstring& name, bool allowFallback) = 0;
    virtual bool hasFile(const wstring& name, bool allowFallback) = 0;
    virtual DWORD getId() = 0;
    virtual wstring getName() = 0;
    virtual BufferedImage* getImageResource(const wstring& File, ...) = 0;
    virtual void loadColourTable() = 0;
    virtual ColourTable* getColourTable() = 0;
    virtual ArchiveFile* getArchiveFile() = 0;
};
```

### TexturePack implementations

| Class | Source | Notes |
|---|---|---|
| `DefaultTexturePack` | Built-in game resources | Always exists, always ID 0. Fallback for all packs. Reads from `res/TitleUpdate/res` path. |
| `AbstractTexturePack` | Base for custom packs | Adds fallback logic, colour table support, icon loading. `getResource()` checks this pack first, falls through to fallback if missing. |
| `FolderTexturePack` | Directory of loose files | Debug/development. Reads from `DummyTexturePack/res/` folder. Easiest way to test texture replacements. |
| `FileTexturePack` | Single archive file | `.zip` or custom format. Mostly stubbed on console. |
| `DLCTexturePack` | DLC content package | The real deal for shipping texture packs. Uses `.pck` format with `DLCManager`. Has two `DLCPack` objects: `m_dlcInfoPack` (metadata) and `m_dlcDataPack` (textures, loaded on demand). Supports async DLC mounting. |

### The fallback chain

Every non-default pack gets `DefaultTexturePack` as its fallback. When `getResource()` is called, it first checks the current pack. If the file isn't found, it asks the fallback:

```cpp
InputStream* AbstractTexturePack::getResource(const wstring& name, bool allowFallback)
{
    InputStream* is = getResourceImplementation(name);
    if (is == NULL && fallback != NULL && allowFallback)
        is = fallback->getResource(name, true);
    return is;
}
```

You only need to include the textures you want to change. Everything else falls through to vanilla.

### TexturePackRepository

Manages the collection of available texture packs and the currently selected one:

```cpp
class TexturePackRepository {
    static const DWORD DEFAULT_TEXTURE_PACK_ID = 0;

    bool selectSkin(TexturePack* skin);
    bool selectTexturePackById(DWORD id);
    TexturePack* getSelected();
    TexturePack* getDefault();
    vector<TexturePack*>* getAll();
    unsigned int getTexturePackCount();

    TexturePack* addTexturePackFromDLC(DLCPack* dlcPack, DWORD id);
    void clearInvalidTexturePacks();
};
```

When you select a new pack, `selectTexturePackById()` looks it up in an ID cache and triggers `eAppAction_ReloadTexturePack`, which eventually calls `Textures::reloadAll()`.

It supports texture pack selection by ID (`selectTexturePackById()`), web skins (`selectWebSkin()`, `isUsingWebSkin()`), and DLC packs (`addTexturePackFromDLC()`).

## Resource directory structure

Resources are organized under `Common/res/`:

```
res/
  achievement/       -- achievement icons
  armor/             -- armor textures
  art/               -- painting textures
  audio/             -- sound banks
  environment/       -- clouds, rain, snow
  font/              -- font atlases
  gui/               -- GUI textures
  item/              -- item-specific textures
  misc/              -- miscellaneous (maps, particles)
  mob/               -- mob textures (with subdirs for enderdragon, villager)
  terrain/           -- terrain textures (sun, moon)
  title/             -- title screen assets
  TitleUpdate/       -- patch content overlay
    audio/
    DLC/             -- DLC packs (Candy, Cartoon, City, Fantasy, etc.)
    GameRules/
    res/             -- updated textures
```

The `1_2_2/` subdirectory has the original 1.2.2 version resources as a baseline.

## DLC texture packs

Each DLC pack under `TitleUpdate/DLC/` has a `Data/` subdirectory with pack-specific resources. Available DLC packs in the source tree:

- Candy
- Cartoon
- City
- Fantasy
- Festive
- Halloween
- Halo
- Mass Effect
- Natural
- Plastic
- Skyrim
- Steampunk

DLC packs are managed through `DLCManager` and `DLCPack` in `Common/DLC/`, with file types defined in headers like `DLCTextureFile.h`, `DLCColourTableFile.h`, `DLCAudioFile.h`, `DLCSkinFile.h`, and `DLCUIDataFile.h`.

DLC packs can include:
- Textures (terrain atlas, mob textures, GUI)
- Colour tables (`colours.col`)
- UI skins (`TexturePack.xzp` on Xbox, `skin.swf` + `media.arc` on other platforms)
- Audio banks
- Game rules (for mashup packs)

### DLC mounting

DLC texture packs need async mounting from the console's storage before their data can be accessed:

```cpp
void DLCTexturePack::loadData()
{
    int mountIndex = m_dlcInfoPack->GetDLCMountIndex();
    if (mountIndex > -1)
        StorageManager.MountInstalledDLC(
            ProfileManager.GetPrimaryPad(),
            mountIndex,
            &DLCTexturePack::packMounted, this, "TPACK");
}
```

On Xbox, the DLC stays mounted if it has streaming audio; otherwise it gets unmounted after loading to free up mount points.

## Colour tables

`ColourTable` (in `Common/Colours/`) provides biome-specific color lookup for foliage, grass, water, and sky colors. Each texture pack can supply its own colour table via `TexturePack::loadColourTable()` and `TexturePack::getColourTable()`. The `eMinecraftColour` enum in `App_enums.h` defines all colour IDs.

Particles, grass, foliage, and water all pull their tint colors from the active colour table, which is why mashup packs can restyle everything.

## Network texture packets

In multiplayer, the host sends texture pack info to joining clients:

- **`TexturePacket`** (ID 154) sends the full texture pack name and data bytes to a client
- **`TextureChangePacket`** (ID 157) tells clients about skin or cape changes during gameplay

If a client doesn't have the DLC pack installed, it falls back to the default.

## MinecraftConsoles differences

MinecraftConsoles expands the texture system in a few ways:

### New mob textures

The `TEXTURE_NAME` enum gains a lot of new entries for mobs that don't exist in LCEMP:

- **Bat:** `TN_MOB_BAT`
- **Horse variants:** `TN_MOB_HORSE_BLACK`, `TN_MOB_HORSE_BROWN`, `TN_MOB_HORSE_CHESTNUT`, `TN_MOB_HORSE_CREAMY`, `TN_MOB_HORSE_DARKBROWN`, `TN_MOB_HORSE_GRAY`, `TN_MOB_HORSE_WHITE`, `TN_MOB_HORSE_SKELETON`, `TN_MOB_HORSE_ZOMBIE`
- **Horse markings:** `TN_MOB_HORSE_MARKINGS_BLACKDOTS`, `TN_MOB_HORSE_MARKINGS_WHITE`, `TN_MOB_HORSE_MARKINGS_WHITEDOTS`, `TN_MOB_HORSE_MARKINGS_WHITEFIELD`
- **Horse armor:** `TN_MOB_HORSE_ARMOR_DIAMOND`, `TN_MOB_HORSE_ARMOR_GOLD`, `TN_MOB_HORSE_ARMOR_IRON`
- **Donkey/Mule:** `TN_MOB_DONKEY`, `TN_MOB_MULE`
- **Witch:** `TN_MOB_WITCH`
- **Wither:** `TN_MOB_WITHER`, `TN_MOB_WITHER_ARMOR`, `TN_MOB_WITHER_INVULNERABLE`

### Naming fix

`TN_MOB_OZELOT` is renamed to `TN_MOB_OCELOT` (fixing the typo from the original Java source).

### ResourceLocation and TextureAtlas

MinecraftConsoles introduces `ResourceLocation` as a typed wrapper for texture resource paths. `TextureAtlas` provides `LOCATION_BLOCKS` and `LOCATION_ITEMS` as static resource locations for the terrain and item atlases. Many renderers switch from string-based `bindTexture()` to `ResourceLocation`-based lookups.

### DLC additions

`DLCCapeFile` is added as a new DLC file type for distributing cape textures through content packs.
