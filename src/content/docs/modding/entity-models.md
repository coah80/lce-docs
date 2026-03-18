---
title: Entity Models
description: How entity models work in LCE and how to build your own from scratch.
---

Entity models are how mobs and other entities get their 3D shape. Every pig, zombie, spider, and dragon you see in the game is built from the same simple system: `ModelPart` objects containing `Cube` objects, arranged in a tree. This guide covers how that system works and how to create your own models.

## The Building Blocks

There are three classes that make up the model system:

| Class | What It Does |
|-------|-------------|
| `Model` | Base class for all entity models. Holds a list of parts, texture dimensions, and virtual methods for rendering and animation. |
| `ModelPart` | A single bone/joint in the model. Has a position, rotation, texture offset, and a list of cubes. Can have child parts. |
| `Cube` | A single box shape. Gets its vertices and polygons generated from dimensions you give it. This is the actual geometry. |

The flow goes like this: a `Model` owns several `ModelPart` pointers. Each `ModelPart` holds one or more `Cube` objects (the visible boxes). Parts can also have child parts, which move and rotate relative to their parent.

## Model (the base)

`Model` (`Minecraft.Client/Model.h`) is the base class every entity model inherits from. It's pretty small:

```cpp
class Model
{
public:
    float attackTime;
    bool riding;
    vector<ModelPart *> cubes;   // all top-level parts
    bool young;
    int texWidth;                // texture sheet width (default 64)
    int texHeight;               // texture sheet height (default 32)

    virtual void render(...) {}
    virtual void setupAnim(...) {}
    virtual void prepareMobModel(...) {}

protected:
    float yHeadOffs;
    float zHeadOffs;
};
```

Key things:
- `cubes` is a bit of a misleading name. It's actually all the top-level `ModelPart` pointers, not `Cube` objects. Parts get added to this list automatically when you construct them with a `Model *` pointer.
- `texWidth` and `texHeight` default to 64x32. Bigger models (like the Iron Golem or Ender Dragon) use larger texture sheets like 128x128 or 256x256.
- `render()` draws the model. `setupAnim()` sets rotation values each frame. `prepareMobModel()` runs before animation for entity-specific setup.

## ModelPart (the bones)

`ModelPart` (`Minecraft.Client/ModelPart.h`) is where most of the action happens. Each part is a bone in the skeleton that can be positioned, rotated, and can hold cubes and children.

```cpp
class ModelPart
{
public:
    float xTexSize, yTexSize;       // texture sheet size (inherited from model)
    float x, y, z;                  // position offset
    float xRot, yRot, zRot;        // rotation in radians
    bool bMirror;                   // flip texture horizontally
    bool visible;                   // can be toggled off
    bool neverRender;               // permanently hidden
    vector<Cube *> cubes;           // the box shapes in this part
    vector<ModelPart *> children;   // child parts that move with this one

    ModelPart(Model *model, int xTexOffs, int yTexOffs);
    ModelPart *texOffs(int xTexOffs, int yTexOffs);
    ModelPart *addBox(float x0, float y0, float z0, int w, int h, int d);
    void addBox(float x0, float y0, float z0, int w, int h, int d, float g);
    void setPos(float x, float y, float z);
    void addChild(ModelPart *child);
    void render(float scale, bool usecompiled);
    void compile(float scale);
    ModelPart *setTexSize(int xs, int ys);
};
```

When you create a `ModelPart` with a `Model *` pointer, it automatically registers itself in the model's `cubes` list. The typical workflow for setting up a part is:

1. Create the part with a texture offset
2. Add one or more boxes to it
3. Set its position in the model
4. Compile it

The `g` parameter in `addBox` is a "grow" value. It inflates the box by that many pixels in every direction. This is used for armor layers (they need to be slightly bigger than the body to not clip through it).

## Cube (the geometry)

`Cube` (`Minecraft.Client/Cube.h`) is the actual box geometry. You rarely interact with it directly since `ModelPart::addBox()` creates cubes for you. But it's good to know what's going on under the hood.

