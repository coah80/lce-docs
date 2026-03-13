---
title: Custom GUI Screens
description: How to create custom GUI screens in LCE.
---

LCE has two separate UI systems you can use to build custom screens. The **legacy Screen system** is Java-style with code-driven rendering (lines, fills, text blits). The **console UIScene system** is Flash/Iggy-based where you author the layout in an SWF file and control it from C++.

This guide covers both. Most player-facing menus in the shipping game use the UIScene system, but the legacy Screen system is simpler if you just need something quick.

## Part 1: Legacy Screen system

### Architecture overview

| Class | File | Role |
|---|---|---|
| `GuiComponent` | `Minecraft.Client/GuiComponent.h` | Base class with drawing primitives |
| `Screen` | `Minecraft.Client/Screen.h` | Interactive GUI screen with buttons and input |
| `Button` | `Minecraft.Client/Button.h` | Clickable button widget |
| `Minecraft` | `Minecraft.Client/Minecraft.h` | Owns the active screen, provides `setScreen()` |
| `Font` | (various) | Text rendering |

### Inheritance chain

```
GuiComponent          -- drawing primitives (lines, fills, text, blits)
    |
    v
Screen                -- buttons, input handling, lifecycle
    |
    v
YourCustomScreen      -- your implementation
```

### GuiComponent drawing primitives

`GuiComponent` (`Minecraft.Client/GuiComponent.h`) provides the low-level rendering methods that every screen inherits:

```cpp
class GuiComponent {
protected:
    float blitOffset;

    void hLine(int x0, int x1, int y, int col);           // horizontal line
    void vLine(int x, int y0, int y1, int col);            // vertical line
    void fill(int x0, int y0, int x1, int y1, int col);   // solid rectangle
    void fillGradient(int x0, int y0, int x1, int y1, int col1, int col2);  // gradient rect

public:
    void drawCenteredString(Font *font, const wstring& str, int x, int y, int color);
    void drawString(Font *font, const wstring& str, int x, int y, int color);
    void blit(int x, int y, int sx, int sy, int w, int h);  // texture blit
};
```

Colors are packed as 32-bit ARGB integers (e.g. `0xFFFFFFFF` for white, `0xFF808080` for gray).

### Screen base class

`Screen` (`Minecraft.Client/Screen.h`) extends `GuiComponent` with a full lifecycle:

```cpp
class Screen : public GuiComponent {
protected:
    Minecraft *minecraft;
    vector<Button *> buttons;
    Font *font;

public:
    int width, height;
    bool passEvents;
    GuiParticles *particles;

    // Lifecycle
    virtual void init(Minecraft *minecraft, int width, int height);
    virtual void init();
    virtual void removed();
    virtual void tick();

    // Rendering
    virtual void render(int xm, int ym, float a);
    virtual void renderBackground();
    virtual void renderBackground(int vo);
    virtual void renderDirtBackground(int vo);

    // Input
    virtual void updateEvents();
    virtual void mouseEvent();
    virtual void keyboardEvent();

    // Interaction
    virtual void buttonClicked(Button *button);
    virtual bool isPauseScreen();
    virtual void confirmResult(bool result, int id);

    // Clipboard
    static wstring getClipboard();
    static void setClipboard(const wstring& str);

protected:
    virtual void keyPressed(wchar_t eventCharacter, int eventKey);
    virtual void mouseClicked(int x, int y, int buttonNum);
    virtual void mouseReleased(int x, int y, int buttonNum);
};
```

### Lifecycle flow

1. **`init(Minecraft*, int, int)`** is called when the screen opens. It sets `minecraft`, `width`, `height`, `font`, then calls `init()`.
2. **`init()`** is where you override to create buttons and set up state. Called after dimensions are set.
3. **`tick()`** runs every game tick (20 times/second). Good for animations and timed logic.
4. **`render(int xm, int ym, float a)`** runs every frame. `xm`/`ym` are the mouse position, `a` is the partial tick for interpolation.
5. **`removed()`** is called when the screen closes.

### Button class

