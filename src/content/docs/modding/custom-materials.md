---
title: Custom Materials
description: How to create and modify block materials in LCE to control solidity, flammability, piston behavior, and more.
---

Every block (called a `Tile` in the codebase) has a `Material` pointer that tells the game how that block should behave at a fundamental level. Is it solid? Can fire burn it? Does water flow through it? Can a piston push it? All of that comes from the material.

Materials are not the same as textures or block types. Think of them as a shared behavior profile. Stone and bricks both use `Material::stone`. Oak planks and bookshelves both use `Material::wood`. The material answers questions about the block without knowing which specific block it is.

## The Material class

**File:** `Minecraft.World/Material.h`, `Minecraft.World/Material.cpp`

Here's the base class, trimmed to the important parts:

```cpp
class Material
{
public:
    static const int PUSH_NORMAL  = 0;  // piston can push it
    static const int PUSH_DESTROY = 1;  // piston breaks it
    static const int PUSH_BLOCK   = 2;  // piston can't move it at all

    MaterialColor *color;

    Material(MaterialColor *color);

    virtual bool isLiquid();           // default: false
    virtual bool letsWaterThrough();   // true if not liquid AND not solid
    virtual bool isSolid();            // default: true
    virtual bool blocksLight();        // default: true
    virtual bool blocksMotion();       // default: true
    virtual bool isFlammable();        // default: false
    virtual bool isReplaceable();      // default: false
    virtual bool isSolidBlocking();    // true if blocksMotion() AND not neverBuildable
    virtual bool isAlwaysDestroyable();// default: true
    virtual int  getPushReaction();    // default: PUSH_NORMAL
    bool isDestroyedByHand();          // default: false

protected:
    Material *flammable();
    Material *replaceable();
    Material *neverBuildable();
    Material *notAlwaysDestroyable();
    Material *makeDestroyedByHand();
    Material *destroyOnPush();
    Material *notPushable();
};
```

The constructor sets all the defaults: not flammable, not replaceable, always destroyable, push reaction `PUSH_NORMAL`, and not destroyed by hand. The protected methods use a builder pattern so you can chain them when creating material instances.

### What each property does

| Property | Default | What it controls |
|---|---|---|
| `isSolid()` | `true` | Whether the block counts as a solid body. Affects water flow, rendering, and block placement checks. |
| `blocksLight()` | `true` | Whether the block stops light from passing through. |
| `blocksMotion()` | `true` | Whether entities collide with this block. Decorations and gases return `false`. |
| `isLiquid()` | `false` | Whether this is a liquid (water or lava). Liquids don't block motion and are replaceable. |
| `isFlammable()` | `false` | Whether fire can spread to/from blocks with this material. Lava also checks this. |
| `isReplaceable()` | `false` | Whether placing a block on top of this one replaces it instead of failing. Air, tall grass, and liquids are replaceable. |
| `isAlwaysDestroyable()` | `true` | Whether you can break it without needing a specific tool tier. Stone and metal set this to `false`. |
| `isSolidBlocking()` | varies | Combines `blocksMotion()` with `neverBuildable`. Used for mob spawning checks and block placement. |
| `getPushReaction()` | `PUSH_NORMAL` | What happens when a piston tries to move this block. |
| `isDestroyedByHand()` | `false` | Whether this block always drops resources when broken by hand (glass and ice set this). |
| `letsWaterThrough()` | varies | Computed: `true` when the block is neither liquid nor solid. Water can flow through these. |

## Material subclasses

The base `Material` class covers most blocks. Four subclasses override virtual methods for special cases.

### DecorationMaterial

**File:** `Minecraft.World/DecorationMaterial.h`

```cpp
class DecorationMaterial : public Material
{
public:
    DecorationMaterial(MaterialColor *color) : Material(color) { makeDestroyedByHand(); }

    virtual bool isSolid()       { return false; }
    virtual bool blocksLight()   { return false; }
    virtual bool blocksMotion()  { return false; }
};
```

Used for non-solid decorative stuff like flowers, torches, and rails. Entities walk right through these, light passes through them, and they always drop when broken by hand.

### GasMaterial

**File:** `Minecraft.World/GasMaterial.h`

```cpp
class GasMaterial : public Material
{
public:
    GasMaterial(MaterialColor *color) : Material(color) { replaceable(); }

    virtual bool isSolid()       { return false; }
    virtual bool blocksLight()   { return false; }
    virtual bool blocksMotion()  { return false; }
};
```

