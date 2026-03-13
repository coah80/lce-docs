---
title: Tools & Weapons
description: Swords, pickaxes, axes, shovels, hoes, shears, and fishing rods. Tier system, diggable tiles, damage values, and durability.
---

Tools and weapons are the main interactive items in LCE. They all share a **Tier** system that controls durability, mining speed, attack damage, and enchantability.

**Key source files:** `Minecraft.World/WeaponItem.h`, `Minecraft.World/DiggerItem.h`, `Minecraft.World/PickaxeItem.h`, `Minecraft.World/ShovelItem.h`, `Minecraft.World/HatchetItem.h`, `Minecraft.World/HoeItem.h`, `Minecraft.World/ShearsItem.h`, `Minecraft.World/FishingRodItem.h`

## Tool Tiers

**Defined in:** `Item::Tier` (nested class in `Item.h`), instantiated as `_Tier` in `Item.cpp`

Each tier sets the mining level, durability, mining speed, attack damage bonus, and enchantability:

```cpp
const Tier *WOOD    = new Tier(0,   59, 2.0f, 0, 15);
const Tier *STONE   = new Tier(1,  131, 4.0f, 1,  5);
const Tier *IRON    = new Tier(2,  250, 6.0f, 2, 14);
const Tier *DIAMOND = new Tier(3, 1561, 8.0f, 3, 10);
const Tier *GOLD    = new Tier(0,   32, 12.0f, 0, 22);
```

| Tier | Level | Durability | Speed | Damage Bonus | Enchantability |
|------|-------|-----------|-------|-------------|----------------|
| Wood | 0 | 59 | 2.0 | +0 | 15 |
| Stone | 1 | 131 | 4.0 | +1 | 5 |
| Iron | 2 | 250 | 6.0 | +2 | 14 |
| Diamond | 3 | 1561 | 8.0 | +3 | 10 |
| Gold | 0 | 32 | 12.0 | +0 | 22 |

Gold is interesting: it has the fastest mining speed (12.0) and highest enchantability (22), but it breaks super quickly (32 durability) and has a mining level of 0, same as Wood.

### Tier constructor

```cpp
Tier(int level, int uses, float speed, int damage, int enchantmentValue);
```

| Parameter | Field | Getter |
|-----------|-------|--------|
| `level` | Mining level (what blocks you can harvest) | `getLevel()` |
| `uses` | Number of uses before breaking | `getUses()` |
| `speed` | Mining speed multiplier | `getSpeed()` |
| `damage` | Attack damage bonus added on top of base | `getAttackDamageBonus()` |
| `enchantmentValue` | How good enchantments are at the enchanting table | `getEnchantmentValue()` |

### Tier repair items

The `getTierItemId()` method figures out which item can repair a tool on the anvil. It uses pointer identity checks (comparing the `this` pointer against the static tier constants):

| Tier | Repair Item |
|------|-------------|
| Wood | Planks (`Tile::wood_Id`) |
| Stone | Cobblestone (`Tile::stoneBrick_Id`) |
| Iron | Iron Ingot (265) |
| Diamond | Diamond (264) |
| Gold | Gold Ingot (266) |

If none of the checks match (like for a custom tier), it returns `-1` meaning no repair item.

## WeaponItem (Swords)

**Files:** `Minecraft.World/WeaponItem.h`, `Minecraft.World/WeaponItem.cpp`

Swords deal a base damage of **4 + tier damage bonus**. The constructor sets `maxStackSize = 1` and `maxDamage` from the tier's uses.

```cpp
WeaponItem(int id, const Tier *tier);
```

### Damage and speeds

| Property | Value |
|----------|-------|
| Base attack damage | 4 + tier bonus |
| Cobweb destroy speed | 15.0 |
| All other blocks | 1.5 |

### Blocking

Swords use `UseAnim_block` for blocking. When you right-click, `getUseDuration()` returns 72,000 ticks (one hour: `20 * 60 * 60`). In practice you release the button way before that. While blocking, incoming damage is reduced.

