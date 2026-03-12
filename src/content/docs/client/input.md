---
title: "Input System"
description: "How LCEMP handles keyboard, mouse, and controller input."
---

LCEMP supports three input sources: console controllers (the primary input on all platforms), keyboard and mouse (Windows 64 / macOS), and touch (PS Vita). The input system translates raw hardware events into game actions through several abstraction layers.

## Input class

`Input` is the base class for movement input that feeds into player control:

```cpp
class Input {
public:
    float xa;           // horizontal movement axis (-1 to 1)
    float ya;           // vertical movement axis (-1 to 1)

    bool wasJumping;
    bool jumping;
    bool sneaking;
    bool sprinting;

    virtual void tick(LocalPlayer* player);
};
```

Each local player has an `Input` instance that translates controller/keyboard state into the movement vector and action flags that the player entity consumes during its tick.

## KeyboardMouseInput

`KeyboardMouseInput` handles raw keyboard and mouse input on Windows 64. It is a global singleton (`g_KBMInput`):

```cpp
extern KeyboardMouseInput g_KBMInput;
```

### Key constants

```cpp
static const int MAX_KEYS = 256;
static const int MAX_MOUSE_BUTTONS = 3;  // left, right, middle
```

### Default key bindings

| Constant | Key | Action |
|---|---|---|
| `KEY_FORWARD` | `W` | Move forward |
| `KEY_BACKWARD` | `S` | Move backward |
| `KEY_LEFT` | `A` | Strafe left |
| `KEY_RIGHT` | `D` | Strafe right |
| `KEY_JUMP` | `Space` | Jump |
| `KEY_SNEAK` | `Left Shift` | Sneak |
| `KEY_SPRINT` | `Left Ctrl` | Sprint |
| `KEY_INVENTORY` | `E` | Open inventory |
| `KEY_DROP` | `Q` | Drop item |
| `KEY_CRAFTING` | `Tab` | Open crafting |
| `KEY_CRAFTING_ALT` | `R` | Open crafting (alternate) |
| `KEY_CONFIRM` | `Enter` | Confirm |
| `KEY_CANCEL` | `Backspace` | Cancel |
| `KEY_PAUSE` | `Escape` | Pause menu |
| `KEY_THIRD_PERSON` | `F5` | Toggle third-person view |
| `KEY_DEBUG_INFO` | `F3` | Toggle debug overlay |

### State tracking

The class maintains three state buffers for keys and mouse buttons:

- **Current frame** (`m_keyDown[]`, `m_mouseButtonDown[]`) -- currently held
- **Previous frame** (`m_keyDownPrev[]`, `m_mouseButtonDownPrev[]`) -- held last frame
- **Edge detection** (`m_keyPressed[]`, `m_keyReleased[]`) -- just pressed/released this frame

Accumulators (`m_keyPressedAccum[]`, etc.) collect events between `Tick()` calls to prevent missed inputs.

### Query API

| Method | Returns |
|---|---|
| `IsKeyDown(int vkCode)` | True if key is currently held |
| `IsKeyPressed(int vkCode)` | True if key was just pressed this frame |
| `IsKeyReleased(int vkCode)` | True if key was just released this frame |
| `IsMouseButtonDown(int button)` | True if mouse button is held |
| `IsMouseButtonPressed(int button)` | True if mouse button was just pressed |
| `IsMouseButtonReleased(int button)` | True if mouse button was just released |
| `GetMouseX()` / `GetMouseY()` | Current cursor position |
| `GetMouseDeltaX()` / `GetMouseDeltaY()` | Mouse movement this frame |
| `GetMouseWheel()` | Scroll wheel delta |
| `GetRawDeltaX()` / `GetRawDeltaY()` | Accumulated raw mouse delta |

### Mouse management

| Method | Purpose |
|---|---|
| `SetMouseGrabbed(bool)` | Lock cursor for gameplay (hides and centers cursor) |
| `SetCursorHiddenForUI(bool)` | Hide cursor during UI navigation |
| `SetWindowFocused(bool)` | Track window focus state |
| `ConsumeMouseDelta()` | Reset accumulated raw delta after reading |

### Movement helpers

```cpp
float GetMoveX() const;                     // WASD -> -1 to 1
float GetMoveY() const;                     // WASD -> -1 to 1
float GetLookX(float sensitivity) const;    // Mouse delta * sensitivity
float GetLookY(float sensitivity) const;    // Mouse delta * sensitivity
```

### KBM/controller switching

The `m_kbmActive` flag tracks whether the player is currently using keyboard/mouse or a controller. `HasAnyInput()` returns true if any input device produced events this frame.

## Controller actions (EControllerActions)

The `EControllerActions` enum (in `Common/App_enums.h`) defines all controller-mapped actions, split into menu and gameplay contexts:

### Menu actions

