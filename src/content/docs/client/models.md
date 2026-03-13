---
title: "Models"
description: "3D model definitions for entities in LCE."
---

LCE uses a hierarchical box-based model system to define the geometry of all entities. Models are built from `ModelPart` nodes, each containing one or more `Cube` primitives. These are arranged in parent-child trees that allow jointed animation.

## Core classes

### Model

`Model` is the base class for all entity models. It provides the virtual interface for rendering and animation:

```cpp
class Model {
public:
    float attackTime;
    bool riding;
    vector<ModelPart*> cubes;          // all top-level parts
    bool young;                         // baby variant scaling
    unordered_map<wstring, TexOffs*> mappedTexOffs;  // named texture offsets
    int texWidth;
    int texHeight;

    virtual void render(...);
    virtual void setupAnim(...);
    virtual void prepareMobModel(...);
    virtual ModelPart* getRandomCube(Random random);
    virtual ModelPart* AddOrRetrievePart(SKIN_BOX* pBox);

    void setMapTex(wstring id, int x, int y);
    TexOffs* getMapTex(wstring id);

protected:
    float yHeadOffs;
    float zHeadOffs;
};
```

`texWidth` and `texHeight` define the texture atlas dimensions that UV coordinates are calculated against. The default is 64x32. Bigger models use larger sheets: the Iron Golem uses 128x128 and the Ender Dragon uses 256x256.

The `cubes` vector name is misleading. It holds all the top-level `ModelPart` pointers, not `Cube` objects. Parts get added to this list automatically when you construct them with a `Model*` pointer.

`attackTime` is set by the renderer from `mob->getAttackAnim(partialTicks)` and goes from 0.0 to 1.0 during a swing. `riding` and `young` control posture and baby-variant scaling.

`yHeadOffs` and `zHeadOffs` offset the head pivot point. Quadrupeds use these to position the head forward and up from the body origin.

The `mappedTexOffs` map lets you look up named texture offsets. `setMapTex()` adds an entry and `getMapTex()` retrieves it. The Dragon model uses this heavily since its parts have string names like `"frontleg"` and `"wingtip"`.

### ModelPart

`ModelPart` is the skeletal joint node. Each part has a position, rotation, and a list of `Cube` children:

```cpp
class ModelPart {
public:
    float xTexSize, yTexSize;
    float x, y, z;                  // position relative to parent
    float xRot, yRot, zRot;        // rotation in radians
    bool bMirror;                    // mirror UVs
    bool visible;
    bool neverRender;
    vector<Cube*> cubes;            // geometry boxes
    vector<ModelPart*> children;    // child joints

    void addChild(ModelPart* child);
    ModelPart* mirror();
    ModelPart* texOffs(int xTexOffs, int yTexOffs);
    ModelPart* addBox(float x0, float y0, float z0, int w, int h, int d);
    void addBox(float x0, float y0, float z0, int w, int h, int d, float g);
    void addHumanoidBox(...);       // flipped UVs for correct skin mapping
    ModelPart* addBoxWithMask(..., int faceMask);  // selective face rendering
    void setPos(float x, float y, float z);
    void render(float scale, bool usecompiled, bool bHideParentBodyPart = false);
    void compile(float scale);      // bake into display list
    ModelPart* setTexSize(int xs, int ys);
};
```

The `compile()` method bakes geometry into an OpenGL display list for fast repeated rendering. The `render()` method applies the part's transform, draws its cubes, then recursively renders children.

When you create a `ModelPart` with a `Model*` pointer, it automatically registers itself in the model's `cubes` list. The typical workflow is:

1. Create the part with a texture offset
2. Add one or more boxes to it
3. Set its position in the model
4. Compile it

The `g` parameter in `addBox` is a "grow" value that inflates the box outward in every direction. Armor layers use this so they sit slightly on top of the body without z-fighting.

`addHumanoidBox()` creates a cube with flipped UVs on the third polygon face. This is needed for player skin textures to look correct.

`visible` can be toggled on and off dynamically (the wolf model hides parts when sitting). `neverRender` is a permanent hide that skips the part entirely.

### Cube

`Cube` is the atomic geometry primitive, basically a textured box:

```cpp
class Cube {
    VertexArray vertices;     // 8 vertices
    PolygonArray polygons;    // 6 faces (quads)
    float x0, y0, z0;        // box origin
    float x1, y1, z1;        // box extent

    Cube(ModelPart*, int xTexOffs, int yTexOffs,
         float x0, float y0, float z0,
         int w, int h, int d, float g,
         int faceMask = 63,           // bitmask for which faces to generate
         bool bFlipPoly3UVs = false); // UV flip for skin compatibility
    void render(Tesselator* t, float scale);
};
```

