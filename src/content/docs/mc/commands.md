---
title: "Commands"
description: "New and enhanced commands in MinecraftConsoles."
---

MinecraftConsoles has a command system based on the 4J Studios console edition architecture. Commands use a binary packet-based dispatch instead of the text-parsing approach from Java Edition.

## Command architecture

### Base class: Command

**File**: `Minecraft.World/Command.h`, `.cpp`

All commands extend the abstract `Command` class.

```cpp
class Command
{
public:
    virtual EGameCommand getId() = 0;
    virtual int getPermissionLevel();
    virtual void execute(shared_ptr<CommandSender> source, byteArray commandData) = 0;
    virtual bool canExecute(shared_ptr<CommandSender> source);

    static void logAdminAction(...);
};
```

Permission levels:

| Level | Constant | Examples |
|-------|----------|----------|
| 0 | `LEVEL_ALL` | help, emote |
| 1 | `LEVEL_MODERATORS` | mute |
| 2 | `LEVEL_GAMEMASTERS` | seed, tp, give |
| 3 | `LEVEL_ADMINS` | whitelist, ban |
| 4 | `LEVEL_OWNERS` | stop, save-all |

Unlike Java Edition, commands receive `byteArray commandData` (a binary packet) instead of parsed string arguments.

### CommandDispatcher

**File**: `Minecraft.World/CommandDispatcher.h`, `.cpp`

Routes commands by their `EGameCommand` enum value.

```cpp
class CommandDispatcher
{
    unordered_map<EGameCommand, Command*> commandsById;
    unordered_set<Command*> commands;

public:
    int performCommand(shared_ptr<CommandSender> sender, EGameCommand command, byteArray commandData);
    Command *addCommand(Command *command);
};
```

Checks `canExecute()` before running. If the sender doesn't have permission, a red "You do not have permission" message is shown (except in content packages).

### EGameCommand enum

**File**: `Minecraft.World/CommandsEnum.h`

```cpp
enum EGameCommand
{
    eGameCommand_DefaultGameMode,
    eGameCommand_Effect,
    eGameCommand_EnchantItem,
    eGameCommand_Experience,
    eGameCommand_GameMode,
    eGameCommand_Give,
    eGameCommand_Kill,
    eGameCommand_Time,
    eGameCommand_ToggleDownfall,
    eGameCommand_Teleport,
    eGameCommand_COUNT
};
```

## Implemented commands (C++)

These commands have native C++ implementations that are fully functional:

### GameModeCommand

**File**: `Minecraft.World/GameModeCommand.h`, `.cpp`

Changes a player's game mode. Permission level: `LEVEL_GAMEMASTERS`.

Includes `getModeForString()` to parse the mode argument. `DefaultGameModeCommand` extends this to set the server default game mode.

### GiveItemCommand

**File**: `Minecraft.World/GiveItemCommand.h`, `.cpp`

Gives items to players. Permission level: `LEVEL_GAMEMASTERS`.

Has a static `preparePacket()` helper that builds a `GameCommandPacket` with item ID, amount, aux value, and optional NBT tag string.

### KillCommand

**File**: `Minecraft.World/KillCommand.h`, `.cpp`

Kills the command sender. Permission level: `LEVEL_GAMEMASTERS`.

### TimeCommand

**File**: `Minecraft.World/TimeCommand.h`, `.cpp`

Sets or adds to the world time. Permission level: `LEVEL_GAMEMASTERS`.

Methods: `doSetTime()` and `doAddTime()`. Has a static `preparePacket()` for toggling day/night.

### ToggleDownfallCommand

**File**: `Minecraft.World/ToggleDownfallCommand.h`, `.cpp`

Toggles weather. Permission level: `LEVEL_GAMEMASTERS`.

### EnchantItemCommand

**File**: `Minecraft.World/EnchantItemCommand.h`, `.cpp`

Enchants a player's held item. Permission level: `LEVEL_GAMEMASTERS`.

Has a static `preparePacket()` that takes enchantment ID and level (default 1).

### ExperienceCommand

**File**: `Minecraft.World/ExperienceCommand.h`, `.cpp`

