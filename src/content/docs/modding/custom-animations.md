---
title: Custom Animations
description: How entity animations work in LCE and how to write your own.
---

Entity animations in LCE are driven by the `setupAnim` method on model classes. The engine calls this every single frame before rendering, and your job is to set rotation values on `ModelPart` instances to pose the entity. That's pretty much the whole system. No keyframes, no timeline editor. Just math and rotation floats.

## The Animation Loop

Here's how it flows:

1. `MobRenderer::render()` gets called every frame for each visible mob.
2. It calculates walk position (`wp`), walk speed (`ws`), bob timer, head rotation, and partial ticks (`a`).
3. It calls `model->render()`, which calls `setupAnim()` internally.
4. `setupAnim()` sets rotation values on every `ModelPart` to pose the entity.
5. Each `ModelPart` renders itself with the rotations you set.

The renderer does all the interpolation work before your code even runs. By the time `setupAnim` gets called, you're working with smoothly blended values.

## setupAnim Parameters

Every model's `setupAnim` has this signature:

```cpp
void setupAnim(float time, float r, float bob,
               float yRot, float xRot, float scale,
               unsigned int uiBitmaskOverrideAnim = 0);
```

| Parameter | What It Is |
|-----------|-----------|
| `time` | Walk animation position (derived from `walkAnimPos`, already interpolated with partial ticks) |
| `r` | Walk animation speed (0.0 = standing still, 1.0 = full sprint), clamped to max 1.0 |
| `bob` | Bob timer (`tickCount + partialTicks`), always increasing, good for idle animations |
| `yRot` | Head Y rotation in degrees (left/right look) |
| `xRot` | Head X rotation in degrees (up/down look) |
| `scale` | Render scale (always `1/16.0f`) |
| `uiBitmaskOverrideAnim` | 4J's custom animation override flags for skin packs |

The important thing to understand: `time` and `r` are for walk cycles, and `bob` is for everything else (idle breathing, floating, spinning, whatever).

## ModelPart Rotation

Every `ModelPart` has three rotation floats:

```cpp
class ModelPart
{
public:
    float x, y, z;           // Position offset
    float xRot, yRot, zRot;  // Rotation in radians
    bool visible;
    // ...
};
```

All rotations are in **radians**, not degrees. The head look direction comes in as degrees, so you'll see this conversion everywhere:

```cpp
head->yRot = yRot / (180.0f / PI);  // Degrees to radians
head->xRot = xRot / (180.0f / PI);
```

The axes work like this:
- `xRot` rotates around the X axis (nodding, leg swing forward/backward)
- `yRot` rotates around the Y axis (turning left/right)
- `zRot` rotates around the Z axis (tilting/rolling sideways)

## Walk Cycle Animations

Walk cycles are the bread and butter of entity animation. The pattern is the same across almost every mob in the codebase. You feed `time` into `Mth::cos()` with a specific frequency, then multiply by `r` so the animation scales with movement speed.

### Bipedal Walk (HumanoidModel)

From the actual `HumanoidModel::setupAnim`:

```cpp
// Arms swing opposite to each other
arm0->xRot = (Mth::cos(time * 0.6662f + PI) * 2.0f) * r * 0.5f;
arm1->xRot = (Mth::cos(time * 0.6662f) * 2.0f) * r * 0.5f;

// Legs swing opposite to each other
leg0->xRot = (Mth::cos(time * 0.6662f) * 1.4f) * r;
leg1->xRot = (Mth::cos(time * 0.6662f + PI) * 1.4f) * r;
```

The `+ PI` offset on one side makes the limbs swing in opposite directions. Left arm forward, right arm back. Left leg forward, right leg back. Classic walk cycle.

The magic number `0.6662f` controls the walk speed. Higher values make the legs pump faster. The `1.4f` and `2.0f` multipliers control how far the limbs swing. And `* r` makes it all scale to zero when the mob is standing still.

### Quadruped Walk (QuadrupedModel)

Four-legged animals use the exact same pattern, just with diagonal legs synced together:

```cpp
// Front-left and back-right move together
leg0->xRot = (Mth::cos(time * 0.6662f) * 1.4f) * r;
leg3->xRot = (Mth::cos(time * 0.6662f) * 1.4f) * r;

// Front-right and back-left move together
leg1->xRot = (Mth::cos(time * 0.6662f + PI) * 1.4f) * r;
leg2->xRot = (Mth::cos(time * 0.6662f + PI) * 1.4f) * r;
```

