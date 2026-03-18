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

## The Object union class

Before getting into recipes, it helps to understand the `Object` class defined in `Recipes.h`. This is a helper union that lets the recipe sub-managers store different types in the same array:

```cpp
class Object
{
public:
    union
    {
        Tile *tile;
        FireTile *firetile;
        Item *item;
        MapItem *mapitem;
        ItemInstance *iteminstance;
    };
    Object()                { eType=eType_TILE; tile=NULL; }
    Object(Tile *t)         { eType=eType_TILE; tile=t; }
    Object(FireTile *t)     { eType=eType_TILE; firetile=t; }
    Object(Item *i)         { eType=eType_ITEM; item=i; }
    Object(MapItem *i)      { eType=eType_ITEM; mapitem=i; }
    Object(ItemInstance *i) { eType=eType_ITEMINSTANCE; iteminstance=i; }
    eINSTANCEOF GetType()   { return eType; }
};
```

The `ADD_OBJECT(vec, val)` macro wraps `vec.push_back(new Object(val))`. All the recipe sub-managers use this to build their material/item arrays.

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

If you forget the group character or use an unrecognized one, it defaults to Decoration.

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

### INGREDIENTS_REQUIRED struct

4J's console crafting UI uses an `INGREDIENTS_REQUIRED` struct precomputed for each recipe. It tracks:

- A list of ingredient item IDs and aux values needed
- A per-player `bCanMake` flag (whether the player has the materials)
- A bitmask of missing grid ingredients (so the UI can highlight which slots are missing)

## Shaped recipes

`ShapedRecipy` stores a 2D grid of `ItemInstance` pointers along with width, height, and the result item.

### Member variables

| Field | Type | Description |
|-------|------|-------------|
| `width` | `int` | Grid width |
| `height` | `int` | Grid height |
| `recipeItems` | `ItemInstance **` | Flat array of ingredient pointers (width * height) |
| `result` | `ItemInstance *` | The output item |
| `group` | `int` | Recipe group enum |
| `_keepTag` | `bool` | Whether to transfer NBT from ingredient to result |

### Pattern matching

When checking if a `CraftingContainer` matches, shaped recipes:

1. Try every valid offset position `(xOffs, yOffs)` where the recipe fits within the 3x3 grid.
2. At each offset, try both normal and horizontally flipped orientations.
3. Compare each grid cell: items must match by ID, and if the recipe specifies an aux value other than `ANY_AUX_VALUE` (-1), the aux value must also match.

The matching is done in `checkMatch()`, which is called by `matches()` once normally and once with `mirror = true`.

### Tag preservation

The `keepTag()` method sets `_keepTag = true` and returns `this` for chaining. When `_keepTag` is set, the `assemble()` method copies the NBT tag from the first non-null ingredient to the result item. This is used for recipes like Carrot on a Stick, where the fishing rod's durability tag carries over.

### requires()

The `requires()` method fills in an `INGREDIENTS_REQUIRED` struct. For shaped recipes, it walks the `recipeItems` array and records each ingredient's ID and aux value.

## Shapeless recipes

`ShapelessRecipy` stores a list of ingredient `ItemInstance` pointers. Order does not matter.

### Pattern matching

1. Copy the ingredient list to a temporary list.
2. Go through every slot in the 3x3 crafting grid.
3. For each item found, search the ingredient list for a match (by ID and optionally aux value).
4. Remove matched ingredients from the temporary list.
5. The recipe matches only if all ingredients were used up and no extra items are left.

### requires()

For shapeless recipes, `requires()` has a quirk: it lays out the ingredients in a 3x3 grid pattern (row by row) to fill in the `INGREDIENTS_REQUIRED` struct. This is so the console crafting UI can show which ingredient goes where, even though the actual matching does not care about position.

## How recipes are registered

### The variadic argument system

4J rewrote the Java recipe registration to use C-style variadic arguments (`va_list`). The second argument after the result item is always a wide-character type string that encodes what comes next.

### Type string encoding for shaped recipes

| Type char | Meaning | Variadic type |
|---|---|---|
| `s` | A row of the crafting pattern | `wchar_t *` (wide string literal) |
| `w` | A string array (used by sub-managers) | `wstring *` (reads until empty string) |
| `a` | A row (alternate, same as `s`) | `wchar_t *` |
| `c` | A character key for ingredient mapping | `wchar_t` |
| `z` | An item instance mapped to the preceding character | `ItemInstance *` |
| `i` | An item mapped to the preceding character | `Item *` |
| `t` | A tile/block mapped to the preceding character | `Tile *` (auto-wrapped with `ANY_AUX_VALUE`) |
| `g` | The recipe group character (must be last) | `wchar_t` |

