---
title: "Rendering Pipeline"
description: "How LCEMP renders the game world."
---

The LCEMP rendering pipeline transforms the game world into pixels through several cooperating systems: `GameRenderer` orchestrates each frame, `LevelRenderer` manages chunk geometry, `EntityRenderDispatcher` routes entity drawing, `TileRenderer` tessellates block faces, and `Tesselator` is the low-level vertex buffer that everything feeds into.

## Frame rendering flow

`GameRenderer::render(float a, bool bFirst)` is the per-frame entry point, called once per split-screen viewport. The `a` parameter is the interpolation alpha between ticks, and `bFirst` is true for the first viewport rendered that frame.

Within a single frame, the pipeline executes roughly these steps:

1. **Camera setup** -- `setupCamera()` configures the projection matrix, applies FOV, and positions the camera via `moveCameraToPlayer()`
2. **Frustum culling** -- `Frustum::getFrustum()` extracts clip planes from the current model-view-projection matrices
3. **World rendering** -- `renderLevel()` draws the world in multiple passes
4. **GUI rendering** -- `setupGuiScreen()` switches to orthographic projection for HUD and menu overlays

## GameRenderer

`GameRenderer` manages per-frame state and effects:

| Member | Purpose |
|---|---|
| `smoothTurnX` / `smoothTurnY` | Smooth camera movement (via `SmoothFloat`) |
| `smoothDistance` / `smoothRotation` / `smoothTilt` / `smoothRoll` | Third-person camera smoothing |
| `fovOffset` / `fovOffsetO` | FOV modification (sprint, bow draw) |
| `cameraRoll` / `cameraRollO` | Camera roll effect (damage) |
| `lightTexture[4]` | One light texture per level for split-screen |
| `fov[4]` / `oFov[4]` / `tFov[4]` | Per-player FOV tracking |
| `blr` / `blg` (and `blrt` / `blgt`) | Fog colour blending |

Key methods:

- **`tick(bool bFirst)`** -- updates FOV, rain sounds, light textures each game tick
- **`pick(float a)`** -- performs raycasting to determine what the player is looking at
- **`bobHurt(float a)`** -- applies screen shake when damaged
- **`bobView(float a)`** -- applies view bobbing while walking
- **`renderItemInHand(float a, int eye)`** -- draws the held item
- **`renderSnowAndRain(float a)`** -- renders weather particle sheets
- **`tickLightTexture()` / `updateLightTexture(float a)`** -- updates the light-map texture based on time of day and dimension
- **`setupFog(int i, float alpha)`** -- configures distance fog per render pass

### Anaglyph 3D

`GameRenderer` supports stereoscopic 3D rendering through the static fields `anaglyph3d` and `anaglyphPass`. When enabled, the scene is rendered twice with color channel separation.

### Multithreaded chunk updates

On platforms with `MULTITHREAD_ENABLE`, `GameRenderer` runs chunk updates on a background thread:

```cpp
static C4JThread* m_updateThread;
static C4JThread::EventArray* m_updateEvents;
```

The `EnableUpdateThread()` and `DisableUpdateThread()` methods control this thread, and deferred memory cleanup is handled through lock-free delete stacks for `SparseLightStorage`, `CompressedTileStorage`, and `SparseDataStorage`.

## LevelRenderer

`LevelRenderer` implements `LevelListener` and is responsible for managing the render chunk grid and drawing the world. It maintains one set of chunks per split-screen player.

### Chunk grid

```cpp
static const int CHUNK_XZSIZE = 16;
static const int CHUNK_SIZE = 16;
static const int CHUNK_Y_COUNT = Level::maxBuildHeight / CHUNK_SIZE;
```

Chunks are 16x16x16 blocks. The render grid is allocated based on `PLAYER_RENDER_AREA` (400 chunks for standard worlds, or calculated from `PLAYER_VIEW_DISTANCE = 18` for large worlds).

### Memory budgets (per platform)

| Platform | `MAX_COMMANDBUFFER_ALLOCATIONS` |
|---|---|
| Xbox One | 512 MB |
| PS4 (Orbis) | 448 MB |
| PS3 | 110 MB |
| Windows 64 | 2047 MB |
| Other (Xbox 360, Vita) | 55 MB |

### Chunk flags

Each chunk in the global grid carries a flag byte with these bits:

