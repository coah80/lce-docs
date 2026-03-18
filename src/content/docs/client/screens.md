---
title: "Screens & GUI"
description: "GUI screen system in LCE."
---

LCE has two GUI layers: the legacy Java-style `Screen` system (used for basic menus) and the console-native `UIScene` system (in `Common/UI/`) for the actual in-game console UI. Both systems exist side by side, with the console UI handling most player-facing menus.

The console UI is powered by **Iggy** (RAD Game Tools' Scaleform-like Flash runtime). Every menu, HUD element, and overlay in the console edition is an SWF movie file rendered through Iggy. The C++ code talks to Flash via the Iggy API, calling ActionScript functions and receiving callbacks from the SWF.

## How the SWF/Iggy system works

### The big picture

LCE uses SWF (Flash) files for all console UI. Here is the flow:

1. An SWF movie is authored in Adobe Flash (ActionScript 2/3). It defines the visual layout: buttons, labels, slot grids, checkboxes, sliders, and so on.
2. The SWF file is compiled and shipped inside the game's archive files, with resolution variants (1080, 720, 480, Vita).
3. At runtime, the C++ code loads the SWF binary into memory using `IggyPlayerCreateFromMemory()`, which creates an `Iggy*` player instance.
4. The C++ code calls ActionScript functions on the SWF (like `SetHealth`, `SetActiveSlot`, `SetLabel`) using `IggyPlayerCallMethodRS()`.
5. The SWF calls back into C++ through external function callbacks (like `handlePress`, `handleCheckboxToggled`, `handleSliderMove`).
6. Iggy renders the SWF to screen using the platform's graphics API (Direct3D on Xbox, OpenGL on PS3/Vita).

### Movie loading and resolution selection

When a `UIScene` is created, it calls `loadMovie()` which picks the right resolution variant:

```cpp
void UIScene::loadMovie()
{
    wstring moviePath = getMoviePath();

    // Resolution selection based on platform and screen height
    if (ui.getScreenHeight() == 720)
        moviePath.append(L"720.swf");
    else if (ui.getScreenHeight() == 480)
        moviePath.append(L"480.swf");
    else
        moviePath.append(L"1080.swf");

    // PS Vita gets its own variant
    // moviePath.append(L"Vita.swf");

    // Fallback to 720 if the preferred resolution is missing
    if (!app.hasArchiveFile(moviePath))
    {
        moviePath = getMoviePath();
        moviePath.append(L"720.swf");
    }

    byteArray baFile = ui.getMovieData(moviePath.c_str());
    swf = IggyPlayerCreateFromMemory(baFile.data, baFile.length, NULL);
    IggyPlayerInitializeAndTickRS(swf);

    // Read movie dimensions
    IggyProperties *properties = IggyPlayerProperties(swf);
    m_movieHeight = properties->movie_height_in_pixels;
    m_movieWidth = properties->movie_width_in_pixels;
}
```

Each scene subclass provides a `getMoviePath()` that returns the base name (without the resolution suffix). For example:
- `UIScene_HUD` returns `L"HUD"` (or `L"HUDSplit"` for splitscreen)
- `UIScene_CreativeMenu` returns `L"CreativeMenu"` (or `L"CreativeMenuSplit"`)
- `UIScene_PauseMenu` returns the path for the pause menu SWF

The system appends the resolution and `.swf` extension automatically. So `L"HUD"` becomes `HUD1080.swf`, `HUD720.swf`, or `HUD480.swf` depending on output resolution.

### SWF skin libraries

The UI uses shared graphics libraries (skins) that the SWF movies reference. These are loaded once by `UIController`:

| Library | Purpose |
|---|---|
| `eLibrary_Platform` | Platform-specific UI assets |
| `eLibrary_GraphicsDefault` | Default graphics (buttons, panels, backgrounds) |
| `eLibrary_GraphicsHUD` | HUD-specific graphics (hearts, food, armor icons) |
| `eLibrary_GraphicsInGame` | In-game menu graphics |
| `eLibrary_GraphicsTooltips` | Tooltip button graphics |
| `eLibrary_GraphicsLabels` | Label/text styling |
| `eLibrary_Labels` | Localized label strings |
| `eLibrary_InGame` | In-game shared code |
| `eLibrary_HUD` | HUD shared code |
| `eLibrary_Tooltips` | Tooltip shared code |
| `eLibrary_Default` | Default shared code |

Skin libraries can be reloaded at runtime (for example when switching texture packs) using `UIController::ReloadSkin()`, which runs on a background thread.

### Texture substitution

Scenes can replace textures inside SWF movies at runtime using `registerSubstitutionTexture()`. This is used for things like:
- Save file thumbnails in the load menu
- Skin preview textures
- DLC offer images

The substitution system uses Iggy callbacks (`TextureSubstitutionCreateCallback` / `TextureSubstitutionDestroyCallback`) to swap out named textures in the SWF with raw pixel data provided from C++.

### Custom draw regions

Some UI elements need to render 3D Minecraft content inside the 2D Flash UI. This is done through Iggy's custom draw callback system. The SWF contains placeholder regions named things like `slot_0`, `slot_1`, etc. When Iggy hits these regions during rendering, it calls back into C++ through `CustomDrawCallback`, which:

1. Sets up the OpenGL/Direct3D state
2. Uses `ItemRenderer` to draw the 3D item model at the correct position and scale
3. Restores the rendering state for Iggy to continue

This is how item icons appear in the hotbar, inventory, and crafting screens. The `customDrawSlotControl()` method handles all the math for positioning and scaling:

```cpp
void UIScene::_customDrawSlotControl(CustomDrawData *region, int iPad,
    shared_ptr<ItemInstance> item, float fAlpha, bool isFoil, bool bDecorations,
    bool usingCommandBuffer)
{
    float bwidth = region->x1 - region->x0;
    float bheight = region->y1 - region->y0;

    // Scale based on the 16x16 pixel base size of items
    float scaleX = bwidth / 16.0f;
    float scaleY = bheight / 16.0f;

    m_pItemRenderer->renderAndDecorateItem(
        pMinecraft->font, pMinecraft->textures, item,
        region->x0, region->y0, scaleX, scaleY,
        fAlpha, isFoil, false, !usingCommandBuffer);
}
```

Container scenes also support cached slot rendering. When `m_cacheSlotRenders` is true, the scene collects all slot draw calls and batches them together for better performance (important on Xbox One where command buffers are used).

## Legacy Screen system

### Screen base class

`Screen` extends `GuiComponent` and provides the foundation for menu screens:

```cpp
class Screen : public GuiComponent {
protected:
    Minecraft* minecraft;
    vector<Button*> buttons;
    Font* font;
public:
    int width, height;
    bool passEvents;
    GuiParticles* particles;

    virtual void init(Minecraft* minecraft, int width, int height);
    virtual void init();
    virtual void render(int xm, int ym, float a);
    virtual void tick();
    virtual void removed();
    virtual void updateEvents();
    virtual void mouseEvent();
    virtual void keyboardEvent();
    virtual void renderBackground();
    virtual bool isPauseScreen();
    virtual void confirmResult(bool result, int id);
    virtual void tabPressed();

protected:
    virtual void keyPressed(wchar_t eventCharacter, int eventKey);
    virtual void mouseClicked(int x, int y, int buttonNum);
    virtual void mouseReleased(int x, int y, int buttonNum);
    virtual void buttonClicked(Button* button);
};
```

The active screen is set via `Minecraft::setScreen(Screen*)`. When a screen is active, it gets input events and renders on top of the game world. Setting the screen to `NULL` returns to gameplay.

A couple of methods worth noting that aren't obvious from the main lifecycle:
- **`setSize(int width, int height)`** resizes the screen without a full reinit (calls `init()` internally to rebuild buttons)
- **`tabPressed()`** handles tab key navigation (used in multiplayer for player list)
- **`clickedButton`** is a private field that tracks which button is being held down for drag-release behavior. The base `mouseClicked` sets it, and `mouseReleased` fires `buttonClicked` only if the button is still under the cursor.

### GuiComponent

The base class for all GUI elements, with primitive drawing operations:

| Method | Purpose |
|---|---|
| `hLine(x0, x1, y, col)` | Draw a horizontal line |
| `vLine(x, y0, y1, col)` | Draw a vertical line |
| `fill(x0, y0, x1, y1, col)` | Fill a rectangle |
| `fillGradient(x0, y0, x1, y1, col1, col2)` | Fill with vertical gradient |
| `drawCenteredString(font, str, x, y, color)` | Draw centered text |
| `drawString(font, str, x, y, color)` | Draw left-aligned text |
| `blit(x, y, sx, sy, w, h)` | Copy a region from the bound texture |

### All Screen subclasses

#### Title and navigation

| Class | Purpose |
|---|---|
| `TitleScreen` | Main menu with logo and background panorama |
| `PauseScreen` | In-game pause menu |
| `OptionsScreen` | Graphics and game options |
| `VideoSettingsScreen` | Video/graphics settings |
| `ControlsScreen` | Key binding configuration |

#### World management

| Class | Purpose |
|---|---|
| `SelectWorldScreen` | World selection list |
| `CreateWorldScreen` | New world creation with seed/settings |
| `RenameWorldScreen` | Rename a saved world |

#### Multiplayer

| Class | Purpose |
|---|---|
| `JoinMultiplayerScreen` | Server browser / join menu |
| `ConnectScreen` | Connection progress display |
| `ReceivingLevelScreen` | "Downloading terrain" screen |
| `DisconnectedScreen` | Disconnection message display |

#### Gameplay

| Class | Purpose |
|---|---|
| `ChatScreen` | Text chat input |
| `InBedChatScreen` | Chat screen while sleeping in a bed |
| `DeathScreen` | "You died" screen with respawn option |
| `AchievementScreen` | Achievement viewer |
| `StatsScreen` | Statistics display |

#### Container/inventory

| Class | Purpose |
|---|---|
| `AbstractContainerScreen` | Base class for all container GUIs |
| `ContainerScreen` | Generic container (chest, etc.) |
| `InventoryScreen` | Player inventory |
| `CraftingScreen` | 3x3 crafting table |
| `FurnaceScreen` | Furnace smelting GUI |
| `TrapScreen` | Dispenser/dropper GUI |

#### Utility

| Class | Purpose |
|---|---|
| `ConfirmScreen` | Yes/no confirmation dialog |
| `ErrorScreen` | Error message display |
| `NameEntryScreen` | Player name entry |
| `TextEditScreen` | Sign text editing |

## Button system

### Button

The base button widget:

```cpp
class Button : public GuiComponent {
public:
    int x, y;
    int id;
    wstring msg;
    bool active;
    bool visible;

    Button(int id, int x, int y, const wstring& msg);
    Button(int id, int x, int y, int w, int h, const wstring& msg);

    virtual void render(Minecraft* minecraft, int xm, int ym);
    virtual bool clicked(Minecraft* minecraft, int mx, int my);
    virtual void released(int mx, int my);
protected:
    virtual int getYImage(bool hovered);
    virtual void renderBg(Minecraft* minecraft, int xm, int ym);
};
```

Default button size is figured out from the constructor (standard width buttons use a centered two-part texture blit). The `id` field identifies which button was clicked in `Screen::buttonClicked()`.

### Button subclasses

| Class | Purpose |
|---|---|
| `SlideButton` | Slider control for float options (volume, sensitivity, FOV). Tracks a `float value` and an `Options::Option*` reference. |
| `SmallButton` | Compact button (half-width or custom size) for toggle options. Holds an `Options::Option*` for the setting it controls. |

### EditBox

A text input field used in chat, world naming, and sign editing:

```cpp
class EditBox : public GuiComponent {
    wstring value;
    unsigned int maxLength;
    bool inFocus, active;

    void setValue(const wstring& value);
    wstring getValue();
    void tick();                              // cursor blink
    void keyPressed(wchar_t ch, int eventKey);
    void mouseClicked(int mouseX, int mouseY, int buttonNum);
    void render();
};
```

### ScrolledSelectionList

A scrollable list widget used for world selection and similar lists:

```cpp
class ScrolledSelectionList {
    virtual int getNumberOfItems() = 0;
    virtual void selectItem(int item, bool doubleClick) = 0;
    virtual bool isSelectedItem(int item) = 0;
    virtual void renderItem(int i, int x, int y, int h, Tesselator* t) = 0;
    virtual void renderBackground() = 0;

    void render(int xm, int ym, float a);
    int getItemAtPosition(int x, int y);
    void buttonClicked(Button* button);
};
```

Supports drag scrolling, keyboard navigation via up/down buttons, and double-click selection.

## HUD (Gui class)

The `Gui` class renders the heads-up display during gameplay:

```cpp
class Gui : public GuiComponent {
    void render(float a, bool mouseFree, int xMouse, int yMouse);
    void tick();
    void addMessage(const wstring& string, int iPad, bool bIsDeathMessage = false);
    void setNowPlaying(const wstring& string);
    void clearMessages(int iPad = -1);

    static float currentGuiBlendFactor;
    static float currentGuiScaleFactor;
};
```

### HUD elements

| Element | Method | Description |
|---|---|---|
| Hotbar | `renderSlot()` | Renders the 9-slot item bar |
| Chat | `addMessage()` / `getMessage()` | Per-player message queues with fade-out opacity |
| Music notification | `setNowPlaying()` | "Now Playing" overlay text |
| Pumpkin overlay | `renderPumpkin()` | Full-screen pumpkin blur when wearing carved pumpkin |
| Vignette | `renderVignette()` | Screen-edge darkening based on brightness |
| Debug graph | `renderGraph()` / `renderStackedGraph()` | Frame time and tick time performance graphs |

Chat messages are stored per player (`vector<GuiMessage> guiMessages[XUSER_MAX_COUNT]`) to support split-screen.

### AchievementPopup

A separate component that renders achievement toast notifications above the HUD:

```cpp
class AchievementPopup : public GuiComponent {
    void popup(Achievement *ach);     // show a timed achievement toast
    void permanent(Achievement *ach); // show a persistent helper popup
    void render();
};
```

It tracks a `startTime` to know when to fade out. `isHelper` controls whether it stays on screen permanently (used for tutorial-like prompts) vs timing out normally.

### ScreenSizeCalculator

`ScreenSizeCalculator` handles the scaling math for GUI elements across different display resolutions. It figures out the effective GUI dimensions based on the `guiScale` option (Auto, Small, Normal, Large) and the actual screen resolution.

## Console UI system (Common/UI/)

The console-native UI is a complete GUI framework that's separate from the legacy `Screen` system. It's built around three core abstractions: scenes, controls, and components. All of them are backed by SWF movies rendered through Iggy.

### Architecture overview

The UI is organized into a hierarchy:

```
UIController          -- top-level manager, owns everything
  UIGroup[N]          -- one per player slot (Player1-4) + one fullscreen
    UILayer[N]        -- layers within a group (HUD, Scene, Popup, Error, etc.)
      UIScene[N]      -- actual screens/menus, stored in a navigation stack
        UIControl[N]  -- widgets inside the scene (buttons, labels, slots)
```

The `UIController` handles:
- Loading and managing Iggy skin libraries
- Routing input to the correct scene based on which player pressed what
- Managing key repeat timing (300ms initial delay, 100ms repeat rate)
- Navigation between scenes
- Custom draw callbacks for 3D item rendering
- Texture substitution for dynamic images
- Tooltip management per player
- Font setup (bitmap fonts, TrueType fonts)

### UIGroup

A group maps to a viewport section. There's one per player in splitscreen, plus a fullscreen group for shared UI:

```cpp
enum EUIGroup
{
    eUIGroup_Fullscreen,
    eUIGroup_Player1,
    eUIGroup_Player2,
    eUIGroup_Player3,
    eUIGroup_Player4,
    eUIGroup_COUNT,
    eUIGroup_PAD,  // auto-detect group from pad number
};
```

Each group holds a set of layers and tracks things like viewport type, whether a menu is displayed, and per-player UI state.

### UILayer

Layers are stacked within a group. Lower enum values render on top (higher priority):

```cpp
enum EUILayer
{
    eUILayer_Debug,       // debug overlays (not in final builds)
    eUILayer_Tooltips,    // controller button prompts
    eUILayer_Error,       // error dialogs
    eUILayer_Alert,       // alert popups
    eUILayer_Fullscreen,  // fullscreen overlays (loading screens)
    eUILayer_Popup,       // popup menus
    eUILayer_Scene,       // main navigation stack (most menus live here)
    eUILayer_HUD,         // the in-game HUD (lowest priority, always behind menus)
    eUILayer_COUNT,
};
```

Each layer contains:
- A **scene stack** for navigable menus (push/pop navigation)
- A **components list** for persistent overlays that don't participate in navigation (like the panorama background, logo, chat)

### UIScene

The base class for all console UI screens. Each scene wraps an Iggy SWF movie and manages a collection of controls.

```cpp
class UIScene
{
    Iggy *swf;                           // the loaded SWF movie
    IggyValuePath *m_rootPath;           // root path for calling ActionScript
    vector<UIControl *> m_controls;      // all mapped controls
    UILayer *m_parentLayer;              // owning layer
    UIScene *m_backScene;                // previous scene for back navigation
    int m_iPad;                          // which player pad owns this scene
    bool bHasFocus;                      // whether this scene currently has input focus
    bool m_bVisible;                     // visibility state
    bool m_bCanHandleInput;              // true after first tick

    // Resolution tracking
    enum ESceneResolution { eSceneResolution_1080, eSceneResolution_720,
                            eSceneResolution_480, eSceneResolution_Vita };
    ESceneResolution m_loadedResolution;
    int m_movieWidth, m_movieHeight;
    int m_renderWidth, m_renderHeight;
};
```

#### Scene lifecycle

1. **Constructor** -- calls `initialiseMovie()` which loads the SWF, maps controls, and sets up safe zones
2. **`tick()`** -- called every frame while the scene exists. Ticks the Iggy player, updates timers, ticks controls
3. **`gainFocus()`** -- called when this scene becomes the top of the stack. Updates tooltips, calls `handleGainFocus()`
4. **`loseFocus()`** -- called when another scene is pushed on top
5. **`render()`** -- called to draw the scene. Sets the display size and calls `IggyPlayerDraw()`
6. **Destructor** -- destroys the Iggy player, unregisters textures

#### Element and name mapping macros

Scenes use macros to connect C++ control variables to named elements in the SWF:

```cpp
UI_BEGIN_MAP_ELEMENTS_AND_NAMES(UIScene)
    UI_MAP_ELEMENT(m_buttonPlay, "Button1")
    UI_MAP_ELEMENT(m_labelTitle, "TitleLabel")
    UI_MAP_NAME(m_funcDoSomething, L"DoSomething")
UI_END_MAP_ELEMENTS_AND_NAMES()
```

- `UI_MAP_ELEMENT(var, name)` -- links a `UIControl` member to a named element in the SWF. Calls `setupControl()` which finds the element by name in the Iggy object tree.
- `UI_MAP_NAME(var, name)` -- registers an ActionScript function name as a "fast name" for quick lookup when calling methods.
- `UI_BEGIN_MAP_CHILD_ELEMENTS(parent)` / `UI_END_MAP_CHILD_ELEMENTS()` -- scope child elements under a parent control (like mapping buttons inside a MainPanel).

#### Pure virtual methods

Every scene subclass must implement:
- `getMoviePath()` -- returns the base SWF filename (like `L"PauseMenu"`)
- `getSceneType()` -- returns the `EUIScene` enum value

#### Important virtual methods

| Method | Purpose |
|---|---|
| `handleInput(iPad, key, repeat, pressed, released, handled)` | Process controller input |
| `handlePress(controlId, childId)` | Button was pressed (callback from ActionScript) |
| `handleFocusChange(controlId, childId)` | Focus moved to a different control |
| `handleCheckboxToggled(controlId, selected)` | Checkbox was toggled |
| `handleSliderMove(sliderId, currentValue)` | Slider value changed |
| `handleAnimationEnd()` | An animation in the SWF finished |
| `handleSelectionChanged(selectedId)` | List selection changed |
| `handleRequestMoreData(startIndex, up)` | Scrolling list needs more data |
| `handleGainFocus(navBack)` | Scene gained focus (navBack is true if returning from a child) |
| `handleLoseFocus()` | Scene lost focus |
| `handleReload()` | SWF was reloaded (skin change) |
| `handleTimerComplete(id)` | A timer fired |
| `stealsFocus()` | Return false for overlay scenes (HUD, chat) that don't block input |
| `hidesLowerScenes()` | Return true if scenes below should be hidden when this is visible |

#### Timers

Scenes have a built-in timer system:

```cpp
void addTimer(int id, int ms);       // start a repeating timer
void killTimer(int id);              // stop a timer
void handleTimerComplete(int id);    // override to handle timer events
```

Timers auto-repeat. The HUD uses a 100ms timer to update chat message opacity. The creative menu uses timers for touch input debouncing on Vita.

#### Input handling

Controller input is translated from game actions to Iggy keycodes and dispatched to the SWF:

| Game Action | Iggy Keycode | Typical Use |
|---|---|---|
| `ACTION_MENU_A` | `IGGY_KEYCODE_ENTER` | Confirm/select |
| `ACTION_MENU_B` | `IGGY_KEYCODE_ESCAPE` | Cancel/back |
| `ACTION_MENU_X` | `IGGY_KEYCODE_F1` | Secondary action |
| `ACTION_MENU_Y` | `IGGY_KEYCODE_F2` | Tertiary action |
| `ACTION_MENU_UP/DOWN/LEFT/RIGHT` | Arrow keys | Navigation |
| `ACTION_MENU_PAGEUP/PAGEDOWN` | Page Up/Down | Shoulder buttons (LB/RB) |
| `ACTION_MENU_RIGHT_SCROLL` | `IGGY_KEYCODE_F3` | Right stick scroll |
| `ACTION_MENU_LEFT_SCROLL` | `IGGY_KEYCODE_F4` | Left stick scroll |

The SWF handles focus management internally. When a button is pressed, the SWF calls back via `handlePress(controlId, childId)`. The C++ scene then decides what to do (navigate, toggle a setting, etc.).

Key repeat is blocked for A/B/X/Y buttons to prevent accidental double-presses.

#### External callbacks (SWF to C++)

The SWF communicates back to C++ through external function calls. The `externalCallback()` method dispatches these:

| Callback Name | Arguments | Purpose |
|---|---|---|
| `handlePress` | `(controlId, childId)` | A button/control was activated |
| `handleFocusChange` | `(controlId, childId)` | Focus moved to a different control |
| `handleInitFocus` | `(controlId, childId)` | Initial focus was set |
| `handleCheckboxToggled` | `(controlId, selected)` | Checkbox state changed |
| `handleSliderMove` | `(sliderId, currentValue)` | Slider was moved |
| `handleAnimationEnd` | (none) | An animation completed |
| `handleSelectionChanged` | `(selectedId)` | Selected item in a list changed |
| `handleRequestMoreData` | `(startIndex, up)` | List needs more data for scrolling |
| `handleTouchBoxRebuild` | (none) | Touch regions need recalculating (Vita) |

### UIScene subclasses

#### Title, intro, and navigation

| Scene class | Purpose |
|---|---|
| `UIScene_MainMenu` | Main title menu (Play Game, Leaderboards, Achievements, Help & Options, DLC/Unlock, Exit) |
| `UIScene_Intro` | Game intro sequence |
| `UIScene_EULA` | End User License Agreement |
| `UIScene_PauseMenu` | In-game pause (Resume, Help & Options, Leaderboards, Achievements, Save, Exit) |
| `UIScene_HelpAndOptionsMenu` | Help and options hub |
| `UIScene_HowToPlay` | Individual How To Play page |
| `UIScene_HowToPlayMenu` | How To Play page selector |
| `UIScene_Credits` | Credits roll |
| `UIScene_EndPoem` | End poem text |

#### World management

| Scene class | Purpose |
|---|---|
| `UIScene_LoadOrJoinMenu` | Choose between loading a world or joining a game |
| `UIScene_LoadMenu` | World loading with save file list |
| `UIScene_CreateWorldMenu` | World creation (seed, game mode, world size) |
| `UIScene_LaunchMoreOptionsMenu` | Additional world options (PVP, fire spread, TNT, trust, structures, bonus chest, flat world) |
| `UIScene_JoinMenu` | Multiplayer join menu |

#### Settings

| Scene class | Purpose |
|---|---|
| `UIScene_SettingsMenu` | Settings hub |
| `UIScene_SettingsAudioMenu` | Audio settings (volume sliders) |
| `UIScene_SettingsControlMenu` | Control settings (sensitivity, invert) |
| `UIScene_SettingsGraphicsMenu` | Graphics settings |
| `UIScene_SettingsOptionsMenu` | Gameplay options |
| `UIScene_SettingsUIMenu` | UI settings (HUD size, opacity, tooltips) |
| `UIScene_ControlsMenu` | Control remapping |

#### In-game menus

| Scene class | Purpose |
|---|---|
| `UIScene_InGameHostOptionsMenu` | Host-only options (change game mode, time, weather) |
| `UIScene_InGamePlayerOptionsMenu` | Per-player options (mute, kick, promote) |
| `UIScene_InGameInfoMenu` | In-game info display |
| `UIScene_InGameSaveManagementMenu` | In-game save management |
| `UIScene_TeleportMenu` | Teleport to player list |

#### Container and inventory screens

| Scene class | Purpose |
|---|---|
| `UIScene_AbstractContainerMenu` | Base class for all container menus. Provides cursor/pointer navigation, slot rendering, item tooltip display, and drag-and-drop. |
| `UIScene_InventoryMenu` | Player inventory (armor slots, 2x2 crafting, inventory grid, hotbar) |
| `UIScene_CraftingMenu` | Crafting table (3x3 grid + result slot + inventory) |
| `UIScene_CreativeMenu` | Creative mode item picker (8 tabs, 10x5 grid, hotbar, scrollbar) |
| `UIScene_FurnaceMenu` | Furnace (ingredient, fuel, result slots) |
| `UIScene_ContainerMenu` | Generic container (single and double chests, ender chest) |
| `UIScene_DispenserMenu` | Dispenser/dropper (3x3 grid) |
| `UIScene_EnchantingMenu` | Enchanting table (item slot + 3 enchantment option buttons) |
| `UIScene_BrewingStandMenu` | Brewing stand (3 bottle slots + 1 ingredient slot) |
| `UIScene_AnvilMenu` | Anvil (2 input slots + result slot + name text input) |
| `UIScene_TradingMenu` | Villager trading (offer list + input/output slots) |

#### DLC and store

| Scene class | Purpose |
|---|---|
| `UIScene_DLCMainMenu` | DLC store main page |
| `UIScene_DLCOffersMenu` | DLC offer details |
| `UIScene_SkinSelectMenu` | Skin picker |
| `UIScene_TrialExitUpsell` | Trial version exit upsell prompt |

#### System and utility

| Scene class | Purpose |
|---|---|
| `UIScene_HUD` | Heads-up display overlay |
| `UIScene_DeathMenu` | Death screen with respawn button |
| `UIScene_SignEntryMenu` | Sign text editing |
| `UIScene_Keyboard` | On-screen keyboard |
| `UIScene_MessageBox` | Modal message dialogs |
| `UIScene_ConnectingProgress` | Connection progress indicator |
| `UIScene_FullscreenProgress` | Full-screen loading (with background, logo, tips) |
| `UIScene_QuadrantSignin` | Split-screen sign-in overlay |
| `UIScene_SaveMessage` | Save notification |
| `UIScene_Timer` | Timer overlay |
| `UIScene_ReinstallMenu` | Reinstall prompt |
| `UIScene_LeaderboardsMenu` | Leaderboards display |
| `UIScene_PartnernetPassword` | Partnernet password entry (enum value 0, Xbox devkit builds) |
| `UIScene_SocialPost` | Social media sharing prompt |
| `UIScene_NewUpdateMessage` | Title update notification |
| `UIScene_TextEntry` | Generic text entry (uses `UIScene_Keyboard` internally) |

#### Debug (non-final builds only)

| Scene class | Purpose |
|---|---|
| `UIScene_DebugOverlay` | Debug information overlay |
| `UIScene_DebugOptions` | Debug settings |
| `UIScene_DebugCreateSchematic` | Debug schematic creation |
| `UIScene_DebugSetCamera` | Debug camera placement |

### UIComponents

Components are persistent overlay scenes that live on a layer but don't participate in the navigation stack (no push/pop). They are shown and hidden directly through `UIController::showComponent()`.

| Component | Purpose |
|---|---|
| `UIComponent_TutorialPopup` | Tutorial hint popup with icon, title, and description. Manages fade timers and can shift the scene behind it to stay visible. |
| `UIComponent_Chat` | In-game chat overlay. Shows chat history and handles text input. |
| `UIComponent_Panorama` | Animated background panorama on the main menu screen. |
| `UIComponent_Logo` | The Minecraft logo component shown on the title screen. |
| `UIComponent_MenuBackground` | Dimmed background behind menus. |
| `UIComponent_PressStartToPlay` | "Press Start" prompt for each quadrant in splitscreen. |
| `UIComponent_Tooltips` | Controller button prompts at the bottom of the screen (A: Select, B: Back, etc.). Managed by the `UIController::SetTooltips()` API. |
| `UIComponent_DebugUIConsole` | Debug console for logging (non-final builds). |
| `UIComponent_DebugUIMarketingGuide` | Marketing screenshot guide overlay (non-final builds). |

Components all inherit from `UIScene` but override `stealsFocus()`, `hasFocus()`, and `hidesLowerScenes()` to return false, so they don't interfere with normal navigation.

### The HUD scene in detail

`UIScene_HUD` is the most important component. It renders the entire in-game heads-up display through an SWF movie. Here is what it manages:

| HUD element | ActionScript function | Notes |
|---|---|---|
| Hotbar | `SetActiveSlot(slot)` | Highlights the selected hotbar slot. Custom draw renders the 3D items. |
| Health | `SetHealth(health, lastHealth, blink, poison)` | Hearts display with blink and poison tint support |
| Food | `SetFood(food, lastFood, poison)` | Food bar with poison tint |
| Air | `SetAir(air)` | Bubble icons when underwater |
| Armor | `SetArmour(armour)` | Armor icons above health |
| Experience | `SetExpBarProgress(progress)`, `SetPlayerLevel(level)` | XP bar and level number |
| Boss health | `SetDragonHealth(health)`, `ShowDragonHealthBar(show)` | Ender Dragon health bar (auto-hides after no boss ticks) |
| Chat | 10 `UIControl_Label` elements (`Label1` through `Label10`) | Per-line chat with background controls for readability |
| Jukebox | `Jukebox` label | "Now Playing" notification text |
| Player name | `SetGamertag(name)` | Player display name in splitscreen |
| Regen effect | `SetRegenerationEffect(enabled)` | Visual indicator for regeneration |
| Saturation | `SetFoodSaturationLevel(level)` | Food saturation visual |

The HUD repositions itself based on UI scale using `RepositionHud()` and `LoadHud()` ActionScript calls. Tooltip visibility is controlled through `SetTooltipsEnabled()`.

### IUIScene interfaces

The `IUIScene_*` classes are shared interface classes that contain logic common between the XUI (Xbox 360) and Iggy implementations. They handle game logic that is the same regardless of which UI framework renders it.

| Interface | Purpose |
|---|---|
| `IUIScene_AbstractContainerMenu` | Pointer navigation, slot clicking, tooltip management, section-based layout for all container menus |
| `IUIScene_PauseMenu` | Shared pause menu logic |
| `IUIScene_CraftingMenu` | Crafting recipe logic |
| `IUIScene_CreativeMenu` | Creative inventory tab/page management, item category lists |
| `IUIScene_InventoryMenu` | Player inventory logic |
| `IUIScene_FurnaceMenu` | Furnace menu logic |
| `IUIScene_ContainerMenu` | Chest/container logic |
| `IUIScene_DispenserMenu` | Dispenser/dropper logic |
| `IUIScene_EnchantingMenu` | Enchanting table logic |
| `IUIScene_BrewingMenu` | Brewing stand logic |
| `IUIScene_AnvilMenu` | Anvil naming and combining logic |
| `IUIScene_TradingMenu` | Villager trading logic |
| `IUIScene_StartGame` | Game launch logic |

### UIControl

The base class for all widgets inside a scene. Each control maps to a named Flash element in the SWF.

```cpp
class UIControl
{
    enum eUIControlType
    {
        eNoControl, eButton, eButtonList, eCheckBox, eCursor, eDLCList,
        eDynamicLabel, eEnchantmentBook, eEnchantmentButton, eHTMLLabel,
        eLabel, eLeaderboardList, eMinecraftPlayer, ePlayerList,
        ePlayerSkinPreview, eProgress, eSaveList, eSlider, eSlotList,
        eTextInput, eTexturePackList, eBitmapIcon, eTouchControl,
    };

    eUIControlType m_eControlType;
    int m_id;
    IggyValuePath m_iggyPath;    // path to this element in the SWF object tree
    UIScene *m_parentScene;
    string m_controlName;

    S32 m_x, m_y, m_width, m_height;  // position and size from the SWF
    float m_lastOpacity;
    bool m_isVisible;

    virtual bool setupControl(UIScene *scene, IggyValuePath *parent, const string &controlName);
    void setOpacity(float percent);
    void setVisible(bool visible);
    S32 getXPos();
    S32 getYPos();
    S32 getWidth();
    S32 getHeight();
};
```

Controls are connected to Flash elements using `UI_MAP_ELEMENT(var, "flashName")` in the scene's element mapping. The `setupControl()` call navigates the Iggy object tree to find the named element and caches its path for fast property access.

#### UIControl_Base

Extends `UIControl` with label support. Maps to the `FJ_Base` class in ActionScript. Most controls inherit from this.

```cpp
class UIControl_Base : public UIControl
{
    void setLabel(const wstring &label, bool instant = false, bool force = false);
    const wchar_t* getLabel();
    virtual void setAllPossibleLabels(int labelCount, wchar_t labels[][256]);
};
```

The `setAllPossibleLabels` method is used to pre-calculate text widths so the Flash layout can size itself correctly for the widest possible label (important for localization).

### All UIControl types

#### UIControl_Button

A standard clickable button with enable/disable support.

```cpp
class UIControl_Button : public UIControl_Base
{
    void init(const wstring &label, int id);
    void setEnable(bool enable);
};
```

Buttons are initialized with a label string and a numeric ID. When pressed, the SWF fires `handlePress(id, childId)` back to C++. The scene's `handlePress()` override decides what to do based on the ID.

#### UIControl_ButtonList

A scrollable vertical list of buttons.

```cpp
class UIControl_ButtonList : public UIControl_Base
{
    void init(int id);
    void clearList();
    void addItem(const wstring &label);
    void addItem(const wstring &label, int data);
    void removeItem(int index);
    int getItemCount();
    void setCurrentSelection(int iSelection);
    int getCurrentSelection();
    void updateChildFocus(int iChild);
    void setButtonLabel(int iButtonId, const wstring &label);
};
```

Used for save file lists, player lists, leaderboard entries, and similar scrolling menus.

#### UIControl_CheckBox

A toggle checkbox with checked/enabled state.

```cpp
class UIControl_CheckBox : public UIControl_Base
{
    void init(const wstring &label, int id, bool checked);
    bool IsChecked();
    bool IsEnabled();
    void SetEnable(bool enable);
    void setChecked(bool checked);
};
```

When toggled, the SWF fires `handleCheckboxToggled(controlId, selected)`. Used in settings screens for boolean options like "PVP", "Fire Spreads", "TNT Explodes".

#### UIControl_Slider

A value slider with min/max range.

```cpp
class UIControl_Slider : public UIControl_Base
{
    void init(const wstring &label, int id, int min, int max, int current);
    void handleSliderMove(int newValue);
};
```

When moved, the SWF fires `handleSliderMove(sliderId, currentValue)`. Used for volume, sensitivity, FOV, and brightness settings. On Vita, sliders support touch input positioning via `SetSliderTouchPos()`.

#### UIControl_Label

Static text display.

```cpp
class UIControl_Label : public UIControl_Base
{
    void init(const wstring &label);
    void init(const string &label);
};
```

Used everywhere: menu titles, inventory labels, chat messages, player names, jukebox "Now Playing" text.

#### UIControl_DynamicLabel

Text that gets updated frequently. Same interface as Label but optimized for frequent changes.

#### UIControl_HTMLLabel

Rich text label that supports HTML color codes and auto-scrolling. Used for the credits text, How To Play pages, and other long-form content.

```cpp
class UIControl_HTMLLabel : public UIControl_Label
{
    void startAutoScroll();
    void setLabel(const string &label);  // accepts HTML markup
    void TouchScroll(S32 iY, bool bActive);
    S32 GetRealWidth();
    S32 GetRealHeight();
};
```

#### UIControl_TextInput

A text entry field.

```cpp
class UIControl_TextInput : public UIControl_Base
{
    void init(const wstring &label, int id);
    void setFocus(bool focus);
    void SetCharLimit(int iLimit);
};
```

Used in the sign entry menu, anvil naming, and world seed entry. Text input on consoles typically opens an on-screen keyboard (`UIScene_Keyboard`).

#### UIControl_SlotList

An item slot grid for inventory screens.

```cpp
class UIControl_SlotList : public UIControl_Base
{
    void addSlot(int id);
    void addSlots(int iStartValue, int iCount);
    void setHighlightSlot(int index);
    void showSlotRedBox(int index, bool show);
};
```

Slot lists define regions in the SWF where 3D item icons are rendered via custom draw callbacks. The `addSlot()` call tells the SWF to create a slot placeholder at a specific index. `setHighlightSlot()` moves the selection highlight, and `showSlotRedBox()` shows a red outline (used for invalid placement warnings).

#### UIControl_Cursor

The pointer/cursor that floats over container menus.

```cpp
class UIControl_Cursor : public UIControl_Base {};
```

The cursor is moved by the analog stick. Its position is tracked in `IUIScene_AbstractContainerMenu::m_pointerPos` and updated every tick via `onMouseTick()`.

#### UIControl_Progress

A progress bar.

```cpp
class UIControl_Progress : public UIControl_Base
{
    void init(const wstring &label, int id, int min, int max, int current);
    void setProgress(int current);
    void showBar(bool show);
};
```

Used in loading screens and connection progress displays.

#### UIControl_BitmapIcon

Displays a static image/bitmap.

#### UIControl_PlayerSkinPreview

Renders a 3D preview of a player skin. Used in the skin select menu.

#### UIControl_MinecraftPlayer

Renders a full 3D player model. Used for player previews.

#### UIControl_EnchantmentBook

The animated enchanting book that opens/closes in the enchanting menu.

#### UIControl_EnchantmentButton

An enchantment option button (shows the enchantment name, level, and cost).

#### UIControl_SpaceIndicatorBar

Shows storage space usage. Used in the save management screen.

#### UIControl_SaveList, UIControl_DLCList, UIControl_TexturePackList, UIControl_PlayerList, UIControl_LeaderboardList

Specialized list controls for their respective content types. Each extends `UIControl_Base` with domain-specific add/remove/update methods.

#### UIControl_Touch

Touch input region for PS Vita. Defines a rectangular area that responds to touch events.

### UIComponent classes

Components are persistent UI overlays that don't participate in the navigation stack. They live in a layer and can be shown/hidden independently.

| Component class | Purpose |
|---|---|
| `UIComponent_Chat` | Chat message display with per-player message queues and fade-out opacity |
| `UIComponent_Logo` | Minecraft logo displayed during menus |
| `UIComponent_MenuBackground` | Animated dirt/stone background behind menus |
| `UIComponent_Panorama` | Title screen panorama with day/night switching |
| `UIComponent_PressStartToPlay` | "Press Start" prompt on the title screen |
| `UIComponent_Tooltips` | Controller button prompt bar at the bottom of menus |
| `UIComponent_TutorialPopup` | Tutorial message popups with item icons |
| `UIComponent_DebugUIConsole` | Debug output console (non-final builds) |
| `UIComponent_DebugUIMarketingGuide` | Marketing guide overlay (non-final builds) |

Components are managed through `UIController::showComponent()` / `removeComponent()`. They extend `UIScene` but override `stealsFocus()` to return `false` so they never block input from the main navigation stack.

### Screen navigation

Navigation uses a stack-based system managed by `UIController`:

```cpp
// Navigate forward to a new scene
ui.NavigateToScene(iPad, eUIScene_PauseMenu, initData, eUILayer_Scene, eUIGroup_PAD);

// Navigate back (pops the top scene)
ui.NavigateBack(iPad);

// Close all scenes for a player
ui.CloseUIScenes(iPad);

// Go back to the home menu
ui.NavigateToHomeMenu();
```

When navigating forward:
1. The current top scene loses focus (`loseFocus()`)
2. A new scene is created and pushed onto the layer's scene stack
3. The new scene's back pointer is set to the previous scene
4. The new scene gains focus (`gainFocus()`)

When navigating back:
1. The top scene is removed from the stack and queued for deletion
2. The previous scene regains focus
3. A "back" sound effect plays (`eSFX_Back`)

The `NavigateToScene()` function takes an `EUIScene` enum and creates the appropriate scene subclass. Each scene type has `initData` structs defined in `UIStructs.h` that pass initialization parameters. For example, opening a furnace menu requires a `FurnaceScreenInput` with the player's inventory and furnace tile entity.

### Scene initialization data structs

When navigating to a scene, you pass an `initData` pointer. Here are the common ones:

| Struct | Used by | Fields |
|---|---|---|
| `InventoryScreenInput` | Inventory, Creative | `player`, `bNavigateBack`, `iPad`, `bSplitscreen` |
| `ContainerScreenInput` | Container (chest) | `inventory`, `container`, `iPad`, `bSplitscreen` |
| `FurnaceScreenInput` | Furnace | `inventory`, `furnace`, `iPad`, `bSplitscreen` |
| `CraftingPanelScreenInput` | Crafting | `player`, `iContainerType` (2x2 or 3x3), `iPad`, `bSplitscreen`, `x`, `y`, `z` |
| `BrewingScreenInput` | Brewing Stand | `inventory`, `brewingStand`, `iPad`, `bSplitscreen` |
| `EnchantingScreenInput` | Enchanting | `inventory`, `level`, `x`, `y`, `z`, `iPad`, `bSplitscreen` |
| `AnvilScreenInput` | Anvil | `inventory`, `level`, `x`, `y`, `z`, `iPad`, `bSplitscreen` |
| `TradingScreenInput` | Trading | `inventory`, `trader`, `level`, `iPad`, `bSplitscreen` |
| `TrapScreenInput` | Dispenser | `inventory`, `trap`, `iPad`, `bSplitscreen` |
| `SignEntryScreenInput` | Sign | `sign`, `iPad` |
| `ConnectionProgressParams` | Connecting | `iPad`, `stringId`, `showTooltips`, `cancelFunc` |
| `CreateWorldMenuInitData` | Create World | `bOnline`, `bIsPrivate`, `iPad` |
| `LoadMenuInitData` | Load World | `iPad`, `iSaveGameInfoIndex`, `levelGen`, `saveDetails` |

## How the HUD works

The HUD (`UIScene_HUD`) is a component that lives on the `eUILayer_HUD` layer. It never steals focus and never hides lower scenes. It gets updated every game tick via `handleGameTick()`.

### HUD SWF selection

The HUD uses different SWF files depending on the viewport:
- **Fullscreen**: `HUD1080.swf` (or `HUD720.swf`, `HUD480.swf`)
- **Splitscreen**: `HUDSplit1080.swf` (or `HUDSplit720.swf`, etc.)

### HUD elements and how they update

All HUD elements are driven by calling ActionScript functions on the SWF:

| Element | ActionScript Function | What it does |
|---|---|---|
| Hotbar highlight | `SetActiveSlot(slot)` | Moves the selection box to the active hotbar slot |
| Hotbar items | Custom draw regions `slot_0` through `slot_8` | 3D item icons rendered via `customDraw()` |
| Health hearts | `SetHealth(maxHealth, blink, poison)` | Sets heart count, blink state, poison color |
| Food shanks | `SetFood(food, poison)` | Sets food bar level, hunger effect |
| Armor icons | `SetArmour(armor)` | Sets armor icon count |
| Air bubbles | `SetAir(count)` | Sets bubble count (shown when underwater) |
| XP bar | `SetExpBarProgress(progress)` | Sets experience bar fill (0.0 to 1.0) |
| XP level | `SetPlayerLevel(level)` | Shows the level number above the XP bar |
| Boss health | `SetDragonHealth(health)` | Ender Dragon health bar (0.0 to 1.0) |
| Boss label | `SetDragonLabel(label)` | Label text for the boss bar |
| Selected item name | `SetSelectedLabel(label)` | Shows item name when switching hotbar slots |
| Chat messages | Labels `Label1` through `Label10` | Up to 10 chat lines with per-line opacity fade |
| Jukebox text | `Jukebox` label | "Now Playing" music notification |
| Player name | `SetGamertag(name)` | Gamertag display |
| HUD size | `LoadHud(scale)` | Resizes the entire HUD (small/medium/large) |
| Safe zone | `SetSafeZone(top, bottom, left, right)` | Adjusts for TV overscan |
| Tooltips | `SetTooltipsEnabled(enabled)` | Shows/hides controller button prompts |

### HUD visibility rules

The HUD is visible when all of these are true:
- The game has started
- No menu is displayed for this player
- The player isn't doing an autosave thumbnail capture
- The "Display HUD" setting is on

### HUD opacity

The HUD supports an "Interface Opacity" setting (0-100%). When opacity is below 80%, the HUD fades to the set opacity but temporarily bumps to 80% when the player interacts (switching hotbar slots, taking damage). This opacity timer fades back down over 10 ticks.

### Splitscreen HUD rendering

In splitscreen, the HUD uses tile rendering to show only the relevant portion of the SWF for each viewport:

```cpp
IggyPlayerDrawTilesStart(getMovie());
IggyPlayerDrawTile(getMovie(), tileXStart, tileYStart,
                   tileXStart + tileWidth, tileYStart + tileHeight, 0);
IggyPlayerDrawTilesEnd(getMovie());
```

This clips the HUD to each player's viewport section. The `repositionHud()` function adjusts element positions based on the viewport dimensions.

## How container screens work

Container screens are the most complex part of the UI. They handle item grid display, pointer navigation, pick-up/place/drop interactions, and tooltips.

### The inheritance chain

```
UIScene
  UIScene_AbstractContainerMenu    -- base Iggy scene with shared controls
    UIScene_InventoryMenu          -- player inventory
    UIScene_CraftingMenu           -- crafting table
    UIScene_CreativeMenu           -- creative item picker
    UIScene_FurnaceMenu            -- furnace
    UIScene_ContainerMenu          -- chests
    UIScene_DispenserMenu          -- dispenser/dropper
    UIScene_EnchantingMenu         -- enchanting table
    UIScene_BrewingStandMenu       -- brewing stand
    UIScene_AnvilMenu              -- anvil
    UIScene_TradingMenu            -- villager trading
```

And the shared game logic interfaces:
```
IUIScene_AbstractContainerMenu     -- pointer/cursor logic, tooltips, sections
  IUIScene_InventoryMenu           -- inventory-specific logic
  IUIScene_CraftingMenu            -- crafting-specific logic
  IUIScene_CreativeMenu            -- creative tab/page logic
  IUIScene_FurnaceMenu             -- furnace-specific logic
  ... etc.
```

### Sections

Container menus are divided into "sections" which are rectangular regions containing item slots. Each menu type defines its own sections:

| Menu | Sections |
|---|---|
| Container (chest) | Using (hotbar), Inventory (main), Chest (chest grid) |
| Furnace | Using (hotbar), Inventory (main), Ingredient, Fuel, Result |
| Inventory | Using (hotbar), Inventory (main), Armor (4 armor slots) |
| Creative | Using (hotbar), Selector (10x5 item grid), Tab_0 through Tab_7, Slider |
| Enchanting | Using, Inventory, Slot (item slot), Button1/2/3 (enchant options) |
| Brewing | Using, Inventory, Bottle1/2/3, Ingredient |
| Anvil | Using, Inventory, Item1, Item2, Result, Name (text input) |

### Pointer/cursor navigation

Container menus use an analog stick-driven cursor instead of D-pad grid navigation. The cursor floats freely over the menu panel:

- **Speed**: 13.0 pixels per tick (`POINTER_SPEED_FACTOR`)
- **Tap detection**: Quick D-pad taps jump the cursor one slot in that direction (after 7 ticks, it switches to continuous movement)
- **Bounds**: The cursor is clamped to the menu panel bounds, but can go slightly outside to trigger item dropping
- **Section tracking**: The system tracks which section and slot the cursor is over based on position

### Slot rendering

Each slot in a container is rendered as a custom draw region in the SWF. When the Iggy renderer hits a slot region, it calls back into C++ to render the 3D item:

1. The SWF slot placeholder fires the custom draw callback
2. C++ looks up the `ItemInstance` for that slot from the `AbstractContainerMenu`
3. `ItemRenderer::renderAndDecorateItem()` draws the item icon at the slot position
4. `ItemRenderer::renderGuiItemDecorations()` draws stack count, durability bar, and enchantment glint

### Tooltips

Container menus dynamically update controller button tooltips based on what the cursor is over:

| Button | Context | Tooltip |
|---|---|---|
| A | Over item, nothing carried | "Pick Up" |
| A | Over empty slot, carrying item | "Place" |
| X | Furnace, over item | "Quick Move Ingredient/Fuel" |
| Y | Over item, nothing carried | "Pick Up All" |
| Y | Over stackable, carrying same | "Place All" |
| RT | Over any item | "What Is This?" |
| B | Always | "Exit" |

## How the creative inventory works

The creative menu (`UIScene_CreativeMenu`) extends the container system with tabbed browsing and paging.

### Tabs

There are 8 tabs, each containing a curated list of items:

| Tab | Description |
|---|---|
| Building Blocks | Stone, wood, bricks, slabs, stairs |
| Decorations | Flowers, torches, wool, paintings, signs |
| Redstone & Transport | Redstone components, rails, minecarts |
| Materials | Raw materials, dyes, ingots |
| Food | All food items |
| Tools, Weapons & Armor | All equipment plus enchanted books |
| Brewing | Brewing ingredients and all potion variants |
| Miscellaneous | Chests, crafting tables, spawn eggs, music discs |

Tabs are switched with LB/RB (shoulder buttons). The Brewing tab has a secondary cycle (LT) to toggle between potion strength tiers.

### Grid layout

The item grid is 10 columns by 5 rows (50 items per page). If a tab has more than 50 items, pages are added. Pages are scrolled with the right stick (up/down) or the scrollbar on the right side.

### Item picking

In the creative menu, clicking an item in the grid picks up a copy. If you hold the quick key (Y), it picks up a full stack. Items are placed on the hotbar below. The system tries to stack with existing items first, then finds an empty slot.

Pressing X on the hotbar clears all hotbar slots. Clicking outside the menu panel drops carried items.

## Splitscreen UI

LCE supports up to 4 players in splitscreen. The UI system handles this through:

### Viewport types

```cpp
enum eViewportType
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
};
```

### Per-player UI groups

Each player gets their own `UIGroup` with independent layer stacks. Player 1 can have the pause menu open while Player 2 is in their inventory.

### Safe zones

Safe zones are adjusted per-viewport to account for TV overscan. Edge viewports only apply safe zone padding on their outer edges:
- Top-left quadrant: safe zone on top and left only
- Bottom-right quadrant: safe zone on bottom and right only
- Full screen: safe zone on all edges

The safe zone is typically 10% (90% safe area) in HD, or 15% in non-HD widescreen.

### Split-specific SWF variants

Some scenes load different SWF files in splitscreen. The creative menu loads `CreativeMenuSplit` instead of `CreativeMenu`. The HUD loads `HUDSplit` instead of `HUD`. These smaller variants are designed to fit in the reduced viewport space.

### Large container variant

Chests use `eUIScene_LargeContainerMenu` in splitscreen to use a more compact layout that fits in the smaller viewport.

## Font rendering

### Legacy Font class

The `Font` class handles text rendering using a bitmap font atlas:

```cpp
class Font {
    void draw(const wstring& str, int x, int y, int color);
    void drawShadow(const wstring& str, int x, int y, int color);
    void drawWordWrap(const wstring& str, int x, int y, int w, int col, int h);
    int width(const wstring& str);
    wstring sanitize(const wstring& str);
    bool AllCharactersValid(const wstring& str);
};
```

The font supports:
- 32 formatting colors (16 light + 16 dark shadow variants)
- Unicode character sheets
- Bidirectional text reordering
- Word wrapping with configurable line height
- Multiple character set maps (European, Korean, Japanese, Chinese)

Two font instances exist: `font` (default) and `altFont` (alternate character set), both held by the `Minecraft` class.

### Console UI fonts

The console UI uses its own font system through Iggy:

| Class | Purpose |
|---|---|
| `UIAbstractBitmapFont` | Base class with Iggy bitmap font provider callbacks |
| `UIBitmapFont` | Bitmap font rendering using glyph atlases. Provides metrics, kerning, and bitmap generation callbacks to Iggy. |
| `UITTFFont` | TrueType font rendering. Loads a TTF file and registers it with Iggy for scalable text. |
| `UIFontData` | Font metrics and glyph data storage |

The controller sets up the Minecraft bitmap font (`m_mcBitmapFont`) and two "mojangles" bitmap fonts (`m_moj7`, `m_moj11`) at different sizes, plus a TrueType font (`m_mcTTFFont`) for the Flash UI.

## ScreenSizeCalculator

Computes screen dimensions accounting for console safe zones and split-screen layouts. Used by both the legacy screen system and the console UI.

## MinecraftConsoles differences

MinecraftConsoles adds a bunch of new screens and UI scenes for features that don't exist in LCEMP:

### New UIScene classes

| Scene class | Purpose |
|---|---|
| `UIScene_BeaconMenu` | Beacon block configuration (power selection, payment slot) |
| `UIScene_FireworksMenu` | Firework rocket crafting UI |
| `UIScene_HopperMenu` | Hopper inventory (5-slot single-row container) |
| `UIScene_HorseInventoryMenu` | Horse/donkey/mule inventory (saddle, armor, and chest slots) |
| `UIScene_LanguageSelector` | In-game language selection (LCEMP handles this differently) |
| `UIScene_NewUpdateMessage` | Title update notification screen |

### New UIScene interfaces

| Interface | Purpose |
|---|---|
| `IUIScene_BeaconMenu` | Interface for beacon menu scene |
| `IUIScene_CommandBlockMenu` | Interface for command block editing scene |
| `IUIScene_FireworksMenu` | Interface for fireworks crafting scene |
| `IUIScene_HopperMenu` | Interface for hopper menu scene |
| `IUIScene_HorseInventoryMenu` | Interface for horse inventory scene |
| `IUIScene_HUD` | Dedicated interface for the HUD (split from the generic scene system) |

### XUI scene additions

The Xbox XUI scene layout files expand significantly with `_480` (SD resolution) and `_small` (split-screen) variants for the new menus: `xuiscene_beacon`, `xuiscene_fireworks`, `xuiscene_hopper`, `xuiscene_horse`, plus `xuiscene_debug_item_editor` for a debug item editing screen.
