---
title: Adding Recipes
description: Step-by-step guide to adding crafting and smelting recipes to LCEMP.
---

LCEMP has three recipe types: **shaped** (grid pattern matters), **shapeless** (any arrangement), and **furnace** (smelting). All crafting recipes are registered through the `Recipes` singleton, while smelting recipes use `FurnaceRecipes`.

## Architecture overview

| Class | File | Role |
|---|---|---|
| `Recipy` | `Minecraft.World/Recipy.h` | Abstract base for all crafting recipes |
| `ShapedRecipy` | `Minecraft.World/ShapedRecipy.h` | Grid-pattern recipes (e.g. pickaxe) |
| `ShapelessRecipy` | `Minecraft.World/ShapelessRecipy.h` | Order-independent recipes (e.g. eye of ender) |
| `Recipes` | `Minecraft.World/Recipes.h` | Singleton manager, owns the recipe list |
| `FurnaceRecipes` | `Minecraft.World/FurnaceRecipes.h` | Singleton manager for smelting recipes |

### Recipe groups

Every recipe belongs to a group that controls where it appears in the console crafting UI:

| Code | Group | Constant |
|---|---|---|
| `'S'` | Structure | `eGroupType_Structure` |
| `'T'` | Tool | `eGroupType_Tool` |
| `'F'` | Food | `eGroupType_Food` |
| `'A'` | Armour | `eGroupType_Armour` |
| `'M'` | Mechanism | `eGroupType_Mechanism` |
| `'V'` | Transport | `eGroupType_Transport` |
| `'D'` | Decoration | `eGroupType_Decoration` (default) |

## Shaped recipes

Shaped recipes use `Recipes::addShapedRecipy()`, which is a C variadic function. The arguments follow a specific encoding because C++ variadics cannot carry type information the way Java reflection can. A **type string** is passed as the second variadic argument to describe what follows.

### The type string encoding

The type string is a wide-character string where each character tells the parser what the next variadic argument is:

| Char | Meaning | Variadic type |
|---|---|---|
| `s` | A row of the crafting grid | `wchar_t *` (wide string literal) |
| `c` | A mapping character (key) | `wchar_t` |
| `z` | Mapped to an `ItemInstance *` | `ItemInstance *` |
| `i` | Mapped to an `Item *` | `Item *` |
| `t` | Mapped to a `Tile *` | `Tile *` |
| `g` | The recipe group | `wchar_t` (one of `S`, `T`, `F`, `A`, `M`, `V`, `D`) |

The type string **must** end with `g` followed by the group character. The parser reads types left-to-right and consumes variadic args accordingly.

### How shaped recipes work

1. Row strings (`s` entries) define the crafting grid. Each character in a row maps to an ingredient. Spaces mean empty slots.
2. After all rows, `c`+`i`/`t`/`z` pairs define the character-to-ingredient mappings.
3. `g` + group char finishes the recipe.
4. The parser computes `width` and `height` from the row strings, builds an `ItemInstance**` array, and creates a `ShapedRecipy(width, height, ids, result, group)`.

### Example: 3x3 shaped recipe (enchanting table)

From `Recipes.cpp`:

```cpp
addShapedRecipy(new ItemInstance(Tile::enchantTable, 1),
    L"sssctcicig",   // type string: 3 rows, then char+tile, char+item, char+item, group
    L" B ",          // row 0
    L"D#D",          // row 1
    L"###",          // row 2
    L'#', Tile::obsidian,    // '#' -> obsidian (Tile*)
    L'B', Item::book,        // 'B' -> book (Item*)
    L'D', Item::diamond,     // 'D' -> diamond (Item*)
    L'S');                   // group: Structure
```

Reading the type string `sssctcicig`:
- `s` `s` `s` -- three grid rows
- `c` `t` -- char `#` maps to a Tile
- `c` `i` -- char `B` maps to an Item
- `c` `i` -- char `D` maps to an Item
- `g` -- group follows

### Example: 2x2 shaped recipe (snow block)

```cpp
addShapedRecipy(new ItemInstance(Tile::snow, 1),
    L"sscig",        // 2 rows, char+item, group
    L"##",           // row 0
    L"##",           // row 1
    L'#', Item::snowBall,
    L'S');
```

### Example: 1x1 shaped recipe (planks from log)

```cpp
addShapedRecipy(new ItemInstance(Tile::wood, 4, 0),
    L"sczg",         // 1 row, char+ItemInstance(z), group
    L"#",            // single slot
    L'#', new ItemInstance(Tile::treeTrunk, 1, 0),  // specific aux value
    L'S');
```

Using `z` (ItemInstance) instead of `t` (Tile) lets you specify an **aux data value** for the ingredient. When you use `t`, the mapping automatically uses `ANY_AUX_VALUE` (-1).

### Keeping NBT tags

