---
title: Items
description: Complete documentation of the LCEMP item system.
---

The item system in LCE is built around the `Item` base class. Every non-block item gets a numeric ID starting at **256** (the constructor adds +256 internally). The global registry can hold up to **32,000** slots.

For the full architecture (base class, ItemInstance, registration system, class hierarchy, crafting menu enums), head over to the **[Item System Overview](/lcemp-docs/world/items/overview/)**.

## Item Categories

| Category | Description |
|----------|-------------|
| [Item System Overview](/lcemp-docs/world/items/overview/) | Base Item class, ItemInstance, registration, ID offset, class hierarchy, eMaterial/eBaseItemType enums |
| [Tools & Weapons](/lcemp-docs/world/items/tools/) | Swords, pickaxes, axes, shovels, hoes, shears, fishing rod. Tool tiers, durability, speed, damage |
| [Armor](/lcemp-docs/world/items/armor/) | All armor materials, defense values, durability, slots, leather dyeing |
| [Food](/lcemp-docs/world/items/food/) | Nutrition, saturation, exhaustion, all food types, golden apples, seed foods |
| [Combat Items](/lcemp-docs/world/items/combat/) | Bow, arrows, snowballs, ender pearls, fire charges, potions, brewing ingredients |
| [Music Discs](/lcemp-docs/world/items/music-discs/) | All disc IDs, RecordingItem internals, jukebox interaction |
| [Decorative & Placement](/lcemp-docs/world/items/decorative/) | Paintings, item frames, signs, buckets, dyes, maps, books, beds, doors, minecarts |
| [Raw Materials](/lcemp-docs/world/items/materials/) | Ingots, diamonds, redstone, glowstone dust, string, leather, crafting ingredients, seeds |
| [Special Items](/lcemp-docs/world/items/special/) | Spawn eggs (MonsterPlacerItem), enchanted books, maps, compass, clock |

## Complete Item ID Registry

For a quick reference of all item IDs, see the [Item ID Registry](/lcemp-docs/reference/item-ids/) in the Reference section.
