---
title: Custom Sounds & Music
description: How the LCE sound system works and how to add your own sounds and music.
---

The original console builds used the **Miles Sound System** (MSS) for audio, with sounds stored in a compiled soundbank (`Minecraft.msscmp`) and music tracks streamed from `.binka` files on disk. LCEMP has replaced Miles with **miniaudio**, a single-header C audio library. The engine supports full 3D positional audio, distance-based falloff, splitscreen listener handling, and per-domain music selection.

This guide covers the whole audio pipeline, from how the sound system boots up to how you add your own custom sounds and music tracks.

## Architecture overview

There are three layers to understand:

1. **`ConsoleSoundEngine`** (`Minecraft.Client/Common/Audio/Consoles_SoundEngine.h`) is the abstract base class. It defines the interface that the rest of the game talks to.
2. **`SoundEngine`** (`Minecraft.Client/Common/Audio/SoundEngine.h`) is the concrete implementation. It owns the Miles driver, the soundbank handle, and the streaming state machine.
3. **`SoundTypes.h`** (`Minecraft.World/SoundTypes.h`) defines the `eSOUND_TYPE` enum that the world/entity code uses to refer to sounds by integer ID.

The game code never touches Miles directly. It calls `Level::playSound()` or `Entity::playSound()`, which go through `LevelListener` and eventually reach `SoundEngine::play()` or `SoundEngine::playUI()`.

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
SoundEngine::play()  -- 3D positioned sound
SoundEngine::playUI() -- non-positional UI sound
SoundEngine::playStreaming() -- music / jukebox
```

## Sound events

Every sound in the game has an entry in the `eSOUND_TYPE` enum in `SoundTypes.h`. The enum values map 1:1 to event names in the Miles soundbank via the `wchSoundNames[]` array in `SoundNames.cpp`.

For example:

```cpp
// SoundTypes.h
enum eSOUND_TYPE
{
    eSoundType_MOB_ZOMBIE_AMBIENT,   // enum value = some integer
    eSoundType_MOB_ZOMBIE_HURT,
    eSoundType_MOB_ZOMBIE_DEATH,
    // ...
};
```

```cpp
// SoundNames.cpp
const WCHAR *ConsoleSoundEngine::wchSoundNames[eSoundType_MAX] = {
    // ...
    L"mob.zombie",           // eSoundType_MOB_ZOMBIE_AMBIENT
    L"mob.zombiehurt",       // eSoundType_MOB_ZOMBIE_HURT
    L"mob.zombiedeath",      // eSoundType_MOB_ZOMBIE_DEATH
    // ...
};
```

When `SoundEngine::play()` fires, it builds a Miles event name like `"Minecraft/mob.zombie"` from the string and enqueues it to the event system.

:::caution
The `wchSoundNames[]` array must stay in sync with the `eSOUND_TYPE` enum. If you add an entry to one, you have to add it in the same position in the other. The comment at the top of `SoundTypes.h` says the same thing: "if you change this, you need to update `SoundEngine::wchSoundNames[]`".
:::

## Sound categories

Sounds are grouped by naming prefix. Here's every category:

### Mob sounds (`mob.*`)

Ambient, hurt, death, and step sounds for every mob. Examples:

| Enum | String name | Used by |
|---|---|---|
| `eSoundType_MOB_ZOMBIE_AMBIENT` | `mob.zombie` | Zombie idle |
| `eSoundType_MOB_ZOMBIE_HURT` | `mob.zombiehurt` | Zombie taking damage |
| `eSoundType_MOB_ZOMBIE_DEATH` | `mob.zombiedeath` | Zombie dying |
| `eSoundType_MOB_CREEPER_HURT` | `mob.creeper` | Creeper hurt |
| `eSoundType_MOB_WOLF_BARK` | `mob.wolf.bark` | Wolf barking |
| `eSoundType_MOB_ENDERDRAGON_GROWL` | `mob.enderdragon.growl` | Ender Dragon |
| `eSoundType_MOB_HORSE_GALLOP` | `mob.horse.gallop` | Horse running |

### Block/tile sounds (`step.*`, `dig.*`, `tile.*`)

Step sounds play when walking on blocks. Dig sounds play when breaking them. Tile sounds are for specific block interactions like pistons.

| Enum | String name | Used for |
|---|---|---|
| `eSoundType_STEP_STONE` | `step.stone` | Walking on stone |
| `eSoundType_STEP_WOOD` | `step.wood` | Walking on wood |
| `eSoundType_DIG_GRASS` | `dig.grass` | Breaking grass blocks |
| `eSoundType_DIG_STONE` | `dig.stone` | Breaking stone |
| `eSoundType_TILE_PISTON_IN` | `tile.piston.in` | Piston retracting |
| `eSoundType_TILE_PISTON_OUT` | `tile.piston.out` | Piston extending |

### Random/gameplay sounds (`random.*`)

General gameplay sounds like explosions, UI clicks, chests, doors:

| Enum | String name | Used for |
|---|---|---|
| `eSoundType_RANDOM_EXPLODE` | `random.explode` | Explosions |
| `eSoundType_RANDOM_BOW` | `random.bow` | Firing a bow |
| `eSoundType_RANDOM_CHEST_OPEN` | `random.chestopen` | Opening a chest |
| `eSoundType_RANDOM_DOOR_OPEN` | `random.door_open` | Opening a door |
| `eSoundType_RANDOM_CLICK` | `random.click` | Buttons, levers |
| `eSoundType_RANDOM_GLASS` | `random.glass` | Breaking glass |
| `eSoundType_RANDOM_ANVIL_USE` | `random.anvil_use` | Using an anvil |

### Ambient sounds (`ambient.*`)

Weather and cave ambience:

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
| `damage.*` | `damage.hurtflesh`, `damage.fallsmall`, `damage.fallbig` | Player damage |
| `note.*` | `note.harp`, `note.bd`, `note.snare`, `note.hat`, `note.bassattack` | Note blocks |
| `liquid.*` | `liquid.water`, `liquid.lava`, `liquid.lavapop` | Liquid sounds |
| `fireworks.*` | `fireworks.launch`, `fireworks.blast`, `fireworks.twinkle` | Firework effects |

### UI sounds (`ESoundEffect`)

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

## Adding a new sound event

To add a brand new sound, you need to touch three files. Here's the full process.

### Step 1: Add to the enum

In `Minecraft.World/SoundTypes.h`, add your new entry. Put it right before `eSoundType_MAX`:

```cpp
// SoundTypes.h
enum eSOUND_TYPE
{
    // ... existing sounds ...
    // your new sound
    eSoundType_MOB_CUSTOM_AMBIENT,

