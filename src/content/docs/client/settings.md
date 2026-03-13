---
title: "Settings"
description: "Game settings and options in LCE."
---

LCE manages settings at two levels. The `Options` class handles legacy Java-style game options (graphics, controls, keybindings), while the `CMinecraftApp` game settings system manages console-specific per-player profile settings. The `Settings` class provides a simple key-value property store for server configuration.

## Options class

`Options` is the main settings container, owned by the `Minecraft` instance. It manages graphics preferences, input sensitivity, key bindings, and gameplay toggles.

### Option definitions

The inner `Options::Option` class describes each configurable setting. It's stored in a static array of 17 entries (the Java code originally used an enum, 4J emulated it with a class):

```cpp
class Option {
    const bool _isProgress;     // slider-based (float value)
    const bool _isBoolean;      // toggle (true/false)
    const wstring captionId;    // localization key (e.g., "options.music")

    bool isProgress() const;
    bool isBoolean() const;
    int getId() const;          // computed as (this - options), the index in the static array
    wstring getCaptionId() const;
};
```

Options that are neither progress nor boolean are "choice" options (cycled through a fixed set of names).

### All options

| Static constant | Type | Localization key | Purpose |
|---|---|---|---|
| `MUSIC` | Progress | `options.music` | Music volume (0.0 to 1.0) |
| `SOUND` | Progress | `options.sound` | Sound effects volume (0.0 to 1.0) |
| `INVERT_MOUSE` | Boolean | `options.invertMouse` | Invert Y-axis |
| `SENSITIVITY` | Progress | `options.sensitivity` | Mouse/stick sensitivity |
| `RENDER_DISTANCE` | Choice | `options.renderDistance` | View distance: Far, Normal, Short, Tiny |
| `VIEW_BOBBING` | Boolean | `options.viewBobbing` | Camera bobbing while walking |
| `ANAGLYPH` | Boolean | `options.anaglyph` | Stereoscopic 3D mode |
| `ADVANCED_OPENGL` | Boolean | `options.advancedOpengl` | Advanced rendering features |
| `FRAMERATE_LIMIT` | Choice | `options.framerateLimit` | FPS cap |
| `DIFFICULTY` | Choice | `options.difficulty` | Peaceful, Easy, Normal, Hard |
| `GRAPHICS` | Choice | `options.graphics` | Fancy vs. fast graphics |
| `AMBIENT_OCCLUSION` | Boolean | `options.ao` | Smooth lighting |
| `GUI_SCALE` | Choice | `options.guiScale` | Auto, Small, Normal, Large |
| `FOV` | Progress | `options.fov` | Field of view |
| `GAMMA` | Progress | `options.gamma` | Brightness |
| `RENDER_CLOUDS` | Boolean | `options.renderClouds` | Cloud rendering |
| `PARTICLES` | Choice | `options.particles` | All, Decreased, Minimal |

**Choice name arrays:**

| Option | Values |
|---|---|
| `RENDER_DISTANCE_NAMES` | `"options.renderDistance.far"`, `"options.renderDistance.normal"`, `"options.renderDistance.short"`, `"options.renderDistance.tiny"` |
| `DIFFICULTY_NAMES` | `"options.difficulty.peaceful"`, `"options.difficulty.easy"`, `"options.difficulty.normal"`, `"options.difficulty.hard"` |
| `GUI_SCALE` | `"options.guiScale.auto"`, `"options.guiScale.small"`, `"options.guiScale.normal"`, `"options.guiScale.large"` |
| `FRAMERATE_LIMITS` | (defined in .cpp, values vary) |
| `PARTICLES` | (0 = all, 1 = decreased, 2 = minimal) |

**Ambient occlusion constants:** `AO_OFF` = 0, `AO_MIN` = 1, `AO_MAX` = 2.

### Settings fields

