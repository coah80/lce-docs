---
title: Custom Achievements
description: How to add new achievements and custom trigger conditions to LCEMP.
---

Achievements in LCEMP are a tree of unlockable goals that extend the `Stat` class. Each one has a parent dependency, an icon, a position on the achievement screen map, and a trigger condition defined in gameplay code. This guide breaks down the whole system and shows you how to add your own.

## How the Achievement System Works

The achievement system has three layers:

1. **`Stat`** (base class) - Holds an ID, a name, and a value counter per difficulty. Lives in `Minecraft.World/Stat.h`.
2. **`Achievement`** (subclass of Stat) - Adds an icon, x/y position on the map, a parent dependency, and an optional golden frame. Lives in `Minecraft.World/Achievement.h`.
3. **`Achievements`** (static registry) - A static class that holds pointers to every achievement and manages the global list. Lives in `Minecraft.World/Achievements.h`.

When the player does something (crafts an item, kills a mob, enters a biome), the game calls `player->awardStat()`. If the stat is an `Achievement`, it gets recorded in the `StatsCounter` and the platform-specific award system (trophies, Xbox achievements, etc.) gets notified.

Here's the class hierarchy:

```cpp
// Stat is the base: just an ID, name, and formatter
class Stat {
public:
    const int id;
    const wstring name;
    bool awardLocallyOnly;
    // ...
};

// Achievement adds tree position, icon, parent, and golden flag
class Achievement : public Stat {
public:
    const int x, y;            // position on the achievement map
    Achievement *requires;      // parent achievement (NULL = root)
    const shared_ptr<ItemInstance> icon;
private:
    bool isGoldenVar;           // golden frame for special achievements
    // ...
};
```

## The Award Enum

Every achievement maps to an entry in the `eAward` enum defined in `Console_Awards_enum.h`. This enum is what the platform layer uses to track which trophies/achievements have been unlocked:

```cpp
enum eAward {
    eAward_TakingInventory = 0,   // Open your inventory
    eAward_GettingWood,            // Punch a tree
    eAward_Benchmarking,           // Build a workbench
    eAward_TimeToMine,             // Build a pickaxe
    eAward_HotTopic,               // Build a furnace
    eAward_AquireHardware,         // Smelt an iron ingot
    eAward_TimeToFarm,             // Build a hoe
    eAward_BakeBread,              // Make bread
    eAward_TheLie,                 // Bake a cake
    eAward_GettingAnUpgrade,       // Build a stone pickaxe
    eAward_DeliciousFish,          // Cook fish
    eAward_OnARail,                // Travel 500m by minecart
    eAward_TimeToStrike,           // Build a sword
    eAward_MonsterHunter,          // Kill a hostile mob
    eAward_CowTipper,             // Kill a cow
    eAward_WhenPigsFly,           // Fly a pig off a cliff
    eAward_LeaderOfThePack,       // Tame 5 wolves
    eAward_MOARTools,             // Craft one of each tool type
    eAward_DispenseWithThis,      // Build a dispenser
    eAward_InToTheNether,         // Light a nether portal
    eAward_mine100Blocks,         // Mine 100 blocks
    eAward_kill10Creepers,        // Kill 10 creepers
    eAward_eatPorkChop,           // Cook and eat porkchop
    eAward_play100Days,           // Play for 100 in-game days
    eAward_arrowKillCreeper,      // Kill creeper with arrow
    eAward_socialPost,            // Take a screenshot
    // ... plus extended achievements behind #ifdef _EXTENDED_ACHIEVEMENTS
    eAward_Max,
};
```

:::note
The order of this enum matters. It maps directly to profile save data. New achievements should always be added at the end, right before `eAward_Max`.
:::

## All Existing Achievements

### Core Achievements (Always Available)

