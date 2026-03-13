---
title: Tools & Weapons
description: Swords, pickaxes, axes, shovels, hoes, shears, and fishing rods — tier system, diggable tiles, damage values, and durability.
---

Tools and weapons are the primary interactive items in LCE. They share a common **Tier** system that defines durability, mining speed, attack damage, and enchantability.

## Tool Tiers

**Defined in:** `Item::Tier` (nested class in `Item.h`)

Each tier defines mining level, durability, mining speed, attack damage bonus, and enchantability.

```cpp
const Tier *WOOD    = new Tier(0,   59, 2.0f, 0, 15);
const Tier *STONE   = new Tier(1,  131, 4.0f, 1,  5);
const Tier *IRON    = new Tier(2,  250, 6.0f, 2, 14);
const Tier *DIAMOND = new Tier(3, 1561, 8.0f, 3, 10);
const Tier *GOLD    = new Tier(0,   32, 12.0f, 0, 22);
```

| Tier | Level | Durability | Speed | Damage Bonus | Enchantability | Repair Item |
|------|-------|-----------|-------|-------------|----------------|-------------|
| Wood | 0 | 59 | 2.0 | +0 | 15 | Planks (`Tile::wood`) |
| Stone | 1 | 131 | 4.0 | +1 | 5 | Cobblestone (`Tile::stoneBrick`) |
| Iron | 2 | 250 | 6.0 | +2 | 14 | Iron Ingot (265) |
| Diamond | 3 | 1561 | 8.0 | +3 | 10 | Diamond (264) |
| Gold | 0 | 32 | 12.0 | +0 | 22 | Gold Ingot (266) |

Gold has the highest mining speed (12.0) and enchantability (22) but the lowest durability (32) and mining level (0, same as Wood).

## WeaponItem (Swords)

**Files:** `Minecraft.World/WeaponItem.h`, `Minecraft.World/WeaponItem.cpp`

Swords have a base damage of **4 + tier damage bonus**. They use `UseAnim_block` for blocking, with a maximum block duration of one hour (72,000 ticks). Swords cut cobwebs at speed 15.0 and all other blocks at 1.5.

| Sword | ID | Total Damage | Durability |
|-------|----|-------------|------------|
| Wood | 268 | 4 (4+0) | 59 |
| Stone | 272 | 5 (4+1) | 131 |
| Iron | 267 | 6 (4+2) | 250 |
| Diamond | 276 | 7 (4+3) | 1561 |
| Gold | 283 | 4 (4+0) | 32 |

**Durability costs:**
- **1 per hit** on an enemy
- **2 per block mined** (only if block has nonzero destroy speed)

**Blocking:** Right-click activates `UseAnim_block`. While blocking, damage is reduced. The maximum use duration is `20 * 60 * 60` ticks (one hour), though in practice the player releases the button.

## DiggerItem (Base Mining Tool)

**Files:** `Minecraft.World/DiggerItem.h`, `Minecraft.World/DiggerItem.cpp`

Base class for pickaxes, shovels, and axes. Each subclass defines a list of "diggable" tiles that receive the tier's speed bonus. The attack damage is `baseAttackDamage + tier.getAttackDamageBonus()`.

**Durability costs:**
- **2 per hit** on an enemy
- **1 per block mined** (only if block has nonzero destroy speed)

### PickaxeItem

**Files:** `Minecraft.World/PickaxeItem.h`, `Minecraft.World/PickaxeItem.cpp`

Base attack damage parameter: **2** (total = 2 + tier bonus).

**Diggable tiles (22):** Stone Brick, Stone Slab, Stone Slab Half, Rock, Sandstone, Mossy Cobblestone, Iron Ore, Iron Block, Coal Ore, Gold Block, Gold Ore, Diamond Ore, Diamond Block, Ice, Netherrack, Lapis Ore, Lapis Block, Redstone Ore, Lit Redstone Ore, Rail, Detector Rail, Golden Rail.

Also gets speed bonus on any tile with `Material::metal`, `Material::heavyMetal`, or `Material::stone`.

**Mining level requirements:**

| Block | Min Tier Level |
|-------|---------------|
| Obsidian | 3 (Diamond only) |
| Diamond Ore/Block | 2 (Iron+) |
| Emerald Ore/Block | 2 (Iron+) |
| Gold Ore/Block | 2 (Iron+) |
| Redstone Ore | 2 (Iron+) |
| Iron Ore/Block | 1 (Stone+) |
| Lapis Ore/Block | 1 (Stone+) |
| Any stone material | 0 (Any pickaxe) |
| Any metal/heavy metal | 0 (Any pickaxe) |

### ShovelItem

**Files:** `Minecraft.World/ShovelItem.h`, `Minecraft.World/ShovelItem.cpp`

Base attack damage parameter: **1** (total = 1 + tier bonus).

**Diggable tiles (10):** Grass, Dirt, Sand, Gravel, Top Snow, Snow, Clay, Farmland, Soul Sand, Mycelium.

Can harvest Top Snow and Snow blocks (via `canDestroySpecial`).

### HatchetItem (Axe)

**Files:** `Minecraft.World/HatchetItem.h`, `Minecraft.World/HatchetItem.cpp`

Base attack damage parameter: **3** (total = 3 + tier bonus).

**Diggable tiles (8):** Planks, Bookshelf, Logs, Chest, Stone Slab, Stone Slab Half, Pumpkin, Lit Pumpkin.

Also gets speed bonus on any tile with `Material::wood`.

## HoeItem

**Files:** `Minecraft.World/HoeItem.h`, `Minecraft.World/HoeItem.cpp`

Hoes convert grass and dirt blocks to farmland when used on them (face != 0, air above). They do not have a diggable tile list since they are not mining tools. Durability is set to the tier's uses, and **1 durability** is consumed per use.

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

Shears provide speed bonuses and special harvesting for specific block types:

| Tile | Destroy Speed | Can Harvest (drops block) |
|------|--------------|--------------------------|
| Cobweb | 15.0 | Yes |
| Leaves | 15.0 | No (normal drop table) |
| Wool | 5.0 | No (normal drop table) |
| Redstone Dust | 1.0 | Yes |
| Tripwire | 1.0 | Yes |

Consumes **1 durability** when mining leaves, cobweb, tall grass, vines, or tripwire. Other blocks use the default `Item::mineBlock` behavior.

## FishingRodItem

**Files:** `Minecraft.World/FishingRodItem.h`, `Minecraft.World/FishingRodItem.cpp`

| Property | Value |
|----------|-------|
| ID | 346 |
| Max Durability | 64 |
| Stack Size | 1 |
| Hand Equipped | Yes |
| Mirrored Art | Yes |

Right-click toggles between casting and reeling. When cast, creates a `FishingHook` entity. When reeled, calls `FishingHook::retrieve()` and applies durability damage equal to the return value.

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
