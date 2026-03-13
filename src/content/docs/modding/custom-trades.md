---
title: Custom Trades
description: How the villager trading system works in LCEMP and how to add custom trades.
---

This guide covers the villager trading system in LCEMP. We'll look at how trade offers are built, how the `Merchant` interface works, and how you can add your own trades or even create custom merchant entities.

## Trading System Overview

Trading in LCEMP is built around a few key classes:

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

| Constant | Value | Trades |
|----------|-------|--------|
| `PROFESSION_FARMER` | 0 | Wheat, wool, chicken, bread, melon, apple, arrows |
| `PROFESSION_LIBRARIAN` | 1 | Paper, books, bookshelves, glass, compass, enchanted books |
| `PROFESSION_PRIEST` | 2 | Eyes of ender, XP bottles, redstone, enchanted gear |
| `PROFESSION_SMITH` | 3 | Coal, iron, gold, diamond, tools, armor |
| `PROFESSION_BUTCHER` | 4 | Coal, pork, beef, saddles, leather armor, cooked meat |

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

The `addOffers()` method builds a pool of possible trades based on profession, then picks from them randomly. Here's the farmer's trade pool as an example:

```cpp
case PROFESSION_FARMER:
    addItemForTradeIn(newOffers, Item::wheat_Id, random, getRecipeChance(.9f));
    addItemForTradeIn(newOffers, Tile::cloth_Id, random, getRecipeChance(.5f));
    addItemForTradeIn(newOffers, Item::chicken_raw_Id, random, getRecipeChance(.5f));
    addItemForTradeIn(newOffers, Item::fish_cooked_Id, random, getRecipeChance(.4f));
    addItemForPurchase(newOffers, Item::bread_Id, random, getRecipeChance(.9f));
    addItemForPurchase(newOffers, Item::melon_Id, random, getRecipeChance(.3f));
    addItemForPurchase(newOffers, Item::apple_Id, random, getRecipeChance(.3f));
    // ...
    break;
```

Each trade has a chance of appearing (the float parameter). The `getRecipeChance()` method caps the chance at 0.9:

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

### Trade-In vs Purchase

There are two types of trades:

**Trade-In** (`addItemForTradeIn`): Player gives items, gets 1 emerald. The quantity required comes from `MIN_MAX_VALUES`:

```cpp
void Villager::addItemForTradeIn(MerchantRecipeList *list, int itemId,
                                  Random *random, float likelyHood)
{
    if (random->nextFloat() < likelyHood)
    {
        list->push_back(new MerchantRecipe(
            getItemTradeInValue(itemId, random), Item::emerald));
    }
}
```

**Purchase** (`addItemForPurchase`): Player pays emeralds, gets an item. The cost comes from `MIN_MAX_PRICES`. Negative prices mean 1 emerald buys multiple items:

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
            rubyItem = shared_ptr<ItemInstance>(
                new ItemInstance(Item::emerald_Id, 1, 0));
            resultItem = shared_ptr<ItemInstance>(
                new ItemInstance(itemId, -purchaseCost, 0));
        }
        else
        {
            rubyItem = shared_ptr<ItemInstance>(
                new ItemInstance(Item::emerald_Id, purchaseCost, 0));
            resultItem = shared_ptr<ItemInstance>(
                new ItemInstance(itemId, 1, 0));
        }
        list->push_back(new MerchantRecipe(rubyItem, resultItem));
    }
}
```

### Price Tables

The `MIN_MAX_VALUES` table defines how many items a villager wants per emerald:

```cpp
// In Villager::staticCtor()
MIN_MAX_VALUES[Item::wheat_Id] = pair<int,int>(18, 22);
MIN_MAX_VALUES[Item::coal_Id] = pair<int,int>(16, 24);
MIN_MAX_VALUES[Item::ironIngot_Id] = pair<int,int>(8, 10);
MIN_MAX_VALUES[Item::diamond_Id] = pair<int,int>(4, 6);
MIN_MAX_VALUES[Item::paper_Id] = pair<int,int>(24, 36);
// ...
```

The `MIN_MAX_PRICES` table defines emerald costs for purchases. Negative means the player gets multiple items per emerald:

```cpp
MIN_MAX_PRICES[Item::bread_Id] = pair<int,int>(-4, -2);      // 2-4 bread per emerald
MIN_MAX_PRICES[Item::sword_iron_Id] = pair<int,int>(7, 11);  // 7-11 emeralds per sword
MIN_MAX_PRICES[Item::saddle_Id] = pair<int,int>(6, 8);       // 6-8 emeralds per saddle
// ...
```

### Special Trades

Some trades are hardcoded outside the normal system. The farmer can trade gravel + emerald for flint:

```cpp
if (random->nextFloat() < .5f)
{
    newOffers->push_back(new MerchantRecipe(
        shared_ptr<ItemInstance>(new ItemInstance(Tile::gravel, 10)),
        shared_ptr<ItemInstance>(new ItemInstance(Item::emerald)),
        shared_ptr<ItemInstance>(new ItemInstance(Item::flint_Id,
            2 + random->nextInt(2), 0))));
}
```

The librarian can offer enchanted books with randomized enchantments:

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

## The Trading UI Flow

When a player right-clicks a villager, here's what happens:

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

You can make any entity into a merchant. It needs to implement the `Merchant` interface and trigger the trade UI. Here's a skeleton:

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

void MyMerchant::setTradingPlayer(shared_ptr<Player> player)
{
    tradingPlayer = weak_ptr<Player>(player);
}

shared_ptr<Player> MyMerchant::getTradingPlayer()
{
    return tradingPlayer.lock();
}

MerchantRecipeList *MyMerchant::getOffers(shared_ptr<Player> forPlayer)
{
    if (offers == NULL) buildOffers();
    return offers;
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

On the client side, LCEMP uses `ClientSideMerchant` as a proxy. It receives the offer list over the network and renders the trade UI. The server sends trade data through `TradeItemPacket`, which serializes the recipe list with `MerchantRecipeList::writeToStream()`.

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

- `Minecraft.World/Merchant.h` for the trading interface
- `Minecraft.World/Villager.cpp` for trade generation, profession pools, and price tables
- `Minecraft.World/MerchantRecipe.cpp` for individual trade logic and use tracking
- `Minecraft.World/MerchantRecipeList.cpp` for recipe matching and serialization
- `Minecraft.World/MerchantMenu.cpp` for the trading UI container
- `Minecraft.World/MerchantContainer.cpp` for slot management and recipe resolution
- `Minecraft.World/MerchantResultSlot.cpp` for payment deduction on trade completion
- `Minecraft.World/ClientSideMerchant.cpp` for client-side trade proxy
- `Minecraft.World/TradeWithPlayerGoal.cpp` for the AI that keeps villagers still while trading
