---
title: Custom GameRules
description: How the GameRules system works in LCE, the existing rules, and how to add new ones.
---

Legacy Console Edition has two separate "game rules" systems that can trip you up if you're not aware of them. This page covers both and shows you how to add your own.

## The Two GameRules Systems

There are actually two different things called "game rules" in the codebase:

1. **Vanilla GameRules** (`GameRules` in `Minecraft.World`) - The original Mojang system for things like `doFireTick`, `keepInventory`, etc. On console, 4J mostly gutted this and routed it through the host options system instead.

2. **Console GameRules** (`GameRuleManager` + `GameRuleDefinition` in `Minecraft.Client`) - 4J's custom system for tutorial objectives, mashup pack world generation, schematic placement, and DLC content. This is the one that handles things like "place a schematic at chunk X,Z" or "give the player an item when they use a tile."

Most modders will care about the first one. The second one is more relevant if you're building custom maps or tutorials.

## Vanilla GameRules (Host Options)

4J replaced Mojang's string-based `GameRules` with a bitmask stored in the app's host options. The original `GameRules` class still exists but just redirects to the host options system:

```cpp
// GameRules.cpp - the getBoolean() method just calls through to host options
bool GameRules::getBoolean(const int rule)
{
    switch(rule)
    {
    case GameRules::RULE_DOFIRETICK:
        return app.GetGameHostOption(eGameHostOption_FireSpreads);
    case GameRules::RULE_MOBGRIEFING:
        return app.GetGameHostOption(eGameHostOption_MobGriefing);
    case GameRules::RULE_KEEPINVENTORY:
        return app.GetGameHostOption(eGameHostOption_KeepInventory);
    case GameRules::RULE_DOMOBSPAWNING:
        return app.GetGameHostOption(eGameHostOption_DoMobSpawning);
    case GameRules::RULE_DOMOBLOOT:
        return app.GetGameHostOption(eGameHostOption_DoMobLoot);
    case GameRules::RULE_DOTILEDROPS:
        return app.GetGameHostOption(eGameHostOption_DoTileDrops);
    case GameRules::RULE_NATURAL_REGENERATION:
        return app.GetGameHostOption(eGameHostOption_NaturalRegeneration);
    case GameRules::RULE_DAYLIGHT:
        return app.GetGameHostOption(eGameHostOption_DoDaylightCycle);
    default:
        assert(0);
        return false;
    }
}
```

### Existing Rules

The built-in rule constants are defined in `GameRules.h`:

| Constant | ID | Host Option | What it does |
|---|---|---|---|
| `RULE_DOFIRETICK` | 0 | `eGameHostOption_FireSpreads` | Fire spreads to nearby blocks |
| `RULE_MOBGRIEFING` | 1 | `eGameHostOption_MobGriefing` | Mobs can destroy blocks |
| `RULE_KEEPINVENTORY` | 2 | `eGameHostOption_KeepInventory` | Items stay on death |
| `RULE_DOMOBSPAWNING` | 3 | `eGameHostOption_DoMobSpawning` | Mobs spawn naturally |
| `RULE_DOMOBLOOT` | 4 | `eGameHostOption_DoMobLoot` | Mobs drop items |
| `RULE_DOTILEDROPS` | 5 | `eGameHostOption_DoTileDrops` | Blocks drop items when broken |
| `RULE_NATURAL_REGENERATION` | 7 | `eGameHostOption_NaturalRegeneration` | Health regenerates from food |
| `RULE_DAYLIGHT` | 8 | `eGameHostOption_DoDaylightCycle` | Day/night cycle progresses |

Note that ID 6 (`RULE_COMMANDBLOCKOUTPUT`) is commented out in the source. It was removed from the console version.

### Adding a New GameRule

To add a new game rule, you need to touch three places:

**Step 1: Add the host option enum value** in `App_enums.h`:

```cpp
enum eGameHostOption
{
    // ... existing options ...
    eGameHostOption_DoDaylightCycle,

    // Add your new option here
    eGameHostOption_DoWeatherCycle,
};
```

**Step 2: Add the rule constant** in `GameRules.h`:

```cpp
class GameRules
{
public:
    // ... existing rules ...
    static const int RULE_DAYLIGHT;
    static const int RULE_DOWEATHERCYCLE;  // new
    // ...
};
```

