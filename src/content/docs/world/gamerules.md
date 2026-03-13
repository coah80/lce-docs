---
title: Game Rules
description: Configurable game rules in LCE.
---

LCE uses a **Console Game Rules** system that works completely differently from vanilla Minecraft's simple key-value game rules. Instead of boolean/integer rules like `keepInventory` or `doDaylightCycle`, LCE's game rules are a data-driven, hierarchical system mainly used for custom game modes (like Battle, Tumble, Glide) and DLC mashup packs.

## Architecture overview

The game rule system has four main layers:

1. **GameRuleManager**: loads, saves, and manages rule definitions from DLC packs
2. **GameRuleDefinition**: the static definition/template of a rule (what to do)
3. **GameRule**: the runtime state of a rule for a specific player or server
4. **GameRulesInstance**: extends `GameRule` as the top-level container for a player's or server's complete rule state

## ConsoleGameRules constants

The `ConsoleGameRules` class lives in `ConsoleGameRulesConstants.h` and holds two enums plus serialization helpers.

### EGameRuleType

All rule types, from `eGameRuleType_Invalid` (-1) to `eGameRuleType_Count`:

| Enum Value | Int | Purpose |
|---|---|---|
| `eGameRuleType_Invalid` | -1 | Sentinel for unset/unknown rules |
| `eGameRuleType_Root` | 0 | Top-level rule that defines a game mode; used to generate data for new players |
| `eGameRuleType_LevelGenerationOptions` | 1 | World generation configuration (seed, flat world, schematics, biomes, features) |
| `eGameRuleType_ApplySchematic` | 2 | Places a schematic structure in the world (from a .schematic file) |
| `eGameRuleType_GenerateStructure` | 3 | Procedural structure generation (contains child GenerateBox, PlaceBlock, PlaceContainer, PlaceSpawner rules) |
| `eGameRuleType_GenerateBox` | 4 | Fills a box region with blocks (edge tile, fill tile, optional air skip) |
| `eGameRuleType_PlaceBlock` | 5 | Places a single block at a position |
| `eGameRuleType_PlaceContainer` | 6 | Places a container with items (contains child AddItem rules) |
| `eGameRuleType_PlaceSpawner` | 7 | Places a mob spawner with a specific entity |
| `eGameRuleType_BiomeOverride` | 8 | Overrides biome for a region (top tile, biome ID) |
| `eGameRuleType_StartFeature` | 9 | Triggers a world generation feature |
| `eGameRuleType_AddItem` | 10 | Adds an item to inventory (contains child AddEnchantment rules) |
| `eGameRuleType_AddEnchantment` | 11 | Adds an enchantment to an item |
| `eGameRuleType_LevelRules` | 12 | The ruleset container for a level |
| `eGameRuleType_NamedArea` | 13 | Defines a named AABB area in the world |
| `eGameRuleType_UseTileRule` | 14 | Triggers when a player uses a specific tile |
| `eGameRuleType_CollectItemRule` | 15 | Triggers when a player collects a specific item |
| `eGameRuleType_CompleteAllRule` | 16 | Composite rule that completes when all children are done |
| `eGameRuleType_UpdatePlayerRule` | 17 | Modifies player state (health, food, inventory, rotation) |
| `eGameRuleType_Count` | 18 | Total number of rule types |

### EGameRuleAttr

Rules are configured through attributes loaded from XML/binary data. Each attribute is serialized as `eGameRuleType_Count + attrIndex` so types and attributes share a single integer space:

| Attribute | Used By |
|---|---|
| `descriptionName`, `promptName`, `dataTag` | All rules (display and identification) |
| `itemId`, `quantity`, `auxValue`, `slot` | AddItem, CollectItem |
| `enchantmentId`, `enchantmentLevel` | AddEnchantment |
| `tileId`, `useCoords` | UseTile |
| `name` | NamedArea |
| `food`, `health` | UpdatePlayer |
| `seed`, `flatworld` | LevelGenerationOptions |
| `filename`, `rot` | ApplySchematic |
| `data`, `block`, `entity`, `facing` | Structure actions |
| `edgeTile`, `fillTile`, `skipAir` | GenerateBox |
| `x`, `y`, `z`, `x0`, `y0`, `z0`, `x1`, `y1`, `z1` | Position/region bounds |
| `chunkX`, `chunkZ` | Chunk coordinates |
| `yRot` | Player rotation |
| `spawnX`, `spawnY`, `spawnZ` | Spawn position |
| `orientation`, `dimension` | Placement options |
| `topTileId`, `biomeId` | BiomeOverride |
| `feature` | StartFeature |

The total attribute count is `eGameRuleAttr_Count`.

### Serialization helpers

The `ConsoleGameRules` class provides two static `write()` methods:

- `write(dos, EGameRuleType)`: writes the type as an int directly
- `write(dos, EGameRuleAttr)`: writes `eGameRuleType_Count + attrIndex` so the reader can tell types and attributes apart in the same stream

## GameRuleDefinition

The base class for all rule templates. This defines the static structure of a rule.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `m_ownerType` | `EGameRulesInstanceType` | Whether this rule applies to a player or the server |
| `m_descriptionId` | `wstring` | Localization key for the rule description |
| `m_promptId` | `wstring` | Localization key for the prompt text |
| `m_4JDataValue` | `int` | Extra data value (4J specific) |

**Key methods:**

| Method | Purpose |
|---|---|
| `getActionType()` | Pure virtual. Returns the `EGameRuleType` for this definition. |
| `addChild(ruleType)` | Adds a child rule (for compound rules). Returns the new child definition. |
| `addAttribute(name, value)` | Sets an attribute from parsed data |
| `populateGameRule(type, rule)` | Initializes a `GameRule` instance from this definition |
| `getComplete(rule)` | Checks if the rule is complete for a given player |
| `setComplete(rule, val)` | Marks the rule complete or incomplete |
| `onUseTile(rule, tileId, x, y, z)` | Hook called when a player uses a tile (returns false by default) |
| `onCollectItem(rule, item)` | Hook called when a player collects an item (returns false by default) |
| `postProcessPlayer(player)` | Applied to a player after rule initialization (empty by default) |
| `getGoal()` / `getProgress(rule)` | For trackable rules: total goal and current progress (both return 0 by default) |
| `getIcon()` / `getAuxValue()` | Display icon for the rule (-1 and 0 by default) |
| `write(dos)` | Serializes the definition to a `DataOutputStream` |
| `writeAttributes(dos, numAttributes)` | Writes attribute data |
| `getChildren(vector)` | Fills a vector with child definitions (empty by default) |
| `enumerate()` | Returns a flat vector of this definition and all descendants |
| `enumerateMap()` | Returns a map from each definition to its index |

**Static methods:**

| Method | Purpose |
|---|---|
| `generateNewGameRulesInstance(type, rules, connection)` | Walks the definition tree and creates a populated `GameRulesInstance` |
| `generateDescriptionString(defType, description, data, dataLength)` | Builds a description string for network packets |

### Definition subclasses

#### CompoundGameRuleDefinition

Base class for rules that contain child rules. Manages a `m_children` vector and passes hooks down to all children.

#### CompleteAllRuleDefinition

Extends `CompoundGameRuleDefinition`. Returns `eGameRuleType_CompleteAllRule`. This one only completes when **all** child rules are complete. It broadcasts progress updates through `UpdateGameRuleProgressPacket`.

#### CollectItemRuleDefinition

Returns `eGameRuleType_CollectItemRule`. Tracks collection of a specific item. Configured with `m_itemId`, `m_auxValue`, and `m_quantity`. Each time the matching item is collected, the progress goes up.

#### UseTileRuleDefinition

Returns `eGameRuleType_UseTileRule`. Triggers when a player interacts with a specific tile (block). Can optionally require specific coordinates through `m_useCoords`.

