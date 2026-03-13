---
title: "Input System"
description: "How LCE handles keyboard, mouse, and controller input."
---

LCE supports three input methods: gamepad controllers (the main one for all console platforms), keyboard/mouse (Windows 64-bit port), and touch (PS Vita). The input system is spread across several classes that abstract platform differences and feed into the game's action system.

## Input class hierarchy

### Input (base)

`Input` is the abstract base for movement input processing:

```cpp
class Input {
public:
    float xa;          // horizontal movement axis (-1 to 1)
    float ya;          // vertical movement axis (-1 to 1)
    bool wasJumping;
    bool jumping;
    bool sneaking;
    bool sprinting;

    virtual void tick(LocalPlayer* player);
};
```

This is the minimal interface that `LocalPlayer` uses each tick to figure out movement intent. The `xa`/`ya` values drive horizontal movement, while `jumping`, `sneaking`, and `sprinting` flags trigger their respective behaviors.

`wasJumping` tracks the previous tick's jump state so the player movement code can detect jump edges (pressed vs held).

### KeyboardMouseInput

The `KeyboardMouseInput` class handles keyboard and mouse input for the Windows 64-bit build. It's set up as a global (`g_KBMInput`):

```cpp
extern KeyboardMouseInput g_KBMInput;
```

#### Key constants

| Constant | Key | Value |
|---|---|---|
| `KEY_FORWARD` | W | `'W'` |
| `KEY_BACKWARD` | S | `'S'` |
| `KEY_LEFT` | A | `'A'` |
| `KEY_RIGHT` | D | `'D'` |
| `KEY_JUMP` | Space | `VK_SPACE` |
| `KEY_SNEAK` | Left Shift | `VK_LSHIFT` |
| `KEY_SPRINT` | Left Ctrl | `VK_LCONTROL` |
| `KEY_INVENTORY` | E | `'E'` |
| `KEY_DROP` | Q | `'Q'` |
| `KEY_CRAFTING` | Tab | `VK_TAB` |
| `KEY_CRAFTING_ALT` | R | `'R'` |
| `KEY_CONFIRM` | Enter | `VK_RETURN` |
| `KEY_CANCEL` | Backspace | `VK_BACK` |
| `KEY_PAUSE` | Escape | `VK_ESCAPE` |
| `KEY_THIRD_PERSON` | F5 | `VK_F5` |
| `KEY_DEBUG_INFO` | F3 | `VK_F3` |

These are hardcoded `static const int` values on the class. They aren't remappable through the input system itself, but the `Options` class has a separate `KeyMapping` system for the Java-style key bindings (see below).

`MAX_KEYS` = 256 covers all Windows virtual key codes.

#### Mouse constants

| Constant | Value |
|---|---|
| `MOUSE_LEFT` | 0 |
| `MOUSE_RIGHT` | 1 |
| `MOUSE_MIDDLE` | 2 |
| `MAX_MOUSE_BUTTONS` | 3 |

#### State tracking

The class tracks three states per key and mouse button:

- **Down**: currently held (`m_keyDown[MAX_KEYS]`, `m_mouseButtonDown[MAX_MOUSE_BUTTONS]`)
- **Pressed**: went from up to down this tick (`m_keyPressed[MAX_KEYS]`, `m_mouseBtnPressed[MAX_MOUSE_BUTTONS]`)
- **Released**: went from down to up this tick (`m_keyReleased[MAX_KEYS]`, `m_mouseBtnReleased[MAX_MOUSE_BUTTONS]`)

State is double-buffered with accumulators (`m_keyPressedAccum`, `m_keyReleasedAccum`, `m_mouseBtnPressedAccum`, `m_mouseBtnReleasedAccum`) that collect events between ticks, then get transferred to the readable state arrays during `Tick()`. There's also a `m_keyDownPrev[]` and `m_mouseButtonDownPrev[]` for the previous frame.