| Achievement | Enum | Trigger | Parent | Golden? |
|---|---|---|---|---|
| Taking Inventory | `eAward_TakingInventory` | Open inventory screen | None (root) | No |
| Getting Wood | `eAward_GettingWood` | Mine a log block | Taking Inventory | No |
| Benchmarking | `eAward_Benchmarking` | Craft a workbench | Getting Wood | No |
| Time to Mine! | `eAward_TimeToMine` | Craft a wooden pickaxe | Benchmarking | No |
| Hot Topic | `eAward_HotTopic` | Craft a furnace | Time to Mine | No |
| Acquire Hardware | `eAward_AquireHardware` | Smelt iron ingot from furnace | Hot Topic | No |
| Time to Farm! | `eAward_TimeToFarm` | Craft a wooden hoe | Benchmarking | No |
| Bake Bread | `eAward_BakeBread` | Craft bread | Time to Farm | No |
| The Lie | `eAward_TheLie` | Craft a cake | Time to Farm | No |
| Getting an Upgrade | `eAward_GettingAnUpgrade` | Craft a stone pickaxe | Time to Mine | No |
| Delicious Fish | `eAward_DeliciousFish` | Smelt a fish in a furnace | Hot Topic | No |
| On A Rail | `eAward_OnARail` | Travel 500+ blocks by minecart | Acquire Hardware | **Yes** |
| Time to Strike! | `eAward_TimeToStrike` | Craft a wooden sword | Benchmarking | No |
| Monster Hunter | `eAward_MonsterHunter` | Kill a hostile mob | Time to Strike | No |
| Cow Tipper | `eAward_CowTipper` | Kill a cow | Time to Strike | No |
| When Pigs Fly | `eAward_WhenPigsFly` | Ride a pig off a cliff | Cow Tipper | **Yes** |

### 4J Console Achievements

| Achievement | Enum | Trigger | Local Only? |
|---|---|---|---|
| Leader of the Pack | `eAward_LeaderOfThePack` | Tame 5 wolves total | Yes |
| MOAR Tools | `eAward_MOARTools` | Craft one of each tool type (shovel, pickaxe, axe, hoe) | Yes |
| Dispense With This | `eAward_DispenseWithThis` | Craft a dispenser | No |
| Into The Nether | `eAward_InToTheNether` | Light a nether portal with flint and steel | No |
| Mine 100 Blocks | `eAward_mine100Blocks` | Mine 100 total blocks | Yes |
| Kill 10 Creepers | `eAward_kill10Creepers` | Kill 10 creepers total | Yes |
| Pork Chop | `eAward_eatPorkChop` | Cook and eat a porkchop | Platform-dependent |
| Play for 100 Days | `eAward_play100Days` | Play for 100 in-game days (100 * 24000 ticks) | Yes |
| Arrow Kill Creeper | `eAward_arrowKillCreeper` | Kill a creeper with a bow | No |

### Non-Xbox Achievements

These are behind `#ifndef _XBOX` and are available on PS3, PS Vita, and later platforms:

| Achievement | Trigger | Golden? |
|---|---|---|
| Sniper Duel | Kill a skeleton from 50+ blocks away with a bow | **Yes** |
| Diamonds! | Pick up a diamond | No |
| Return to Sender | Kill a ghast with its own fireball | **Yes** |
| Into Fire | Pick up a blaze rod | No |
| Local Brewery | Brew a potion | No |
| The End? | Enter the End | **Yes** |
| The End. | Defeat the Ender Dragon | **Yes** |
| Enchanter | Use an enchantment table | No |

### Extended Achievements (`_EXTENDED_ACHIEVEMENTS`)

Available on PS4 (Orbis) and later platforms:

| Achievement | Trigger |
|---|---|
| Overkill | Deal 9+ hearts of damage in one hit |
| Librarian | Craft a bookshelf |
| Adventuring Time | Visit 17+ different biomes |
| Repopulation | Breed two cows |
| Diamonds to You | Throw a diamond to another player |
| The Haggler | Acquire 30 emeralds (mined + traded) |
| Pot Planter | Craft and place a flower pot |
| It's a Sign! | Craft and place a sign |
| Iron Belly | Eat rotten flesh (stop hunger with iron) |
| Have a Shearful Day | Shear a sheep |
| Rainbow Collection | Collect all 16 wool colors |
| Stayin' Frosty | Create a snow golem |
| Chestful of Cobblestone | Fill a chest with 27 stacks of cobblestone |
| Renewable Energy | Smelt wood logs in a furnace |
| Music to my Ears | Play a music disc in a jukebox |
| Body Guard | Create an iron golem |
| Iron Man | Wear a full set of iron armor |
| Zombie Doctor | Cure a zombie villager |
| Lion Tamer | Tame an ocelot |