`Button` (`Minecraft.Client/Button.h`) is the standard clickable widget:

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

    virtual void render(Minecraft *minecraft, int xm, int ym);
    virtual bool clicked(Minecraft *minecraft, int mx, int my);
    virtual void released(int mx, int my);
};
```

- **`id`** is a unique identifier used in `buttonClicked()` to tell which button was pressed
- **`active`** set to `false` grays out and disables the button
- **`visible`** set to `false` hides the button entirely
- Default button size is 200x20 when using the 3-argument constructor

### Creating a custom legacy screen

#### Step 1: Define the header

```cpp
// MyScreen.h
#pragma once
#include "Screen.h"

class MyScreen : public Screen {
private:
    int tickCounter;

public:
    MyScreen();
    virtual void init();
    virtual void render(int xm, int ym, float a);
    virtual void tick();

protected:
    virtual void buttonClicked(Button *button);
    virtual void keyPressed(wchar_t eventCharacter, int eventKey);

public:
    virtual bool isPauseScreen();
};
```

#### Step 2: Implement the screen

```cpp
// MyScreen.cpp
#include "stdafx.h"
#include "MyScreen.h"
#include "Button.h"
#include "Minecraft.h"

MyScreen::MyScreen() : tickCounter(0) {}

void MyScreen::init() {
    // Clear any existing buttons
    buttons.clear();

    // Add buttons centered on screen
    // Button(id, x, y, label)
    buttons.push_back(new Button(0, width / 2 - 100, height / 2 - 10, L"Do Something"));
    buttons.push_back(new Button(1, width / 2 - 100, height / 2 + 20, L"Close"));
}

void MyScreen::render(int xm, int ym, float a) {
    // Draw darkened background
    renderBackground();

    // Draw title text centered at top
    drawCenteredString(font, L"My Custom Screen", width / 2, 20, 0xFFFFFF);

    // Draw description text
    drawString(font, L"Ticks open: " + to_wstring(tickCounter), 10, 50, 0xAAAAAA);

    // Draw a decorative filled rectangle
    fill(width / 2 - 80, height / 2 - 40, width / 2 + 80, height / 2 - 30, 0xFF4488CC);

    // Render all buttons (must call base render)
    for (auto *btn : buttons) {
        btn->render(minecraft, xm, ym);
    }
}

void MyScreen::tick() {
    tickCounter++;
}

void MyScreen::buttonClicked(Button *button) {
    switch (button->id) {
    case 0:
        // Handle "Do Something"
        break;
    case 1:
        // Close this screen (return to game)
        minecraft->setScreen(nullptr);
        break;
    }
}

void MyScreen::keyPressed(wchar_t eventCharacter, int eventKey) {
    // ESC key (key code 1) closes the screen
    if (eventKey == 1) {
        minecraft->setScreen(nullptr);
    }
}

