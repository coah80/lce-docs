---
title: Texture Packs
description: How texture packs and resource replacement work in LCE, including the pack system architecture, file structure, and how to make your own.
---

Texture packs in LCE work pretty differently from Java Edition resource packs. The console versions use a pre-stitched texture atlas system, a class hierarchy for pack types, and a DLC-based packaging format that 4J Studios built from scratch. This guide breaks down how all of it works and how you can replace textures yourself.

## How the Pack System Works

At the core, every texture pack in LCE is an object that implements the `TexturePack` interface. This base class lives in `Minecraft.Client/TexturePack.h` and defines the contract that all packs must follow:

```cpp
class TexturePack
{
public:
    virtual bool hasData() = 0;
    virtual bool isLoadingData() = 0;
    virtual void loadData() {}
    virtual void unload(Textures *textures) = 0;
    virtual void load(Textures *textures) = 0;
    virtual InputStream *getResource(const wstring &name, bool allowFallback) = 0;
    virtual DWORD getId() = 0;
    virtual wstring getName() = 0;
    virtual bool hasFile(const wstring &name, bool allowFallback) = 0;
    virtual BufferedImage *getImageResource(const wstring& File,
        bool filenameHasExtension = false,
        bool bTitleUpdateTexture = false,
        const wstring &drive = L"") = 0;
    virtual ColourTable *getColourTable() = 0;
    virtual ArchiveFile *getArchiveFile() = 0;
    // ...
};
```

The key methods here are `getResource()` (fetches raw data for a texture name), `getImageResource()` (returns a `BufferedImage` ready for GPU upload), and `hasFile()` (checks if this pack contains a given texture).

## The Class Hierarchy

There are four concrete texture pack types. They all inherit from `AbstractTexturePack`, which adds fallback logic, icon loading, colour table support, and the actual `getResource()` implementation with fallback chaining:

```
TexturePack (interface)
  └─ AbstractTexturePack (fallback logic, colour tables, UI)
       ├─ DefaultTexturePack  — built-in vanilla textures
       ├─ FolderTexturePack   — loose files in a folder (debug/dev)
       ├─ FileTexturePack     — zip-based packs (stubbed on console)
       └─ DLCTexturePack      — DLC .pck based packs (the real deal)
```

### DefaultTexturePack

This is the vanilla pack. It always exists and is always ID `0`. When it loads a resource, it reads from the platform's base resource directory:

```cpp
// DefaultTexturePack::getResourceImplementation
// On Xbox:    "GAME:\\res\\TitleUpdate\\res" + name
// On PS3:     "/app_home/Common/res/TitleUpdate/res" + name
// On Windows: "Common\\res\\TitleUpdate\\res" + name
InputStream *resource = InputStream::getResourceAsStream(wDrive + name);
```

It serves as the fallback for every other pack type. If a DLC pack or folder pack is missing a texture, the system falls through to `DefaultTexturePack` automatically.

### FolderTexturePack

This one is mainly for development and testing. It reads loose files from a folder on disk. On Xbox, that folder lives at `GAME:\DummyTexturePack\res`. On other platforms, it's `Common\DummyTexturePack\res`.

```cpp
// FolderTexturePack::getResourceImplementation
wDrive = L"Common\\DummyTexturePack\\res";
InputStream *resource = InputStream::getResourceAsStream(wDrive + name);
```

This is the easiest way to test texture replacements during development. Just drop files into the folder and they get picked up.

### DLCTexturePack

This is how real texture packs ship. DLC packs use the `.pck` format and the `DLCManager` system. A DLC texture pack has two separate `DLCPack` objects:

- **`m_dlcInfoPack`** — metadata: pack name, icon, description, localisation strings
- **`m_dlcDataPack`** — the actual texture data, loaded on demand when the pack gets selected

The data pack is mounted from the console's DLC storage, read via `readDLCDataFile()`, and then textures are accessed through the `DLCManager` file type system:

```cpp
// DLCTexturePack::hasFile
bool hasFile = false;
if (m_dlcDataPack != NULL)
    hasFile = m_dlcDataPack->doesPackContainFile(
        DLCManager::e_DLCType_Texture, name);
return hasFile;
```

```cpp
// DLCTexturePack::getImageResource
if (m_dlcDataPack)
    return new BufferedImage(m_dlcDataPack, L"/" + File, filenameHasExtension);
else
    return fallback->getImageResource(File, filenameHasExtension,
        bTitleUpdateTexture, drive);
```

DLC packs can also include colour tables (`colours.col`), UI skins (`TexturePack.xzp` on Xbox, `skin.swf` + `media.arc` on other platforms), audio banks, and game rules for mashup packs.

## The TexturePackRepository

All packs are managed by `TexturePackRepository` (in `Minecraft.Client/TexturePackRepository.h`). It holds a vector of all available packs and a hash map for lookup by ID:

```cpp
class TexturePackRepository
{
    static const DWORD DEFAULT_TEXTURE_PACK_ID = 0;
    vector<TexturePack *> *texturePacks;
    unordered_map<DWORD, TexturePack *> cacheById;
    TexturePack *selected;
    // ...
};
```

When you select a new texture pack (via menu or programmatically), `selectTexturePackById()` looks it up in the cache and triggers a reload:

```cpp
bool TexturePackRepository::selectTexturePackById(DWORD id)
{
    auto it = cacheById.find(id);
    if (it != cacheById.end())
    {
        TexturePack *newPack = it->second;
        if (newPack != selected)
        {
            selectSkin(newPack);
            if (newPack->hasData())
                app.SetAction(ProfileManager.GetPrimaryPad(),
                    eAppAction_ReloadTexturePack);
            else
                newPack->loadData();  // triggers async DLC mount
        }
    }
    // ...
}
```

The `eAppAction_ReloadTexturePack` action eventually calls `Textures::reloadAll()`, which clears all loaded textures and re-stitches everything from the newly selected pack.

## The Fallback Chain

One of the most important things to understand: the system uses a **fallback chain**. When `AbstractTexturePack::getResource()` gets called, it first checks if the current pack has the file. If not, it asks the fallback pack:

```cpp
InputStream *AbstractTexturePack::getResource(const wstring &name,
    bool allowFallback)
{
    InputStream *is = getResourceImplementation(name);
    if (is == NULL && fallback != NULL && allowFallback)
    {
        is = fallback->getResource(name, true);
    }
    return is;
}
```

Every non-default pack gets `DefaultTexturePack` as its fallback. So you only need to include the textures you want to change. Everything else falls through to vanilla.

## Pre-Stitched Texture Atlases

Here is where LCE really diverges from Java Edition. Java builds its texture atlas at runtime by stitching individual tile images together. LCE ships **pre-stitched atlases** and uses the `PreStitchedTextureMap` class instead of `TextureMap`.

The comment in the header says it all:

```cpp
// 4J Added this class to stop having to do texture stitching at runtime
class PreStitchedTextureMap : public IconRegister
```

There are two atlases created at startup:

```cpp
// In Textures::Textures()
terrain = new PreStitchedTextureMap(Icon::TYPE_TERRAIN,
    L"terrain", L"textures/blocks/", missingNo, true);
items = new PreStitchedTextureMap(Icon::TYPE_ITEM,
    L"items", L"textures/items/", missingNo, true);
```

The UV coordinates for every icon in the atlas are hardcoded in `PreStitchedTextureMap::loadUVs()`. Each texture slot is mapped to a position on a 16x16 grid:

```cpp
void PreStitchedTextureMap::loadUVs()
{
    float slotSize = 1.0f / 16.0f;
    // Items atlas example:
    texturesByName.insert(stringIconMap::value_type(
        L"helmetCloth",
        new SimpleIcon(L"helmetCloth",
            slotSize*0, slotSize*0,     // u0, v0
            slotSize*1, slotSize*1)));   // u1, v1
    // ... hundreds more entries
}
```

