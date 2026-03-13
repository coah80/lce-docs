---
title: Custom Trades
description: How the villager trading system works in LCE and how to add custom trades.
---

This guide covers the villager trading system in LCE. We will look at how trade offers are built, how the `Merchant` interface works, every profession's trade pool in detail, and how you can add your own trades or even create custom merchant entities.

## Trading System Overview

Trading in LCE is built around a few key classes:

| Class | Role |
|-------|------|
| `Merchant` | Interface that any tradeable entity implements |
| `Villager` | The main entity that implements `Merchant` |
| `MerchantRecipe` | A single trade offer (buy items in, sell item out) |
| `MerchantRecipeList` | A list of recipes that a merchant offers |
| `MerchantMenu` | The container/UI for the trading screen |
| `MerchantContainer` | Holds the 3 item slots (2 payment + 1 result) |
| `MerchantResultSlot` | Special slot that handles payment deduction |
| `ClientSideMerchant` | Client-side proxy used for rendering the trade UI |

## The Merchant Interface

Any entity that wants to trade needs to implement the `Merchant` interface from `Minecraft.World/Merchant.h`:

```cpp
class Merchant
{
public:
    virtual void setTradingPlayer(shared_ptr<Player> player) = 0;
    virtual shared_ptr<Player> getTradingPlayer() = 0;
    virtual MerchantRecipeList *getOffers(shared_ptr<Player> forPlayer) = 0;
    virtual void overrideOffers(MerchantRecipeList *recipeList) = 0;
    virtual void notifyTrade(MerchantRecipe *activeRecipe) = 0;
    virtual void notifyTradeUpdated(shared_ptr<ItemInstance> item) = 0;
    virtual int getDisplayName() = 0;
};
```

`Villager` inherits from both `AgableMob` and `Merchant`:

```cpp
class Villager : public AgableMob, public Npc, public Merchant
```

## How MerchantRecipe Works

Each trade is a `MerchantRecipe` with up to 2 input items and 1 output item:

```cpp
class MerchantRecipe
{
private:
    shared_ptr<ItemInstance> buyA;   // Required payment item
    shared_ptr<ItemInstance> buyB;   // Optional second payment item
    shared_ptr<ItemInstance> sell;   // What the player gets
    int uses;                        // How many times this trade has been used
    int maxUses;                     // Max uses before the trade locks (default: 7)
};
```

You can create recipes with different constructors:

```cpp
// Simple: one item in, one item out
new MerchantRecipe(
    shared_ptr<ItemInstance>(new ItemInstance(Item::emerald, 5)),
    shared_ptr<ItemInstance>(new ItemInstance(Item::sword_diamond))
);

// Two items in, one item out
new MerchantRecipe(
    shared_ptr<ItemInstance>(new ItemInstance(Item::book)),
    shared_ptr<ItemInstance>(new ItemInstance(Item::emerald, 10)),
    shared_ptr<ItemInstance>(new ItemInstance(Item::enchantedBook))
);

// With custom use limits
new MerchantRecipe(buyA, buyB, sell, 0 /* uses */, 20 /* maxUses */);
```

### Trade Deprecation

Trades have a limited number of uses. After `uses >= maxUses`, the trade is "deprecated" (locked out). The default max is 7 uses.

```cpp
bool MerchantRecipe::isDeprecated()
{
    return uses >= maxUses;
}
```

When a player buys the last item in a villager's offer list, the villager starts a refresh timer. After about 2 seconds, it unlocks deprecated trades by adding more uses:

```cpp
if (recipe->isDeprecated())
{
    recipe->increaseMaxUses(random->nextInt(6) + random->nextInt(6) + 2);
}
```

This adds 2-12 extra uses to each locked trade.

## Villager Professions

Villagers have 5 professions, each with different trade pools:

| Constant | Value | Skin |
|----------|-------|------|
| `PROFESSION_FARMER` | 0 | Brown robe |
| `PROFESSION_LIBRARIAN` | 1 | White robe |
| `PROFESSION_PRIEST` | 2 | Purple robe |
| `PROFESSION_SMITH` | 3 | Black apron |
| `PROFESSION_BUTCHER` | 4 | White apron |

## How Villager Trades Are Generated

When a player first interacts with a villager, `getOffers()` is called. If no offers exist yet, `addOffers(1)` generates them:

