---
title: Custom Loot & Drops
description: How mob drops, block drops, fortune, looting, and silk touch work in LCE.
---

This guide covers how items get dropped in LCE, both from mobs dying and blocks being broken. We will look at the actual drop systems, every mob's drops, and show you how to add your own custom loot.

## How Mob Drops Work

When a mob dies, `Mob::die()` in `Minecraft.World/Mob.cpp` handles the whole loot pipeline. Here is the real code:

```cpp
void Mob::die(DamageSource *source)
{
    // ... scoring and kill tracking ...

    dead = true;

    if (!level->isClientSide)
    {
        int playerBonus = 0;
        shared_ptr<Player> player = dynamic_pointer_cast<Player>(sourceEntity);
        if (player != NULL)
        {
            playerBonus = EnchantmentHelper::getKillingLootBonus(player->inventory);
        }
        if (!isBaby())
        {
            dropDeathLoot(lastHurtByPlayerTime > 0, playerBonus);
            if (lastHurtByPlayerTime > 0)
            {
                int rareLoot = random->nextInt(200) - playerBonus;
                if (rareLoot < 5)
                {
                    dropRareDeathLoot((rareLoot <= 0) ? 1 : 0);
                }
            }
        }
    }

    level->broadcastEntityEvent(shared_from_this(), EntityEvent::DEATH);
}
```

There are a few important things happening here:

1. **Looting enchantment** is read from the player's held weapon via `getKillingLootBonus()`. This gets passed as `playerBonus` to the drop functions.
2. **Baby mobs never drop loot.** The `isBaby()` check gates everything.
3. **Regular drops** happen through `dropDeathLoot()`, which gets a bool for whether a player was involved and the looting bonus level.
4. **Rare drops** have a 2.5% base chance (5 out of 200). Looting increases this by subtracting from the random roll, so each looting level adds another 0.5% chance.
5. All of this only runs server-side (`!level->isClientSide`).

### The Three Drop Methods

Every mob has three virtual methods that control what it drops:

| Method | Purpose |
|--------|---------|
| `getDeathLoot()` | Returns a single item ID. Used as the fallback drop. |
| `dropDeathLoot(bool, int)` | Main drop logic. Override this for custom drop tables. |
| `dropRareDeathLoot(int)` | Rare/special drops. The int param is the looting quality level. |

## Every Mob's Drops

Here is every mob in the codebase and exactly what it drops, pulled straight from the source files.

### Passive Mobs

#### Cow

**File:** `Cow.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Leather | 0-2 | +1 per level | Base `random->nextInt(3)` |
| Raw Beef | 1-3 | +1 per level | Base `1 + random->nextInt(3)` |
| Cooked Beef | 1-3 | +1 per level | Drops instead of raw beef if on fire |

#### Pig

**File:** `Pig.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Raw Porkchop | 1-3 | +1 per level | Base `1 + random->nextInt(3)` |
| Cooked Porkchop | 1-3 | +1 per level | Drops instead of raw if on fire |
| Saddle | 1 | No | Only if the pig was saddled |

#### Chicken

**File:** `Chicken.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Feather | 0-2 | +1 per level | Base `random->nextInt(3) + random->nextInt(1 + playerBonusLevel)` |
| Raw Chicken | 1 | No | Always 1 |
| Cooked Chicken | 1 | No | Drops instead of raw if on fire |

#### Sheep

**File:** `Sheep.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Wool | 1 | No | Only if NOT sheared. Aux value matches sheep color. |
| (nothing) | 0 | No | If sheared, drops nothing on death |

Sheep are unique. Unsheared sheep drop 1 wool block matching their color. Sheared sheep drop nothing:

```cpp
void Sheep::dropDeathLoot(bool wasKilledByPlayer, int playerBonusLevel)
{
    if (!isSheared())
    {
        spawnAtLocation(shared_ptr<ItemInstance>(
            new ItemInstance(Tile::cloth_Id, 1, getColor())), 0.0f);
    }
}
```

#### Squid

