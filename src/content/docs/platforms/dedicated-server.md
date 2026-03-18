---
title: Dedicated Server
description: The standalone dedicated server module in LCE, its command system, properties, and architecture.
---

The `Minecraft.Server/` module is a standalone dedicated server that runs without rendering or UI. It uses text-based console commands instead of the binary packet-based command system in `Minecraft.World`. This page covers the full architecture, command list, server properties, and how the pieces connect.

## Architecture

The dedicated server has three main components:

```
Minecraft.Server/
├── Core/
│   ├── DedicatedServer.h/.cpp     # Main server class
│   ├── ServerProperties.h/.cpp    # Config file parser
│   └── main.cpp                   # Entry point
├── Commands/
│   ├── ServerCommand.h            # Base command class
│   ├── ConsoleCommandDispatcher.h # Command routing
│   └── ServerCommands.h/.cpp      # Command registration + helpers
├── Linux/
│   └── LinuxMain.cpp              # Linux entry point
└── Stubs/
    └── (platform stubs)           # Stub implementations for non-server systems
```

### DedicatedServer

**File**: `Minecraft.Server/Core/DedicatedServer.h`

`DedicatedServer` extends `ConsoleInputSource` and is the main server object. It owns a `ServerProperties` instance and manages the server lifecycle.

```cpp
class DedicatedServer : public ConsoleInputSource
{
public:
    DedicatedServer();
    ~DedicatedServer();

    bool init();
    int run();
    void shutdown();

    virtual void info(const wstring& string);
    virtual void warn(const wstring& string);
    virtual wstring getConsoleName();

    static int consoleInputThread(void *param);

private:
    void processConsoleInput();
    bool m_running;
    ServerProperties m_properties;
};
```

The server runs a separate thread for reading console input (`consoleInputThread`), while the main thread runs the game tick loop in `run()`. The `info()` and `warn()` methods handle logging output to the console.

### ConsoleInputSource

`DedicatedServer` inherits from `ConsoleInputSource` (defined in `Minecraft.Client/ConsoleInputSource.h`), which is the interface for anything that can submit text commands. This is how server commands get their `src` parameter -- it points back to the `DedicatedServer` instance that received the input.

## Server Properties

**Files**: `Minecraft.Server/Core/ServerProperties.h`, `ServerProperties.cpp`

The server reads its configuration from a `server.properties` file using a simple key=value format with `#` comments. Here is every property and its default value:

| Property | Type | Default | Notes |
|---|---|---|---|
| `server-port` | int | `25565` | Clamped to 1-65535 |
| `level-name` | string | `world` | Save directory name |
| `level-seed` | int64 | `0` | World seed (0 = random) |
| `gamemode` | int | `0` | 0=Survival, 1=Creative, 2=Adventure |
| `difficulty` | int | `2` | 0=Peaceful, 1=Easy, 2=Normal, 3=Hard |
| `max-players` | int | `8` | Clamped to 1-32 |
| `pvp` | bool | `true` | Player vs player combat |
| `trust-players` | bool | `true` | Whether players can build/break |
| `fire-spreads` | bool | `true` | Fire spread enabled |
| `tnt-explodes` | bool | `true` | TNT explosions enabled |
| `structures` | bool | `true` | Generate structures |
| `spawn-animals` | bool | `true` | Animal spawning |
| `spawn-npcs` | bool | `true` | Villager spawning |
| `online-mode` | bool | `false` | Require authentication |
| `show-gamertags` | bool | `true` | Show player names |
| `motd` | string | `A Minecraft LCE Server` | Server description |
| `white-list` | bool | `false` | Enable whitelist |
| `voice-chat` | bool | `false` | Voice chat support |
| `level-size` | string | `large` | World size |
| `advertise-lan` | bool | `true` | LAN broadcast |
| `server-ip` | string | (empty) | Bind address |

### File Format

The properties file uses the same format as Java Edition's `server.properties`:

```properties
#Minecraft server properties
#Wed Mar 18 12:00:00 2026
server-port=25565
level-name=world
level-seed=
gamemode=0
difficulty=2
max-players=8
pvp=true
trust-players=true
fire-spreads=true
tnt-explodes=true
structures=true
spawn-animals=true
spawn-npcs=true
online-mode=false
show-gamertags=true
motd=A Minecraft LCE Server
white-list=false
voice-chat=false
level-size=large
advertise-lan=true
server-ip=
```

The `save()` method writes a timestamp comment at the top. Blank seeds are written as `level-seed=` (empty value). Blank IPs are written as `server-ip=` (empty value).

### Type Accessors

`ServerProperties` provides typed accessor methods that read from the internal `map<wstring, wstring>`:

- `getString(key, defaultVal)` returns the raw string value
- `getInt(key, defaultVal)` uses `_wtoi()` to parse integers
- `getBool(key, defaultVal)` accepts `true`/`1` and `false`/`0`
- `getInt64(key, defaultVal)` uses `_wtoi64()` for 64-bit integers

## Command System