    eSoundType_MAX
};
```

### Step 2: Add the string name

In `Minecraft.Client/Common/Audio/SoundNames.cpp`, add the matching string at the same position:

```cpp
const WCHAR *ConsoleSoundEngine::wchSoundNames[eSoundType_MAX] = {
    // ... must match enum order exactly ...
    // your new sound
    L"mob.custom.ambient",
};
```

### Step 3: Add to the soundbank

In the original console builds, the audio data lived in `Minecraft.msscmp`, a compiled Miles soundbank. You would add a new event named `Minecraft/mob.custom.ambient` to the bank using Miles Sound Studio tools. In LCEMP (which uses miniaudio), you instead provide the audio file directly on disk. The event name must match the string you put in `wchSoundNames[]` (with dots converted to slashes for path resolution).

The `ConvertSoundPathToName()` function handles the conversion from the dot-separated wide string to the slash-separated event name that Miles expects.

## Playing sounds from code

### Entity sounds (mobs)

Every mob inherits from `Mob`, which has three virtual methods for its core sounds:

```cpp
class Mob : public LivingEntity {
protected:
    virtual int getAmbientSound();  // returns -1 by default (no sound)
    virtual int getHurtSound();     // returns eSoundType_DAMAGE_HURT
    virtual int getDeathSound();    // returns eSoundType_DAMAGE_HURT
    virtual float getSoundVolume(); // how loud this mob is
};
```

Override them in your mob class to give it custom sounds:

```cpp
// Zombie.cpp
int Zombie::getAmbientSound()
{
    return eSoundType_MOB_ZOMBIE_AMBIENT;
}