```cpp
MerchantRecipeList *Villager::getOffers(shared_ptr<Player> forPlayer)
{
    if (offers == NULL)
    {
        addOffers(1);
    }
    return offers;
}
```

The `addOffers()` method builds a full pool of possible trades based on profession, then picks from them. Here is how it works:

1. Create a temporary `newOffers` list
2. Add all possible trades for this profession (each with a random chance of appearing)
3. Shuffle the list randomly
4. Add `addCount` trades from the shuffled list to the villager's permanent offers (only if they are new or better)
5. If nothing was generated, fall back to a gold ingot trade-in

The `addCount` parameter is 1, meaning each call adds at most 1 new trade. The first time generates the full pool and picks 1. After that, each trade refresh adds 1 more.

### The Recipe Chance System

Each trade in the pool has a base chance of appearing. The `getRecipeChance()` method applies a modifier and caps at 0.9:

```cpp
float Villager::getRecipeChance(float baseChance)
{
    float newChance = baseChance + baseRecipeChanceMod;
    if (newChance > .9f)
    {
        return .9f - (newChance - .9f);
    }
    return newChance;
}
```

The `baseRecipeChanceMod` starts at 0 and can shift over time. If the modified chance would exceed 0.9, it wraps back down.

### Trade-In vs Purchase

There are two types of trades:

**Trade-In** (`addItemForTradeIn`): Player gives items, gets 1 emerald. The quantity required comes from the `MIN_MAX_VALUES` table.

**Purchase** (`addItemForPurchase`): Player pays emeralds, gets an item. The cost comes from the `MIN_MAX_PRICES` table. Negative prices mean 1 emerald buys multiple items.

```cpp
void Villager::addItemForPurchase(MerchantRecipeList *list, int itemId,
                                   Random *random, float likelyHood)
{
    if (random->nextFloat() < likelyHood)
    {
        int purchaseCost = getPurchaseCost(itemId, random);
        shared_ptr<ItemInstance> rubyItem;
        shared_ptr<ItemInstance> resultItem;
        if (purchaseCost < 0)
        {
            // Negative: 1 emerald buys multiple items
            rubyItem = shared_ptr<ItemInstance>(
                new ItemInstance(Item::emerald_Id, 1, 0));
            resultItem = shared_ptr<ItemInstance>(
                new ItemInstance(itemId, -purchaseCost, 0));
        }
        else
        {
            // Positive: multiple emeralds buy 1 item
            rubyItem = shared_ptr<ItemInstance>(
                new ItemInstance(Item::emerald_Id, purchaseCost, 0));
            resultItem = shared_ptr<ItemInstance>(
                new ItemInstance(itemId, 1, 0));
        }
        list->push_back(new MerchantRecipe(rubyItem, resultItem));
    }
}
```

## Every Profession's Trade Pool

Here is every trade for every profession, pulled directly from `Villager::addOffers()` in `Villager.cpp`.

### Farmer (Profession 0)

**Trade-Ins** (player gives items, gets 1 emerald):

| Item | Quantity per Emerald | Base Chance |
|------|---------------------|-------------|
| Wheat | 18-22 | 90% |
| Wool (any color) | 14-22 | 50% |
| Raw Chicken | 14-18 | 50% |
| Cooked Fish | 9-13 | 40% |

**Purchases** (player pays emeralds, gets items):

| Item | Price | Base Chance |
|------|-------|-------------|
| Bread | 1 emerald for 2-4 | 90% |
| Melon | 1 emerald for 4-8 | 30% |
| Apple | 1 emerald for 4-8 | 30% |
| Cookie | 1 emerald for 7-10 | 30% |
| Shears | 3-4 emeralds | 30% |
| Flint & Steel | 3-4 emeralds | 30% |
| Cooked Chicken | 1 emerald for 6-8 | 30% |
| Arrow | 1 emerald for 8-12 | 50% |

**Special Trade:**

| Input 1 | Input 2 | Output | Chance |
|---------|---------|--------|--------|
| 10 Gravel | 1 Emerald | 2-3 Flint | 50% |

### Librarian (Profession 1)

**Trade-Ins:**

| Item | Quantity per Emerald | Base Chance |
|------|---------------------|-------------|
| Paper | 24-36 | 80% |
| Book | 11-13 | 80% |

