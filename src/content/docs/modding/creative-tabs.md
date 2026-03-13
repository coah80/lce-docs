---
title: Creative Mode Tabs
description: How creative inventory tabs work in LCEMP and how to modify them.
---

The creative inventory in LCEMP is split into 8 tabs across the top of the screen. Each tab shows a grid of items that players can pick from. Unlike Java Edition where items register themselves into categories, LCE takes a different approach: every single item in every tab is listed by hand in one big function.

This guide covers how the tab system works, what lives in each tab, and how to change things around.

## How It All Works

The creative menu lives in `IUIScene_CreativeMenu`, defined in `Minecraft.Client/Common/UI/IUIScene_CreativeMenu.h` and `.cpp`. There are two important layers to understand:

1. **Inventory Groups** are logical buckets of items (like "Building Blocks" or "Redstone" or "Transport")
2. **Tabs** are what the player actually sees on screen. A tab can pull from one or more groups.

For example, the "Redstone & Transport" tab combines the Redstone group and the Transport group into a single tab. The Brewing tab combines the brewing ingredients group with four different potion tier groups.

Everything gets set up in `IUIScene_CreativeMenu::staticCtor()`, which runs once at startup.

## The Two Enums

### Tabs (What the Player Sees)

```cpp
enum ECreativeInventoryTabs
{
    eCreativeInventoryTab_BuildingBlocks = 0,
    eCreativeInventoryTab_Decorations,
    eCreativeInventoryTab_RedstoneAndTransport,
    eCreativeInventoryTab_Materials,
    eCreativeInventoryTab_Food,
    eCreativeInventoryTab_ToolsWeaponsArmor,
    eCreativeInventoryTab_Brewing,
    eCreativeInventoryTab_Misc,
    eCreativeInventoryTab_COUNT,
};
```

There are exactly 8 tabs. The UI has 8 touch panels hardcoded (`TouchPanel_0` through `TouchPanel_7`), so adding a 9th tab means UI work too.

### Groups (Logical Item Buckets)

```cpp
enum ECreative_Inventory_Groups
{
    eCreativeInventory_BuildingBlocks,
    eCreativeInventory_Decoration,
    eCreativeInventory_Redstone,
    eCreativeInventory_Transport,
    eCreativeInventory_Materials,
    eCreativeInventory_Food,
    eCreativeInventory_ToolsArmourWeapons,
    eCreativeInventory_Brewing,
    eCreativeInventory_Potions_Basic,
    eCreativeInventory_Potions_Level2,
    eCreativeInventory_Potions_Extended,
    eCreativeInventory_Potions_Level2_Extended,
    eCreativeInventory_Misc,
    eCreativeInventoryGroupsCount
};
```

Groups are just arrays of `ItemInstance` pointers. A tab references one or more groups and the `TabSpec` system handles stitching them together for display.

## The Grid Layout

Each tab shows a 10-column by 5-row grid, so 50 item slots per page:

```cpp
struct TabSpec
{
    static const int rows = 5;
    static const int columns = 10;
    static const int MAX_SIZE = rows * columns;  // 50
    // ...
};
```

If a tab has more than 50 items, it gets multiple pages. Players scroll between pages with the right stick or the scroll bar on the side.

## What's in Each Tab

Here's a summary of every tab and what kind of items it holds.

### Building Blocks

Stone, grass, dirt, planks, logs, ores, bricks, slabs, stairs, sandstone variants, quartz variants, stone brick variants, nether brick, end stone, obsidian, ice, snow, doors, trapdoors, and fence gates.

Items are added with the `ITEM()` and `ITEM_AUX()` macros. Variants (like different wood types) use aux values:

```cpp
DEF(eCreativeInventory_BuildingBlocks)
    ITEM(Tile::rock_Id)
    ITEM(Tile::grass_Id)
    ITEM(Tile::dirt_Id)
    // ...
    ITEM_AUX(Tile::wood_Id, 0)                      // Oak planks
    ITEM_AUX(Tile::wood_Id, TreeTile::DARK_TRUNK)    // Spruce planks
    ITEM_AUX(Tile::wood_Id, TreeTile::BIRCH_TRUNK)   // Birch planks
    ITEM_AUX(Tile::wood_Id, TreeTile::JUNGLE_TRUNK)  // Jungle planks
```

### Decorations

Skulls, saplings, leaves, flowers, mushrooms, torches, tall grass, dead bushes, vines, lily pads, cactus, snow layers, cobwebs, glass and glass panes, paintings, item frames, signs, flower pots, bookshelves, and all 16 colors of wool and carpet.

### Redstone & Transport

