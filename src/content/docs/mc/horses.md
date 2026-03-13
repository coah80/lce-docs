---
title: "Horse Entities"
description: "Horse variants, armor, saddles, and inventory."
---

`EntityHorse` is one of the most complex entity implementations in MinecraftConsoles. It extends `Animal` and implements `ContainerListener`, covering five horse types, layered texture rendering, a saddle/armor/chest inventory, breeding genetics, taming, and jump mechanics.

**Key source files:** `EntityHorse.h/cpp` (`Minecraft.World/`), `HorseInventoryMenu.h/cpp` (`Minecraft.World/`), `HorseRenderer.h/cpp` and `ModelHorse.h` (`Minecraft.Client/`), `UIScene_HorseInventoryMenu.h/cpp` (`Minecraft.Client/Common/UI/`).

## Horse types

Five types are defined as integer constants:

| Constant | Value | Notes |
|---|---|---|
| `TYPE_HORSE` | 0 | Standard horse with coat variants and markings |
| `TYPE_DONKEY` | 1 | Can carry chest bags |
| `TYPE_MULE` | 2 | Can carry chest bags, sterile |
| `TYPE_UNDEAD` | 3 | Zombie horse |
| `TYPE_SKELETON` | 4 | Skeleton horse |

Type is stored in synched data slot `DATA_ID_TYPE` (index 19). The type enum value (`eTYPE_HORSE`) is used for entity dispatch.

Type-checking methods:

- `canWearArmor()` returns `true` only for `TYPE_HORSE`
- `canWearBags()` returns `true` for `TYPE_DONKEY` and `TYPE_MULE`
- `isUndead()` returns `true` for `TYPE_UNDEAD` and `TYPE_SKELETON`
- `isPureBreed()` returns `true` only for `TYPE_HORSE`
- `isSterile()` returns `true` for `TYPE_MULE`

## Coat variants

Seven base coat colors for standard horses, stored in `DATA_ID_TYPE_VARIANT` (index 20):

| Constant | Value | Texture |
|---|---|---|
| `VARIANT_WHITE` | 0 | `horse_white.png` |
| `VARIANT_CREAMY` | 1 | `horse_creamy.png` |
| `VARIANT_CHESTNUT` | 2 | `horse_chestnut.png` |
| `VARIANT_BROWN` | 3 | `horse_brown.png` |
| `VARIANT_BLACK` | 4 | `horse_black.png` |
| `VARIANT_GRAY` | 5 | `horse_gray.png` |
| `VARIANT_DARKBROWN` | 6 | `horse_darkbrown.png` |

Static arrays `VARIANT_TEXTURES[7]`, `VARIANT_TEXTURES_ID[7]`, and `VARIANT_HASHES[7]` store the texture paths, resource IDs, and hash strings for each variant. Each variant maps to a texture file in the `mob/horse/` folder.

## Markings

Five overlay patterns layered on top of the base coat:

| Constant | Value | Description |
|---|---|---|
| `MARKING_NONE` | 0 | No overlay |
| `MARKING_WHITE_DETAILS` | 1 | White face and leg markings |
| `MARKING_WHITE_FIELDS` | 2 | Large white patches |
| `MARKING_WHITE_DOTS` | 3 | White spots |
| `MARKING_BLACK_DOTS` | 4 | Dark spots |

Static arrays `MARKING_TEXTURES[5]`, `MARKING_TEXTURES_ID[5]`, and `MARKING_HASHES[5]` store the data for each marking. Each marking has its own texture and hash string for the layered texture cache.

## Armor

Four armor tiers with protection values:

| Constant | Value | Protection |
|---|---|---|
| `ARMOR_NONE` | 0 | 0 |
| `ARMOR_IRON` | 1 | 5 |
| `ARMOR_GOLD` | 2 | 7 |
| `ARMOR_DIAMOND` | 3 | 11 |

Static arrays:

- `ARMOR_TEXTURES[4]` stores texture paths
- `ARMOR_TEXTURES_ID[4]` stores resource IDs
- `ARMOR_HASHES[4]` stores hash strings
- `ARMOR_PROTECTION[4]` stores the protection values

Armor type is stored in synched data slot `DATA_ID_ARMOR` (index 22). `getArmorValue()` returns the protection amount from the static array. `getArmorTypeForItem(shared_ptr<ItemInstance>)` figures out which tier an item belongs to.