The `w` type is used by `ToolRecipies`, `WeaponRecipies`, and `ArmorRecipes` to pass their pre-built shape arrays. The parser reads `wstring` entries until it hits an empty one.

When you use `t` to map a Tile, the parser creates an `ItemInstance(tile, 1, ANY_AUX_VALUE)` internally. This means any aux value will match. If you need a specific aux value (like a specific wood type), use `z` with an explicit `ItemInstance` instead.

### Type string encoding for shapeless recipes

| Type char | Meaning |
|---|---|
| `z` | Next arg is `ItemInstance *` |
| `i` | Next arg is `Item *` |
| `t` | Next arg is `Tile *` |
| `g` | Group char follows (must be last) |

Note that shaped recipe type strings also contain `s`/`w`/`a` and `c` characters for the grid pattern and key mappings. Shapeless recipes skip those since there is no grid.

### Inside addShapedRecipy

Here is what happens step by step when `addShapedRecipy()` is called:

1. Parse the type string character by character using `va_list`.
2. For each `s`/`a` entry, read a `wchar_t *` string. Append it to the `map` string. Increment `height`. Update `width` from string length.
3. For each `w` entry, read a `wstring *` array. Keep reading strings until an empty one is found. Each non-empty string adds a row.
4. For each `c` entry, read a `wchar_t` and store it as the current mapping key.
5. For each `i`/`t`/`z` entry, read the item/tile/instance and insert it into a `mappings` hash map keyed by the current character.
6. For `g`, read the group character and map it to the enum.
7. After parsing, build an `ItemInstance **` array of size `width * height`. For each character in the map string, look it up in the mappings. Spaces become `NULL`.
8. Create a `ShapedRecipy(width, height, ids, result, group)` and push it onto the recipe list.

The function returns the `ShapedRecipy *` pointer so you can chain `->keepTag()` on it.

### Inside addShapelessRecipy

Simpler than shaped:

1. Parse the type string.
2. For each `i`/`t`/`z`, create an `ItemInstance` and push it into the ingredients vector.
3. For `g`, read the group character.
4. Create a `ShapelessRecipy(result, ingredients, group)` and push it onto the recipe list.

Note: for `z` (ItemInstance), the original pointer is copied using `copy_not_shared()`. For `t` (Tile), it creates `new ItemInstance(tile)` without `ANY_AUX_VALUE` (unlike shaped recipes where tiles get `ANY_AUX_VALUE`).

### Example: enchanting table recipe

```cpp
addShapedRecipy(new ItemInstance(Tile::enchantTable, 1),
    L"sssctcicig",    // 3 strings, char+tile, char+item, char+item, group
    L" B ",           // row 1
    L"D#D",           // row 2
    L"###",           // row 3
    L'#', Tile::obsidian,
    L'B', Item::book,
    L'D', Item::diamond,
    L'S');             // Structure group
```

Reading the type string `sssctcicig`:
- `s` `s` `s` = three grid rows
- `c` `t` = char `#` maps to a Tile (obsidian)
- `c` `i` = char `B` maps to an Item (book)
- `c` `i` = char `D` maps to an Item (diamond)
- `g` = group follows (Structure)

### Shapeless recipe example

```cpp
addShapelessRecipy(new ItemInstance(Item::eyeOfEnder, 1),
    L"iig",           // 2 items, group
    Item::enderPearl,
    Item::blazePowder,
    L'T');             // Tool group
```

## Recipe registration order

The `Recipes` constructor registers everything in a specific order that controls how recipes appear in the console crafting menu:

```
1.  Planks from logs (4 variants: oak, birch, dark, jungle)
2.  Sticks from planks
3.  ToolRecipies->addRecipes()      -- pickaxes, shovels, axes, hoes, shears
4.  FoodRecipies->addRecipes()      -- golden apple, mushroom stew, cookies, melon block,
                                       seeds, pumpkin pie, enchanted golden apple,
                                       golden carrot, fermented spider eye, specked melon,
                                       blaze powder, magma cream
5.  StructureRecipies->addRecipes() -- sandstone variants, quartz variants, workbench,
                                       furnace, chest, ender chest, stone bricks,
                                       glass panes, nether bricks, redstone lamp
6.  Bed, enchanting table, anvil
7.  Ladder, fence gate, fence, nether fence, iron bars
8.  Cobblestone walls (normal + mossy)
9.  Doors (wood + iron)
10. Stairs (all 10 variants: oak, stone, bricks, smooth stone brick, nether bricks, sandstone, birch, dark, jungle, quartz)
11. ArmorRecipes->addRecipes()      -- all armor pieces (chain armor commented out)
12. ClothDyeRecipes->addRecipes()   -- 16 wool colors, dye recipes, 16 carpet colors
13. Snow block, clay block, brick block, wool, TNT
14. Stone slabs (7 types) and wood slabs (4 types)
15. Cake, sugar
16. Rails (normal, golden, detector), minecarts (normal, chest, furnace), boat
17. Fishing rod, carrot on a stick, flint and steel
18. Bread
19. Bow, arrow
20. WeaponRecipies->addRecipes()    -- all swords
21. Bucket, bowl, glass bottle, flower pot
22. Torches (charcoal first, then coal)
23. Glowstone, quartz block, lever, tripwire hook
24. Redstone torch, repeater, clock, compass, map
25. Eye of ender, fire charges
26. Buttons (stone + wood), pressure plates (wood + stone)
27. Dispenser, cauldron, brewing stand
28. Jack-o-lantern, jukebox
29. Paper, book
30. Note block, bookshelf, painting, item frame
31. OreRecipies->addRecipes()       -- storage block conversions (gold, iron, diamond,
                                       emerald, lapis)
32. Gold nugget conversions
33. Signs, pistons (normal + sticky)
34. buildRecipeIngredientsArray()   -- indexes everything for the console UI
```