This is used by `CowModel`, `PigModel`, `SheepModel`, and basically every four-legged mob.

### Spider Walk

The spider is a great example of a more complex walk cycle. Eight legs, each at different angles, with phase offsets so they don't all move in unison:

```cpp
// Four phase offsets for pairs of legs
float c0 = -(Mth::cos(time * 0.6662f * 2 + PI * 2 * 0 / 4.0f) * 0.4f) * r;
float c1 = -(Mth::cos(time * 0.6662f * 2 + PI * 2 * 2 / 4.0f) * 0.4f) * r;
float c2 = -(Mth::cos(time * 0.6662f * 2 + PI * 2 * 1 / 4.0f) * 0.4f) * r;
float c3 = -(Mth::cos(time * 0.6662f * 2 + PI * 2 * 3 / 4.0f) * 0.4f) * r;

// Legs bob up and down too
float s0 = abs(Mth::sin(time * 0.6662f + PI * 2 * 0 / 4.0f) * 0.4f) * r;
float s1 = abs(Mth::sin(time * 0.6662f + PI * 2 * 2 / 4.0f) * 0.4f) * r;
// ...

// Apply to yRot for horizontal sweep and zRot for vertical bob
leg0->yRot += +c0;
leg0->zRot += +s0;
```

Notice `0.6662f * 2` here. The spider's legs move at double the normal walk frequency. `abs()` on the sin values keeps the legs from dipping below the horizontal plane.

## Attack Animations

Attack animations use the `attackTime` field on the `Model` class. The renderer sets this from `mob->getAttackAnim(partialTicks)`, which returns a 0.0 to 1.0 progress value during a swing.

From `HumanoidModel::setupAnim`, here's the full attack animation:

```cpp
if (attackTime > -9990.0f)
{
    float swing = attackTime;

    // Body twists
    body->yRot = Mth::sin(sqrt(swing) * PI * 2.0f) * 0.2f;

    // Arms follow the body twist
    arm0->z = Mth::sin(body->yRot) * 5.0f;
    arm0->x = -Mth::cos(body->yRot) * 5.0f;
    arm1->z = -Mth::sin(body->yRot) * 5.0f;
    arm1->x = Mth::cos(body->yRot) * 5.0f;
    arm0->yRot += body->yRot;
    arm1->yRot += body->yRot;

    // Arm swing arc
    swing = 1.0f - attackTime;
    swing *= swing;
    swing *= swing;
    swing = 1.0f - swing;
    float aa = Mth::sin(swing * PI);
    float bb = Mth::sin(attackTime * PI) * -(head->xRot - 0.7f) * 0.75f;
    arm0->xRot -= aa * 1.2f + bb;
    arm0->yRot += body->yRot * 2.0f;
    arm0->zRot = Mth::sin(attackTime * PI) * -0.4f;
}
```

The `sqrt` on the swing value makes the body twist fast at the start and ease out. The `swing *= swing` repeated four times creates a sharp acceleration curve for the arm. It's not fancy easing math, just repeated squaring.

### Iron Golem Attack

The `VillagerGolemModel` uses a `triangleWave` function for a choppier, mechanical swing:

```cpp
int attackTick = vg->getAttackAnimationTick();
if (attackTick > 0)
{
    arm0->xRot = (-2.0f + 1.5f * triangleWave(attackTick - a, 10));
    arm1->xRot = (-2.0f + 1.5f * triangleWave(attackTick - a, 10));
}

// The triangle wave function itself:
float triangleWave(float bob, float period)
{
    return (abs(fmod(bob, period) - period * 0.5f) - period * 0.25f)
           / (period * 0.25f);
}
```

Triangle waves produce linear back-and-forth motion instead of the smooth sinusoidal curves. Good for robotic or heavy-feeling movements.

## Idle Animations

Idle animations run all the time, even when the mob is standing still. They use the `bob` parameter, which is `tickCount + partialTicks` and just keeps going up forever.

### Arm Breathing (HumanoidModel)

At the very end of `HumanoidModel::setupAnim`, there's this subtle arm sway:

```cpp
arm0->zRot += (Mth::cos(bob * 0.09f) * 0.05f + 0.05f);
arm1->zRot -= (Mth::cos(bob * 0.09f) * 0.05f + 0.05f);
arm0->xRot += (Mth::sin(bob * 0.067f) * 0.05f);
arm1->xRot -= (Mth::sin(bob * 0.067f) * 0.05f);
```

