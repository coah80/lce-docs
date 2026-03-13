---
title: "Particles"
description: "Particle system in LCE."
---

The LCE particle system renders visual effects like smoke, flames, block breaking debris, and spell effects. `ParticleEngine` manages it all, and it's built on the `Particle` base class, which extends `Entity` from `Minecraft.World`.

## ParticleEngine

`ParticleEngine` is the central manager that stores, ticks, and renders all active particles.

### Particle limits

```cpp
static const int MAX_PARTICLES_PER_LAYER = 200;        // reduced from Java's 4000
static const int MAX_DRAGON_BREATH_PARTICLES = 1000;
```

The console port drops the particle cap way down compared to Java Edition (200 vs 4000 per layer) to keep the frame rate stable. When the cap is hit, the oldest particle gets removed to make room for new ones.

### Texture layers

Particles are organized by which texture atlas they use:

| Constant | Value | Atlas | Rendering |
|---|---|---|---|
| `MISC_TEXTURE` | 0 | Misc particle sprites (`particles.png`) | Batched, alpha tested |
| `TERRAIN_TEXTURE` | 1 | Terrain/block textures (terrain atlas) | Batched, uses block UVs |
| `ITEM_TEXTURE` | 2 | Item textures (items atlas) | Batched, uses item UVs |
| `ENTITY_PARTICLE_TEXTURE` | 3 | Entity particle sprites | Individually rendered, custom GL state allowed |
| `DRAGON_BREATH_TEXTURE` | 4 | Dragon breath effect | 4J added, separate sheet, higher cap (1000) |

The entity particle texture layer is special. Particles in this layer are rendered one at a time instead of batched, so they can set up their own OpenGL state (blending modes, custom textures, etc.). `FootstepParticle` and `HugeExplosionParticle` use this.

### Storage

Particles are stored in a 3D array of deques:

```cpp
deque<shared_ptr<Particle>> particles[3][TEXTURE_COUNT];
```

The first dimension (3) supports rendering across multiple dimensions at the same time (for split-screen players in different dimensions). The second dimension is the texture layer.

### Key methods

| Method | Purpose |
|---|---|
| `add(shared_ptr<Particle> p)` | Add a new particle to the system |
| `tick()` | Update all particles, remove expired ones |
| `render(shared_ptr<Entity> player, float a)` | Render standard particles from the camera's perspective |
| `renderLit(shared_ptr<Entity> player, float a)` | Render particles with lighting enabled |
| `setLevel(Level* level)` | Bind to a new level |
| `destroy(int x, int y, int z, int tid, int data)` | Spawn block-breaking debris at a position |
| `crack(int x, int y, int z, int face)` | Spawn block-cracking particles on a face |
| `countParticles()` | Returns a string with particle counts for debug |

`render()` and `renderLit()` are called at different points in the frame. `render()` handles standard particles with additive or alpha blending. `renderLit()` handles particles that need proper world lighting (block break debris, item break debris).

### Spawning from LevelRenderer

`LevelRenderer::addParticle()` is the main entry point for spawning particles from game logic. It takes an `ePARTICLE_TYPE` enum and world coordinates:

```cpp
void addParticle(ePARTICLE_TYPE eParticleType, double x, double y, double z,
                 double xa, double ya, double za);
```

`addParticleInternal()` returns the created `Particle` shared_ptr so you can customize it further. The implementation is a big `switch` statement that maps each particle type enum to its constructor.

## Particle base class

`Particle` extends `Entity`, giving each particle a position, velocity, and collision. It adds visual properties:

```cpp
class Particle : public Entity {
protected:
    int texX, texY;          // sprite sheet position (grid coordinates)
    float uo, vo;            // random UV offset (for variety in terrain/item particles)
    int age;                 // current age in ticks
    int lifetime;            // maximum age before removal
    float size;              // render scale
    float gravity;           // downward acceleration per tick
    float rCol, gCol, bCol;  // color tint (0.0 to 1.0)
    float alpha;             // transparency (1.0 = fully opaque)
    Icon* tex;               // texture icon reference (for terrain/item particles)

public:
    static double xOff, yOff, zOff;  // camera-relative offset
};
```