The `faceMask` parameter (default `63` = all 6 faces) lets you skip internal faces when boxes overlap. Each bit controls one face:

| Bit | Value | Face |
|-----|-------|------|
| 0   | 1     | Right (+X) |
| 1   | 2     | Left (-X) |
| 2   | 4     | Top (+Y) |
| 3   | 8     | Bottom (-Y) |
| 4   | 16    | Front (-Z) |
| 5   | 32    | Back (+Z) |

Each face is a `_Polygon` with four `Vertex` instances that carry position and UV data.

### Vertex and Polygon

```cpp
class Vertex {
    Vec3* pos;
    float u, v;
};

class _Polygon {
    VertexArray vertices;
    int vertexCount;
    void render(Tesselator* t, float scale);
    _Polygon* flipNormal();
    void mirror();
};
```

`_Polygon` is prefixed with an underscore because `Polygon` is a reserved name on some platforms. `flipNormal()` reverses the winding order for mirrored parts. `mirror()` swaps the first and last vertices and the middle two, which flips the face without changing UVs.

### TexOffs

`TexOffs` stores a named texture offset (x, y) used by `Model::mappedTexOffs` to let parts reference specific regions of the texture atlas by name.

## UV texture mapping

Cubes use a box-unwrap UV layout. If you've ever seen a Minecraft skin template, it's the same idea. Given a cube at texture offset `(xTexOffs, yTexOffs)` with dimensions `w` (width), `h` (height), and `d` (depth), the faces map like this:

```
                d       w       d       w
           +--------+--------+--------+--------+
           |        |  Top   |        | Bottom |
     d     |        | (w x d)|        | (w x d)|
           +--------+--------+--------+--------+
           | Left   | Front  | Right  |  Back  |
     h     |(d x h) |(w x h) |(d x h) | (w x h)|
           +--------+--------+--------+--------+

           ^
           |
     (xTexOffs, yTexOffs) is the top-left corner
```

The top row is `d` pixels tall and holds the top/bottom faces. The bottom row is `h` pixels tall and holds the four side faces. The total texture space used is `(2*d + 2*w)` wide by `(d + h)` tall.

This happens automatically inside the `Cube` constructor. You just need to set the right `texOffs` on the `ModelPart` before adding boxes.

## Positioning and rotation

### Position

`setPos(x, y, z)` sets where the part's pivot point is in the model. All coordinates are in pixels (1 pixel = 1/16 of a block). The origin `(0, 0, 0)` is roughly the center-bottom of the entity.

- **X**: Left/right. Negative is the entity's right side, positive is left.
- **Y**: Up/down. `0` is the top of the entity, positive goes down. Y increases downward in model space.
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

### Parent-child relationships

Parts can have children via `addChild()`. Child parts are positioned and rotated relative to their parent. When the parent moves or rotates, all children follow.

The rendering code in `ModelPart::render()` handles this automatically. After drawing the parent's cubes, it loops through all children and calls `render()` on each one while the parent's transform is still on the OpenGL matrix stack:

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

The `bHideParentBodyPart` flag lets you render children without drawing the parent's own geometry. DLC skin models use this to replace body parts with custom ones while keeping the joint hierarchy.

## The mirroring system

When `bMirror` is set to `true` on a `ModelPart`, the cube constructor swaps the X coordinates and flips all polygon normals. This gives you a mirrored version of the same texture.

The `HumanoidModel` uses this for the left arm and left leg so both sides share the same texture data:

```cpp
arm1 = new ModelPart(this, 24 + 16, 16);
arm1->bMirror = true;
arm1->addHumanoidBox(-1, -2, -2, 4, 12, 4, g);
arm1->setPos(5, 2 + yOffset, 0);
```

Set `bMirror` before calling `addBox`, since the flag is read during cube construction.

## HumanoidModel

`HumanoidModel` extends `Model` for player and humanoid mob rendering. It defines the standard biped skeleton:

| Part | Field | Description |
|---|---|---|
| Head | `head` | Main head box |
| Hair | `hair` | Overlay layer (hat) |
| Body | `body` | Torso |
| Right arm | `arm0` | Player's right arm |
| Left arm | `arm1` | Player's left arm |
| Right leg | `leg0` | Player's right leg |
| Left leg | `leg1` | Player's left leg |
| Ear | `ear` | Deadmau5 ears (special case) |
| Cloak | `cloak` | Cape |