A cube takes these parameters:

```cpp
Cube(ModelPart *modelPart,
     int xTexOffs, int yTexOffs,    // where on the texture sheet
     float x0, float y0, float z0,  // corner position within the part
     int w, int h, int d,           // width, height, depth in pixels
     float g,                        // grow amount
     int faceMask = 63,             // which faces to render (bitmask)
     bool bFlipPoly3UVs = false);   // flip UVs for player skin compatibility
```

The `faceMask` is a 6-bit bitmask where each bit controls one face:

| Bit | Value | Face |
|-----|-------|------|
| 0   | 1     | Right (+X) |
| 1   | 2     | Left (-X) |
| 2   | 4     | Top (+Y) |
| 3   | 8     | Bottom (-Y) |
| 4   | 16    | Front (-Z) |
| 5   | 32    | Back (+Z) |

The default value of 63 means all faces are visible. You can use `addBoxWithMask()` on a `ModelPart` to create cubes with specific faces hidden. This is handy when two boxes share a face and you don't want z-fighting.

## UV Texture Mapping

Cubes use a box-unwrap UV layout. If you've ever seen a Minecraft skin template, it's the same idea. Given a cube at texture offset `(xTexOffs, yTexOffs)` with dimensions `w` (width), `h` (height), and `d` (depth), the faces map like this:

```
                d       w       d       w
           +--------+--------+--------+--------+
           |        |  Top   |        |        |
     d     |        | (w x d)|        |        |
           +--------+--------+--------+--------+
           | Left   | Front  | Right  |  Back  |
     h     |(d x h) |(w x h) |(d x h) | (w x h)|
           +--------+--------+--------+--------+

           ^
           |
     (xTexOffs, yTexOffs) is the top-left corner
```

So the top row is `d` pixels tall and holds the top/bottom faces. The bottom row is `h` pixels tall and holds the four side faces. The total texture space used is `(2*d + 2*w)` wide by `(d + h)` tall.

This all happens automatically inside the `Cube` constructor. You just need to set the right `texOffs` on the `ModelPart` before adding boxes.

## How Existing Models Work

Let's look at some real models to see these concepts in action.

### QuadrupedModel (pig, cow, sheep base)

`QuadrupedModel` is the base for four-legged animals. It creates a head, body, and four legs:

```cpp
QuadrupedModel::QuadrupedModel(int legSize, float g) : Model()
{
    yHeadOffs = 8;
    zHeadOffs = 4;

    head = new ModelPart(this, 0, 0);
    head->addBox(-4, -4, -8, 8, 8, 8, g);
    head->setPos(0, (float)(12 + 6 - legSize), -6);

    body = new ModelPart(this, 28, 8);
    body->addBox(-5, -10, -7, 10, 16, 8, g);
    body->setPos(0, (float)(11 + 6 - legSize), 2);

    leg0 = new ModelPart(this, 0, 16);
    leg0->addBox(-2, 0, -2, 4, legSize, 4, g);
    leg0->setPos(-3, (float)(18 + 6 - legSize), 7);

    leg1 = new ModelPart(this, 0, 16);
    leg1->addBox(-2, 0, -2, 4, legSize, 4, g);
    leg1->setPos(3, (float)(18 + 6 - legSize), 7);

    leg2 = new ModelPart(this, 0, 16);
    leg2->addBox(-2, 0, -2, 4, legSize, 4, g);
    leg2->setPos(-3, (float)(18 + 6 - legSize), -5);

    leg3 = new ModelPart(this, 0, 16);
    leg3->addBox(-2, 0, -2, 4, legSize, 4, g);
    leg3->setPos(3, (float)(18 + 6 - legSize), -5);

    // compile all parts for GPU display lists
    head->compile(1.0f/16.0f);
    body->compile(1.0f/16.0f);
    leg0->compile(1.0f/16.0f);
    leg1->compile(1.0f/16.0f);
    leg2->compile(1.0f/16.0f);
    leg3->compile(1.0f/16.0f);
}
```

