---
title: "Screens & GUI"
description: "GUI screen system in LCEMP."
---

LCEMP has two GUI systems: a legacy Java-style `Screen` hierarchy used for basic menus, and a console-native `UIScene` system (in `Common/UI/`) that handles the full menu experience on console platforms. The `Gui` class renders the in-game HUD.

## Screen base class

`Screen` extends `GuiComponent` and provides the foundation for all menu screens:

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

    virtual void render(int xm, int ym, float a);
    virtual void init(Minecraft* minecraft, int width, int height);
    virtual void init();
    virtual void tick();
    virtual void removed();
    virtual void updateEvents();
    virtual void mouseEvent();
    virtual void keyboardEvent();
    virtual void renderBackground();
    virtual void renderDirtBackground(int vo);
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

The lifecycle is: `init()` builds the button layout, `tick()` updates per-tick state, `render()` draws each frame, and `removed()` cleans up. Button clicks flow through `mouseClicked()` -> find clicked button -> `buttonClicked()`.

`Minecraft::setScreen(Screen*)` switches the active screen. Passing `nullptr` returns to gameplay.

## GuiComponent

The base drawing primitive class for all GUI elements:

```cpp
class GuiComponent {
protected:
    float blitOffset;

    void hLine(int x0, int x1, int y, int col);
    void vLine(int x, int y0, int y1, int col);
    void fill(int x0, int y0, int x1, int y1, int col);
    void fillGradient(int x0, int y0, int x1, int y1, int col1, int col2);

public:
    void drawCenteredString(Font* font, const wstring& str, int x, int y, int color);
    void drawString(Font* font, const wstring& str, int x, int y, int color);
    void blit(int x, int y, int sx, int sy, int w, int h);
};
```

## Button system

### Button

The base button class:

```cpp
class Button : public GuiComponent {
public:
    int x, y;
    wstring msg;
    int id;
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

### Button variants

| Class | Purpose |
|---|---|
| `SmallButton` | Smaller button, optionally linked to an `Options::Option` |
| `SlideButton` | Slider control for float values (volume, sensitivity, etc.) |

`SlideButton` tracks a `float value` and `bool sliding` state. When clicked, it enters slide mode and maps the mouse X position to a 0.0-1.0 range.

### EditBox

A text input field:

```cpp
class EditBox : public GuiComponent {
    wstring value;
    unsigned int maxLength;
    bool inFocus;
    bool active;

