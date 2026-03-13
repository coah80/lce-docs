---
title: "Settings"
description: "Game settings and options in LCEMP."
---

LCEMP manages settings at two levels. The `Options` class handles legacy Java-style game options (graphics, controls, keybindings), while the `CMinecraftApp` game settings system manages console-specific per-player profile settings. The `Settings` class provides a simple key-value property store for server configuration.

## Options class

`Options` is the main settings container, owned by the `Minecraft` instance. It manages graphics preferences, input sensitivity, key bindings, and gameplay toggles.

### Option definitions

The inner `Options::Option` class describes each configurable setting:

```cpp
class Option {
    const bool _isProgress;     // slider-based (float value)
    const bool _isBoolean;      // toggle (true/false)
    const wstring captionId;    // localization key

    bool isProgress() const;
    bool isBoolean() const;
    int getId() const;
    wstring getCaptionId() const;
};
```

### All options

| Static constant | Type | Purpose |
|---|---|---|
| `MUSIC` | Progress | Music volume (0.0 to 1.0) |
| `SOUND` | Progress | Sound effects volume (0.0 to 1.0) |
| `INVERT_MOUSE` | Boolean | Invert Y-axis |
| `SENSITIVITY` | Progress | Mouse/stick sensitivity |
| `RENDER_DISTANCE` | Choice | View distance (Tiny/Short/Normal/Far) |
| `VIEW_BOBBING` | Boolean | Camera bobbing while walking |
| `ANAGLYPH` | Boolean | Stereoscopic 3D mode |
| `ADVANCED_OPENGL` | Boolean | Advanced rendering features |
| `FRAMERATE_LIMIT` | Choice | FPS cap |
| `DIFFICULTY` | Choice | Game difficulty |
| `GRAPHICS` | Boolean | Fancy vs. fast graphics |
| `AMBIENT_OCCLUSION` | Boolean | Smooth lighting |
| `GUI_SCALE` | Choice | GUI size multiplier |
| `FOV` | Progress | Field of view |
| `GAMMA` | Progress | Brightness |
| `RENDER_CLOUDS` | Boolean | Cloud rendering |
| `PARTICLES` | Choice | Particle density (All/Decreased/Minimal) |

### Settings fields

```cpp
// Audio
float music;
float sound;

// Input
float sensitivity;
bool invertYMouse;

// Graphics
int viewDistance;
bool bobView;
bool anaglyph3d;
bool advancedOpengl;
int framerateLimit;
bool fancyGraphics;
bool ambientOcclusion;
bool renderClouds;
int guiScale;
int particles;          // 0=all, 1=decreased, 2=minimal
float fov;
float gamma;

// Gameplay
int difficulty;
bool hideGui;
bool thirdPersonView;
bool renderDebug;

// Flight (creative/spectator)
bool isFlying;
bool smoothCamera;
bool fixedCamera;
float flySpeed;
float cameraSpeed;

// Network
wstring lastMpIp;

// Skin
wstring skin;
```

### Key bindings

`Options` holds 14 `KeyMapping` instances:

```cpp
KeyMapping* keyMappings[14];
```

Each mapping stores a name and virtual key code:

| Field | Default action |
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
| `keyUse` | Use |
| `keyPlayerList` | Player list |
| `keyPickItem` | Pick block |
| `keyToggleFog` | Cycle fog distance |

### Methods

| Method | Purpose |
|---|---|
| `set(Option*, float)` | Set a progress option value |
| `toggle(Option*, int dir)` | Cycle a choice/boolean option |
| `getProgressValue(Option*)` | Read a float option |
| `getBooleanValue(Option*)` | Read a boolean option |
| `getMessage(Option*)` | Get the display string for an option's current value |
| `getKeyDescription(int)` | Get the name of a key binding |
| `setKey(int, int)` | Change a key binding |
| `load()` | Load settings from file |
| `save()` | Save settings to file |

### Persistence

Options are saved to a file in the working directory. The `load()` method reads key-value pairs, and `save()` writes them back. The `readFloat()` helper parses float values from the file format.

## Console game settings (eGameSetting)

The `CMinecraftApp` class manages per-player profile settings through the `eGameSetting` enum and `GAME_SETTINGS` struct:

### All game settings