```cpp
// Audio
float music;                // 0.0 to 1.0
float sound;                // 0.0 to 1.0

// Input
float sensitivity;          // mouse/stick sensitivity
bool invertYMouse;          // invert Y-axis look

// Graphics
int viewDistance;            // 0=far, 1=normal, 2=short, 3=tiny
bool bobView;               // camera bobbing
bool anaglyph3d;            // stereoscopic 3D
bool advancedOpengl;        // advanced GL features
int framerateLimit;         // FPS cap setting
bool fancyGraphics;         // fancy vs fast graphics
bool ambientOcclusion;      // smooth lighting
bool renderClouds;          // show clouds
int guiScale;               // 0=auto, 1=small, 2=normal, 3=large
int particles;              // 0=all, 1=decreased, 2=minimal
float fov;                  // field of view
float gamma;                // brightness

// Gameplay
int difficulty;             // 0=peaceful, 1=easy, 2=normal, 3=hard
bool hideGui;               // hide the HUD
bool thirdPersonView;       // third-person camera active
bool renderDebug;           // debug overlay active

// Flight (creative/spectator)
bool isFlying;              // currently flying
bool smoothCamera;          // cinematic camera mode
bool fixedCamera;           // locked camera
float flySpeed;             // creative flight speed
float cameraSpeed;          // camera movement speed

// Network
wstring lastMpIp;           // last multiplayer IP address

// Skin
wstring skin;               // selected skin name
```

### Key bindings

`Options` holds 14 `KeyMapping` instances in a fixed array:

```cpp
static const int keyMappings_length = 14;
KeyMapping *keyMappings[keyMappings_length];
```

Each mapping stores a name (`wstring`) and virtual key code (`int`):

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
| `Options(minecraft, workingDirectory)` | Full constructor with file path for persistence |
| `Options()` | Default constructor |
| `init()` | 4J addition: initializes member variables |
| `set(Option*, float)` | Set a progress option value |
| `toggle(Option*, int dir)` | Cycle a choice/boolean option |
| `getProgressValue(Option*)` | Read a float option |
| `getBooleanValue(Option*)` | Read a boolean option |
| `getMessage(Option*)` | Get the display string for an option's current value |
| `getKeyDescription(int)` | Get the name of a key binding by index |
| `getKeyMessage(int)` | Get the display message for a key binding |
| `setKey(int, int)` | Change a key binding |
| `load()` | Load settings from file |
| `save()` | Save settings to file |
| `isCloudsOn()` | Returns `renderClouds` |

### Persistence

Options are saved to a file in the working directory (stored as `optionsFile`). The `load()` method reads key-value pairs using `BufferedReader`, `InputStreamReader`, and `FileInputStream`. The `save()` method writes them back through `FileOutputStream` and `DataOutputStream`. The `readFloat()` helper parses float values from the file format.

## Console game settings (eGameSetting)

The `CMinecraftApp` class manages per-player profile settings through the `eGameSetting` enum and `GAME_SETTINGS` struct. These are the settings that actually matter on console because the `Options` class is mainly for the Java-style settings used by the Win64 port.

### All game settings