**Purchases:**

| Item | Price | Base Chance |
|------|-------|-------------|
| Bookshelf | 3-4 emeralds | 80% |
| Glass | 1 emerald for 3-5 | 20% |
| Compass | 10-12 emeralds | 20% |
| Clock | 10-12 emeralds | 20% |

**Special Trade:**

| Input 1 | Input 2 | Output | Chance |
|---------|---------|--------|--------|
| 1 Book | Variable emeralds | Enchanted Book | 7% |

The enchanted book trade picks a random enchantment from `Enchantment::validEnchantments` at a random level between its min and max. The emerald cost is `2 + random(5 + level*10) + 3*level`. So a level 1 enchantment costs 5-16 emeralds and a level 5 enchantment costs 17-67 emeralds.

```cpp
if (random->nextFloat() < getRecipeChance(0.07f))
{
    Enchantment *enchantment = Enchantment::validEnchantments[
        random->nextInt(Enchantment::validEnchantments.size())];
    int level = Mth::nextInt(random, enchantment->getMinLevel(),
                             enchantment->getMaxLevel());
    shared_ptr<ItemInstance> book =
        Item::enchantedBook->createForEnchantment(
            new EnchantmentInstance(enchantment, level));
    int cost = 2 + random->nextInt(5 + (level * 10)) + 3 * level;

    newOffers->push_back(new MerchantRecipe(
        shared_ptr<ItemInstance>(new ItemInstance(Item::book)),
        shared_ptr<ItemInstance>(new ItemInstance(Item::emerald, cost)),
        book));
}
```

### Priest (Profession 2)

The priest has no trade-ins. All trades are purchases.

**Purchases:**

| Item | Price | Base Chance |
|------|-------|-------------|
| Eye of Ender | 7-11 emeralds | 30% |
| XP Bottle | 1 emerald for 1-4 | 20% |
| Redstone | 1 emerald for 1-4 | 40% |
| Glowstone | 1 emerald for 1-3 | 30% |

**Special Trades (Enchanted Gear):**

The priest can offer enchanted iron and diamond gear. There are 8 possible items:

| Item | Chance (each) |
|------|--------------|
| Iron Sword | 5% |
| Diamond Sword | 5% |
| Iron Chestplate | 5% |
| Diamond Chestplate | 5% |
| Iron Axe | 5% |
| Diamond Axe | 5% |
| Iron Pickaxe | 5% |
| Diamond Pickaxe | 5% |

Each one that appears costs 2-4 emeralds and the item is enchanted at level 5-19 (`5 + random(15)`):

```cpp
int enchantItems[] = {
    Item::sword_iron_Id, Item::sword_diamond_Id,
    Item::chestplate_iron_Id, Item::chestplate_diamond_Id,
    Item::hatchet_iron_Id, Item::hatchet_diamond_Id,
    Item::pickAxe_iron_Id, Item::pickAxe_diamond_Id
};
for (unsigned int i = 0; i < 8; ++i)
{
    int id = enchantItems[i];
    if (random->nextFloat() < getRecipeChance(.05f))
    {
        newOffers->push_back(new MerchantRecipe(
            shared_ptr<ItemInstance>(new ItemInstance(id, 1, 0)),
            shared_ptr<ItemInstance>(
                new ItemInstance(Item::emerald, 2 + random->nextInt(3), 0)),
            EnchantmentHelper::enchantItem(random,
                shared_ptr<ItemInstance>(new ItemInstance(id, 1, 0)),
                5 + random->nextInt(15))));
    }
}
```

### Smith (Profession 3)

**Trade-Ins:**

| Item | Quantity per Emerald | Base Chance |
|------|---------------------|-------------|
| Coal | 16-24 | 70% |
| Iron Ingot | 8-10 | 50% |
| Gold Ingot | 8-10 | 50% |
| Diamond | 4-6 | 50% |

**Purchases (Tools):**

| Item | Price (emeralds) | Base Chance |
|------|-----------------|-------------|
| Iron Sword | 7-11 | 50% |
| Diamond Sword | 12-14 | 50% |
| Iron Axe | 6-8 | 30% |
| Diamond Axe | 9-12 | 30% |
| Iron Pickaxe | 7-9 | 50% |
| Diamond Pickaxe | 10-12 | 50% |
| Iron Shovel | 4-6 | 20% |
| Diamond Shovel | 7-8 | 20% |
| Iron Hoe | 4-6 | 20% |
| Diamond Hoe | 7-8 | 20% |

