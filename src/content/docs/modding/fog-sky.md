---
title: Fog & Sky
description: How fog colors, sky rendering, fog distance, and custom sky gradients work per dimension.
---

The fog and sky systems in LCE are responsible for the mood of each dimension. The Overworld gets warm sunrise gradients, the Nether gets thick red fog, and the End gets a dark purple haze. This page covers how all of that works and how to customize it.

## The Color Table

Before we get into the rendering, you need to know about the `ColourTable`. Instead of hardcoding colors, 4J made nearly all environment colors data-driven. They're loaded from binary color data files that ship with each texture pack.

The relevant color entries are defined in `ColourTable.cpp`:

```cpp
// ColourTable.cpp - fog and sky related entries
L"Sky_Ocean",
L"Sky_Plains",
L"Sky_Desert",
L"Sky_ExtremeHills",
L"Sky_Forest",
L"Sky_Taiga",
L"Sky_Swampland",
// ... one per biome ...

L"Sky_Dawn_Dark",      // sunrise dark color (horizon)
L"Sky_Dawn_Bright",    // sunrise bright color (zenith)

L"Default_Fog_Colour", // Overworld fog
L"Nether_Fog_Colour",  // Nether fog
L"End_Fog_Colour",     // End fog

L"Under_Water_Fog_Colour",
L"Under_Lava_Fog_Colour",
L"In_Cloud_Fog_Colour",
```

These are all loaded from binary data and looked up by name at runtime:

```cpp
// ColourTable.h
unsigned int getColour(eMinecraftColour id);
unsigned int getColor(eMinecraftColour id) { return getColour(id); }
```

Texture packs can override any of these colors, which is how mashup packs give each world a unique feel.

## Fog Color Per Dimension

Each dimension has its own `getFogColor()` method. Here's how they differ:

### Overworld

The Overworld fog color is based on time of day. It uses the `Default_Fog_Colour` from the color table, then modulates it by brightness:

```cpp
// Dimension.cpp
Vec3 *Dimension::getFogColor(float td, float a) const
{
    float br = Mth::cos(td * PI * 2) * 2 + 0.5f;
    if (br < 0.0f) br = 0.0f;
    if (br > 1.0f) br = 1.0f;

    unsigned int baseFogColour =
        Minecraft::GetInstance()->getColourTable()->getColor(
            eMinecraftColour_Default_Fog_Colour
        );

    float r = ((baseFogColour >> 16) & 0xff) / 255.0f;
    float g = ((baseFogColour >> 8) & 0xff) / 255.0f;
    float b = ((baseFogColour) & 0xff) / 255.0f;

    r *= br * 0.94f + 0.06f;
    g *= br * 0.94f + 0.06f;
    b *= br * 0.91f + 0.09f;

    return Vec3::newTemp(r, g, b);
}
```

The `td` parameter is the time of day (0.0 to 1.0). The cosine curve makes the fog brighter during the day and darker at night. Notice the blue channel gets a slightly different multiplier (`0.91f + 0.09f` vs `0.94f + 0.06f`), which keeps a faint blue tint even at night.

### Nether

The Nether has a flat, constant fog color with no day/night cycle:

```cpp
// HellDimension.cpp
Vec3 *HellDimension::getFogColor(float td, float a) const
{
    int colour = Minecraft::GetInstance()->getColourTable()->getColor(
        eMinecraftColour_Nether_Fog_Colour
    );

    byte redComponent = ((colour >> 16) & 0xFF);
    byte greenComponent = ((colour >> 8) & 0xFF);
    byte blueComponent = ((colour) & 0xFF);

    float rr = static_cast<float>(redComponent) / 256;
    float gg = static_cast<float>(greenComponent) / 256;
    float bb = static_cast<float>(blueComponent) / 256;

    return Vec3::newTemp(rr, gg, bb);
}
```

No brightness modulation, no time-of-day math. Just a flat color from the table. The default is a dark reddish-brown (`0x330808` or similar, depending on the texture pack).

The Nether also reports `isFoggyAt()` as true everywhere, and has brighter ambient light:

```cpp
// HellDimension.cpp
void HellDimension::updateLightRamp()
{
    float ambientLight = 0.10f;  // vs 0.0f in Overworld
    for (int i = 0; i <= Level::MAX_BRIGHTNESS; i++)
    {
        float v = (1 - i / static_cast<float>(Level::MAX_BRIGHTNESS));
        brightnessRamp[i] =
            ((1 - v) / (v * 3 + 1)) * (1 - ambientLight) + ambientLight;
    }
}

bool HellDimension::isFoggyAt(int x, int z)
{
    return true;
}
```

### The End

The End's fog uses the color table but with a fixed low brightness, giving it that dark purple look:

```cpp
// TheEndDimension.cpp
Vec3 *TheEndDimension::getFogColor(float td, float a) const
{
    int fogColor = Minecraft::GetInstance()->getColourTable()->getColor(
        eMinecraftColour_End_Fog_Colour
    );

    float br = Mth::cos(td * PI * 2) * 2 + 0.5f;
    if (br < 0.0f) br = 0.0f;
    if (br > 1.0f) br = 1.0f;

    float r = ((fogColor >> 16) & 0xff) / 255.0f;
    float g = ((fogColor >> 8) & 0xff) / 255.0f;
    float b = ((fogColor) & 0xff) / 255.0f;

    // The key line: brightness is clamped very low
    r *= br * 0.0f + 0.15f;
    g *= br * 0.0f + 0.15f;
    b *= br * 0.0f + 0.15f;

    return Vec3::newTemp(r, g, b);
}
```

See that `br * 0.0f + 0.15f`? The brightness multiplier is literally zero, so `br` has no effect. The End always uses 15% of the base color. The time of day is also fixed at 0.0:

```cpp
float TheEndDimension::getTimeOfDay(int64_t time, float a) const
{
    return 0.0f;  // always "midnight"
}
```

## Sunrise Colors

The Overworld has a special sunrise/sunset gradient. The `getSunriseColor()` method returns RGBA values when the sun is near the horizon:

```cpp
// Dimension.cpp
float *Dimension::getSunriseColor(float td, float a)
{
    unsigned int clr1 = Minecraft::GetInstance()->getColourTable()->getColor(
        eMinecraftColour_Sky_Dawn_Dark     // horizon color
    );
    unsigned int clr2 = Minecraft::GetInstance()->getColourTable()->getColor(
        eMinecraftColour_Sky_Dawn_Bright   // zenith color
    );

    // Convert to floats
    double r1 = ((clr1 >> 16) & 0xFF) / 255.0f;
    double g1 = ((clr1 >> 8) & 0xFF) / 255.0;
    double b1 = (clr1 & 0xFF) / 255.0;

    double r2 = ((clr2 >> 16) & 0xFF) / 255.0f;
    double g2 = ((clr2 >> 8) & 0xFF) / 255.0;
    double b2 = (clr2 & 0xFF) / 255.0;

    float span = 0.4f;
    float tt = Mth::cos(td * PI * 2) - 0.0f;
    float mid = -0.0f;

    if (tt >= mid - span && tt <= mid + span)
    {
        float aa = ((tt - mid) / span) * 0.5f + 0.5f;
        float mix = 1 - (((1 - sin(aa * PI))) * 0.99f);
        mix = mix * mix;

        sunriseCol[0] = (aa * (r2 - r1) + r1);
        sunriseCol[1] = (aa * (g2 - g1) + g1);
        sunriseCol[2] = (aa * (b2 - b1) + b1);
        sunriseCol[3] = mix;  // alpha/intensity
        return sunriseCol;
    }

    return nullptr;  // no sunrise effect right now
}
```

The sunrise color gets blended into the fog during `setupClearColor()`:

```cpp
// GameRenderer.cpp - setupClearColor()
float *c = level->dimension->getSunriseColor(level->getTimeOfDay(a), a);
if (c != nullptr)
{
    d *= c[3];
    fr = fr * (1 - d) + c[0] * d;
    fg = fg * (1 - d) + c[1] * d;
    fb = fb * (1 - d) + c[2] * d;
}
```

The End returns `nullptr` from `getSunriseColor()`, which means no sunrise effect at all.

## Sky Color

Sky color comes from the biome, not the dimension. Each biome has a `getSkyColor()` method that returns an RGB int based on temperature. The level blends this with brightness:

```cpp
// Level.cpp
Vec3 *Level::getSkyColor(shared_ptr<Entity> source, float a)
{
    float td = getTimeOfDay(a);
    float br = Mth::cos(td * PI * 2) * 2 + 0.5f;
    if (br < 0.0f) br = 0.0f;
    if (br > 1.0f) br = 1.0f;

    int xx = Mth::floor(source->x);
    int zz = Mth::floor(source->z);
    Biome *biome = getBiome(xx, zz);
    float temp = biome->getTemperature();
    int skyColor = biome->getSkyColor(temp);

    float r = ((skyColor >> 16) & 0xff) / 255.0f;
    float g = ((skyColor >> 8) & 0xff) / 255.0f;
    float b = ((skyColor) & 0xff) / 255.0f;
    r *= br;
    g *= br;
    b *= br;
    // ... rain/thunder darkening follows ...
}
```

The biome sky colors are also stored in the `ColourTable` with entries like `Sky_Plains`, `Sky_Desert`, `Sky_Forest`, etc.

## Fog Distance

The fog distance is set up in `GameRenderer::setupFog()`. It handles several cases:

```cpp
// GameRenderer.cpp
void GameRenderer::setupFog(int i, float alpha)
{
    // ... permission checks ...

    glFog(GL_FOG_COLOR, getBuffer(fr, fg, fb, 1));

    int t = Camera::getBlockAt(mc->level, player, alpha);

    if (player->hasEffect(MobEffect::blindness))
    {
        // Blindness: very short fog distance
        float distance = 5.0f;
        glFogi(GL_FOG_MODE, GL_LINEAR);
        glFogf(GL_FOG_START, distance * 0.25f);
        glFogf(GL_FOG_END, distance);
    }
    else if (isInClouds)
    {
        // Inside clouds: exponential fog
        glFogi(GL_FOG_MODE, GL_EXP);
        glFogf(GL_FOG_DENSITY, 0.1f);
    }
    else if (t > 0 && Tile::tiles[t]->material == Material::water)
    {
        // Underwater: exponential fog, affected by enchantments
        glFogi(GL_FOG_MODE, GL_EXP);
        if (player->hasEffect(MobEffect::waterBreathing))
            glFogf(GL_FOG_DENSITY, 0.05f);
        else
            glFogf(GL_FOG_DENSITY,
                0.1f - (EnchantmentHelper::getOxygenBonus(player) * 0.03f));
    }
    else if (t > 0 && Tile::tiles[t]->material == Material::lava)
    {
        // In lava: very thick fog
        glFogi(GL_FOG_MODE, GL_EXP);
        glFogf(GL_FOG_DENSITY, 2.0f);
    }
    else
    {
        // Normal: linear fog based on render distance
        float distance = renderDistance;

        // Bedrock fog effect near y=0
        if (!mc->level->dimension->hasCeiling)
        {
            if (mc->level->dimension->hasBedrockFog() && !creative)
            {
                // Reduces fog distance near bedrock level
                double yy = /* light and position calculation */;
                if (yy < 1)
                {
                    if (yy < 0) yy = 0;
                    yy = yy * yy;
                    float dist = 100 * static_cast<float>(yy);
                    if (dist < 5) dist = 5;
                    if (distance > dist) distance = dist;
                }
            }
        }

        glFogi(GL_FOG_MODE, GL_LINEAR);
        glFogf(GL_FOG_START, distance * 0.25f);
        glFogf(GL_FOG_END, distance);
    }
}
```

Bedrock fog can be toggled off by the host through the `eGameHostOption_BedrockFog` option:

```cpp
// Dimension.cpp
bool Dimension::hasBedrockFog()
{
    if (app.GetGameHostOption(eGameHostOption_BedrockFog) == 0)
        return false;
    return (levelType != LevelType::lvl_flat && !hasCeiling);
}
```

## Adding a Custom Dimension's Fog

If you're adding a [custom dimension](/lce-docs/modding/custom-dimensions/), you need to override `getFogColor()` in your dimension class. Here's a template:

```cpp
// MyDimension.h
class MyDimension : public Dimension
{
public:
    virtual void init();
    virtual Vec3 *getFogColor(float td, float a) const;
    virtual float getTimeOfDay(int64_t time, float a) const;
    virtual bool isFoggyAt(int x, int z);
};

// MyDimension.cpp
Vec3 *MyDimension::getFogColor(float td, float a) const
{
    // A teal fog that pulses slightly with time
    float pulse = Mth::sin(td * PI * 4) * 0.1f + 0.9f;
    float r = 0.1f * pulse;
    float g = 0.5f * pulse;
    float b = 0.5f * pulse;
    return Vec3::newTemp(r, g, b);
}

float MyDimension::getTimeOfDay(int64_t time, float a) const
{
    // Slow day cycle (2x normal length)
    int dayStep = static_cast<int>(time % (Level::TICKS_PER_DAY * 2));
    return (dayStep + a) / (Level::TICKS_PER_DAY * 2);
}

bool MyDimension::isFoggyAt(int x, int z)
{
    return false;  // or true for thick fog everywhere like the Nether
}
```

## Changing Fog via Texture Packs

The easiest way to change fog colors without touching code is through the `ColourTable`. Texture packs include a binary color data file that overrides the default colors. The `ColourTable` constructor supports layering:

```cpp
// ColourTable constructor that layers on top of defaults
ColourTable::ColourTable(ColourTable *defaultColours, PBYTE pbData, DWORD dwLength)
{
    // Start with default colors
    XMemCpy((void *)m_colourValues,
            (void *)defaultColours->m_colourValues,
            sizeof(int) * eMinecraftColour_COUNT);
    // Override with pack-specific colors
    loadColoursFromData(pbData, dwLength);
}
```

So a texture pack only needs to include the colors it wants to change. Everything else falls back to the default.

## Key Files

| File | What it does |
|---|---|
| `Dimension.h/.cpp` | Base fog/sky methods, Overworld sunrise |
| `HellDimension.cpp` | Nether fog color and light ramp |
| `TheEndDimension.cpp` | End fog color (fixed low brightness) |
| `GameRenderer.cpp` | `setupFog()`, `setupClearColor()` |
| `Level.cpp` | `getSkyColor()` (biome-based) |
| `ColourTable.h/.cpp` | Data-driven color system |
| `Biome.h/.cpp` | Per-biome sky colors |