| Flag | Value | Meaning |
|---|---|---|
| `CHUNK_FLAG_COMPILED` | `0x01` | Geometry has been built |
| `CHUNK_FLAG_DIRTY` | `0x02` | Needs rebuild |
| `CHUNK_FLAG_EMPTY0` | `0x04` | Layer 0 is empty |
| `CHUNK_FLAG_EMPTY1` | `0x08` | Layer 1 is empty |
| `CHUNK_FLAG_NOTSKYLIT` | `0x10` | Not lit by sky |
| `CHUNK_FLAG_CRITICAL` | `0x20` | Critical chunk (Vita only) |
| `CHUNK_FLAG_CUT_OUT` | `0x40` | Has cut-out textures (Vita only) |

Reference counting uses the upper bits (3-bit or 2-bit depending on platform) to track how many split-screen viewports reference a chunk.

### Render passes

`LevelRenderer::render()` takes a layer parameter. Layer 0 renders opaque geometry, layer 1 renders translucent geometry (water, glass, ice). The `renderChunks()` method iterates the visible chunk list and dispatches their display lists.

### Key rendering methods

| Method | Purpose |
|---|---|
| `render()` | Main world render for a given layer |
| `renderEntities()` | Draw all visible entities |
| `renderSky()` | Render sky dome, sun, moon, stars |
| `renderHaloRing()` | Render the halo ring effect |
| `renderClouds()` / `renderAdvancedClouds()` | Cloud rendering (simple and fancy) |
| `renderHit()` / `renderHitOutline()` | Block selection outline and crack overlay |
| `renderDestroyAnimation()` | Block-breaking progress animation |
| `cull()` | Mark chunks visible/hidden via frustum culling |
| `updateDirtyChunks()` | Rebuild chunks that have been modified |

### DestroyedTileManager

An inner class that provides temporary collision for recently destroyed blocks while their render chunks are being rebuilt:

```cpp
class DestroyedTileManager {
    void destroyingTileAt(Level*, int x, int y, int z);
    void updatedChunkAt(Level*, int x, int y, int z, int veryNearCount);
    void addAABBs(Level*, AABB*, AABBList*);
    void tick();
};
```

### Large worlds

When `_LARGE_WORLDS` is defined, `LevelRenderer` uses multi-threaded chunk rebuilding:

```cpp
static const int MAX_CONCURRENT_CHUNK_REBUILDS = 4;
static Chunk permaChunk[MAX_CONCURRENT_CHUNK_REBUILDS];
static C4JThread *rebuildThreads[MAX_CHUNK_REBUILD_THREADS];
```

## Chunk (render chunk)

The `Chunk` class (not to be confused with `LevelChunk` in `Minecraft.World`) represents a 16x16x16 renderable section of the world. Key operations:

- **`rebuild()`** -- tessellates all tiles in the chunk into display lists using `TileRenderer`
- **`cull(Culler*)`** -- tests visibility against the current frustum
- **`distanceToSqr(Entity)`** -- used for sorting/prioritizing which chunks to rebuild first
- **`setDirty()`** / **`clearDirty()`** -- flag a chunk for rebuild

On PS3, `rebuild_SPU()` offloads chunk building to SPU cores.

## Tesselator

`Tesselator` is the core vertex submission system. It collects vertices into an integer array and flushes them as OpenGL-style draw calls.

### Configuration

```cpp
static const int MAX_MEMORY_USE = 16 * 1024 * 1024;  // 16 MB
static const int MAX_FLOATS = MAX_MEMORY_USE / 4 / 2;
```

### Vertex submission API

| Method | Purpose |
|---|---|
| `begin()` / `begin(int mode)` | Start a new primitive batch |
| `end()` | Flush the batch to the GPU |
| `vertex(float x, float y, float z)` | Submit a vertex position |
| `vertexUV(float x, float y, float z, float u, float v)` | Submit position + texture coords |
| `tex(float u, float v)` | Set current texture coordinates |
| `tex2(int tex2)` | Set secondary texture coordinates (lightmap) |
| `color(...)` | Set vertex color (multiple overloads) |
| `normal(float x, float y, float z)` | Set vertex normal |
| `offset(float xo, float yo, float zo)` | Set position offset applied to all vertices |
| `noColor()` | Disable color output |
| `useCompactVertices(bool)` | Enable compact vertex format (Xbox 360 optimization) |
| `useProjectedTexture(bool)` | Enable projected texture pixel shader |

`Tesselator` uses thread-local storage so each thread can have its own instance (`CreateNewThreadStorage()`/`getInstance()`).