**Purchases (Armor):**

| Item | Price (emeralds) | Base Chance |
|------|-----------------|-------------|
| Iron Boots | 4-6 | 20% |
| Diamond Boots | 7-8 | 20% |
| Iron Helmet | 4-6 | 20% |
| Diamond Helmet | 7-8 | 20% |
| Iron Chestplate | 10-14 | 20% |
| Diamond Chestplate | 16-19 | 20% |
| Iron Leggings | 8-10 | 20% |
| Diamond Leggings | 11-14 | 20% |
| Chain Boots | 5-7 | 10% |
| Chain Helmet | 5-7 | 10% |
| Chain Chestplate | 11-15 | 10% |
| Chain Leggings | 9-11 | 10% |

The smith has the biggest trade pool. With 4 trade-ins and 22 purchases, there are 26 possible trades.

### Butcher (Profession 4)

**Trade-Ins:**

| Item | Quantity per Emerald | Base Chance |
|------|---------------------|-------------|
| Coal | 16-24 | 70% |
| Raw Porkchop | 14-18 | 50% |
| Raw Beef | 14-18 | 50% |

**Purchases:**

| Item | Price | Base Chance |
|------|-------|-------------|
| Saddle | 6-8 emeralds | 10% |
| Leather Chestplate | 4-5 emeralds | 30% |
| Leather Boots | 2-4 emeralds | 30% |
| Leather Helmet | 2-4 emeralds | 30% |
| Leather Leggings | 2-4 emeralds | 30% |
| Cooked Porkchop | 1 emerald for 5-7 | 30% |
| Cooked Beef | 1 emerald for 5-7 | 30% |

### Fallback Trade

If the profession's trade pool generates zero trades (all random chances failed), the code falls back to a guaranteed gold ingot trade-in:

```cpp
if (newOffers->empty())
{
    addItemForTradeIn(newOffers, Item::goldIngot_Id, random, 1.0f);
}
```

This uses 8-10 gold ingots per emerald and has a 100% chance of appearing.

## Complete Price Tables

### MIN_MAX_VALUES (Trade-In Quantities)

How many items the villager wants per emerald:

| Item | Min | Max |
|------|-----|-----|
| Wheat | 18 | 22 |
| Wool | 14 | 22 |
| Raw Chicken | 14 | 18 |
| Cooked Fish | 9 | 13 |
| Coal | 16 | 24 |
| Iron Ingot | 8 | 10 |
| Gold Ingot | 8 | 10 |
| Diamond | 4 | 6 |
| Paper | 24 | 36 |
| Book | 11 | 13 |
| Ender Pearl | 3 | 4 |
| Eye of Ender | 2 | 3 |
| Raw Porkchop | 14 | 18 |
| Raw Beef | 14 | 18 |
| Wheat Seeds | 34 | 48 |
| Melon Seeds | 30 | 38 |
| Pumpkin Seeds | 30 | 38 |
| Rotten Flesh | 36 | 64 |

:::note
Wheat Seeds, Melon Seeds, Pumpkin Seeds, and Rotten Flesh are in the `MIN_MAX_VALUES` table but are not used by any profession's `addOffers()` code. They are leftover from Java Edition's more complex trading system.
:::

### MIN_MAX_PRICES (Purchase Costs)

Positive values are emeralds per item. Negative values mean 1 emerald buys that many items.