The hair part uses the same box size as the head but with a grow value of `0.5f` so it sits on top. The cloak is separate and only rendered when the player has a cape.

### Animation state

```cpp
int holdingLeftHand, holdingRightHand;
bool idle, sneaking, bowAndArrow, eating;
float eating_t, eating_swing;
unsigned int m_uiAnimOverrideBitmask;
float m_fYOffset;
```

`holdingLeftHand` and `holdingRightHand` change the arm rest angle. `sneaking` shifts the model down and tilts the body forward. `bowAndArrow` puts the arms in a draw pose. `eating` triggers a hand-to-mouth animation using `eating_t` and `eating_swing` for timing.

### Animation overrides (DLC skins)

The `animbits` enum controls per-skin animation overrides via bitmask:

| Bit | Name | Effect |
|---|---|---|
| 0 | `eAnim_ArmsDown` | Arms held at sides |
| 1 | `eAnim_ArmsOutFront` | Arms extended forward |
| 2 | `eAnim_NoLegAnim` | Legs do not animate |
| 3 | `eAnim_HasIdle` | Has idle animation |
| 4 | `eAnim_ForceAnim` | Force custom animation even if user disables it |
| 5 | `eAnim_SingleLegs` | Both legs move together (e.g., fish characters) |
| 6 | `eAnim_SingleArms` | Both arms move together |
| 7 | `eAnim_StatueOfLiberty` | Arms in fixed pose (Weeping Angel) |
| 8 | `eAnim_DontRenderArmour` | Skip armor rendering (Daleks) |
| 9 | `eAnim_NoBobbing` | Disable view bob (Daleks) |
| 10 | `eAnim_DisableRenderHead` | Hide head part |
| 11 | `eAnim_DisableRenderArm0` | Hide right arm |
| 12 | `eAnim_DisableRenderArm1` | Hide left arm |
| 13 | `eAnim_DisableRenderTorso` | Hide torso |
| 14 | `eAnim_DisableRenderLeg0` | Hide right leg |
| 15 | `eAnim_DisableRenderLeg1` | Hide left leg |
| 16 | `eAnim_DisableRenderHair` | Hide hair/hat overlay |

The `m_staticBitmaskIgnorePlayerCustomAnimSetting` constant combines bits that should always apply regardless of the player's "custom skin animation" setting.

### Additional model parts (SkinBox)

DLC skins can add extra geometry to the humanoid model through `SKIN_BOX` definitions. `AddOrRetrievePart(SKIN_BOX*)` either finds an existing part or creates a new one attached to the skeleton. `CMinecraftApp` stores these per skin ID:

```cpp
void SetAdditionalSkinBoxes(DWORD dwSkinID, SKIN_BOX* SkinBoxA, DWORD dwSkinBoxC);
vector<ModelPart*>* GetAdditionalModelParts(DWORD dwSkinID);
```

Each `SKIN_BOX` defines a parent attachment point, box dimensions, texture offset, grow value, and the animation override bitmask. This is how DLC skins like Doctor Who characters get extra geometry like Dalek skirts or angel wings without changing the model class.

## QuadrupedModel

`QuadrupedModel` extends `Model` for four-legged animals. It creates a head, body, and four legs. The constructor takes a `legSize` parameter that controls leg height (pigs use 6, cows use the default):

```cpp
QuadrupedModel::QuadrupedModel(int legSize, float g) : Model()
{
    head = new ModelPart(this, 0, 0);
    head->addBox(-4, -4, -8, 8, 8, 8, g);
    head->setPos(0, (float)(12 + 6 - legSize), -6);

    body = new ModelPart(this, 28, 8);
    body->addBox(-5, -10, -7, 10, 16, 8, g);
    body->setPos(0, (float)(11 + 6 - legSize), 2);

    leg0 = new ModelPart(this, 0, 16);
    leg0->addBox(-2, 0, -2, 4, legSize, 4, g);
    leg0->setPos(-3, (float)(18 + 6 - legSize), 7);
    // ... leg1, leg2, leg3 similar ...
}
```

All four legs share the same texture offset `(0, 16)`. The `legSize` value changes position calculations so shorter legs raise the body accordingly.

## All model classes

### Mob models