| Setting | Type | Notes |
|---|---|---|
| `eGameSetting_MusicVolume` | Byte | 0-255 |
| `eGameSetting_SoundFXVolume` | Byte | 0-255 |
| `eGameSetting_Gamma` | Byte | Brightness |
| `eGameSetting_Difficulty` | Byte | 0-3 (Peaceful through Hard) |
| `eGameSetting_Sensitivity_InGame` | Byte | Gameplay stick sensitivity |
| `eGameSetting_Sensitivity_InMenu` | Byte | Menu cursor sensitivity |
| `eGameSetting_ViewBob` | Byte | Camera bobbing toggle |
| `eGameSetting_ControlScheme` | Byte | Controller layout (different button mappings) |
| `eGameSetting_ControlInvertLook` | Byte | Invert Y-axis look |
| `eGameSetting_ControlSouthPaw` | Byte | Left-handed controls (swaps sticks) |
| `eGameSetting_SplitScreenVertical` | Byte | Vertical split-screen layout (vs horizontal) |
| `eGameSetting_GamertagsVisible` | Byte | Show player names in-world |
| `eGameSetting_Autosave` | Byte | Auto-save enabled |
| `eGameSetting_DisplaySplitscreenGamertags` | Byte | Show names in split-screen specifically |
| `eGameSetting_Hints` | Byte | Show gameplay hints/tips |
| `eGameSetting_InterfaceOpacity` | Byte | HUD transparency level |
| `eGameSetting_Tooltips` | Byte | Show item tooltips |
| `eGameSetting_Clouds` | Byte | Cloud rendering toggle |
| `eGameSetting_Online` | Byte | Online mode |
| `eGameSetting_InviteOnly` | Byte | Invite-only sessions |
| `eGameSetting_FriendsOfFriends` | Byte | Allow friends of friends to join |
| `eGameSetting_DisplayUpdateMessage` | Byte | Show update notifications |
| `eGameSetting_BedrockFog` | Byte | Bedrock fog effect |
| `eGameSetting_DisplayHUD` | Byte | HUD visibility |
| `eGameSetting_DisplayHand` | Byte | First-person hand visibility |
| `eGameSetting_CustomSkinAnim` | Byte | Custom skin animations |
| `eGameSetting_DeathMessages` | Byte | Death messages in chat |
| `eGameSetting_UISize` | Byte | UI scale |
| `eGameSetting_UISizeSplitscreen` | Byte | UI scale in split-screen |
| `eGameSetting_AnimatedCharacter` | Byte | Animated character on menu screen |
| `eGameSetting_PS3_EULA_Read` | Byte | PS3: EULA accepted flag |
| `eGameSetting_PSVita_NetworkModeAdhoc` | Byte | Vita: ad-hoc networking mode |
| `eGameSetting_Fullscreen` | Byte | Windows 64: fullscreen mode |

All settings are stored as unsigned bytes (0-255), even for boolean toggles (0 or 1). The enum values are sequential starting from 0.

### Profile data layout

Game settings are stored in a fixed-size block at the start of profile data:

```cpp
static const int GAME_SETTINGS_PROFILE_DATA_BYTES = 204;
static const int GAME_DEFINED_PROFILE_DATA_BYTES = 972; // per user
```

The 204-byte `GAME_SETTINGS` struct at the start holds all the settings values. The 204-byte limit is kept for backward compatibility with pre-TU5 save data. The remaining bytes in the 972-byte `GAME_DEFINED_PROFILE_DATA_BYTES` block store statistics and achievement data (with room for extended achievements by doubling).

The profile data for all users is saved together as `GAME_DEFINED_PROFILE_DATA_BYTES * XUSER_MAX_COUNT` bytes.

### Access methods

```cpp
void SetGameSettings(int iPad, eGameSetting eVal, unsigned char ucVal);
unsigned char GetGameSettings(int iPad, eGameSetting eVal);
void ActionGameSettings(int iPad, eGameSetting eVal);
void CheckGameSettingsChanged(bool bOverride5MinuteTimer = false, int iPad = XUSER_INDEX_ANY);
void ApplyGameSettingsChanged(int iPad);
```

`SetGameSettings()` writes a value for a specific pad/player. `GetGameSettings()` reads it. `ActionGameSettings()` applies a setting immediately (for settings that need instant feedback like volume changes).

Settings changes are batched and applied through `ApplyGameSettingsChanged()`. The system checks for changes periodically (with a 5-minute timer controlled by `CheckGameSettingsChanged()`) or when explicitly requested with `bOverride5MinuteTimer = true`. The `XUSER_INDEX_ANY` constant means "all users."

## Game host options (eGameHostOption)

Host-controlled world settings stored in the save data. These are per-world, not per-player.