### Bounds tracking

An inner `Bounds` class automatically tracks the axis-aligned bounding box of submitted vertices:

```cpp
class Bounds {
    float boundingBox[6]; // min xyz, max xyz
    void reset();
    void addVert(float x, float y, float z);
    void addBounds(Bounds& ob);
};
```

### PS Vita optimizations

On Vita, `Tesselator` includes:
- `setAlphaCutOut(bool)` -- defers alpha-tested primitives to a second array
- `tileQuad(...)` -- fast path for compressed tile quads
- `tileRainQuad(...)` -- fast path for rain particle quads
- `tileParticleQuad(...)` -- fast path for particle quads

## TileRenderer

`TileRenderer` handles the conversion of block state to geometry. It contains specialized tessellation methods for every block shape:

| Method | Block type |
|---|---|
| `tesselateBlockInWorld()` | Standard cubes |
| `tesselateWaterInWorld()` | Water (with height calculation) |
| `tesselateTorchInWorld()` | Torches |
| `tesselateCrossInWorld()` | Flowers, tall grass |
| `tesselateRailInWorld()` | Rails |
| `tesselateStairsInWorld()` | Stairs |
| `tesselateDoorInWorld()` | Doors |
| `tesselateFenceInWorld()` | Fences |
| `tesselateThinFenceInWorld()` | Glass panes, iron bars |
| `tesselatePistonBaseInWorld()` | Piston bases |
| `tesselatePistonExtensionInWorld()` | Piston extensions |
| `tesselateBedInWorld()` | Beds |
| `tesselateFireInWorld()` | Fire |
| `tesselateDustInWorld()` | Redstone dust |
| `tesselateLadderInWorld()` | Ladders |
| `tesselateVineInWorld()` | Vines |
| `tesselateCactusInWorld()` | Cactus |
| `tesselateLeverInWorld()` | Levers |
| `tesselateDiodeInWorld()` | Repeaters/comparators |
| `tesselateBrewingStandInWorld()` | Brewing stands |
| `tesselateCauldronInWorld()` | Cauldrons |
| `tesselateAnvilInWorld()` | Anvils |
| `tesselateLilypadInWorld()` | Lily pads |
| `tesselateCocoaInWorld()` | Cocoa pods |
| `tesselateStemInWorld()` | Melon/pumpkin stems |
| `tesselateTreeInWorld()` | Logs |
| `tesselateQuartzInWorld()` | Quartz pillars |
| `tesselateTripwireSourceInWorld()` | Tripwire hooks |
| `tesselateTripwireInWorld()` | Tripwire |
| `tesselateWallInWorld()` | Cobblestone walls |
| `tesselateEggInWorld()` | Dragon egg |
| `tesselateFenceGateInWorld()` | Fence gates |
| `tesselateAirPortalFrameInWorld()` | End portal frames |
| `tesselateFlowerPotInWorld()` | Flower pots |
| `tesselateRowInWorld()` | Crop rows |

### Ambient occlusion

`tesselateBlockInWorldWithAmbienceOcclusionTexLighting()` implements smooth lighting by sampling light values from neighboring blocks and interpolating across faces. The `blend()` helper method combines light values with weighted averaging.

### Face rendering

Individual face methods handle oriented quads:
- `renderFaceUp()`, `renderFaceDown()`, `renderNorth()`, `renderSouth()`, `renderWest()`, `renderEast()`

### Data caching

`TileRenderer` maintains a per-chunk cache for `getLightColor()`, `getShadeBrightness()`, and `isTranslucentAt()` results, using bit-packed validity flags to avoid redundant lookups.

## EntityRenderDispatcher

This singleton routes entity rendering to the correct `EntityRenderer` subclass based on entity type (`eINSTANCEOF`). It maintains a map from entity type to renderer:

```cpp
typedef unordered_map<eINSTANCEOF, EntityRenderer*, ...> classToRendererMap;
```

The `render()` method calculates the entity's interpolated position and delegates to the appropriate renderer. `prepare()` must be called each frame to set up the camera, textures, font, and options context.

## EntityRenderer hierarchy

`EntityRenderer` is the base class for all entity renderers. `MobRenderer` extends it with mob-specific logic (body rotation interpolation, armor overlay, name tag rendering).

### All entity renderers