int Zombie::getHurtSound()
{
    return eSoundType_MOB_ZOMBIE_HURT;
}

int Zombie::getDeathSound()
{
    return eSoundType_MOB_ZOMBIE_DEATH;
}
```

The engine calls `Mob::playAmbientSound()` automatically on a timer. Every `getAmbientSoundInterval()` ticks (default: 80 ticks, or 4 seconds), it does this:

```cpp
void Mob::playAmbientSound()
{
    int ambient = getAmbientSound();
    if (ambient != -1)
    {
        level->playSound(shared_from_this(), ambient, getSoundVolume(), getVoicePitch());
    }
}
```

Hurt and death sounds are played automatically in `Mob::hurt()`:

```cpp
// inside Mob::hurt()
if (health <= 0)
{
    level->playSound(shared_from_this(), getDeathSound(), getSoundVolume(), getVoicePitch());
    die(source);
}
else
{
    level->playSound(shared_from_this(), getHurtSound(), getSoundVolume(), getVoicePitch());
}
```

The pitch gets randomized by `getVoicePitch()`, and baby mobs automatically get a higher pitch.

### Block sounds

Each block type has a `SoundType` that determines what plays when you walk on it, break it, or place it:

```cpp
class Tile {
public:
    class SoundType {
    public:
        eMATERIALSOUND_TYPE eMaterialSound;
        int iBreakSound, iStepSound, iPlaceSound;
        float volume;
        float pitch;

        int getBreakSound() const;
        int getStepSound() const;
        int getPlaceSound() const;
    };

    const SoundType *soundType;  // every tile has one

    // predefined sound types
    static SoundType *SOUND_STONE;
    static SoundType *SOUND_WOOD;
    static SoundType *SOUND_GRAVEL;
    static SoundType *SOUND_GRASS;
    static SoundType *SOUND_METAL;
    static SoundType *SOUND_GLASS;
    static SoundType *SOUND_CLOTH;
    static SoundType *SOUND_SAND;
    static SoundType *SOUND_SNOW;
    static SoundType *SOUND_LADDER;
    static SoundType *SOUND_ANVIL;
};
```

You assign a sound type when creating a block using the builder chain:

```cpp
// In Tile::initTiles()
Tile::goldBlock = (new MetalTile(41))
    ->setDestroyTime(3.0f)
    ->setExplodeable(10)
    ->setSoundType(Tile::SOUND_METAL)
    ->setTextureName(L"blockGold");