## Achievement Tree / Dependencies

Achievements form a tree using the `requires` pointer. A player needs to unlock the parent before the child shows as available on the achievement screen.

The main tree looks like this:

```
Taking Inventory (root)
└── Getting Wood
    └── Benchmarking (Workbench)
        ├── Time to Mine (Pickaxe)
        │   ├── Hot Topic (Furnace)
        │   │   ├── Acquire Hardware (Iron)
        │   │   │   ├── On A Rail ★
        │   │   │   └── Diamonds!
        │   │   ├── Delicious Fish
        │   │   └── Enchanter
        │   └── Getting an Upgrade (Stone Pickaxe)
        ├── Time to Farm (Hoe)
        │   ├── Bake Bread
        │   └── The Lie (Cake)
        └── Time to Strike (Sword)
            ├── Monster Hunter
            │   └── Sniper Duel ★
            └── Cow Tipper
                └── When Pigs Fly ★
```

Stars mark golden achievements. The 4J console-specific achievements all use `buildSword` as their parent (though this is mostly ignored since the position params are `0,0` on console).

:::tip
In the LCEMP codebase, `StatsCounter::canTake()` always returns `true`. The dependency system is effectively disabled at the code level. The tree structure still matters for the visual display on the achievement screen though.
:::

## Creating a New Achievement

### Step 1: Add the Enum Value

In `Console_Awards_enum.h`, add your new award right before `eAward_Max`:

```cpp
enum eAward {
    // ... existing awards ...
    eAward_lionTamer,

    // Your new achievement
    eAward_myCustomAchievement,

    eAward_Max,
};
```

### Step 2: Declare the Achievement Pointer

In `Achievements.h`, add a static pointer for your achievement:

```cpp
class Achievements {
    // ... existing achievements ...
    static Achievement *lionTamer;

    // Your new one
    static Achievement *myCustomAchievement;

    static void staticCtor();
    static void init();
};
```

### Step 3: Initialize the Pointer

In `Achievements.cpp`, add the NULL initializer and then construct it in `staticCtor()`:

```cpp
// At the top with the other initializers
Achievement *Achievements::myCustomAchievement = NULL;

// Inside staticCtor(), at the end
void Achievements::staticCtor()
{
    // ... existing achievements ...

    Achievements::myCustomAchievement = (new Achievement(
        eAward_myCustomAchievement,  // enum ID
        L"myCustomAchievement",       // localization key
        0, 0,                         // x, y position on map
        Item::diamond,                // icon (Item* or Tile*)
        (Achievement*) NULL           // parent (NULL = no dependency)
    ))->postConstruct();
}
```

The constructor parameters are:

| Param | Type | What it does |
|---|---|---|
| `id` | `int` (eAward) | Gets added to `ACHIEVEMENT_OFFSET` (0x500000) to make the stat ID |
| `name` | `wstring` | Used as `achievement.<name>` for the localized display name |
| `x, y` | `int` | Position on the achievement map (24px per unit) |
| `icon` | `Item*` or `Tile*` | The item/block icon shown in the UI |
| `requires` | `Achievement*` | Parent in the achievement tree, or NULL |

### Step 4: Add a GenericStats Accessor

In `GenericStats.cpp`, add a static method so the rest of the code can reference your achievement:

```cpp
Stat* GenericStats::myCustomAchievement()
{
    return instance->get_achievement(eAward_myCustomAchievement);
}

byteArray GenericStats::param_myCustomAchievement()
{
    return instance->getParam_achievement(eAward_myCustomAchievement);
}
```

And declare both in `GenericStats.h`:

```cpp
static Stat* myCustomAchievement();
static byteArray param_myCustomAchievement();
```

### Step 5: Add to CommonStats

In `CommonStats.cpp`, add the case to `get_achievement()`:

```cpp
Stat *CommonStats::get_achievement(eAward achievementId)
{
    switch (achievementId)
    {
    // ... existing cases ...
    case eAward_myCustomAchievement:
        return (Stat *) Achievements::myCustomAchievement;
    default:
        return (Stat *) NULL;
    }
}
```

### Step 6: Trigger It

Now you just call `awardStat()` from wherever makes sense:

