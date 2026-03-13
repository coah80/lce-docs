---
title: Entity Type Registry
description: Complete table of all entity type IDs in LCE.
---

Entity types are registered in `EntityIO::staticCtor()` in
[`Minecraft.World/EntityIO.cpp`](/lce-docs/reference/file-index/). Each call to
`EntityIO::setId()` maps a factory function, an internal enum value (`eINSTANCEOF`),
a string identifier, and a numeric ID.

Entities that can be spawned in Creative mode through the Monster Placer (Spawn Egg) also
include egg colors and a name string ID.

## Entity ID Table

| ID | String ID | Enum | Class | Category |
|----|----------|------|-------|----------|
| 1 | `Item` | `eTYPE_ITEMENTITY` | `ItemEntity` | Item |
| 2 | `XPOrb` | `eTYPE_EXPERIENCEORB` | `ExperienceOrb` | Item |
| 9 | `Painting` | `eTYPE_PAINTING` | `Painting` | Hanging |
| 10 | `Arrow` | `eTYPE_ARROW` | `Arrow` | Projectile |
| 11 | `Snowball` | `eTYPE_SNOWBALL` | `Snowball` | Projectile |
| 12 | `Fireball` | `eTYPE_FIREBALL` | `Fireball` | Projectile |
| 13 | `SmallFireball` | `eTYPE_SMALL_FIREBALL` | `SmallFireball` | Projectile |
| 14 | `ThrownEnderpearl` | `eTYPE_THROWNENDERPEARL` | `ThrownEnderpearl` | Projectile |
| 15 | `EyeOfEnderSignal` | `eTYPE_EYEOFENDERSIGNAL` | `EyeOfEnderSignal` | Projectile |
| 16 | `ThrownPotion` | `eTYPE_THROWNPOTION` | `ThrownPotion` | Projectile |
| 17 | `ThrownExpBottle` | `eTYPE_THROWNEXPBOTTLE` | `ThrownExpBottle` | Projectile |
| 18 | `ItemFrame` | `eTYPE_ITEM_FRAME` | `ItemFrame` | Hanging |
| 20 | `PrimedTnt` | `eTYPE_PRIMEDTNT` | `PrimedTnt` | Block |
| 21 | `FallingSand` | `eTYPE_FALLINGTILE` | `FallingTile` | Block |
| 40 | `Minecart` | `eTYPE_MINECART` | `Minecart` | Vehicle |
| 41 | `Boat` | `eTYPE_BOAT` | `Boat` | Vehicle |
| 48 | `Mob` | `eTYPE_MOB` | `Mob` | Mob (base) |
| 49 | `Monster` | `eTYPE_MONSTER` | `Monster` | Mob (base) |
| 50 | `Creeper` | `eTYPE_CREEPER` | `Creeper` | Hostile Mob |
| 51 | `Skeleton` | `eTYPE_SKELETON` | `Skeleton` | Hostile Mob |
| 52 | `Spider` | `eTYPE_SPIDER` | `Spider` | Hostile Mob |
| 53 | `Giant` | `eTYPE_GIANT` | `Giant` | Hostile Mob |
| 54 | `Zombie` | `eTYPE_ZOMBIE` | `Zombie` | Hostile Mob |
| 55 | `Slime` | `eTYPE_SLIME` | `Slime` | Hostile Mob |
| 56 | `Ghast` | `eTYPE_GHAST` | `Ghast` | Hostile Mob |
| 57 | `PigZombie` | `eTYPE_PIGZOMBIE` | `PigZombie` | Hostile Mob |
| 58 | `Enderman` | `eTYPE_ENDERMAN` | `EnderMan` | Hostile Mob |
| 59 | `CaveSpider` | `eTYPE_CAVESPIDER` | `CaveSpider` | Hostile Mob |
| 60 | `Silverfish` | `eTYPE_SILVERFISH` | `Silverfish` | Hostile Mob |
| 61 | `Blaze` | `eTYPE_BLAZE` | `Blaze` | Hostile Mob |
| 62 | `LavaSlime` | `eTYPE_LAVASLIME` | `LavaSlime` | Hostile Mob |
| 63 | `EnderDragon` | `eTYPE_ENDERDRAGON` | `EnderDragon` | Boss |
| 90 | `Pig` | `eTYPE_PIG` | `Pig` | Passive Mob |
| 91 | `Sheep` | `eTYPE_SHEEP` | `Sheep` | Passive Mob |
| 92 | `Cow` | `eTYPE_COW` | `Cow` | Passive Mob |
| 93 | `Chicken` | `eTYPE_CHICKEN` | `Chicken` | Passive Mob |
| 94 | `Squid` | `eTYPE_SQUID` | `Squid` | Passive Mob |
| 95 | `Wolf` | `eTYPE_WOLF` | `Wolf` | Passive Mob |
| 96 | `MushroomCow` | `eTYPE_MUSHROOMCOW` | `MushroomCow` | Passive Mob |
| 97 | `SnowMan` | `eTYPE_SNOWMAN` | `SnowMan` | Utility Mob |
| 98 | `Ozelot` | `eTYPE_OZELOT` | `Ozelot` | Passive Mob |
| 99 | `VillagerGolem` | `eTYPE_VILLAGERGOLEM` | `VillagerGolem` | Utility Mob |
| 120 | `Villager` | `eTYPE_VILLAGER` | `Villager` | Passive Mob |
| 200 | `EnderCrystal` | `eTYPE_ENDER_CRYSTAL` | `EnderCrystal` | Block |
| 1000 | `DragonFireball` | `eTYPE_DRAGON_FIREBALL` | `DragonFireball` | Projectile |