    void setValue(const wstring& value);
    wstring getValue();
    void keyPressed(wchar_t ch, int eventKey);
    void mouseClicked(int mouseX, int mouseY, int buttonNum);
    void render();
};
```

### ScrolledSelectionList

A scrollable list widget for screen subclasses:

```cpp
class ScrolledSelectionList {
    virtual int getNumberOfItems() = 0;
    virtual void selectItem(int item, bool doubleClick) = 0;
    virtual bool isSelectedItem(int item) = 0;
    virtual void renderItem(int i, int x, int y, int h, Tesselator* t) = 0;
    void render(int xm, int ym, float a);
};
```

Supports drag scrolling, up/down button navigation, and double-click selection.

## All Screen subclasses

### Main menu and navigation

| Class | Description |
|---|---|
| `TitleScreen` | Main title screen |
| `SelectWorldScreen` | World selection list |
| `CreateWorldScreen` | New world creation form |
| `RenameWorldScreen` | Rename an existing world |
| `JoinMultiplayerScreen` | Multiplayer server browser |
| `ConnectScreen` | Connection progress display |
| `ReceivingLevelScreen` | Downloading world data |
| `DisconnectedScreen` | Disconnection message |
| `ErrorScreen` | Error display |

### In-game screens

| Class | Description |
|---|---|
| `PauseScreen` | Pause menu (resume, save, quit) |
| `ChatScreen` | Chat input |
| `InBedChatScreen` | Chat while in bed (with "Leave Bed" button) |
| `DeathScreen` | Death screen (respawn, title screen) |
| `AchievementScreen` | Achievement list |
| `StatsScreen` | Statistics display |

### Container/inventory screens

| Class | Description |
|---|---|
| `AbstractContainerScreen` | Base for all container GUIs |
| `ContainerScreen` | Generic container (chests) |
| `InventoryScreen` | Player inventory |
| `CraftingScreen` | Crafting table |
| `FurnaceScreen` | Furnace |
| `TrapScreen` | Dispenser/dropper |

### Settings screens

| Class | Description |
|---|---|
| `OptionsScreen` | Main options menu |
| `VideoSettingsScreen` | Graphics settings |
| `ControlsScreen` | Key binding configuration |

### Special screens

| Class | Description |
|---|---|
| `ConfirmScreen` | Yes/no confirmation dialog |
| `TextEditScreen` | Sign text editing |
| `NameEntryScreen` | Player name entry |

## Console UI system (Common/UI/)

On console platforms, the full menu system is implemented through a separate `UIScene`/`UIControl` hierarchy that replaces most of the Java-style screens. This system lives in `Common/UI/`.

### UIScene hierarchy

`UIScene` is the base for all console menu screens. Each scene manages a tree of `UIControl` widgets:

| Scene class | Purpose |
|---|---|
| `UIScene_MainMenu` | Main menu |
| `UIScene_LoadMenu` / `UIScene_LoadOrJoinMenu` | Load/join world |
| `UIScene_CreateWorldMenu` | Create world |
| `UIScene_JoinMenu` | Join multiplayer |
| `UIScene_PauseMenu` | Pause menu |
| `UIScene_DeathMenu` | Death screen |
| `UIScene_HUD` | In-game HUD overlay |
| `UIScene_SettingsMenu` | Settings root |
| `UIScene_SettingsAudioMenu` | Audio settings |
| `UIScene_SettingsControlMenu` | Control settings |
| `UIScene_SettingsGraphicsMenu` | Graphics settings |
| `UIScene_SettingsOptionsMenu` | Game options |
| `UIScene_SettingsUIMenu` | UI settings |
| `UIScene_InventoryMenu` | Inventory |
| `UIScene_CraftingMenu` | Crafting |
| `UIScene_FurnaceMenu` | Furnace |
| `UIScene_BrewingStandMenu` | Brewing stand |
| `UIScene_ContainerMenu` | Chest/container |
| `UIScene_DispenserMenu` | Dispenser |
| `UIScene_CreativeMenu` | Creative inventory |
| `UIScene_EnchantingMenu` | Enchanting |
| `UIScene_AnvilMenu` | Anvil |
| `UIScene_TradingMenu` | Villager trading |
| `UIScene_SignEntryMenu` | Sign editing |
| `UIScene_SkinSelectMenu` | Skin selection |
| `UIScene_DLCMainMenu` / `UIScene_DLCOffersMenu` | DLC store |
| `UIScene_Credits` | Credits |
| `UIScene_EndPoem` | End poem |
| `UIScene_HowToPlay` / `UIScene_HowToPlayMenu` | Help pages |
| `UIScene_HelpAndOptionsMenu` | Help and options |
| `UIScene_Intro` | Intro sequence |
| `UIScene_EULA` | EULA agreement |
| `UIScene_Keyboard` | Virtual keyboard |
| `UIScene_ConnectingProgress` | Connection progress |
| `UIScene_FullscreenProgress` | Loading progress |
| `UIScene_MessageBox` | Message dialog |
| `UIScene_QuadrantSignin` | Split-screen sign-in |
| `UIScene_LeaderboardsMenu` | Leaderboards |
| `UIScene_TeleportMenu` | Teleport (host) |
| `UIScene_DebugOverlay` / `UIScene_DebugOptions` | Debug menus |
| `UIScene_Timer` | Timer display |
| `UIScene_TrialExitUpsell` | Trial upsell |
| `UIScene_SaveMessage` | Save notification |
| `UIScene_InGameHostOptionsMenu` | Host options |
| `UIScene_InGamePlayerOptionsMenu` | Player options |
| `UIScene_InGameInfoMenu` | Info screen |
| `UIScene_InGameSaveManagementMenu` | Save management |
| `UIScene_LaunchMoreOptionsMenu` | Launch options |

### UIControl hierarchy

`UIControl` is the base widget class. Specialized controls:

| Control class | Purpose |
|---|---|
| `UIControl_Button` | Clickable button |
| `UIControl_ButtonList` | Scrollable button list |
| `UIControl_CheckBox` | Toggle checkbox |
| `UIControl_Slider` | Value slider |
| `UIControl_Label` | Static text |
| `UIControl_DynamicLabel` | Updating text |
| `UIControl_HTMLLabel` | Rich text with formatting |
| `UIControl_TextInput` | Text entry field |
| `UIControl_BitmapIcon` | Image display |
| `UIControl_Progress` | Progress bar |
| `UIControl_Cursor` | Mouse cursor |
| `UIControl_Touch` | Touch input area |
| `UIControl_SaveList` | World save list |
| `UIControl_SlotList` | Inventory slot grid |
| `UIControl_DLCList` | DLC content list |
| `UIControl_TexturePackList` | Texture pack list |
| `UIControl_PlayerList` | Player list |
| `UIControl_LeaderboardList` | Leaderboard entries |
| `UIControl_PlayerSkinPreview` | 3D skin preview |
| `UIControl_MinecraftPlayer` | Player model display |
| `UIControl_EnchantmentBook` | Animated enchanting book |
| `UIControl_EnchantmentButton` | Enchantment option |
| `UIControl_SpaceIndicatorBar` | Storage space indicator |

### UIComponent system

Reusable visual components:

| Component class | Purpose |
|---|---|
| `UIComponent_Chat` | Chat message display |
| `UIComponent_Logo` | Minecraft logo |
| `UIComponent_MenuBackground` | Background rendering |
| `UIComponent_Panorama` | Rotating panorama background |
| `UIComponent_PressStartToPlay` | "Press Start" prompt |
| `UIComponent_Tooltips` | Tooltip popups |
| `UIComponent_TutorialPopup` | Tutorial messages |
| `UIComponent_DebugUIConsole` | Debug console overlay |
| `UIComponent_DebugUIMarketingGuide` | Marketing guide overlay |

### UI infrastructure

| Class | Purpose |
|---|---|
| `UILayer` | Manages a stack of scenes |
| `UIGroup` | Groups controls together |
| `UIController` | Routes input to scenes |
| `UIBitmapFont` | Bitmap font rendering for UI |
| `UITTFFont` | TrueType font rendering |
| `UIFontData` | Font metrics and data |

## Gui (in-game HUD)

The `Gui` class renders the in-game heads-up display as an overlay:

```cpp
class Gui : public GuiComponent {
    void render(float a, bool mouseFree, int xMouse, int yMouse);
    void tick();
    void addMessage(const wstring& string, int iPad, bool bIsDeathMessage = false);
    void setNowPlaying(const wstring& string);
    void clearMessages(int iPad = -1);
};
```

### HUD elements

- **Hotbar** -- `renderSlot()` draws each inventory slot
- **Chat messages** -- Per-player message lists (`guiMessages[XUSER_MAX_COUNT]`) with fade-out opacity
- **Pumpkin overlay** -- `renderPumpkin()` when wearing a carved pumpkin
- **Vignette** -- `renderVignette()` darkens screen edges based on brightness
- **Overlay messages** -- "Now Playing" jukebox notifications with animated color
- **Debug graphs** -- `renderGraph()` and `renderStackedGraph()` for frame/tick time visualization

Chat messages are stored per player pad (`XUSER_MAX_COUNT` arrays) to support split-screen with independent chat feeds. The `m_iMaxMessageWidth` is 280 pixels, accounting for safe zone insets.

### AchievementPopup

`AchievementPopup` renders toast notifications when achievements are unlocked, displayed as a slide-in overlay at the top of the screen.

## Font rendering

`Font` handles all text rendering with support for multiple character sets:

```cpp
class Font {
    void draw(const wstring& str, int x, int y, int color);
    void drawShadow(const wstring& str, int x, int y, int color);
    void drawWordWrap(const wstring& str, int x, int y, int w, int col, int h);
    int width(const wstring& str);
    wstring sanitize(const wstring& str);
    void setEnforceUnicodeSheet(bool enforceUnicodeSheet);
    void setBidirectional(bool bidirectional);
    bool AllCharactersValid(const wstring& str);
};
```

Features:
- 32 formatting colors (Minecraft color codes)
- Configurable font sheets (columns, rows, character dimensions)
- Unicode sheet enforcement for non-Latin scripts
- Bidirectional text support (right-to-left languages)
- Character mapping via `m_charMap` for locale-specific font layouts
- Word wrapping with configurable line height