**File:** `Squid.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Ink Sac | 1-3 | +1 per level | Base `1 + random->nextInt(3)` |

#### Wolf

**File:** `Wolf.cpp`

| Drop | Count | Notes |
|------|-------|-------|
| (nothing) | 0 | `getDeathLoot()` returns -1 |

#### Ocelot

**File:** `Ozelot.cpp`

| Drop | Count | Notes |
|------|-------|-------|
| (nothing) | 0 | `dropDeathLoot()` is empty |

#### Snow Golem

**File:** `SnowMan.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Snowball | 0-15 | No | Base `random->nextInt(16)` |

#### Iron Golem

**File:** `VillagerGolem.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Rose | 0-2 | No | Base `random->nextInt(3)` |
| Iron Ingot | 3-5 | No | Base `3 + random->nextInt(3)` |

### Hostile Mobs

#### Zombie

**File:** `Zombie.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Rotten Flesh | (base Mob) | Yes | Uses `getDeathLoot()` which returns rotten flesh |

**Rare drops** (2.5% base, player-kill only):

| Drop | Chance |
|------|--------|
| Iron Ingot | 1/3 of rare drops |
| Carrot | 1/3 of rare drops |
| Potato | 1/3 of rare drops |

The source has commented-out rare drops for iron sword, iron helmet, and iron shovel. These were removed.

#### Skeleton

**File:** `Skeleton.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Arrow | 0-2 | +1 per level | Base `random->nextInt(3 + playerBonusLevel)` |
| Bone | 0-2 | +1 per level | Base `random->nextInt(3 + playerBonusLevel)` |

**Rare drops:**

| Drop | Condition |
|------|-----------|
| Enchanted Bow | If `rareLootLevel > 0` (looting helped). Enchanted at level 5. |
| Plain Bow | If `rareLootLevel == 0` (no looting boost) |

#### Creeper

**File:** `Creeper.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Gunpowder | (base Mob) | Yes | Uses `getDeathLoot()` which returns sulphur (gunpowder) |

#### Spider

**File:** `Spider.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| String | (base Mob) | Yes | Uses `getDeathLoot()` which returns string |
| Spider Eye | 0-1 | Looting bonus | 33% chance OR if looting bonus roll succeeds. Player-kill only. |

The spider eye logic checks: `if (wasKilledByPlayer && (random->nextInt(3) == 0 || random->nextInt(1 + playerBonusLevel) > 0))`.

#### Enderman

**File:** `EnderMan.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Ender Pearl | 0-1 | +1 per level | Base `random->nextInt(2 + playerBonusLevel)` |

#### Slime

**File:** `Slime.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Slimeball | 0-2 | No | Only from smallest size (size 1). Base `random->nextInt(3)`. |
| (nothing) | 0 | No | Larger slimes drop nothing (they split into smaller slimes) |

#### Ghast

**File:** `Ghast.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Ghast Tear | 0-1 | +1 per level | Base `random->nextInt(2 + playerBonusLevel)` |
| Gunpowder | 0-2 | +1 per level | Base `random->nextInt(3 + playerBonusLevel)` |

#### Blaze

**File:** `Blaze.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Blaze Rod | 0-1 | +1 per level | Player-kill only. Base `random->nextInt(2 + playerBonusLevel)`. |
| Glowstone Dust | 0-2 | +1 per level | Player-kill only. 4J console addition. Base `random->nextInt(3 + playerBonusLevel)`. |

:::note
The glowstone dust drop is a 4J addition for console. Java Edition blazes do not drop glowstone. This was added because the Nether is smaller on console and glowstone is harder to farm.
:::

#### Magma Cube (LavaSlime)

**File:** `LavaSlime.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Magma Cream | 0-1 | +looting | Only from size > 1. Base `random->nextInt(4) - 2` (gives -2 to 1, negative means 0). With looting: adds `random->nextInt(playerBonusLevel + 1)`. |
| (nothing) | 0 | No | Smallest size drops nothing |

#### Zombie Pigman (PigZombie)

**File:** `PigZombie.cpp`