Notice the pattern: each leg uses the same texture offset `(0, 16)` because they all share the same texture. The `legSize` parameter controls how tall the legs are, which is what makes pigs shorter than cows.

### PigModel (extending QuadrupedModel)

The pig just adds a snout on top of the base quadruped:

```cpp
PigModel::PigModel() : QuadrupedModel(6, 0)
{
    // add the snout box to the head part at a different texture offset
    head->texOffs(16, 16)->addBox(-2.0f, 0.0f, -9.0f, 4, 3, 1, 0.0f);
    yHeadOffs = 4;
    head->compile(1.0f/16.0f);
}
```

The `texOffs()` call changes the texture offset before adding the snout box. Since `addBox` returns the `ModelPart *`, and `texOffs` also returns the `ModelPart *`, you can chain these calls. After adding the snout, the head part gets recompiled to include the new geometry.

The `6` passed to `QuadrupedModel` makes the legs 6 pixels tall (shorter than the default). That's why pigs are stubby.

### CreeperModel (custom from scratch)

The creeper doesn't extend any shared base. It builds everything itself:

```cpp
CreeperModel::CreeperModel() : Model()
{
    _init(0);
}

void CreeperModel::_init(float g)
{
    int yo = 4;

    head = new ModelPart(this, 0, 0);
    head->addBox(-4, -8, -4, 8, 8, 8, g);
    head->setPos(0, (float)(yo), 0);

    hair = new ModelPart(this, 32, 0);
    hair->addBox(-4, -8, -4, 8, 8, 8, g + 0.5f);
    hair->setPos(0, (float)(yo), 0);

    body = new ModelPart(this, 16, 16);
    body->addBox(-4, 0, -2, 8, 12, 4, g);
    body->setPos(0, (float)(yo), 0);

    leg0 = new ModelPart(this, 0, 16);
    leg0->addBox(-2, 0, -2, 4, 6, 4, g);
    leg0->setPos(-2, (float)(12 + yo), 4);

    // ... leg1, leg2, leg3 similar ...

    head->compile(1.0f/16.0f);
    hair->compile(1.0f/16.0f);
    body->compile(1.0f/16.0f);
    // ... compile all legs ...
}
```

The `hair` part is the charged creeper overlay. It uses the same box dimensions as the head but with `g + 0.5f` to make it slightly bigger, so it sits on top of the head without z-fighting.

## Positioning and Rotating Parts

### Position

`setPos(x, y, z)` sets where the part's pivot point is in the model. All coordinates are in pixels (1 pixel = 1/16 of a block). The origin `(0, 0, 0)` is roughly the center-bottom of the entity.

- **X**: Left/right. Negative is the entity's right side, positive is left.
- **Y**: Up/down. `0` is the top of the entity, positive goes down. Yes, Y increases downward in model space.
- **Z**: Front/back. Negative is the front (face direction), positive is the back.

The box offsets in `addBox(x0, y0, z0, ...)` are relative to the part's pivot point. So a head at `setPos(0, 0, 0)` with `addBox(-4, -8, -4, 8, 8, 8)` means the box extends 4 pixels in each direction on X/Z, and 8 pixels upward from the pivot on Y.

### Rotation

Rotations are stored in radians and applied during rendering:

```cpp
// from ModelPart::render()
if (zRot != 0) glRotatef(zRot * RAD, 0, 0, 1);
if (yRot != 0) glRotatef(yRot * RAD, 0, 1, 0);
if (xRot != 0) glRotatef(xRot * RAD, 1, 0, 0);
```

Where `RAD` is `180.0f / PI` (converts radians to degrees for OpenGL). The rotation order is Z, then Y, then X. Rotations happen around the part's pivot point (set by `setPos`).

You typically set rotations in `setupAnim()` each frame:

```cpp
void QuadrupedModel::setupAnim(float time, float r, ...)
{
    head->xRot = xRot / (180.0f / PI);  // convert degrees to radians
    head->yRot = yRot / (180.0f / PI);
    body->xRot = 90 / (180.0f / PI);    // body rotated 90 degrees

    // legs swing back and forth using a sine wave
    leg0->xRot = (Mth::cos(time * 0.6662f) * 1.4f) * r;
    leg1->xRot = (Mth::cos(time * 0.6662f + PI) * 1.4f) * r;
    leg2->xRot = (Mth::cos(time * 0.6662f + PI) * 1.4f) * r;
    leg3->xRot = (Mth::cos(time * 0.6662f) * 1.4f) * r;
}
```

The `time` parameter is the entity's walk cycle timer, and `r` is the walk speed (0 when standing still, higher when moving). Opposite legs use `+ PI` to walk in alternating pairs.

## Parent-Child Relationships

Parts can have children via `addChild()`. Child parts are positioned and rotated relative to their parent. When the parent moves or rotates, all children move with it.

The Ender Dragon is the best example. Its legs are multi-segment chains:

```cpp
// upper leg
frontLeg = new ModelPart(this, L"frontleg");
frontLeg->setPos(-12, 20, 2);
frontLeg->addBox(L"main", -4, -4, -4, 8, 24, 8);

// lower leg (child of upper leg)
frontLegTip = new ModelPart(this, L"frontlegtip");
frontLegTip->setPos(0, 20, -1);
frontLegTip->addBox(L"main", -3, -1, -3, 6, 24, 6);
frontLeg->addChild(frontLegTip);

// foot (child of lower leg)
frontFoot = new ModelPart(this, L"frontfoot");
frontFoot->setPos(0, 23, 0);
frontFoot->addBox(L"main", -4, 0, -12, 8, 4, 16);
frontLegTip->addChild(frontFoot);
```

When `frontLeg` rotates at the hip, `frontLegTip` and `frontFoot` both follow. When `frontLegTip` bends at the knee, only `frontFoot` follows. This is how you get realistic joint chains.

The rendering code in `ModelPart::render()` handles this automatically. After drawing the parent's cubes, it loops through all children and calls `render()` on each one, while the parent's translation and rotation are still on the OpenGL matrix stack:

```cpp
void ModelPart::render(float scale, bool usecompiled, bool bHideParentBodyPart)
{
    // ... apply position and rotation via glTranslatef / glRotatef ...

    // draw this part's cubes
    if (!bHideParentBodyPart)
        glCallList(list);

    // draw all children (they inherit our transform)
    for (unsigned int i = 0; i < children.size(); i++)
        children.at(i)->render(scale, usecompiled);

    // ... pop matrix ...
}
```

## Connecting Models to Renderers

Models don't render themselves in the world. They need a renderer. The chain goes:

```
EntityRenderDispatcher -> EntityRenderer/MobRenderer -> Model
```

`MobRenderer` is the standard renderer for most mobs. It takes a `Model *` in its constructor and calls `model->render()` each frame. Here's how the pig gets wired up in `EntityRenderDispatcher`:

```cpp
// In EntityRenderDispatcher::EntityRenderDispatcher()
renderers[eTYPE_PIG] = new PigRenderer(new PigModel(), new PigModel(0.5f), 0.7f);
```

That's two pig models: one at normal size for the body, and one with `grow = 0.5f` for the saddle armor layer. The `0.7f` is the shadow radius.

`PigRenderer` extends `MobRenderer`:

```cpp
class PigRenderer : public MobRenderer
{
public:
    PigRenderer(Model *model, Model *armor, float shadow);

protected:
    virtual int prepareArmor(shared_ptr<Mob> _pig, int layer, float a);
};
```

For simple mobs, you can skip making a custom renderer and just use `MobRenderer` or `HumanoidMobRenderer` directly:

```cpp
renderers[eTYPE_PIGZOMBIE] = new HumanoidMobRenderer(new ZombieModel(), 0.5f);
```