| Setting | Type | Notes |
|---|---|---|
| `eGameSetting_MusicVolume` | Byte | 0-255 |
| `eGameSetting_SoundFXVolume` | Byte | 0-255 |
| `eGameSetting_Gamma` | Byte | Brightness |
| `eGameSetting_Difficulty` | Byte | 0-3 |
| `eGameSetting_Sensitivity_InGame` | Byte | Gameplay sensitivity |
| `eGameSetting_Sensitivity_InMenu` | Byte | Menu cursor sensitivity |
| `eGameSetting_ViewBob` | Byte | Camera bobbing |
| `eGameSetting_ControlScheme` | Byte | Controller layout |
| `eGameSetting_ControlInvertLook` | Byte | Invert Y-axis |
| `eGameSetting_ControlSouthPaw` | Byte | Left-handed controls |
| `eGameSetting_SplitScreenVertical` | Byte | Vertical split-screen layout |
| `eGameSetting_GamertagsVisible` | Byte | Show player names |
| `eGameSetting_Autosave` | Byte | Auto-save enabled |
| `eGameSetting_DisplaySplitscreenGamertags` | Byte | Show names in split-screen |
| `eGameSetting_Hints` | Byte | Show hints/tips |
| `eGameSetting_InterfaceOpacity` | Byte | HUD transparency |
| `eGameSetting_Tooltips` | Byte | Show tooltips |
| `eGameSetting_Clouds` | Byte | Cloud rendering |
| `eGameSetting_Online` | Byte | Online mode |
| `eGameSetting_InviteOnly` | Byte | Invite-only sessions |
| `eGameSetting_FriendsOfFriends` | Byte | Allow friends of friends |
| `eGameSetting_DisplayUpdateMessage` | Byte | Show update notifications |
| `eGameSetting_BedrockFog` | Byte | Bedrock fog effect |
| `eGameSetting_DisplayHUD` | Byte | HUD visibility |
| `eGameSetting_DisplayHand` | Byte | First-person hand visibility |
| `eGameSetting_CustomSkinAnim` | Byte | Custom skin animations |
| `eGameSetting_DeathMessages` | Byte | Death messages in chat |
| `eGameSetting_UISize` | Byte | UI scale |
| `eGameSetting_UISizeSplitscreen` | Byte | UI scale in split-screen |
| `eGameSetting_AnimatedCharacter` | Byte | Animated character on menu |
| `eGameSetting_PS3_EULA_Read` | Byte | PS3: EULA accepted |
| `eGameSetting_PSVita_NetworkModeAdhoc` | Byte | Vita: ad-hoc networking |
| `eGameSetting_Fullscreen` | Byte | Windows 64: fullscreen mode |

### Profile data layout

Game settings are stored in a fixed-size block at the start of profile data:

```cpp
static const int GAME_SETTINGS_PROFILE_DATA_BYTES = 204;
static const int GAME_DEFINED_PROFILE_DATA_BYTES = 972; // per user (doubled for extended achievements)
```

The 204-byte limit is kept for backward compatibility with pre-TU5 save data. The remaining profile bytes store statistics and achievement data.

### Access methods

```cpp
void SetGameSettings(int iPad, eGameSetting eVal, unsigned char ucVal);
unsigned char GetGameSettings(int iPad, eGameSetting eVal);
void ActionGameSettings(int iPad, eGameSetting eVal);
void CheckGameSettingsChanged(bool bOverride5MinuteTimer = false, int iPad = XUSER_INDEX_ANY);
void ApplyGameSettingsChanged(int iPad);
```

Settings changes are batched and applied through `ApplyGameSettingsChanged()`. The system checks for changes periodically (with a 5-minute timer) or when explicitly requested.

## Game host options (eGameHostOption)

Host-controlled world settings stored in the save data:

| Option | Description |
|---|---|
| `eGameHostOption_Difficulty` | World difficulty |
| `eGameHostOption_Gamertags` | Show player names |
| `eGameHostOption_GameType` | Survival / Creative |
| `eGameHostOption_LevelType` | Default / Flat |
| `eGameHostOption_Structures` | Generate structures |
| `eGameHostOption_BonusChest` | Spawn bonus chest |
| `eGameHostOption_HasBeenInCreative` | Tracks if creative was ever used |
| `eGameHostOption_PvP` | Player vs Player |
| `eGameHostOption_TrustPlayers` | Trust all players |
| `eGameHostOption_TNT` | TNT explodes |
| `eGameHostOption_FireSpreads` | Fire spreads |
| `eGameHostOption_CheatsEnabled` | Commands/cheats |
| `eGameHostOption_HostCanFly` | Host flight |
| `eGameHostOption_HostCanChangeHunger` | Host hunger control |
| `eGameHostOption_HostCanBeInvisible` | Host invisibility |
| `eGameHostOption_BedrockFog` | Bedrock fog |
| `eGameHostOption_NoHUD` | Disable HUD |
| `eGameHostOption_DisableSaving` | Disable world saving |

Host options are packed into a `unsigned int` bitmask and accessed through:

```cpp
void SetGameHostOption(eGameHostOption eVal, unsigned int uiVal);
unsigned int GetGameHostOption(eGameHostOption eVal);
```

### Achievement eligibility

`CanRecordStatsAndAchievements()` checks whether the current host options allow achievements. Things like creative mode, cheats, and certain debug flags will disable achievement recording.

## Settings class

The `Settings` class is a simple key-value property store for server configuration:

```cpp
class Settings {
    Settings(File* file);
    void generateNewProperties();
    void saveProperties();
    wstring getString(const wstring& key, const wstring& defaultValue);
    int getInt(const wstring& key, int defaultValue);
    bool getBoolean(const wstring& key, bool defaultValue);
    void setBooleanAndSave(const wstring& key, bool value);
};
```

It wraps an `unordered_map<wstring, wstring>` and provides typed getters with defaults. The integrated server uses it for configuration like server name, port, max players, etc.

## Player skin and cape settings

Skin and cape selection is managed per player through `CMinecraftApp`:

```cpp
void SetPlayerSkin(int iPad, const wstring& name);
void SetPlayerSkin(int iPad, DWORD dwSkinId);
wstring GetPlayerSkinName(int iPad);
DWORD GetPlayerSkinId(int iPad);

void SetPlayerCape(int iPad, const wstring& name);
void SetPlayerCape(int iPad, DWORD dwCapeId);
wstring GetPlayerCapeName(int iPad);
DWORD GetPlayerCapeId(int iPad);
```

### Favorite skins

Players can save a set of favorite skins:

```cpp
void SetPlayerFavoriteSkin(int iPad, int iIndex, unsigned int uiSkinID);
unsigned int GetPlayerFavoriteSkin(int iPad, int iIndex);
unsigned char GetPlayerFavoriteSkinsPos(int iPad);
void ValidateFavoriteSkins(int iPad);  // checks DLC availability
```

## Opacity timer

The HUD opacity temporarily goes back to full when the player changes hotbar selections:

```cpp
void SetOpacityTimer(int iPad);       // starts a 6-second (120 tick) countdown
void TickOpacityTimer(int iPad);      // decrements each tick
unsigned int GetOpacityTimer(int iPad);
```

## Debug settings

Debug options are gated behind a special input sequence:

```cpp
void SetDebugSequence(const char* pchSeq);
bool DebugSettingsOn();
unsigned int GetGameSettingsDebugMask(int iPad = -1, bool bOverridePlayer = false);
void SetGameSettingsDebugMask(int iPad, unsigned int uiVal);
void ActionDebugMask(int iPad, bool bSetAllClear = false);
```

Debug masks are stored per player in `uiDebugOptionsA[XUSER_MAX_COUNT]` on the `Minecraft` class. The `#ifdef _DEBUG_MENUS_ENABLED` guard controls whether debug menus are compiled in.

## Localization

Language selection is per-player:

```cpp
void SetMinecraftLanguage(int iPad, unsigned char ucLanguage);
unsigned char GetMinecraftLanguage(int iPad);
```

The `eMCLang` enum defines all supported languages (30+ locales including English, Japanese, German, French, Spanish, Italian, Korean, Portuguese, Russian, Dutch, Finnish, Swedish, Danish, Norwegian, Polish, Turkish, Greek, Chinese variants, Czech, and Slovak).

## MinecraftConsoles differences

MinecraftConsoles tweaks the settings system in a few places:

### New game settings

- **`eGameSetting_RenderDistance`** is added for per-player render distance control. LCEMP handles render distance only through the `Options` class.
- **`eGameSetting_FOV`** is added for per-player field of view. Same deal, LCEMP only has this in `Options`.
- **`eGameSetting_Fullscreen`** is removed (it was a Windows 64-bit only setting in LCEMP).

### New host options

The `eGameHostOption` enum gets significantly expanded with game rule options that map to vanilla Minecraft's gamerule system:

| Option | Purpose |
|---|---|
| `eGameHostOption_WorldSize` | World size selection |
| `eGameHostOption_WasntSaveOwner` | PS3 save transfer tracking |
| `eGameHostOption_MobGriefing` | Whether mobs can destroy blocks |
| `eGameHostOption_KeepInventory` | Keep items on death |
| `eGameHostOption_DoMobSpawning` | Natural mob spawning |
| `eGameHostOption_DoMobLoot` | Mob drops |
| `eGameHostOption_DoTileDrops` | Block drops |
| `eGameHostOption_NaturalRegeneration` | Health regeneration from hunger |
| `eGameHostOption_DoDaylightCycle` | Day/night cycle |

These are the gamerule equivalents from PC Minecraft 1.6.1+, exposed as host options in the console UI instead of chat commands.
