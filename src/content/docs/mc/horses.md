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

Type is stored in synched data slot `DATA_ID_TYPE` (index 19).

## Coat variants

Seven base coat colors for standard horses, stored in `DATA_ID_TYPE_VARIANT` (index 20):

| Constant | Value |
|---|---|
| `VARIANT_WHITE` | 0 |
| `VARIANT_CREAMY` | 1 |
| `VARIANT_CHESTNUT` | 2 |
| `VARIANT_BROWN` | 3 |
| `VARIANT_BLACK` | 4 |
| `VARIANT_GRAY` | 5 |
| `VARIANT_DARKBROWN` | 6 |

Each variant maps to a texture file (e.g., `horse_white.png`, `horse_brown.png`) in the `mob/horse/` folder.

## Markings

Five overlay patterns layered on top of the base coat:

| Constant | Value |
|---|---|
| `MARKING_NONE` | 0 |
| `MARKING_WHITE_DETAILS` | 1 |
| `MARKING_WHITE_FIELDS` | 2 |
| `MARKING_WHITE_DOTS` | 3 |
| `MARKING_BLACK_DOTS` | 4 |

Each marking has its own texture and hash string for the layered texture cache.

## Armor

Four armor tiers with protection values:

| Constant | Value | Protection |
|---|---|---|
| `ARMOR_NONE` | 0 | 0 |
| `ARMOR_IRON` | 1 | 5 |
| `ARMOR_GOLD` | 2 | 7 |
| `ARMOR_DIAMOND` | 3 | 11 |

Armor type is stored in synched data slot `DATA_ID_ARMOR` (index 22). Each tier has a dedicated texture (`horse_armor_iron.png`, etc.) and a hash string for the layered cache. `getArmorValue()` returns the protection amount, and `getArmorTypeForItem(ItemInstance)` identifies which tier an item belongs to.

Only standard horses can wear armor (`canWearArmor()` checks the type).

## Synched data and flags

Entity data IDs:

| ID | Index | Contents |
|---|---|---|
| `DATA_ID_HORSE_FLAGS` | 16 | Bitmask of state flags |
| `DATA_ID_TYPE` | 19 | Horse type (0--4) |
| `DATA_ID_TYPE_VARIANT` | 20 | Coat variant + marking combo |
| `DATA_ID_OWNER_NAME` | 21 | Tamed owner name |
| `DATA_ID_ARMOR` | 22 | Armor tier |

Horse flag bits:

| Flag | Bit | Meaning |
|---|---|---|
| `FLAG_TAME` | 1 << 1 | Horse is tamed |
| `FLAG_SADDLE` | 1 << 2 | Horse has a saddle |
| `FLAG_CHESTED` | 1 << 3 | Donkey/mule has chest bags |
| `FLAG_BRED` | 1 << 4 | Horse was bred (not wild) |
| `FLAG_EATING` | 1 << 5 | Currently eating |
| `FLAG_STANDING` | 1 << 6 | Rearing up on hind legs |
| `FLAG_OPEN_MOUTH` | 1 << 7 | Mouth is open |

## Inventory

### Inventory layout

| Slot | Index | Contents |
|---|---|---|
| `INV_SLOT_SADDLE` | 0 | Saddle item |
| `INV_SLOT_ARMOR` | 1 | Horse armor item |
| Chest slots | 2--16 | Donkey/mule chest (15 slots) |

The base inventory size is `INV_BASE_COUNT` (2). Donkeys and mules with chests get an additional `INV_DONKEY_CHEST_COUNT` (15) slots.

`createInventory()` allocates an `AnimalChest` container. When the horse's container changes (via `containerChanged()`), equipment is re-read from the inventory to update saddle and armor state.

### HorseInventoryMenu

The container menu for horse inventory. Extends `AbstractContainerMenu` and defines two specialized slot types:

- **`HorseSaddleSlot`** -- only accepts saddle items (`mayPlace` validates the item)
- **`HorseArmorSlot`** -- only accepts horse armor items, with an `isActive()` check that queries the parent menu's horse for `canWearArmor()`