```cpp
player->awardStat(
    GenericStats::myCustomAchievement(),
    GenericStats::param_myCustomAchievement()
);
```

## Custom Trigger Conditions

There are two patterns for triggering achievements: **simple triggers** and **stat-checked triggers**.

### Simple Triggers

These fire the achievement directly when something happens. Used for one-off actions like "craft this item" or "enter this place":

```cpp
// In ResultSlot::checkTakeAchievements() - fires when player crafts
if (carried->id == Tile::workBench_Id)
    player->awardStat(GenericStats::buildWorkbench(), GenericStats::param_buildWorkbench());
```

```cpp
// In FurnaceResultSlot - fires when player takes item from furnace
if (carried->id == Item::ironIngot_Id)
    player->awardStat(GenericStats::acquireIron(), GenericStats::param_acquireIron());
```

```cpp
// In FlintAndSteelItem - fires when player lights a nether portal
player->awardStat(GenericStats::InToTheNether(), GenericStats::param_InToTheNether());
```

### Stat-Checked Triggers (Cumulative)

These check accumulated stats before awarding. Used for things like "kill 10 creepers" or "visit 17 biomes". The checks live in `LocalPlayer::awardStat()`:

```cpp
// Leader of the Pack: tame 5 wolves
if (stat == GenericStats::tamedEntity(eTYPE_WOLF))
{
    if (pStats->getTotalValue(GenericStats::tamedEntity(eTYPE_WOLF)) >= 5)
    {
        awardStat(GenericStats::leaderOfThePack(), GenericStats::param_noArgs());
    }
}
```

```cpp
// Rainbow Collection: collect all 16 wool colors
bool justPickedupWool = false;
for (int i = 0; i < 16; i++)
    if (stat == GenericStats::itemsCollected(Tile::cloth_Id, i))
        justPickedupWool = true;

if (justPickedupWool)
{
    unsigned int woolCount = 0;
    for (unsigned int i = 0; i < 16; i++)
    {
        if (pStats->getTotalValue(GenericStats::itemsCollected(Tile::cloth_Id, i)) > 0)
            woolCount++;
    }
    if (woolCount >= 16)
        awardStat(GenericStats::rainbowCollection(), GenericStats::param_rainbowCollection());
}
```

### Multi-Condition Triggers

Some achievements need multiple different things to happen. The Pot Planter achievement needs you to both craft AND place a flower pot:

```cpp
Stat *craftFlowerpot = GenericStats::itemsCrafted(Item::flowerPot_Id);
Stat *placeFlowerpot = GenericStats::blocksPlaced(Tile::flowerPot_Id);

if (stat == craftFlowerpot || stat == placeFlowerpot)
{
    if ((pStats->getTotalValue(craftFlowerpot) > 0) &&
        (pStats->getTotalValue(placeFlowerpot) > 0))
    {
        awardStat(GenericStats::potPlanter(), GenericStats::param_potPlanter());
    }
}
```

### MOAR Tools (Complex Check)

The most complex trigger. It builds a 4x5 grid of tool stats and checks that you've crafted at least one from each of the four tool categories:

```cpp
// Builds a table: [shovel, pickaxe, axe, hoe] x [wood, stone, iron, diamond, gold]
Stat *toolStats[4][5];
toolStats[0][0] = GenericStats::itemsCrafted(Item::shovel_wood->id);
toolStats[0][1] = GenericStats::itemsCrafted(Item::shovel_stone->id);
// ... all 20 combinations ...

// Check: has the player crafted at least one tool from each row?
bool awardNow = true;
for (int i = 0; i < 4; i++)
{
    bool craftedThisTool = false;
    for (int j = 0; j < 5; j++)
    {
        if (pStats->getTotalValue(toolStats[i][j]) > 0)
            craftedThisTool = true;
    }
    if (!craftedThisTool)
    {
        awardNow = false;
        break;
    }
}

if (awardNow)
    awardStat(GenericStats::MOARTools(), GenericStats::param_noArgs());
```

## The Stat Tracking System

Achievements sit on top of a broader stat tracking system. Here's how it fits together.

### Stat Types