Basically the same as `DecorationMaterial` but also replaceable. Used for air and fire. You can place blocks directly on top of gas materials.

### LiquidMaterial

**File:** `Minecraft.World/LiquidMaterial.h`

```cpp
class LiquidMaterial : public Material
{
public:
    LiquidMaterial(MaterialColor *color) : Material(color) { replaceable(); destroyOnPush(); }

    virtual bool isLiquid()      { return true; }
    virtual bool blocksMotion()  { return false; }
    virtual bool isSolid()       { return false; }
};
```

Used for water and lava. Liquids are replaceable (you can place blocks in them) and get destroyed when pushed by pistons.

### PortalMaterial

**File:** `Minecraft.World/PortalMaterial.h`

```cpp
class PortalMaterial : public Material
{
public:
    PortalMaterial(MaterialColor *color) : Material(color) { }

    virtual bool isSolid()       { return false; }
    virtual bool blocksLight()   { return false; }
    virtual bool blocksMotion()  { return false; }
};
```

Used for the end portal block. Non-solid, lets light through, but not replaceable (unlike gas). Also set to `notPushable()` when the instance is created.

### WebMaterial

**File:** `Minecraft.World/WebMaterial.h`

A 4J Studios addition. Java edition just tweaks the regular Material inline, but the console port made a subclass:

```cpp
class WebMaterial : public Material
{
public:
    WebMaterial(MaterialColor *color) : Material(color) {}
    virtual bool blocksMotion() { return false; }
};
```

The only difference from base `Material` is that webs don't block entity motion. Entities still get slowed by the web tile's `handleEntityInside()` method, but the material itself says "no collision."

## All built-in materials

Every material gets created in `Material::staticCtor()`. Here's the full list with their properties:

| Material | Base class | Color | Solid | Blocks light | Blocks motion | Flammable | Replaceable | Push reaction | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `air` | `GasMaterial` | none | no | no | no | no | yes | normal | |
| `grass` | `Material` | grass | yes | yes | yes | no | no | normal | |
| `dirt` | `Material` | dirt | yes | yes | yes | no | no | normal | |
| `wood` | `Material` | wood | yes | yes | yes | yes | no | normal | |
| `stone` | `Material` | stone | yes | yes | yes | no | no | normal | not always destroyable |
| `metal` | `Material` | metal | yes | yes | yes | no | no | normal | not always destroyable |
| `heavyMetal` | `Material` | metal | yes | yes | yes | no | no | block | not always destroyable, not pushable |
| `water` | `LiquidMaterial` | water | no | no* | no | no | yes | destroy | |
| `lava` | `LiquidMaterial` | fire | no | no* | no | no | yes | destroy | |
| `leaves` | `Material` | plant | yes | yes | yes | yes | no | destroy | never buildable |
| `plant` | `DecorationMaterial` | plant | no | no | no | no | no | destroy | |
| `replaceable_plant` | `DecorationMaterial` | plant | no | no | no | yes | yes | destroy | tall grass, dead bush |
| `sponge` | `Material` | cloth | yes | yes | yes | no | no | normal | |
| `cloth` | `Material` | cloth | yes | yes | yes | yes | no | normal | |
| `fire` | `GasMaterial` | none | no | no | no | no | yes* | destroy | replaceable via GasMaterial |
| `sand` | `Material` | sand | yes | yes | yes | no | no | normal | |
| `decoration` | `DecorationMaterial` | none | no | no | no | no | no | destroy | |
| `clothDecoration` | `DecorationMaterial` | cloth | no | no | no | yes | no | normal | |
| `glass` | `Material` | none | yes | yes | yes | no | no | normal | never buildable, destroyed by hand |
| `buildable_glass` | `Material` | none | yes | yes | yes | no | no | normal | destroyed by hand |
| `explosive` | `Material` | fire | yes | yes | yes | yes | no | normal | never buildable |
| `coral` | `Material` | plant | yes | yes | yes | no | no | destroy | |
| `ice` | `Material` | ice | yes | yes | yes | no | no | normal | never buildable, destroyed by hand |
| `topSnow` | `DecorationMaterial` | snow | no | no | no | no | yes | destroy | never buildable, not always destroyable |
| `snow` | `Material` | snow | yes | yes | yes | no | no | normal | not always destroyable |
| `cactus` | `Material` | plant | yes | yes | yes | no | no | destroy | never buildable |
| `clay` | `Material` | clay | yes | yes | yes | no | no | normal | |
| `vegetable` | `Material` | plant | yes | yes | yes | no | no | destroy | pumpkins, melons |
| `egg` | `Material` | plant | yes | yes | yes | no | no | destroy | dragon egg |
| `portal` | `PortalMaterial` | none | no | no | no | no | no | block | not pushable |
| `cake` | `Material` | none | yes | yes | yes | no | no | destroy | |
| `web` | `WebMaterial` | cloth | yes | yes | no | no | no | destroy | not always destroyable |
| `piston` | `Material` | stone | yes | yes | yes | no | no | block | not pushable |

