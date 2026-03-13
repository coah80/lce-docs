---
title: Custom Container Menus & UIs
description: How the container menu system works in LCE and how to build your own.
---

When you open a chest, crafting table, furnace, or anvil in Minecraft, you're looking at a container menu. It's the system that manages slots, items, click behavior, shift-clicking, and syncing everything between client and server. This guide breaks down how all of that works and shows you how to build your own.

## How the system fits together

There are two sides to every container UI:

1. **The menu** (`AbstractContainerMenu` and its subclasses) handles the game logic: which slots exist, what items can go where, what happens when you click, and shift-click behavior.
2. **The screen** (`AbstractContainerScreen` and its subclasses) handles rendering: drawing the background texture, rendering items in slots, hover tooltips, and forwarding mouse clicks to the menu.

The menu is the brain. The screen is the face.

```
AbstractContainerMenu          -- slots, click logic, sync
    |
    v
CraftingMenu / FurnaceMenu    -- your specific menu
    |
    v
AbstractContainerScreen        -- rendering, mouse input
    |
    v
CraftingScreen / FurnaceScreen -- your specific screen
```

## AbstractContainerMenu: the base class

Every container menu inherits from `AbstractContainerMenu`. It lives in `Minecraft.World/AbstractContainerMenu.h`.

Here's what it gives you:

```cpp
class AbstractContainerMenu
{
public:
    static const int CLICKED_OUTSIDE = -999;

    static const int CLICK_PICKUP = 0;
    static const int CLICK_QUICK_MOVE = 1;
    static const int CLICK_SWAP = 2;
    static const int CLICK_CLONE = 3;

    vector<shared_ptr<ItemInstance>> *lastSlots;  // previous frame's items (for change detection)
    vector<Slot *> *slots;                         // all slots in this menu
    int containerId;

protected:
    vector<ContainerListener *> *containerListeners;

    AbstractContainerMenu();
    Slot *addSlot(Slot *slot);

public:
    virtual void broadcastChanges();
    virtual shared_ptr<ItemInstance> quickMoveStack(shared_ptr<Player> player, int slotIndex);
    virtual shared_ptr<ItemInstance> clicked(int slotIndex, int buttonNum, int clickType,
                                             shared_ptr<Player> player);
    virtual void removed(shared_ptr<Player> player);
    virtual void slotsChanged();
    virtual bool stillValid(shared_ptr<Player> player) = 0;

protected:
    bool moveItemStackTo(shared_ptr<ItemInstance> itemStack, int startSlot, int endSlot,
                         bool backwards);
};
```

The key things to know:

- **`addSlot()`** registers a slot in the menu. Each slot gets an auto-incrementing `index` based on the order you add them.
- **`clicked()`** is the big one. It handles all the pickup, place, swap, and clone logic. You usually don't need to override this.
- **`quickMoveStack()`** handles shift-click. You almost always need to override this because the base version does nothing useful.
- **`stillValid()`** is pure virtual. You must implement it. Return `false` if the player walked too far away or the block was destroyed.
- **`moveItemStackTo()`** is your helper for shift-click. It tries to move an item stack into a range of slots.
- **`broadcastChanges()`** compares current slot contents against `lastSlots` and notifies all `ContainerListener`s about changes.
- **`removed()`** is called when the player closes the menu. Drop any items the player left in crafting slots.

## How Slot works

The `Slot` class (`Minecraft.World/Slot.h`) represents one square in the container grid:

```cpp
class Slot
{
public:
    shared_ptr<Container> container;  // the backing inventory
    int index;                         // position in the menu's slot list
    int x, y;                          // pixel position for rendering

    Slot(shared_ptr<Container> container, int slot, int x, int y);

    virtual bool mayPlace(shared_ptr<ItemInstance> item);   // can this item go here?
    virtual bool mayPickup(shared_ptr<Player> player);      // can the player take from here?
    virtual shared_ptr<ItemInstance> getItem();
    virtual void set(shared_ptr<ItemInstance> item);
    virtual shared_ptr<ItemInstance> remove(int count);
    virtual int getMaxStackSize();                           // usually 64
    virtual void setChanged();
    virtual void onTake(shared_ptr<Player> player, shared_ptr<ItemInstance> carried);
};
```

The `x` and `y` values are pixel coordinates for where the slot renders on screen. The standard spacing is 18 pixels between slots (16px item icon + 2px gap).

### Custom slot subclasses

You can subclass `Slot` to restrict what goes in:

- **`ResultSlot`** blocks `mayPlace()` so you can't put items into the output. It also consumes crafting ingredients in `onTake()`.
- **`FurnaceResultSlot`** same idea but for furnace output, with smelting XP awards.
- **`ArmorSlot`** only accepts the right armor piece for that body slot.
- **`BrewingStandMenu::PotionSlot`** only accepts bottles. Also overrides `getMaxStackSize()` to return 1.
- **`BrewingStandMenu::IngredientsSlot`** only accepts valid brewing ingredients.

Here's how the brewing stand restricts its potion slots to stack size 1:

```cpp
class PotionSlot : public Slot
{
public:
    PotionSlot(shared_ptr<Player> player, shared_ptr<Container> container,
               int slot, int x, int y);

    virtual bool mayPlace(shared_ptr<ItemInstance> item);
    virtual int getMaxStackSize() { return 1; }
};
```

## Existing container types

Here's every menu in the codebase and what makes each one interesting:

| Menu class | Block | Slots | Notable features |
|---|---|---|---|
| `InventoryMenu` | Player inventory | Result + 4 craft + 4 armor + 27 inv + 9 hotbar | 2x2 crafting grid, armor slots |
| `CraftingMenu` | Crafting table | Result + 9 craft + 27 inv + 9 hotbar | 3x3 grid, recipe lookup in `slotsChanged()` |
| `ContainerMenu` | Chest/ender chest | N*9 container + 27 inv + 9 hotbar | Dynamic row count based on container size |
| `FurnaceMenu` | Furnace | Input + fuel + result + 27 inv + 9 hotbar | `broadcastChanges()` syncs tick count, burn time |
| `EnchantmentMenu` | Enchanting table | 1 ingredient + 27 inv + 9 hotbar | `clickMenuButton()` for enchant selection, random costs |
| `BrewingStandMenu` | Brewing stand | 3 bottles + 1 ingredient + 27 inv + 9 hotbar | Custom `PotionSlot` and `IngredientsSlot` |
| `RepairMenu` | Anvil | Input + addition + result + 27 inv + 9 hotbar | Complex cost calculation in `createResult()` |
| `TrapMenu` | Dispenser | 9 dispenser + 27 inv + 9 hotbar | 3x3 grid, simple layout |
| `MerchantMenu` | Villager | 2 input + 1 result + 27 inv + 9 hotbar | Trade offers, `clickMenuButton()` to select trade |

## Slot layout conventions

Every menu follows the same pattern for the player's inventory at the bottom:

```cpp
// Main inventory (3 rows of 9, slot indices 9-35 in the player inventory)
for (int y = 0; y < 3; y++)
{
    for (int x = 0; x < 9; x++)
    {
        addSlot(new Slot(inventory, x + y * 9 + 9, 8 + x * 18, 84 + y * 18));
    }
}

// Hotbar (slot indices 0-8 in the player inventory)
for (int x = 0; x < 9; x++)
{
    addSlot(new Slot(inventory, x, 8 + x * 18, 142));
}
```

The `8 + x * 18` puts slots 8 pixels from the left edge, each one 18 pixels apart. The Y values change depending on how tall your menu is.

The slot constants follow a naming convention to keep shift-click logic readable:

```cpp
static const int RESULT_SLOT = 0;
static const int CRAFT_SLOT_START = 1;
static const int CRAFT_SLOT_END = CRAFT_SLOT_START + 9;   // exclusive
static const int INV_SLOT_START = CRAFT_SLOT_END;
static const int INV_SLOT_END = INV_SLOT_START + 27;
static const int USE_ROW_SLOT_START = INV_SLOT_END;
static const int USE_ROW_SLOT_END = USE_ROW_SLOT_START + 9;
```

These constants make `quickMoveStack()` much easier to write.

## Shift-click behavior (quickMoveStack)

Shift-clicking is the most annoying part of writing a container menu. You need to tell the game where items go when shift-clicked from each zone.

The base `AbstractContainerMenu::quickMoveStack()` does basically nothing. You need to override it. The pattern is always the same:

1. Get the slot that was shift-clicked
2. Copy the item (to return later)
3. Figure out where the item should go based on which slot zone it came from
4. Call `moveItemStackTo()` to try putting it there
5. If the stack is now empty, clear the slot. Otherwise mark it changed.

Here's how the crafting table does it:

```cpp
shared_ptr<ItemInstance> CraftingMenu::quickMoveStack(shared_ptr<Player> player,
                                                       int slotIndex)
{
    shared_ptr<ItemInstance> clicked = nullptr;
    Slot *slot = slots->at(slotIndex);

    if (slot != NULL && slot->hasItem())
    {
        shared_ptr<ItemInstance> stack = slot->getItem();
        clicked = stack->copy();

        if (slotIndex == RESULT_SLOT)
        {
            // Result goes to inventory + hotbar
            if (!moveItemStackTo(stack, INV_SLOT_START, USE_ROW_SLOT_END, true))
                return nullptr;
            slot->onQuickCraft(stack, clicked);
        }
        else if (slotIndex >= INV_SLOT_START && slotIndex < INV_SLOT_END)
        {
            // Main inventory goes to hotbar
            if (!moveItemStackTo(stack, USE_ROW_SLOT_START, USE_ROW_SLOT_END, false))
                return nullptr;
        }
        else if (slotIndex >= USE_ROW_SLOT_START && slotIndex < USE_ROW_SLOT_END)
        {
            // Hotbar goes to main inventory
            if (!moveItemStackTo(stack, INV_SLOT_START, INV_SLOT_END, false))
                return nullptr;
        }
        else
        {
            // Craft slots go to inventory + hotbar
            if (!moveItemStackTo(stack, INV_SLOT_START, USE_ROW_SLOT_END, false))
                return nullptr;
        }

        if (stack->count == 0)
            slot->set(nullptr);
        else
            slot->setChanged();

        if (stack->count == clicked->count)
            return nullptr;  // nothing actually moved
        else
            slot->onTake(player, stack);
    }
    return clicked;
}
```

The `moveItemStackTo()` helper does the hard work. It takes a start slot, end slot (exclusive), and a `backwards` flag. It first tries to stack into existing matching slots, then fills empty ones. Returns `true` if anything moved.

For smarter shift-click (like the furnace sending smeltable items to the input slot and fuel to the fuel slot), check the item type before choosing the destination range:

```cpp
// From FurnaceMenu::quickMoveStack()
if (FurnaceRecipes::getInstance()->getResult(stack->getItem()->id) != NULL)
{
    // It's smeltable, send to ingredient slot
    if (!moveItemStackTo(stack, INGREDIENT_SLOT, INGREDIENT_SLOT + 1, false))
        return nullptr;
}
else if (FurnaceTileEntity::isFuel(stack))
{
    // It's fuel, send to fuel slot
    if (!moveItemStackTo(stack, FUEL_SLOT, FUEL_SLOT + 1, false))
        return nullptr;
}
```

## Syncing container state over the network

The container system uses `ContainerListener` to keep clients in sync:

```cpp
namespace net_minecraft_world_inventory
{
    class ContainerListener
    {
    public:
        virtual void refreshContainer(AbstractContainerMenu *container,
                                       vector<shared_ptr<ItemInstance>> *items) = 0;
        virtual void slotChanged(AbstractContainerMenu *container, int slotIndex,
                                  shared_ptr<ItemInstance> item) = 0;
        virtual void setContainerData(AbstractContainerMenu *container,
                                       int id, int value) = 0;
    };
}
```

There are three things that get synced:

1. **Full refresh** via `refreshContainer()`. Happens when a listener first connects (when the menu opens).
2. **Slot changes** via `slotChanged()`. Happens every time `broadcastChanges()` detects a slot differs from `lastSlots`.
3. **Data values** via `setContainerData()`. Used for things like furnace burn progress or anvil repair cost. Just integer key-value pairs.

The furnace menu is the best example of data syncing. It tracks three values:

```cpp
void FurnaceMenu::broadcastChanges()
{
    AbstractContainerMenu::broadcastChanges();  // handles slot changes

    for (auto *listener : *containerListeners)
    {
        if (tc != furnace->tickCount)
            listener->setContainerData(this, 0, furnace->tickCount);
        if (lt != furnace->litTime)
            listener->setContainerData(this, 1, furnace->litTime);
        if (ld != furnace->litDuration)
            listener->setContainerData(this, 2, furnace->litDuration);
    }

    tc = furnace->tickCount;
    lt = furnace->litTime;
    ld = furnace->litDuration;
}
```

On the receiving side, `setData()` writes the values back:

```cpp
void FurnaceMenu::setData(int id, int value)
{
    if (id == 0) furnace->tickCount = value;
    if (id == 1) furnace->litTime = value;
    if (id == 2) furnace->litDuration = value;
}
```