## Creating a New Model From Scratch

Let's put it all together and build a custom mob model. We'll make a simple two-legged bird thing.

### Step 1: The Model Header

Create `Minecraft.Client/BirdModel.h`:

```cpp
#pragma once
#include "Model.h"

class BirdModel : public Model
{
public:
    ModelPart *head, *beak, *body, *wing0, *wing1, *leg0, *leg1;

    BirdModel();
    BirdModel(float g);

    void render(shared_ptr<Entity> entity, float time, float r, float bob,
                float yRot, float xRot, float scale, bool usecompiled);
    void setupAnim(float time, float r, float bob, float yRot,
                   float xRot, float scale,
                   unsigned int uiBitmaskOverrideAnim = 0);

private:
    void _init(float g);
};
```

### Step 2: The Model Implementation

Create `Minecraft.Client/BirdModel.cpp`:

```cpp
#include "stdafx.h"
#include "BirdModel.h"
#include "..\Minecraft.World\Mth.h"
#include "ModelPart.h"

BirdModel::BirdModel() : Model()
{
    _init(0);
}

BirdModel::BirdModel(float g) : Model()
{
    _init(g);
}

void BirdModel::_init(float g)
{
    // head at the top, centered
    head = new ModelPart(this, 0, 0);
    head->addBox(-3, -6, -3, 6, 6, 6, g);
    head->setPos(0, 8, -4);

    // beak as a child of head (moves with head rotation)
    beak = new ModelPart(this, 24, 0);
    beak->addBox(-1, -2, -5, 2, 2, 3, g);
    head->addChild(beak);

    // body
    body = new ModelPart(this, 0, 12);
    body->addBox(-4, 0, -3, 8, 10, 6, g);
    body->setPos(0, 8, 0);

    // wings as children of body
    wing0 = new ModelPart(this, 28, 12);
    wing0->addBox(-1, 0, -3, 1, 8, 6, g);
    wing0->setPos(-4, 0, 0);
    body->addChild(wing0);

    wing1 = new ModelPart(this, 28, 12);
    wing1->addBox(0, 0, -3, 1, 8, 6, g);
    wing1->setPos(4, 0, 0);
    body->addChild(wing1);

    // legs
    leg0 = new ModelPart(this, 0, 28);
    leg0->addBox(-1, 0, -1, 2, 6, 2, g);
    leg0->setPos(-2, 18, 0);

    leg1 = new ModelPart(this, 0, 28);
    leg1->addBox(-1, 0, -1, 2, 6, 2, g);
    leg1->setPos(2, 18, 0);

    // compile everything
    head->compile(1.0f / 16.0f);
    beak->compile(1.0f / 16.0f);
    body->compile(1.0f / 16.0f);
    wing0->compile(1.0f / 16.0f);
    wing1->compile(1.0f / 16.0f);
    leg0->compile(1.0f / 16.0f);
    leg1->compile(1.0f / 16.0f);
}

void BirdModel::render(shared_ptr<Entity> entity, float time, float r,
                        float bob, float yRot, float xRot,
                        float scale, bool usecompiled)
{
    setupAnim(time, r, bob, yRot, xRot, scale);

    head->render(scale, usecompiled);
    body->render(scale, usecompiled);
    leg0->render(scale, usecompiled);
    leg1->render(scale, usecompiled);
    // wings are children of body, so they render automatically
}

void BirdModel::setupAnim(float time, float r, float bob, float yRot,
                            float xRot, float scale,
                            unsigned int uiBitmaskOverrideAnim)
{
    // head looks where the entity is looking
    head->yRot = yRot / (180.0f / PI);
    head->xRot = xRot / (180.0f / PI);

    // legs walk
    leg0->xRot = (Mth::cos(time * 0.6662f) * 1.4f) * r;
    leg1->xRot = (Mth::cos(time * 0.6662f + PI) * 1.4f) * r;

    // wings flap using bob (age timer) for idle flapping
    wing0->zRot = Mth::cos(bob * 0.15f) * 0.3f;
    wing1->zRot = -Mth::cos(bob * 0.15f) * 0.3f;
}
```