Mouse position is tracked separately:
- `m_mouseX`, `m_mouseY`: current cursor position
- `m_mouseDeltaX`, `m_mouseDeltaY`: per-tick delta
- `m_mouseDeltaAccumX`, `m_mouseDeltaAccumY`: raw delta accumulators (for look input)
- `m_mouseWheel`, `m_mouseWheelAccum`: scroll wheel delta

#### Key methods

| Method | Purpose |
|---|---|
| `Init()` | Zero all state arrays |
| `Tick()` | Transfer accumulated events to readable state. Copies accumulators to the readable arrays, then clears the accumulators. Also transfers raw mouse delta. |
| `ClearAllState()` | Reset everything (all arrays, all accumulators, all deltas) |
| `OnKeyDown(int vkCode)` / `OnKeyUp(int vkCode)` | Keyboard event handlers. Sets `m_keyDown` and adds to the pressed/released accumulators. |
| `OnMouseButtonDown(int)` / `OnMouseButtonUp(int)` | Mouse button events. Same accumulator pattern. |
| `OnMouseMove(int x, int y)` | Cursor position update. Sets `m_mouseX`/`m_mouseY`. |
| `OnMouseWheel(int delta)` | Scroll wheel. Adds to `m_mouseWheelAccum`. |
| `OnRawMouseDelta(int dx, int dy)` | Raw mouse movement for look. Adds to `m_mouseDeltaAccumX`/`Y`. |
| `IsKeyDown(int)` / `IsKeyPressed(int)` / `IsKeyReleased(int)` | Key state queries |
| `IsMouseButtonDown(int)` / `IsMouseButtonPressed(int)` / `IsMouseButtonReleased(int)` | Mouse state queries |
| `GetMouseX()` / `GetMouseY()` | Cursor position |
| `GetMouseDeltaX()` / `GetMouseDeltaY()` | Per-tick mouse delta |
| `GetMoveX()` / `GetMoveY()` | Movement axis from WASD. Returns -1, 0, or 1 based on which movement keys are held. |
| `GetLookX(float sensitivity)` / `GetLookY(float sensitivity)` | Look axis from raw mouse delta, scaled by sensitivity |
| `GetRawDeltaX()` / `GetRawDeltaY()` | Direct access to raw delta accumulators |
| `ConsumeMouseDelta()` | Clears `m_mouseDeltaAccumX` and `m_mouseDeltaAccumY` to 0 after reading |
| `SetMouseGrabbed(bool)` | Lock cursor for gameplay. `IsMouseGrabbed()` queries the state. |
| `SetCursorHiddenForUI(bool)` | Hide cursor when using UI. `IsCursorHiddenForUI()` queries. |
| `SetWindowFocused(bool)` | Track window focus state. `IsWindowFocused()` queries. |
| `SetKBMActive(bool)` | Mark keyboard/mouse as the active input device. `IsKBMActive()` queries. |
| `SetScreenCursorHidden(bool)` | Screen-level cursor hide request. `IsScreenCursorHidden()` queries. |
| `HasAnyInput()` | Returns `m_hasInput`, which is true when any key or mouse event has happened. Used for auto-detecting whether to switch between controller and keyboard/mouse input modes. |

## Controller input (EControllerActions)

Controller input is mapped through the `EControllerActions` enum defined in `Common/App_enums.h`. This gives you a unified action system across all console platforms (Xbox 360, Xbox One, PS3, PS4, PS Vita).

### Menu actions

| Action | Description |
|---|---|
| `ACTION_MENU_A` | Confirm / select |
| `ACTION_MENU_B` | Cancel / back |
| `ACTION_MENU_X` | Secondary action |
| `ACTION_MENU_Y` | Tertiary action |
| `ACTION_MENU_UP` / `DOWN` / `LEFT` / `RIGHT` | D-pad navigation |
| `ACTION_MENU_PAGEUP` / `PAGEDOWN` | Shoulder button page scroll |
| `ACTION_MENU_LEFT_SCROLL` / `RIGHT_SCROLL` | Trigger scroll |
| `ACTION_MENU_STICK_PRESS` | Left stick click |
| `ACTION_MENU_OTHER_STICK_PRESS` | Right stick click |
| `ACTION_MENU_OTHER_STICK_UP` / `DOWN` / `LEFT` / `RIGHT` | Right stick directions (for menu navigation) |
| `ACTION_MENU_PAUSEMENU` | Start / Options button |
| `ACTION_MENU_OK` / `ACTION_MENU_CANCEL` | Confirm / cancel aliases (separate from A/B) |