The `+= ` is important here. These are added on top of whatever the walk cycle already set. The low multipliers (`0.09f`, `0.067f`) make it very slow, and the small amplitudes (`0.05f`) keep it subtle. The `+ 0.05f` on the zRot gives the arms a slight outward rest angle so they're not glued to the body.

### Ghast Tentacles

The Ghast tentacles have a nice idle wave:

```cpp
for (int i = 0; i < 9; i++)
{
    tentacles[i]->xRot = 0.2f * Mth::sin(bob * 0.3f + i) + 0.4f;
}
```

The `+ i` in the sin function offsets each tentacle's phase, so they wave independently. The `0.4f` base angle keeps them tilted down. The `0.3f` frequency makes it a slow, lazy movement. Simple but effective.

### Blaze Rod Orbit

The Blaze is one of the coolest animations in the codebase. Twelve rods orbit in three layers:

```cpp
// Layer 1: 4 rods orbiting at y=-2
float angle = bob * PI * -.1f;
for (int i = 0; i < 4; i++)
{
    upperBodyParts[i]->y = -2 + Mth::cos((i * 2 + bob) * .25f);
    upperBodyParts[i]->x = Mth::cos(angle) * 9.0f;
    upperBodyParts[i]->z = Mth::sin(angle) * 9.0f;
    angle += PI * 0.5f;  // 90 degrees apart
}

// Layer 2: 4 rods at y=2, slightly different orbit speed
angle = .25f * PI + bob * PI * .03f;
for (int i = 4; i < 8; i++)
{
    upperBodyParts[i]->y = 2 + Mth::cos((i * 2 + bob) * .25f);
    upperBodyParts[i]->x = Mth::cos(angle) * 7.0f;
    upperBodyParts[i]->z = Mth::sin(angle) * 7.0f;
    angle += PI * 0.5f;
}

// Layer 3: 4 rods at y=11, orbiting in reverse
angle = .15f * PI + bob * PI * -.05f;
for (int i = 8; i < 12; i++)
{
    upperBodyParts[i]->y = 11 + Mth::cos((i * 1.5f + bob) * .5f);
    upperBodyParts[i]->x = Mth::cos(angle) * 5.0f;
    upperBodyParts[i]->z = Mth::sin(angle) * 5.0f;
    angle += PI * 0.5f;
}
```

Each layer orbits at a different speed and radius, and the negative multiplier on layer 3 makes those rods orbit in the opposite direction. The `cos((i * 2 + bob) * .25f)` on the Y position adds a gentle bobbing. This is how you get that classic floating Blaze look.

## The Chicken Wing Trick

The chicken uses a clever shortcut for wing flapping. The `bob` parameter gets repurposed by the renderer to carry the flap angle (calculated from `oFlap`/`flap` with partial tick interpolation). Then `setupAnim` just assigns it directly:

```cpp
wing0->zRot = bob;
wing1->zRot = -bob;
```

One wing goes one way, the other goes the opposite way. The actual flap speed comes from the entity logic, not from setupAnim.

## Writing Custom Animations

Now that you've seen how the built-ins work, here are patterns for common custom animations.

### Bobbing (Floating Up and Down)

```cpp
void MyModel::setupAnim(float time, float r, float bob,
                         float yRot, float xRot, float scale,
                         unsigned int uiBitmaskOverrideAnim)
{
    // Bob the whole body up and down
    body->y = baseY + Mth::sin(bob * 0.1f) * 2.0f;
    head->y = baseHeadY + Mth::sin(bob * 0.1f) * 2.0f;

    // 0.1f = speed (lower = slower)
    // 2.0f = height (pixels of travel)
}
```

### Spinning

```cpp
void MyModel::setupAnim(float time, float r, float bob,
                         float yRot, float xRot, float scale,
                         unsigned int uiBitmaskOverrideAnim)
{
    // Spin the head continuously
    head->yRot = bob * 0.2f;  // 0.2 radians per tick

    // Spin a body part at a different rate
    body->yRot = bob * 0.05f;
}
```

No need to wrap the angle. OpenGL handles values outside 0-2PI just fine.

### Pulsing (Scale-like Effect via Position)

You can't directly scale a `ModelPart`, but you can fake a pulse by moving parts in and out:

```cpp
void MyModel::setupAnim(float time, float r, float bob,
                         float yRot, float xRot, float scale,
                         unsigned int uiBitmaskOverrideAnim)
{
    float pulse = Mth::sin(bob * 0.3f) * 0.5f;

    // Move arms outward/inward
    arm0->x = -5.0f - pulse;
    arm1->x = 5.0f + pulse;

    // Or move legs apart/together
    leg0->z = 0.1f + pulse;
    leg1->z = 0.1f - pulse;
}
```

### Combining Walk and Idle

The standard pattern is: set the walk animation first, then add idle on top with `+=`:

```cpp
void MyModel::setupAnim(float time, float r, float bob,
                         float yRot, float xRot, float scale,
                         unsigned int uiBitmaskOverrideAnim)
{
    // Head look (always active)
    head->yRot = yRot / (180.0f / PI);
    head->xRot = xRot / (180.0f / PI);

    // Walk cycle (scales with speed)
    arm0->xRot = (Mth::cos(time * 0.6662f + PI) * 2.0f) * r * 0.5f;
    arm1->xRot = (Mth::cos(time * 0.6662f) * 2.0f) * r * 0.5f;
    leg0->xRot = (Mth::cos(time * 0.6662f) * 1.4f) * r;
    leg1->xRot = (Mth::cos(time * 0.6662f + PI) * 1.4f) * r;

    // Idle breathing (always active, added on top)
    arm0->zRot += Mth::cos(bob * 0.09f) * 0.05f + 0.05f;
    arm1->zRot -= Mth::cos(bob * 0.09f) * 0.05f + 0.05f;
}
```

### Multi-part Wave (Like a Tail or Chain)

If you have several segments that should wave in sequence:

```cpp
for (int i = 0; i < segmentCount; i++)
{
    segments[i]->xRot = Mth::sin(bob * 0.15f + i * 0.5f) * 0.3f;
}
```

The `+ i * 0.5f` offsets each segment's phase, creating a wave that travels down the chain. Bigger offset = tighter wave. Smaller offset = more gradual ripple.

## Math Reference

Here's what you'll use most:

| Function | What It Does | Typical Use |
|----------|-------------|-------------|
| `Mth::sin(x)` | Sine (uses lookup table, fast) | Smooth oscillation |
| `Mth::cos(x)` | Cosine (lookup table) | Smooth oscillation, offset from sin |
| `Mth::sqrt(x)` | Square root | Easing curves (fast start, slow end) |
| `Mth::abs(x)` | Absolute value | Bounce effects, keeping values positive |
| `Mth::clamp(v, min, max)` | Clamp to range | Limiting rotation angles |
| `abs(fmod(x, p))` | Triangle wave building block | Linear back-and-forth motion |

Key constants:
- `PI` = 3.14159...
- `HALF_PI` = PI / 2
- Degrees to radians: `degrees / (180.0f / PI)`

### Common Animation Recipes

| Effect | Formula |
|--------|---------|
| Smooth oscillation | `Mth::sin(bob * speed) * amplitude` |
| Circular orbit | x = `Mth::cos(angle) * radius`, z = `Mth::sin(angle) * radius` |
| Opposite swing | Add `+ PI` to one side's input |
| Ease-in (accelerate) | `val * val` (repeat for sharper curve) |
| Ease-out (decelerate) | `1.0f - (1.0f - val) * (1.0f - val)` |
| Triangle wave | `(abs(fmod(t, period) - period*0.5f) - period*0.25f) / (period*0.25f)` |

## prepareMobModel vs setupAnim

Some models override `prepareMobModel` in addition to `setupAnim`. The difference:

| Method | Gets | Good For |
|--------|------|----------|
| `setupAnim` | Generic float params (time, speed, bob, head angles) | Walk cycles, head look, idle, anything that only needs the standard parameters |
| `prepareMobModel` | The actual `Mob` pointer, walk params, and partial ticks | State-dependent animations (sitting, angry, carrying a block, squish effect) |

The Wolf model is a good example. `setupAnim` just handles head look and tail angle. `prepareMobModel` does the heavy lifting because it needs to check `wolf->isAngry()`, `wolf->isSitting()`, and `wolf->getBodyRollAngle()`.

The Iron Golem does the same thing: `setupAnim` handles head look and basic leg swing, but `prepareMobModel` handles the attack animation because it needs `vg->getAttackAnimationTick()` and the flower offering animation from `vg->getOfferFlowerTick()`.

## Partial Ticks and Smooth Interpolation

You don't have to worry about partial ticks in `setupAnim` because the renderer already handles it. Here's what `MobRenderer::render()` does before calling your model:

```cpp
float ws = mob->walkAnimSpeedO + (mob->walkAnimSpeed - mob->walkAnimSpeedO) * a;
float wp = mob->walkAnimPos - mob->walkAnimSpeed * (1 - a);
float bob = mob->tickCount + a;
float headRot = rotlerp(mob->yHeadRotO, mob->yHeadRot, a);
float headRotx = mob->xRotO + (mob->xRot - mob->xRotO) * a;
```

The `a` value is the partial tick (0.0 to 1.0, how far between game ticks we are). The renderer interpolates between the previous tick's values (`*O` suffix = "old") and the current values. By the time `setupAnim` runs, you get smooth values ready to use.

If you need partial ticks inside `prepareMobModel` for your own interpolation, it's the third parameter `a`.

## DLC Skin Animation Overrides

The `uiBitmaskOverrideAnim` parameter in `setupAnim` is a bitmask that 4J uses to customize animation behavior for DLC skin packs. Your `setupAnim` should check these bits and adjust accordingly:

```cpp
void HumanoidModel::setupAnim(float time, float r, float bob,
                                float yRot, float xRot, float scale,
                                unsigned int uiBitmaskOverrideAnim)
{
    // Check if arms should be held down instead of swinging
    if (uiBitmaskOverrideAnim & eAnim_ArmsDown)
    {
        arm0->xRot = 0;
        arm1->xRot = 0;
    }
    // Check if legs should not animate
    if (uiBitmaskOverrideAnim & eAnim_NoLegAnim)
    {
        leg0->xRot = 0;
        leg1->xRot = 0;
    }
    // ...
}
```

The full bitmask is defined in `HumanoidModel.h`. The bits that matter most for custom models:

| Bit | Name | What to do |
|-----|------|------------|
| `eAnim_ArmsDown` (0) | Hold arms at sides | Skip arm swing |
| `eAnim_NoLegAnim` (2) | Freeze legs | Skip leg swing |
| `eAnim_SingleLegs` (5) | Legs move together | Use same rotation for both legs |
| `eAnim_SingleArms` (6) | Arms move together | Use same rotation for both arms |

You don't have to support these if you're making a non-humanoid model. They're only relevant for biped models that might be used with DLC skins.

## The Sneaking Animation

When `HumanoidModel::sneaking` is true, the model shifts down and tilts forward:

```cpp
if (sneaking)
{
    body->yRot = 0.5f;  // tilt forward
    arm0->xRot += 0.4f; // arms angle forward slightly
    arm1->xRot += 0.4f;
    leg0->setPos(-2, 12 + 4.25f, 4);  // shift legs back
    leg1->setPos(2, 12 + 4.25f, 4);
    head->y = 1;  // head moves down
}
```

If your custom model should support sneaking, check the `sneaking` flag and apply a similar shift. The exact values depend on your model's proportions.

## Rendering Scale

The scale parameter passed to `setupAnim` and used in `compile()` is always `1.0f / 16.0f`. This means 1 unit in model space = 1 pixel = 1/16 of a block. So a model that's 32 pixels tall is 2 blocks tall in the world.

You don't need to do anything with the scale in your animation code. It's there for the rendering pipeline. Just set rotations and positions in pixel units.

## Tips

- **Start simple.** Get a basic sin wave working on one part, then build from there.
- **Use `+=` for layered animations.** Set the walk cycle first with `=`, then add idle and breathing with `+=`.
- **Multiply by `r` for walk-dependent motion.** This makes it fade out when the mob stops.
- **Use `bob` for time-based motion.** It keeps ticking whether the mob is walking or not.
- **Watch your frequency values.** `0.05f` to `0.1f` = very slow. `0.3f` = moderate. `0.6662f` = standard walk speed. `1.0f`+ = fast.
- **Keep amplitudes small for subtlety.** `0.05f` radians is barely visible. `0.5f` is a noticeable swing. `1.4f` (like leg swing) is a big motion.
- **The `+ PI` trick is your best friend.** It's how you make things alternate. Arms, legs, tentacles, whatever.
- **Reset positions each frame too.** If your animation moves parts (not just rotates), make sure to set positions back to their base values at the start of `setupAnim`. Otherwise the previous frame's position changes accumulate.
- **Check the vanilla code first.** The best animation reference is the existing models. If you want something similar to an existing mob, start by copying its `setupAnim` and tweaking from there.
