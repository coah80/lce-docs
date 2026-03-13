---
title: Splitscreen
description: How splitscreen rendering works in LCE, viewport layout, and modding considerations.
---

Splitscreen is one of the signature features of Legacy Console Edition. Up to 4 local players can play on the same screen at once, each with their own viewport. This page explains how it is implemented and what to watch out for when modding.

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

## Viewport Layouts

Here is how each player count maps to viewport types:

### 1 Player

The entire screen. Uses `VIEWPORT_TYPE_FULLSCREEN`.

```
┌─────────────────────┐
│                     │
│      Player 1       │
│    (Fullscreen)     │
│                     │
└─────────────────────┘
```

### 2 Players (Horizontal Split)

The default mode. Player 1 gets the top half, player 2 gets the bottom half. Uses `VIEWPORT_TYPE_SPLIT_TOP` and `VIEWPORT_TYPE_SPLIT_BOTTOM`.

```
┌─────────────────────┐
│      Player 1       │
│     (Split Top)     │
├─────────────────────┤
│      Player 2       │
│    (Split Bottom)   │
└─────────────────────┘
```

### 2 Players (Vertical Split)

An option the player can toggle. Uses `VIEWPORT_TYPE_SPLIT_LEFT` and `VIEWPORT_TYPE_SPLIT_RIGHT`. The primary player's `eGameSetting_SplitScreenVertical` setting controls which mode is used.

```
┌──────────┬──────────┐
│          │          │
│ Player 1 │ Player 2 │
│  (Left)  │ (Right)  │
│          │          │
└──────────┴──────────┘
```

### 3 Players

Uses all 4 quadrants, with one left empty. The `unoccupiedQuadrant` variable tracks which quadrant has no player.

```
┌──────────┬──────────┐
│ Player 1 │ Player 2 │
│ (Top L)  │ (Top R)  │
├──────────┼──────────┤
│ Player 3 │  Empty   │
│ (Bot L)  │ (Bot R)  │
└──────────┴──────────┘
```

### 4 Players

All 4 quadrants filled. Uses `VIEWPORT_TYPE_QUADRANT_TOP_LEFT`, `VIEWPORT_TYPE_QUADRANT_TOP_RIGHT`, `VIEWPORT_TYPE_QUADRANT_BOTTOM_LEFT`, and `VIEWPORT_TYPE_QUADRANT_BOTTOM_RIGHT`.

```
┌──────────┬──────────┐
│ Player 1 │ Player 2 │
│ (Top L)  │ (Top R)  │
├──────────┼──────────┤
│ Player 3 │ Player 4 │
│ (Bot L)  │ (Bot R)  │
└──────────┴──────────┘
```

## Viewport Assignment Logic