| Item | Min | Max | Meaning |
|------|-----|-----|---------|
| Bread | -4 | -2 | 2-4 bread per emerald |
| Melon | -8 | -4 | 4-8 melon per emerald |
| Apple | -8 | -4 | 4-8 apple per emerald |
| Cookie | -10 | -7 | 7-10 cookies per emerald |
| Cooked Chicken | -8 | -6 | 6-8 per emerald |
| Arrow | -12 | -8 | 8-12 arrows per emerald |
| Cooked Porkchop | -7 | -5 | 5-7 per emerald |
| Cooked Beef | -7 | -5 | 5-7 per emerald |
| XP Bottle | -4 | -1 | 1-4 per emerald |
| Redstone | -4 | -1 | 1-4 per emerald |
| Glowstone | -3 | -1 | 1-3 per emerald |
| Glass | -5 | -3 | 3-5 per emerald |
| Shears | 3 | 4 | 3-4 emeralds each |
| Flint & Steel | 3 | 4 | 3-4 emeralds each |
| Iron Sword | 7 | 11 | 7-11 emeralds |
| Diamond Sword | 12 | 14 | 12-14 emeralds |
| Iron Axe | 6 | 8 | 6-8 emeralds |
| Diamond Axe | 9 | 12 | 9-12 emeralds |
| Iron Pickaxe | 7 | 9 | 7-9 emeralds |
| Diamond Pickaxe | 10 | 12 | 10-12 emeralds |
| Iron Shovel | 4 | 6 | 4-6 emeralds |
| Diamond Shovel | 7 | 8 | 7-8 emeralds |
| Iron Hoe | 4 | 6 | 4-6 emeralds |
| Diamond Hoe | 7 | 8 | 7-8 emeralds |
| Iron Boots | 4 | 6 | 4-6 emeralds |
| Diamond Boots | 7 | 8 | 7-8 emeralds |
| Iron Helmet | 4 | 6 | 4-6 emeralds |
| Diamond Helmet | 7 | 8 | 7-8 emeralds |
| Iron Chestplate | 10 | 14 | 10-14 emeralds |
| Diamond Chestplate | 16 | 19 | 16-19 emeralds |
| Iron Leggings | 8 | 10 | 8-10 emeralds |
| Diamond Leggings | 11 | 14 | 11-14 emeralds |
| Chain Boots | 5 | 7 | 5-7 emeralds |
| Chain Helmet | 5 | 7 | 5-7 emeralds |
| Chain Chestplate | 11 | 15 | 11-15 emeralds |
| Chain Leggings | 9 | 11 | 9-11 emeralds |
| Leather Chestplate | 4 | 5 | 4-5 emeralds |
| Leather Boots | 2 | 4 | 2-4 emeralds |
| Leather Helmet | 2 | 4 | 2-4 emeralds |
| Leather Leggings | 2 | 4 | 2-4 emeralds |
| Bookshelf | 3 | 4 | 3-4 emeralds |
| Saddle | 6 | 8 | 6-8 emeralds |
| Compass | 10 | 12 | 10-12 emeralds |
| Clock | 10 | 12 | 10-12 emeralds |
| Eye of Ender | 7 | 11 | 7-11 emeralds |

## The Trading UI Flow

When a player right-clicks a villager, here is what happens:

1. `Villager::interact()` sets the trading player and opens the trade UI:
```cpp
bool Villager::interact(shared_ptr<Player> player)
{
    // ...
    if (!holdingSpawnEgg && isAlive() && !isTrading() && !isBaby())
    {
        if (!level->isClientSide)
        {
            setTradingPlayer(player);
            player->openTrading(
                dynamic_pointer_cast<Merchant>(shared_from_this()));
        }
        return true;
    }
    // ...
}
```

2. A `MerchantMenu` is created with 3 slots (2 payment + 1 result) plus the player's inventory.

3. When the player places items in the payment slots, `MerchantContainer::updateSellItem()` searches for a matching recipe:
```cpp
MerchantRecipe *recipeFor = offers->getRecipeFor(buyItem1, buyItem2,
                                                  selectionHint);
if (recipeFor != NULL && !recipeFor->isDeprecated())
{
    activeRecipe = recipeFor;
    setItem(MerchantMenu::RESULT_SLOT, recipeFor->getSellItem()->copy());
}
```

4. When the player takes the result, `MerchantResultSlot::onTake()` deducts the payment items and calls `merchant->notifyTrade()`.

5. The `TradeWithPlayerGoal` AI goal keeps the villager still and facing the player during the trade. It stops when the player moves too far away (>4 blocks) or closes the menu.

## Trade Refresh System

After a player buys the last recipe in a villager's list, the villager queues a refresh:

```cpp
void Villager::notifyTrade(MerchantRecipe *activeRecipe)
{
    activeRecipe->increaseUses();
    // ...
    if (activeRecipe->isSame(offers->at(offers->size() - 1)))
    {
        updateMerchantTimer = SharedConstants::TICKS_PER_SECOND * 2;
        addRecipeOnUpdate = true;
        // ...
    }
    // ...
}
```

