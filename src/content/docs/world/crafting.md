---
title: Crafting & Recipes
description: How LCE handles crafting recipes and smelting.
---

The crafting system centers on the `Recipes` singleton (for crafting table and inventory crafting) and the `FurnaceRecipes` singleton (for smelting). Recipes are registered in code using variadic C-style functions, which is quite different from the original Java implementation.

**Key source files:** `Minecraft.World/Recipes.h`, `Minecraft.World/Recipy.h`, `Minecraft.World/ShapedRecipy.h`, `Minecraft.World/ShapelessRecipy.h`, `Minecraft.World/FurnaceRecipes.h`

## Architecture overview

```
Recipy (abstract base)
  |-- ShapedRecipy      (grid-based recipes)
  |-- ShapelessRecipy   (order-independent recipes)

Recipes (singleton)       -- manages all crafting recipes
FurnaceRecipes (singleton) -- manages all smelting recipes
```

Both singletons get set up through `staticCtor()` and accessed with `getInstance()`.

## Recipe groups

4J Studios added a recipe group system for the console crafting UI. Each recipe belongs to one of seven groups:

| Group | Code | Character |
|---|---|---|
| Structure | `eGroupType_Structure` | `'S'` |
| Tool | `eGroupType_Tool` | `'T'` |
| Food | `eGroupType_Food` | `'F'` |
| Armour | `eGroupType_Armour` | `'A'` |
| Mechanism | `eGroupType_Mechanism` | `'M'` |
| Transport | `eGroupType_Transport` | `'V'` |
| Decoration | `eGroupType_Decoration` | `'D'` (default) |

## Recipe types

Recipes also track whether they fit in a 2x2 or 3x3 grid:

| Type | Constant | Description |
|---|---|---|
| 2x2 | `RECIPE_TYPE_2x2` | Can be crafted in the player inventory |
| 3x3 | `RECIPE_TYPE_3x3` | Requires a crafting table |

## Recipy base class

The `Recipy` abstract class defines the interface all recipes must follow:

```cpp
virtual bool matches(shared_ptr<CraftingContainer> craftSlots, Level *level) = 0;
virtual shared_ptr<ItemInstance> assemble(shared_ptr<CraftingContainer> craftSlots) = 0;
virtual int size() = 0;
virtual const ItemInstance *getResultItem() = 0;
virtual const int getGroup() = 0;
```

It also defines an `INGREDIENTS_REQUIRED` struct that 4J's console crafting UI uses to precompute what ingredients each recipe needs, including a per-player `bCanMake` flag and a bitmask of missing grid ingredients.

## Shaped recipes

`ShapedRecipy` stores a 2D grid of `ItemInstance` pointers along with width, height, and the result item.

### Pattern matching

When checking if a `CraftingContainer` matches, shaped recipes:

1. Try every valid offset position `(xOffs, yOffs)` where the recipe fits within the 3x3 grid.
2. At each offset, try both normal and horizontally flipped orientations.
3. Compare each grid cell: items must match by ID, and if the recipe specifies an aux value other than `ANY_AUX_VALUE` (-1), the aux value must also match.

### Tag preservation

The `keepTag()` method lets NBT tags transfer from ingredients to the result. This is used for recipes like Carrot on a Stick, where the fishing rod's durability tag carries over.

## Shapeless recipes

`ShapelessRecipy` stores a list of ingredient `ItemInstance` pointers. Order doesn't matter.

### Pattern matching

1. Copy the ingredient list to a temporary list.
2. Go through every slot in the 3x3 crafting grid.
3. For each item found, search the ingredient list for a match (by ID and optionally aux value).
4. Remove matched ingredients from the temporary list.
5. The recipe matches only if all ingredients were used up and no extra items are left.

## How recipes are registered

### The variadic argument system

4J rewrote the Java recipe registration to use C-style variadic arguments (`va_list`). The second argument after the result item is always a wide-character type string that encodes what comes next:

| Type char | Meaning |
|---|---|
| `s` | `wchar_t *`: a row of the crafting pattern |
| `c` | `wchar_t`: a character key for ingredient mapping |
| `z` | `ItemInstance *`: an item instance mapped to the preceding character |
| `i` | `Item *`: an item mapped to the preceding character |
| `t` | `Tile *`: a tile/block mapped to the preceding character (auto-wrapped with `ANY_AUX_VALUE`) |
| `g` | `wchar_t`: the recipe group character (must be last) |

### Example: enchanting table recipe

```cpp
addShapedRecipy(new ItemInstance(Tile::enchantTable, 1),
    L"sssctcicig",    // 3 strings, char, tile, char, item, char, item, group
    L" B ",           // row 1
    L"D#D",           // row 2
    L"###",           // row 3
    L'#', Tile::obsidian,
    L'B', Item::book,
    L'D', Item::diamond,
    L'S');             // Structure group
```

### Shapeless recipe example