The enum ends with `ACTION_MAX_MENU = ACTION_MENU_CANCEL` to mark the boundary between menu and gameplay actions.

Platform-specific menu actions:
- **Xbox One**: `ACTION_MENU_GTC_PAUSE`, `ACTION_MENU_GTC_RESUME` (Game Time Controller for snapped mode)
- **PS4**: `ACTION_MENU_TOUCHPAD_PRESS` (touchpad click)

### Gameplay actions

| Action | Description |
|---|---|
| `MINECRAFT_ACTION_JUMP` | Jump |
| `MINECRAFT_ACTION_FORWARD` / `BACKWARD` / `LEFT` / `RIGHT` | Movement (from left stick) |
| `MINECRAFT_ACTION_LOOK_LEFT` / `RIGHT` / `UP` / `DOWN` | Camera rotation (from right stick) |
| `MINECRAFT_ACTION_USE` | Use item / place block (left trigger) |
| `MINECRAFT_ACTION_ACTION` | Attack / break block (right trigger) |
| `MINECRAFT_ACTION_LEFT_SCROLL` / `RIGHT_SCROLL` | Hotbar scroll (shoulder buttons) |
| `MINECRAFT_ACTION_INVENTORY` | Open inventory (Y button) |
| `MINECRAFT_ACTION_PAUSEMENU` | Open pause menu (Start) |
| `MINECRAFT_ACTION_DROP` | Drop item (B button) |
| `MINECRAFT_ACTION_SNEAK_TOGGLE` | Toggle sneak (right stick click) |
| `MINECRAFT_ACTION_CRAFTING` | Open crafting (X button) |
| `MINECRAFT_ACTION_RENDER_THIRD_PERSON` | Toggle third-person camera |
| `MINECRAFT_ACTION_GAME_INFO` | Toggle debug info |
| `MINECRAFT_ACTION_DPAD_LEFT` / `RIGHT` / `UP` / `DOWN` | D-pad in gameplay (used for debug actions and hotbar shortcuts) |

The gameplay actions end with `MINECRAFT_ACTION_MAX`.

### Debug actions (derived from D-pad)

These aren't separate entries in the `EControllerActions` enum but are derived from D-pad presses in `Minecraft::run_middle()`:

| Action | Description |
|---|---|
| `MINECRAFT_ACTION_SPAWN_CREEPER` | Debug: spawn creeper |
| `MINECRAFT_ACTION_CHANGE_SKIN` | Debug: change player skin |
| `MINECRAFT_ACTION_FLY_TOGGLE` | Debug: toggle flight |
| `MINECRAFT_ACTION_RENDER_DEBUG` | Debug: toggle debug rendering |

These come after `MINECRAFT_ACTION_MAX` in the enum, so they're outside the normal gameplay action range.

## HandleButtonPresses

`CMinecraftApp::HandleButtonPresses()` is called once per frame from the platform-specific main loop (Xbox, PS3, PS4, PS Vita, Durango, Windows64). It loops through all pads:

```cpp
void CMinecraftApp::HandleButtonPresses()
{
    for each pad:
        HandleButtonPresses(iPad);
}
```

The per-pad version reads the controller state from the platform's input API and translates physical button/stick states into `EControllerActions`. This is where the abstraction happens: each platform has its own implementation of reading controller hardware, but they all feed into the same action enum.

The Windows 64-bit build also calls `HandleButtonPresses()` but routes through `KeyboardMouseInput` for keyboard/mouse events.

## KeyMapping

`KeyMapping` stores a named key binding:

```cpp
class KeyMapping {
public:
    wstring name;
    int key;
    KeyMapping(const wstring& name, int key);
};
```

The `Options` class holds 14 key mappings in a fixed-size array:

```cpp
static const int keyMappings_length = 14;
KeyMapping *keyMappings[keyMappings_length];
```

| Field | Default purpose |
|---|---|
| `keyUp` | Move forward |
| `keyDown` | Move backward |
| `keyLeft` | Strafe left |
| `keyRight` | Strafe right |
| `keyJump` | Jump |
| `keyBuild` | Place block / use item |
| `keyDrop` | Drop item |
| `keyChat` | Open chat |
| `keySneak` | Sneak |
| `keyAttack` | Attack / break |
| `keyUse` | Use item |
| `keyPlayerList` | Show player list |
| `keyPickItem` | Pick block |
| `keyToggleFog` | Toggle fog distance |

These are mainly used by the Windows 64-bit build. Console builds use the `EControllerActions` system instead. The Options class methods `getKeyDescription(int)`, `getKeyMessage(int)`, and `setKey(int, int)` provide access to these bindings.

## ConsoleInput / ConsoleInputSource

`ConsoleInput` represents a server console command:

```cpp
class ConsoleInput {
    wstring msg;
    ConsoleInputSource* source;
};
```

`ConsoleInputSource` is an interface for console command providers:

```cpp
class ConsoleInputSource {
    virtual void info(const wstring& string) = 0;
    virtual void warn(const wstring& string) = 0;
    virtual wstring getConsoleName() = 0;
};
```

These are used for the integrated server console, not player gameplay input.

## Input flow summary

1. **Platform layer** captures raw events (button presses, stick positions, key events, mouse movement). Each platform has its own main loop file (e.g., `Xbox_Minecraft.cpp`, `Orbis_Minecraft.cpp`, `Durango_Minecraft.cpp`, `PSVita_Minecraft.cpp`, `Windows64_Minecraft.cpp`).
2. **Input abstraction** (`KeyboardMouseInput` for Win64, or the platform's controller API via `4J_Input.h`) processes raw events into state. `KeyboardMouseInput` double-buffers with accumulators so events between ticks aren't lost.
3. **`CMinecraftApp::HandleButtonPresses()`** reads controller state per player and translates physical inputs to `EControllerActions`. Called once per frame from the platform main loop.
4. **`Input::tick()`** converts action state into movement axes (`xa`/`ya`) and action flags (`jumping`, `sneaking`, `sprinting`)
5. **`LocalPlayer`** reads the `Input` object each tick to update player movement and trigger actions
6. **`Screen` / `UIScene`** intercepts input when menus are active, grabbing events before they reach gameplay. Menu screens consume `ACTION_MENU_*` actions and prevent them from reaching the gameplay layer.

## Controller schemes

The `eGameSetting_ControlScheme` setting (see [Settings](/client/settings/)) controls which controller layout is active. The `eGameSetting_ControlSouthPaw` setting swaps the sticks for left-handed play.

The `eGameSetting_ControlInvertLook` setting inverts the Y-axis for the look stick.

## Split-screen input

LCE supports up to 4 local players via split-screen. Each player has their own pad index (`iPad`), and `HandleButtonPresses(iPad)` processes each pad independently. The `XUSER_MAX_COUNT` constant defines the maximum number of local players.

## MinecraftConsoles differences

MinecraftConsoles has a small addition to the controller input system:

- **`ACTION_MENU_QUICK_MOVE`** is added to the `EControllerActions` enum at position 834 (between the other menu actions). This provides a dedicated controller action for quick-moving items between inventories (like shift-clicking on PC). LCEMP doesn't have this as a separate action; players had to use a different button combination.

The `4J_Input.h` abstraction layer exists in both codebases as platform-specific headers under each platform's `4JLibs/inc/` directory (Orbis, Xbox, Durango, PS3, PSVita). The input architecture is otherwise the same between the two versions.