*Liquids block light via `LevelChunk` logic, not through the material itself.

## How blocks reference their material

Every `Tile` stores a public `Material *material` pointer, set during construction:

```cpp
// In Tile.h
class Tile
{
public:
    Material *material;

protected:
    Tile(int id, Material *material, bool isSolidRender = true);
};
```

When you create a new block, you pass the material as the second constructor argument:

```cpp
// From Tile::staticCtor() in Tile.cpp
Tile::stoneBrick = (new Tile(4, Material::stone))
    ->setDestroyTime(2.0f)
    ->setExplodeable(10)
    ->setSoundType(Tile::SOUND_STONE)
    ->setTextureName(L"stonebrick")
    ->setDescriptionId(IDS_TILE_STONE_BRICK);

Tile::door_wood = (new DoorTile(64, Material::wood))
    ->setDestroyTime(3.0f)
    ->setSoundType(Tile::SOUND_WOOD)
    ->setTextureName(L"doorWood")
    ->setDescriptionId(IDS_TILE_DOOR_WOOD);
```

The rest of the game then queries the material through the tile pointer. Nobody checks what specific block something is when they want to know "is this solid?" They just ask the material.

## How materials affect gameplay

### Piston behavior

When a piston tries to push a block, it checks `Tile::getPistonPushReaction()`, which by default just calls through to the material:

```cpp
int Tile::getPistonPushReaction()
{
    return material->getPushReaction();
}
```

The three reactions:

- **`PUSH_NORMAL` (0)**: Piston pushes the block normally. Most blocks.
- **`PUSH_DESTROY` (1)**: Piston breaks the block (like flowers, torches, water). The block drops as an item or vanishes.
- **`PUSH_BLOCK` (2)**: Piston can't push it at all. Obsidian, bedrock, portals, piston heads.

Some tiles override `getPistonPushReaction()` directly instead of relying on the material. Rails, beds, doors, and pressure plates all do this.

### Fire spread

The `FireTile` class maintains its own `flameOdds` array for per-block fire chances. But lava uses the material's `isFlammable()` flag when deciding whether to ignite nearby blocks:

```cpp
// In LiquidTileStatic.cpp
bool LiquidTileStatic::isFlammable(Level *level, int x, int y, int z)
{
    return level->getMaterial(x, y, z)->isFlammable();
}
```

If lava is sitting next to a block whose material is flammable, it can start fires. Wood, cloth, leaves, replaceable plants, and explosive materials are all flammable.

### Mob spawning

The mob spawner checks `isSolidBlocking()` and `isLiquid()` when picking spawn locations. From `MobSpawner.cpp`:

```cpp
// Land mobs need:
// 1. Solid blocking tile below (for standing on)
// 2. Not bedrock below
// 3. Not solid blocking at mob position
// 4. Not liquid at mob position
// 5. Not solid blocking above (headroom)
if (!level->isTopSolidBlocking(x, y - 1, z)) return false;
int tt = level->getTile(x, y - 1, z);
return tt != Tile::unbreakable_Id
    && !level->isSolidBlockingTile(x, y, z)
    && !level->getMaterial(x, y, z)->isLiquid()
    && !level->isSolidBlockingTile(x, y + 1, z);
```

And `isSolidBlocking()` itself depends on the material:

```cpp
bool Material::isSolidBlocking()
{
    if (_neverBuildable) return false;
    return blocksMotion();
}
```

So if your custom material has `blocksMotion() = true` and isn't marked `neverBuildable`, mobs can spawn on blocks that use it.

### Tool requirements

When a player punches a block, the inventory system checks `isAlwaysDestroyable()`:

```cpp
// In Inventory.cpp
if (tile->material->isAlwaysDestroyable()) return true;
```