This tab pulls from two groups. The Redstone group has: dispensers, note blocks, pistons (both types), TNT, levers, buttons (stone and wood), pressure plates (stone and wood), redstone dust, redstone torches, repeaters, redstone lamps, and tripwire hooks.

The Transport group has: rails (all three types), ladders, minecarts (regular, chest, and furnace), saddles, and boats.

### Materials

Coal (both types), diamonds, emeralds, iron and gold ingots, nether quartz, bricks, nether bricks, sticks, bowls, bones, string, feathers, flint, leather, gunpowder, clay balls, glowstone dust, all seed types, wheat, sugar cane, eggs, sugar, slime balls, blaze rods, gold nuggets, nether wart, and all 16 dye colors.

### Food

Apples (regular, golden, enchanted golden), melon slices, mushroom stew, bread, cake, cookies, fish (raw and cooked), pork (raw and cooked), beef (raw and cooked), chicken (raw and cooked), rotten flesh, spider eyes, potatoes (raw, baked, poisonous), carrots (regular and golden), and pumpkin pie.

### Tools, Weapons & Armor

This one is organized in tiers. Each tier gets its full armor set, tool set, and weapon laid out together:

```cpp
DEF(eCreativeInventory_ToolsArmourWeapons)
    ITEM(Item::compass_Id)
    // Leather tier
    ITEM(Item::helmet_cloth_Id)
    ITEM(Item::chestplate_cloth_Id)
    ITEM(Item::leggings_cloth_Id)
    ITEM(Item::boots_cloth_Id)
    ITEM(Item::sword_wood_Id)
    ITEM(Item::shovel_wood_Id)
    ITEM(Item::pickAxe_wood_Id)
    ITEM(Item::hatchet_wood_Id)
    ITEM(Item::hoe_wood_Id)
    // Chain tier, Iron tier, Gold tier, Diamond tier follow the same pattern...
```

After the tiers come utility items: flint and steel, clock, shears, fishing rod, and carrot on a stick. At the very end, all enchanted books get generated dynamically in a loop:

```cpp
for (unsigned int i = 0; i < Enchantment::enchantments.length; ++i)
{
    Enchantment *enchantment = Enchantment::enchantments[i];
    if (enchantment == NULL || enchantment->category == NULL) continue;
    list->push_back(
        Item::enchantedBook->createForEnchantment(
            new EnchantmentInstance(enchantment, enchantment->getMaxLevel())
        )
    );
}
```

### Brewing

Brewing ingredients first: experience bottles, ghast tears, fermented spider eyes, blaze powder, magma cream, glistering melons, glass bottles, and water bottles.

Then potions, split across four groups by tier:

| Group | Contents |
|-------|----------|
| `Potions_Basic` | Base-level drinkable and splash potions |
| `Potions_Level2` | Level II potions plus Fire Resistance, Weakness, Slowness |
| `Potions_Extended` | Extended duration potions plus Night Vision and Invisibility |
| `Potions_Level2_Extended` | Level II Extended potions, all remaining variants |

The Brewing tab originally used dynamic groups (LT to cycle through potion tiers) but in LCEMP all four potion groups are combined as static groups on the same tab, so players just scroll through pages instead.

### Miscellaneous

Chests, ender chests, crafting tables, furnaces, brewing stands, enchanting tables, end portal frames, jukeboxes, anvils, fences (wood, nether brick, iron bars), cobblestone walls, beds, buckets (empty, lava, water), milk, cauldrons, snowballs, paper, books, ender pearls, eyes of ender, all 12 music discs, and all spawn eggs.

## How Items Get Added to Groups

Items don't register themselves into creative tabs. Instead, `staticCtor()` builds every group by hand using two macros:

```cpp
#define ITEM(id) list->push_back( \
    shared_ptr<ItemInstance>(new ItemInstance(id, 1, 0)) );
#define ITEM_AUX(id, aux) list->push_back( \
    shared_ptr<ItemInstance>(new ItemInstance(id, 1, aux)) );
#define DEF(index) list = &categoryGroups[index];
```

`ITEM(id)` adds one item with aux value 0. `ITEM_AUX(id, aux)` adds one item with a specific aux value (used for block variants, dye colors, potion types, mob spawn eggs, etc). `DEF(index)` switches which group you're adding to.

The items array `categoryGroups` is a static array of vectors, one per group:

```cpp
static vector< shared_ptr<ItemInstance> > categoryGroups[eCreativeInventoryGroupsCount];
```

## How Tabs Reference Groups

After all the groups are populated, `staticCtor()` creates `TabSpec` objects that wire groups to tabs:

```cpp
specs = new TabSpec*[eCreativeInventoryTab_COUNT];

// Simple: one group, one tab
ECreative_Inventory_Groups blocksGroup[] = {eCreativeInventory_BuildingBlocks};
specs[eCreativeInventoryTab_BuildingBlocks] =
    new TabSpec(L"Structures", IDS_GROUPNAME_BUILDING_BLOCKS,
                1, blocksGroup, 0, NULL);

// Combined: two groups merged into one tab
ECreative_Inventory_Groups redAndTranGroup[] = {
    eCreativeInventory_Transport,
    eCreativeInventory_Redstone
};
specs[eCreativeInventoryTab_RedstoneAndTransport] =
    new TabSpec(L"RedstoneAndTransport", IDS_GROUPNAME_REDSTONE_AND_TRANSPORT,
                2, redAndTranGroup, 0, NULL);
```

The `TabSpec` constructor takes:

| Parameter | What it does |
|-----------|-------------|
| `icon` | Wide string name used for the tab icon lookup |
| `descriptionId` | String ID for the tab label text |
| `staticGroupsCount` | How many groups this tab pulls from |
| `staticGroups` | Array of group enum values |
| `dynamicGroupsCount` | Groups that cycle with LT (used for potion tiers in some builds) |
| `dynamicGroups` | Array of dynamic group enum values |

When a tab is selected, `TabSpec::populateMenu()` fills the 50-slot grid from its assigned groups, handling pagination automatically.

## Tab Icons and Display

Each tab has an icon name (the first parameter of `TabSpec`) and a localized description string. The icon names map to UI assets:

| Tab | Icon Name | Description String ID |
|-----|-----------|----------------------|
| Building Blocks | `L"Structures"` | `IDS_GROUPNAME_BUILDING_BLOCKS` |
| Decorations | `L"Decoration"` | `IDS_GROUPNAME_DECORATIONS` |
| Redstone & Transport | `L"RedstoneAndTransport"` | `IDS_GROUPNAME_REDSTONE_AND_TRANSPORT` |
| Materials | `L"Materials"` | `IDS_GROUPNAME_MATERIALS` |
| Food | `L"Food"` | `IDS_GROUPNAME_FOOD` |
| Tools | `L"Tools"` | `IDS_GROUPNAME_TOOLS_WEAPONS_ARMOR` |
| Brewing | `L"Brewing"` | `IDS_GROUPNAME_POTIONS_480` |
| Misc | `L"Misc"` | `IDS_GROUPNAME_MISCELLANEOUS` |

The active tab gets highlighted through the `SetActiveTab` function call to the Iggy/XUI movie. The tab label text appears as the inventory title (where it would normally say "Inventory" in the survival menu).

## Adding Your Custom Item to an Existing Tab

The simplest mod: just add your item to a group. Open `IUIScene_CreativeMenu.cpp`, find the group you want, and add a line.

Say you made a Ruby item (ID 407) and want it in the Materials tab:

```cpp
// Inside staticCtor(), in the Materials group section:
DEF(eCreativeInventory_Materials)
    ITEM(Item::coal_Id)
    ITEM_AUX(Item::coal_Id, 1)
    ITEM(Item::diamond_Id)
    ITEM(Item::emerald_Id)
    ITEM(Item::ruby_Id)           // <-- your new item
    ITEM(Item::ironIngot_Id)
    // ...
```

Order matters. Items show up in the grid in the exact order you list them.

For a new block, same deal. Say you added a Ruby Ore tile:

```cpp
DEF(eCreativeInventory_BuildingBlocks)
    // ... existing ores ...
    ITEM(Tile::emeraldOre_Id)
    ITEM(Tile::rubyOre_Id)        // <-- your new block
    ITEM(Tile::netherQuartz_Id)
```

## Moving Items Between Tabs

Just cut the `ITEM()` line from one group's section and paste it into another. There's no registration system to update. The item only exists in whatever group you put it in.

Want sponge in Building Blocks instead of Decorations? Remove it from the Decoration `DEF` block and add it to the Building Blocks `DEF` block. Done.

## Adding a New Creative Group

If you want a new logical grouping (without adding a new tab), add an entry to the `ECreative_Inventory_Groups` enum:

```cpp
enum ECreative_Inventory_Groups
{
    // ... existing groups ...
    eCreativeInventory_Misc,
    eCreativeInventory_MyNewGroup,    // <-- add before the count
    eCreativeInventoryGroupsCount
};
```

Then populate it in `staticCtor()`:

```cpp
DEF(eCreativeInventory_MyNewGroup)
    ITEM(Item::ruby_Id)
    ITEM(Tile::rubyOre_Id)
    ITEM(Tile::rubyBlock_Id)
```