This means the atlas image is a single PNG where textures are packed into a fixed 16x16 grid of slots. Block and item textures must be placed at exactly the right position in the atlas or they won't show up correctly.

## How Texture Loading Works

When the game loads or reloads textures, here's what happens step by step:

1. `Textures::reloadAll()` gets called
2. All existing GPU texture IDs get released
3. The ID map and pixel cache are cleared
4. `loadIndexedTextures()` re-loads every entry in the `preLoaded[]` array (mob textures, environment, GUI, particles, etc.)
5. `stitch()` rebuilds both the terrain and items atlases

The `readImage()` function is where the pack selection actually matters. It checks if the currently selected pack has the requested texture, and if so, loads it from that pack. Otherwise it falls through to the default:

```cpp
BufferedImage *Textures::readImage(TEXTURE_NAME texId, const wstring& name)
{
    BufferedImage *img = NULL;

    if (!skins->isUsingDefaultSkin() &&
        skins->getSelected()->hasFile(L"res/" + name, false))
    {
        drive = skins->getSelected()->getPath(isTu);
        img = skins->getSelected()->getImageResource(name, false, isTu, drive);
    }
    else
    {
        drive = skins->getDefault()->getPath(isTu);
        img = skins->getDefault()->getImageResource(name, false, isTu, drive);
    }
    return img;
}
```

Notice the `L"res/"` prefix check. Texture files in packs are expected to be under a `res/` directory.

## The Preloaded Texture List

LCE has a big enum (`TEXTURE_NAME` in `Textures.h`) and a matching string array (`preLoaded[]` in `Textures.cpp`) that defines every standalone texture (not part of an atlas) that gets loaded at startup. These cover:

- **Mob textures**: `mob/creeper`, `mob/zombie`, `mob/enderman`, etc.
- **Environment**: `environment/clouds`, `environment/rain`, `environment/snow`
- **GUI**: `gui/gui`, `gui/icons`
- **Items**: `item/arrows`, `item/boat`, `item/cart`, `item/sign`
- **Misc**: `particles`, `misc/water`, `misc/mapbg`, `misc/mapicons`
- **Terrain**: `terrain/sun`, `terrain/moon`, `terrain/moon_phases`
- **Fonts**: `font/Default`, `font/alternate`

Each one gets a `.png` extension appended and is loaded through `readImage()`. To replace any of these, you just need a file at the matching path in your pack.

## Making a Simple Texture Replacement

The easiest approach for modding is to use the `FolderTexturePack` system. Here's how:

### Step 1: Set Up the Folder

Create a `DummyTexturePack` directory in your platform's content area:

```
Common/
  DummyTexturePack/
    res/
      mob/
        creeper.png      ← your custom creeper texture
      terrain.png        ← your custom terrain atlas
      gui/
        items.png        ← your custom items atlas
```

Files under `res/` mirror the same paths as vanilla. The `hasFile()` check looks for `res/` + the texture name.

### Step 2: Enable the Debug Pack

In `TexturePackRepository::addDebugPacks()`, the `FolderTexturePack` creation is commented out by default. Uncomment it:

```cpp
void TexturePackRepository::addDebugPacks()
{
#ifndef _CONTENT_PACKAGE
    File *file = new File(L"DummyTexturePack");
    m_dummyTexturePack = new FolderTexturePack(
        FOLDER_TEST_TEXTURE_PACK_ID,
        L"FolderTestPack", file, DEFAULT_TEXTURE_PACK);
    texturePacks->push_back(m_dummyTexturePack);
    cacheById[m_dummyTexturePack->getId()] = m_dummyTexturePack;
#endif
}
```

### Step 3: Select It

After the pack is registered, select it by ID:

```cpp
skins->selectTexturePackById(TexturePackRepository::FOLDER_TEST_TEXTURE_PACK_ID);
```

Or just set it as the default selected pack in the repository constructor for testing.

## Replacing Individual Textures (Standalone)