| Option | Description |
|---|---|
| `eGameHostOption_Difficulty` | World difficulty (0-3) |
| `eGameHostOption_OnlineGame` | (Unused) |
| `eGameHostOption_InviteOnly` | (Unused) |
| `eGameHostOption_FriendsOfFriends` | Allow friends of friends |
| `eGameHostOption_Gamertags` | Show player names |
| `eGameHostOption_Tutorial` | Tutorial mode (special case) |
| `eGameHostOption_GameType` | Survival / Creative |
| `eGameHostOption_LevelType` | Default / Flat |
| `eGameHostOption_Structures` | Generate structures |
| `eGameHostOption_BonusChest` | Spawn bonus chest |
| `eGameHostOption_HasBeenInCreative` | Tracks if creative was ever used (disables achievements) |
| `eGameHostOption_PvP` | Player vs Player |
| `eGameHostOption_TrustPlayers` | Trust all players (allow building near spawn) |
| `eGameHostOption_TNT` | TNT explodes |
| `eGameHostOption_FireSpreads` | Fire spreads |
| `eGameHostOption_CheatsEnabled` | Commands/cheats (special case) |
| `eGameHostOption_HostCanFly` | Host flight privilege |
| `eGameHostOption_HostCanChangeHunger` | Host hunger control |
| `eGameHostOption_HostCanBeInvisible` | Host invisibility |
| `eGameHostOption_BedrockFog` | Bedrock fog effect |
| `eGameHostOption_NoHUD` | Disable HUD |
| `eGameHostOption_All` | Bitmask sentinel (marks the end of the toggleable range) |
| `eGameHostOption_DisableSaving` | Disable world saving |

Host options are packed into a `unsigned int` bitmask and accessed through:

```cpp
void SetGameHostOption(eGameHostOption eVal, unsigned int uiVal);
unsigned int GetGameHostOption(eGameHostOption eVal);
```

Some options are marked as "special case" in the code comments: `Tutorial` and `CheatsEnabled` have extra logic beyond simple boolean toggling.

### Achievement eligibility

`CanRecordStatsAndAchievements()` checks whether the current host options allow achievements. Things like creative mode (`HasBeenInCreative`), cheats, and certain debug flags will disable achievement recording. Once `HasBeenInCreative` is set, it stays set for the lifetime of that world.

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

It wraps an `unordered_map<wstring, wstring>` and provides typed getters with defaults. The integrated server uses it for configuration like server name, port, max players, etc. `generateNewProperties()` creates the file with defaults if it doesn't exist. `saveProperties()` writes the current map back to disk.

## Player skin and cape settings

Skin and cape selection is managed per player through `CMinecraftApp`:

```cpp
// Skin
void SetPlayerSkin(int iPad, const wstring& name);
void SetPlayerSkin(int iPad, DWORD dwSkinId);
wstring GetPlayerSkinName(int iPad);
DWORD GetPlayerSkinId(int iPad);

// Cape
void SetPlayerCape(int iPad, const wstring& name);
void SetPlayerCape(int iPad, DWORD dwCapeId);
wstring GetPlayerCapeName(int iPad);
DWORD GetPlayerCapeId(int iPad);
```

Both skins and capes can be set by name (string) or by numeric ID (DWORD). The getters work both ways too.

### Favorite skins

Players can save a set of favorite skins for quick access:

```cpp
void SetPlayerFavoriteSkin(int iPad, int iIndex, unsigned int uiSkinID);
unsigned int GetPlayerFavoriteSkin(int iPad, int iIndex);
unsigned char GetPlayerFavoriteSkinsPos(int iPad);
void ValidateFavoriteSkins(int iPad);  // checks DLC availability
```

`ValidateFavoriteSkins()` checks that each favorited skin still comes from an available DLC pack. If a DLC gets removed or expires, the favorites pointing to it get cleared.

## Opacity timer

The HUD opacity temporarily goes back to full when the player changes hotbar selections:

```cpp
void SetOpacityTimer(int iPad);       // starts a 6-second (120 tick) countdown
void TickOpacityTimer(int iPad);      // decrements each tick
unsigned int GetOpacityTimer(int iPad);
```