| Drop | Count | Looting | Notes |
|------|-------|---------|-------|
| Rotten Flesh | 0-1 | +1 per level | Base `random->nextInt(2 + playerBonusLevel)` |
| Gold Nugget | 0-1 | +1 per level | Base `random->nextInt(2 + playerBonusLevel)` |

**Rare drops:**

| Drop | Condition |
|------|-----------|
| Enchanted Gold Sword | If `rareLootLevel > 0`. Enchanted at level 5. |
| Gold Ingot OR Gold Sword OR Gold Helmet | If `rareLootLevel == 0`. Random pick from 3. |

### Mob Drop Summary Table

| Mob | Regular Drops | Rare Drops | Notes |
|-----|--------------|------------|-------|
| Cow | Leather (0-2), Beef (1-3) | None | Cooked if on fire |
| Pig | Porkchop (1-3) | None | Cooked if on fire. Saddle if saddled. |
| Chicken | Feather (0-2), Chicken (1) | None | Cooked if on fire |
| Sheep | Wool (1) or nothing | None | Only unsheared sheep drop wool |
| Squid | Ink Sac (1-3) | None | |
| Wolf | Nothing | None | |
| Ocelot | Nothing | None | |
| Snow Golem | Snowball (0-15) | None | |
| Iron Golem | Rose (0-2), Iron (3-5) | None | |
| Zombie | Rotten Flesh | Iron/Carrot/Potato | |
| Skeleton | Arrow (0-2), Bone (0-2) | Bow (plain or enchanted) | |
| Creeper | Gunpowder | None | |
| Spider | String + Spider Eye | None | Eye is 33% player-kill only |
| Enderman | Ender Pearl (0-1) | None | |
| Slime | Slimeball (0-2) | None | Smallest size only |
| Ghast | Ghast Tear (0-1), Gunpowder (0-2) | None | |
| Blaze | Blaze Rod (0-1), Glowstone (0-2) | None | Player-kill only. Glowstone is console-exclusive. |
| Magma Cube | Magma Cream (0-1) | None | Size > 1 only |
| Zombie Pigman | Rotten Flesh (0-1), Gold Nugget (0-1) | Gold Ingot/Sword/Helmet or Enchanted Gold Sword | |

## How Looting Works

The Looting enchantment is checked through `EnchantmentHelper::getKillingLootBonus()`:

```cpp
int EnchantmentHelper::getKillingLootBonus(shared_ptr<Inventory> inventory)
{
    return getEnchantmentLevel(Enchantment::lootBonus->id, inventory->getSelected());
}
```

This scans the player's held item for the Looting enchantment and returns its level (0-3). Mob drop methods receive this as `playerBonusLevel` and typically use it like `random->nextInt(3 + playerBonusLevel)` to increase drop counts.

For rare drops, the looting level subtracts directly from the random roll, making rare drops more likely. Each looting level effectively adds 0.5% to the base 2.5% chance.

| Looting Level | Rare Drop Chance |
|---|---|
| 0 (none) | 2.5% (5/200) |
| I | 3.0% (6/200) |
| II | 3.5% (7/200) |
| III | 4.0% (8/200) |

## Adding Custom Mob Drops

To give your mob custom drops, override `dropDeathLoot` and optionally `dropRareDeathLoot`:

```cpp
void MyMob::dropDeathLoot(bool wasKilledByPlayer, int playerBonusLevel)
{
    // Always drop 1-3 items, with looting adding more
    int count = 1 + random->nextInt(3 + playerBonusLevel);
    for (int i = 0; i < count; i++)
    {
        spawnAtLocation(Item::diamond_Id, 1);
    }

    // Conditional drop: cooked version if on fire
    if (isOnFire())
    {
        spawnAtLocation(Item::beef_cooked_Id, 1);
    }
    else
    {
        spawnAtLocation(Item::beef_raw_Id, 1);
    }

    // Player-only drop
    if (wasKilledByPlayer)
    {
        spawnAtLocation(Item::expBottle_Id, 1);
    }
}

void MyMob::dropRareDeathLoot(int rareLootLevel)
{
    // rareLootLevel is 1 when looting applies, 0 otherwise
    if (rareLootLevel > 0)
    {
        // Enchanted item drop
        shared_ptr<ItemInstance> sword(new ItemInstance(Item::sword_diamond));
        EnchantmentHelper::enchantItem(random, sword, 10 + random->nextInt(10));
        spawnAtLocation(sword, 0);
    }
    else
    {
        spawnAtLocation(Item::goldIngot_Id, 1);
    }
}
```

