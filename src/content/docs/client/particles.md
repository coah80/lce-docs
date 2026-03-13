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

The console port drops the particle cap way down compared to Java Edition (200 vs 4000 per layer) to keep the frame rate stable.

### Texture layers

Particles are organized by which texture atlas they use:

| Constant | Value | Atlas |
|---|---|---|
| `MISC_TEXTURE` | 0 | Misc particle sprites |
| `TERRAIN_TEXTURE` | 1 | Terrain/block textures |
| `ITEM_TEXTURE` | 2 | Item textures |
| `ENTITY_PARTICLE_TEXTURE` | 3 | Entity particle sprites |
| `DRAGON_BREATH_TEXTURE` | 4 | Dragon breath effect |

### Storage

Particles are stored in a 3D array of deques:

```cpp
deque<shared_ptr<Particle>> particles[3][TEXTURE_COUNT];
```

The first dimension (3) supports rendering across multiple dimensions at the same time (for split-screen players in different dimensions).

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

### Spawning from LevelRenderer

`LevelRenderer::addParticle()` is the main entry point for spawning particles from game logic. It takes an `ePARTICLE_TYPE` enum and world coordinates:

```cpp
void addParticle(ePARTICLE_TYPE eParticleType, double x, double y, double z,
                 double xa, double ya, double za);
```

`addParticleInternal()` returns the created `Particle` shared_ptr so you can customize it further.

## Particle base class

`Particle` extends `Entity`, giving each particle a position, velocity, and collision. It adds visual properties:

```cpp
class Particle : public Entity {
protected:
    int texX, texY;          // sprite sheet position
    float uo, vo;            // texture UV offsets
    int age;                 // current age in ticks
    int lifetime;            // maximum age before removal
    float size;              // render scale
    float gravity;           // downward acceleration per tick
    float rCol, gCol, bCol;  // color tint
    float alpha;             // transparency
    Icon* tex;               // texture icon reference

public:
    static double xOff, yOff, zOff;  // camera-relative offset
};
```

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

## All particle types

### Block and item particles

| Class | Effect | Description |
|---|---|---|
| `BreakingItemParticle` | Item breaking | Debris when an item/tool breaks |
| `TerrainParticle` | Block breaking | Texture fragments from destroyed blocks |
| `FootstepParticle` | Footsteps | Faint marks on the ground when walking |

### Environmental particles

| Class | Effect | Description |
|---|---|---|
| `BubbleParticle` | Underwater bubbles | Rise upward in water |
| `DripParticle` | Dripping | Water and lava drips from ceilings |
| `LavaParticle` | Lava pop | Sparks that fly from lava surfaces |
| `SplashParticle` | Water splash | Spray from entities entering water |
| `WaterDropParticle` | Water drop | Drops from wet surfaces |
| `SuspendedParticle` | Underwater dust | Ambient floating particles underwater |
| `SuspendedTownParticle` | Mycelium | Floating spores above mycelium |
| `SnowShovelParticle` | Snow | Snow fragments |

### Fire and explosion particles

| Class | Effect | Description |
|---|---|---|
| `FlameParticle` | Flames | Small flame effect from torches, furnaces |
| `SmokeParticle` | Smoke | Rising smoke wisps |
| `ExplodeParticle` | Explosion bits | Small explosion fragments |
| `HugeExplosionParticle` | Large explosion | Large explosion sphere |
| `HugeExplosionSeedParticle` | Explosion seed | Initial explosion burst that spawns `HugeExplosionParticle` |

### Magic and effect particles

| Class | Effect | Description |
|---|---|---|
| `SpellParticle` | Potion effects | Swirling potion particles |
| `HeartParticle` | Hearts | Floating hearts from breeding |
| `NoteParticle` | Note blocks | Colored musical notes |
| `RedDustParticle` | Redstone dust | Red particles from powered redstone |
| `EchantmentTableParticle` | Enchanting | Glyphs floating toward enchanting table |
| `EnderParticle` | Ender | Purple particles from endermen and ender pearls |
| `NetherPortalParticle` | Nether portal | Purple swirl particles |
| `DragonBreathParticle` | Dragon breath | Purple lingering cloud from dragon attack |
| `CritParticle` | Critical hit | Star-shaped particles on critical hits |
| `CritParticle2` | Magic critical | Enchanted weapon critical hit particles |

### Entity-specific particles

| Class | Effect | Description |
|---|---|---|
| `PlayerCloudParticle` | Player cloud | Poof particles for sprint/landing |
| `TakeAnimationParticle` | Item pickup | Particle that animates item flying to player |

### GUI particles

| Class | Effect | Description |
|---|---|---|
| `GuiParticle` | Menu background | Individual dirt particle on menu backgrounds |

`GuiParticles` manages a collection of `GuiParticle` instances for the animated Minecraft menu background.

## Particle rendering

Each particle renders as a camera-facing quad (billboard). The base `Particle::render()` method:

1. Calculates interpolated position using `a` (tick alpha)
2. Computes the four quad corners using camera orientation vectors (`Camera::xa`, `Camera::ya`, `Camera::za`, etc.)
3. Applies the `size` scale factor
4. Sets color with `rCol`, `gCol`, `bCol`, and `alpha`
5. Submits four vertices to the `Tesselator` with the right UV coordinates from the particle sprite sheet

The camera offset fields (`Particle::xOff`, `yOff`, `zOff`) shift particle positions relative to the camera. This avoids floating-point precision issues at large world coordinates.

## Particle lifecycle

1. **Spawn.** Game code calls `LevelRenderer::addParticle()` or `ParticleEngine::add()`
2. **Tick.** `ParticleEngine::tick()` calls `Particle::tick()` on each particle. The base implementation applies gravity, moves the particle, increments `age`, and removes the particle when `age >= lifetime`
3. **Render.** `ParticleEngine::render()` batches particles by texture layer, binds the right atlas, and calls `Particle::render()` for each one
4. **Remove.** Particles get removed from the deque when `tick()` marks them dead, or when the particle count goes over `MAX_PARTICLES_PER_LAYER` (oldest particles get evicted first)

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