Only standard horses can wear armor (`canWearArmor()` checks `getType() == TYPE_HORSE`). `isHorseArmor(int itemId)` is a static helper for checking item IDs.

## Synched data and flags

Entity data IDs:

| ID | Index | Contents |
|---|---|---|
| `DATA_ID_HORSE_FLAGS` | 16 | Bitmask of state flags |
| `DATA_ID_TYPE` | 19 | Horse type (0 to 4) |
| `DATA_ID_TYPE_VARIANT` | 20 | Coat variant + marking combo |
| `DATA_ID_OWNER_NAME` | 21 | Tamed owner name |
| `DATA_ID_ARMOR` | 22 | Armor tier |

Horse flag bits:

| Flag | Bit | Meaning |
|---|---|---|
| `FLAG_TAME` | `1 << 1` (2) | Horse is tamed |
| `FLAG_SADDLE` | `1 << 2` (4) | Horse has a saddle |
| `FLAG_CHESTED` | `1 << 3` (8) | Donkey/mule has chest bags |
| `FLAG_BRED` | `1 << 4` (16) | Horse was bred (not wild) |
| `FLAG_EATING` | `1 << 5` (32) | Currently eating |
| `FLAG_STANDING` | `1 << 6` (64) | Rearing up on hind legs |
| `FLAG_OPEN_MOUTH` | `1 << 7` (128) | Mouth is open |

`getHorseFlag(int)` and `setHorseFlag(int, bool)` are private methods for reading and writing individual flag bits. Public accessors wrap these: `isTamed()`, `isSaddled()`, `isChestedHorse()`, `isBred()`, `isEating()`, `isStanding()`.

## Inventory

### Inventory layout

| Slot | Index | Contents |
|---|---|---|
| `INV_SLOT_SADDLE` | 0 | Saddle item |
| `INV_SLOT_ARMOR` | 1 | Horse armor item |
| Chest slots | 2 to 16 | Donkey/mule chest (15 slots) |

The base inventory size is `INV_BASE_COUNT` (2). Donkeys and mules with chests get an additional `INV_DONKEY_CHEST_COUNT` (15) slots.

`createInventory()` allocates an `AnimalChest` container. The method is private and called during initialization and when the horse type changes. `getInventorySize()` computes the total slot count based on whether the horse has chest bags.

When the horse's container changes (via `containerChanged()`), equipment is re-read from the inventory to update saddle and armor state. This method is public and implements the `ContainerListener` interface.

### AnimalChest

`AnimalChest` is a dedicated container class (`AnimalChest.h/cpp`) used by the horse inventory. It provides the underlying storage that `EntityHorse` manages.

### HorseInventoryMenu

The container menu for horse inventory. It extends `AbstractContainerMenu` and defines two specialized slot types:

- **`HorseSaddleSlot`** only accepts saddle items (`mayPlace` validates the item)
- **`HorseArmorSlot`** only accepts horse armor items, with an `isActive()` check that queries the parent menu's horse for `canWearArmor()`

The menu constructor takes the player inventory, horse inventory container, and the horse entity. `quickMoveStack` handles shift-click transfer logic between player and horse inventories.

## Taming and breeding

### Taming

- `temper` tracks how willing the horse is to be tamed (starts at 0, stored as a protected `int`)
- `modifyTemper(amount)` adjusts temper and returns the new value
- `setTemper(int)` / `getTemper()` for direct access
- `getMaxTemper()` returns the threshold for taming
- `tameWithName(shared_ptr<Player>)` attempts to tame and assign ownership
- `spawnTamingParticles(bool success)` shows heart particles (success) or smoke particles (failure)
- `getOwnerName()` / `setOwner(wstring)` manage ownership (data slot 21)
- `getOwner()` returns the actual `Player` shared pointer (private)

### Breeding

- `canMate(shared_ptr<Animal>)` checks if two horses can breed (both must be adult, tamed, not sterile, not undead)
- `getBreedOffspring(shared_ptr<AgableMob>)` produces a foal with inherited traits
- `isReadyForParenting()` checks breed readiness (4J made this public for tooltip code)
- `isPureBreed()` / `isSterile()` / `isUndead()` gate breeding compatibility
- `generateRandomMaxHealth()` / `generateRandomJumpStrength()` / `generateRandomSpeed()` produce offspring stats (all private)

