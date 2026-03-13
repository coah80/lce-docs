---
title: "Screens & GUI"
description: "GUI screen system in LCEMP."
---

LCEMP has two GUI layers: the legacy Java-style `Screen` system (used for basic menus) and the console-native `UIScene` system (in `Common/UI/`) for the actual in-game console UI. Both systems exist side by side, with the console UI handling most player-facing menus.

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

A separate component that renders achievement toast notifications above the HUD.

## Console UI system (Common/UI/)

The console-native UI is a complete GUI framework that's separate from the legacy `Screen` system. It's built around three core abstractions:

### UIScene

The scene is the equivalent of a `Screen`, basically a full menu or overlay. Each scene has UI controls and handles input:

| Scene class | Purpose |
|---|---|
| `UIScene_MainMenu` | Main title menu |
| `UIScene_PauseMenu` | In-game pause |
| `UIScene_HUD` | Heads-up display overlay |
| `UIScene_LoadMenu` / `UIScene_LoadOrJoinMenu` | World loading |
| `UIScene_CreateWorldMenu` | World creation |
| `UIScene_JoinMenu` | Multiplayer join |
| `UIScene_SettingsMenu` | Settings hub |
| `UIScene_SettingsAudioMenu` | Audio settings |
| `UIScene_SettingsControlMenu` | Control settings |
| `UIScene_SettingsGraphicsMenu` | Graphics settings |
| `UIScene_SettingsOptionsMenu` | Gameplay options |
| `UIScene_SettingsUIMenu` | UI settings |
| `UIScene_InventoryMenu` | Player inventory |
| `UIScene_CraftingMenu` | Crafting |
| `UIScene_CreativeMenu` | Creative mode inventory |
| `UIScene_FurnaceMenu` | Furnace |
| `UIScene_BrewingStandMenu` | Brewing stand |
| `UIScene_ContainerMenu` | Generic container |
| `UIScene_DispenserMenu` | Dispenser |
| `UIScene_EnchantingMenu` | Enchanting table |
| `UIScene_AnvilMenu` | Anvil |
| `UIScene_TradingMenu` | Villager trading |
| `UIScene_SignEntryMenu` | Sign editing |
| `UIScene_AbstractContainerMenu` | Base class for container menus |
| `UIScene_DeathMenu` | Death screen |
| `UIScene_Credits` | Credits roll |
| `UIScene_EndPoem` | End poem text |
| `UIScene_DLCMainMenu` / `UIScene_DLCOffersMenu` | DLC store |
| `UIScene_SkinSelectMenu` | Skin picker |
| `UIScene_LeaderboardsMenu` | Leaderboards |
| `UIScene_HowToPlay` / `UIScene_HowToPlayMenu` | Help screens |
| `UIScene_HelpAndOptionsMenu` | Help and options hub |
| `UIScene_InGameHostOptionsMenu` | In-game host options |
| `UIScene_InGameInfoMenu` | In-game info display |
| `UIScene_InGamePlayerOptionsMenu` | In-game player options |
| `UIScene_InGameSaveManagementMenu` | In-game save management |
| `UIScene_Intro` | Game intro sequence |
| `UIScene_EULA` | End User License Agreement |
| `UIScene_ControlsMenu` | Control remapping |
| `UIScene_LaunchMoreOptionsMenu` | Additional world launch options |
| `UIScene_Keyboard` | On-screen keyboard |
| `UIScene_TeleportMenu` | Teleport player list |
| `UIScene_MessageBox` | Modal message dialogs |
| `UIScene_ConnectingProgress` | Connection progress |
| `UIScene_FullscreenProgress` | Full-screen loading |
| `UIScene_QuadrantSignin` | Split-screen sign-in |
| `UIScene_Timer` | Timer overlay |
| `UIScene_DebugOverlay` | Debug information overlay |
| `UIScene_DebugOptions` | Debug settings |
| `UIScene_DebugCreateSchematic` | Debug schematic creation |
| `UIScene_DebugSetCamera` | Debug camera placement |
| `UIScene_ReinstallMenu` | Reinstall prompt |
| `UIScene_SaveMessage` | Save notification |
| `UIScene_TrialExitUpsell` | Trial exit upsell prompt |

### UIControl

Controls are the individual widgets inside scenes:

| Control class | Purpose |
|---|---|
| `UIControl_Button` | Standard button |
| `UIControl_ButtonList` | Scrollable button list |
| `UIControl_CheckBox` | Toggle checkbox |
| `UIControl_Slider` | Value slider |
| `UIControl_Label` | Static text |
| `UIControl_DynamicLabel` | Text that updates dynamically |
| `UIControl_HTMLLabel` | Rich text with color codes |
| `UIControl_TextInput` | Text entry field |
| `UIControl_BitmapIcon` | Image display |
| `UIControl_Cursor` | Cursor rendering |
| `UIControl_Progress` | Progress bar |
| `UIControl_SlotList` | Item slot grid |
| `UIControl_SaveList` | Save file list |
| `UIControl_DLCList` | DLC content list |
| `UIControl_TexturePackList` | Texture pack list |
| `UIControl_PlayerList` | Player list |
| `UIControl_LeaderboardList` | Leaderboard entries |
| `UIControl_PlayerSkinPreview` | 3D skin preview |
| `UIControl_MinecraftPlayer` | 3D player model display |
| `UIControl_EnchantmentBook` | Animated enchanting book |
| `UIControl_EnchantmentButton` | Enchantment option button |
| `UIControl_SpaceIndicatorBar` | Storage space indicator |
| `UIControl_Touch` | Touch input region |

### UIComponent

Reusable visual components that scenes can embed:

| Component class | Purpose |
|---|---|
| `UIComponent_Chat` | Chat message display |
| `UIComponent_Logo` | Minecraft logo |
| `UIComponent_MenuBackground` | Animated background |
| `UIComponent_Panorama` | Title screen panorama |
| `UIComponent_PressStartToPlay` | "Press Start" prompt |
| `UIComponent_Tooltips` | Tooltip rendering |
| `UIComponent_TutorialPopup` | Tutorial message popups |
| `UIComponent_DebugUIConsole` | Debug output console |
| `UIComponent_DebugUIMarketingGuide` | Marketing guide overlay |

### Supporting classes

| Class | Purpose |
|---|---|
| `UILayer` | Layer management for z-ordering |
| `UIGroup` | Groups of controls |
| `UIController` | Input routing and scene management |
| `IUIController` | Interface for UI controller |
| `UIBitmapFont` | Bitmap font rendering |
| `UITTFFont` | TrueType font rendering |
| `UIFontData` | Font metrics and glyph data |
| `UIEnums` | UI enumeration constants |
| `UIStructs` | Shared data structures for UI |

## Font rendering

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

## ScreenSizeCalculator

Computes screen dimensions accounting for console safe zones and split-screen layouts. Used by both the legacy screen system and the console UI.