## How Block Drops Work

Block drops follow a different pattern. When a player breaks a block, `Tile::playerDestroy()` runs the drop logic:

```cpp
void Tile::playerDestroy(Level *level, shared_ptr<Player> player,
                         int x, int y, int z, int data)
{
    // ... stats tracking ...

    if (isSilkTouchable() && EnchantmentHelper::hasSilkTouch(player->inventory))
    {
        shared_ptr<ItemInstance> item = getSilkTouchItemInstance(data);
        if (item != NULL)
        {
            popResource(level, x, y, z, item);
        }
    }
    else
    {
        int playerBonusLevel = EnchantmentHelper::getDiggingLootBonus(
            player->inventory);
        spawnResources(level, x, y, z, data, playerBonusLevel);
    }
}
```

The flow is:
1. Check for Silk Touch first. If the block supports it, drop the block itself.
2. Otherwise, get the Fortune level and call `spawnResources()`.

### The Block Drop Pipeline

`Tile::spawnResources()` loops over the drop count and spawns items:

```cpp
void Tile::spawnResources(Level *level, int x, int y, int z,
                          int data, float odds, int playerBonusLevel)
{
    if (level->isClientSide) return;
    int count = getResourceCountForLootBonus(playerBonusLevel, level->random);
    for (int i = 0; i < count; i++)
    {
        if (level->random->nextFloat() > odds) continue;
        int type = getResource(data, level->random, playerBonusLevel);
        if (type <= 0) continue;
        popResource(level, x, y, z, shared_ptr<ItemInstance>(
            new ItemInstance(type, 1, getSpawnResourcesAuxValue(data))));
    }
}
```

Key virtual methods for block drops:

| Method | Purpose |
|--------|---------|
| `getResource(data, random, bonus)` | Which item ID to drop |
| `getResourceCount(random)` | Base number of items to drop |
| `getResourceCountForLootBonus(bonus, random)` | Drop count with Fortune applied |
| `getSpawnResourcesAuxValue(data)` | Aux/data value for the dropped item |

### Silk Touch

Silk Touch is checked with `EnchantmentHelper::hasSilkTouch()`:

```cpp
bool EnchantmentHelper::hasSilkTouch(shared_ptr<Inventory> inventory)
{
    return getEnchantmentLevel(Enchantment::untouching->id,
                               inventory->getSelected()) > 0;
}
```

Blocks opt into Silk Touch support by overriding `isSilkTouchable()` and `getSilkTouchItemInstance()`. Some examples:

- **Glass** returns `true` for `isSilkTouchable()` (normally drops nothing)
- **Leaves** return the leaf block with the correct type mask: `new ItemInstance(id, 1, data & LEAF_TYPE_MASK)`
- **Ender Chests** support silk touch, dropping the full block instead of obsidian
- **Ice** has special handling to avoid placing water when silk-touched
- Most cube-shaped, non-entity tiles are silk-touchable by default

### Fortune (Digging Loot Bonus)

Fortune is read through `EnchantmentHelper::getDiggingLootBonus()`:

```cpp
int EnchantmentHelper::getDiggingLootBonus(shared_ptr<Inventory> inventory)
{
    return getEnchantmentLevel(Enchantment::resourceBonus->id,
                               inventory->getSelected());
}
```

Ores override `getResourceCountForLootBonus()` to multiply drops with Fortune. Here is the real ore logic:

```cpp
int OreTile::getResourceCountForLootBonus(int bonusLevel, Random *random)
{
    if (bonusLevel > 0 && id != getResource(0, random, bonusLevel))
    {
        int bonus = random->nextInt(bonusLevel + 2) - 1;
        if (bonus < 0)
        {
            bonus = 0;
        }
        return getResourceCount(random) * (bonus + 1);
    }
    return getResourceCount(random);
}
```

Fortune only applies to ores that drop items different from the block itself (coal, diamond, lapis, emerald, nether quartz). Iron and gold ore drop themselves, so Fortune does nothing to them.

Lapis ore has a special base drop count of 4-8:

```cpp
int OreTile::getResourceCount(Random *random)
{
    if (id == Tile::lapisOre_Id) return 4 + random->nextInt(5);
    return 1;
}
```

### Ore XP Drops

Ores also drop experience when mined (unless silk-touched). The `OreTile::spawnResources()` method handles this after the regular item drop:

```cpp
void OreTile::spawnResources(Level *level, int x, int y, int z,
                             int data, float odds, int playerBonusLevel)
{
    Tile::spawnResources(level, x, y, z, data, odds, playerBonusLevel);

    if (getResource(data, level->random, playerBonusLevel) != id)
    {
        int magicCount = 0;
        if (id == Tile::coalOre_Id)
            magicCount = Mth::nextInt(level->random, 0, 2);
        else if (id == Tile::diamondOre_Id)
            magicCount = Mth::nextInt(level->random, 3, 7);
        else if (id == Tile::emeraldOre_Id)
            magicCount = Mth::nextInt(level->random, 3, 7);
        else if (id == Tile::lapisOre_Id)
            magicCount = Mth::nextInt(level->random, 2, 5);
        else if (id == Tile::netherQuartz_Id)
            magicCount = Mth::nextInt(level->random, 2, 5);
        popExperience(level, x, y, z, magicCount);
    }
}
```

| Ore | XP Drop Range |
|-----|---------------|
| Coal Ore | 0-2 |
| Diamond Ore | 3-7 |
| Emerald Ore | 3-7 |
| Lapis Ore | 2-5 |
| Nether Quartz | 2-5 |
| Iron Ore | 0 (drops itself) |
| Gold Ore | 0 (drops itself) |

### Leaf Drops

Leaves have their own `spawnResources()` override. Oak leaves have a 1/20 chance to drop saplings and a 1/200 chance to drop apples. Jungle leaves have a 1/40 sapling chance:

```cpp
void LeafTile::spawnResources(Level *level, int x, int y, int z,
                              int data, float odds, int playerBonusLevel)
{
    if (!level->isClientSide)
    {
        int chance = 20;
        if ((data & LEAF_TYPE_MASK) == JUNGLE_LEAF)
        {
            chance = 40;
        }
        if (level->random->nextInt(chance) == 0)
        {
            int type = getResource(data, level->random, playerBonusLevel);
            popResource(level, x, y, z, shared_ptr<ItemInstance>(
                new ItemInstance(type, 1, getSpawnResourcesAuxValue(data))));
        }

        if ((data & LEAF_TYPE_MASK) == NORMAL_LEAF
            && level->random->nextInt(200) == 0)
        {
            popResource(level, x, y, z, shared_ptr<ItemInstance>(
                new ItemInstance(Item::apple_Id, 1, 0)));
        }
    }
}
```

Using shears on leaves bypasses this entirely and drops the leaf block itself.

| Leaf Type | Sapling Chance | Apple Chance |
|-----------|---------------|--------------|
| Oak | 1/20 (5%) | 1/200 (0.5%) |
| Spruce | 1/20 (5%) | None |
| Birch | 1/20 (5%) | None |
| Jungle | 1/40 (2.5%) | None |

### Crop Drops

Crops use data values (0-7) to track growth. Only fully grown crops (data 7) drop the plant item. Immature crops drop seeds:

```cpp
int CropTile::getResource(int data, Random *random, int playerBonusLevel)
{
    if (data == 7)
    {
        return getBasePlantId();  // e.g., Item::wheat_Id
    }
    return getBaseSeedId();  // e.g., Item::seeds_wheat_Id
}
```