Some recipes need to preserve the NBT tag from an ingredient (e.g. carrot on a stick inherits the fishing rod's damage). Chain `->keepTag()` on the return value:

```cpp
addShapedRecipy(new ItemInstance(Item::carrotOnAStick, 1),
    L"sscicig",
    L"# ",
    L" X",
    L'#', Item::fishingRod,
    L'X', Item::carrots,
    L'T')->keepTag();
```

## Shapeless recipes

Shapeless recipes use `Recipes::addShapelessRecipy()`. The type string is simpler since there is no grid -- just a list of ingredients:

| Char | Meaning |
|---|---|
| `i` | Next arg is `Item *` |
| `t` | Next arg is `Tile *` |
| `z` | Next arg is `ItemInstance *` |
| `g` | Group char follows (must be last) |

### Example: eye of ender

```cpp
addShapelessRecipy(new ItemInstance(Item::eyeOfEnder, 1),
    L"iig",                      // two Items, then group
    Item::enderPearl,            // ingredient 1
    Item::blazePowder,           // ingredient 2
    L'T');                       // group: Tool
```

### Example: fire charge (with aux data)

```cpp
addShapelessRecipy(new ItemInstance(Item::fireball, 3),
    L"iizg",                     // two Items + one ItemInstance, group
    Item::sulphur,
    Item::blazePowder,
    new ItemInstance(Item::coal, 1, CoalItem::CHAR_COAL),  // charcoal specifically
    L'T');
```

### Example: book

```cpp
addShapelessRecipy(new ItemInstance(Item::book, 1),
    L"iiiig",           // four Items, group
    Item::paper,
    Item::paper,
    Item::paper,
    Item::leather,
    L'D');              // group: Decoration
```

## Furnace (smelting) recipes

Furnace recipes are registered through `FurnaceRecipes`, a separate singleton. The API is straightforward:

```cpp
void addFurnaceRecipy(int itemId, ItemInstance *result, float xpValue);
```

| Parameter | Description |
|---|---|
| `itemId` | The tile/item ID of the input (use `Tile::xxx_Id` or `Item::xxx_Id`) |
| `result` | The output `ItemInstance` |
| `xpValue` | XP awarded per smelt (0.1 for basic, 0.35 for food, 0.7 for iron, 1.0 for gold/diamond) |

### Existing furnace recipes

From `FurnaceRecipes.cpp`:

```cpp
addFurnaceRecipy(Tile::ironOre_Id,    new ItemInstance(Item::ironIngot),  0.7f);
addFurnaceRecipy(Tile::goldOre_Id,    new ItemInstance(Item::goldIngot),  1.0f);
addFurnaceRecipy(Tile::diamondOre_Id, new ItemInstance(Item::diamond),    1.0f);
addFurnaceRecipy(Tile::sand_Id,       new ItemInstance(Tile::glass),      0.1f);
addFurnaceRecipy(Item::porkChop_raw_Id, new ItemInstance(Item::porkChop_cooked), 0.35f);
addFurnaceRecipy(Tile::treeTrunk_Id,  new ItemInstance(Item::coal, 1, CoalItem::CHAR_COAL), 0.15f);
```

### Adding a custom furnace recipe

To smelt a custom ore into a custom ingot:

```cpp
// In FurnaceRecipes constructor or your mod init
FurnaceRecipes::getInstance()->addFurnaceRecipy(
    myCustomOre_Id,                        // input tile ID
    new ItemInstance(Item::myCustomIngot),  // output
    0.8f                                   // XP value
);
```

## Recipe category modules

LCEMP organizes recipes into dedicated classes that each register their own set of recipes. The `Recipes` constructor calls them in a specific order to control crafting menu layout:

```cpp
pToolRecipies->addRecipes(this);
pFoodRecipies->addRecipes(this);
pStructureRecipies->addRecipes(this);
// ... inline recipes (bed, enchanting table, etc.) ...
pArmorRecipes->addRecipes(this);
pClothDyeRecipes->addRecipes(this);
// ... more inline recipes ...
pWeaponRecipies->addRecipes(this);
// ... more inline recipes ...
pOreRecipies->addRecipes(this);
```

| Class | File | Category |
|---|---|---|
| `ToolRecipies` | `Minecraft.World/ToolRecipies.h` | Pickaxes, shovels, axes, hoes |
| `WeaponRecipies` | `Minecraft.World/WeaponRecipies.h` | Swords |
| `ArmorRecipes` | `Minecraft.World/ArmorRecipes.h` | Helmets, chestplates, etc. |
| `FoodRecipies` | `Minecraft.World/FoodRecipies.h` | Cooked food, bowls |
| `OreRecipies` | `Minecraft.World/OreRecipies.h` | Ore blocks, ingot-to-block |
| `StructureRecipies` | `Minecraft.World/StructureRecipies.h` | Chests, furnaces, workbenches |
| `ClothDyeRecipes` | `Minecraft.World/ClothDyeRecipes.h` | Wool dyeing |

To add recipes in a new category, create a class with an `addRecipes(Recipes *r)` method and call it from the `Recipes` constructor.

## Adding a new recipe: step by step

1. **Decide the recipe type** -- shaped (pattern matters), shapeless (any order), or furnace (smelting).

2. **Choose where to register it** -- either inline in `Recipes::Recipes()` in `Recipes.cpp`, or in one of the category classes.

3. **Build the type string** -- for shaped recipes, count your rows (`s` each), then each character-ingredient pair (`c` + `i`/`t`/`z`), and end with `g`.

4. **Call the registration function**:
   ```cpp
   // Shaped: diamond block
   addShapedRecipy(new ItemInstance(Tile::diamondBlock, 1),
       L"ssscig",
       L"###",
       L"###",
       L"###",
       L'#', Item::diamond,
       L'D');

   // Shapeless: mushroom stew
   addShapelessRecipy(new ItemInstance(Item::mushroomStew, 1),
       L"ttig",
       Tile::mushroom1, Tile::mushroom2,
       L'F');
   ```

5. **Rebuild** -- recipes are registered during `Recipes::staticCtor()` at startup. After the constructor runs, `buildRecipeIngredientsArray()` is called automatically to index all recipes for the console crafting UI.

## Key source files

- `Minecraft.World/Recipy.h` -- abstract recipe base class
- `Minecraft.World/ShapedRecipy.h` -- shaped recipe class
- `Minecraft.World/ShapelessRecipy.h` -- shapeless recipe class
- `Minecraft.World/Recipes.h` / `Recipes.cpp` -- recipe manager and all built-in recipes
- `Minecraft.World/FurnaceRecipes.h` / `FurnaceRecipes.cpp` -- furnace recipe manager