#### UpdatePlayerRuleDefinition

Returns `eGameRuleType_UpdatePlayerRule`. Modifies player state when the rule is processed. Can set `m_health`, `m_food`, `m_yRot` (rotation), and spawn position. Contains child `AddItemRuleDefinition` entries for inventory setup.

#### AddItemRuleDefinition

Returns `eGameRuleType_AddItem`. Defines an item to add to a container or player inventory. Configured with `m_itemId`, `m_quantity`, `m_auxValue`, `m_dataTag`, and `m_slot`. Can contain child `AddEnchantmentRuleDefinition` entries.

In the `addChild()` method, it only accepts `eGameRuleType_AddEnchantment` as a child type.

#### AddEnchantmentRuleDefinition

Returns `eGameRuleType_AddEnchantment`. Configured with `m_enchantmentId` and `m_enchantmentLevel`.

#### ApplySchematicRuleDefinition

Returns `eGameRuleType_ApplySchematic`. Configured with `m_filename` (schematic file path) and `m_rot` (rotation). Used by `LevelGenerationOptions` to stamp structures into the world during generation.

#### ConsoleGenerateStructure

Returns `eGameRuleType_GenerateStructure`. A compound rule that accepts four child types:
- `eGameRuleType_GenerateBox` for filling regions
- `eGameRuleType_PlaceBlock` for individual blocks
- `eGameRuleType_PlaceContainer` for containers with items
- `eGameRuleType_PlaceSpawner` for mob spawners

The `processSchematic()` method walks children and executes them against a `LevelChunk`.

#### XboxStructureActionPlaceContainer

Returns `eGameRuleType_PlaceContainer`. Accepts `eGameRuleType_AddItem` as children. Places a container block in the world and fills it with the specified items.

#### BiomeOverride

Returns `eGameRuleType_BiomeOverride`. Configured with `m_topTileId` and `m_biomeId`.

#### StartFeature

Returns `eGameRuleType_StartFeature`. Configured with `m_feature` (feature name string).

#### LevelGenerationOptions

Returns `eGameRuleType_LevelGenerationOptions`. Accepts four child types:
- `eGameRuleType_ApplySchematic`
- `eGameRuleType_GenerateStructure`
- `eGameRuleType_BiomeOverride`
- `eGameRuleType_StartFeature`

Configured with `m_seed` and `m_flatworld` attributes.

#### LevelRuleset

Extends `CompoundGameRuleDefinition` as the root container for a level's rules. Manages `NamedAreaRuleDefinition` entries (named AABB regions in the world) and holds a `StringTable` for localized strings.

## GameRule (runtime state)

Each `GameRule` instance tracks the runtime state of a definition for a specific connection (player).

**State storage:** Parameters live in `m_parameters`, an `unordered_map<wstring, ValueType>` where `ValueType` is a union of:

- `__int64`, `int`, `char`, `bool`, `float`, `double` (primitive values)
- `GameRule*` (nested rule pointer, flagged with `isPointer = true`)

**Serialization:** `write()` and `read()` serialize all parameters to/from a `DataOutputStream`/`DataInputStream`. Pointer values are serialized recursively, and primitive values are stored as `__int64`.

## GameRulesInstance

Extends `GameRule` with an instance type:

| Type | Purpose |
|---|---|
| `eGameRulesInstanceType_ServerPlayer` | Rules applied per-player |
| `eGameRulesInstanceType_Server` | Rules applied server-wide |

Created through `GameRuleDefinition::generateNewGameRulesInstance()`, which walks the definition tree and populates parameters.

## GameRuleManager

The central manager that loads and manages all game rule definitions. Lives in the client code under `Common/GameRules/`.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `m_currentLevelGenerationOptions` | `LevelGenerationOptions*` | Active world gen options |
| `m_currentGameRuleDefinitions` | `LevelRuleset*` | Active level rules |
| `m_levelGenerators` | `LevelGenerators` | Collection of all level generation options |
| `m_levelRules` | `LevelRules` | Collection of all level rule definitions |