The dedicated server has its own text-based command system that is completely separate from the binary packet-based `CommandDispatcher` in `Minecraft.World`. Server commands are typed into the console and dispatched through `ConsoleCommandDispatcher`.

### ServerCommand Base Class

**File**: `Minecraft.Server/Commands/ServerCommand.h`

```cpp
class ServerCommand
{
public:
    virtual wstring getName() = 0;
    virtual wstring getUsage() = 0;
    virtual void execute(vector<wstring> args,
                         ConsoleInputSource *src,
                         MinecraftServer *server) = 0;

    static void notifyAdmins(...);
};
```

Every server command implements `getName()` (the command name), `getUsage()` (help text), and `execute()` (the actual logic). Arguments come as a `vector<wstring>` of space-separated tokens.

### ConsoleCommandDispatcher

**File**: `Minecraft.Server/Commands/ConsoleCommandDispatcher.h`

Routes commands by name using an internal `map<wstring, ServerCommand*>`.

```cpp
class ConsoleCommandDispatcher
{
    map<wstring, ServerCommand*> commands;

public:
    void addCommand(ServerCommand *cmd);
    void performCommand(const wstring& name,
                        vector<wstring> args,
                        ConsoleInputSource *src,
                        MinecraftServer *server);
    map<wstring, ServerCommand*>& getCommands();
};
```

### Command Registration

All 27 commands are registered in `CreateConsoleCommandDispatcher()`:

```cpp
ConsoleCommandDispatcher *CreateConsoleCommandDispatcher()
{
    ConsoleCommandDispatcher *d = new ConsoleCommandDispatcher();
    d->addCommand(new StopCommand());
    d->addCommand(new TpCommand());
    d->addCommand(new TimeCommand());
    // ... 24 more commands
    return d;
}
```

### Input Processing

`HandleServerCommand()` processes raw console input:

1. Trims whitespace from the input
2. Strips a leading `/` if present
3. Splits on spaces to get command name + arguments
4. Lowercases the command name
5. Dispatches through `ConsoleCommandDispatcher`

`GetServerCommandCompletions()` provides tab-completion by matching partial input against command names and online player names.

## All 27 Server Commands

| Command | What it does |
|---|---|
| `stop` | Shuts down the server |
| `tp` | Teleports a player to another player or coordinates |
| `time` | Sets or queries the world time |
| `toggledownfall` | Toggles rain/snow |
| `give` | Gives items to a player |
| `enchant` | Enchants a player's held item |
| `kill` | Kills a player |
| `gamemode` | Changes a player's game mode |
| `list` | Lists online players |
| `kick` | Kicks a player from the server |
| `say` | Broadcasts a message to all players |
| `me` | Sends an action message |
| `seed` | Shows the world seed |
| `xp` | Gives experience to a player |
| `defaultgamemode` | Sets the default game mode for new players |
| `save-all` | Forces a world save |
| `save-off` | Disables automatic saving |
| `save-on` | Enables automatic saving |
| `debug` | Toggles debug mode |
| `op` | Grants operator status to a player |
| `deop` | Removes operator status from a player |
| `ban` | Bans a player by name |
| `pardon` | Unbans a player by name |
| `ban-ip` | Bans an IP address |
| `pardon-ip` | Unbans an IP address |
| `banlist` | Shows the ban list |
| `whitelist` | Manages the whitelist (on/off/add/remove/list) |
| `help` | Shows available commands |

## Server Commands vs Game Commands

There are two completely separate command systems in LCE:

| Feature | Server Commands | Game Commands |
|---|---|---|
| **Location** | `Minecraft.Server/Commands/` | `Minecraft.World/` |
| **Base class** | `ServerCommand` | `Command` |
| **Dispatcher** | `ConsoleCommandDispatcher` (by name) | `CommandDispatcher` (by enum) |
| **Input** | Text from console, split into `vector<wstring>` | Binary `byteArray` from packets |
| **Count** | 27 | 10 |
| **Permission** | Operator status | `EGameCommand` permission levels (0-4) |
| **Used by** | Dedicated server console | In-game command UI |

The dedicated server commands are modeled after Java Edition's server console. The game commands are the binary packet commands used by the in-game command system. They overlap in functionality (both have `tp`, `time`, `give`, `gamemode`, etc.) but are entirely separate implementations.

## Linux Support

The `Linux/` directory contains `LinuxMain.cpp`, a Linux-specific entry point. This suggests 4J had at least partial Linux dedicated server support planned. The stubs directory provides placeholder implementations for platform systems that the dedicated server does not need (rendering, UI, etc.).

## Key Files

| File | What it does |
|---|---|
| `Core/DedicatedServer.h/.cpp` | Main server class, lifecycle, console input thread |
| `Core/ServerProperties.h/.cpp` | Config file parser with typed accessors |
| `Commands/ServerCommand.h` | Base class for all server commands |
| `Commands/ConsoleCommandDispatcher.h` | Name-based command routing |
| `Commands/ServerCommands.h/.cpp` | Registration, input processing, tab completion |
| `Linux/LinuxMain.cpp` | Linux entry point |