bool MyScreen::isPauseScreen() {
    return true;  // pause the game while this screen is open
}
```

#### Step 3: Open the screen

From anywhere that has access to the `Minecraft` instance:

```cpp
minecraft->setScreen(new MyScreen());
```

To go back to the previous screen or close the screen entirely:

```cpp
minecraft->setScreen(nullptr);  // closes screen, returns to game
```

### Input handling

#### Mouse input

The base `Screen` class processes mouse events automatically. When a button is clicked, `buttonClicked(Button*)` gets called. For custom click handling outside of buttons, override `mouseClicked()`:

```cpp
void MyScreen::mouseClicked(int x, int y, int buttonNum) {
    // buttonNum: 0 = left, 1 = right, 2 = middle
    if (buttonNum == 0 && x > 50 && x < 150 && y > 50 && y < 70) {
        // Handle click in custom area
    }

    // Call base to handle button clicks
    Screen::mouseClicked(x, y, buttonNum);
}
```

#### Keyboard input

Override `keyPressed()` for keyboard handling:

```cpp
void MyScreen::keyPressed(wchar_t eventCharacter, int eventKey) {
    if (eventKey == 1) {  // ESC
        minecraft->setScreen(nullptr);
        return;
    }
    // Handle other keys...
}
```

### Rendering tips

- Call `renderBackground()` first to draw the standard darkened overlay.
- Use `drawCenteredString()` for titles and labels.
- Use `fill()` for colored panels and separators.
- Use `blit()` to draw from texture atlases (you need to bind the texture first).
- Button rendering happens in each button's own `render()` method. Iterate `buttons` and call it.
- `isPauseScreen()` controls whether the game ticks while your screen is open. Return `true` for menus, `false` for overlays like chat.

### Existing screen examples

These existing screens are good to study for patterns:

| Screen | File | Complexity | Good example of |
|---|---|---|---|
| `DeathScreen` | `DeathScreen.h` | Simple | Basic buttons, text rendering |
| `PauseScreen` | `PauseScreen.h` | Simple | Menu with multiple buttons |
| `ChatScreen` | `ChatScreen.h` | Medium | Text input handling, key events |
| `ConfirmScreen` | `ConfirmScreen.h` | Simple | Yes/No confirmation dialogs |
| `ErrorScreen` | `ErrorScreen.h` | Simple | Error message display |
| `TitleScreen` | `TitleScreen.h` | Complex | Full menu with animations |
| `InventoryScreen` | `InventoryScreen.h` | Complex | Container/slot interaction |
| `CraftingScreen` | `CraftingScreen.h` | Complex | Container menu integration |
| `CreateWorldScreen` | `CreateWorldScreen.h` | Complex | Multiple input types |

#### DeathScreen pattern

`DeathScreen` is the simplest non-trivial example:

```cpp
class DeathScreen : public Screen {
public:
    virtual void init();                                    // create respawn button
    virtual void render(int xm, int ym, float a);          // draw "You died!" text
    virtual bool isPauseScreen();                           // returns false

protected:
    virtual void keyPressed(char eventCharacter, int eventKey);  // block ESC
    virtual void buttonClicked(Button *button);                   // handle respawn
};
```

#### ChatScreen pattern

`ChatScreen` shows how text input works:

```cpp
class ChatScreen : public Screen {
protected:
    wstring message;

    void keyPressed(wchar_t ch, int eventKey);  // captures typing

public:
    void render(int xm, int ym, float a);       // draws input line + cursor
};
```

## Part 2: Console UIScene system (Iggy/Flash)

The UIScene system is how all the real console menus are built. Every menu you see on Xbox/PlayStation/Vita is an SWF movie controlled from C++. This is more involved than the legacy system but gives you the full console UI look and feel.

### What you need

To create a custom UIScene, you need:
1. **An SWF movie file** authored in Adobe Flash. This defines the visual layout (where buttons go, what they look like, text formatting, animations).
2. **A C++ scene class** that loads the SWF, maps its elements to C++ variables, and handles input/callbacks.
3. **An EUIScene enum entry** so the navigation system knows about your scene.
4. **A navigation entry** in `CConsoleMinecraftApp::NavigateToScene` to create your scene when requested.

### Step 1: Add your scene to the enum

In `UIEnums.h`, add your scene type:

```cpp
enum EUIScene
{
    // ... existing scenes ...
    eUIScene_TeleportMenu,

    // Add yours here (before the platform-specific block)
    eUIScene_MyCustomMenu,

    // ... rest of enums ...
};
```

### Step 2: Author the SWF

Your SWF movie needs to follow the conventions that Iggy and the UI framework expect:

- The root timeline should have a `SetSafeZone(top, bottom, left, right)` function
- The root should have a `SetFocus(controlId)` function
- The root should have a `SetAlpha(percent)` function
- Each interactive element should have a unique instance name that you'll reference in C++
- Buttons should call `fscommand("handlePress", controlId + "," + childId)` when pressed
- Checkboxes should call `fscommand("handleCheckboxToggled", controlId + "," + selected)`
- Sliders should call `fscommand("handleSliderMove", sliderId + "," + currentValue)`
- Focus changes should call `fscommand("handleFocusChange", controlId + "," + childId)`

You need resolution variants. At minimum, create a 720p version (e.g. `MyCustomMenu720.swf`). Ideally also create 1080p and 480p variants. Place them in the game archive.

### Step 3: Create the C++ scene class

Here is a complete example of a custom scene with buttons, a checkbox, a slider, and a label:

```cpp
// UIScene_MyCustomMenu.h
#pragma once
#include "UIScene.h"