### Durability costs

| Action | Durability cost |
|--------|----------------|
| Hit an enemy | 1 |
| Mine a block (nonzero destroy speed) | 2 |

The `hurtEnemy()` method calls `itemInstance->hurt(1, attacker)` and returns `true`. The `mineBlock()` method calls `itemInstance->hurt(2, owner)` but only if the tile has a nonzero destroy speed.

### Sword stats

| Sword | ID | Total Damage | Durability |
|-------|----|-------------|------------|
| Wood | 268 | 4 (4+0) | 59 |
| Stone | 272 | 5 (4+1) | 131 |
| Iron | 267 | 6 (4+2) | 250 |
| Diamond | 276 | 7 (4+3) | 1561 |
| Gold | 283 | 4 (4+0) | 32 |

### Special harvesting

`canDestroySpecial()` returns `true` for cobwebs (`Tile::web`), meaning swords can harvest cobwebs and drop string.

### Enchantability

`getEnchantmentValue()` returns the tier's enchantment value.

## DiggerItem (Base Mining Tool)

**Files:** `Minecraft.World/DiggerItem.h`, `Minecraft.World/DiggerItem.cpp`

This is the base class for pickaxes, shovels, and axes. Each subclass defines a list of "diggable" tiles stored as a `TileArray` (typedef for `vector<Tile *>`).

```cpp
DiggerItem(int id, int baseAttackDamage, const Tier *tier, TileArray *diggables);
```

The constructor does:
- Sets `maxStackSize = 1`
- Sets `maxDamage` from `tier->getUses()`
- Stores `attackDamage = baseAttackDamage + tier->getAttackDamageBonus()`
- Stores the tier and diggable list

### Speed calculation

`getDestroySpeed()` checks if the tile is in the diggable list. If yes, returns the tier's speed. If no, returns `1.0` (base speed, same as punching).

### Durability costs

| Action | Durability cost |
|--------|----------------|
| Hit an enemy | 2 |
| Mine a block (nonzero destroy speed) | 1 |

Note this is the opposite of swords. Tools cost more to hit enemies but less to mine blocks.

### Enchantability

`getEnchantmentValue()` returns the tier's enchantment value.

### Repair

`isValidRepairItem()` calls `Tier::getTierItemId()` and checks if the repair item's ID matches.

## PickaxeItem

**Files:** `Minecraft.World/PickaxeItem.h`, `Minecraft.World/PickaxeItem.cpp`

Base attack damage parameter: **2** (total = 2 + tier bonus).

### Diggable tiles (22)

Stone Brick, Stone Slab, Stone Slab Half, Rock, Sandstone, Mossy Cobblestone, Iron Ore, Iron Block, Coal Ore, Gold Block, Gold Ore, Diamond Ore, Diamond Block, Ice, Netherrack, Lapis Ore, Lapis Block, Redstone Ore, Lit Redstone Ore, Rail, Detector Rail, Golden Rail.

### Speed bonuses

Beyond the diggable list, `getDestroySpeed()` also gives the tier speed bonus on any tile whose material is `Material::metal`, `Material::heavyMetal`, or `Material::stone`.

### Mining level requirements

`canDestroySpecial()` checks the tier level against specific blocks:

| Block | Min Tier Level | Minimum Tier |
|-------|---------------|--------------|
| Obsidian | 3 | Diamond only |
| Diamond Ore/Block | 2 | Iron+ |
| Emerald Ore/Block | 2 | Iron+ |
| Gold Ore/Block | 2 | Iron+ |
| Redstone Ore (both states) | 2 | Iron+ |
| Iron Ore/Block | 1 | Stone+ |
| Lapis Ore/Block | 1 | Stone+ |
| Any stone material | 0 | Any pickaxe |
| Any metal/heavy metal | 0 | Any pickaxe |

If you mine a block that needs a higher tier, it takes forever and drops nothing.