After 2 seconds, the refresh runs in `serverAiMobStep()`:
- All deprecated recipes get 2-12 extra uses
- A new recipe is added via `addOffers(1)`
- The villager gets 10 seconds of Regeneration
- If in a village, the last player to trade gets +1 reputation

## Adding Custom Trades to Existing Villagers

The simplest way to add trades is to modify the `addOffers()` method in `Villager.cpp`. Add entries to the profession's switch case:

```cpp
case PROFESSION_SMITH:
    // ... existing trades ...

    // Add a new trade-in item (player gives items for emeralds)
    addItemForTradeIn(newOffers, Item::myCustomIngot_Id, random,
                      getRecipeChance(.6f));

    // Add a new purchase (player pays emeralds for items)
    addItemForPurchase(newOffers, Item::myCustomSword_Id, random,
                       getRecipeChance(.4f));

    // Add a complex three-item trade
    if (random->nextFloat() < getRecipeChance(.3f))
    {
        newOffers->push_back(new MerchantRecipe(
            shared_ptr<ItemInstance>(new ItemInstance(Item::emerald, 15)),
            shared_ptr<ItemInstance>(new ItemInstance(Item::diamond, 3)),
            shared_ptr<ItemInstance>(new ItemInstance(Item::myCustomArmor_Id, 1, 0))
        ));
    }
    break;
```

Don't forget to register the price ranges in `Villager::staticCtor()`:

```cpp
void Villager::staticCtor()
{
    // ... existing entries ...

    // For trade-in items: how many items per emerald
    MIN_MAX_VALUES[Item::myCustomIngot_Id] = pair<int,int>(6, 10);

    // For purchases: emerald cost (negative = multi-item output)
    MIN_MAX_PRICES[Item::myCustomSword_Id] = pair<int,int>(8, 12);
}
```

## Creating a Custom Merchant Entity

You can make any entity into a merchant. It needs to implement the `Merchant` interface and trigger the trade UI. Here is a skeleton:

### Header

```cpp
#pragma once
#include "PathfinderMob.h"
#include "Merchant.h"

class MyMerchant : public PathfinderMob, public Merchant
{
public:
    eINSTANCEOF GetType() { return eTYPE_MY_MERCHANT; }
    static Entity *create(Level *level) { return new MyMerchant(level); }

    MyMerchant(Level *level);
    ~MyMerchant();

    // Merchant interface
    void setTradingPlayer(shared_ptr<Player> player);
    shared_ptr<Player> getTradingPlayer();
    MerchantRecipeList *getOffers(shared_ptr<Player> forPlayer);
    void overrideOffers(MerchantRecipeList *recipeList);
    void notifyTrade(MerchantRecipe *activeRecipe);
    void notifyTradeUpdated(shared_ptr<ItemInstance> item);
    int getDisplayName();

    bool interact(shared_ptr<Player> player);
    virtual int getMaxHealth();

private:
    weak_ptr<Player> tradingPlayer;
    MerchantRecipeList *offers;
    void buildOffers();
};
```

### Implementation