Foal scale is controlled by `getFoalScale()` and `updateSize(bool isBaby)`.

### Offspring type rules

When two horses breed:

- Horse + Horse = Horse
- Horse + Donkey = Mule
- Donkey + Donkey = Donkey
- Mules can't breed (`isSterile()` returns true)
- Undead horses can't breed (`isUndead()` returns true)

## Movement and jump mechanics

The horse has a dedicated `JUMP_STRENGTH` attribute (a `RangedAttribute` with default 0.7, range 0.0 to 2.0, client-syncable). This is a static `Attribute*` defined on `EntityHorse`.

Player-initiated jumps are handled by:

- `onPlayerJump(int jumpAmount)` is called when the player presses jump; sets `playerJumpPendingScale`
- `getCustomJump()` reads the computed jump strength from the attribute
- `travel(float xa, float ya)` applies movement and jump physics
- `isEntityJumping` flag tracks whether the horse is currently in a jump (protected)

The `playerJumpPendingScale` field stores the jump charge (0.0 to 1.0) which scales the actual jump height based on the `JUMP_STRENGTH` attribute value.

### Movement-related state

- `isRidable()` checks if the horse can be ridden (must be tamed and saddled)
- `isImmobile()` prevents movement in certain states (protected)
- `allowStandSliding` controls whether the horse can slide while rearing
- `rideableEntity()` returns whether the horse currently has a rider

## Animation state

The horse tracks several animation timers, each with a current and previous ("O" for old) value for smooth interpolation:

| Animation | Current | Previous | Purpose |
|---|---|---|---|
| Eating | `eatAnim` | `eatAnimO` | Head-down eating motion |
| Standing | `standAnim` | `standAnimO` | Rearing up on hind legs |
| Mouth | `mouthAnim` | `mouthAnimO` | Mouth open/close |

Additional counters:

- `countEating` tracks the eating timer
- `mouthCounter` controls mouth animation timing
- `standCounter` controls standing animation timing
- `tailCounter` (public) controls tail movement
- `sprintCounter` (public) controls sprint animation
- `gallopSoundCounter` (private) paces gallop sound effects

Public interpolation accessors:

- `getEatAnim(float a)` returns the eating animation progress
- `getStandAnim(float a)` returns the standing animation progress
- `getMouthAnim(float a)` returns the mouth animation progress

State-setting methods:

- `setEating(bool)` / `setStanding(bool)` / `setUsingItemFlag(bool)` control animation states
- `stand()` triggers the rearing animation (private)
- `makeMad()` triggers the angry animation
- `openMouth()` opens the horse's mouth (private)
- `eatingHorse()` runs the eating animation logic (private)
- `moveTail()` animates the tail (private)

## Sounds

- `getAmbientSound()` returns the idle sound
- `getMadSound()` returns the angry sound
- `getHurtSound()` returns the hurt sound
- `getDeathSound()` returns the death sound
- `getSoundVolume()` returns the sound volume (protected)
- `getAmbientSoundInterval()` returns the time between ambient sounds
- `playStepSound()` plays footstep sounds (protected), with a gallop sound counter for pacing

## Spawning

`finalizeMobSpawn(MobGroupData*, int extraData)` uses a `HorseGroupData` inner class to make sure horses spawning in a group share the same type and variant. The `HorseGroupData` stores `horseType` and `horseVariant` fields. The first horse in a group sets the type/variant, and the rest inherit it. 4J added the `extraData` parameter.

`checkSpawningBiome()` validates the biome is appropriate. `canSpawn()` runs standard checks. `removeWhenFarAway()` returns `false` so tamed horses never despawn. `getMaxSpawnClusterSize()` controls group spawning.

## Rendering

### HorseRenderer

Extends `MobRenderer`. Handles type-based scaling (donkeys render at 0.87x, mules at 0.92x) and texture selection.

Five base `ResourceLocation` textures are defined:

- `HORSE_LOCATION` (white horse default)
- `HORSE_DONKEY_LOCATION`
- `HORSE_MULE_LOCATION`
- `HORSE_ZOMBIE_LOCATION`
- `HORSE_SKELETON_LOCATION`

### Layered texture system

