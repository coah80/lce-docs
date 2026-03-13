---
title: Custom Loot & Drops
description: How mob drops, block drops, fortune, looting, and silk touch work in LCEMP.
---

This guide covers how items get dropped in LCEMP, both from mobs dying and blocks being broken. We'll look at the actual drop systems and show you how to add your own custom loot.

## How Mob Drops Work

When a mob dies, `Mob::die()` in `Minecraft.World/Mob.cpp` handles the whole loot pipeline. Here's the real code:

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

### Real Examples from the Source

Here's how Chicken handles its drops, including the cooked-if-on-fire logic:

```cpp
void Chicken::dropDeathLoot(bool wasKilledByPlayer, int playerBonusLevel)
{
    // drop some feathers
    int count = random->nextInt(3) + random->nextInt(1 + playerBonusLevel);
    for (int i = 0; i < count; i++)
    {
        spawnAtLocation(Item::feather_Id, 1);
    }
    // and some meat
    if (this->isOnFire())
    {
        spawnAtLocation(Item::chicken_cooked_Id, 1);
    }
    else
    {
        spawnAtLocation(Item::chicken_raw_Id, 1);
    }
}
```

Skeleton drops both arrows and bones, each with looting bonus:

```cpp
void Skeleton::dropDeathLoot(bool wasKilledByPlayer, int playerBonusLevel)
{
    // drop some arrows
    int count = random->nextInt(3 + playerBonusLevel);
    for (int i = 0; i < count; i++)
    {
        spawnAtLocation(Item::arrow->id, 1);
    }
    // and some bones
    count = random->nextInt(3 + playerBonusLevel);
    for (int i = 0; i < count; i++)
    {
        spawnAtLocation(Item::bone->id, 1);
    }
}
```

Blaze has a player-only drop gate and also drops extra glowstone dust (a 4J addition for console's limited Nether):

```cpp
void Blaze::dropDeathLoot(bool wasKilledByPlayer, int playerBonusLevel)
{
    if (wasKilledByPlayer)
    {
        int count = random->nextInt(2 + playerBonusLevel);
        for (int i = 0; i < count; i++)
        {
            spawnAtLocation(Item::blazeRod_Id, 1);
        }
        // 4J added - extra glowstone due to limited Nether size
        count = random->nextInt(3 + playerBonusLevel);
        for (int i = 0; i < count; i++)
        {
            spawnAtLocation(Item::yellowDust_Id, 1);
        }
    }
}
```

### Rare Death Loot

Rare drops trigger about 2.5% of the time when killed by a player. Zombie's rare drops include iron ingots, carrots, and potatoes:

```cpp
void Zombie::dropRareDeathLoot(int rareLootLevel)
{
    switch (random->nextInt(3))
    {
    case 0:
        spawnAtLocation(Item::ironIngot_Id, 1);
        break;
    case 1:
        spawnAtLocation(Item::carrots_Id, 1);
        break;
    case 2:
        spawnAtLocation(Item::potato_Id, 1);
        break;
    }
}
```

Skeleton's rare drop gives an enchanted bow if looting quality is above 0:

```cpp
void Skeleton::dropRareDeathLoot(int rareLootLevel)
{
    if (rareLootLevel > 0)
    {
        shared_ptr<ItemInstance> bow(new ItemInstance(Item::bow));
        EnchantmentHelper::enchantItem(random, bow, 5);
        spawnAtLocation(bow, 0);
    }
    else
    {
        spawnAtLocation(Item::bow_Id, 1);
    }
}
```

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

### Special Cases: Sheep

Sheep has a unique drop system. Unsheared sheep drop 1 wool block of their color. Sheared sheep drop nothing:

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

The `getColor()` return value becomes the aux/data value of the wool item, so the dropped wool matches the sheep's color.

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

- **Glass** returns `true` for `isSilkTouchable()` (normally drops nothing).
- **Leaves** return the leaf block with the correct type mask: `new ItemInstance(id, 1, data & LEAF_TYPE_MASK)`.
- **Ender Chests** support silk touch, dropping the full block instead of obsidian.
- **Ice** has special handling to avoid placing water when silk-touched.
- Most cube-shaped, non-entity tiles are silk-touchable by default.

### Fortune (Digging Loot Bonus)

Fortune is read through `EnchantmentHelper::getDiggingLootBonus()`:

```cpp
int EnchantmentHelper::getDiggingLootBonus(shared_ptr<Inventory> inventory)
{
    return getEnchantmentLevel(Enchantment::resourceBonus->id,
                               inventory->getSelected());
}
```

Ores override `getResourceCountForLootBonus()` to multiply drops with Fortune. Here's the real ore logic:

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

- `Minecraft.World/Mob.cpp` for the base `die()` and `dropDeathLoot()` pipeline
- `Minecraft.World/Tile.cpp` for `playerDestroy()`, `spawnResources()`, and silk touch
- `Minecraft.World/OreTile.cpp` for fortune logic and ore XP
- `Minecraft.World/LeafTile.cpp` for leaf drop chances and shears behavior
- `Minecraft.World/CropTile.cpp` for growth-based crop drops
- `Minecraft.World/EnchantmentHelper.cpp` for looting, fortune, and silk touch checks
