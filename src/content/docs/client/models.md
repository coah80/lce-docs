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

`texWidth` and `texHeight` define the texture atlas dimensions that UV coordinates are calculated against.

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
};
```

The `compile()` method bakes geometry into an OpenGL display list for fast repeated rendering. The `render()` method applies the part's transform, draws its cubes, then recursively renders children.

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

The `faceMask` parameter (default `63` = all 6 faces) lets you skip internal faces when boxes overlap. Each face is a `_Polygon` with four `Vertex` instances that carry position and UV data.

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

### TexOffs

`TexOffs` stores a named texture offset (x, y) used by `Model::mappedTexOffs` to let parts reference specific regions of the texture atlas by name.

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

### Animation state

```cpp
int holdingLeftHand, holdingRightHand;
bool idle, sneaking, bowAndArrow, eating;
float eating_t, eating_swing;
unsigned int m_uiAnimOverrideBitmask;
float m_fYOffset;
```

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

## Quadruped models

`QuadrupedModel` extends `HumanoidModel` (or `Model`) for four-legged animals. Mob-specific models then customize body proportions and texture offsets.

## All model classes

### Mob models

| Class | Entity | Notes |
|---|---|---|
| `HumanoidModel` | Players, zombies, skeletons | Standard biped with configurable arm/leg animation |
| `QuadrupedModel` | Base for quadrupeds | Four-legged body plan |
| `ChickenModel` | Chickens | Beak, wings, legs |
| `CowModel` | Cows | Horns, udder |
| `CreeperModel` | Creepers | Four short legs, no arms |
| `PigModel` | Pigs | Snout, short legs |
| `SheepModel` | Sheep | Base sheep body |
| `SheepFurModel` | Sheep wool | Overlay rendered on top of sheep |
| `WolfModel` | Wolves/dogs | Tail, ears, snout |
| `SquidModel` | Squids | Eight tentacles |
| `SpiderModel` | Spiders | Eight legs, wide body |
| `GhastModel` | Ghasts | Tentacles beneath cube body |
| `SlimeModel` | Slimes | Transparent outer layer + inner core |
| `LavaSlimeModel` | Magma cubes | Segmented body |
| `EndermanModel` | Endermen | Elongated limbs |
| `SilverfishModel` | Silverfish | Multi-segment body |
| `BlazeModel` | Blazes | Rotating rod ring around head |
| `DragonModel` | Ender Dragon | Wings, jaw, tail segments |
| `SnowManModel` | Snow golems | Three-sphere body |
| `VillagerModel` | Villagers | Nose, crossed arms |
| `VillagerGolemModel` | Iron golems | Massive arms and body |
| `VillagerZombieModel` | Zombie villagers | Villager nose on zombie body |
| `OzelotModel` | Ocelots/cats | Tail, small legs |
| `ZombieModel` | Zombies | Extended arms |
| `SkeletonModel` | Skeletons | Thin limbs |

### Object and tile entity models

| Class | Entity | Notes |
|---|---|---|
| `BoatModel` | Boats | Flat hull with sides |
| `MinecartModel` | Minecarts | Box on wheels |
| `BookModel` | Enchanting table book | Animated page-turning |
| `ChestModel` | Chests | Lid with open/close animation |
| `LargeChestModel` | Double chests | Extended chest body |
| `SignModel` | Signs | Flat panel on post |
| `SkeletonHeadModel` | Mob heads | Skull on pedestal |
| `EnderCrystalModel` | Ender crystals | Rotating cube inside frame |

## How models define geometry

A typical model constructor builds the skeleton in code:

1. Set `texWidth` and `texHeight` for the texture atlas
2. Create `ModelPart` instances with texture offsets
3. Call `addBox()` to add cubes to each part
4. Call `setPos()` to position parts relative to the origin
5. Call `addChild()` to build the part hierarchy

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

## Model rendering pipeline

1. `MobRenderer::render()` calls `Model::prepareMobModel()` to set riding/baby state
2. `Model::setupAnim()` calculates limb rotations based on walk cycle, head rotation, and attack time
3. `Model::render()` goes through all parts and calls `ModelPart::render()` recursively
4. Each `ModelPart::render()` pushes a matrix, applies its transform, renders its `Cube` list via `Tesselator`, then renders children

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