And define it in `GameRules.cpp`:

```cpp
const int GameRules::RULE_DOWEATHERCYCLE = 9;
```

**Step 3: Wire it up** in `GameRules::getBoolean()`:

```cpp
case GameRules::RULE_DOWEATHERCYCLE:
    return app.GetGameHostOption(eGameHostOption_DoWeatherCycle);
```

**Step 4 (optional): Add a UI checkbox** so players can toggle it from the host options menu. Look at `UIScene_InGameHostOptionsMenu.cpp` for how the existing toggles work. The pattern is:

```cpp
// In the init function
m_checkboxDoWeatherCycle.init(
    app.GetString(IDS_WEATHER_CYCLE),
    eControl_DoWeatherCycle,
    app.GetGameHostOption(eGameHostOption_DoWeatherCycle) != 0
);

// In the apply function
app.SetGameHostOption(
    hostOptions,
    eGameHostOption_DoWeatherCycle,
    m_checkboxDoWeatherCycle.IsChecked()
);
```

### Using GameRules in Code

When you need to check a game rule from gameplay code, you can either go through the `GameRules` class or call the host option directly:

```cpp
// Through GameRules (preferred - goes through the level)
Level *level = /* your level pointer */;
if (level->getLevelData()->getGameRules()->getBoolean(GameRules::RULE_DOFIRETICK))
{
    // fire can spread
}

// Or directly from the app (works anywhere)
if (app.GetGameHostOption(eGameHostOption_FireSpreads))
{
    // fire can spread
}
```

## Console GameRules (The 4J System)

This is the more complex system. It's used for mashup packs, tutorials, and DLC content. It handles things like:

- Placing schematics during world generation
- Generating custom structures at specific coordinates
- Overriding biomes in certain areas
- Tracking player progress (collect an item, use a tile, etc.)

The types are defined in `ConsoleGameRulesConstants.h`:

```cpp
enum EGameRuleType
{
    eGameRuleType_Root = 0,
    eGameRuleType_LevelGenerationOptions,
    eGameRuleType_ApplySchematic,
    eGameRuleType_GenerateStructure,
    eGameRuleType_GenerateBox,
    eGameRuleType_PlaceBlock,
    eGameRuleType_PlaceContainer,
    eGameRuleType_PlaceSpawner,
    eGameRuleType_BiomeOverride,
    eGameRuleType_StartFeature,
    eGameRuleType_AddItem,
    eGameRuleType_AddEnchantment,
    eGameRuleType_LevelRules,
    eGameRuleType_NamedArea,
    eGameRuleType_UseTileRule,
    eGameRuleType_CollectItemRule,
    eGameRuleType_CompleteAllRule,
    eGameRuleType_UpdatePlayerRule,
    eGameRuleType_Count
};
```

### How Console GameRules Are Loaded

The `GameRuleManager` loads these from DLC packs (`.pck` files). Each rule is a tree of definitions with attributes and children. The system reads a compressed binary file format that contains a string table, schematic files, and serialized rule objects.

The loading flow looks like this:

1. `GameRuleManager::loadGameRules(DLCPack *)` reads rule headers from the pack
2. `readRuleFile()` decompresses and parses the binary data
3. Rules are organized into `LevelGenerationOptions` (world gen) and `LevelRuleset` (gameplay rules)
4. During chunk generation, `processSchematics()` applies any schematic placements

For most modding purposes, you won't need to touch this system directly. But if you're building custom tutorial levels or mashup packs, this is where that logic lives.

### Key Files

| File | What it does |
|---|---|
| `GameRules.h/.cpp` | Vanilla rule constants and host option routing |
| `App_enums.h` | Host option enum definitions |
| `ConsoleGameRulesConstants.h` | Console GameRule type and attribute enums |
| `GameRuleManager.h/.cpp` | Loads/saves console game rules from DLC packs |
| `GameRuleDefinition.h/.cpp` | Base class for all console rule definitions |
| `GameRule.h/.cpp` | Runtime state for a single console rule instance |
| `LevelRuleset.h/.cpp` | Container for active gameplay rules |
| `LevelGenerationOptions.h/.cpp` | Container for world generation rules |