And wire it into a tab. You can either add it to an existing tab (the group's items appear after the other groups on that tab) or create a new tab for it.

To add it to the Misc tab:

```cpp
ECreative_Inventory_Groups miscGroup[] = {
    eCreativeInventory_Misc,
    eCreativeInventory_MyNewGroup   // items appear after Misc items
};
specs[eCreativeInventoryTab_Misc] =
    new TabSpec(L"Misc", IDS_GROUPNAME_MISCELLANEOUS,
                2, miscGroup, 0, NULL);
```

## Adding a New Tab

This is the big one. The UI only supports 8 tabs out of the box, so you either need to replace an existing tab or do UI work to add a 9th.

### Replacing an Existing Tab

The easier path. Say you want to split "Redstone & Transport" into two separate tabs, and you're willing to fold Transport items into Misc:

1. Add the new tab enum value (replacing an existing one or reusing the slot):

```cpp
enum ECreativeInventoryTabs
{
    eCreativeInventoryTab_BuildingBlocks = 0,
    eCreativeInventoryTab_Decorations,
    eCreativeInventoryTab_Redstone,        // was RedstoneAndTransport
    eCreativeInventoryTab_Materials,
    eCreativeInventoryTab_Food,
    eCreativeInventoryTab_ToolsWeaponsArmor,
    eCreativeInventoryTab_Brewing,
    eCreativeInventoryTab_Misc,
    eCreativeInventoryTab_COUNT,
};
```

2. Update the `TabSpec` creation to only reference the Redstone group:

```cpp
ECreative_Inventory_Groups redstoneGroup[] = {eCreativeInventory_Redstone};
specs[eCreativeInventoryTab_Redstone] =
    new TabSpec(L"Redstone", IDS_GROUPNAME_REDSTONE,
                1, redstoneGroup, 0, NULL);
```

3. Add Transport to the Misc tab's group array:

```cpp
ECreative_Inventory_Groups miscGroup[] = {
    eCreativeInventory_Misc,
    eCreativeInventory_Transport
};
specs[eCreativeInventoryTab_Misc] =
    new TabSpec(L"Misc", IDS_GROUPNAME_MISCELLANEOUS,
                2, miscGroup, 0, NULL);
```

### Adding a 9th Tab (UI Changes Required)

If you really want more than 8 tabs, you need to touch the UI layer too. The `UIScene_CreativeMenu` class has a hardcoded array of 8 touch panels and the Iggy/XUI movie files expect exactly 8 tab icons:

```cpp
enum ETouchInput
{
    ETouchInput_TouchPanel_0,
    // ... through ...
    ETouchInput_TouchPanel_7,
    ETouchInput_TouchSlider,
    ETouchInput_Count,
};
```

You would need to:

1. Bump `eCreativeInventoryTab_COUNT` to 9
2. Add `ETouchInput_TouchPanel_8` to the touch input enum
3. Add the new touch panel mapping in the Iggy element map
4. Update the Flash/Scaleform movie to include a 9th tab icon
5. Create the new `TabSpec` entry

This is doable but involves more than just C++ changes. The Iggy movie files need editing in their respective authoring tools.

## The Pagination System

When a tab has more items than fit on one page (50 slots), `TabSpec` automatically calculates the page count:

```cpp
m_staticPerPage = MAX_SIZE - dynamicItems;
m_pages = (int)ceil((float)m_staticItems / m_staticPerPage);
```

Players navigate pages with the right analog stick (up/down) or by dragging the scroll bar. The `populateMenu()` method handles filling the correct 50 items for the current page, pulling from the right offset in the group arrays.

## Key Files

| File | What's in it |
|------|-------------|
| `Minecraft.Client/Common/UI/IUIScene_CreativeMenu.h` | Tab and group enums, `TabSpec` struct, `ItemPickerMenu` class |
| `Minecraft.Client/Common/UI/IUIScene_CreativeMenu.cpp` | `staticCtor()` with all item lists, tab wiring, pagination logic |
| `Minecraft.Client/Common/UI/UIScene_CreativeMenu.h` | Iggy-based UI scene (PS3, PS Vita) |
| `Minecraft.Client/Common/UI/UIScene_CreativeMenu.cpp` | Iggy UI input handling and rendering |
| `Minecraft.Client/Common/XUI/XUI_Scene_Inventory_Creative.h` | XUI-based UI scene (Xbox 360) |

## Related Guides

- [Adding Items](/lcemp-docs/modding/adding-items/) for creating items to put in creative tabs
- [Adding Blocks](/lcemp-docs/modding/adding-blocks/) for creating blocks to put in creative tabs
- [Custom Potions](/lcemp-docs/modding/custom-potions/) for adding potions to the Brewing tab