## Creating a custom container menu from scratch

Let's build a 5-slot "gem polisher" workbench. You put a raw gem in one slot, a polishing tool in another, and the result appears in the output slot. It also has two extra material slots for modifiers.

### Step 1: The backing container

You need a `Container` to store the items in your crafting grid. The `CraftingContainer` class already does this. It takes the menu, width, and height:

```cpp
// GemPolisherMenu.h
#pragma once
#include "AbstractContainerMenu.h"

class CraftingContainer;
class Container;

class GemPolisherMenu : public AbstractContainerMenu
{
public:
    static const int GEM_SLOT = 0;
    static const int TOOL_SLOT = 1;
    static const int MODIFIER_SLOT_1 = 2;
    static const int MODIFIER_SLOT_2 = 3;
    static const int RESULT_SLOT = 4;

    static const int INV_SLOT_START = 5;
    static const int INV_SLOT_END = INV_SLOT_START + 27;
    static const int USE_ROW_SLOT_START = INV_SLOT_END;
    static const int USE_ROW_SLOT_END = USE_ROW_SLOT_START + 9;

    shared_ptr<CraftingContainer> polishSlots;
    shared_ptr<Container> resultSlots;

private:
    Level *level;
    int x, y, z;

public:
    GemPolisherMenu(shared_ptr<Inventory> inventory, Level *level,
                    int xt, int yt, int zt);

    virtual void slotsChanged();
    virtual void removed(shared_ptr<Player> player);
    virtual bool stillValid(shared_ptr<Player> player);
    virtual shared_ptr<ItemInstance> quickMoveStack(shared_ptr<Player> player,
                                                     int slotIndex);
};
```

### Step 2: Implement the menu

```cpp
// GemPolisherMenu.cpp
#include "stdafx.h"
#include "net.minecraft.world.entity.player.h"
#include "net.minecraft.world.level.h"
#include "net.minecraft.world.level.tile.h"
#include "net.minecraft.world.item.h"
#include "CraftingContainer.h"
#include "ResultContainer.h"
#include "ResultSlot.h"
#include "GemPolisherMenu.h"

GemPolisherMenu::GemPolisherMenu(shared_ptr<Inventory> inventory, Level *level,
                                   int xt, int yt, int zt)
    : AbstractContainerMenu()
{
    // 4 input slots arranged as a 4x1 grid internally
    polishSlots = shared_ptr<CraftingContainer>(new CraftingContainer(this, 4, 1));
    resultSlots = shared_ptr<ResultContainer>(new ResultContainer());

    this->level = level;
    this->x = xt;
    this->y = yt;
    this->z = zt;

    // Gem input (left side)
    addSlot(new Slot(polishSlots, 0, 26, 35));

    // Tool slot (next to gem)
    addSlot(new Slot(polishSlots, 1, 50, 35));

    // Two modifier slots (below)
    addSlot(new Slot(polishSlots, 2, 26, 59));
    addSlot(new Slot(polishSlots, 3, 50, 59));

    // Result slot (right side, using ResultSlot so you can't place items in it)
    addSlot(new ResultSlot(inventory->player, polishSlots, resultSlots, 0, 120, 47));

    // Player inventory (standard layout)
    for (int row = 0; row < 3; row++)
    {
        for (int col = 0; col < 9; col++)
        {
            addSlot(new Slot(inventory, col + row * 9 + 9,
                             8 + col * 18, 84 + row * 18));
        }
    }

    // Hotbar
    for (int col = 0; col < 9; col++)
    {
        addSlot(new Slot(inventory, col, 8 + col * 18, 142));
    }

    slotsChanged();
}
```

### Step 3: Recipe checking

When any slot changes, `slotsChanged()` gets called. This is where you check if the current inputs produce a result:

```cpp
void GemPolisherMenu::slotsChanged()
{
    // Check if we have a valid gem + tool combination
    shared_ptr<ItemInstance> gem = polishSlots->getItem(0);
    shared_ptr<ItemInstance> tool = polishSlots->getItem(1);

    if (gem != NULL && tool != NULL)
    {
        // Example: raw ruby + flint = polished ruby
        if (gem->id == Item::ruby_raw_Id && tool->id == Item::flint_Id)
        {
            shared_ptr<ItemInstance> result =
                shared_ptr<ItemInstance>(new ItemInstance(Item::ruby, 1));

            // Check modifiers for bonus output
            shared_ptr<ItemInstance> mod1 = polishSlots->getItem(2);
            if (mod1 != NULL && mod1->id == Item::glowstoneDust_Id)
            {
                result->count = 2;  // glowstone doubles the output
            }

            resultSlots->setItem(0, result);
            return;
        }
    }

    resultSlots->setItem(0, nullptr);
}
```

