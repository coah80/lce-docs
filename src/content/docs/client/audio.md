---
title: "Audio"
description: "Sound system in LCEMP."
---

LCEMP's audio system is built on the Miles Sound System (MSS) library, wrapped in a two-class hierarchy. `ConsoleSoundEngine` defines the platform interface, and `SoundEngine` provides the shared implementation. The system handles positional 3D audio, background music streaming, and UI sound effects.

## Architecture

### ConsoleSoundEngine (base class)

`ConsoleSoundEngine` in `Common/Audio/Consoles_SoundEngine.h` defines the pure virtual interface:

```cpp
class ConsoleSoundEngine {
public:
    virtual void tick(shared_ptr<Mob>* players, float a) = 0;
    virtual void destroy() = 0;
    virtual void play(int iSound, float x, float y, float z, float volume, float pitch) = 0;
    virtual void playStreaming(const wstring& name, float x, float y, float z,
                               float volume, float pitch, bool bMusicDelay = true) = 0;
    virtual void playUI(int iSound, float volume, float pitch) = 0;
    virtual void updateMusicVolume(float fVal) = 0;
    virtual void updateSystemMusicPlaying(bool isPlaying) = 0;
    virtual void updateSoundEffectVolume(float fVal) = 0;
    virtual void init(Options*) = 0;
    virtual void add(const wstring& name, File* file) = 0;
    virtual void addMusic(const wstring& name, File* file) = 0;
    virtual void addStreaming(const wstring& name, File* file) = 0;
    virtual char* ConvertSoundPathToName(const wstring& name, bool bConvertSpaces) = 0;
    virtual void playMusicTick() = 0;

    virtual bool GetIsPlayingStreamingCDMusic();
    virtual bool GetIsPlayingStreamingGameMusic();
    virtual void SetIsPlayingStreamingCDMusic(bool bVal);
    virtual void SetIsPlayingStreamingGameMusic(bool bVal);
    virtual bool GetIsPlayingEndMusic();
    virtual bool GetIsPlayingNetherMusic();
    virtual void SetIsPlayingEndMusic(bool bVal);
    virtual void SetIsPlayingNetherMusic(bool bVal);

    static const WCHAR* wchSoundNames[eSoundType_MAX];
    static const WCHAR* wchUISoundNames[eSFX_MAX];
};
```

The sound name tables (`wchSoundNames` and `wchUISoundNames`) map sound type enums (defined in `Minecraft.World/SoundTypes.h`) to human-readable names.

### SoundEngine (implementation)

`SoundEngine` extends `ConsoleSoundEngine` with the Miles Sound System backend:

```cpp
class SoundEngine : public ConsoleSoundEngine {
    static const int MAX_SAME_SOUNDS_PLAYING = 8;

    HMSOUNDBANK m_hBank;      // sound bank handle
    HDIGDRIVER m_hDriver;      // audio driver handle
    HSTREAM m_hStream;         // streaming handle
};
```

## Miles Sound System integration

The Miles Sound System headers are included per platform:

| Platform | Header path |
|---|---|
| PS3 | `PS3/Miles/include/mss.h` |
| PS Vita | `PSVITA/Miles/include/mss.h` |
| Xbox One (Durango) | `Durango/Miles/include/mss.h` |
| PS4 (Orbis) | `Orbis/Miles/include/mss.h` |
| Windows 64 | `Windows64/Miles/include/mss.h` |

Xbox 360 uses the native XAudio system instead of Miles.

## 3D audio

### Listener system

The engine supports multiple listeners for split-screen:

```cpp
AUDIO_LISTENER m_ListenerA[MAX_LOCAL_PLAYERS];
int m_validListenerCount;
```

Each listener has:

```cpp
typedef struct {
    bool bValid;
    AUDIO_VECTOR vPosition;       // world position
    AUDIO_VECTOR vOrientFront;    // facing direction
} AUDIO_LISTENER;
```

