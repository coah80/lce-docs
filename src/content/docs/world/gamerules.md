---
title: Game Rules
description: Configurable game rules in LCEMP.
---

LCEMP uses a **Console Game Rules** system that is fundamentally different from vanilla Minecraft's simple key-value game rules. Instead of boolean/integer rules like `keepInventory` or `doDaylightCycle`, LCEMP's game rules are a data-driven, hierarchical system primarily used for custom game modes (like Battle, Tumble, Glide) and DLC mashup packs.

## Architecture overview

The game rule system has four main layers:

1. **GameRuleManager** -- loads, saves, and manages rule definitions from DLC packs
2. **GameRuleDefinition** -- the static definition/template of a rule (what to do)
3. **GameRule** -- the runtime state of a rule for a specific player or server
4. **GameRulesInstance** -- extends `GameRule` as the top-level container for a player's or server's complete rule state

## ConsoleGameRules constants

The `EGameRuleType` enum defines all rule types:

| Enum Value | Purpose |
|---|---|
| `eGameRuleType_Root` | Top-level rule that defines a game mode; generates data for new players |
| `eGameRuleType_LevelGenerationOptions` | World generation configuration |
| `eGameRuleType_ApplySchematic` | Places a schematic structure in the world |
| `eGameRuleType_GenerateStructure` | Procedural structure generation |
| `eGameRuleType_GenerateBox` | Fills a box region with blocks |
| `eGameRuleType_PlaceBlock` | Places a single block |
| `eGameRuleType_PlaceContainer` | Places a container with items |
| `eGameRuleType_PlaceSpawner` | Places a mob spawner |
| `eGameRuleType_BiomeOverride` | Overrides biome for a region |
| `eGameRuleType_StartFeature` | Triggers a world generation feature |
| `eGameRuleType_AddItem` | Adds an item to inventory |
| `eGameRuleType_AddEnchantment` | Adds an enchantment to an item |
| `eGameRuleType_LevelRules` | The ruleset container for a level |
| `eGameRuleType_NamedArea` | Defines a named AABB area in the world |
| `eGameRuleType_UseTileRule` | Triggers when a player uses a specific tile |
| `eGameRuleType_CollectItemRule` | Triggers when a player collects a specific item |
| `eGameRuleType_CompleteAllRule` | Composite rule that completes when all children are done |
| `eGameRuleType_UpdatePlayerRule` | Modifies player state (health, food, inventory, rotation) |

### Rule attributes (EGameRuleAttr)

Rules are configured through attributes loaded from XML/binary data:

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

## GameRuleDefinition

The base class for all rule templates. Defines the static structure of a rule.

**Key methods:**

| Method | Purpose |
|---|---|
| `getActionType()` | Returns the `EGameRuleType` for this definition |
| `addChild(ruleType)` | Adds a child rule (for compound rules) |
| `addAttribute(name, value)` | Sets an attribute from parsed data |
| `populateGameRule(type, rule)` | Initializes a `GameRule` instance from this definition |
| `getComplete(rule)` | Checks if the rule is complete for a given player |
| `setComplete(rule, val)` | Marks the rule complete or incomplete |
| `onUseTile(rule, tileId, x, y, z)` | Hook called when a player uses a tile |
| `onCollectItem(rule, item)` | Hook called when a player collects an item |
| `postProcessPlayer(player)` | Applied to a player after rule initialization |
| `getGoal()` / `getProgress(rule)` | For trackable rules: total goal and current progress |
| `getIcon()` / `getAuxValue()` | Display icon for the rule |

### Definition subclasses

#### CompoundGameRuleDefinition

Base class for rules that contain child rules. Manages a `m_children` vector and delegates hooks to all children.

#### CompleteAllRuleDefinition

Extends `CompoundGameRuleDefinition`. Completes only when **all** child rules are complete. Broadcasts progress updates via `UpdateGameRuleProgressPacket`.

#### CollectItemRuleDefinition

Tracks collection of a specific item. Configured with `m_itemId`, `m_auxValue`, and `m_quantity`. Increments progress each time the matching item is collected.

#### UseTileRuleDefinition

Triggers when a player interacts with a specific tile (block). Can optionally require specific coordinates via `m_useCoords`.

#### UpdatePlayerRuleDefinition

Modifies player state when the rule is processed. Can set `m_health`, `m_food`, `m_yRot` (rotation), and spawn position. Contains child `AddItemRuleDefinition` entries for inventory setup.

#### AddItemRuleDefinition

Defines an item to add to a container or player inventory. Configured with `m_itemId`, `m_quantity`, `m_auxValue`, `m_dataTag`, and `m_slot`. Can contain child `AddEnchantmentRuleDefinition` entries.

#### LevelRuleset

Extends `CompoundGameRuleDefinition` as the root container for a level's rules. Manages `NamedAreaRuleDefinition` entries (named AABB regions in the world) and holds a `StringTable` for localized strings.

## GameRule (runtime state)

Each `GameRule` instance tracks the runtime state of a definition for a specific connection (player).

**State storage:** Parameters are stored in `m_parameters`, an `unordered_map<wstring, ValueType>` where `ValueType` is a union of:

- `__int64`, `int`, `char`, `bool`, `float`, `double` (primitive values)
- `GameRule*` (nested rule pointer, flagged with `isPointer = true`)

**Serialization:** `write()` and `read()` serialize all parameters to/from a `DataOutputStream`/`DataInputStream`. Pointer values are recursively serialized; primitive values are stored as `__int64`.

## GameRulesInstance

Extends `GameRule` with an instance type:

| Type | Purpose |
|---|---|
| `eGameRulesInstanceType_ServerPlayer` | Rules applied per-player |
| `eGameRulesInstanceType_Server` | Rules applied server-wide |

Created via `GameRuleDefinition::generateNewGameRulesInstance()` which walks the definition tree and populates parameters.

## GameRuleManager

The central manager that loads and manages all game rule definitions.

**Key operations:**

| Method | Purpose |
|---|---|
| `loadGameRules(DLCPack*)` | Loads rules from a DLC content pack |
| `loadGameRules(data, size)` | Loads rules from raw binary data |
| `saveGameRules(data, size)` | Serializes current rules to binary |
| `loadDefaultGameRules()` | Loads the built-in default ruleset |
| `processSchematics(levelChunk)` | Applies schematic rules to a newly generated chunk |
| `processSchematicsLighting(levelChunk)` | Applies lighting for schematics |
| `unloadCurrentGameRules()` | Cleans up and unloads the current ruleset |
| `setLevelGenerationOptions(levelGen)` | Sets the active world generation options |
| `getGameRuleDefinitions()` | Returns the current `LevelRuleset` |

Rules are stored in `.grf` files (`GAME_RULE_SAVENAME = "requiredGameRules.grf"`) with a version number (currently version 2).

## Network synchronization

Rule progress updates are sent via `UpdateGameRuleProgressPacket` (packet ID 158). It contains:

| Field | Type | Purpose |
|---|---|---|
| `m_definitionType` | `EGameRuleType` | Which rule type changed |
| `m_messageId` | `wstring` | Description string ID |
| `m_icon` | `int` | Item icon to display |
| `m_auxValue` | `int` | Item aux value for icon |
| `m_dataTag` | `int` | Extra data tag |
| `m_data` | `byteArray` | Additional binary data |