Grants experience to a player. Permission level: `LEVEL_GAMEMASTERS`.

### DefaultGameModeCommand

**File**: `Minecraft.World/DefaultGameModeCommand.h`, `.cpp`

Sets the server's default game mode. Extends `GameModeCommand`.

### TeleportCommand

**File**: `Minecraft.Client/TeleportCommand.h`, `.cpp`

Teleports players. Lives in `Minecraft.Client` rather than `Minecraft.World`.

### EffectCommand

**File**: `Minecraft.World/EffectCommand.h`, `.cpp`

Applies or removes status effects from players. Permission level: `LEVEL_GAMEMASTERS`.

:::caution[Stub implementation]
The `execute()` method body is entirely commented out in the current source. The Java-style pseudocode in the comments shows the intended behavior: parse player name, effect ID, duration, and amplifier; apply or clear effects.
:::

## Java reference commands (commented out)

Several command files have complete Java source code in block comments. These are reference implementations that haven't been ported to C++ yet:

### GameDifficultyCommand

**File**: `Minecraft.World/GameDifficultyCommand.h`

Sets the server difficulty. Accepts `peaceful`/`p`, `easy`/`e`, `normal`/`n`, `hard`/`h`, or numeric `0-3`. Tab-completion supported.

### GameRuleCommand

**File**: `Minecraft.World/GameRuleCommand.h`

Gets, sets, or lists game rules. With 0 args it lists all rules, with 1 arg it shows a rule value, with 2 args it sets a rule. Tab-completes rule names and `true`/`false` values.

### ShowSeedCommand

**File**: `Minecraft.World/ShowSeedCommand.h`

Displays the world seed. Allows execution in singleplayer regardless of permission level.

### WeatherCommand

**File**: `Minecraft.World/WeatherCommand.h`

Sets weather to `clear`, `rain`, or `thunder` with an optional duration in seconds. Default duration is 300 to 600 seconds (randomly chosen). Tab-completes weather type names.

### PlaySoundCommand

**File**: `Minecraft.World/PlaySoundCommand.h`

Plays a sound at a location for a specific player. Supports position, volume, pitch, and minimum volume arguments. Handles the case where the player is too far away by either sending the sound at reduced volume from a closer position or throwing an error.

### SpreadPlayersCommand

**File**: `Minecraft.World/SpreadPlayersCommand.h`

Spreads players randomly across an area. Has a `MAX_ITERATION_COUNT` of 10,000 for the randomization algorithm.

### SetPlayerTimeoutCommand, AdminLogCommand

- `SetPlayerTimeoutCommand.h` sets the connection timeout for a player
- `AdminLogCommand.h` is the logging backend used by `Command::logAdminAction()`

## EntitySelector

**File**: `Minecraft.World/EntitySelector.h`

Used throughout the command and entity systems for filtering entities.

```cpp
class EntitySelector
{
public:
    static const EntitySelector *ENTITY_STILL_ALIVE;
    static const EntitySelector *CONTAINER_ENTITY_SELECTOR;
    virtual bool matches(shared_ptr<Entity> entity) const = 0;
};
```

Built-in selectors:

| Class | Purpose |
|-------|---------|
| `AliveEntitySelector` | Matches entities that are still alive |
| `ContainerEntitySelector` | Matches entities that are containers |
| `MobCanWearArmourEntitySelector` | Matches mobs that can wear a specific armor item |

Additional selectors are defined alongside specific entities (e.g., `HorseEntitySelector` in `EntityHorse.h`, `LivingEntitySelector` in `WitherBoss.h`).

:::note
This is not the `@a`/`@p`/`@r`/`@e` target selector system from Java Edition. The console edition uses a different packet-based player selection mechanism through its UI-driven command system.
:::

## Comparison with LCE

LCE has a smaller set of commands. The commands in MinecraftConsoles but not in the LCE base include:

- `/effect` (stub)
- `/enchant`
- `/xp` (experience)
- `/defaultgamemode`
- All the Java-reference commands (difficulty, gamerule, seed, weather, playsound, spreadplayers)

Both codebases share the core commands: `/gamemode`, `/give`, `/kill`, `/time`, `/toggledownfall`, `/tp`.