Note that we don't call `render()` on `beak`, `wing0`, or `wing1` directly. The beak is a child of `head`, and the wings are children of `body`. They get rendered automatically when their parent renders.

### Step 3: Register the Renderer

In `EntityRenderDispatcher.cpp`, add the renderer:

```cpp
#include "BirdModel.h"

// in the constructor:
renderers[eTYPE_BIRD] = new MobRenderer(new BirdModel(), 0.4f);
```

If your bird needs a saddle or armor layer, pass a second model with grow:

```cpp
renderers[eTYPE_BIRD] = new MobRenderer(new BirdModel(), new BirdModel(0.5f), 0.4f);
```

### Step 4: Add to the Project

Don't forget to add your `.h` and `.cpp` files to `cmake/Sources.cmake` (in the `MINECRAFT_CLIENT_SOURCES` list) and `Minecraft.Client/Minecraft.Client.vcxproj` so they actually get compiled. And you'll need an `eTYPE_BIRD` entry in the `eINSTANCEOF` enum (see the [Adding Entities](/modding/adding-entities/) guide for that).

## The Mirroring System

When `bMirror` is set to `true` on a `ModelPart`, the cube constructor swaps the X coordinates and flips all polygon normals. This gives you a mirrored version of the same texture.

The `HumanoidModel` uses this for the left arm and left leg:

```cpp
arm1 = new ModelPart(this, 24 + 16, 16);
arm1->bMirror = true;
arm1->addHumanoidBox(-1, -2, -2, 4, 12, 4, g);
arm1->setPos(5, 2 + yOffset, 0);
```

Both arms share the same texture offset, but the mirrored one flips the texture so it looks correct on the opposite side. Set `bMirror` before calling `addBox`, since the flag is read during cube construction.

## Custom Texture Sheet Sizes

The default texture sheet is 64x32. If your model needs more texture space, set it on the model and each part:

```cpp
// Iron Golem uses 128x128
texWidth = 128;
texHeight = 128;

head = (new ModelPart(this))->setTexSize(128, 128);
```

Or for something like the Ender Dragon at 256x256:

```cpp
texWidth = 256;
texHeight = 256;
```

When you construct a `ModelPart` with a `Model *`, it picks up the model's `texWidth`/`texHeight` automatically. But if you create parts without that constructor (or change sizes later), you need to call `setTexSize()` manually.

## Compiling Parts

Every example ends with `compile(1.0f / 16.0f)` calls. This bakes the cube geometry into an OpenGL display list for fast rendering. The `1.0f / 16.0f` is the scale factor (1 pixel = 1/16 of a block).

Always compile your parts after adding all boxes. If you add boxes after compiling, you need to compile again. 4J added these compile calls specifically to avoid a performance hit the first time the model renders:

```cpp
// 4J added - compile now to avoid random performance hit
// first time cubes are rendered
head->compile(1.0f/16.0f);
body->compile(1.0f/16.0f);
```

If a part isn't compiled, `render()` will compile it on the fly. But this can cause visual glitches since the lighting state might not be set up correctly at that point.

## The Face Mask System

When two boxes share a face (like the inner and outer layers of a slime), you get z-fighting. The face mask lets you skip specific faces to avoid this. Use `addBoxWithMask()`:

```cpp
// Slime outer shell: skip the inner faces
outer->addBoxWithMask(-4, 16, -4, 8, 8, 8, 0b110111);  // skip bottom face
```

The mask is a 6-bit bitmask:

| Bit | Value | Face |
|-----|-------|------|
| 0   | 1     | Right (+X) |
| 1   | 2     | Left (-X) |
| 2   | 4     | Top (+Y) |
| 3   | 8     | Bottom (-Y) |
| 4   | 16    | Front (-Z) |
| 5   | 32    | Back (+Z) |