| Class | Offset | Purpose |
|---|---|---|
| `GeneralStat` | ID 2000+ | Distance traveled, kills, time played |
| `ItemStat` | `BLOCKS_MINED_OFFSET` (0x1000000) | Per-block mining counts |
| `ItemStat` | `ITEMS_COLLECTED_OFFSET` (0x1010000) | Per-item pickup counts |
| `ItemStat` | `ITEMS_CRAFTED_OFFSET` (0x1020000) | Per-item crafting counts |
| `Achievement` | `ACHIEVEMENT_OFFSET` (0x500000) | Achievement unlocks |
| Additional | `ADDITIONAL_STATS_OFFSET` (0x5010000) | Stats added in TU9+ |

### StatsCounter

`StatsCounter` is the per-player stats tracker. It stores a map from `Stat*` to values split by difficulty:

```cpp
class StatsCounter {
    struct StatContainer {
        unsigned int stats[4]; // Peaceful, Easy, Normal, Hard
    };
    typedef unordered_map<Stat*, StatContainer> StatsMap;
    StatsMap stats;

public:
    void award(Stat *stat, unsigned int difficulty, unsigned int count);
    bool hasTaken(Achievement *ach);  // checks if achievement exists in map
    bool canTake(Achievement *ach);   // always returns true (dependencies disabled)
    unsigned int getValue(Stat *stat, unsigned int difficulty);
    unsigned int getTotalValue(Stat *stat); // sum across all difficulties
};
```

When `award()` is called with an `Achievement`, the difficulty gets forced to 0:

```cpp
void StatsCounter::award(Stat* stat, unsigned int difficulty, unsigned int count)
{
    if (stat->isAchievement())
        difficulty = 0;  // achievements don't vary by difficulty

    // ... insert or increment the value ...
}
```

### How Stats Flow Through the System

1. Gameplay code calls `player->awardStat(stat, paramBlob)`
2. `LocalPlayer::awardStat()` checks if it's an achievement
3. If it is: notify the platform award system (`ProfileManager.Award()`), then call `StatsCounter::award()`
4. If it's a regular stat: call `StatsCounter::award()`, then check if any cumulative achievements should unlock

## Achievement Modifiers

### `setAwardLocallyOnly()`

Marks the achievement so it only awards on the local machine and doesn't get sent to other players in multiplayer. Used for stat-based achievements that each player tracks independently:

```cpp
Achievements::leaderOfThePack = (new Achievement(
    eAward_LeaderOfThePack, L"leaderOfThePack",
    0, 0, Tile::treeTrunk, (Achievement *) buildSword
))->setAwardLocallyOnly()->postConstruct();
```

### `setGolden()`

Gives the achievement a golden frame on the achievement screen. Used for the harder or more notable ones like On A Rail, When Pigs Fly, and Sniper Duel:

```cpp
Achievements::onARail = (new Achievement(
    eAward_OnARail, L"onARail",
    2, 3, Tile::rail, (Achievement *) acquireIron
))->setGolden()->postConstruct();
```

### `setDescFormatter()`

Lets you customize how the achievement description renders. Takes a `DescFormatter*` that can transform the i18n string:

```cpp
class DescFormatter {
public:
    virtual wstring format(const wstring& i18nValue);
};
```

## How Achievements Display in the UI

### Achievement Screen (`AchievementScreen`)

The achievement screen is a scrollable map. It uses the x/y coordinates of each achievement (multiplied by `ACHIEVEMENT_COORD_SCALE = 24` pixels) to place icons on a grid.

The background renders procedurally generated terrain tiles (dirt, stone, ores) that get darker as you scroll down. Achievement icons are drawn on top, connected by lines to their parent achievements.

Color coding:
- **Full brightness**: Achievement has been taken
- **Pulsing green lines**: Achievement can be taken (parent completed)
- **Dark/dimmed**: Achievement is locked (parent not completed)

Golden achievements use a different sprite frame (`blit` offset 26,202 vs 0,202 from `bg.png`).

Hovering over an achievement shows its name and description. If it's locked, it shows "Requires: [parent name]" instead.

### Achievement Popup (`AchievementPopup`)

When an achievement unlocks, a toast slides down from the top-right corner of the screen. It shows for 3 seconds:

```cpp
void AchievementPopup::popup(Achievement *ach)
{
    title = I18n::get(L"achievement.get");  // "Achievement Get!"
    desc = ach->name;
    startTime = System::currentTimeMillis();
    this->ach = ach;
    isHelper = false;
}
```