### Constructor defaults

The base constructor sets up sensible defaults:

- Entity size: `0.2 x 0.2`
- Color: white (`rCol = gCol = bCol = 1.0`)
- Random UV offsets (`uo`, `vo`) for texture variety
- Random `size` between 0.5 and 1.5 (then multiplied by 2)
- `lifetime` of roughly 4 ticks (randomized)
- Velocity: takes the initial `(xa, ya, za)`, adds random noise, normalizes, and scales by `0.4`

The velocity normalization means the constructor doesn't use your velocity directly. If you want exact control over velocity, override it in your subclass constructor after calling the base.

### Default tick()

The base `tick()` handles standard particle physics:

```cpp
void Particle::tick()
{
    xo = x; yo = y; zo = z;          // store previous position for interpolation

    if (age++ >= lifetime) remove();  // die when too old

    yd -= 0.04 * gravity;            // apply gravity
    move(xd, yd, zd);                // move with collision detection
    xd *= 0.98f;                     // air friction
    yd *= 0.98f;
    zd *= 0.98f;

    if (onGround)                    // ground friction
    {
        xd *= 0.7f;
        zd *= 0.7f;
    }
}
```

Key physics values:
- **Gravity**: `0.04 * gravity`. The `gravity` field defaults to `0.0`, so particles float unless you set it.
- **Air friction**: `0.98` per tick on all axes. Particles slow down naturally.
- **Ground friction**: extra `0.7` multiplier on horizontal velocity when `onGround` is true.
- **No-physics mode**: Setting `noPhysics = true` skips collision detection entirely. `FlameParticle`, `NetherPortalParticle`, and `EnderParticle` all use this.

### Virtual methods

| Method | Purpose |
|---|---|
| `tick()` | Per-tick update (movement, aging, removal) |
| `render(Tesselator*, float a, ...)` | Draw the particle as a camera-facing quad |
| `setPower(float)` | Set particle velocity multiplier |
| `scale(float)` | Set size multiplier |
| `getParticleTexture()` | Return which texture layer this particle uses |
| `setTex(Textures*, Icon*)` | Assign a specific texture icon |
| `setMiscTex(int slotIndex)` | Set texture from misc particle sheet |
| `setNextMiscAnimTex()` | Advance to the next animation frame |
| `getBrightness(float a)` | Get brightness for non-texture-lit rendering |
| `getLightColor(float a)` | Get packed light color for texture-lit rendering |

## All particle types

### Block and item particles

| Class | Enum | Description |
|---|---|---|
| `TerrainParticle` | `eParticleType_tilecrack_*` | Texture fragments from destroyed blocks. Uses the block's icon for UVs. Spawned in a 4x4x4 grid by `ParticleEngine::destroy()`. |
| `BreakingItemParticle` | `eParticleType_iconcrack_*`, `snowballpoof`, `slime` | Debris from item/tool breaking, snowball impacts, slime ball impacts. Uses the item's icon for UVs. |
| `FootstepParticle` | `eParticleType_footstep` | Flat footprints on the ground when walking. Renders as a horizontal quad (not a billboard). Fades out over 200 ticks. Uses its own GL state with blending. |

The `iconcrack` and `tilecrack` types use bit packing to encode the item/tile ID and data value:

```cpp
#define PARTICLE_TILECRACK(id, data) \
    ((ePARTICLE_TYPE)(eParticleType_tilecrack_base | ((0x0FFF & id) << 8) | (0x0FF & data)))

#define PARTICLE_ICONCRACK(id, data) \
    ((ePARTICLE_TYPE)(eParticleType_iconcrack_base | ((0x0FFF & id) << 8) | (0x0FF & data)))
```