For standard horses with layered textures (variant + marking + armor), `getOrCreateLayeredTextureLocation` looks up the horse's `getLayeredTextureHashName()` in a static `LAYERED_LOCATION_CACHE` map. If it's not cached yet, it creates a new `ResourceLocation` from the array returned by `getLayeredTextureLayers()` and stores it.

The horse provides:

- `hasLayeredTextures()` returns `true` for standard horses with markings or armor
- `getLayeredTextureHashName()` returns a unique hash string
- `getLayeredTextureLayers()` returns an `intArray` of texture resource IDs
- `clearLayeredTextureInfo()` / `rebuildLayeredTextureInfo()` manage the cached data (private)

The `bindTexture` override detects multi-layer textures and calls `bindTextureLayers` instead of the standard single-texture bind.

### ModelHorse

A detailed 3D model with `ModelPart` pointers for:

- **Head**: Head, UMouth, LMouth, Ear1, Ear2, MuleEarL, MuleEarR, Neck, Mane
- **Body**: Body, TailA, TailB, TailC
- **Legs**: Four legs, each with three segments (e.g., Leg1A, Leg1B, Leg1C)
- **Equipment**: Bag1, Bag2, Saddle, SaddleB, SaddleC, SaddleL, SaddleL2, SaddleR, SaddleR2, SaddleMouthL, SaddleMouthR, SaddleMouthLine, SaddleMouthLineR
- **Head saddle**: HeadSaddle (bridle)

`prepareMobModel` reads animation state (eating, standing, mouth) from the entity. `render` draws all parts with the right visibility based on type, saddle state, and chest state.

Mule ears (`MuleEarL`, `MuleEarR`) are only rendered for donkey and mule types. Standard horse ears (`Ear1`, `Ear2`) are used for other types. Bag models are only rendered when `isChestedHorse()` is true.

## Death and drops

- `die(DamageSource*)` handles horse death, including equipment drops
- `dropMyStuff()` drops all inventory contents
- `dropBags()` drops chest items specifically
- `dropInventory(shared_ptr<Entity>, shared_ptr<AnimalChest>)` handles the actual drop logic (private)
- `getDeathLoot()` returns the loot item ID (protected)
- `causeFallDamage(float)` applies fall damage (protected)

## Save/load

- `addAdditonalSaveData(CompoundTag*)` writes horse-specific data (type, variant, temper, tame status, owner, inventory, etc.)
- `readAdditionalSaveData(CompoundTag*)` reads it back

## Interaction

- `mobInteract(shared_ptr<Player>)` handles right-click interaction (feeding, taming, mounting, opening inventory)
- `openInventory(shared_ptr<Player>)` opens the horse inventory screen
- `doPlayerRide(shared_ptr<Player>)` mounts the player on the horse (private)
- `isFood(shared_ptr<ItemInstance>)` checks if an item is horse food
- `canBeLeashed()` returns whether the horse can be leashed
- `onLeashDistance(float)` handles leash distance updates (protected)

## Entity selector

`HorseEntitySelector` is a public class implementing `EntitySelector`. Its `matches()` method filters for horse entities, used by the breeding system to find parent horses. The horse class also stores a static `PARENT_HORSE_SELECTOR` pointer.

## UI scene

`UIScene_HorseInventoryMenu` provides the in-game inventory screen. It maps UI controls to:

- `m_slotSaddle` / `m_slotArmor` for saddle and armor slots
- `m_slotListChest` for the donkey/mule chest grid (`"DonkeyInventoryList"`)
- `m_horsePreview` for a `UIControl_MinecraftHorse` 3D preview of the horse
- `m_labelHorse` for the horse's name label

Flash functions `SetIsDonkey` and `SetHasInventory` control UI visibility of chest slots depending on the horse type.

## Other methods

- `getAName()` returns the localized horse name
- `nameYOffset()` returns the name tag Y offset
- `renderName()` returns whether the name tag should render
- `isPushable()` returns whether other entities can push the horse
- `isAdult()` checks maturity
- `onLadder()` returns whether the horse is on a ladder
- `handleEntityEvent(byte)` handles network entity events
- `positionRider()` positions the mounted player
- `isAmuletHorse()` checks for a special horse type
- `aiStep()` runs the horse AI logic per tick
- `tick()` runs the full horse tick (position, animation, etc.)
- `hurt(DamageSource*, float)` handles incoming damage