The popup animation uses a smooth ease-in-out curve. After 3 seconds (`time > 1.0` where `time = elapsed / 3000.0`), it disappears.

:::note
In the current LCEMP codebase, the Java-style popup is commented out (`//minecraft->achievementPopup->popup(ach)`). The platform-native award system handles the notification instead. If you want to re-enable the in-game popup, uncomment that line in `LocalPlayer::awardStat()`.
:::

## Full Example: Adding a "Master Builder" Achievement

Let's add an achievement that triggers when a player places 1000 total blocks.

**1. Add to enum** (`Console_Awards_enum.h`):
```cpp
eAward_masterBuilder,
eAward_Max,
```

**2. Declare** (`Achievements.h`):
```cpp
static Achievement *masterBuilder;
```

**3. Initialize** (`Achievements.cpp`):
```cpp
Achievement *Achievements::masterBuilder = NULL;

// In staticCtor():
Achievements::masterBuilder = (new Achievement(
    eAward_masterBuilder,
    L"masterBuilder",
    5, -2,                        // position on achievement map
    Tile::stoneBrick,             // icon
    (Achievement *) buildWorkbench // requires Benchmarking
))->setAwardLocallyOnly()->postConstruct();
```

**4. GenericStats accessors** (`GenericStats.h` and `GenericStats.cpp`):
```cpp
// .h
static Stat* masterBuilder();
static byteArray param_masterBuilder();

// .cpp
Stat* GenericStats::masterBuilder()
{
    return instance->get_achievement(eAward_masterBuilder);
}

byteArray GenericStats::param_masterBuilder()
{
    return instance->getParam_achievement(eAward_masterBuilder);
}
```

**5. CommonStats mapping** (`CommonStats.cpp`):
```cpp
case eAward_masterBuilder:
    return (Stat *) Achievements::masterBuilder;
```

**6. Add a "total blocks placed" stat** (`Stats.cpp`):
```cpp
// In buildAdditionalStats():
Stats::totalBlocksPlaced = (new GeneralStat(offset++, L"stat.totalBlocksPlaced"))
    ->setAwardLocallyOnly()->postConstruct();
```

**7. Track block placements** (`TileItem.cpp`, in `useOn()`):
```cpp
player->awardStat(GenericStats::totalBlocksPlaced(), GenericStats::param_noArgs());
```

**8. Check threshold** (`LocalPlayer.cpp`, in `awardStat()`):
```cpp
// AWARD: Master Builder - place 1000 blocks
if (stat == GenericStats::totalBlocksPlaced())
{
    if (pStats->getTotalValue(GenericStats::totalBlocksPlaced()) >= 1000)
    {
        awardStat(GenericStats::masterBuilder(), GenericStats::param_masterBuilder());
    }
}
```

**9. Add localization strings** for `achievement.masterBuilder` and `achievement.masterBuilder.desc` in your language files.

That's it. The achievement will show up on the map, track across save/load, and trigger the platform's native award notification when the player hits 1000 placed blocks.

## Key Files Reference

| File | What's in it |
|---|---|
| `Minecraft.World/Achievement.h` | Achievement class definition |
| `Minecraft.World/Achievements.h` | Static registry of all achievements |
| `Minecraft.World/Achievements.cpp` | Achievement construction and tree setup |
| `Minecraft.World/Stat.h` | Base stat class |
| `Minecraft.World/Stats.cpp` | All stat registration (blocks mined, items crafted, etc.) |
| `Minecraft.World/GenericStats.cpp` | Static accessor functions for stats/achievements |
| `Minecraft.World/CommonStats.cpp` | Platform-specific stat mappings |
| `Minecraft.Client/StatsCounter.h` | Per-player stat storage and queries |
| `Minecraft.Client/LocalPlayer.cpp` | Achievement trigger logic and cumulative checks |
| `Minecraft.Client/AchievementScreen.cpp` | Achievement map UI rendering |
| `Minecraft.Client/AchievementPopup.cpp` | Toast notification rendering |
| `Console_Awards_enum.h` | Platform award ID enum |
| `Minecraft.World/ResultSlot.cpp` | Crafting-based achievement triggers |