| Class | Entity | Parts | Notes |
|---|---|---|---|
| `HumanoidModel` | Players, zombies, skeletons | head, hair, body, arm0, arm1, leg0, leg1, ear, cloak | Standard biped, configurable arm/leg animation |
| `QuadrupedModel` | Base for quadrupeds | head, body, leg0-leg3 | Four-legged body plan with variable leg size |
| `ChickenModel` | Chickens | head, beak, body, wing0, wing1, leg0, leg1, redThing (wattle) | Flat wings, beak and wattle as separate cubes on head |
| `CowModel` | Cows | head (with horns), body, leg0-leg3 | Extends QuadrupedModel, adds horn cubes to head |
| `CreeperModel` | Creepers | head, hair (charged overlay), body, leg0-leg3 | Four short legs, no arms; hair part is 0.5f larger for charge glow |
| `PigModel` | Pigs | head (with snout), body, leg0-leg3 | Extends QuadrupedModel with snout at texOffs(16,16), legSize=6 |
| `SheepModel` | Sheep | head, body, leg0-leg3 | Extends QuadrupedModel with wider head |
| `SheepFurModel` | Sheep wool | head, body, leg0-leg3 | Extends QuadrupedModel, 1.75f grow on all parts for wool puff |
| `WolfModel` | Wolves/dogs | head, body, leg0-leg3, tail, upperBody | Tail and ears; head has ear and mouth cubes, `prepareMobModel` checks sitting/angry/tame state |
| `SquidModel` | Squids | body, tentacles[8] | Eight tentacles with sine-wave idle animation |
| `SpiderModel` | Spiders | head, body, leg0-leg7 (8 legs) | Wide body, 8 legs at specific Y-rotation angles, double-speed walk |
| `GhastModel` | Ghasts | body, tentacles[9] | 16x16x16 body cube (texWidth=64, texHeight=32), 9 tentacles with phase-offset wave |
| `SlimeModel` | Slimes | outer, inner (+ leftEye, rightEye, mouth) | Transparent outer layer + opaque inner core, inner rendered first |
| `LavaSlimeModel` | Magma cubes | body segments[] | Segmented body of stacked cubes |
| `EndermanModel` | Endermen | Extends HumanoidModel | Elongated limbs, thinner body, carries block in hands |
| `SilverfishModel` | Silverfish | bodyParts[7], bodyLayers[7] | 7-segment body with separate layer overlays, segment sizes defined in static arrays |
| `BlazeModel` | Blazes | head, upperBodyParts[12] | 12 rods in 3 orbital layers of 4, each layer spins at different speed/radius |
| `DragonModel` | Ender Dragon | head, neck, jaw, body, rearLeg/frontLeg (with tips and feet), wing/wingTip, cubes[5] for spine segments | The most complex model; 256x256 texture, multi-joint legs with 3 parts each, articulated jaw, two-part wings |
| `SnowManModel` | Snow golems | head, body, bottomBody, rightHand, leftHand | Three stacked spheres for body, stick arms |
| `VillagerModel` | Villagers | head (with nose), body, arms (crossed), leg0, leg1 | Crossed arms as single box, large nose |
| `VillagerGolemModel` | Iron golems | head, body, arm0, arm1, leg0, leg1 | 128x128 texture, huge arms hanging past knees, uses `triangleWave` for attack animation |
| `VillagerZombieModel` | Zombie villagers | Extends HumanoidModel | Villager nose on zombie body |
| `OzelotModel` | Ocelots/cats | head, body, tail1, tail2, backLeg0-1, frontLeg0-1 | Dual-segment tail, separate front/back leg pairs |
| `ZombieModel` | Zombies | Extends HumanoidModel | Arms extended forward (xRot offset) |
| `SkeletonModel` | Skeletons | Extends ZombieModel | Thinner limbs |

### Object and tile entity models

| Class | Entity | Parts | Notes |
|---|---|---|---|
| `BoatModel` | Boats | 5 planks (bottom, sides) | Flat hull with side walls, no animation |
| `MinecartModel` | Minecarts | 6 faces (bottom + 4 sides + lip) | Box on wheels, MODEL_ID = 1 |
| `BookModel` | Enchanting table book | spine, leftPage, rightPage, leftFlap, rightFlap, leftCover, rightCover | Animated page-turning driven by `setupAnim`, cover opens/closes |
| `ChestModel` | Chests | lid, base, latch | Lid pivots open/close, latch follows lid |
| `LargeChestModel` | Double chests | lid, base, latch | Extends ChestModel with wider dimensions |
| `SignModel` | Signs | board, post | Flat panel on a stick |
| `SkeletonHeadModel` | Mob heads | head | Single head box, MODEL_ID = 3 |
| `EnderCrystalModel` | Ender crystals | cube, glass, base | Rotating inner cube inside spinning glass frame on pedestal |

## How models define geometry

A typical model constructor builds the skeleton in code:

1. Set `texWidth` and `texHeight` for the texture atlas
2. Create `ModelPart` instances with texture offsets
3. Call `addBox()` to add cubes to each part
4. Call `setPos()` to position parts relative to the origin
5. Call `addChild()` to build the part hierarchy
6. Call `compile()` on every part

For example, a simplified humanoid construction:

```cpp
HumanoidModel::HumanoidModel(float g) {
    texWidth = 64;
    texHeight = 32;
    head = new ModelPart(this, 0, 0);
    head->addBox(-4, -8, -4, 8, 8, 8, g);
    head->setPos(0, 0, 0);

    body = new ModelPart(this, 16, 16);
    body->addBox(-4, 0, -2, 8, 12, 4, g);
    body->setPos(0, 0, 0);

    arm0 = new ModelPart(this, 40, 16);
    arm0->addBox(-3, -2, -2, 4, 12, 4, g);
    arm0->setPos(-5, 2, 0);
    // ... etc.
}
```

The `g` parameter is a "growth" or "inflation" factor that expands boxes outward. It's used for armor overlay layers that need to be slightly larger than the base body.

### Compiling parts

Every model constructor ends with `compile(1.0f / 16.0f)` calls. This bakes the cube geometry into an OpenGL display list for fast rendering. The `1.0f / 16.0f` is the scale factor (1 pixel = 1/16 of a block).

Always compile your parts after adding all boxes. If you add boxes after compiling, you need to compile again. 4J added these compile calls to avoid a performance hit the first time the model renders. If a part isn't compiled, `render()` will compile it on the fly, but this can cause visual glitches since the lighting state might not be set up correctly at that point.

## Model rendering pipeline

1. `MobRenderer::render()` calls `Model::prepareMobModel()` to set riding/baby state
2. `Model::setupAnim()` calculates limb rotations based on walk cycle, head rotation, and attack time
3. `Model::render()` goes through all parts and calls `ModelPart::render()` recursively
4. Each `ModelPart::render()` pushes a matrix, applies its transform, renders its `Cube` list via `Tesselator`, then renders children

### prepareMobModel vs setupAnim

Some models override `prepareMobModel` in addition to `setupAnim`. The difference:

| Method | Gets | Good For |
|--------|------|----------|
| `setupAnim` | Generic float params (time, speed, bob, head angles) | Walk cycles, head look, idle, anything that only needs the standard parameters |
| `prepareMobModel` | The actual `Mob` pointer, walk params, and partial ticks | State-dependent animations (sitting, angry, carrying a block) |

The Wolf model is a good example. `setupAnim` just handles head look and tail angle. `prepareMobModel` does the heavy lifting because it needs to check `wolf->isAngry()`, `wolf->isSitting()`, and `wolf->getBodyRollAngle()`.

The Dragon model uses `prepareMobModel` to read the dragon's animation state arrays for wing position, jaw angle, and spine curl.

## MinecraftConsoles differences

MinecraftConsoles adds several new model classes that don't exist in LCEMP:

### New mob models

| Class | Entity | Notes |
|---|---|---|
| `BatModel` | Bats | Head, body, left/right wings with wing tips. Uses a `modelVersion()` method. |
| `ModelHorse` | Horses | One of the most complex models in the game. Has head, upper/lower mouth, two ears, mule ears, neck, mane, body, three-segment tail, four multi-joint legs (each with 3 parts: A/B/C), saddle bags, and a full saddle assembly with stirrups and mouth lines. |
| `WitchModel` | Witches | Extends `VillagerModel` with a mole and hat. Has a `holdingItem` flag for the potion-drinking animation. |
| `WitherBossModel` | Wither boss | Body parts array and heads array. Has `prepareMobModel` for invulnerability animation. |
| `OcelotModel` | Ocelots/cats | Dedicated model with 4 animation states: sneak, walk, sprint, and sitting. Much more detailed than the generic version in LCEMP. |
| `SkiModel` | Player ski attachment | A 4J-added cosmetic model for DLC skins. Has left/right ski variants. |
| `LeashKnotModel` | Leash fence knots | Simple model for the leash attachment point on fences. |

### Model rendering changes

The `render()` method signature across models gains a `bool usecompiled` parameter in MinecraftConsoles. LCEMP already has this, but the entity parameter type changes from raw `Entity` references to `shared_ptr<Entity>` in some models, and `LivingEntity` is used more consistently for mob-specific methods like `prepareMobModel`.

### modelVersion()

MinecraftConsoles adds a `modelVersion()` method to some models (`BatModel`, `SilverfishModel`, `BlazeModel`). This returns an integer version tag that the renderer uses to pick the right rendering path when models get structural changes across title updates.