| Action | Description |
|---|---|
| `ACTION_MENU_A` | Confirm / Select |
| `ACTION_MENU_B` | Back / Cancel |
| `ACTION_MENU_X` | Secondary action |
| `ACTION_MENU_Y` | Tertiary action |
| `ACTION_MENU_UP/DOWN/LEFT/RIGHT` | D-pad navigation |
| `ACTION_MENU_PAGEUP` / `ACTION_MENU_PAGEDOWN` | Bumper page scrolling |
| `ACTION_MENU_RIGHT_SCROLL` / `ACTION_MENU_LEFT_SCROLL` | Trigger scrolling |
| `ACTION_MENU_STICK_PRESS` | Left stick click |
| `ACTION_MENU_OTHER_STICK_PRESS` | Right stick click |
| `ACTION_MENU_OTHER_STICK_UP/DOWN/LEFT/RIGHT` | Right stick directions |
| `ACTION_MENU_PAUSEMENU` | Start button |
| `ACTION_MENU_OK` | Generic confirm |
| `ACTION_MENU_CANCEL` | Generic cancel |

Platform-specific additions:
- Xbox One: `ACTION_MENU_GTC_PAUSE` / `ACTION_MENU_GTC_RESUME`
- PS4: `ACTION_MENU_TOUCHPAD_PRESS`

### Gameplay actions

| Action | Description |
|---|---|
| `MINECRAFT_ACTION_JUMP` | Jump |
| `MINECRAFT_ACTION_FORWARD/BACKWARD/LEFT/RIGHT` | Movement |
| `MINECRAFT_ACTION_LOOK_LEFT/RIGHT/UP/DOWN` | Camera rotation |
| `MINECRAFT_ACTION_USE` | Use item / place block |
| `MINECRAFT_ACTION_ACTION` | Attack / break block |
| `MINECRAFT_ACTION_LEFT_SCROLL` / `RIGHT_SCROLL` | Hotbar scrolling |
| `MINECRAFT_ACTION_INVENTORY` | Open inventory |
| `MINECRAFT_ACTION_PAUSEMENU` | Pause |
| `MINECRAFT_ACTION_DROP` | Drop item |
| `MINECRAFT_ACTION_SNEAK_TOGGLE` | Toggle sneak |
| `MINECRAFT_ACTION_CRAFTING` | Open crafting |
| `MINECRAFT_ACTION_RENDER_THIRD_PERSON` | Toggle camera view |
| `MINECRAFT_ACTION_GAME_INFO` | Show game info |
| `MINECRAFT_ACTION_DPAD_LEFT/RIGHT/UP/DOWN` | D-pad direct |

### Debug actions (derived from D-pad)

These are not directly mapped to the input manager but are synthesized from D-pad presses in `Minecraft::run_middle`:

| Action | Description |
|---|---|
| `MINECRAFT_ACTION_SPAWN_CREEPER` | Debug: spawn creeper |
| `MINECRAFT_ACTION_CHANGE_SKIN` | Debug: cycle skin |
| `MINECRAFT_ACTION_FLY_TOGGLE` | Debug: toggle flight |
| `MINECRAFT_ACTION_RENDER_DEBUG` | Debug: toggle debug info |

## KeyMapping

`KeyMapping` is a simple name-to-key binding:

```cpp
class KeyMapping {
public:
    wstring name;
    int key;
    KeyMapping(const wstring& name, int key);
};
```

## Options key bindings

The `Options` class stores 14 key mappings:

| Field | Default action |
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
| `keyAttack` | Attack |
| `keyUse` | Use item |
| `keyPlayerList` | Show player list |
| `keyPickItem` | Pick block |
| `keyToggleFog` | Cycle fog distance |

These are exposed as the `keyMappings[14]` array for serialization and the controls screen.

## Console game settings for input

The `eGameSetting` enum includes several input-related settings managed by `CMinecraftApp`:

| Setting | Description |
|---|---|
| `eGameSetting_Sensitivity_InGame` | Look sensitivity during gameplay |
| `eGameSetting_Sensitivity_InMenu` | Cursor sensitivity in menus |
| `eGameSetting_ControlScheme` | Controller layout preset |
| `eGameSetting_ControlInvertLook` | Invert Y axis |
| `eGameSetting_ControlSouthPaw` | Swap sticks for left-handed players |

## ConsoleInput

`ConsoleInput` wraps a message string with its source for server console commands:

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

## CMinecraftApp button handling

`CMinecraftApp::HandleButtonPresses()` processes controller input at the application level, routing button presses to the active UI scene or game state. It is called per-player (`HandleButtonPresses(int iPad)`) to support split-screen with independent controller routing.

## Split-screen input

Each local player is bound to a specific controller pad index. The `Minecraft` class tracks this through `localPlayerIdx` and per-player arrays. Input from each controller is routed to its associated `LocalPlayer` instance, and the `LocalPlayer::ullButtonsPressed` field aggregates the current frame's button state.
