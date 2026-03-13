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

`Textures::IsTUImage()` and `Textures::IsOriginalImage()` figure out whether a texture should be loaded from the title update drive or the original game disc. This is what lets texture replacements work through patches.

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

It provides the link between named resources and GPU texture handles, and creates `Stitcher` instances for atlas building.

## Texture stitching

The texture atlas system combines many small textures into large atlases for efficient rendering:

| Class | Purpose |
|---|---|
| `Stitcher` | Packs textures into an atlas using a bin-packing algorithm |
| `StitchSlot` | Represents a slot within the stitched atlas |
| `StitchedTexture` | An individual texture within a stitched atlas |
| `PreStitchedTextureMap` | Pre-built terrain and item texture maps |
| `TextureMap` | Runtime texture atlas management |

`Textures` owns two `PreStitchedTextureMap` instances: `terrain` (block faces) and `items` (item sprites).

## Dynamic textures

Some textures animate each tick:

| Class | Purpose |
|---|---|
| `ClockTexture` | Clock item face rotation |
| `CompassTexture` | Compass needle direction |

These get updated during `Textures::tick()` when `tickDynamics` is true.

## BufferedImage

`BufferedImage` is the CPU-side image container used for loading and working with texture data before uploading to the GPU. It stores pixel data as integer arrays.

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
| `DefaultTexturePack` | Built-in game resources | Fallback for all packs |
| `AbstractTexturePack` | Base for custom packs | Shared implementation |
| `FileTexturePack` | Single archive file | `.zip` or custom format |
| `FolderTexturePack` | Directory of loose files | Development/testing |
| `DLCTexturePack` | DLC content package | Mash-up packs, texture packs |

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

## Colour tables

`ColourTable` (in `Common/Colours/`) provides biome-specific color lookup for foliage, grass, water, and sky colors. Each texture pack can supply its own colour table via `TexturePack::loadColourTable()` and `TexturePack::getColourTable()`. The `eMinecraftColour` enum in `App_enums.h` defines all colour IDs.

## Texture format

The static member `Textures::TEXTURE_FORMAT` controls the GPU texture format. Mipmapping is controlled by `Textures::MIPMAP`. Format selection via `setTextureFormat()` adapts to whatever the platform supports.

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