### Environmental particles

| Class | Enum | Description |
|---|---|---|
| `BubbleParticle` | `eParticleType_bubble` | Underwater bubbles. Float upward, removed when outside water. Friction: 0.85 (heavy drag). |
| `DripParticle` | `eParticleType_dripWater`, `dripLava` | Water and lava drips from ceilings. Starts stuck under a block, then falls. Water drips spawn a splash on landing. Lava drips transition color over time and render at full brightness. |
| `LavaParticle` | `eParticleType_lava` | Sparks that fly from lava surfaces. Full brightness, friction 0.999 (almost no drag). Spawns secondary smoke particles as it flies, with decreasing probability as it ages. |
| `SplashParticle` | `eParticleType_splash` | Water spray from entities entering water. |
| `WaterDropParticle` | (spawned directly) | Drops from wet surfaces. |
| `SuspendedParticle` | `eParticleType_suspended` | Ambient floating particles underwater. No gravity, very long lifetime. |
| `SuspendedTownParticle` | `eParticleType_townaura`, `depthsuspend`, `happyVillager` | Floating spores above mycelium, void particles, and happy villager green sparkles. |
| `SnowShovelParticle` | `eParticleType_snowshovel` | Snow fragments when shoveling. |

### Fire and explosion particles

| Class | Enum | Description |
|---|---|---|
| `FlameParticle` | `eParticleType_flame` | Small flame from torches, furnaces. Self-lit via `getBrightness()`/`getLightColor()`. Shrinks with quadratic falloff. Friction: 0.96. No physics (passes through blocks). |
| `SmokeParticle` | `eParticleType_smoke`, `largesmoke`, `endportal` | Rising smoke wisps. Animates through 8 frames backwards over lifetime. Drifts upward (`yd += 0.004`). Large smoke variant uses 2.5x scale. End portal reuses the class with different coloring. |
| `ExplodeParticle` | `eParticleType_explode` | Small explosion puffs. Animates through 8 frames. Friction: 0.90. |
| `HugeExplosionSeedParticle` | `eParticleType_hugeexplosion` | Invisible seed particle. Spawns 6 visible `HugeExplosionParticle` instances per tick for 8 ticks. Useful pattern for staggered bursts. |
| `HugeExplosionParticle` | `eParticleType_largeexplode` | Large explosion sphere. Uses its own animated sprite sheet (4x4 grid). Self-rendered in the entity particle texture layer. |

### Magic and effect particles

| Class | Enum | Description |
|---|---|---|
| `SpellParticle` | `eParticleType_spell`, `mobSpell`, `instantSpell` | Potion/splash spell effects. Animates 8 frames backwards from a configurable base. Mob spell color is passed via velocity args (xa=r, ya=g, za=b). Instant spell uses an alternate sprite row. Drifts upward. |
| `HeartParticle` | `eParticleType_heart`, `angryVillager` | Floating hearts from breeding. Friction: 0.86. Angry villager uses a different sprite slot but the same class. |
| `NoteParticle` | `eParticleType_note` | Colored musical notes from note blocks. Color is picked from 24 entries in the colour table based on pitch. Friction: 0.66 (stops fast). |
| `RedDustParticle` | `eParticleType_reddust` | Red particles from powered redstone. Color passed via velocity args. Shrinks over lifetime. |
| `EchantmentTableParticle` | `eParticleType_enchantmenttable` | Glyphs floating toward enchanting table. Path-based movement toward the table position. |
| `EnderParticle` | `eParticleType_ender` | Purple particles from endermen and ender pearls. Path-based movement like nether portal. No physics. |
| `NetherPortalParticle` | `eParticleType_netherportal` | Purple swirl particles around nether portals. Path-based movement with a smooth arc. Color from colour table for texture pack support. No physics. |
| `DragonBreathParticle` | `eParticleType_dragonbreath` | Purple lingering cloud from dragon attack. Two-phase behavior: falls toward ground, then rises as lingering cloud (`yd += 0.002` after landing). 3 animation frames. |
| `CritParticle` | `eParticleType_crit` | Star-shaped particles on critical hits. |
| `CritParticle2` | `eParticleType_crit`, `magicCrit` | Critical hit sparks. Color from colour table. Magic crit tinted blue-green. |

