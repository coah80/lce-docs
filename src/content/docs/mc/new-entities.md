---
title: "New Entities & Models"
description: "New entity types and their renderers in MinecraftConsoles."
---

MinecraftConsoles adds several entity types beyond the LCEMP base, along with their renderers and models on the client side. Each entity has a type enum (`eINSTANCEOF`), a static `create()` factory, and synched data fields.

## EntityHorse

**Files**: `Minecraft.World/EntityHorse.h`, `.cpp`; `Minecraft.Client/HorseRenderer.h`, `.cpp`; `Minecraft.Client/ModelHorse.cpp`

The horse is the most complex new entity. It extends `Animal` and implements `ContainerListener`.

### Horse types and variants

| Type constant | Value | Description |
|---------------|-------|-------------|
| `TYPE_HORSE` | 0 | Normal horse |
| `TYPE_DONKEY` | 1 | Donkey |
| `TYPE_MULE` | 2 | Mule |
| `TYPE_UNDEAD` | 3 | Zombie horse |
| `TYPE_SKELETON` | 4 | Skeleton horse |

7 color variants (white, creamy, chestnut, brown, black, gray, darkbrown) and 5 markings (none, white details, white fields, white dots, black dots).

### Armor system

4 armor tiers: none, iron, gold, diamond. Armor textures and protection values are stored in static arrays. The inventory has designated slots for saddle (`INV_SLOT_SADDLE = 0`) and armor (`INV_SLOT_ARMOR = 1`), plus an optional 15-slot donkey chest.

### Key features

- **Synched data**: Flags for tame, saddle, chested, bred, eating, standing, open mouth. Type, variant, owner name, and armor type are separate data IDs.
- **Temper system**: A `temper` integer that goes up through feeding. The horse gets tamed when temper exceeds `getMaxTemper()`.
- **Jump strength**: A custom `JUMP_STRENGTH` attribute with randomly generated values.
- **Animations**: Eating, standing, and mouth animations with interpolated `O` (old) values for smooth rendering.
- **Breeding**: Uses `HorseGroupData` for spawn group data. Offspring inherit parent types. Mules (`TYPE_MULE`) are sterile.
- **Layered textures**: `HorseRenderer` caches layered texture combinations (variant + marking + armor) using `LAYERED_LOCATION_CACHE`.
- **Entity selector**: `HorseEntitySelector` implements `EntitySelector` for finding parent horses.

### Renderer

`HorseRenderer` extends `MobRenderer` with texture locations for each horse type (horse, mule, donkey, zombie, skeleton). Applies foal scaling and height adjustment.

For full details on horse inventory and equipment, see the [Horses](/lce-docs/mc/horses/) page.

## Ocelot

MinecraftConsoles has two ocelot implementations:

### Ocelot (new AI system)

**Files**: `Minecraft.World/Ocelot.h`, `.cpp`; `Minecraft.Client/OcelotRenderer.h`, `.cpp`; `Minecraft.Client/OcelotModel.h`, `.cpp`

Extends `TamableAnimal`. Uses the new goal-based AI system (`useNewAi()` returns `true`).

| Property | Value |
|----------|-------|
| Type enum | `eTYPE_OCELOT` |
| Cat types | `TYPE_OCELOT`, `TYPE_BLACK`, `TYPE_RED`, `TYPE_SIAMESE` |
| Speed modifiers | `SNEAK_SPEED_MOD`, `WALK_SPEED_MOD`, `FOLLOW_SPEED_MOD`, `SPRINT_SPEED_MOD` (doubles) |

Has dedicated AI goals: `OcelotAttackGoal` (in `OcelotAttackGoal.h/cpp`) for pouncing attacks and `OcelotSitOnTileGoal` (in `OcelotSitOnTileGoal.h/cpp`) for the classic behavior of sitting on chests/furnaces. Uses `TemptGoal` for fish luring. 4J added `isSittingOnTile()` for tooltip display.

### Ozelot (legacy AI system)

**Files**: `Minecraft.World/Ozelot.h`, `Ozelot.cpp`; `Minecraft.Client/OzelotRenderer.h`, `OzelotModel.h`

The older implementation using `eTYPE_OZELOT`. Uses integer damage and float speed values instead of double modifiers. Has `getTexture()` returning an integer rather than using attribute-based rendering.

## Witch

**Files**: `Minecraft.World/Witch.h`, `.cpp`; `Minecraft.Client/WitchRenderer.h`, `.cpp`; `Minecraft.Client/WitchModel.h`, `.cpp`

Extends `Monster` and implements `RangedAttackMob`.

| Property | Value |
|----------|-------|
| Type enum | `eTYPE_WITCH` |
| AI system | New (`useNewAi()` returns `true`) |
| Ranged attack | `performRangedAttack()` throws potions |
| Speed modifier | `SPEED_MODIFIER_DRINKING` applied while using items |
| Death loot | 8 possible drops (defined in `DEATH_LOOT` array) |