```cpp
addShapelessRecipy(new ItemInstance(Item::eyeOfEnder, 1),
    L"iig",           // 2 items, group
    Item::enderPearl,
    Item::blazePowder,
    L'T');             // Tool group
```

## Recipe sub-managers

Recipe registration is split across seven specialized classes, each with an `addRecipes(Recipes *)` method:

| Class | Responsibility |
|---|---|
| `ToolRecipies` | Pickaxes, axes, shovels, hoes |
| `WeaponRecipies` | Swords, bows, arrows |
| `StructureRecipies` | Building blocks, doors, stairs |
| `OreRecipies` | Ore blocks, ingot-to-block conversions |
| `FoodRecipies` | Food items |
| `ClothDyeRecipes` | Wool and dye combinations |
| `ArmorRecipes` | All armor pieces |

The main `Recipes` constructor calls these sub-managers at specific points to control recipe ordering in the console crafting menu.

## Tool repair

Before checking registered recipes, `Recipes::getItemFor()` has a special case for tool repair: if exactly two items of the same damageable type are in the crafting grid (each with count 1), they combine. The remaining durability is: `remaining1 + remaining2 + 5% of maxDamage`.

## Ingredients array

After all recipes are registered, `buildRecipeIngredientsArray()` goes through every recipe and calls `requires()` to precompute the `INGREDIENTS_REQUIRED` struct for each one. The console crafting UI uses this to quickly figure out which recipes the player can make based on their inventory.

## Furnace recipes

`FurnaceRecipes` is simpler. It maps input item IDs to output `ItemInstance` results and XP values.

### Data structure

```cpp
unordered_map<int, ItemInstance *> recipies;   // input ID -> result
unordered_map<int, float> recipeValue;         // result ID -> XP value
```

### All smelting recipes

| Input | Output | XP value |
|---|---|---|
| Iron Ore | Iron Ingot | 0.7 |
| Gold Ore | Gold Ingot | 1.0 |
| Diamond Ore | Diamond | 1.0 |
| Sand | Glass | 0.1 |
| Raw Porkchop | Cooked Porkchop | 0.35 |
| Raw Beef | Cooked Beef | 0.35 |
| Raw Chicken | Cooked Chicken | 0.35 |
| Raw Fish | Cooked Fish | 0.35 |
| Cobblestone | Stone | 0.1 |
| Clay Ball | Brick | 0.3 |
| Cactus | Green Dye | 0.2 |
| Wood Log | Charcoal | 0.15 |
| Emerald Ore | Emerald | 1.0 |
| Potato | Baked Potato | 0.35 |
| Netherrack | Nether Brick (item) | 0.1 |
| Coal Ore | Coal | 0.1 |
| Redstone Ore | Redstone | 0.7 |
| Lapis Ore | Lapis Lazuli | 0.2 |
| Nether Quartz Ore | Nether Quartz | 0.2 |

The last four entries (Coal Ore, Redstone Ore, Lapis Ore, Nether Quartz Ore) are noted in the source as "special silk touch related recipes." They exist so that silk-touched ore blocks can be smelted.

### API

```cpp
void addFurnaceRecipy(int itemId, ItemInstance *result, float value);
bool isFurnaceItem(int itemId);
ItemInstance *getResult(int itemId);
float getRecipeValue(int itemId);
```

The `FurnaceTileEntity` handles the actual smelting process, checking `FurnaceRecipes::getInstance()->getResult()` to see if an item can be smelted.

## MinecraftConsoles Differences

MC has more recipes than LCE. The crafting system registers about **114 shaped/shapeless recipes** compared to LCE's **100**. The extra recipes cover the new blocks and items that MC adds:

- Beacon, hopper, dropper, comparator, daylight detector, and activator rail crafting recipes
- Hay bale and hardened clay recipes
- Stained glass and stained glass pane dyeing recipes
- Horse armor and lead/leash recipes
- Fireworks and fireworks star recipes (MC adds `FireworksRecipe` as a special recipe class)
- Name tag related recipes
- Map cloning (`MapCloningRecipe`) and map extending (`MapExtendingRecipe`) as separate recipe classes

### New smelting recipe

MC adds one new smelting recipe that LCE doesn't have:

| Input | Output | XP |
|---|---|---|
| Clay Block | Hardened Clay | 0.35 |

Everything else in the smelting table is the same.

### Recipe architecture

MC also adds `MapCloningRecipe` and `MapExtendingRecipe` as dedicated recipe classes (separate from `ShapedRecipy`/`ShapelessRecipy`). These handle the special logic for duplicating and expanding maps. In LCE, map functionality is more limited so these don't exist.

The `FireworksRecipe` class is another MC addition. It handles the complex fireworks star crafting where you combine dyes, gunpowder, and effect ingredients in any order with special combination rules.

The core recipe system (shaped/shapeless matching, variadic argument registration, recipe groups, tool repair) is the same in both codebases.