class UIScene_MyCustomMenu : public UIScene
{
private:
    UIControl_Button m_buttonOk;
    UIControl_Button m_buttonCancel;
    UIControl_CheckBox m_checkOption;
    UIControl_Slider m_sliderValue;
    UIControl_Label m_labelTitle;
    UIControl_Label m_labelStatus;

    // Map Flash elements to C++ variables
    UI_BEGIN_MAP_ELEMENTS_AND_NAMES(UIScene)
        UI_MAP_ELEMENT(m_buttonOk, "ButtonOk")
        UI_MAP_ELEMENT(m_buttonCancel, "ButtonCancel")
        UI_MAP_ELEMENT(m_checkOption, "CheckOption")
        UI_MAP_ELEMENT(m_sliderValue, "SliderValue")
        UI_MAP_ELEMENT(m_labelTitle, "LabelTitle")
        UI_MAP_ELEMENT(m_labelStatus, "LabelStatus")
    UI_END_MAP_ELEMENTS_AND_NAMES()

public:
    UIScene_MyCustomMenu(int iPad, void *initData, UILayer *parentLayer);

    virtual EUIScene getSceneType() { return eUIScene_MyCustomMenu; }

protected:
    virtual wstring getMoviePath();
    virtual void handleReload();

public:
    virtual void handleInput(int iPad, int key, bool repeat, bool pressed,
                             bool released, bool &handled);
    virtual void updateTooltips();

protected:
    void handlePress(F64 controlId, F64 childId);
    void handleCheckboxToggled(F64 controlId, bool selected);
    void handleSliderMove(F64 sliderId, F64 currentValue);
    void handleGainFocus(bool navBack);
};
```

```cpp
// UIScene_MyCustomMenu.cpp
#include "stdafx.h"
#include "UI.h"
#include "UIScene_MyCustomMenu.h"

UIScene_MyCustomMenu::UIScene_MyCustomMenu(int iPad, void *initData,
                                            UILayer *parentLayer)
    : UIScene(iPad, parentLayer)
{
    // Load the SWF and set up all mapped elements
    initialiseMovie();

    // Initialize controls with labels and IDs
    m_buttonOk.init(L"OK", 0);
    m_buttonCancel.init(L"Cancel", 1);
    m_checkOption.init(L"Enable Feature", 2, false);
    m_sliderValue.init(L"Amount", 3, 0, 100, 50);
    m_labelTitle.init(L"My Custom Menu");
    m_labelStatus.init(L"Ready");
}

wstring UIScene_MyCustomMenu::getMoviePath()
{
    // Return the base SWF name (resolution suffix added automatically)
    return L"MyCustomMenu";
}

void UIScene_MyCustomMenu::handleReload()
{
    // Re-initialize controls after a skin reload
    m_buttonOk.init(L"OK", 0);
    m_buttonCancel.init(L"Cancel", 1);
    m_checkOption.init(L"Enable Feature", 2, false);
    m_sliderValue.init(L"Amount", 3, 0, 100, 50);
    m_labelTitle.init(L"My Custom Menu");
    m_labelStatus.init(L"Ready");
}

void UIScene_MyCustomMenu::handleGainFocus(bool navBack)
{
    UIScene::handleGainFocus(navBack);
    // Update state when we gain focus
}

void UIScene_MyCustomMenu::updateTooltips()
{
    ui.SetTooltips(m_iPad, eToolTipExit);
}

void UIScene_MyCustomMenu::handleInput(int iPad, int key, bool repeat,
    bool pressed, bool released, bool &handled)
{
    if (!pressed) return;

    switch (key)
    {
    case ACTION_MENU_B:
        // B button: go back
        navigateBack();
        handled = true;
        break;
    default:
        // Let the SWF handle other input (focus navigation, button presses)
        sendInputToMovie(key, repeat, pressed, released);
        handled = true;
        break;
    }
}

void UIScene_MyCustomMenu::handlePress(F64 controlId, F64 childId)
{
    int id = (int)controlId;
    switch (id)
    {
    case 0:  // OK button
        // Do your thing
        m_labelStatus.setLabel(L"OK pressed!");
        ui.PlayUISFX(eSFX_Focus);
        navigateBack();
        break;
    case 1:  // Cancel button
        navigateBack();
        break;
    }
}