For a real mod, you'd want a proper recipe registry instead of hardcoded checks. But this shows the idea.

### Step 4: Cleanup when closed

When the player closes the menu, drop any items left in the input slots back to them:

```cpp
void GemPolisherMenu::removed(shared_ptr<Player> player)
{
    AbstractContainerMenu::removed(player);  // drops carried item
    if (level->isClientSide) return;

    for (int i = 0; i < 4; i++)
    {
        shared_ptr<ItemInstance> item = polishSlots->removeItemNoUpdate(i);
        if (item != NULL)
        {
            player->drop(item);
        }
    }
}
```

### Step 5: Validity check

Keep the menu open only if the block still exists and the player is close enough:

```cpp
bool GemPolisherMenu::stillValid(shared_ptr<Player> player)
{
    if (level->getTile(x, y, z) != Tile::gemPolisher_Id) return false;
    if (player->distanceToSqr(x + 0.5, y + 0.5, z + 0.5) > 64.0) return false;
    return true;
}
```

The `64.0` is `8 * 8`, which is 8 blocks. This matches the vanilla crafting table range.

### Step 6: Shift-click logic

```cpp
shared_ptr<ItemInstance> GemPolisherMenu::quickMoveStack(shared_ptr<Player> player,
                                                          int slotIndex)
{
    shared_ptr<ItemInstance> clicked = nullptr;
    Slot *slot = slots->at(slotIndex);

    if (slot != NULL && slot->hasItem())
    {
        shared_ptr<ItemInstance> stack = slot->getItem();
        clicked = stack->copy();

        if (slotIndex == RESULT_SLOT)
        {
            // Output goes to player inventory
            if (!moveItemStackTo(stack, INV_SLOT_START, USE_ROW_SLOT_END, true))
                return nullptr;
            slot->onQuickCraft(stack, clicked);
        }
        else if (slotIndex >= GEM_SLOT && slotIndex <= MODIFIER_SLOT_2)
        {
            // Input slots go to player inventory
            if (!moveItemStackTo(stack, INV_SLOT_START, USE_ROW_SLOT_END, false))
                return nullptr;
        }
        else if (slotIndex >= INV_SLOT_START && slotIndex < INV_SLOT_END)
        {
            // Main inventory goes to hotbar
            if (!moveItemStackTo(stack, USE_ROW_SLOT_START, USE_ROW_SLOT_END, false))
                return nullptr;
        }
        else if (slotIndex >= USE_ROW_SLOT_START && slotIndex < USE_ROW_SLOT_END)
        {
            // Hotbar goes to main inventory
            if (!moveItemStackTo(stack, INV_SLOT_START, INV_SLOT_END, false))
                return nullptr;
        }

        if (stack->count == 0)
            slot->set(nullptr);
        else
            slot->setChanged();

        if (stack->count == clicked->count)
            return nullptr;
        else
            slot->onTake(player, stack);
    }
    return clicked;
}
```

### Step 7: The screen

You also need a screen class to render the UI. See the [Custom GUI Screens](/lcemp-docs/modding/custom-screens/) guide for the full screen system. The short version:

```cpp
// GemPolisherScreen.h
#pragma once
#include "AbstractContainerScreen.h"

class GemPolisherScreen : public AbstractContainerScreen
{
public:
    GemPolisherScreen(shared_ptr<Inventory> inventory, Level *level,
                      int x, int y, int z)
        : AbstractContainerScreen(new GemPolisherMenu(inventory, level, x, y, z))
    {
        passEvents = false;
    }

protected:
    virtual void renderBg(float a);
    virtual void renderLabels();
};
```

The `AbstractContainerScreen` base class already handles rendering items in slots, hover highlights, click forwarding, and tooltip display. You just need to draw your background texture.

### Step 8: Open the menu from a block

In your custom tile entity or block's `use()` method:

```cpp
bool GemPolisherTile::use(Level *level, int x, int y, int z,
                           shared_ptr<Player> player)
{
    if (level->isClientSide) return true;

    player->openMenu(new GemPolisherScreen(player->inventory, level, x, y, z));
    return true;
}
```