Fully grown crops also have a chance to drop bonus seeds:

```cpp
void CropTile::spawnResources(Level *level, int x, int y, int z,
                              int data, float odds, int playerBonus)
{
    Bush::spawnResources(level, x, y, z, data, odds, 0);

    if (level->isClientSide) return;
    if (data >= 7)
    {
        int count = 3 + playerBonus;
        for (int i = 0; i < count; i++)
        {
            if (level->random->nextInt(5 * 3) > data) continue;
            popResource(level, x, y, z, shared_ptr<ItemInstance>(
                new ItemInstance(getBaseSeedId(), 1, 0)));
        }
    }
}
```

## Adding Custom Block Drops

To make a custom block with special drop behavior, override the relevant methods in your `Tile` subclass:

```cpp
int MyOreTile::getResource(int data, Random *random, int playerBonusLevel)
{
    // Drop a custom item instead of the block
    return Item::myCustomGem_Id;
}

int MyOreTile::getResourceCount(Random *random)
{
    // Drop 1-3 items
    return 1 + random->nextInt(3);
}

int MyOreTile::getResourceCountForLootBonus(int bonusLevel, Random *random)
{
    // Apply fortune: multiply base count
    if (bonusLevel > 0)
    {
        int bonus = random->nextInt(bonusLevel + 2) - 1;
        if (bonus < 0) bonus = 0;
        return getResourceCount(random) * (bonus + 1);
    }
    return getResourceCount(random);
}

bool MyOreTile::isSilkTouchable()
{
    return true;  // Allow silk touch to get the block itself
}

shared_ptr<ItemInstance> MyOreTile::getSilkTouchItemInstance(int data)
{
    return shared_ptr<ItemInstance>(new ItemInstance(id, 1, 0));
}
```

## Quick Reference

### Mob Drop Chances

| Factor | Effect |
|--------|--------|
| Baby mob | No drops at all |
| Non-player kill | `wasKilledByPlayer` is false, some mobs skip drops |
| Looting I-III | Increases `playerBonusLevel` by 1-3 |
| Rare drop base | 2.5% chance (5/200) |
| Rare drop + Looting | +0.5% per looting level |
| Fire kill | Some mobs drop cooked meat instead of raw |

### Block Drop Enchantments

| Enchantment | Helper Method | Effect |
|-------------|--------------|--------|
| Silk Touch | `hasSilkTouch()` | Drop block itself instead of resource |
| Fortune I-III | `getDiggingLootBonus()` | Multiply resource drop count |
| Shears (item) | Checked manually | Leaves drop leaf block, tall grass drops itself |

### Key Source Files

| File | What it does |
|---|---|
| `Minecraft.World/Mob.cpp` | Base `die()` and `dropDeathLoot()` pipeline |
| `Minecraft.World/Tile.cpp` | `playerDestroy()`, `spawnResources()`, and silk touch |
| `Minecraft.World/OreTile.cpp` | Fortune logic, ore XP drops |
| `Minecraft.World/LeafTile.cpp` | Leaf drop chances and shears behavior |
| `Minecraft.World/CropTile.cpp` | Growth-based crop drops |
| `Minecraft.World/EnchantmentHelper.cpp` | Looting, fortune, and silk touch checks |
| `Minecraft.World/Cow.cpp` | Cow drops (leather + beef) |
| `Minecraft.World/Pig.cpp` | Pig drops (porkchop + saddle) |
| `Minecraft.World/Chicken.cpp` | Chicken drops (feather + chicken) |
| `Minecraft.World/Sheep.cpp` | Sheep drops (colored wool) |
| `Minecraft.World/Skeleton.cpp` | Skeleton drops (arrow + bone + rare bow) |
| `Minecraft.World/Zombie.cpp` | Zombie drops (rotten flesh + rare items) |
| `Minecraft.World/Blaze.cpp` | Blaze drops (blaze rod + glowstone) |
| `Minecraft.World/PigZombie.cpp` | Zombie pigman drops (flesh + gold) |