void UIScene_MyCustomMenu::handleCheckboxToggled(F64 controlId, bool selected)
{
    int id = (int)controlId;
    if (id == 2)
    {
        // Feature checkbox was toggled
        if (selected)
            m_labelStatus.setLabel(L"Feature enabled");
        else
            m_labelStatus.setLabel(L"Feature disabled");
    }
}

void UIScene_MyCustomMenu::handleSliderMove(F64 sliderId, F64 currentValue)
{
    int id = (int)sliderId;
    if (id == 3)
    {
        int value = (int)currentValue;
        m_labelStatus.setLabel(L"Value: " + to_wstring(value));
    }
}
```

### Step 4: Register the scene in navigation

In `CConsoleMinecraftApp::NavigateToScene` (or your platform's equivalent), add a case for your new scene:

```cpp
case eUIScene_MyCustomMenu:
    scene = new UIScene_MyCustomMenu(iPad, initData, parentLayer);
    break;
```

### Step 5: Open your scene

From anywhere in game code:

```cpp
ui.NavigateToScene(iPad, eUIScene_MyCustomMenu, nullptr);
```

Or with initialization data:

```cpp
MyCustomMenuInitData *data = new MyCustomMenuInitData();
data->iPad = iPad;
data->someValue = 42;
ui.NavigateToScene(iPad, eUIScene_MyCustomMenu, data);
```

The scene constructor is responsible for casting and consuming (deleting) the init data.

### Navigating back

From inside your scene, call `navigateBack()` to pop back to the previous scene. This plays the back sound effect and removes your scene from the stack.

From outside, use:
```cpp
ui.NavigateBack(iPad);
```

### Child element mapping

If your SWF has elements nested inside a panel (which is common), use child element mapping:

```cpp
UI_BEGIN_MAP_ELEMENTS_AND_NAMES(UIScene)
    UI_MAP_ELEMENT(m_controlMainPanel, "MainPanel")
    UI_BEGIN_MAP_CHILD_ELEMENTS(m_controlMainPanel)
        UI_MAP_ELEMENT(m_buttonOk, "ButtonOk")
        UI_MAP_ELEMENT(m_labelTitle, "LabelTitle")
        UI_MAP_ELEMENT(m_slotListInventory, "inventoryList")
    UI_END_MAP_CHILD_ELEMENTS()
UI_END_MAP_ELEMENTS_AND_NAMES()
```

This tells the mapping system to look for `ButtonOk` inside the `MainPanel` object in the SWF, not at the root level.

### Calling ActionScript functions from C++

To call a function defined in your SWF's ActionScript:

```cpp
// Register the function name (usually in mapElementsAndNames)
IggyName m_funcMyFunction;
// In the macro block:
UI_MAP_NAME(m_funcMyFunction, L"MyFunction")

// Call it with arguments
IggyDataValue result;
IggyDataValue value[2];

// String argument
IggyStringUTF16 stringVal;
wstring text = L"Hello";
stringVal.string = (IggyUTF16*)text.c_str();
stringVal.length = text.length();
value[0].type = IGGY_DATATYPE_string_UTF16;
value[0].string16 = stringVal;

// Number argument
value[1].type = IGGY_DATATYPE_number;
value[1].number = 42.0;

IggyPlayerCallMethodRS(getMovie(), &result,
    IggyPlayerRootPath(getMovie()), m_funcMyFunction, 2, value);