### Entity-specific particles

| Class | Enum | Description |
|---|---|---|
| `PlayerCloudParticle` | (spawned directly) | Poof particles for sprint/landing. |
| `TakeAnimationParticle` | (spawned directly) | Particle that animates an item flying to a player. |

### GUI particles

| Class | Description |
|---|---|
| `GuiParticle` | Individual dirt particle on menu backgrounds. |

`GuiParticles` manages a collection of `GuiParticle` instances for the animated Minecraft menu background.

## Particle rendering

Each particle renders as a camera-facing quad (billboard). The base `Particle::render()` method:

1. Calculates UV coordinates from `texX` and `texY` (or from `tex` icon if set)
2. Interpolates position between `xo/yo/zo` and `x/y/z` using `a` (partial tick)
3. Computes four quad corners using camera orientation vectors (`Camera::xa`, `Camera::ya`, `Camera::za`, etc.)
4. Applies the `size` scale factor
5. Sets color with `rCol * brightness, gCol * brightness, bCol * brightness, alpha`
6. Submits four vertices to the `Tesselator` with UV coordinates from the particle sprite sheet

The camera offset fields (`Particle::xOff`, `yOff`, `zOff`) shift particle positions relative to the camera. This avoids floating-point precision issues at large world coordinates.

### Texture slots

Most particles use the `particles.png` sprite sheet, which is a 16x16 grid. You pick your slot with `setMiscTex()`:

```cpp
setMiscTex(48);  // flame sprite (row 3, column 0)
```

The slot index maps to a grid position: `texX = slot % 16`, `texY = slot / 16`. Some common slots:

| Slot | Row.Col | Particle |
|------|---------|----------|
| 0-7 | 0.0-0.7 | Generic animation frames (smoke, explode, redstone) |
| 32 | 2.0 | Bubble |
| 48 | 3.0 | Flame |
| 49 | 3.1 | Lava |
| 64 | 4.0 | Note |
| 80 | 5.0 | Heart |
| 81 | 5.1 | Angry villager |
| 82 | 5.2 | Happy villager |
| 113 | 7.1 | Drip |

### Animated sprites

Several particles animate through frames by calling `setMiscTex()` each tick:

```cpp
// SmokeParticle: plays 8 frames backwards over its lifetime
setMiscTex(7 - age * 8 / lifetime);

// DragonBreathParticle: 3 frames over its lifetime
setMiscTex((3 * age / lifetime) + 5);

// SpellParticle: 8 frames backwards from a configurable base
setMiscTex(baseTex + (7 - age * 8 / lifetime));
```

### Size over lifetime

Common size-change patterns used across the codebase:

| Pattern | Formula | Used by |
|---------|---------|---------|
| Quadratic shrink | `oSize * (1 - s * s * 0.5f)` | FlameParticle |
| Linear-ish shrink | `oSize * (1 - s * s)` | LavaParticle |
| Grow from 0 to full | `oSize * min(1.0f, (age+a)/lifetime * 32)` | SmokeParticle |
| Ease-in grow | `oSize * (1 - (1-s)*(1-s))` where s = age/lifetime | NetherPortalParticle |

Always store the original size in a field (usually `oSize`) so you have something to scale from.

### Self-illumination

Particles like `FlameParticle` and `LavaParticle` override `getBrightness()` and `getLightColor()` to glow in the dark:

```cpp
float FlameParticle::getBrightness(float a)
{
    float l = (age + a) / lifetime;
    float br = Particle::getBrightness(a);
    return br * l + (1 - l);  // starts full bright, fades to world brightness
}
```