If the material returns `true`, you can break the block with your bare hands (it might be slow, but it works). If it returns `false` (like stone and metal), you need the right tool tier or you get nothing.

### Block placement and replacement

When placing a block, the game checks whether the target position is empty or replaceable:

```cpp
// In Tile.cpp
return t == 0 || Tile::tiles[t]->material->isReplaceable();
```

Replaceable materials (air, fire, water, lava, tall grass, top snow) get overwritten. Everything else blocks placement.

### Water flow

`letsWaterThrough()` is computed, not stored:

```cpp
bool Material::letsWaterThrough()
{
    return (!isLiquid() && !isSolid());
}
```

If a block's material is neither liquid nor solid, water flows right through it. This is why water passes through torches, flowers, and signs but not through glass or fences.

## MaterialColor

Each material has a `MaterialColor` that determines the block's color on maps. The available colors:

| MaterialColor | ID | Used by |
|---|---|---|
| `none` | 0 | air, fire, glass, decoration, portal, cake |
| `grass` | 1 | grass |
| `sand` | 2 | sand |
| `cloth` | 3 | sponge, cloth, clothDecoration, web |
| `fire` | 4 | lava, explosive |
| `ice` | 5 | ice |
| `metal` | 6 | metal, heavyMetal |
| `plant` | 7 | leaves, plant, replaceable_plant, cactus, coral, vegetable, egg |
| `snow` | 8 | topSnow, snow |
| `clay` | 9 | clay |
| `dirt` | 10 | dirt |
| `stone` | 11 | stone, piston |
| `water` | 12 | water |
| `wood` | 13 | wood |

Colors are defined in `MaterialColor::staticCtor()` and are stored in a global array indexed by ID. Each color maps to an `eMinecraftColour` enum value that the map renderer uses.

## Creating a new material

### Step 1: Decide what you need

Ask yourself:
- Should the block be solid? (entities collide with it)
- Should light pass through?
- Can entities walk through it?
- Is it flammable?
- Can players place blocks over it?
- What should pistons do with it?
- Does it need a special tool to break?

If an existing material already matches, just use that one. You don't need a new material for every new block.

### Step 2: Add the static pointer

In `Material.h`, add a new static member:

```cpp
class Material
{
public:
    // ... existing materials ...
    static Material *myCustomMaterial;
    // ...
};
```

And initialize it in `Material.cpp`:

```cpp
Material *Material::myCustomMaterial = NULL;
```

### Step 3: Create the instance

If the base `Material` class covers your needs, just chain the builder methods in `Material::staticCtor()`:

```cpp
void Material::staticCtor()
{
    // ... existing materials ...

    // Example: a solid, flammable block that pistons destroy
    Material::myCustomMaterial = (new Material(MaterialColor::plant))
        ->flammable()
        ->destroyOnPush();
}
```

### Step 4 (optional): Create a subclass

If you need to override virtual methods (like making something non-solid or liquid), create a new subclass:

```cpp
// MyCustomMaterial.h
#pragma once
#include "Material.h"

class MyCustomMaterial : public Material
{
public:
    MyCustomMaterial(MaterialColor *color) : Material(color) {}

    // Solid but lets light through (like ice)
    virtual bool blocksLight() { return false; }
};
```

Then use it in `staticCtor()`:

```cpp
Material::myCustomMaterial = (new MyCustomMaterial(MaterialColor::ice))
    ->notAlwaysDestroyable();
```

Don't forget to `#include` your new header in `Material.cpp`.

### Step 5: Use it in a tile

When creating your block in `Tile::staticCtor()`, pass your new material:

```cpp
Tile::myBlock = (new Tile(MY_BLOCK_ID, Material::myCustomMaterial))
    ->setDestroyTime(1.5f)
    ->setSoundType(Tile::SOUND_STONE)
    ->setTextureName(L"myBlock")
    ->setDescriptionId(IDS_TILE_MY_BLOCK);
```

### Step 6 (optional): Add a new MaterialColor

If none of the 14 existing colors match your block on maps, you can add one. In `MaterialColor.h`:

```cpp
class MaterialColor
{
public:
    // ... existing colors ...
    static MaterialColor *myColor;
};
```

In `MaterialColor.cpp`, bump the array size and add your color:

```cpp
void MaterialColor::staticCtor()
{
    MaterialColor::colors = new MaterialColor *[17]; // was 16, now 17

    // ... existing colors ...
    MaterialColor::myColor = new MaterialColor(14, eMinecraftColour_Material_MyColor);
}
```