Default is 63 (all faces). To hide a face, turn off its bit.

## Named Texture Offsets

The Dragon model uses named texture offsets instead of positional ones. This is handy for complex models where you want to refer to parts by string name:

```cpp
// In the Dragon model constructor:
setMapTex(L"head", 112, 30);
setMapTex(L"jaw", 176, 65);
setMapTex(L"body", 0, 0);

// Then when creating parts:
head = new ModelPart(this, L"head");
head->addBox(L"upperlip", -6, -1, -24, 12, 5, 16);
head->addBox(L"upperhead", -8, -8, -10, 16, 16, 16);
```

The string-based approach uses `Model::mappedTexOffs` to look up texture coordinates by name. Regular models just pass integers to the `ModelPart` constructor and that works fine. Named offsets are only needed when your model has lots of parts and you want the code to be more readable.

## Baby Variant Scaling

When `Model::young` is true, the renderer applies a different scale to the head and body. The head gets scaled up relative to the body and shifted down. This is how baby animals get their big-head look without needing a separate model class.

The scaling logic lives in `Model::render()`. In `HumanoidModel`, the head translate uses a hardcoded `16 * scale` rather than `yHeadOffs`/`zHeadOffs`:

```cpp
if (young)
{
    // Scale head up, translate it
    glPushMatrix();
    glScalef(0.75f, 0.75f, 0.75f);
    glTranslatef(0, 16 * scale, 0);
    head->render(scale, usecompiled);
    glPopMatrix();

    // Scale body down
    glPushMatrix();
    glScalef(0.5f, 0.5f, 0.5f);
    glTranslatef(0, 24 * scale, 0);
    body->render(scale, usecompiled);
    // ... legs ...
    glPopMatrix();
}
```

Other models like `QuadrupedModel` use `yHeadOffs` and `zHeadOffs` instead, which control where the oversized head sits. Quadrupeds set these in their constructor to position the head forward and up from the body.

## All Vanilla Model Sizes

For reference, here are the texture sheet sizes used by every model:

| Model | texWidth | texHeight |
|-------|----------|-----------|
| HumanoidModel | 64 | 32 |
| QuadrupedModel | 64 | 32 |
| ChickenModel | 64 | 32 |
| WolfModel | 64 | 32 |
| SpiderModel | 64 | 32 |
| GhastModel | 64 | 32 |
| SquidModel | 64 | 32 |
| BlazeModel | 64 | 32 |
| SilverfishModel | 64 | 32 |
| VillagerModel | 64 | 64 |
| VillagerGolemModel | 128 | 128 |
| DragonModel | 256 | 256 |
| SnowManModel | 64 | 32 |
| SlimeModel | 64 | 32 |
| EndermanModel | 64 | 32 |
| BookModel | 64 | 32 |
| ChestModel | 64 | 64 |
| SignModel | 64 | 32 |

## Tips

- **Keep boxes aligned to pixels.** Fractional positions work but make texture mapping harder to think about.
- **Use the grow parameter for overlay layers.** Armor, charged creeper glow, and sheep wool all use grow to sit on top of the base model.
- **Use parent-child for joints.** If something should bend at a point (like an arm at the shoulder), make it a child of the part it connects to.
- **The scale is always `1.0f / 16.0f`.** Every model in the game uses this scale. One unit in model space equals one pixel, and 16 pixels equals one block.
- **Compile after construction.** Don't skip the compile calls or you'll get first-frame glitches.
- **Animation values reset each frame.** `setupAnim()` is called every frame, so set all rotation values fresh each time. Don't rely on values from the previous frame.
- **Test with the debug renderer.** If your model looks wrong, temporarily set all rotations to 0 in `setupAnim` and check the T-pose first. Animation bugs and geometry bugs look similar but have different fixes.
- **Match your texture sheet to the total UV space.** Add up the UV footprint of all your cubes (each is `(2d + 2w)` wide by `(d + h)` tall) and pick a sheet size that fits them all without overlap.