`getBrightness()` is used when `TEXTURE_LIGHTING` is off. `getLightColor()` is used when it's on. Override both for consistent glow across rendering modes.

### Color

Set the color in your constructor using `rCol`, `gCol`, `bCol` (0.0 to 1.0). Many particles pull their color from the colour table for mashup/texture pack support:

```cpp
unsigned int colour = Minecraft::GetInstance()->getColourTable()
    ->getColor(eMinecraftColour_Particle_NetherPortal);
rCol = ((colour >> 16) & 0xFF) / 255.0f;
gCol = ((colour >> 8) & 0xFF) / 255.0f;
bCol = (colour & 0xFF) / 255.0f;
```

### Friction reference

Different particles use different friction values to control their feel:

| Particle | X/Z Friction | Y Friction | Feel |
|----------|-------------|------------|------|
| Base `Particle` | 0.98 | 0.98 | Standard |
| `FlameParticle` | 0.96 | 0.96 | Slightly heavier drag |
| `SmokeParticle` | 0.96 | 0.96 | Same as flame |
| `BubbleParticle` | 0.85 | 0.85 | Heavy drag (underwater) |
| `HeartParticle` | 0.86 | 0.86 | Floaty |
| `NoteParticle` | 0.66 | 0.66 | Very heavy, stops fast |
| `ExplodeParticle` | 0.90 | 0.90 | Quick slowdown |
| `LavaParticle` | 0.999 | 0.999 | Almost no drag |

## Particle lifecycle

1. **Spawn.** Game code calls `LevelRenderer::addParticle()` or `ParticleEngine::add()`
2. **Tick.** `ParticleEngine::tick()` calls `Particle::tick()` on each particle. The base implementation applies gravity, moves the particle, increments `age`, and removes the particle when `age >= lifetime`
3. **Render.** `ParticleEngine::render()` batches particles by texture layer, binds the right atlas, and calls `Particle::render()` for each one
4. **Remove.** Particles get removed from the deque when `tick()` marks them dead, or when the particle count goes over `MAX_PARTICLES_PER_LAYER` (oldest particles get evicted first)

## Path-based movement

Some particles don't use physics at all. `NetherPortalParticle` and `EnderParticle` store a start position and interpolate along a curve:

```cpp
void NetherPortalParticle::tick()
{
    float pos = age / (float)lifetime;
    float a = pos;
    pos = -pos + pos * pos * 2;
    pos = 1 - pos;

    x = xStart + xd * pos;
    y = yStart + yd * pos + (1 - a);  // rises over time
    z = zStart + zd * pos;

    if (age++ >= lifetime) remove();
}
```

The velocity values (`xd`, `yd`, `zd`) act as target offsets rather than per-tick speeds. This creates a smooth arc from the spawn point.

## MinecraftConsoles differences

MinecraftConsoles adds a full fireworks particle system and a few new particle types:

### FireworksParticles

`FireworksParticles.h` contains three nested particle classes:

- **`FireworksStarter`** is the initial rocket particle. It reads explosion data from a `CompoundTag` (the fireworks NBT) and spawns the actual explosion effects. Methods include `createParticleBall()` for spherical bursts, `createParticleShape()` for shaped patterns (stars, creeper faces), and `createParticleBurst()` for burst patterns. It has a `twinkleDelay` flag for delayed twinkle effects.
- **`FireworksSparkParticle`** is the individual spark. Supports trail effects, flicker, fade colors, and custom RGB coloring. Overrides `getLightColor` and `getBrightness` so sparks glow.
- **`FireworksOverlayParticle`** is a translucent flash overlay rendered during the explosion.

### New particle type enum values

The `ePARTICLE_TYPE` enum gains three new entries:

- `eParticleType_witchMagic` for witch potion effects
- `eParticleType_mobSpellAmbient` for ambient mob spell particles (beacon effects, etc.)
- `eParticleType_fireworksspark` for firework sparks