The viewport assignment happens in `Minecraft::updatePlayerViewportAssignments()`. Here is the actual code:

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
        // Split screen - the primary player's settings decide the mode
        int found = 0;
        for (int i = 0; i < XUSER_MAX_COUNT; i++)
        {
            if (localplayers[i] != nullptr)
            {
                if (app.GetGameSettings(ProfileManager.GetPrimaryPad(),
                        eGameSetting_SplitScreenVertical))
                {
                    // Vertical split: left/right
                    localplayers[i]->m_iScreenSection =
                        C4JRender::VIEWPORT_TYPE_SPLIT_LEFT + found;
                }
                else
                {
                    // Horizontal split: top/bottom (default)
                    localplayers[i]->m_iScreenSection =
                        C4JRender::VIEWPORT_TYPE_SPLIT_TOP + found;
                }
                found++;
            }
        }
    }
    else if (viewportsRequired >= 3)
    {
        // Quadrants - persists existing assignments so
        // viewports don't jump around when players join/leave
        bool quadrantsAllocated[4] = {false, false, false, false};

        for (int i = 0; i < XUSER_MAX_COUNT; i++)
        {
            if (localplayers[i] != nullptr)
            {
                // If the game has started, keep existing quadrant assignments
                if (app.GetGameStarted())
                {
                    if (localplayers[i]->m_iScreenSection >=
                            C4JRender::VIEWPORT_TYPE_QUADRANT_TOP_LEFT &&
                        localplayers[i]->m_iScreenSection <=
                            C4JRender::VIEWPORT_TYPE_QUADRANT_BOTTOM_RIGHT)
                    {
                        quadrantsAllocated[
                            localplayers[i]->m_iScreenSection -
                            C4JRender::VIEWPORT_TYPE_QUADRANT_TOP_LEFT] = true;
                    }
                }
                else
                {
                    // Before game starts, reset to fullscreen so they get
                    // assigned fresh in the next loop
                    localplayers[i]->m_iScreenSection =
                        C4JRender::VIEWPORT_TYPE_FULLSCREEN;
                }
            }
        }

        // Assign any unassigned players to free quadrants
        for (int i = 0; i < XUSER_MAX_COUNT; i++)
        {
            if (localplayers[i] != nullptr)
            {
                if (localplayers[i]->m_iScreenSection <
                        C4JRender::VIEWPORT_TYPE_QUADRANT_TOP_LEFT ||
                    localplayers[i]->m_iScreenSection >
                        C4JRender::VIEWPORT_TYPE_QUADRANT_BOTTOM_RIGHT)
                {
                    for (int j = 0; j < 4; j++)
                    {
                        if (!quadrantsAllocated[j])
                        {
                            localplayers[i]->m_iScreenSection =
                                C4JRender::VIEWPORT_TYPE_QUADRANT_TOP_LEFT + j;
                            quadrantsAllocated[j] = true;
                            break;
                        }
                    }
                }
            }
        }

        // Track the empty quadrant for 3-player mode
        // ...
    }
}
```

A few things to note:

- **3 players use 4 quadrants.** One quadrant is just empty. This avoids the awkward "one big, two small" layout that some games do.
- **Quadrant assignments persist.** If player 1 is in the top-left and player 3 joins, the existing players don't get shuffled around. The new player gets an empty slot. This is gated by `app.GetGameStarted()` to avoid issues during initial setup.
- **The primary player controls the split direction.** The `eGameSetting_SplitScreenVertical` setting on the primary player's pad decides whether 2-player mode uses horizontal or vertical split.
- **Before the game starts, assignments reset.** There is a comment from 4J saying this "fixes an issue with the primary player being the 4th controller quadrant, but ending up in the 3rd viewport."

## The Aspect Ratio Problem

When you split the screen, the aspect ratio changes. A fullscreen viewport might be 16:9, but a top/bottom split gives you roughly 3.5:1. The `getFovAndAspect()` function in `GameRenderer` handles this:

```cpp
void GameRenderer::getFovAndAspect(float& fov, float& aspect,
                                    float a, bool applyEffects)
```

This adjusts the FOV and aspect ratio based on the viewport dimensions so things don't look stretched. The GL wrapper also accounts for this in `gluPerspective()`:

```cpp
// glWrapper.cpp
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

The light texture system supports per-player rendering with separate textures:

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

UI scenes (menus, inventories, crafting) need to be aware of splitscreen. The XUI system handles this with `localPlayerIdx`, which tracks which local player opened the menu. If you are adding custom screens, make sure they:

- Use the correct player index when reading input
- Render within the correct viewport bounds
- Don't assume fullscreen dimensions for layout

On Xbox, when a splitscreen player joins or leaves, the system broadcasts a `CustomMessage_Splitscreenplayer` through XUI so all scenes can respond to the layout change.

## Modding Considerations

### Chunk Loading

Only the primary player's viewport drives chunk mesh updates. If your mod adds custom rendering that depends on chunks being loaded near all players, you might see pop-in for non-primary players. The chunk data is still there (for collision and game logic), but the render meshes might lag behind.

### Input Handling

Each controller maps to a player index (0-3). When handling input in custom code, always check which player the input came from. Don't assume controller 0 is always the "main" player. The primary pad is tracked by `ProfileManager.GetPrimaryPad()`.

### Performance

Every extra viewport means roughly another full render pass. Going from 1 to 4 players doesn't quite 4x the render cost (because the viewports are smaller so there is less fill), but it is close. If your mod adds expensive rendering, be aware that it gets multiplied by the number of local players.

### HUD and Overlays

The `setupGuiScreen()` function sets up 2D rendering coordinates for GUI elements. It has a `forceScale` parameter that is important for splitscreen:

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

If you add custom post-processing effects, you will need to apply them per-viewport using similar logic.

## Key Files

| File | What it does |
|---|---|
| `4J_Render.h` | Viewport type enum and `StateSetViewport()` |
| `Minecraft.cpp` | `updatePlayerViewportAssignments()` with full layout logic |
| `GameRenderer.h/.cpp` | Per-player rendering, fog, light textures, gamma caching |
| `glWrapper.cpp` | Perspective projection with aspect ratio |
| `Minecraft.h` | `localplayers[]` array, `unoccupiedQuadrant`, `XUSER_MAX_COUNT` |
| `Consoles_App.cpp` | Also calls `updatePlayerViewportAssignments()` |