You'll also need to add the `eMinecraftColour_Material_MyColor` enum value in the color definitions. The map renderer uses this to pick the actual RGB values.

## Full example: a "crystal" material

Let's walk through adding a crystal material for a hypothetical crystal block. Crystals should be:
- Solid (you can stand on them)
- Transparent to light (like glass)
- Not flammable
- Destroyed by pistons
- Breakable by hand (always drops)

**CrystalMaterial.h:**

```cpp
#pragma once
#include "Material.h"

class CrystalMaterial : public Material
{
public:
    CrystalMaterial(MaterialColor *color) : Material(color)
    {
        makeDestroyedByHand();
    }

    virtual bool blocksLight() { return false; }
};
```

**Material.h** (add the pointer):

```cpp
static Material *crystal;
```

**Material.cpp** (initialize and create):

```cpp
Material *Material::crystal = NULL;

// In staticCtor():
Material::crystal = (new CrystalMaterial(MaterialColor::ice))
    ->neverBuildable()
    ->destroyOnPush();
```

**Tile::staticCtor()** (use it):

```cpp
Tile::crystalBlock = (new Tile(CRYSTAL_BLOCK_ID, Material::crystal))
    ->setDestroyTime(0.5f)
    ->setSoundType(Tile::SOUND_GLASS)
    ->setTextureName(L"crystal")
    ->setDescriptionId(IDS_TILE_CRYSTAL);
```

This gives you a block that:
- Mobs can spawn on (solid + blocks motion + not never-buildable... wait, we set `neverBuildable`). Actually, `neverBuildable` makes `isSolidBlocking()` return `false`, so mobs will not spawn on crystal blocks. That's probably what you want for a decorative crystal.
- Light passes through (good for a crystal)
- Pistons break it
- Always drops when punched
- Shows up as ice-blue on maps

## The staticCtor initialization order

All materials are created in `Material::staticCtor()`. Here's the exact order and the builder chain for every material. This matters because the builder methods mutate the object in place, and the chain determines the final property state.

```cpp
void Material::staticCtor()
{
    air             = new GasMaterial(MaterialColor::none);
    grass           = new Material(MaterialColor::grass);
    dirt            = new Material(MaterialColor::dirt);
    wood            = (new Material(MaterialColor::wood))->flammable();
    stone           = (new Material(MaterialColor::stone))->notAlwaysDestroyable();
    metal           = (new Material(MaterialColor::metal))->notAlwaysDestroyable();
    heavyMetal      = (new Material(MaterialColor::metal))
                        ->notAlwaysDestroyable()->notPushable();
    water           = (new LiquidMaterial(MaterialColor::water))
                        ->destroyOnPush();
    lava            = (new LiquidMaterial(MaterialColor::fire))
                        ->destroyOnPush();
    leaves          = (new Material(MaterialColor::plant))
                        ->flammable()->neverBuildable()->destroyOnPush();
    plant           = (new DecorationMaterial(MaterialColor::plant))
                        ->destroyOnPush();
    replaceable_plant = (new DecorationMaterial(MaterialColor::plant))
                        ->flammable()->destroyOnPush()->replaceable();
    sponge          = new Material(MaterialColor::cloth);
    cloth           = (new Material(MaterialColor::cloth))->flammable();
    fire            = (new GasMaterial(MaterialColor::none))
                        ->destroyOnPush();
    sand            = new Material(MaterialColor::sand);
    decoration      = (new DecorationMaterial(MaterialColor::none))
                        ->destroyOnPush();
    clothDecoration = (new DecorationMaterial(MaterialColor::cloth))
                        ->flammable();
    glass           = (new Material(MaterialColor::none))
                        ->neverBuildable()->makeDestroyedByHand();
    buildable_glass = (new Material(MaterialColor::none))
                        ->makeDestroyedByHand();
    explosive       = (new Material(MaterialColor::fire))
                        ->flammable()->neverBuildable();
    coral           = (new Material(MaterialColor::plant))->destroyOnPush();
    ice             = (new Material(MaterialColor::ice))
                        ->neverBuildable()->makeDestroyedByHand();
    topSnow         = (new DecorationMaterial(MaterialColor::snow))
                        ->replaceable()->neverBuildable()
                        ->notAlwaysDestroyable()->destroyOnPush();
    snow            = (new Material(MaterialColor::snow))
                        ->notAlwaysDestroyable();
    cactus          = (new Material(MaterialColor::plant))
                        ->neverBuildable()->destroyOnPush();
    clay            = new Material(MaterialColor::clay);
    vegetable       = (new Material(MaterialColor::plant))->destroyOnPush();
    egg             = (new Material(MaterialColor::plant))->destroyOnPush();
    portal          = (new PortalMaterial(MaterialColor::none))->notPushable();
    cake            = (new Material(MaterialColor::none))->destroyOnPush();
    web             = (new WebMaterial(MaterialColor::cloth))
                        ->notAlwaysDestroyable()->destroyOnPush();
    piston          = (new Material(MaterialColor::stone))->notPushable();
}
```