```cpp
MyMerchant::MyMerchant(Level *level) : PathfinderMob(level)
{
    this->defineSynchedData();
    health = getMaxHealth();
    offers = NULL;
    tradingPlayer = weak_ptr<Player>();

    // Add AI goals for a non-hostile NPC
    goalSelector.addGoal(0, new FloatGoal(this));
    goalSelector.addGoal(1, new TradeWithPlayerGoal(
        reinterpret_cast<Villager*>(this)));
    goalSelector.addGoal(2, new RandomStrollGoal(this, 0.3f));
    goalSelector.addGoal(3, new LookAtPlayerGoal(this, typeid(Player), 8));
}

MyMerchant::~MyMerchant()
{
    delete offers;
}

int MyMerchant::getMaxHealth() { return 30; }

bool MyMerchant::interact(shared_ptr<Player> player)
{
    if (isAlive() && tradingPlayer.lock() == NULL)
    {
        if (!level->isClientSide)
        {
            setTradingPlayer(player);
            player->openTrading(
                dynamic_pointer_cast<Merchant>(shared_from_this()));
        }
        return true;
    }
    return PathfinderMob::interact(player);
}

void MyMerchant::buildOffers()
{
    offers = new MerchantRecipeList();

    // Sell diamonds for 5 emeralds
    offers->push_back(new MerchantRecipe(
        shared_ptr<ItemInstance>(new ItemInstance(Item::emerald, 5)),
        shared_ptr<ItemInstance>(new ItemInstance(Item::diamond))
    ));

    // Buy iron ingots: 10 iron = 1 emerald
    offers->push_back(new MerchantRecipe(
        shared_ptr<ItemInstance>(new ItemInstance(Item::ironIngot, 10)),
        shared_ptr<ItemInstance>(new ItemInstance(Item::emerald))
    ));

    // Three-slot trade: book + 20 emeralds = enchanted book
    Enchantment *ench = Enchantment::sharpness;
    shared_ptr<ItemInstance> enchBook =
        Item::enchantedBook->createForEnchantment(
            new EnchantmentInstance(ench, 3));
    offers->push_back(new MerchantRecipe(
        shared_ptr<ItemInstance>(new ItemInstance(Item::book)),
        shared_ptr<ItemInstance>(new ItemInstance(Item::emerald, 20)),
        enchBook
    ));
}

void MyMerchant::notifyTrade(MerchantRecipe *activeRecipe)
{
    activeRecipe->increaseUses();
    playSound(eSoundType_MOB_VILLAGER_YES,
              getSoundVolume(), getVoicePitch());
}

void MyMerchant::notifyTradeUpdated(shared_ptr<ItemInstance> item) {}
void MyMerchant::overrideOffers(MerchantRecipeList *recipeList) {}

int MyMerchant::getDisplayName()
{
    return IDS_MY_MERCHANT;  // Your localized string ID
}
```

### Client-Side Merchant

On the client side, LCE uses `ClientSideMerchant` as a proxy. It receives the offer list over the network and renders the trade UI. The server sends trade data through `TradeItemPacket`, which serializes the recipe list with `MerchantRecipeList::writeToStream()`.

You don't need to touch `ClientSideMerchant` for custom merchants. It works automatically as long as your entity implements `Merchant` and calls `player->openTrading()`.

## NBT Save Format

Trade offers are saved in NBT under the "Offers" tag. Each recipe stores its buy/sell items plus usage counts:

```cpp
void Villager::addAdditonalSaveData(CompoundTag *tag)
{
    AgableMob::addAdditonalSaveData(tag);
    tag->putInt(L"Profession", getProfession());
    tag->putInt(L"Riches", riches);
    if (offers != NULL)
    {
        tag->putCompound(L"Offers", offers->createTag());
    }
}
```

The recipe tag structure looks like:

```
Offers (CompoundTag)
  Recipes (ListTag<CompoundTag>)
    [0] (CompoundTag)
      buy (CompoundTag) - ItemInstance data
      sell (CompoundTag) - ItemInstance data
      buyB (CompoundTag) - Optional second buy item
      uses (Int) - Current use count
      maxUses (Int) - Max before deprecated
```

## Quick Reference

### Trade Constructors

| Constructor | Use Case |
|------------|----------|
| `MerchantRecipe(buy, sell)` | Simple 1-input trade |
| `MerchantRecipe(buy, Item*)` | 1-input, wraps Item in ItemInstance |
| `MerchantRecipe(buy, Tile*)` | 1-input, wraps Tile in ItemInstance |
| `MerchantRecipe(buyA, buyB, sell)` | 2-input trade |
| `MerchantRecipe(buyA, buyB, sell, uses, maxUses)` | Full control |

### Key Source Files

| File | What it does |
|---|---|
| `Minecraft.World/Merchant.h` | Trading interface |
| `Minecraft.World/Villager.cpp` | Trade generation, profession pools, price tables, `addOffers()` |
| `Minecraft.World/MerchantRecipe.cpp` | Individual trade logic and use tracking |
| `Minecraft.World/MerchantRecipeList.cpp` | Recipe matching and serialization |
| `Minecraft.World/MerchantMenu.cpp` | Trading UI container |
| `Minecraft.World/MerchantContainer.cpp` | Slot management and recipe resolution |
| `Minecraft.World/MerchantResultSlot.cpp` | Payment deduction on trade completion |
| `Minecraft.World/ClientSideMerchant.cpp` | Client-side trade proxy |
| `Minecraft.World/TradeWithPlayerGoal.cpp` | AI that keeps villagers still while trading |