```

The supported data types for Iggy calls are:
- `IGGY_DATATYPE_number` (F64, used for int and float)
- `IGGY_DATATYPE_boolean`
- `IGGY_DATATYPE_string_UTF8`
- `IGGY_DATATYPE_string_UTF16`

### Creating a container menu

If your custom screen needs item slots (like an inventory or crafting grid), extend `UIScene_AbstractContainerMenu` instead of `UIScene`:

```cpp
class UIScene_MyContainerMenu : public UIScene_AbstractContainerMenu,
                                 public IUIScene_MyContainerMenu
{
    UIControl_SlotList m_slotListMyGrid;
    UIControl_SlotList m_slotListResult;

    UI_BEGIN_MAP_ELEMENTS_AND_NAMES(UIScene_AbstractContainerMenu)
        UI_BEGIN_MAP_CHILD_ELEMENTS(m_controlMainPanel)
            UI_MAP_ELEMENT(m_slotListMyGrid, "myGridList")
            UI_MAP_ELEMENT(m_slotListResult, "resultList")
        UI_END_MAP_CHILD_ELEMENTS()
    UI_END_MAP_ELEMENTS_AND_NAMES()

    // ... constructor, getMoviePath, etc ...
};
```

The abstract container base class gives you for free:
- `m_slotListHotbar` and `m_slotListInventory` (the standard player inventory grids)
- `m_cursorPath` (the floating pointer)
- `m_controlMainPanel` and `m_controlBackgroundPanel` (the menu panel)
- `m_labelInventory` (the "Inventory" label)
- Pointer navigation with analog stick
- Custom draw rendering for all item slots
- Tooltip management

You need to implement the `IUIScene_AbstractContainerMenu` interface to define your sections:

```cpp
virtual int getSectionColumns(ESceneSection eSection);
virtual int getSectionRows(ESceneSection eSection);
virtual ESceneSection GetSectionAndSlotInDirection(ESceneSection eSection,
    ETapState eTapDirection, int *piTargetX, int *piTargetY);
virtual void GetPositionOfSection(ESceneSection eSection, UIVec2D* pPosition);
virtual void GetItemScreenData(ESceneSection eSection, int iItemIndex,
    UIVec2D* pPosition, UIVec2D* pSize);
virtual int getSectionStartOffset(ESceneSection eSection);
```

### Creating a non-interactive overlay

For overlays like the HUD or chat that display information but don't steal input focus:

```cpp
class UIScene_MyOverlay : public UIScene
{
public:
    // Don't steal focus from other scenes
    virtual bool stealsFocus() { return false; }

    // Don't respond to input
    virtual bool hasFocus(int iPad) { return false; }

    // Don't hide scenes below us
    virtual bool hidesLowerScenes() { return false; }
};
```

Add it as a component instead of navigating to it:

```cpp
// Show the overlay
ui.showComponent(iPad, eUIScene_MyOverlay, eUILayer_HUD, eUIGroup_PAD, true);

// Hide it
ui.showComponent(iPad, eUIScene_MyOverlay, eUILayer_HUD, eUIGroup_PAD, false);
```

### Using timers

Scenes have a built-in timer system for periodic updates:

```cpp
// In your constructor or handleGainFocus:
addTimer(0, 500);  // Timer ID 0, fires every 500ms

// Override to handle timer events:
void UIScene_MyCustomMenu::handleTimerComplete(int id)
{
    if (id == 0)
    {
        // Update something every 500ms
        m_labelStatus.setLabel(L"Tick: " + to_wstring(m_tickCount++));
    }
}

// Stop the timer when done:
killTimer(0);
```

Timers auto-repeat until killed. They are ticked inside the SWF tick loop, so they only fire when the scene is active.

### Enabling/disabling controls at runtime

```cpp
// Disable a button (grays it out)
m_buttonOk.setEnable(false);

// Hide a control
m_labelStatus.setVisible(false);

// Change a label's text
m_labelTitle.setLabel(L"New Title");

// Set overall scene opacity
setOpacity(0.5f);  // 50% transparent

// Check/uncheck a checkbox from code
m_checkOption.setChecked(true);

// Update a slider value from code
m_sliderValue.handleSliderMove(75);

// Set a text input's character limit
m_textInput.SetCharLimit(32);

// Highlight a slot in a slot list
m_slotListMyGrid.setHighlightSlot(3);

// Show the red "invalid" box on a slot
m_slotListMyGrid.showSlotRedBox(5, true);