```

The `SoundType` constructor auto-maps the material to the correct step, dig, and place sounds. For example, `eMaterialSoundType_STONE` maps step to `eSoundType_STEP_STONE` and break to `eSoundType_DIG_STONE`. You can override the break and place sounds:

```cpp
// Glass has a custom break sound but normal stone step sound
Tile::SOUND_GLASS = new Tile::SoundType(
    eMaterialSoundType_STONE,  // material type
    1,                          // volume
    1,                          // pitch
    eSoundType_RANDOM_GLASS,    // custom break sound
    eSoundType_STEP_STONE       // custom place sound
);
```

### Playing sounds directly

To play a sound at a specific position in the world:

```cpp
// Play an explosion sound at coordinates (x, y, z)
level->playSound(100.0, 64.0, 200.0, eSoundType_RANDOM_EXPLODE, 1.0f, 1.0f);
```

The full signature:

```cpp
void Level::playSound(double x, double y, double z, int iSound, float volume, float pitch, float fClipSoundDist = 16.0f);
```

The `fClipSoundDist` parameter controls how far away a player can be and still hear the sound. Default is 16 blocks.

To play a sound attached to an entity (it follows the entity's position):

```cpp
level->playSound(shared_from_this(), eSoundType_MOB_WOLF_BARK, 1.0f, 1.0f);
```

### Playing UI sounds

UI sounds don't have a 3D position. Call `playUI()` directly:

```cpp
soundEngine->playUI(eSFX_Press, 1.0f, 1.0f);
```

If you need to play a regular game sound as a UI sound (no 3D positioning), you can pass a game sound enum to `playUI()` too. The engine detects this by checking if the ID is >= `eSFX_MAX` and routes it through the right path.

## Music system

### How music tracks work

Music is streamed from `.binka` files (a Bink Audio compressed format). The tracks are defined in the `eMUSICFILES` enum:

```cpp
enum eMUSICFILES
{
    // Overworld
    eStream_Overworld_Calm1 = 0,  // "calm1"
    eStream_Overworld_Calm2,       // "calm2"
    eStream_Overworld_Calm3,       // "calm3"
    eStream_Overworld_hal1,        // "hal1"
    eStream_Overworld_hal2,        // "hal2"
    eStream_Overworld_hal3,        // "hal3"
    eStream_Overworld_hal4,        // "hal4"
    eStream_Overworld_nuance1,     // "nuance1"
    eStream_Overworld_nuance2,     // "nuance2"
    eStream_Overworld_piano1,      // "piano1"
    eStream_Overworld_piano2,      // "piano2"
    eStream_Overworld_piano3,      // "piano3"
    // Nether
    eStream_Nether1,               // "nether1"
    eStream_Nether2,               // "nether2"
    eStream_Nether3,               // "nether3"
    eStream_Nether4,               // "nether4"
    // The End
    eStream_end_dragon,            // "the_end_dragon_alive"
    eStream_end_end,               // "the_end_end"
    // Music discs
    eStream_CD_1,                  // "11"
    // ... through eStream_CD_12   // "where_are_we_now"
    eStream_Max,
};
```

Non-Xbox platforms also have creative mode and menu tracks (`creative1` through `creative6`, `menu1` through `menu4`) inserted between `nuance2` and `piano1`.

File paths follow this pattern:
- Background music: `music/<trackname>.binka`
- Music discs: `cds/<discname>.binka`

### How the music picker works

The `SoundEngine` uses a state machine (`MUSIC_STREAMSTATE`) to manage streaming:

```
Idle --> Opening --> Playing --> Completed --> Stop --> Idle
```

When it's time to play music, `playStreaming()` is called with an empty name for background music or a named track for jukebox/CD music.

For background music, there's a random delay of up to 3 minutes before the next track starts. Then the engine picks a track based on the player's current dimension:

```cpp
int SoundEngine::getMusicID(int iDomain)
{
    switch (iDomain)
    {
    case LevelData::DIMENSION_END:
        // The End always plays the dragon-alive track
        return m_iStream_End_Min;
    case LevelData::DIMENSION_NETHER:
        return GetRandomishTrack(m_iStream_Nether_Min, m_iStream_Nether_Max);
    default:
        // Overworld picks randomly
        return GetRandomishTrack(m_iStream_Overworld_Min, m_iStream_Overworld_Max);
    }
}
```

The `GetRandomishTrack()` function tries to avoid repeating recently-played tracks. It keeps a boolean array of heard tracks, picks randomly, and prefers unheard ones. Once all tracks have been heard, the array resets. It doesn't try too hard though, so occasionally you will hear the same track twice.

For music discs (jukebox), the track name gets matched against the `m_szStreamFileA` array to find the right file.

### Music types

The engine tracks two types of streaming music:

```cpp
enum eMUSICTYPE
{
    eMusicType_None,
    eMusicType_Game,   // background music (not 3D positioned)
    eMusicType_CD,     // jukebox music (3D positioned, attenuates with distance)
};
```

Background music plays globally with no 3D positioning. Jukebox music is 3D-positioned at the jukebox block with a distance scaler of 64 blocks (4x the normal sound range).

### Mash-up pack music

Texture packs (mash-up packs) can include custom music. When `TexturePack::hasAudio()` returns true, the engine loads music from the DLC pack path instead of the default `music/` folder. The `SetStreamingSounds()` function lets mash-up packs define their own range of overworld, nether, and end tracks.

## Sound attenuation

All 3D sounds use a custom linear falloff function instead of the default Miles rolloff:

```cpp
F32 AILCALLBACK custom_falloff_function(
    HSAMPLE S, F32 distance, F32 rolloff_factor, F32 min_dist, F32 max_dist)
{
    // Thunder has no attenuation at all
    if (max_dist == 10000.0f)
    {
        return 1.0f;
    }

    // Linear falloff: full volume at distance 0, silent at max_dist
    F32 result = 1.0f - (distance / max_dist);
    if (result < 0.0f) result = 0.0f;
    if (result > 1.0f) result = 1.0f;

    return result;
}
```

The `max_dist` parameter (called `distanceScaler` in the code) controls how far a sound carries. Default is **16 blocks**. Special cases:

| Sound type | Distance (blocks) | Notes |
|---|---|---|
| Most sounds | 16 | Default |
| Ghast sounds | 30 | So you can hear them from further away |
| Ender Dragon | 100 | Boss sounds carry far |
| Thunder | 10,000 | Effectively infinite, always full volume |
| Music discs | 64 | Jukebox carries 4x further than normal |

### Splitscreen listener handling

In splitscreen, the engine can't just set one listener position. Instead, it calculates the **Manhattan distance** from each sound to every active player, picks the closest one, and uses that distance for the 3D falloff. The listener is placed at the origin and the sound is placed along the Z axis at the calculated distance. This gives reasonable spatial audio across all screen splits.

## Adding custom music tracks

### Step 1: Add to the enum

In `SoundEngine.h`, add your new track to `eMUSICFILES`:

```cpp
enum eMUSICFILES
{
    // ... existing tracks ...
    eStream_Overworld_piano3,