**Static data:**

- `wchTagNameA[]`: Maps `EGameRuleType` values to XML tag names (e.g., index 0 = `""` for Root, index 1 = `"MapOptions"` for LevelGenerationOptions, etc.)
- `wchAttrNameA[]`: Maps `EGameRuleAttr` values to XML attribute names
- `version_number` = 2

**Key operations:**

| Method | Purpose |
|---|---|
| `loadGameRules(DLCPack*)` | Loads rules from a DLC content pack |
| `loadGameRules(data, size)` | Loads rules from raw binary data. Returns a `LevelGenerationOptions*`. |
| `loadGameRules(lgo, data, size)` | Loads rules into an existing `LevelGenerationOptions` |
| `saveGameRules(data, size)` | Serializes current rules to binary via `writeRuleFile()` |
| `loadDefaultGameRules()` | Loads the built-in default ruleset |
| `processSchematics(levelChunk)` | Applies schematic rules to a newly generated chunk |
| `processSchematicsLighting(levelChunk)` | Applies lighting for schematics |
| `unloadCurrentGameRules()` | Cleans up and unloads the current ruleset |
| `setLevelGenerationOptions(levelGen)` | Sets the active world generation options |
| `getGameRuleDefinitions()` | Returns the current `LevelRuleset` |
| `getLevelGenerationOptions()` | Returns the current `LevelGenerationOptions*` |
| `getLevelGenerators()` | Returns all available level generators |
| `GetGameRulesString(key)` | Looks up a localized string from the current ruleset's string table |

### Binary format

Rules are stored in `.grf` files (`GAME_RULE_SAVENAME = "requiredGameRules.grf"`).

**Write process (`writeRuleFile()`):**

1. Write the version number (short)
2. Write the total number of tag+attribute strings (`eGameRuleType_Count + eGameRuleAttr_Count`)
3. Write all type tag names as UTF strings
4. Write all attribute names as UTF strings
5. Write the rule tree

**Read process (`readRuleFile()`):**

1. Read the string table (tag names and attribute names)
2. Build a `tagIdMap` mapping integer IDs back to `EGameRuleType` values
3. Read rule definitions recursively, creating the right subclass based on the type tag
4. For `eGameRuleType_LevelGenerationOptions`, creates a `LevelGenerationOptions` and adds it to the generators
5. For `eGameRuleType_LevelRules`, creates a `LevelRuleset`

The `readAttributes()` helper reads key-value pairs for a rule definition. The `readChildren()` helper recursively reads child rules.

## Rule hierarchy in DLC packs

A typical DLC mashup pack's rule file looks like this (conceptually):

```
Root
  LevelGenerationOptions (seed, flatworld)
    ApplySchematic (filename, position, rotation)
    GenerateStructure
      GenerateBox (region bounds, edge/fill tiles)
      PlaceBlock (position, block id)
      PlaceContainer (position)
        AddItem (item id, quantity, slot)
          AddEnchantment (enchantment id, level)
      PlaceSpawner (position, entity)
    BiomeOverride (region, biome id, top tile)
    StartFeature (feature name)
  LevelRules
    NamedArea (name, AABB bounds)
    CompleteAll
      CollectItem (item id, quantity)
      UseTile (tile id, optional coords)
    UpdatePlayer (health, food, rotation, spawn)
      AddItem (item id, quantity, slot)
        AddEnchantment (enchantment id, level)
```

The Root rule generates data for new players. LevelGenerationOptions controls how the world is built. LevelRules defines in-game objectives and player setup.

## Network synchronization

Rule progress updates are sent through `UpdateGameRuleProgressPacket` (packet ID 158). It contains:

| Field | Type | Purpose |
|---|---|---|
| `m_definitionType` | `EGameRuleType` | Which rule type changed (defaults to `eGameRuleType_LevelRules` in the constructor) |
| `m_messageId` | `wstring` | Description string ID |
| `m_icon` | `int` | Item icon to display |
| `m_auxValue` | `int` | Item aux value for icon |
| `m_dataTag` | `int` | Extra data tag |
| `m_data` | `byteArray` | Additional binary data |

## MinecraftConsoles differences

This is one of the bigger differences between LCEMP and MC. MC adds a **vanilla-style `GameRules` class** alongside the existing console game rules system.

### Vanilla GameRules class

MC has `GameRules.h` / `GameRules.cpp` with a proper key-value rule system. Each rule is a `GameRule` inner class that stores a `wstring` value and can parse it as boolean (`getBoolean()`), int (`getInt()`), or double (`getDouble()`). The `set()` method takes a new string value and re-parses all typed representations.

The rule constants are `static const int` (originally strings in Java, converted to ints by 4J):

| Rule Constant | Purpose |
|---|---|
| `RULE_DOFIRETICK` | Whether fire spreads |
| `RULE_MOBGRIEFING` | Whether mobs can modify blocks |
| `RULE_KEEPINVENTORY` | Whether players keep items on death |
| `RULE_DOMOBSPAWNING` | Whether mobs spawn naturally |
| `RULE_DOMOBLOOT` | Whether mobs drop loot |
| `RULE_DOTILEDROPS` | Whether blocks drop items when broken |
| `RULE_COMMANDBLOCKOUTPUT` | Whether command blocks show output |
| `RULE_NATURAL_REGENERATION` | Whether players regenerate health naturally |
| `RULE_DAYLIGHT` | Whether the day/night cycle progresses |

The `GameRules` object is stored on the `Level` and checked directly by gameplay code (like fire spread checking `getBoolean(RULE_DOFIRETICK)`).

MC also adds a `GameRuleCommand` for toggling these rules in-game via the `/gamerule` command.

LCEMP doesn't have any of this.

### How the two systems coexist

The console game rules system (`GameRuleManager` / `GameRuleDefinition` / `EGameRuleType` stuff documented above) still exists in MC. So MC has *both* systems running at the same time:

- **Vanilla `GameRules`**: Simple boolean toggles on the `Level`. Checked directly by gameplay code.
- **Console `GameRuleManager`**: Complex data-driven rules for DLC content packs and custom game modes. Runs through the `GameRuleManager`.

They don't interfere with each other. The vanilla rules are also exposed through host options in MC (see below).

### Console game rules in MC

The `ConsoleGameRulesConstants.h` file is identical between LCEMP and MC. The same `EGameRuleType` and `EGameRuleAttr` enums, the same tag names, the same binary format. The `GameRuleManager` read/write code is nearly identical too, just with minor C++ modernization (like `static_cast` instead of C-style casts).

### Host options as game rule proxies

In MC, the vanilla game rules are exposed to players through `eGameHostOption` entries in the host settings UI rather than chat commands:

| Host Option | Maps to Vanilla Rule |
|---|---|
| `eGameHostOption_FireSpreads` | `RULE_DOFIRETICK` |
| `eGameHostOption_MobGriefing` | `RULE_MOBGRIEFING` |
| `eGameHostOption_KeepInventory` | `RULE_KEEPINVENTORY` |
| `eGameHostOption_DoMobSpawning` | `RULE_DOMOBSPAWNING` |
| `eGameHostOption_DoMobLoot` | `RULE_DOMOBLOOT` |
| `eGameHostOption_DoTileDrops` | `RULE_DOTILEDROPS` |
| `eGameHostOption_NaturalRegeneration` | `RULE_NATURAL_REGENERATION` |
| `eGameHostOption_DoDaylightCycle` | `RULE_DAYLIGHT` |

LCEMP has `eGameHostOption_FireSpreads` (which predates the vanilla game rule system, it was a console-original feature) but not the other seven.
