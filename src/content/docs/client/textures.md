---
title: "Textures & Resources"
description: "Texture loading and resource management in LCEMP."
---

LCEMP manages textures through several cooperating systems: `Textures` handles loading and binding, `TextureManager` provides a global name-to-ID registry, `TexturePackRepository` manages texture pack selection, and various texture pack classes abstract the source of texture data.

## Textures

The `Textures` class is the primary texture loading and binding interface, owned by `Minecraft`:

```cpp
class Textures {
public:
    static bool MIPMAP;
    static C4JRender::eTextureFormat TEXTURE_FORMAT;

    void bindTexture(const wstring& resourceName);
    void bindTexture(int resourceId);
    int loadTexture(int idx);
    int getTexture(BufferedImage* img, ...);
    void loadTexture(BufferedImage* img, int id);
    void replaceTexture(intArray rawPixels, int w, int h, int id);
    void replaceTextureDirect(intArray rawPixels, int w, int h, int id);
    void releaseTexture(int id);
    void tick(bool updateTextures, bool tickDynamics = true);
    void reloadAll();
    void stitch();
    Icon* getMissingIcon(int type);
};
```

### Texture ID system

Textures are identified by integer IDs, with a name-to-ID mapping:

```cpp
unordered_map<wstring, int> idMap;           // name -> GPU texture ID
unordered_map<wstring, intArray> pixelsMap;  // name -> pixel data cache
unordered_map<int, BufferedImage*> loadedImages;  // ID -> source image
```

### Pre-loaded texture enumeration

The `TEXTURE_NAME` enum defines all built-in textures loaded at startup. A selection of the entries:

| Category | Examples |
|---|---|
| **GUI** | `TN_GUI_GUI`, `TN_GUI_ICONS`, `TN_GUI_ITEMS` |
| **Environment** | `TN_ENVIRONMENT_CLOUDS`, `TN_ENVIRONMENT_RAIN`, `TN_ENVIRONMENT_SNOW` |
| **Terrain** | `TN_TERRAIN`, `TN_TERRAIN_SUN`, `TN_TERRAIN_MOON`, `TN_TERRAIN_MOON_PHASES` |
| **Mobs** | `TN_MOB_CHICKEN`, `TN_MOB_COW`, `TN_MOB_PIG`, `TN_MOB_SHEEP`, `TN_MOB_WOLF`, `TN_MOB_CREEPER`, `TN_MOB_ZOMBIE`, `TN_MOB_SKELETON`, `TN_MOB_SPIDER`, `TN_MOB_ENDERMAN`, `TN_MOB_BLAZE`, `TN_MOB_GHAST`, `TN_MOB_SLIME`, `TN_MOB_SQUID`, `TN_MOB_ENDERDRAGON`, `TN_MOB_VILLAGER_*`, etc. |
| **Player skins** | `TN_MOB_CHAR` through `TN_MOB_CHAR7` (8 player skin slots) |
| **Items** | `TN_ITEM_ARROWS`, `TN_ITEM_BOAT`, `TN_ITEM_CART`, `TN_ITEM_SIGN`, `TN_ITEM_BOOK`, `TN_ITEM_EXPERIENCE_ORB` |
| **Misc** | `TN_PARTICLES`, `TN_ART_KZ` (paintings), `TN_MISC_MAPBG`, `TN_MISC_MAPICONS`, `TN_MISC_WATER`, `TN_MISC_TUNNEL`, `TN_MISC_PARTICLEFIELD` |
| **Tile entities** | `TN_TILE_CHEST`, `TN_TILE_LARGE_CHEST`, `TN_TILE_ENDER_CHEST` |
| **Effects** | `TN_POWERED_CREEPER`, `TN__BLUR__MISC_PUMPKINBLUR`, `TN__BLUR__MISC_GLINT`, `TN__CLAMP__MISC_SHADOW` |
| **Fonts** | `TN_DEFAULT_FONT`, `TN_ALT_FONT` |

The total count is `TN_COUNT`. Texture names prefixed with `__BLUR__` are loaded with bilinear filtering, and `__CLAMP__` with clamp wrapping.

### HTTP and memory textures

For player skins and online content, `Textures` supports two dynamic texture sources:

```cpp
// HTTP textures (skin server)
int loadHttpTexture(const wstring& url, const wstring& backup);
HttpTexture* addHttpTexture(const wstring& url, HttpTextureProcessor* processor);

// Memory textures (GTS/DLC skins)
int loadMemTexture(const wstring& url, const wstring& backup);
MemTexture* addMemTexture(const wstring& url, MemTextureProcessor* processor);
```

`HttpTextureProcessor` and `MemTextureProcessor` are callback interfaces for processing downloaded texture data (e.g., `MobSkinTextureProcessor`, `MobSkinMemTextureProcessor` for player skin format conversion).

### Texture ticking

`Textures::tick(bool updateTextures, bool tickDynamics)` is called each game tick:
- `updateTextures` -- when true, reloads modified textures (set to true once per tick cycle)
- `tickDynamics` -- advances animated textures (water, lava, clock, compass)

### Stitching

`stitch()` assembles the terrain and item texture atlases from individual source images. The `PreStitchedTextureMap` class holds the pre-assembled atlas:

```cpp
PreStitchedTextureMap* terrain;  // block textures
PreStitchedTextureMap* items;    // item textures
```

### Title update textures

`IsTUImage()` and `IsOriginalImage()` determine whether a texture should be loaded from the title update (patched) or original (base game) resource path.

## TextureManager

`TextureManager` is a global singleton that maps texture names to `Texture` objects:

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

It generates unique integer IDs for textures and provides factory methods for creating textures from file paths or raw parameters.

## Texture pack system

### TexturePack (interface)

`TexturePack` is the abstract base for all texture sources:

```cpp
class TexturePack {
    virtual bool hasData() = 0;
    virtual bool isLoadingData() = 0;
    virtual void load(Textures* textures) = 0;
    virtual void unload(Textures* textures) = 0;
    virtual InputStream* getResource(const wstring& name, bool allowFallback) = 0;
    virtual DWORD getId() = 0;
    virtual wstring getName() = 0;
    virtual wstring getDesc1() = 0;
    virtual wstring getDesc2() = 0;
    virtual bool hasFile(const wstring& name, bool allowFallback) = 0;
    virtual bool isTerrainUpdateCompatible() = 0;
    virtual BufferedImage* getImageResource(const wstring& File, ...) = 0;
    virtual void loadColourTable() = 0;
    virtual ColourTable* getColourTable() = 0;
    virtual ArchiveFile* getArchiveFile() = 0;
};
```

### TexturePack implementations

| Class | Source | Description |
|---|---|---|
| `DefaultTexturePack` | Built-in | Default game textures from bundled resources |
| `AbstractTexturePack` | Base class | Common functionality for file-based packs |
| `FileTexturePack` | Archive file | Textures from a packed archive |
| `FolderTexturePack` | Directory | Textures from a folder on disk |
| `DLCTexturePack` | DLC content | Textures from installed DLC packs |

Each pack can provide its own colour table, UI assets, and audio replacements (for mash-up packs).

### TexturePackRepository

`TexturePackRepository` manages the collection of available texture packs and the currently selected one:

```cpp
class TexturePackRepository {
    static const DWORD DEFAULT_TEXTURE_PACK_ID = 0;
    static const DWORD FOLDER_TEST_TEXTURE_PACK_ID = 1;
    static const DWORD DLC_TEST_TEXTURE_PACK_ID = 2;

    bool selectSkin(TexturePack* skin);
    bool selectTexturePackById(DWORD id);
    TexturePack* getSelected();
    TexturePack* getDefault();
    bool isUsingDefaultSkin();

    vector<TexturePack*>* getAll();
    TexturePack* getTexturePackById(DWORD id);
    unsigned int getTexturePackCount();

    TexturePack* addTexturePackFromDLC(DLCPack* dlcPack, DWORD id);
    void clearInvalidTexturePacks();
};
```

The repository also supports web-sourced skins (`selectWebSkin()`, `isUsingWebSkin()`) with a 10 MB size limit.

## Dynamic textures

### ClockTexture and CompassTexture

`ClockTexture` and `CompassTexture` are animated textures that update each tick:
- `ClockTexture` rotates based on the current world time
- `CompassTexture` points toward the world spawn point

### BufferedImage

`BufferedImage` is the software image container used for loading, manipulating, and uploading texture data. It stores pixel data as integer arrays and provides image reading functionality.

## Resource paths

The resource directory structure under `Common/res/` mirrors the Minecraft resource layout:

| Path | Contents |
|---|---|
| `achievement/` | Achievement icons |
| `armor/` | Armor layer textures |
| `art/` | Painting textures |
| `audio/` | Sound file references |
| `environment/` | Sky, clouds, rain, snow |
| `font/` | Font texture sheets |
| `gui/` | GUI elements (buttons, icons, inventory) |
| `item/` | Item-specific textures (arrows, boat, cart, sign) |
| `misc/` | Miscellaneous (map, shadow, footstep, particles) |
| `mob/` | All mob textures organized by creature |
| `terrain/` | Sun, moon textures |
| `title/` | Title screen elements and panorama backgrounds |

A `TitleUpdate/` subdirectory mirrors this structure with patched/updated textures, and `TitleUpdate/DLC/` contains per-DLC texture overrides for mash-up packs (Candy, Cartoon, City, Fantasy, Festive, Halloween, Halo, Mass Effect, Natural, Plastic, Skyrim, Steampunk).

## StitchedTexture and Stitcher

The `Stitcher` class packs individual block/item textures into atlas sheets. `StitchedTexture` represents a region within a stitched atlas, and `StitchSlot` tracks the position and size of each slot.

## Pending texture requests

The `Minecraft` class manages client-side texture requests for multiplayer:

```cpp
vector<wstring> m_pendingTextureRequests;    // skin textures awaiting download
vector<wstring> m_pendingGeometryRequests;   // skin box geometry awaiting download

bool addPendingClientTextureRequest(const wstring& textureName);
void handleClientTextureReceived(const wstring& textureName);
bool addPendingClientGeometryRequest(const wstring& textureName);
void handleClientGeometryReceived(const wstring& textureName);
```

This allows the client to request custom skin textures and additional model geometry from the server or online services.