// Update a progress bar
m_progressBar.setProgress(75);
m_progressBar.showBar(true);
```

### Removing controls from the SWF layout

You can dynamically remove a control from the Flash layout (with an optional re-center animation):

```cpp
removeControl(&m_buttonCancel, true);  // remove and re-center remaining elements
removeControl(&m_labelStatus, false);  // remove without re-centering
```

This calls the SWF's `RemoveObject` function to hide the element and optionally adjust the layout.

### Scene slide animations

Scenes support left/right slide transitions:

```cpp
slideLeft();   // slide the scene content to the left
slideRight();  // slide the scene content to the right
```

These call ActionScript `SlideLeft()` / `SlideRight()` functions on the SWF root.

### Handling skin reloads

When the player changes texture packs, all SWF skins are reloaded. Your scene's SWF gets destroyed and recreated. The system calls:

1. `handlePreReload()` -- save any state you need before the SWF is destroyed
2. All controls get `ReInit()` called to re-map to the new SWF elements
3. `handleReload()` -- restore your state, re-initialize control labels and values

Make sure your `handleReload()` implementation re-applies all control state (labels, checked states, slider positions, etc.) because the fresh SWF starts with its default values.

### Working with splitscreen

Check if you're in splitscreen:
```cpp
bool isSplit = (app.GetLocalPlayerCount() > 1);
```

Load a different SWF for splitscreen:
```cpp
wstring UIScene_MyCustomMenu::getMoviePath()
{
    if (app.GetLocalPlayerCount() > 1)
        return L"MyCustomMenuSplit";
    else
        return L"MyCustomMenu";
}
```

Get the current viewport type:
```cpp
C4JRender::eViewportType viewport = m_parentLayer->getViewport();
```

### Texture substitution

To replace a texture in your SWF at runtime (for example, showing a dynamic image):

```cpp
// Register a texture with raw pixel data
registerSubstitutionTexture(L"myTextureName", pixelData, dataLength, true);

// Check if a texture has been registered
if (hasRegisteredSubstitutionTexture(L"myTextureName"))
{
    // Already loaded
}
```

The texture name must match a texture reference in the SWF. When Iggy encounters that texture during rendering, it uses your provided pixel data instead.

Registered textures are automatically cleaned up when the scene is destroyed.

### Sound effects

Play UI sound effects:

```cpp
ui.PlayUISFX(eSFX_Focus);   // focus change sound
ui.PlayUISFX(eSFX_Back);    // back/cancel sound
```

### Key source files

Legacy system:
- `Minecraft.Client/GuiComponent.h` for drawing primitives
- `Minecraft.Client/Screen.h` for the screen base class
- `Minecraft.Client/Button.h` for the button widget
- `Minecraft.Client/Minecraft.h` for the `setScreen()` method
- `Minecraft.Client/DeathScreen.h` for a simple example screen
- `Minecraft.Client/PauseScreen.h` for the pause menu example
- `Minecraft.Client/ChatScreen.h` for the text input example

Console UIScene system:
- `Common/UI/UIScene.h` and `UIScene.cpp` for the scene base class
- `Common/UI/UIControl.h` for the control base class
- `Common/UI/UIControl_Base.h` for the label-capable control base
- `Common/UI/UIControl_Button.h` for buttons
- `Common/UI/UIControl_CheckBox.h` for checkboxes
- `Common/UI/UIControl_Slider.h` for sliders
- `Common/UI/UIControl_Label.h` for text labels
- `Common/UI/UIControl_TextInput.h` for text entry fields
- `Common/UI/UIControl_SlotList.h` for item slot grids
- `Common/UI/UIControl_ButtonList.h` for scrollable button lists
- `Common/UI/UIControl_Progress.h` for progress bars
- `Common/UI/UIController.h` for the top-level UI manager
- `Common/UI/UIEnums.h` for scene/layer/group enums
- `Common/UI/UIStructs.h` for initialization data structs
- `Common/UI/UILayer.h` for layer management
- `Common/UI/UIGroup.h` for player group management
- `Common/UI/UIScene_MainMenu.h` for a simple button-based scene example
- `Common/UI/UIScene_PauseMenu.h` for another button-based scene example
- `Common/UI/UIScene_HUD.h` for a non-interactive overlay example
- `Common/UI/UIScene_CreativeMenu.h` for a complex container scene example
- `Common/UI/IUIScene_AbstractContainerMenu.h` for the container menu interface
- `Common/UI/UIScene_AbstractContainerMenu.h` for the container menu base class