    // your new track
    eStream_Overworld_MyTrack,

    // Nether
    eStream_Nether1,
    // ...
};
```

Where you put it matters. The engine uses ranges to pick tracks for each dimension. If it's an overworld track, put it between the last overworld entry and the first nether entry.

### Step 2: Add the filename

In `SoundEngine.cpp`, add the filename string in `m_szStreamFileA` at the matching position:

```cpp
char *SoundEngine::m_szStreamFileA[eStream_Max] = {
    // ... existing entries ...
    "piano3",

    // your new track
    "mytrack",

    // Nether
    "nether1",
    // ...
};
```

### Step 3: Update the streaming ranges

In the `SoundEngine` constructor, the ranges are set by `SetStreamingSounds()`. If you added an overworld track, the max overworld value needs to include it:

```cpp
// Before: piano3 was the last overworld track
SetStreamingSounds(
    eStream_Overworld_Calm1, eStream_Overworld_MyTrack,  // overworld range (was piano3)
    eStream_Nether1, eStream_Nether4,                     // nether range
    eStream_end_dragon, eStream_end_end,                   // end range
    eStream_CD_1                                           // first CD
);
```

### Step 4: Add the audio file

Put your `.binka` file in the `music/` folder:
- `music/mytrack.binka`

The file must be in Bink Audio format. You can convert WAV files to `.binka` using the RAD Game Tools Bink Audio encoder.

### Adding a nether or end track

Same process, just put the enum and filename in the nether or end section and adjust the corresponding range in `SetStreamingSounds()`.

## Putting it all together

Here's a complete example of adding a custom mob with its own sounds.

In `SoundTypes.h`:

```cpp
// Add before eSoundType_MAX
eSoundType_MOB_WARDEN_AMBIENT,
eSoundType_MOB_WARDEN_HURT,
eSoundType_MOB_WARDEN_DEATH,
eSoundType_MOB_WARDEN_ROAR,
```

In `SoundNames.cpp`:

```cpp
// Add at the matching position
L"mob.warden.ambient",
L"mob.warden.hurt",
L"mob.warden.death",
L"mob.warden.roar",
```

In your mob class:

```cpp
int Warden::getAmbientSound()
{
    return eSoundType_MOB_WARDEN_AMBIENT;
}

int Warden::getHurtSound()
{
    return eSoundType_MOB_WARDEN_HURT;
}

int Warden::getDeathSound()
{
    return eSoundType_MOB_WARDEN_DEATH;
}