| Class | Entity |
|---|---|
| `PlayerRenderer` | Players (local and remote) |
| `ChickenRenderer` | Chickens |
| `CowRenderer` | Cows |
| `CreeperRenderer` | Creepers |
| `PigRenderer` | Pigs |
| `SheepRenderer` | Sheep |
| `WolfRenderer` | Wolves |
| `SquidRenderer` | Squids |
| `SpiderRenderer` | Spiders and cave spiders |
| `GhastRenderer` | Ghasts |
| `SlimeRenderer` | Slimes |
| `LavaSlimeRenderer` | Magma cubes |
| `EndermanRenderer` | Endermen |
| `SilverfishRenderer` | Silverfish |
| `BlazeRenderer` | Blazes |
| `EnderDragonRenderer` | Ender Dragon |
| `SnowManRenderer` | Snow golems |
| `VillagerRenderer` | Villagers |
| `VillagerGolemRenderer` | Iron golems |
| `OzelotRenderer` | Ocelots/cats |
| `MushroomCowRenderer` | Mooshrooms |
| `ZombieRenderer` | Zombies |
| `HumanoidMobRenderer` | Skeletons (with `SkeletonModel`), pig zombies (with `ZombieModel`) |
| `GiantMobRenderer` | Giants |
| `ArrowRenderer` | Arrows |
| `BoatRenderer` | Boats |
| `MinecartRenderer` | Minecarts |
| `TntRenderer` | Primed TNT |
| `FallingTileRenderer` | Falling blocks |
| `ItemRenderer` | Dropped items |
| `ItemSpriteRenderer` | Thrown projectiles (snowballs, ender pearls, eyes of ender, eggs, potions, exp bottles) |
| `ExperienceOrbRenderer` | XP orbs |
| `PaintingRenderer` | Paintings |
| `FishingHookRenderer` | Fishing bobbers |
| `FireballRenderer` | Fireballs, small fireballs, dragon fireballs |
| `EnderCrystalRenderer` | Ender crystals |
| `LightningBoltRenderer` | Lightning |
| `ItemFrameRenderer` | Item frames |
| `DefaultRenderer` | Fallback renderer |

## Tile entity renderers

`TileEntityRenderDispatcher` routes tile entity rendering similarly to `EntityRenderDispatcher`. Specialized renderers:

| Class | Tile entity |
|---|---|
| `ChestRenderer` | Chests |
| `EnderChestRenderer` | Ender chests |
| `EnchantTableRenderer` | Enchanting tables (with book model) |
| `SignRenderer` | Signs |
| `MobSpawnerRenderer` | Mob spawners |
| `PistonPieceRenderer` | Piston extensions |
| `SkullTileRenderer` | Mob heads |
| `TheEndPortalRenderer` | End portals |

## Camera

The `Camera` class provides static helpers for camera positioning:

- `Camera::prepare()` -- sets up camera orientation matrices
- `Camera::getCameraPos()` -- interpolated camera world position
- `Camera::getCameraTilePos()` -- block position of the camera
- `Camera::getBlockAt()` -- what block type the camera is inside (for underwater/lava effects)

Camera offset fields (`xa`, `ya`, `za`, `xa2`, `za2`) are used by the particle system and entity rendering to offset positions relative to the camera.

## Culling

Three `Culler` implementations control visibility:

| Class | Strategy |
|---|---|
| `FrustumCuller` | Standard frustum culling against view planes |
| `ViewportCuller` | Viewport-based culling |
| `AllowAllCuller` | No culling (renders everything) |

`FrustumData` stores the six frustum planes. `Frustum` extracts them from the current OpenGL matrices.

## Lighting

The `Lighting` class provides static methods for fixed-function lighting:

- `Lighting::turnOn()` -- enable standard 3D lighting
- `Lighting::turnOff()` -- disable lighting
- `Lighting::turnOnGui()` -- enable lighting tuned for GUI model rendering

## Other rendering components

| Class | Purpose |
|---|---|
| `ItemInHandRenderer` | First-person held item with bobbing, swing animation, and screen effects (pumpkin overlay, underwater, fire) |
| `ProgressRenderer` | Loading screen progress bars with title and percentage |
| `Gui` | HUD rendering: hotbar, health, chat messages, vignette, pumpkin blur |
| `ScreenSizeCalculator` | Computes safe-zone-adjusted screen dimensions |
| `Minimap` | In-game map rendering using `MapItemSavedData` |
| `OffsettedRenderList` | Manages display list collections offset to a world position |
| `DirtyChunkSorter` / `DistanceChunkSorter` | Sort chunks by rebuild priority or distance |