### Pickaxe stats

| Pickaxe | ID | Total Damage | Durability |
|---------|----|-------------|------------|
| Wood | 270 | 2 (2+0) | 59 |
| Stone | 274 | 3 (2+1) | 131 |
| Iron | 257 | 4 (2+2) | 250 |
| Diamond | 278 | 5 (2+3) | 1561 |
| Gold | 285 | 2 (2+0) | 32 |

## ShovelItem

**Files:** `Minecraft.World/ShovelItem.h`, `Minecraft.World/ShovelItem.cpp`

Base attack damage parameter: **1** (total = 1 + tier bonus).

### Diggable tiles (10)

Grass, Dirt, Sand, Gravel, Top Snow, Snow, Clay, Farmland, Soul Sand (`hellSand`), Mycelium (`mycel`).

### Special harvesting

`canDestroySpecial()` returns `true` for Top Snow (`Tile::topSnow`) and Snow blocks (`Tile::snow`). This means shovels can harvest snow and get snowballs.

### Shovel stats

| Shovel | ID | Total Damage | Durability |
|--------|----|-------------|------------|
| Wood | 269 | 1 (1+0) | 59 |
| Stone | 273 | 2 (1+1) | 131 |
| Iron | 256 | 3 (1+2) | 250 |
| Diamond | 277 | 4 (1+3) | 1561 |
| Gold | 284 | 1 (1+0) | 32 |

## HatchetItem (Axe)

**Files:** `Minecraft.World/HatchetItem.h`, `Minecraft.World/HatchetItem.cpp`

Base attack damage parameter: **3** (total = 3 + tier bonus). Axes deal the most damage of any mining tool.

### Diggable tiles (8)

Planks (`Tile::wood`), Bookshelf, Logs (`Tile::treeTrunk`), Chest, Stone Slab, Stone Slab Half, Pumpkin, Lit Pumpkin.

### Speed bonuses

Beyond the diggable list, `getDestroySpeed()` also gives the tier speed bonus on any tile with `Material::wood`.

### Axe stats

| Axe | ID | Total Damage | Durability |
|-----|----|-------------|------------|
| Wood | 271 | 3 (3+0) | 59 |
| Stone | 275 | 4 (3+1) | 131 |
| Iron | 258 | 5 (3+2) | 250 |
| Diamond | 279 | 6 (3+3) | 1561 |
| Gold | 286 | 3 (3+0) | 32 |

## HoeItem

**Files:** `Minecraft.World/HoeItem.h`, `Minecraft.World/HoeItem.cpp`

Hoes turn grass and dirt blocks into farmland. They are not mining tools, so they have no diggable tile list and no `getDestroySpeed()` override.

### How tilling works

The `useOn()` method runs these checks:
1. The face must not be 0 (not the bottom of a block).
2. The player must be able to use the block at that position.
3. The block above must be air.
4. The target block must be grass (`Tile::grass`) or dirt (`Tile::dirt`).

If all checks pass, it plays the `step.gravel` sound and sets the block to farmland (`Tile::farmland`). Uses **1 durability** per tilling action.

### Enchantability

Hoes do **not** override `getEnchantmentValue()`, so they return 0 (the `Item` base class default). This means hoes cannot get enchantments at the enchanting table.

### Hand equipped

The constructor calls `handEquipped()` so hoes render like tools when held.

### Hoe stats

| Hoe | ID | Durability |
|-----|----|-----------|
| Wood | 290 | 59 |
| Stone | 291 | 131 |
| Iron | 292 | 250 |
| Diamond | 293 | 1561 |
| Gold | 294 | 32 |

## ShearsItem

**Files:** `Minecraft.World/ShearsItem.h`, `Minecraft.World/ShearsItem.cpp`

| Property | Value |
|----------|-------|
| ID | 359 |
| Max Durability | 238 |
| Stack Size | 1 |

### Speed bonuses and harvesting