### Sound playback

The `AUDIO_INFO` struct describes a sound to play:

```cpp
typedef struct {
    F32 x, y, z;           // world position
    F32 volume, pitch;
    int iSound;             // sound type ID
    bool bIs3D;             // positional audio
    bool bUseSoundsPitchVal;
} AUDIO_INFO;
```

Key playback methods:

| Method | Purpose |
|---|---|
| `play(iSound, x, y, z, volume, pitch)` | Play a 3D positional sound |
| `playUI(iSound, volume, pitch)` | Play a non-positional UI sound |
| `playStreaming(name, x, y, z, volume, pitch, bMusicDelay)` | Start streaming music |

The `MAX_SAME_SOUNDS_PLAYING = 8` limit stops the same sound effect from stacking too much. Per-sound tracking is kept in `CurrentSoundsPlaying[eSoundType_MAX + eSFX_MAX]`.

### Sound invocation from game code

`LevelRenderer` is the bridge between game events and audio:

```cpp
void playSound(int iSound, double x, double y, double z,
               float volume, float pitch, float fSoundClipDist = 16.0f);
void playStreamingMusic(const wstring& name, int x, int y, int z);
```

The `fSoundClipDist` parameter (default 16 blocks) controls how far away a sound can be heard.

## Music system

### Music file enumeration

The `eMUSICFILES` enum lists all music tracks:

**Overworld:**
- `eStream_Overworld_Calm1` through `Calm3`
- `eStream_Overworld_hal1` through `hal4`
- `eStream_Overworld_nuance1`, `nuance2`
- `eStream_Overworld_piano1` through `piano3`
- Creative mode tracks (non-Xbox): `Creative1` through `Creative6`
- Menu tracks (non-Xbox): `Menu1` through `Menu4`

**Nether:**
- `eStream_Nether1` through `Nether4`

**The End:**
- `eStream_end_dragon`, `eStream_end_end`

**Music discs (CD):**
- `eStream_CD_1` through `eStream_CD_12`

Total: `eStream_Max` entries.

### Music types

```cpp
enum eMUSICTYPE {
    eMusicType_None,
    eMusicType_Game,
    eMusicType_CD,
};
```

### Music streaming state machine

```cpp
enum MUSIC_STREAMSTATE {
    eMusicStreamState_Idle,
    eMusicStreamState_Stop,
    eMusicStreamState_Stopping,
    eMusicStreamState_Opening,
    eMusicStreamState_OpeningCancel,
    eMusicStreamState_Play,
    eMusicStreamState_Playing,
    eMusicStreamState_Completed,
};
```

Music streaming runs on a dedicated thread:

```cpp
C4JThread* m_openStreamThread;
static int OpenStreamThreadProc(void* lpParameter);
```

### Music selection

`getMusicID(int iDomain)` picks a random track that fits the current dimension. The track ranges are configurable per texture/mash-up pack:

```cpp
void SetStreamingSounds(int iOverworldMin, int iOverWorldMax,
                        int iNetherMin, int iNetherMax,
                        int iEndMin, int iEndMax, int iCD1);
```

`GetRandomishTrack(iStart, iEnd)` selects a track, using `m_bHeardTrackA` to avoid playing the same track back to back.

### Music tick

`playMusicTick()` is called each game tick. It manages the delay between tracks (`m_iMusicDelay`) and drives the streaming state machine. `playMusicUpdate()` handles the actual state transitions.

### CD music (jukeboxes)

Music disc playback is tracked separately. The `m_CDMusic` field stores the current disc track name. `GetIsPlayingStreamingCDMusic()` and `SetIsPlayingStreamingCDMusic()` manage this state.

## Volume control

| Method | Purpose |
|---|---|
| `updateMusicVolume(float fVal)` | Set master music volume (0.0 to 1.0) |
| `updateSoundEffectVolume(float fVal)` | Set master SFX volume (0.0 to 1.0) |
| `updateSystemMusicPlaying(bool isPlaying)` | Handle system music (e.g., Spotify) overlay |
| `getMasterMusicVolume()` | Get effective music volume |

