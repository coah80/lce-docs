---
title: "Audio"
description: "Sound system in LCE."
---

LCE's audio system is wrapped in a two-class hierarchy. `ConsoleSoundEngine` defines the platform interface, and `SoundEngine` provides the shared implementation. The system handles positional 3D audio, background music streaming, and UI sound effects.

The original console builds used the **Miles Sound System** (MSS) library from RAD Game Tools. LCEMP has replaced Miles with **miniaudio** (`miniaudio.h`), a single-header C audio library. The API surface is the same (the `ConsoleSoundEngine` interface hasn't changed), but the backend is different. Xbox 360 used native XAudio instead of Miles.

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

The sound name tables (`wchSoundNames` and `wchUISoundNames`) map sound type enums (defined in `Minecraft.World/SoundTypes.h`) to human-readable names. These are defined in `SoundNames.cpp` and must stay in sync with the enum order.

### SoundEngine (implementation)

`SoundEngine` extends `ConsoleSoundEngine`. In LCEMP, it uses miniaudio as the backend:

```cpp
class SoundEngine : public ConsoleSoundEngine {
    static const int MAX_SAME_SOUNDS_PLAYING = 8;

    ma_engine m_maEngine;                     // miniaudio engine
    bool m_maEngineInitialized;

    ma_sound m_activeSounds[MA_MAX_SOUNDS];   // active sound pool (64 slots)
    bool m_activeSoundUsed[MA_MAX_SOUNDS];

    ma_sound m_musicStream;                   // current streaming music
    bool m_musicStreamActive;
};
```

`MA_MAX_SOUNDS` is 64, the maximum number of sounds that can play at once. The engine manages this pool with `findFreeSoundSlot()` (finds a free slot) and `cleanupFinishedSounds()` (reclaims slots from finished sounds).

:::note
The original console builds used the Miles Sound System (MSS). The MSS headers were included per platform (`PS3/Miles/include/mss.h`, `PSVITA/Miles/include/mss.h`, `Durango/Miles/include/mss.h`, `Orbis/Miles/include/mss.h`, `Windows64/Miles/include/mss.h`). Xbox 360 used native XAudio instead of Miles. LCEMP replaced all of this with miniaudio.
:::

## The sound pipeline

Game code never touches Miles directly. The chain goes:

```
Entity/Level code
    |
    v
LevelListener::playSound()
    |
    v
ServerLevelListener --> LevelSoundPacket (network)
    |
    v
SoundEngine::play()   -- 3D positioned sound
SoundEngine::playUI()  -- non-positional UI sound
SoundEngine::playStreaming() -- music / jukebox
```

When `SoundEngine::play()` fires, it converts the dot-separated sound name to a file path using `ConvertSoundPathToName()` and plays it through the audio backend. In the original Miles builds, this produced event names like `"Minecraft/mob.zombie"`. In LCEMP's miniaudio backend, it resolves to audio files on disk.

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

### Splitscreen listener handling

In splitscreen, the engine can't just set one listener position. Instead, it calculates the **Manhattan distance** from each sound to every active player, picks the closest one, and uses that distance for the 3D falloff. The listener is placed at the origin and the sound is placed along the Z axis at the calculated distance. This gives reasonable spatial audio across all screen splits.

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

## Sound attenuation

All 3D sounds use a custom linear falloff function instead of the default engine rolloff. In the original Miles builds, this was registered as a callback. LCEMP implements the same logic in miniaudio:

```cpp
F32 AILCALLBACK custom_falloff_function(
    HSAMPLE S, F32 distance, F32 rolloff_factor, F32 min_dist, F32 max_dist)
{
    // Thunder has no attenuation at all
    if (max_dist == 10000.0f)
        return 1.0f;

    // Linear falloff: full volume at distance 0, silent at max_dist
    F32 result = 1.0f - (distance / max_dist);
    if (result < 0.0f) result = 0.0f;
    if (result > 1.0f) result = 1.0f;
    return result;
}
```

The `max_dist` parameter (called `distanceScaler` in the code) controls how far a sound carries:

| Sound type | Distance (blocks) | Notes |
|---|---|---|
| Most sounds | 16 | Default `fSoundClipDist` |
| Ghast sounds | 30 | Audible from further away |
| Ender Dragon | 100 | Boss sounds carry far |
| Thunder | 10,000 | Effectively infinite, always full volume |
| Music discs | 64 | Jukebox carries 4x further than normal |

## Sound categories

Sounds are grouped by naming prefix. Every sound in the game has an entry in the `eSOUND_TYPE` enum in `SoundTypes.h`.

### Mob sounds (`mob.*`)

Ambient, hurt, death, and step sounds for every mob:

| Enum pattern | String name pattern | Notes |
|---|---|---|
| `eSoundType_MOB_ZOMBIE_AMBIENT` | `mob.zombie` | Idle groaning |
| `eSoundType_MOB_ZOMBIE_HURT` | `mob.zombiehurt` | Taking damage |
| `eSoundType_MOB_ZOMBIE_DEATH` | `mob.zombiedeath` | Dying |
| `eSoundType_MOB_CREEPER_HURT` | `mob.creeper` | Creeper hurt |
| `eSoundType_MOB_WOLF_BARK` | `mob.wolf.bark` | Wolf barking |
| `eSoundType_MOB_WOLF_HURT` | `mob.wolf.hurt` | Wolf hurt |
| `eSoundType_MOB_WOLF_DEATH` | `mob.wolf.death` | Wolf death |
| `eSoundType_MOB_WOLF_GROWL` | `mob.wolf.growl` | Wolf growl |
| `eSoundType_MOB_WOLF_PANTING` | `mob.wolf.panting` | Tamed wolf panting |
| `eSoundType_MOB_WOLF_WHINE` | `mob.wolf.whine` | Wolf whine |
| `eSoundType_MOB_WOLF_SHAKE` | `mob.wolf.shake` | Wolf shaking off water |
| `eSoundType_MOB_CAT_HITT` | `mob.cat.hit` | Cat hit |
| `eSoundType_MOB_CAT_PURR` | `mob.cat.purr` | Cat purr |
| `eSoundType_MOB_CAT_PURREOW` | `mob.cat.purreow` | Cat purr-meow |
| `eSoundType_MOB_CAT_MEOW` | `mob.cat.meow` | Cat meow |
| `eSoundType_MOB_CHICKEN_AMBIENT` | `mob.chicken` | Chicken clucking |
| `eSoundType_MOB_CHICKEN_HURT` | `mob.chickenhurt` | Chicken hurt |
| `eSoundType_MOB_CHICKENPLOP` | `mob.chickenplop` | Egg laying |
| `eSoundType_MOB_COW_AMBIENT` | `mob.cow` | Cow mooing |
| `eSoundType_MOB_COW_HURT` | `mob.cowhurt` | Cow hurt |
| `eSoundType_MOB_PIG_AMBIENT` | `mob.pig` | Pig oinking |
| `eSoundType_MOB_PIG_DEATH` | `mob.pig.death` | Pig death |
| `eSoundType_MOB_SHEEP_AMBIENT` | `mob.sheep` | Sheep bleating |
| `eSoundType_MOB_GHAST_MOAN` | `mob.ghast.moan` | Ghast moaning |
| `eSoundType_MOB_GHAST_DEATH` | `mob.ghast.death` | Ghast death |
| `eSoundType_MOB_GHAST_FIREBALL` | `mob.ghast.fireball` | Ghast shooting |
| `eSoundType_MOB_GHAST_SCREAM` | `mob.ghast.scream` | Ghast screaming |
| `eSoundType_MOB_GHAST_CHARGE` | `mob.ghast.charge` | Ghast charging |
| `eSoundType_MOB_BLAZE_HURT` | `mob.blaze.hit` | Blaze hurt |
| `eSoundType_MOB_BLAZE_DEATH` | `mob.blaze.death` | Blaze death |
| `eSoundType_MOB_BLAZE_BREATHE` | `mob.blaze.breathe` | Blaze ambient |
| `eSoundType_MOB_ENDERMEN_IDLE` | `mob.endermen.idle` | Enderman ambient |
| `eSoundType_MOB_ENDERMEN_HIT` | `mob.endermen.hit` | Enderman hurt |
| `eSoundType_MOB_ENDERMEN_DEATH` | `mob.endermen.death` | Enderman death |
| `eSoundType_MOB_ENDERMEN_PORTAL` | `mob.endermen.portal` | Enderman teleport |
| `eSoundType_MOB_ZOMBIEPIG_AMBIENT` | `mob.zombiepig.zpig` | Zombie pigman idle |
| `eSoundType_MOB_ZOMBIEPIG_HURT` | `mob.zombiepig.zpighurt` | Zombie pigman hurt |
| `eSoundType_MOB_ZOMBIEPIG_DEATH` | `mob.zombiepig.zpigdeath` | Zombie pigman death |
| `eSoundType_MOB_ZOMBIEPIG_ZPIGANGRY` | `mob.zombiepig.zpigangry` | Zombie pigman angry |
| `eSoundType_MOB_ENDERDRAGON_GROWL` | `mob.enderdragon.growl` | Dragon growl |
| `eSoundType_MOB_ENDERDRAGON_HIT` | `mob.enderdragon.hit` | Dragon hurt |
| `eSoundType_MOB_ENDERDRAGON_MOVE` | `mob.enderdragon.move` | Dragon wingflap |
| `eSoundType_MOB_ENDERDRAGON_END` | `mob.enderdragon.end` | Dragon death |
| `eSoundType_MOB_SILVERFISH_AMBIENT` | `mob.silverfish.say` | Silverfish ambient |
| `eSoundType_MOB_SILVERFISH_HURT` | `mob.silverfish.hit` | Silverfish hurt |
| `eSoundType_MOB_SILVERFISH_DEATH` | `mob.silverfish.kill` | Silverfish death |
| `eSoundType_MOB_SILVERFISH_STEP` | `mob.silverfish.step` | Silverfish walk |
| `eSoundType_MOB_SKELETON_AMBIENT` | `mob.skeleton` | Skeleton ambient |
| `eSoundType_MOB_SKELETON_HURT` | `mob.skeleton.hurt` | Skeleton hurt |
| `eSoundType_MOB_SPIDER_AMBIENT` | `mob.spider` | Spider ambient |
| `eSoundType_MOB_SPIDER_DEATH` | `mob.spiderdeath` | Spider death |
| `eSoundType_MOB_SLIME` | `mob.slime` | Slime |
| `eSoundType_MOB_SLIME_ATTACK` | `mob.slimeattack` | Slime attack |
| `eSoundType_MOB_CREEPER_DEATH` | `mob.creeperdeath` | Creeper death |
| `eSoundType_MOB_ZOMBIE_WOOD` | `mob.zombie.wood` | Zombie hitting wood door |
| `eSoundType_MOB_ZOMBIE_WOOD_BREAK` | `mob.zombie.woodbreak` | Zombie breaking wood door |
| `eSoundType_MOB_ZOMBIE_METAL` | `mob.zombie.metal` | Zombie hitting metal door |
| `eSoundType_MOB_MAGMACUBE_BIG` | `mob.magmacube.big` | Large magma cube |
| `eSoundType_MOB_MAGMACUBE_SMALL` | `mob.magmacube.small` | Small magma cube |
| `eSoundType_MOB_IRONGOLEM_THROW` | `mob.irongolem.throw` | Iron golem throw |
| `eSoundType_MOB_IRONGOLEM_HIT` | `mob.irongolem.hit` | Iron golem hurt |
| `eSoundType_MOB_IRONGOLEM_DEATH` | `mob.irongolem.death` | Iron golem death |
| `eSoundType_MOB_IRONGOLEM_WALK` | `mob.irongolem.walk` | Iron golem walk |
| `eSoundType_MOB_VILLAGER_HAGGLE` | `mob.villager.haggle` | Villager trading |
| `eSoundType_MOB_VILLAGER_IDLE` | `mob.villager.idle` | Villager ambient |
| `eSoundType_MOB_VILLAGER_HIT` | `mob.villager.hit` | Villager hurt |
| `eSoundType_MOB_VILLAGER_DEATH` | `mob.villager.death` | Villager death |
| `eSoundType_MOB_VILLAGER_YES` | `mob.villager.yes` | Villager accepting trade |
| `eSoundType_MOB_VILLAGER_NO` | `mob.villager.no` | Villager declining trade |
| `eSoundType_MOB_ZOMBIE_INFECT` | `mob.zombie.infect` | Zombie infecting villager |
| `eSoundType_MOB_ZOMBIE_UNFECT` | `mob.zombie.unfect` | Zombie villager curing |
| `eSoundType_MOB_ZOMBIE_REMEDY` | `mob.zombie.remedy` | Zombie cure remedy |

### Block/tile sounds (`step.*`, `dig.*`, `tile.*`)

| Enum | String name | Used for |
|---|---|---|
| `eSoundType_STEP_STONE` | `step.stone` | Walking on stone |
| `eSoundType_STEP_WOOD` | `step.wood` | Walking on wood |
| `eSoundType_STEP_GRAVEL` | `step.gravel` | Walking on gravel |
| `eSoundType_STEP_GRASS` | `step.grass` | Walking on grass |
| `eSoundType_STEP_METAL` | `step.metal` | Walking on metal |
| `eSoundType_STEP_CLOTH` | `step.cloth` | Walking on wool |
| `eSoundType_STEP_SAND` | `step.sand` | Walking on sand |
| `eSoundType_STEP_SNOW` | `step.snow` | Walking on snow |
| `eSoundType_STEP_LADDER` | `step.ladder` | Climbing ladders |
| `eSoundType_DIG_GRASS` | `dig.grass` | Breaking grass blocks |
| `eSoundType_DIG_STONE` | `dig.stone` | Breaking stone |
| `eSoundType_DIG_WOOD` | `dig.wood` | Breaking wood |
| `eSoundType_DIG_GRAVEL` | `dig.gravel` | Breaking gravel |
| `eSoundType_DIG_CLOTH` | `dig.cloth` | Breaking wool |
| `eSoundType_DIG_SAND` | `dig.sand` | Breaking sand |
| `eSoundType_DIG_SNOW` | `dig.snow` | Breaking snow |
| `eSoundType_TILE_PISTON_IN` | `tile.piston.in` | Piston retracting |
| `eSoundType_TILE_PISTON_OUT` | `tile.piston.out` | Piston extending |

### Random/gameplay sounds (`random.*`)

| Enum | String name | Used for |
|---|---|---|
| `eSoundType_RANDOM_EXPLODE` | `random.explode` | Explosions |
| `eSoundType_RANDOM_BOW` | `random.bow` | Firing a bow |
| `eSoundType_RANDOM_CHEST_OPEN` | `random.chestopen` | Opening a chest |
| `eSoundType_RANDOM_CHEST_CLOSE` | `random.chestclosed` | Closing a chest |
| `eSoundType_RANDOM_DOOR_OPEN` | `random.door_open` | Opening a door |
| `eSoundType_RANDOM_DOOR_CLOSE` | `random.door_close` | Closing a door |
| `eSoundType_RANDOM_CLICK` | `random.click` | Buttons, levers |
| `eSoundType_RANDOM_GLASS` | `random.glass` | Breaking glass |
| `eSoundType_RANDOM_FIZZ` | `random.fizz` | Fire extinguish, lava pop |
| `eSoundType_RANDOM_POP` | `random.pop` | Item pickup |
| `eSoundType_RANDOM_ORB` | `random.orb` | Experience orb pickup |
| `eSoundType_RANDOM_SPLASH` | `random.splash` | Water splash |
| `eSoundType_RANDOM_DRINK` | `random.drink` | Drinking potion |
| `eSoundType_RANDOM_EAT` | `random.eat` | Eating food |
| `eSoundType_RANDOM_ANVIL_USE` | `random.anvil_use` | Using an anvil |
| `eSoundType_RANDOM_ANVIL_LAND` | `random.anvil_land` | Falling anvil landing |
| `eSoundType_RANDOM_ANVIL_BREAK` | `random.anvil_break` | Anvil breaking |
| `eSoundType_RANDOM_FUSE` | `random.fuse` | TNT fuse |
| `eSoundType_RANDOM_BOW_HIT` | `random.bowhit` | Arrow hitting target |
| `eSoundType_RANDOM_BURP` | `random.burp` | Burping after eating |
| `eSoundType_RANDOM_BREAK` | `random.break` | Item breaking |

### Ambient sounds (`ambient.*`)

| Enum | String name |
|---|---|
| `eSoundType_AMBIENT_WEATHER_RAIN` | `ambient.weather.rain` |
| `eSoundType_AMBIENT_WEATHER_THUNDER` | `ambient.weather.thunder` |
| `eSoundType_AMBIENT_CAVE_CAVE` | `ambient.cave.cave` |

### Other categories

| Prefix | Examples | Purpose |
|---|---|---|
| `portal.*` | `portal.portal`, `portal.trigger`, `portal.travel` | Portal effects |
| `fire.*` | `fire.ignite`, `fire.fire` | Fire sounds |
| `damage.*` | `damage.hurtflesh`, `damage.fallsmall`, `damage.fallbig`, `damage.thorns` | Player damage |
| `note.*` | `note.harp`, `note.bd`, `note.snare`, `note.hat`, `note.bassattack` | Note blocks |
| `liquid.*` | `liquid.water`, `liquid.lava`, `liquid.lavapop` | Liquid sounds |
| `minecart.*` | `minecart.base`, `minecart.inside` | Minecart movement |

### UI sounds (ESoundEffect)

UI sounds are a separate, smaller enum:

```cpp
enum ESoundEffect
{
    eSFX_Back,       // "back"
    eSFX_Craft,      // "craft"
    eSFX_CraftFail,  // "craftfail"
    eSFX_Focus,      // "focus"
    eSFX_Press,      // "press"
    eSFX_Scroll,     // "scroll"
    eSFX_MAX
};
```

These get played through `SoundEngine::playUI()` and are routed to the `"Minecraft/UI/"` event path in the soundbank.

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

File paths follow the pattern `music/<trackname>.binka` for background music and `cds/<discname>.binka` for music discs. The `.binka` format is Bink Audio (compressed, from RAD Game Tools).

### Music types

```cpp
enum eMUSICTYPE {
    eMusicType_None,
    eMusicType_Game,   // background music (not 3D positioned)
    eMusicType_CD,     // jukebox music (3D positioned, attenuates with distance)
};
```

Background music plays globally with no 3D positioning. Jukebox music is 3D-positioned at the jukebox block with a distance scaler of 64 blocks (4x the normal sound range).

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

The state transitions:

```
Idle --> Opening --> Playing --> Completed --> Stop --> Stopping --> Idle
```

`OpeningCancel` handles the case where a new track is requested while one is still opening.

Music streaming runs on a dedicated thread:

```cpp
C4JThread* m_openStreamThread;
static int OpenStreamThreadProc(void* lpParameter);
```

### Music selection

`getMusicID(int iDomain)` picks a random track that fits the current dimension:

```cpp
int SoundEngine::getMusicID(int iDomain)
{
    switch (iDomain)
    {
    case LevelData::DIMENSION_END:
        return m_iStream_End_Min;  // always plays dragon-alive track
    case LevelData::DIMENSION_NETHER:
        return GetRandomishTrack(m_iStream_Nether_Min, m_iStream_Nether_Max);
    default:
        return GetRandomishTrack(m_iStream_Overworld_Min, m_iStream_Overworld_Max);
    }
}
```

The track ranges are configurable per texture/mash-up pack:

```cpp
void SetStreamingSounds(int iOverworldMin, int iOverWorldMax,
                        int iNetherMin, int iNetherMax,
                        int iEndMin, int iEndMax, int iCD1);
```

`GetRandomishTrack(iStart, iEnd)` selects a track, using `m_bHeardTrackA` to avoid playing the same track back to back. Once all tracks in the range have been heard, the array resets. It doesn't try too hard, so occasionally you will hear the same track twice.

### Music tick

`playMusicTick()` is called each game tick. It manages the delay between tracks (`m_iMusicDelay`, up to about 3 minutes of random delay) and drives the streaming state machine. `playMusicUpdate()` handles the actual state transitions.

### CD music (jukeboxes)

Music disc playback is tracked separately. The `m_CDMusic` field stores the current disc track name. `GetIsPlayingStreamingCDMusic()` and `SetIsPlayingStreamingCDMusic()` manage this state. The track name gets matched against the `m_szStreamFileA` array to find the right file.

## Volume control

| Method | Purpose |
|---|---|
| `updateMusicVolume(float fVal)` | Set master music volume (0.0 to 1.0) |
| `updateSoundEffectVolume(float fVal)` | Set master SFX volume (0.0 to 1.0) |
| `updateSystemMusicPlaying(bool isPlaying)` | Handle system music (e.g., Spotify) overlay |
| `getMasterMusicVolume()` | Get effective music volume |

The master volumes (`m_MasterMusicVolume`, `m_MasterEffectsVolume`) are set from the `Options` class values.

## Sound bank and driver

In the original console builds, the Miles Sound System used a compiled sound bank (`Minecraft.msscmp`) containing all SFX, loaded into `HMSOUNDBANK m_hBank`. `HDIGDRIVER m_hDriver` was the audio driver handle, and `HSTREAM m_hStream` was the streaming music handle.

LCEMP replaces this with miniaudio. The `ma_engine` handles mixing and output, `ma_sound` instances manage individual sounds (up to 64 active in `m_activeSounds[]`), and `m_musicStream` handles the current streaming track.

Sound files and music files get registered through `add()`, `addMusic()`, and `addStreaming()` during initialization.

## DLC audio

DLC packs (mash-up packs) can provide their own audio through `DLCAudioFile.h`. The `TexturePack::hasAudio()` method tells you whether a pack includes custom audio. When a DLC pack with audio is active, `SetStreamingSounds()` reconfigures the music track ranges.

Audio resources are stored in:
- `Common/res/audio/` for base game sound banks
- `Common/res/TitleUpdate/audio/` for title update audio additions

## Platform-specific notes

These notes apply to the original console builds, not LCEMP:

- **PS3**: `initAudioHardware()` has a platform-specific implementation for Cell audio initialization. There is also a `PS3_SoundEngine.cpp` with PS3-specific Miles integration.
- **PS4 (Orbis)**: Uses `int32_t m_hBGMAudio` for the background music audio handle
- **PS Vita**: Miles integration through a Vita-specific MSS build with `updateMiles()` called during the mixer callback
- **Xbox 360**: Uses native XAudio instead of Miles (no `mss.h` include). Has its own `Xbox/Audio/SoundEngine.cpp` and `SoundEngine.h`

LCEMP uses miniaudio on all platforms. The `initAudioHardware()` method is a no-op stub that just returns its input parameter.

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

### Witch sounds

- `eSoundType_MOB_WITCH_IDLE`, `_HURT`, `_DEATH`

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

`eSoundType_MOB_CAT_HITT` (typo with double T in LCEMP) is renamed to `eSoundType_MOB_CAT_HIT` in MinecraftConsoles.