// Custom attack with a roar sound
void Warden::performRoarAttack()
{
    level->playSound(shared_from_this(), eSoundType_MOB_WARDEN_ROAR, 2.0f, 1.0f);
    // ... attack logic
}
```

In the original console builds, you would add the corresponding events to the Miles soundbank with paths like `Minecraft/mob.warden.ambient`. In LCEMP, provide the audio files directly and make sure the path resolution matches the `wchSoundNames[]` entries.

## Custom SoundType for blocks

If the built-in sound types (stone, wood, grass, etc.) don't fit your block, you can create a custom one:

```cpp
// In Tile.cpp, alongside the other static SoundType definitions:
Tile::SOUND_CRYSTAL = new Tile::SoundType(
    eMaterialSoundType_STONE,         // base material (for step sound fallback)
    0.8f,                              // volume
    1.5f,                              // pitch
    eSoundType_RANDOM_GLASS,          // custom break sound
    eSoundType_STEP_STONE             // custom place sound
);
```

Then use it on your tile:

```cpp
Tile::crystalBlock = (new CrystalTile(200))
    ->setDestroyTime(1.0f)
    ->setSoundType(Tile::SOUND_CRYSTAL)
    ->setTextureName(L"crystal");
```

The `eMATERIALSOUND_TYPE` controls which step and dig sounds the base class uses. The last two parameters let you override the break and place sounds independently.

## Sound pitch and volume

Both `volume` and `pitch` are floats. Volume ranges from 0.0 (silent) to around 4.0 (very loud; default is 1.0). Pitch ranges from about 0.5 (deep) to 2.0 (high; default is 1.0).

Baby mobs automatically get a higher pitch through `getVoicePitch()`, which returns a randomized value between about 1.3 and 1.7 for young entities.

The randomization in `getVoicePitch()` prevents sounds from being monotonous:

```cpp
float Mob::getVoicePitch()
{
    return (random->nextFloat() - random->nextFloat()) * 0.2f + 1.0f;
}
```

## The MAX_SAME_SOUNDS_PLAYING limit

The engine tracks how many copies of each sound are currently playing in `CurrentSoundsPlaying[]`. The cap is 8. If you try to play a 9th copy of the same sound, it gets dropped silently.

This matters most for ambient sounds in dense mob farms. If you have 20 zombies in a small area, only 8 zombie ambient sounds will play at once. The rest get culled.

## Clip distance from game code

When game code plays a sound through `Level::playSound()`, the default clip distance is 16 blocks. But `LevelRenderer::playSound()` lets you override it:

```cpp
// Normal sound: audible within 16 blocks
level->playSound(x, y, z, eSoundType_RANDOM_CLICK, 1.0f, 1.0f);

// Long-range sound: audible within 100 blocks
levelRenderer->playSound(eSoundType_MOB_ENDERDRAGON_GROWL,
    x, y, z, 1.0f, 1.0f, 100.0f);
```

Thunder uses the special value of 10000 blocks, which the custom falloff function treats as "no attenuation at all."

## Key files reference

| File | Purpose |
|---|---|
| `Minecraft.World/SoundTypes.h` | `eSOUND_TYPE` enum, `ESoundEffect` enum, `eMATERIALSOUND_TYPE` enum |
| `Minecraft.Client/Common/Audio/SoundNames.cpp` | `wchSoundNames[]` and `wchUISoundNames[]` string arrays |
| `Minecraft.Client/Common/Audio/SoundEngine.h` | `SoundEngine` class, `eMUSICFILES` enum, `AUDIO_INFO` struct |
| `Minecraft.Client/Common/Audio/SoundEngine.cpp` | Full Miles integration, playback, streaming, falloff |
| `Minecraft.Client/Common/Audio/Consoles_SoundEngine.h` | `ConsoleSoundEngine` abstract base class |
| `Minecraft.World/Tile.h` | `Tile::SoundType` class for block sounds |
| `Minecraft.World/Tile.cpp` | `SoundType` initialization and material-to-sound mapping |
| `Minecraft.World/Level.h` | `Level::playSound()` and `Level::playStreamingMusic()` |
| `Minecraft.World/Mob.h` | `getAmbientSound()`, `getHurtSound()`, `getDeathSound()` virtuals |
| `Minecraft.World/LevelSoundPacket.h` | Network packet for syncing sounds in multiplayer |