The witch has a synched `DATA_USING_ITEM` flag (data ID 21) and a `usingTime` counter for potion-drinking animations. `WitchRenderer` includes special rendering for the held item and nose animation. `WitchModel` provides the custom model geometry.

## WitherBoss

**Files**: `Minecraft.World/WitherBoss.h`, `.cpp`; `Minecraft.Client/WitherBossRenderer.h`, `.cpp`; `Minecraft.Client/WitherBossModel.h`, `.cpp`

Extends `Monster` and implements both `RangedAttackMob` and `BossMob`.

| Property | Value |
|----------|-------|
| Type enum | `eTYPE_WITHERBOSS` |
| AI system | New (`useNewAi()` returns `true`) |
| Heads | 3 (main + 2 side heads with independent targeting) |
| Block destruction | `destroyBlocksTick` timer for periodic block breaking |

### Multi-head system

The Wither has synched data for three targets (`DATA_TARGET_A/B/C`) and an invulnerability counter (`DATA_ID_INV`). Each side head tracks its own rotation (`xRotHeads`, `yRotHeads`) with interpolation values.

`performRangedAttack()` is overloaded: the `RangedAttackMob` interface version calls the head-specific version that fires `WitherSkull` projectiles. Dangerous skulls (blue) are fired at closer range.

### Rendering

`WitherBossRenderer` uses three texture locations (normal, armor overlay, invulnerable) and has `prepareArmor()` and `prepareArmorOverlay()` for the shield effect. The 4J comment notes that `BossMob` interface methods delegate to `Monster` base implementations.

### LivingEntitySelector

A utility `EntitySelector` subclass defined alongside `WitherBoss` that filters for living entities. The Wither's targeting logic uses it.

## WitherSkull

**Files**: `Minecraft.World/WitherSkull.h`, `.cpp`; `Minecraft.Client/WitherSkullRenderer.h`, `.cpp`

Extends `Fireball`. The projectile fired by the Wither.

| Property | Value |
|----------|-------|
| Type enum | `eTYPE_WITHER_SKULL` |
| Synched data | `DATA_DANGEROUS` (data ID 10) |

Has a `dangerous` flag (blue skull) that affects explosion resistance calculation and hit behavior. 4J added a `shouldBurn()` method. `WitherSkullRenderer` uses `SkeletonHeadModel` for geometry and has separate textures for normal and armored states.

## Bat

**Files**: `Minecraft.World/Bat.h`; `Minecraft.Client/BatRenderer.h`, `BatModel.h`

Extends `AmbientCreature`. A passive ambient mob that hangs from ceilings.

| Property | Value |
|----------|-------|
| Type enum | `eTYPE_BAT` |
| AI system | New (`useNewAi()` returns `true`) |
| Synched data | `DATA_ID_FLAGS` with `FLAG_RESTING` bit |

Key behaviors:

- Roosts on ceilings when resting (`isResting()`)
- Navigates to random `targetPosition` when flying
- Not pushable (`isPushable()` returns `false`)
- No fall damage (`causeFallDamage` does nothing)
- Ignores tile triggers (pressure plates, tripwires)

## LeashFenceKnotEntity

**Files**: `Minecraft.World/LeashFenceKnotEntity.h`, `.cpp`; `Minecraft.Client/LeashKnotRenderer.h`, `.cpp`; `Minecraft.Client/LeashKnotModel.h`, `.cpp`

Extends `HangingEntity`. The invisible-until-rendered knot entity placed on fence posts when mobs are leashed.

| Property | Value |
|----------|-------|
| Type enum | `eTYPE_LEASHFENCEKNOT` |

Key static methods:

- `createAndAddKnot()` creates a new knot entity at the given fence coordinates and adds it to the world.
- `findKnotAt()` searches for an existing knot at a position.

`LeashKnotRenderer` uses `LeashKnotModel` for the small knot mesh and renders the leash rope to connected mobs.

## FireworksRocketEntity

**Files**: `Minecraft.World/FireworksRocketEntity.h`, `.cpp`

Extends `Entity` directly (not a `Mob` or `Projectile`).

| Property | Value |
|----------|-------|
| Type enum | `eTYPE_FIREWORKS_ROCKET` |
| Synched data | `DATA_ID_FIREWORKS_ITEM` (data ID 8) |

Tracks `life` (current tick) and `lifetime` (detonation time). On the client side, `handleEntityEvent()` triggers the particle explosion. Has custom brightness (`getBrightness`, `getLightColor`) for the glow effect. Not attackable.

Client-side particle effects are handled separately in `Minecraft.Client/FireworksParticles.h/cpp`.

## Entity render registration

All entity renderers are registered in `Minecraft.Client/EntityRenderDispatcher.cpp`, which maps entity type enums to their renderer instances. This is the central dispatch point for rendering all entity types.
