---
title: Custom GUI Screens
description: How to create custom GUI screens in LCEMP.
---

The LCEMP GUI system is built around the `Screen` class. Every menu you see in the game -- the title screen, pause menu, death screen, inventory, chat -- is a `Screen` subclass. This guide covers how to create your own.

## Architecture overview

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

## GuiComponent drawing primitives

`GuiComponent` (`Minecraft.Client/GuiComponent.h`) provides the low-level rendering methods every screen inherits:

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

## Screen base class

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

1. **`init(Minecraft*, int, int)`** -- called when the screen is opened. Sets `minecraft`, `width`, `height`, `font`, then calls `init()`.
2. **`init()`** -- override this to create buttons and set up state. Called after dimensions are set.
3. **`tick()`** -- called every game tick (20 times/second). Use for animations and timed logic.
4. **`render(int xm, int ym, float a)`** -- called every frame. `xm`/`ym` are mouse position, `a` is partial tick for interpolation.
5. **`removed()`** -- called when the screen is closed.

## Button class

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

- **`id`** -- unique identifier used in `buttonClicked()` to determine which button was pressed
- **`active`** -- set to `false` to gray out and disable the button
- **`visible`** -- set to `false` to hide the button entirely
- Default button size is 200x20 when using the 3-argument constructor

## Creating a custom screen

### Step 1: Define the header

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

### Step 2: Implement the screen

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

### Step 3: Open the screen

From anywhere that has access to the `Minecraft` instance:

```cpp
minecraft->setScreen(new MyScreen());
```

To return to the previous screen or close the screen entirely:

```cpp
minecraft->setScreen(nullptr);  // closes screen, returns to game
```

## Input handling

### Mouse input

The base `Screen` class processes mouse events automatically. When a button is clicked, `buttonClicked(Button*)` is called. For custom click handling outside of buttons, override `mouseClicked()`:

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

### Keyboard input

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

## Existing screen examples

Study these existing screens for patterns:

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

### DeathScreen pattern

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

### ChatScreen pattern

`ChatScreen` shows text input handling:

```cpp
class ChatScreen : public Screen {
protected:
    wstring message;

    void keyPressed(wchar_t ch, int eventKey);  // captures typing

public:
    void render(int xm, int ym, float a);       // draws input line + cursor
};
```

## Rendering tips

- Call `renderBackground()` first to draw the standard darkened overlay.
- Use `drawCenteredString()` for titles and labels.
- Use `fill()` for colored panels and separators.
- Use `blit()` to draw from texture atlases (requires binding the texture first).
- Button rendering happens in each button's own `render()` method -- iterate `buttons` and call it.
- `isPauseScreen()` controls whether the game ticks while your screen is open. Return `true` for menus, `false` for overlays like chat.

## Key source files

- `Minecraft.Client/GuiComponent.h` -- drawing primitives
- `Minecraft.Client/Screen.h` -- screen base class
- `Minecraft.Client/Button.h` -- button widget
- `Minecraft.Client/Minecraft.h` -- `setScreen()` method
- `Minecraft.Client/DeathScreen.h` -- simple example screen
- `Minecraft.Client/PauseScreen.h` -- pause menu example
- `Minecraft.Client/ChatScreen.h` -- text input example