:::note
IDs 3-8, 19, 22-39, 42-47, 64-89, 100-119, 121-199, 201-999 are unassigned.
The base types `Mob` (48) and `Monster` (49) are registered but act as generic
fallbacks; specific mob types override them.
:::

## Spawnable Entities (Spawn Eggs)

These entities can be spawned with the Monster Placer item (ID 383) using the
entity ID as the data value. They're the entities registered with the
`SpawnableMobInfo` overload of `setId()`:

| Entity ID | Name | Egg Colors |
|-----------|------|-----------|
| 50 | Creeper | Creeper color pair |
| 51 | Skeleton | Skeleton color pair |
| 52 | Spider | Spider color pair |
| 54 | Zombie | Zombie color pair |
| 55 | Slime | Slime color pair |
| 56 | Ghast | Ghast color pair |
| 57 | PigZombie | PigZombie color pair |
| 58 | Enderman | Enderman color pair |
| 59 | CaveSpider | CaveSpider color pair |
| 60 | Silverfish | Silverfish color pair |
| 61 | Blaze | Blaze color pair |
| 62 | LavaSlime | LavaSlime color pair |
| 90 | Pig | Pig color pair |
| 91 | Sheep | Sheep color pair |
| 92 | Cow | Cow color pair |
| 93 | Chicken | Chicken color pair |
| 94 | Squid | Squid color pair |
| 95 | Wolf | Wolf color pair |
| 96 | MushroomCow | MushroomCow color pair |
| 98 | Ozelot | Ocelot color pair |
| 120 | Villager | Villager color pair |

:::note
Giant (53), EnderDragon (63), SnowMan (97), and VillagerGolem (99) are registered
entities but do **not** have spawn eggs.
:::

## ID Ranges

The entity ID space follows Minecraft's standard conventions:

| Range | Category |
|-------|---------|
| 1-2 | Dropped items and XP orbs |
| 9-18 | Paintings, projectiles, item frames |
| 20-21 | Physics blocks (TNT, falling sand) |
| 40-41 | Vehicles (minecart, boat) |
| 48-63 | Hostile mobs (and base mob types) |
| 90-99 | Passive and utility mobs |
| 120 | Villager |
| 200 | Ender Crystal |
| 1000 | Dragon Fireball |

## Source Reference

- Entity registration in: `Minecraft.World/EntityIO.cpp`, `EntityIO::staticCtor()` (line 42)
- Entity enum declarations: `eINSTANCEOF` enum (referenced throughout entity headers)
