---
title: "Input System"
description: "How LCEMP handles keyboard, mouse, and controller input."
---

LCEMP supports three input methods: gamepad controllers (the main one for all console platforms), keyboard/mouse (Windows 64-bit port), and touch (PS Vita). The input system is spread across several classes that abstract platform differences and feed into the game's action system.

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

#### Mouse constants

| Constant | Value |
|---|---|
| `MOUSE_LEFT` | 0 |
| `MOUSE_RIGHT` | 1 |
| `MOUSE_MIDDLE` | 2 |
| `MAX_MOUSE_BUTTONS` | 3 |

#### State tracking

The class tracks three states per key and mouse button:

- **Down**: currently held
- **Pressed**: went from up to down this tick
- **Released**: went from down to up this tick

State is double-buffered with accumulators (`m_keyPressedAccum`, `m_keyReleasedAccum`) that collect events between ticks, then get transferred to the readable state arrays during `Tick()`.

#### Key methods

| Method | Purpose |
|---|---|
| `Init()` | Zero all state arrays |
| `Tick()` | Transfer accumulated events to readable state |
| `ClearAllState()` | Reset everything |
| `OnKeyDown(int vkCode)` / `OnKeyUp(int vkCode)` | Keyboard event handlers |
| `OnMouseButtonDown(int)` / `OnMouseButtonUp(int)` | Mouse button events |
| `OnMouseMove(int x, int y)` | Cursor position update |
| `OnMouseWheel(int delta)` | Scroll wheel |
| `OnRawMouseDelta(int dx, int dy)` | Raw mouse movement for look |
| `IsKeyDown(int)` / `IsKeyPressed(int)` / `IsKeyReleased(int)` | Key state queries |
| `IsMouseButtonDown(int)` / `IsMouseButtonPressed(int)` / `IsMouseButtonReleased(int)` | Mouse state queries |
| `GetMoveX()` / `GetMoveY()` | Movement axis from WASD |
| `GetLookX(float sensitivity)` / `GetLookY(float sensitivity)` | Look axis from mouse delta |
| `SetMouseGrabbed(bool)` | Lock cursor for gameplay |
| `ConsumeMouseDelta()` | Clear raw delta accumulators after reading |

#### Focus and cursor management

```cpp
void SetWindowFocused(bool focused);
void SetCursorHiddenForUI(bool hidden);
void SetKBMActive(bool active);
void SetScreenCursorHidden(bool hidden);
bool HasAnyInput() const;
```

`HasAnyInput()` returns true when any key or mouse event has happened. This is handy for figuring out whether to switch between controller and keyboard/mouse input modes.

## Controller input (EControllerActions)

Controller input is mapped through the `EControllerActions` enum defined in `Common/App_enums.h`. This gives you a unified action system across all console platforms.

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
| `ACTION_MENU_STICK_PRESS` / `OTHER_STICK_PRESS` | Stick click |
| `ACTION_MENU_PAUSEMENU` | Start / Options button |
| `ACTION_MENU_OK` / `CANCEL` | Confirm / cancel aliases |

Platform-specific menu actions:
- **Xbox One**: `ACTION_MENU_GTC_PAUSE`, `ACTION_MENU_GTC_RESUME` (Game Time Controller)
- **PS4**: `ACTION_MENU_TOUCHPAD_PRESS`

### Gameplay actions

| Action | Description |
|---|---|
| `MINECRAFT_ACTION_JUMP` | Jump |
| `MINECRAFT_ACTION_FORWARD` / `BACKWARD` / `LEFT` / `RIGHT` | Movement |
| `MINECRAFT_ACTION_LOOK_LEFT` / `RIGHT` / `UP` / `DOWN` | Camera rotation |
| `MINECRAFT_ACTION_USE` | Use item / place block |
| `MINECRAFT_ACTION_ACTION` | Attack / break block |
| `MINECRAFT_ACTION_LEFT_SCROLL` / `RIGHT_SCROLL` | Hotbar scroll |
| `MINECRAFT_ACTION_INVENTORY` | Open inventory |
| `MINECRAFT_ACTION_PAUSEMENU` | Open pause menu |
| `MINECRAFT_ACTION_DROP` | Drop item |
| `MINECRAFT_ACTION_SNEAK_TOGGLE` | Toggle sneak |
| `MINECRAFT_ACTION_CRAFTING` | Open crafting |
| `MINECRAFT_ACTION_RENDER_THIRD_PERSON` | Toggle third-person camera |
| `MINECRAFT_ACTION_GAME_INFO` | Toggle debug info |
| `MINECRAFT_ACTION_DPAD_LEFT` / `RIGHT` / `UP` / `DOWN` | D-pad in gameplay |

### Debug actions (created from D-pad)

These aren't mapped directly to the input manager but are derived from D-pad presses in `Minecraft::run_middle()`:

| Action | Description |
|---|---|
| `MINECRAFT_ACTION_SPAWN_CREEPER` | Debug: spawn creeper |
| `MINECRAFT_ACTION_CHANGE_SKIN` | Debug: change player skin |
| `MINECRAFT_ACTION_FLY_TOGGLE` | Debug: toggle flight |
| `MINECRAFT_ACTION_RENDER_DEBUG` | Debug: toggle debug rendering |

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

The `Options` class holds 14 key mappings:

| Field | Default purpose |
|---|---|
| `keyUp` | Move forward |
| `keyDown` | Move backward |
| `keyLeft` | Strafe left |
| `keyRight` | Strafe right |
| `keyJump` | Jump |
| `keyBuild` | Place block |
| `keyDrop` | Drop item |
| `keyChat` | Open chat |
| `keySneak` | Sneak |
| `keyAttack` | Attack / break |
| `keyUse` | Use item |
| `keyPlayerList` | Show player list |
| `keyPickItem` | Pick block |
| `keyToggleFog` | Toggle fog distance |

These are mainly used by the Windows 64-bit build. Console builds use the `EControllerActions` system instead.

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

1. **Platform layer** captures raw events (button presses, stick positions, key events, mouse movement)
2. **Input abstraction** (`KeyboardMouseInput` or platform controller API) processes raw events into state
3. **`CMinecraftApp::HandleButtonPresses()`** reads controller state per player and translates to `EControllerActions`
4. **`Input::tick()`** converts action state into movement axes (`xa`/`ya`) and action flags (`jumping`, `sneaking`, `sprinting`)
5. **`LocalPlayer`** reads the `Input` object each tick to update player movement and trigger actions
6. **`Screen` / `UIScene`** intercepts input when menus are active, grabbing events before they reach gameplay

## MinecraftConsoles differences

MinecraftConsoles has a small addition to the controller input system:

- **`ACTION_MENU_QUICK_MOVE`** is added to the `EControllerActions` enum. This provides a dedicated controller action for quick-moving items between inventories (like shift-clicking on PC). LCEMP doesn't have this as a separate action.

The `4J_Input.h` abstraction layer exists in both codebases as platform-specific headers under each platform's `4JLibs/inc/` directory (Orbis, Xbox, Durango, PS3, PSVita). The input architecture is otherwise the same between the two versions.
