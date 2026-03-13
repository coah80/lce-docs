---
title: Splitscreen
description: How splitscreen rendering works in LCE, viewport layout, and modding considerations.
---

Splitscreen is one of the signature features of Legacy Console Edition. Up to 4 local players can play on the same screen at once, each with their own viewport. This page explains how it's implemented and what to watch out for when modding.

## Viewport Types

The rendering system defines 9 viewport configurations in `4J_Render.h`:

```cpp
typedef enum
{
    VIEWPORT_TYPE_FULLSCREEN,
    VIEWPORT_TYPE_SPLIT_TOP,
    VIEWPORT_TYPE_SPLIT_BOTTOM,
    VIEWPORT_TYPE_SPLIT_LEFT,
    VIEWPORT_TYPE_SPLIT_RIGHT,
    VIEWPORT_TYPE_QUADRANT_TOP_LEFT,
    VIEWPORT_TYPE_QUADRANT_TOP_RIGHT,
    VIEWPORT_TYPE_QUADRANT_BOTTOM_LEFT,
    VIEWPORT_TYPE_QUADRANT_BOTTOM_RIGHT,
} eViewportType;
```

Each local player gets assigned one of these types. The renderer calls `StateSetViewport()` before drawing each player's view, which sets the scissor rect and projection matrix for that portion of the screen.

## Viewport Assignment Logic

The viewport assignment happens in `Minecraft::updatePlayerViewportAssignments()`. Here's the core logic:

```cpp
void Minecraft::updatePlayerViewportAssignments()
{
    unoccupiedQuadrant = -1;

    // Count how many viewports we need
    int viewportsRequired = 0;
    for (int i = 0; i < XUSER_MAX_COUNT; i++)
    {
        if (localplayers[i] != nullptr) viewportsRequired++;
    }
    // 3 players = 4 quadrants (one stays empty)
    if (viewportsRequired == 3) viewportsRequired = 4;

    if (viewportsRequired == 1)
    {
        // Single viewport - fullscreen
        for (int i = 0; i < XUSER_MAX_COUNT; i++)
        {
            if (localplayers[i] != nullptr)
                localplayers[i]->m_iScreenSection =
                    C4JRender::VIEWPORT_TYPE_FULLSCREEN;
        }
    }
    else if (viewportsRequired == 2)
    {
        // Two players - split top/bottom (or left/right)
        int found = 0;
        // ... assigns SPLIT_TOP and SPLIT_BOTTOM ...
    }
    else if (viewportsRequired >= 3)
    {
        // Three or four players - quadrants
        // Persists existing quadrant assignments so
        // viewports don't jump around when a 4th player joins
        // ...
    }
}
```

A few things to note:

- **3 players use 4 quadrants.** One quadrant is just empty. This avoids the awkward "one big, two small" layout that some games do.
- **Quadrant assignments persist.** If player 1 is in the top-left and player 3 joins, the existing players don't get shuffled around. The new player gets an empty slot.
- **The primary player controls chunk updates.** Only the primary player's viewport triggers chunk mesh rebuilds. Other players see whatever geometry is already loaded for their camera position.

## The Aspect Ratio Problem

When you split the screen, the aspect ratio changes. A fullscreen viewport might be 16:9, but a top/bottom split gives you 16:4.5 (roughly 3.5:1). The `getFovAndAspect()` function in `GameRenderer` handles this:

```cpp
void GameRenderer::getFovAndAspect(float& fov, float& aspect,
                                    float a, bool applyEffects)
```

This adjusts the FOV and aspect ratio based on the viewport dimensions so things don't look stretched. The GL wrapper also accounts for this in `gluPerspective()`:

```cpp
// glWrapper.cpp
// For split-screen, getFovAndAspect adjusts the aspect
// ratio to match the viewport dimensions.
void gluPerspective(float fovy, float aspect, float zNear, float zFar)
{
    RenderManager.MatrixPerspective(fovy, aspect, zNear, zFar);
}
```

## Per-Player Rendering

Each local player gets their own rendering pass. The main render loop in `GameRenderer::render()` iterates over local players and for each one:

1. Sets the viewport with `StateSetViewport()`
2. Computes the camera position from that player's entity
3. Sets up fog and sky colors for that player's position
4. Renders the level from that perspective
5. Renders the GUI/HUD overlay

The light texture system also supports per-player rendering:

```cpp
// GameRenderer.h
static const int NUM_LIGHT_TEXTURES = 4;
int lightTexture[NUM_LIGHT_TEXTURES];
// One light texture per level, to support split screen
```

And gamma is cached per player:

```cpp
float m_cachedGammaPerPlayer[NUM_LIGHT_TEXTURES];
```

## UI in Splitscreen

UI scenes (menus, inventories, crafting) need to be aware of splitscreen. The XUI system handles this with `localPlayerIdx`, which tracks which local player opened the menu. Look at how inventory scenes reference this:

```cpp
// Most UI scenes have access to the local player index
// and use it to know which viewport they belong to
```

If you're adding custom screens, make sure they:

- Use the correct player index when reading input
- Render within the correct viewport bounds
- Don't assume fullscreen dimensions for layout

## Modding Considerations

### Chunk Loading

Only the primary player's viewport drives chunk mesh updates. If your mod adds custom rendering that depends on chunks being loaded near all players, you might see pop-in for non-primary players. The chunk data is still there (for collision and game logic), but the render meshes might lag behind.

### Input Handling

Each controller maps to a player index (0-3). When handling input in custom code, always check which player the input came from. Don't assume controller 0 is always the "main" player.

### Performance

Every extra viewport means roughly another full render pass. Going from 1 to 4 players doesn't quite 4x the render cost (because the viewports are smaller so there's less fill), but it's close. If your mod adds expensive rendering, be aware that it gets multiplied by the number of local players.

### HUD and Overlays

The `setupGuiScreen()` function sets up 2D rendering coordinates for GUI elements. It has a `forceScale` parameter that's important for splitscreen:

```cpp
void GameRenderer::setupGuiScreen(int forceScale = -1);
```

When rendering HUD elements, the coordinate system is scaled to fit the viewport. A fullscreen GUI might be 854x480 in virtual coordinates, but in a quadrant it would be smaller. Make sure your custom HUD elements use relative positioning, not hardcoded pixel coordinates.

### Post-Processing

The gamma post-processing system already accounts for splitscreen with per-player viewports:

```cpp
bool ComputeViewportForPlayer(int j, D3D11_VIEWPORT& outViewport) const;
uint32_t BuildPlayerViewports(D3D11_VIEWPORT* outViewports,
                               float* outGammas, UINT maxCount) const;
```

If you add custom post-processing effects, you'll need to apply them per-viewport using similar logic.

## Key Files

| File | What it does |
|---|---|
| `4J_Render.h` | Viewport type enum and `StateSetViewport()` |
| `Minecraft.cpp` | `updatePlayerViewportAssignments()` |
| `GameRenderer.h/.cpp` | Per-player rendering, fog, light textures |
| `glWrapper.cpp` | Perspective projection with aspect ratio |
| `Minecraft.h` | `localplayers[]` array and player management |