For standalone textures (mobs, particles, GUI, etc.), just place a PNG at the right path. The texture name from the `preLoaded[]` array maps directly to a file path:

| Texture enum | File path |
|---|---|
| `TN_MOB_CREEPER` | `res/mob/creeper.png` |
| `TN_MOB_ZOMBIE` | `res/mob/zombie.png` |
| `TN_PARTICLES` | `res/particles.png` |
| `TN_GUI_GUI` | `res/gui/gui.png` |
| `TN_ENVIRONMENT_CLOUDS` | `res/environment/clouds.png` |
| `TN_TERRAIN_SUN` | `res/terrain/sun.png` |

The dimensions should match the originals. Most mob textures are 64x32 or 64x64.

## Replacing Atlas Textures (Terrain and Items)

The terrain and items atlases are trickier. Because LCE uses pre-stitched atlases with hardcoded UV coordinates on a 16x16 grid, you have two options:

**Option A: Replace the whole atlas.** Drop in a full `terrain.png` or `gui/items.png` where every slot in the 16x16 grid has your replacement texture. This is the simplest approach but you need to replace everything at once.

**Option B: Modify individual tiles in the atlas.** Extract the vanilla atlas, edit the specific 16x16-pixel tiles you want to change, and save the whole image back. The `PreStitchedTextureMap::loadUVs()` function tells you exactly which slot maps to which block or item.

Either way, the atlas image must be a square with dimensions that are a power of 2 (typically 256x256 for 16x16 tiles in a 16x16 grid).

## Animated Textures

LCE supports animated textures through `.txt` sidecar files. When the `TextureManager` loads a texture, it checks if an animation definition file exists:

```cpp
bool TextureManager::isAnimation(const wstring &filename,
    TexturePack *texturePack)
{
    wstring dataFileName = L"/" + filename.substr(0, filename.find_last_of(L'.'))
        + L".txt";
    return skins->getSelected()->hasFile(dataFileName, !hasOriginalImage);
}
```

If a texture named `lava.png` has a matching `lava.txt`, the system treats the image as a vertical strip of animation frames. Each frame is a square with the same width as the image, and the number of frames is `height / width`.

The `.txt` file contains comma-separated animation parameters (frame timing, etc.) that get parsed by `getAnimationString()`.

For DLC packs, animation parameters are stored differently as a DLC parameter on the texture file entry:

```cpp
// DLCTexturePack::getAnimationString
result = m_dlcDataPack->getFile(DLCManager::e_DLCType_Texture, fullpath)
    ->getParameterAsString(DLCManager::e_DLCParamType_Anim);
```

## Differences from Java Resource Packs

Here's where LCE and Java really diverge:

| Feature | Java Edition | LCE |
|---|---|---|
| **Atlas stitching** | Runtime (dynamic) | Pre-stitched (hardcoded UVs) |
| **Pack format** | Zip with `pack.mcmeta` | DLC `.pck` files via DLCManager |
| **Texture paths** | `assets/minecraft/textures/` | `res/` prefix |
| **Animations** | JSON `.mcmeta` files | `.txt` sidecar files |
| **Fallback** | Layered pack stacking | Single fallback chain to default |
| **Hot-reload** | Mostly supported | Full reload via `reloadAll()` |
| **Resolution** | Any power of 2 | Limited by console memory |
| **Block models** | JSON model system | Hardcoded render shapes |

The biggest difference is that Java lets you stack multiple resource packs with individual textures that get stitched together. LCE only has one active pack at a time, and the atlas is pre-built. You can't just drop in a single `dirt.png` and have it work. You need to either replace the entire atlas or work within the pre-stitched system.

## Console-Specific Considerations

### Memory Limits

Console hardware has tight memory budgets. The `Textures` class manages all GPU texture memory, and there are platform-specific texture format optimizations:

```cpp
// Some textures use compressed 8-bit formats instead of full RGBA
// to save memory on Xbox
if (resourceName == L"environment/clouds.png")
    TEXTURE_FORMAT = C4JRender::TEXTURE_FORMAT_R1G1B1Ax;
else if (resourceName == L"%blur%/misc/pumpkinblur.png")
    TEXTURE_FORMAT = C4JRender::TEXTURE_FORMAT_R0G0B0Ax;
```

Keep your replacement textures at the same resolution as the originals. Going higher res will eat into the memory budget fast, especially on PS3 and Vita.

### Mipmapping

Most textures use mipmapping, but some are explicitly excluded:

```cpp
if ((resourceName == L"environment/clouds.png") ||
    (resourceName == L"%clamp%misc/shadow.png") ||
    (resourceName == L"gui/icons.png") ||
    (resourceName == L"gui/gui.png") ||
    (resourceName == L"misc/footprint.png"))
{
    MIPMAP = false;
}
```

If you're replacing these specific textures, be aware that they won't have mip levels generated. GUI textures in particular should stay at their original resolution.

### Platform Paths

Each platform resolves the base resource path differently. The `TexturePack::getPath()` function handles this:

| Platform | Base path | Title update path |
|---|---|---|
| Xbox 360 | `GAME:\` | `UPDATE:\` or `GAME:\res\TitleUpdate\` |
| PS3 | `/app_home/Common/` | `Common/res/TitleUpdate/` |
| PS Vita | `Common\` | `Common\res\TitleUpdate\` |
| Windows | `Common/` | `Common\res\TitleUpdate\` |

When the engine looks for a texture, it checks the title update path first (for patched textures), then falls back to the base path.

### DLC Mounting

DLC texture packs need to be mounted from the console's storage before their data can be accessed. This is an async operation:

```cpp
void DLCTexturePack::loadData()
{
    int mountIndex = m_dlcInfoPack->GetDLCMountIndex();
    if (mountIndex > -1)
    {
        StorageManager.MountInstalledDLC(
            ProfileManager.GetPrimaryPad(),
            mountIndex,
            &DLCTexturePack::packMounted, this, "TPACK");
    }
}
```

The `packMounted` callback reads the `.pck` data file, loads any UI data and audio, and then triggers the texture reload. On Xbox, the DLC stays mounted if it has streaming audio; otherwise it gets unmounted after loading to free up mount points.

## Network Texture Packets

In multiplayer, the host sends texture pack info to joining clients. There are two packet types:

- **`TexturePacket`** (ID 154) — sends the full texture pack name and data bytes to a client
- **`TextureChangePacket`** (ID 157) — tells clients about skin or cape changes during gameplay

When a client joins a game with a texture pack, the server sends the pack ID and the client selects it locally. If the client doesn't have the DLC pack installed, it falls back to the default.

## Key Source Files

| File | What it does |
|---|---|
| `Minecraft.Client/TexturePack.h` | Base interface for all texture packs |
| `Minecraft.Client/AbstractTexturePack.h/.cpp` | Fallback logic, colour tables, resource loading |
| `Minecraft.Client/DefaultTexturePack.h/.cpp` | Vanilla built-in textures |
| `Minecraft.Client/FolderTexturePack.h/.cpp` | Loose-file debug packs |
| `Minecraft.Client/FileTexturePack.h/.cpp` | Zip-based packs (mostly stubbed) |
| `Minecraft.Client/DLCTexturePack.h/.cpp` | DLC-based packs with async mounting |
| `Minecraft.Client/TexturePackRepository.h/.cpp` | Pack management, selection, UI updates |
| `Minecraft.Client/Textures.h/.cpp` | Texture loading, binding, atlas management |
| `Minecraft.Client/TextureManager.h/.cpp` | Texture creation and registration |
| `Minecraft.Client/PreStitchedTextureMap.h/.cpp` | Pre-built atlas with hardcoded UVs |
| `Minecraft.Client/Common/DLC/DLCManager.h` | DLC file type system |
| `Minecraft.World/TexturePacket.h` | Network packet for texture pack data |
| `Minecraft.World/TextureChangePacket.h` | Network packet for skin/cape changes |
