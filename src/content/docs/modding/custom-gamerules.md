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

### Existing Vanilla GameRules

The built-in rule constants are defined in `GameRules.h`:

| Constant | ID | Host Option | What it does |
|---|---|---|---|
| `RULE_DOFIRETICK` | 0 | `eGameHostOption_FireSpreads` | Fire spreads to nearby blocks |
| `RULE_MOBGRIEFING` | 1 | `eGameHostOption_MobGriefing` | Mobs can destroy blocks (creeper explosions, enderman stealing blocks, etc.) |
| `RULE_KEEPINVENTORY` | 2 | `eGameHostOption_KeepInventory` | Items stay in your inventory on death |
| `RULE_DOMOBSPAWNING` | 3 | `eGameHostOption_DoMobSpawning` | Mobs spawn naturally in the world |
| `RULE_DOMOBLOOT` | 4 | `eGameHostOption_DoMobLoot` | Mobs drop items when killed |
| `RULE_DOTILEDROPS` | 5 | `eGameHostOption_DoTileDrops` | Blocks drop items when broken |
| `RULE_NATURAL_REGENERATION` | 7 | `eGameHostOption_NaturalRegeneration` | Health regenerates from having full hunger |
| `RULE_DAYLIGHT` | 8 | `eGameHostOption_DoDaylightCycle` | Day/night cycle progresses |

Note that ID 6 (`RULE_COMMANDBLOCKOUTPUT`) is commented out in the source. It was removed from the console version since there are no command blocks.

### Missing vs Java

LCE is missing a bunch of game rules that Java Edition has. There is no `doWeatherCycle`, no `sendCommandFeedback`, no `showDeathMessages` (though death messages are controlled by `eGameSetting_DeathMessages` as a client setting), no `reducedDebugInfo`, and no `commandBlockOutput`. Most of these make sense because the console version doesn't have the text command system at all.

## The Full Host Options System

The host options enum in `App_enums.h` contains way more than just game rules. Here is every host option:

| Enum Value | What it does |
|---|---|
| `eGameHostOption_Difficulty` | World difficulty (Peaceful/Easy/Normal/Hard) |
| `eGameHostOption_OnlineGame` | Unused placeholder |
| `eGameHostOption_InviteOnly` | Unused placeholder |
| `eGameHostOption_FriendsOfFriends` | Allow friends of friends to join |
| `eGameHostOption_Gamertags` | Show gamertags above players |
| `eGameHostOption_Tutorial` | Enable tutorial mode (special case) |
| `eGameHostOption_GameType` | Survival, Creative, or Adventure |
| `eGameHostOption_LevelType` | Flat or Default terrain |
| `eGameHostOption_Structures` | Generate structures (villages, temples, etc.) |
| `eGameHostOption_BonusChest` | Spawn a bonus chest near the player |
| `eGameHostOption_HasBeenInCreative` | Tracks if the world was ever in Creative |
| `eGameHostOption_PvP` | Players can damage each other |
| `eGameHostOption_TrustPlayers` | Trusted players can build/break |
| `eGameHostOption_TNT` | TNT explosions are enabled |
| `eGameHostOption_FireSpreads` | Fire spreads to nearby blocks |
| `eGameHostOption_CheatsEnabled` | Host privileges are on (special case) |
| `eGameHostOption_HostCanFly` | Host can fly in survival |
| `eGameHostOption_HostCanChangeHunger` | Host is immune to hunger |
| `eGameHostOption_HostCanBeInvisible` | Host is invisible to other players |
| `eGameHostOption_BedrockFog` | Show fog near bedrock level |
| `eGameHostOption_NoHUD` | Hide the HUD |
| `eGameHostOption_All` | Special value: returns all options packed into one int |
| `eGameHostOption_DisableSaving` | Prevents the world from saving |

The `eGameHostOption_All` value is a special case. When you call `GetGameHostOption(eGameHostOption_All)`, it packs every boolean option into a bitmask and returns the whole thing as a single integer. This is used for network sync so the server can send all options to clients in one packet.

:::note
The comment in the source says: "When adding new options you should consider whether having them on should disable achievements." Options like `eGameHostOption_HasBeenInCreative` and `eGameHostOption_CheatsEnabled` are checked by the `CanRecordStatsAndAchievements` function. If Creative mode was ever used, achievements get locked.
:::

Options are saved in the save data, so new options can only be added at the end of the enum. Adding one in the middle would break every existing save file.

### How Host Options are Stored

Host options are saved as part of the world's NBT data. The entire set of boolean options gets packed into a bitmask by `GetGameHostOption(eGameHostOption_All)` and stored in the save file. When the world loads, the bitmask gets unpacked back into individual options.

For network play, the host sends all options to joining clients using the same bitmask approach. The `PendingConnection` and `GameNetworkManager` classes handle syncing these during the join process.

### Adding a New GameRule

To add a new game rule, you need to touch three places:

**Step 1: Add the host option enum value** in `App_enums.h`:

```cpp
enum eGameHostOption
{
    // ... existing options ...
    eGameHostOption_DisableSaving,

    // Add your new option here (MUST be at the end)
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

The `GameRules` approach is better for gameplay code because it goes through the level, which means it works correctly in multiplayer. The direct `app.GetGameHostOption()` approach is fine for UI code or anything running on the host.

## Console GameRules (The 4J System)

This is the more complex system. It's used for mashup packs, tutorials, and DLC content. It handles things like:

- Placing schematics during world generation
- Generating custom structures at specific coordinates
- Overriding biomes in certain areas
- Tracking player progress (collect an item, use a tile, etc.)
- Adding items to containers or spawners
- Adding enchantments to placed items

### Console GameRule Types

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

Here's what each type does:

| Type | Class | Purpose |
|---|---|---|
| `Root` | `GameRuleDefinition` | Top-level container, holds child rules |
| `LevelGenerationOptions` | `LevelGenerationOptions` | Controls world gen settings for mashup packs |
| `ApplySchematic` | `ApplySchematicRuleDefinition` | Places a schematic (.schem) file at a specific chunk position |
| `GenerateStructure` | `ConsoleGenerateStructure` | Generates a structure (village, stronghold, etc.) at specific coords |
| `GenerateBox` | `XboxStructureActionGenerateBox` | Fills a box region with a specific block |
| `PlaceBlock` | `XboxStructureActionPlaceBlock` | Places a single block at exact coordinates |
| `PlaceContainer` | `XboxStructureActionPlaceContainer` | Places a container (chest, dispenser) with items inside |
| `PlaceSpawner` | `XboxStructureActionPlaceSpawner` | Places a mob spawner with a specific entity type |
| `BiomeOverride` | `BiomeOverride` | Forces a region to use a specific biome |
| `StartFeature` | `StartFeature` | Kicks off a multi-step feature (like a tutorial segment) |
| `AddItem` | `AddItemRuleDefinition` | Adds an item to a container placed by PlaceContainer |
| `AddEnchantment` | `AddEnchantmentRuleDefinition` | Adds an enchantment to an item placed by AddItem |
| `LevelRules` | `LevelRuleset` | Container for runtime gameplay rules |
| `NamedArea` | `NamedAreaRuleDefinition` | Defines a named region for triggers |
| `UseTileRule` | `UseTileRuleDefinition` | Triggers when a player uses a specific block |
| `CollectItemRule` | `CollectItemRuleDefinition` | Triggers when a player picks up a specific item |
| `CompleteAllRule` | `CompleteAllRuleDefinition` | Triggers when all child rules are completed |
| `UpdatePlayerRule` | `UpdatePlayerRuleDefinition` | Modifies player state (give item, change gamemode, etc.) |

### How Console GameRules Are Loaded

The `GameRuleManager` loads these from DLC packs (`.pck` files). Each rule is a tree of definitions with attributes and children. The system reads a compressed binary file format that contains a string table, schematic files, and serialized rule objects.

The loading flow looks like this:

1. `GameRuleManager::loadGameRules(DLCPack *)` reads rule headers from the pack
2. `readRuleFile()` decompresses and parses the binary data
3. Rules are organized into `LevelGenerationOptions` (world gen) and `LevelRuleset` (gameplay rules)
4. During chunk generation, `processSchematics()` applies any schematic placements

### Rule Tree Structure

Console game rules form a tree. The root node contains `LevelGenerationOptions` and `LevelRuleset` as children. Each of those contains their own children. For example, a mashup pack's rule tree might look like:

```
Root
├── LevelGenerationOptions
│   ├── ApplySchematic (chunk 0,0 - castle.schem)
│   ├── ApplySchematic (chunk 5,3 - village.schem)
│   ├── BiomeOverride (region: desert)
│   └── GenerateStructure (nether fortress)
└── LevelRuleset
    ├── NamedArea (spawn_zone)
    ├── UseTileRule (use crafting table)
    │   └── UpdatePlayerRule (give diamond)
    └── CompleteAllRule
        ├── CollectItemRule (get wood)
        └── CollectItemRule (get stone)
```

### The UpdateGameRuleProgressPacket

When a player completes a rule (like collecting an item), the server sends an `UpdateGameRuleProgressPacket` to notify the client. This packet carries the rule ID and the new state. The client uses this to update the tutorial UI or track completion progress.

For most modding purposes, you won't need to touch this system directly. But if you're building custom tutorial levels or mashup packs, this is where that logic lives.

## Key Files

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
| `ApplySchematicRuleDefinition.h/.cpp` | Places schematics during world gen |
| `BiomeOverride.h/.cpp` | Forces biome in a region |
| `CollectItemRuleDefinition.h/.cpp` | Triggers on item pickup |
| `UseTileRuleDefinition.h/.cpp` | Triggers on block use |
| `CompleteAllRuleDefinition.h/.cpp` | Triggers when all children complete |
| `UpdatePlayerRuleDefinition.h/.cpp` | Modifies player state |
| `UpdateGameRuleProgressPacket.h/.cpp` | Network packet for rule progress |
| `UIScene_InGameHostOptionsMenu.cpp` | UI for toggling host options |