The menu constructor takes the player inventory, horse inventory container, and the horse entity. `quickMoveStack` handles shift-click transfer logic between player and horse inventories.

## Taming and breeding

### Taming

- `temper` tracks the horse's willingness to be tamed (starts at 0)
- `modifyTemper(amount)` adjusts temper; `getMaxTemper()` returns the threshold
- `tameWithName(Player)` attempts to tame and assign ownership
- `spawnTamingParticles(bool)` shows heart or smoke particles
- `getOwnerName()` / `setOwner(wstring)` manage ownership (data slot 21)

### Breeding

- `canMate(Animal)` checks if two horses can breed
- `getBreedOffspring(AgableMob)` produces a foal with inherited traits
- `isReadyForParenting()` checks breed readiness
- `isPureBreed()` / `isSterile()` / `isUndead()` gate breeding compatibility
- `generateRandomMaxHealth()`, `generateRandomJumpStrength()`, `generateRandomSpeed()` produce offspring stats

Foal scale is controlled by `getFoalScale()` and `updateSize(bool isBaby)`.

## Jump mechanics

The horse has a dedicated `JUMP_STRENGTH` attribute (a `RangedAttribute` with default 0.7, range 0.0--2.0, client-syncable). Player-initiated jumps are handled by:

- `onPlayerJump(int jumpAmount)` -- called when the player presses jump; sets `playerJumpPendingScale`
- `getCustomJump()` -- reads the computed jump strength from the attribute
- `travel(float xa, float ya)` -- applies movement and jump physics

## Spawning

`finalizeMobSpawn(MobGroupData*)` uses a `HorseGroupData` inner class to ensure horses spawning in a group share the same type and variant. The first horse in a group sets the type/variant; subsequent horses inherit it.

`checkSpawningBiome()` validates the biome is appropriate. `canSpawn()` runs standard checks, and `removeWhenFarAway()` returns false (tamed horses persist).

## Rendering

### HorseRenderer

Extends `MobRenderer`. Handles type-based scaling (donkeys render at 0.87x, mules at 0.92x) and texture selection.

Five base `ResourceLocation` textures are defined:

- `HORSE_LOCATION` (white horse default)
- `HORSE_DONKEY_LOCATION`
- `HORSE_MULE_LOCATION`
- `HORSE_ZOMBIE_LOCATION`
- `HORSE_SKELETON_LOCATION`

For standard horses with layered textures (variant + marking + armor), `getOrCreateLayeredTextureLocation` looks up the horse's `getLayeredTextureHashName()` in a static `LAYERED_LOCATION_CACHE` map. If not cached, it creates a new `ResourceLocation` from the array returned by `getLayeredTextureLayers()` and stores it.

The `bindTexture` override detects multi-layer textures and calls `bindTextureLayers` instead of the standard single-texture bind.

### ModelHorse

A detailed 3D model with `ModelPart` pointers for:

- **Head**: Head, UMouth, LMouth, Ear1, Ear2, MuleEarL, MuleEarR, Neck, Mane
- **Body**: Body, TailA, TailB, TailC
- **Legs**: Four legs, each with three segments (e.g., Leg1A, Leg1B, Leg1C)
- **Equipment**: Bag1, Bag2, Saddle, SaddleB, SaddleC, SaddleL, SaddleL2, SaddleR, SaddleR2, SaddleMouthL, SaddleMouthR, SaddleMouthLine, SaddleMouthLineR
- **Head saddle**: HeadSaddle (bridle)

`prepareMobModel` reads animation state (eating, standing, mouth) from the entity. `render` draws all parts with appropriate visibility based on type, saddle state, and chest state.

## UI scene

`UIScene_HorseInventoryMenu` provides the in-game inventory screen. It maps UI controls to:

- `m_slotSaddle` / `m_slotArmor` -- saddle and armor slots
- `m_slotListChest` -- donkey/mule chest grid (`"DonkeyInventoryList"`)
- `m_horsePreview` -- a `UIControl_MinecraftHorse` 3D preview of the horse
- `m_labelHorse` -- the horse's name label

Flash functions `SetIsDonkey` and `SetHasInventory` control UI visibility of chest slots depending on the horse type.