The master volumes (`m_MasterMusicVolume`, `m_MasterEffectsVolume`) are set from the `Options` class values.

## Sound bank and driver

The Miles Sound System uses:
- **`HMSOUNDBANK m_hBank`** is the loaded sound bank containing all SFX
- **`HDIGDRIVER m_hDriver`** is the digital audio driver
- **`HSTREAM m_hStream`** is the current streaming music handle

Sound files and music files get registered through `add()`, `addMusic()`, and `addStreaming()` during initialization.

## DLC audio

DLC packs (mash-up packs) can provide their own audio through `DLCAudioFile.h`. The `TexturePack::hasAudio()` method tells you whether a pack includes custom audio. When a DLC pack with audio is active, `SetStreamingSounds()` reconfigures the music track ranges.

Audio resources are stored in:
- `Common/res/audio/` for base game sound banks
- `Common/res/TitleUpdate/audio/` for title update audio additions

## Platform-specific notes

- **PS3**: `initAudioHardware()` has a platform-specific implementation for Cell audio initialization
- **PS4 (Orbis)**: Uses `int32_t m_hBGMAudio` for the background music audio handle
- **PS Vita**: Miles integration through a Vita-specific MSS build with `updateMiles()` called during the mixer callback
- **Xbox 360**: Uses native XAudio instead of Miles (no `mss.h` include)

## MinecraftConsoles differences

MinecraftConsoles adds a large batch of new sound types to `SoundTypes.h`. These cover mobs and features that don't exist in LCEMP:

### Firework sounds

- `eSoundType_FIREWORKS_LAUNCH`
- `eSoundType_FIREWORKS_BLAST` / `_FAR`
- `eSoundType_FIREWORKS_LARGE_BLAST` / `_FAR`
- `eSoundType_FIREWORKS_TWINKLE` / `_FAR`

### Bat sounds

- `eSoundType_MOB_BAT_IDLE`, `_HURT`, `_DEATH`, `_TAKEOFF`

### Wither sounds

- `eSoundType_MOB_WITHER_SPAWN`, `_IDLE`, `_HURT`, `_DEATH`, `_SHOOT`

### Horse sounds (the longest batch)

- `eSoundType_MOB_HORSE_LAND`, `_ARMOR`, `_LEATHER`
- Variant death sounds: `_ZOMBIE_DEATH`, `_SKELETON_DEATH`, `_DONKEY_DEATH`, `_DEATH`
- Variant hurt sounds: `_ZOMBIE_HIT`, `_SKELETON_HIT`, `_DONKEY_HIT`, `_HIT`
- Variant idle sounds: `_ZOMBIE_IDLE`, `_SKELETON_IDLE`, `_DONKEY_IDLE`, `_IDLE`
- `_DONKEY_ANGRY`, `_ANGRY`, `_GALLOP`, `_BREATHE`, `_WOOD`

### Mob step/ambient sounds

A bunch of mob step sounds are added that LCEMP was missing:

- `eSoundType_MOB_COW_STEP`, `_CHICKEN_STEP`, `_PIG_STEP`
- `eSoundType_MOB_ENDERMAN_STARE`, `_SCREAM`
- `eSoundType_MOB_SHEEP_SHEAR`, `_SHEEP_STEP`
- `eSoundType_MOB_SKELETON_DEATH`, `_SKELETON_STEP`
- `eSoundType_MOB_SPIDER_STEP`
- `eSoundType_MOB_WOLF_STEP`
- `eSoundType_MOB_ZOMBIE_STEP`
- `eSoundType_LIQUID_SWIM`

### Bug fix

`eSoundType_MOB_CAT_HITT` (typo with double T) is fixed to `eSoundType_MOB_CAT_HIT`.
