---
title: "Overview & Differences"
description: "How MinecraftConsoles differs from LCEMP."
---

MinecraftConsoles is a community fork of the Legacy Console Edition source code maintained by **smartcmd** and contributors. It builds on the same TU19 (v1.6.0560.0) codebase that LCEMP uses, and credits LCEMP for its multiplayer networking implementation. Where LCEMP focuses on preserving and documenting the original 4J Studios code, MinecraftConsoles pushes the project forward with modern tooling, new gameplay systems, and a broader feature set.

## At a glance

| | **LCEMP** | **MinecraftConsoles** |
|---|---|---|
| Source files | ~2,959 | ~3,968 |
| C++ standard | C++11 | C++17 |
| Commits | — | 409+ |
| CI | — | GitHub Actions (build, debug-test, nightly) |
| Build system | Visual Studio solution | Visual Studio solution + CMake |
| Platform | Windows | Windows (Linux via Wine unofficial) |

## New systems

MinecraftConsoles adds a significant number of gameplay systems that are not present in LCEMP. Each system is documented on its own page.

### Entity attributes and combat

A full [attribute system](/lcemp-docs/mc/attributes/) with modifier operations (`ADDITION`, `MULTIPLY_BASE`, `MULTIPLY_TOTAL`), shared monster attributes (max health, follow range, knockback resistance, movement speed, attack damage), and a combat tracker that records damage entries and generates death messages. Seven attribute types and twelve named modifier IDs are defined.

### Scoreboard and teams

A complete [scoreboard system](/lcemp-docs/mc/scoreboard/) with objectives, criteria (`dummy`, `deathCount`, `playerKillCount`, `totalKillCount`, `health`), player scores, display slots (list, sidebar, below-name), and player teams with friendly-fire and invisibility options. Includes a `ServerScoreboard` subclass that tracks objectives and sends packets to clients.

### Horse entities

Full [horse entities](/lcemp-docs/mc/horses/) with five types (horse, donkey, mule, zombie, skeleton), seven coat variants, five markings, four armor tiers (none, iron, gold, diamond), saddle and chest support, breeding, taming, jump strength attribute, and a dedicated inventory menu. Layered texture rendering combines variant, marking, and armor textures.

### Minecart variants

Multiple minecart subtypes beyond the base rideable minecart:

- **MinecartChest** -- chest storage on rails
- **MinecartFurnace** -- self-propelled furnace cart
- **MinecartHopper** -- item collection on rails with cooldown and enable/disable via activator rail
- **MinecartTNT** -- explosive cart with fuse, priming, and blast resistance checks
- **MinecartSpawner** -- mob spawner on rails with its own `BaseMobSpawner` instance

### Hoppers and dispensers

The `HopperTileEntity` implements item transfer logic with cooldown timing, item ejection, item suction from above, and container-to-container moves. The `DispenseItemBehavior` system provides a registry (`BehaviorRegistry`) mapping items to custom dispense actions.

### Fireworks

A fireworks system including `FireworksRocketEntity` (projectile with lifetime), `FireworksItem` (placement and hover text), `FireworksChargeItem`, `FireworksRecipe` (crafting), `FireworksMenu` (UI), and `FireworksParticles` (client-side rendering). Explosion types include small, big, star, creeper, and burst.

### Redstone

A `Redstone` constants class defining signal range (`SIGNAL_NONE = 0`, `SIGNAL_MIN = 0`, `SIGNAL_MAX = 15`).

### Wither Boss

`WitherBoss` entity implementing `Monster`, `RangedAttackMob`, and `BossMob` interfaces, with multi-head targeting (three heads), invulnerability phase, block destruction, ranged skull attacks, and boss health bar.

### Behavior and dispense registry

A `Behavior` base class and `BehaviorRegistry` that maps `Item` pointers to `DispenseItemBehavior` instances, with a `DefaultDispenseItemBehavior` fallback (drops items as pickups). Used by the `DispenserBootstrap` to register item-specific dispense actions at startup.