| Tile | Destroy Speed | Can Harvest (via `canDestroySpecial`) |
|------|--------------|--------------------------|
| Cobweb | 15.0 | Yes (drops string) |
| Leaves | 15.0 | No (normal leaf drops) |
| Wool | 5.0 | No (normal wool drops) |
| Redstone Dust | 1.0 | Yes |
| Tripwire | 1.0 | Yes |

### Durability behavior

The `mineBlock()` override uses **1 durability** when mining these specific tiles: leaves, cobweb, tall grass, vines, and tripwire. For all other blocks, it falls through to the default `Item::mineBlock()` behavior (which does nothing for shears).

### No enchantability

Shears do not override `getEnchantmentValue()`, so they return 0 from the base `Item` class. You cannot enchant shears at an enchanting table.

## FishingRodItem

**Files:** `Minecraft.World/FishingRodItem.h`, `Minecraft.World/FishingRodItem.cpp`

| Property | Value |
|----------|-------|
| ID | 346 |
| Max Durability | 64 |
| Stack Size | 1 |
| Hand Equipped | Yes |
| Mirrored Art | Yes (`isMirroredArt = true`) |

### Casting and reeling

Right-click toggles between casting and reeling:

1. **If the player already has a fishing hook out:** calls `FishingHook::retrieve()` on the hook entity. The return value becomes the durability damage. Then it plays the `random.bow` sound at pitch 0.4.
2. **If no hook is out:** creates a new `FishingHook` entity and adds it to the level. Plays the `random.bow` sound at pitch 0.5. Does not cost durability.

### Cast icon

When a fishing hook is active, the item texture changes to `TEXTURE_EMPTY` (the "fishing rod cast" variant).

### Enchantability

Fishing rods do not override `getEnchantmentValue()`, returning 0 from the base class.

## Complete Tool ID Registry

| ID | Item | Class | Tier |
|----|------|-------|------|
| 256 | Iron Shovel | ShovelItem | Iron |
| 257 | Iron Pickaxe | PickaxeItem | Iron |
| 258 | Iron Axe | HatchetItem | Iron |
| 267 | Iron Sword | WeaponItem | Iron |
| 268 | Wood Sword | WeaponItem | Wood |
| 269 | Wood Shovel | ShovelItem | Wood |
| 270 | Wood Pickaxe | PickaxeItem | Wood |
| 271 | Wood Axe | HatchetItem | Wood |
| 272 | Stone Sword | WeaponItem | Stone |
| 273 | Stone Shovel | ShovelItem | Stone |
| 274 | Stone Pickaxe | PickaxeItem | Stone |
| 275 | Stone Axe | HatchetItem | Stone |
| 276 | Diamond Sword | WeaponItem | Diamond |
| 277 | Diamond Shovel | ShovelItem | Diamond |
| 278 | Diamond Pickaxe | PickaxeItem | Diamond |
| 279 | Diamond Axe | HatchetItem | Diamond |
| 283 | Gold Sword | WeaponItem | Gold |
| 284 | Gold Shovel | ShovelItem | Gold |
| 285 | Gold Pickaxe | PickaxeItem | Gold |
| 286 | Gold Axe | HatchetItem | Gold |
| 290 | Wood Hoe | HoeItem | Wood |
| 291 | Stone Hoe | HoeItem | Stone |
| 292 | Iron Hoe | HoeItem | Iron |
| 293 | Diamond Hoe | HoeItem | Diamond |
| 294 | Gold Hoe | HoeItem | Gold |
| 346 | Fishing Rod | FishingRodItem | -- |
| 359 | Shears | ShearsItem | -- |

## MinecraftConsoles differences

The tool and weapon system is basically the same between LCEMP and MinecraftConsoles. No new tool tiers, no new tool types. The `Tier` values, durability costs, diggable tile lists, and mining level requirements are all identical.

The only real change is a naming thing: `ShearsItem` gains a `canHarvest` check for some new blocks (like stained glass panes if they exist in tile form), but the core shears behavior is the same.