Notice a few interesting things:
- `water` and `lava` call `destroyOnPush()` even though `LiquidMaterial` already sets this in its constructor. The builder chain applies it twice but the result is the same.
- `topSnow` is the most complex: it's a `DecorationMaterial` (non-solid, no light blocking, no motion blocking) that's also replaceable, never buildable, not always destroyable, and destroyed by pistons.
- `clothDecoration` is the only decoration material that's flammable but not destroyed by pistons. This means carpets burn but pistons push them normally.

## Additional gameplay systems that use materials

### Entity movement and collision

When an entity moves through the world, the physics engine checks `blocksMotion()` to decide if there's a collision. Materials where `blocksMotion()` returns false (decorations, gases, liquids, webs, portals) let entities pass through. Webs are special: the material says no collision, but the `WebTile::handleEntityInside()` method applies a velocity multiplier of 0.25 to slow entities down.

### Rendering and transparency

`blocksLight()` controls whether the block stops light propagation. But it also affects how the renderer decides whether to draw faces between adjacent blocks. If a block's material blocks light, the renderer assumes adjacent faces are hidden and skips them. This is why glass (which blocks light) sometimes shows faces against other glass blocks. The `isSolid()` method also affects the rendering pipeline: non-solid blocks use a different render pass that supports transparency.

### The `neverBuildable` flag

This is one of the less obvious properties. When `neverBuildable` is set:
- `isSolidBlocking()` returns `false` regardless of `blocksMotion()`
- Mobs won't spawn on blocks with this material
- The block can't be used as a foundation for other blocks in some placement checks

Materials that set this: leaves, glass, explosive, ice, cactus, topSnow. These are all blocks that look solid but shouldn't count as real building surfaces.

### The `destroyedByHand` flag

This is not the same as `isAlwaysDestroyable()`. The `isAlwaysDestroyable` flag controls whether any tool can break the block. The `destroyedByHand` flag controls whether the block drops its item when broken without a tool. Glass and ice set `destroyedByHand` to true, which is why they always drop (well, glass doesn't drop normally, but the flag is about the material level, not the tile's specific drop logic).

### Map colors in detail

The map renderer looks up `material->color->id` to find the color for each pixel. The mapping goes through the `eMinecraftColour` system:

```cpp
MaterialColor::MaterialColor(int id, eMinecraftColour colorEnum)
{
    this->id = id;
    this->color = colorEnum;
    MaterialColor::colors[id] = this;
}
```

The actual RGB values for map colors are loaded from the ColourTable binary data, which means texture packs can change how blocks appear on maps.

## Key source files

- `Minecraft.World/Material.h` / `.cpp` for the base class and all static instances
- `Minecraft.World/DecorationMaterial.h` for non-solid decorative blocks
- `Minecraft.World/GasMaterial.h` for gas (air, fire)
- `Minecraft.World/LiquidMaterial.h` for water and lava
- `Minecraft.World/PortalMaterial.h` for portal blocks
- `Minecraft.World/WebMaterial.h` for cobwebs (4J addition)
- `Minecraft.World/MaterialColor.h` / `.cpp` for map colors
- `Minecraft.World/Tile.h` / `.cpp` for how blocks use materials
- `Minecraft.World/FireTile.cpp` for fire spread flammability checks
- `Minecraft.World/LiquidTileStatic.cpp` for lava ignition checks
- `Minecraft.World/PistonBaseTile.cpp` for piston push reaction logic
- `Minecraft.World/MobSpawner.cpp` for mob spawning material checks
- `Minecraft.World/Inventory.cpp` for tool requirement checks
- `Minecraft.World/WebTile.cpp` for the web slowdown behavior (separate from material)