When `GetOpacityTimer()` returns a non-zero value, the HUD renders at full opacity regardless of the `InterfaceOpacity` setting. This gives players a brief window to see the full HUD after switching hotbar slots.

## Debug settings

Debug options are gated behind a special input sequence:

```cpp
void SetDebugSequence(const char* pchSeq);
bool DebugSettingsOn();
unsigned int GetGameSettingsDebugMask(int iPad = -1, bool bOverridePlayer = false);
void SetGameSettingsDebugMask(int iPad, unsigned int uiVal);
void ActionDebugMask(int iPad, bool bSetAllClear = false);
```

Debug masks are stored per player in `uiDebugOptionsA[XUSER_MAX_COUNT]` on the `Minecraft` class. The `#ifdef _DEBUG_MENUS_ENABLED` guard controls whether debug menus are compiled in. `SetDebugSequence()` sets the button sequence needed to unlock debug options. `DebugSettingsOn()` returns whether the sequence has been entered.

## Localization

Language selection is per-player:

```cpp
void SetMinecraftLanguage(int iPad, unsigned char ucLanguage);
unsigned char GetMinecraftLanguage(int iPad);
```

The `eMCLang` enum defines all supported languages. It's a big list:

| Range | Languages |
|---|---|
| Core | English (US, GB, IE, AU, NZ, CA), Japanese, German (DE, AT, CH), French (FR, CA, BE, CH) |
| European | Spanish (ES, MX), Italian, Korean, Portuguese (PT, BR), Russian, Dutch (NL, BE) |
| Nordic | Finnish, Swedish, Danish (DA, DK), Norwegian (NO, nb-NO) |
| Other | Polish, Turkish, Greek, Chinese (Simplified, Traditional, SG, CN, HK, TW), Latin American Spanish |
| Regional | English variants for GR, HK, SA, HU, IN, IL, SG, SK, ZA |

The enum starts with `eMCLang_null` (0) and goes up from there, with each locale getting its own value.

## MinecraftConsoles differences

MinecraftConsoles tweaks the settings system in a few places:

### New game settings

- **`eGameSetting_RenderDistance`** is added (at position 2, between SoundFX and Gamma) for per-player render distance control. LCEMP handles render distance only through the `Options` class.
- **`eGameSetting_FOV`** is added (at position 4, between Gamma and Difficulty) for per-player field of view. Same deal, LCEMP only has this in `Options`.
- **`eGameSetting_Fullscreen`** is removed (it was a Windows 64-bit only setting in LCEMP and MC doesn't have a Win64 build).

### New host options

The `eGameHostOption` enum gets significantly expanded. After `eGameHostOption_NoHUD`, MC adds:

| Option | Purpose |
|---|---|
| `eGameHostOption_WorldSize` | World size selection (small, medium, large) |
| `eGameHostOption_All` | (bitmask sentinel, moved to after WorldSize) |
| `eGameHostOption_DisableSaving` | (same as LCEMP) |
| `eGameHostOption_WasntSaveOwner` | PS3 save transfer tracking (so the game can show a message instead of the creative mode warning) |
| `eGameHostOption_MobGriefing` | Whether mobs can destroy blocks |
| `eGameHostOption_KeepInventory` | Keep items on death |
| `eGameHostOption_DoMobSpawning` | Natural mob spawning |
| `eGameHostOption_DoMobLoot` | Mob drops |
| `eGameHostOption_DoTileDrops` | Block drops |
| `eGameHostOption_NaturalRegeneration` | Health regeneration from hunger |
| `eGameHostOption_DoDaylightCycle` | Day/night cycle |

These are the gamerule equivalents from PC Minecraft 1.6.1+, exposed as host options in the console UI instead of chat commands. They map directly to the vanilla `GameRules` constants added in MC (see [Game Rules](/world/gamerules/)).