## Custom slot restrictions

If you want a slot that only accepts certain items, subclass `Slot` and override `mayPlace()`:

```cpp
class GemOnlySlot : public Slot
{
public:
    GemOnlySlot(shared_ptr<Container> container, int slot, int x, int y)
        : Slot(container, slot, x, y) {}

    virtual bool mayPlace(shared_ptr<ItemInstance> item)
    {
        if (item == NULL) return false;
        // Only accept ruby, emerald, diamond
        return item->id == Item::ruby_Id
            || item->id == Item::emerald_Id
            || item->id == Item::diamond_Id;
    }

    virtual int getMaxStackSize()
    {
        return 1;  // one gem at a time
    }
};
```

Then use it in your menu constructor instead of a regular `Slot`:

```cpp
addSlot(new GemOnlySlot(polishSlots, 0, 26, 35));
```

## Adding data sync for progress bars

If your menu has progress (like a furnace's smelt timer), you sync it with integer data IDs:

```cpp
// In your menu header
static const int DATA_PROGRESS = 0;
static const int DATA_MAX_PROGRESS = 1;

// Override broadcastChanges()
void GemPolisherMenu::broadcastChanges()
{
    AbstractContainerMenu::broadcastChanges();

    for (auto *listener : *containerListeners)
    {
        if (cachedProgress != tileEntity->progress)
            listener->setContainerData(this, DATA_PROGRESS, tileEntity->progress);
        if (cachedMaxProgress != tileEntity->maxProgress)
            listener->setContainerData(this, DATA_MAX_PROGRESS, tileEntity->maxProgress);
    }

    cachedProgress = tileEntity->progress;
    cachedMaxProgress = tileEntity->maxProgress;
}

// Override setData() to receive on client
void GemPolisherMenu::setData(int id, int value)
{
    if (id == DATA_PROGRESS) tileEntity->progress = value;
    if (id == DATA_MAX_PROGRESS) tileEntity->maxProgress = value;
}

// Send initial values when a listener connects
void GemPolisherMenu::addSlotListener(ContainerListener *listener)
{
    AbstractContainerMenu::addSlotListener(listener);
    listener->setContainerData(this, DATA_PROGRESS, tileEntity->progress);
    listener->setContainerData(this, DATA_MAX_PROGRESS, tileEntity->maxProgress);
}
```

## The click system in detail

You usually don't need to touch `clicked()`, but it helps to know what it does. The base implementation in `AbstractContainerMenu` handles four click types:

| Click type | Constant | What it does |
|---|---|---|
| Pickup | `CLICK_PICKUP` | Left-click picks up a full stack, right-click picks up half. Place items into slots. Swap items if types don't match. |
| Quick move | `CLICK_QUICK_MOVE` | Shift-click. Calls your `quickMoveStack()` override. |
| Swap | `CLICK_SWAP` | Hotbar number keys (1-9). Swaps the hovered slot with a hotbar slot. |
| Clone | `CLICK_CLONE` | Middle-click in creative mode. Copies a full stack to the cursor. |

Clicking outside the menu window (`CLICKED_OUTSIDE = -999`) drops the carried item into the world.

## Key source files

- `Minecraft.World/AbstractContainerMenu.h` and `.cpp` for the base menu class
- `Minecraft.World/Slot.h` for the slot system
- `Minecraft.World/ContainerMenu.h` and `.cpp` for the chest menu (simplest example)
- `Minecraft.World/CraftingMenu.h` and `.cpp` for crafting table with recipe lookup
- `Minecraft.World/FurnaceMenu.h` and `.cpp` for data sync and smart shift-click
- `Minecraft.World/RepairMenu.h` and `.cpp` for the anvil's complex result calculation
- `Minecraft.World/BrewingStandMenu.h` for custom slot subclasses
- `Minecraft.World/ResultSlot.h` for output-only slots
- `Minecraft.World/CraftingContainer.h` for backing container storage
- `Minecraft.World/net.minecraft.world.inventory.ContainerListener.h` for the sync interface
- `Minecraft.Client/AbstractContainerScreen.h` and `.cpp` for the rendering side

## Related guides

- [Custom GUI Screens](/lcemp-docs/modding/custom-screens/) for the screen and rendering system
- [Adding Items](/lcemp-docs/modding/adding-items/) for creating the items that go in your container
- [Adding Blocks](/lcemp-docs/modding/adding-blocks/) for creating the block that opens your container