This order matters because the console crafting UI shows recipes in the order they were registered.

## Tool repair

Before checking registered recipes, `Recipes::getItemFor()` has a special case for tool repair. The check runs before any recipe matching:

1. Count how many non-null items are in the crafting grid.
2. If exactly two items exist, and they have the same ID, and both have count 1, and the item type is damageable (`canBeDepleted()`):
3. Calculate combined durability: `remaining1 + remaining2 + 5% of maxDamage`
4. Return a new item with the calculated damage value.

```cpp
int remaining1 = item->getMaxDamage() - first->getDamageValue();
int remaining2 = item->getMaxDamage() - second->getDamageValue();
int remaining = (remaining1 + remaining2) + item->getMaxDamage() * 5 / 100;
int resultDamage = item->getMaxDamage() - remaining;
if (resultDamage < 0) resultDamage = 0;
```

So two iron pickaxes with 100 durability each remaining would give: `100 + 100 + 250*5/100 = 212` remaining durability. The `5/100` is integer division so it rounds down.

## Recipe sub-managers

Recipe registration is split across seven specialized classes, each with an `addRecipes(Recipes *)` method:

### ToolRecipies

**Files:** `Minecraft.World/ToolRecipies.h`, `Minecraft.World/ToolRecipies.cpp`

`MAX_TOOL_RECIPES = 5` (rows in the map array).

Stores 4 shape patterns and a 5-column material map:

| Row | Contents |
|-----|----------|
| `map[0]` | Materials: Planks (Tile), Cobblestone (Tile), Iron Ingot (Item), Diamond (Item), Gold Ingot (Item) |
| `map[1]` | Pickaxes: wood, stone, iron, diamond, gold |
| `map[2]` | Shovels: wood, stone, iron, diamond, gold |
| `map[3]` | Axes: wood, stone, iron, diamond, gold |
| `map[4]` | Hoes: wood, stone, iron, diamond, gold |

The shapes are:

```
Pickaxe:  XXX    Shovel:  X     Axe:  XX     Hoe:  XX
           #              #           X#            #
           #              #            #            #
```

The `addRecipes()` loop iterates over each material column and each tool type. It builds the type string dynamically, choosing `t` or `i` based on whether the material is a Tile or Item (via `GetType()`). All tool recipes use the `'T'` group.

Also registers **shears** as a 2x2 shaped recipe at the end: `" #" / "# "` with iron ingots.

### WeaponRecipies

**Files:** `Minecraft.World/WeaponRecipies.h`, `Minecraft.World/WeaponRecipies.cpp`

`MAX_WEAPON_RECIPES = 2` (rows).

One shape pattern (sword): `X / X / #`

Same 5-column material map as tools. The loop is the same. All sword recipes use the `'T'` group.

The bow and arrow recipes are commented out here and moved to inline in `Recipes.cpp` to avoid stacking issues in the group display.

### ArmorRecipes

**Files:** `Minecraft.World/ArmorRecipes.h`, `Minecraft.World/ArmorRecipes.cpp`

`MAX_ARMOUR_RECIPES = 5` (rows).

4 shape patterns:

```
Helmet:     XXX     Chestplate:  X X     Leggings:  XXX     Boots:  X X
            X X                  XXX                 X X             X X
                                 XXX                 X X
```

4-column material map (chain armor is commented out):

| Row | Contents |
|-----|----------|
| `map[0]` | Materials: Leather, Iron Ingot, Diamond, Gold Ingot |
| `map[1]` | Helmets: leather, iron, diamond, gold |
| `map[2]` | Chestplates: leather, iron, diamond, gold |
| `map[3]` | Leggings: leather, iron, diamond, gold |
| `map[4]` | Boots: leather, iron, diamond, gold |

All armor recipes use the `'A'` group.

Also provides `GetArmorType(int itemId)` which maps item IDs to `eArmorType` values for 4J's quick equip feature.

### OreRecipies

**Files:** `Minecraft.World/OreRecipies.h`, `Minecraft.World/OreRecipies.cpp`

`MAX_ORE_RECIPES = 5` (entries).

Each entry is a pair: a Tile (the storage block) and an ItemInstance (9 of the material). The loop creates both directions for each:

- **9-to-block:** 3x3 grid of the material, makes 1 block. Group `'D'`.
- **Block-to-9:** 1x1 grid of the block, makes 9 of the material. Group `'D'`.

| Entry | Block | Material |
|-------|-------|----------|
| 0 | Gold Block | 9 Gold Ingots |
| 1 | Iron Block | 9 Iron Ingots |
| 2 | Diamond Block | 9 Diamonds |
| 3 | Emerald Block | 9 Emeralds |
| 4 | Lapis Block | 9 Lapis Lazuli (DyePowderItem::BLUE) |

### FoodRecipies

**File:** `Minecraft.World/FoodRecipies.cpp`

No parallel array system. Just registers recipes directly:

- Golden Apple (regular): 8 gold nuggets + apple. Group `'F'`.
- Mushroom Stew: shapeless, 2 mushroom types + bowl. Group `'F'`.
- Cookie: wheat + cocoa beans. Group `'F'`.
- Melon Block: 9 melon slices. Group `'F'`.
- Melon Seeds, Pumpkin Seeds. Group `'F'`.
- Pumpkin Pie: shapeless, pumpkin + sugar + egg. Group `'F'`.
- Enchanted Golden Apple: 8 gold blocks + apple. Group `'F'`.
- Golden Carrot: 8 gold nuggets + carrot. Group `'F'`.
- Fermented Spider Eye, Glistering Melon, Blaze Powder, Magma Cream. Group `'F'`.

### ClothDyeRecipes

**File:** `Minecraft.World/ClothDyeRecipes.cpp`

Two loops:
1. 16 shapeless recipes for dyeing white wool into each color (dye + wool). Group `'D'`.
2. 16 shaped recipes for carpets (2 wool in a row makes 3 carpets). Group `'D'`.

Plus 14 individual dye-mixing recipes (rose to red dye, bone to bone meal, various dye combinations).

### StructureRecipies

**File:** `Minecraft.World/StructureRecipies.cpp`

Registers sandstone variants, quartz variants, workbench, furnace, chest, ender chest, stone bricks, glass panes, nether bricks, and redstone lamp. Mix of `'S'`, `'D'`, and `'M'` groups.

## Ingredients array

After all recipes are registered, `buildRecipeIngredientsArray()` goes through every recipe and calls `requires()` to precompute the `INGREDIENTS_REQUIRED` struct for each one. The console crafting UI uses this to quickly figure out which recipes the player can make based on their inventory.

The array is allocated as `new INGREDIENTS_REQUIRED[recipeCount]` and stored in `m_pRecipeIngredientsRequired`. Access it through `getRecipeIngredientsArray()`.

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

## MinecraftConsoles differences

MC has more recipes than LCEMP. The crafting system registers about **114 shaped/shapeless recipes** compared to LCEMP's **100**. The extra recipes cover the new blocks and items that MC adds:

- Beacon, hopper, dropper, comparator, daylight detector, and activator rail crafting recipes
- Hay bale and hardened clay recipes
- Stained glass and stained glass pane dyeing recipes
- Horse armor and lead/leash recipes
- Fireworks and fireworks star recipes (MC adds `FireworksRecipe` as a special recipe class)
- Name tag related recipes
- Map cloning (`MapCloningRecipe`) and map extending (`MapExtendingRecipe`) as separate recipe classes

### New smelting recipe

MC adds one new smelting recipe that LCEMP does not have:

| Input | Output | XP |
|---|---|---|
| Clay Block | Hardened Clay | 0.35 |

Everything else in the smelting table is the same.

### Recipe architecture

MC also adds `MapCloningRecipe` and `MapExtendingRecipe` as dedicated recipe classes (separate from `ShapedRecipy`/`ShapelessRecipy`). These handle the special logic for duplicating and expanding maps. In LCEMP, map functionality is more limited so these do not exist.

The `FireworksRecipe` class is another MC addition. It handles the complex fireworks star crafting where you combine dyes, gunpowder, and effect ingredients in any order with special combination rules.

The core recipe system (shaped/shapeless matching, variadic argument registration, recipe groups, tool repair) is the same in both codebases.
