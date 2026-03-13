---
title: Adding Commands
description: How the command system works in LCE and how to create new commands.
---

The command system in Legacy Console Edition is pretty different from Java Edition. Instead of parsing text strings like `/time set day`, commands are sent as binary packets with an enum ID and serialized arguments. This page covers how it all works and how to add your own commands.

## How Commands Work

On Java Edition, you type a command as text and the server parses it. On console, the UI builds a binary packet and sends it to the server. The server looks up the command by its enum ID and hands it the raw byte data to decode.

The key classes are:

- **`Command`** (base class) - Every command inherits from this
- **`CommandDispatcher`** - Routes command packets to the right `Command` instance
- **`EGameCommand`** - Enum of all command IDs
- **`GameCommandPacket`** - The network packet that carries command data

## The Command Base Class

```cpp
// Command.h
class Command
{
public:
    // Permission levels
    static const int LEVEL_ALL = 0;           // everyone
    static const int LEVEL_MODERATORS = 1;    // mute, etc.
    static const int LEVEL_GAMEMASTERS = 2;   // tp, give, seed, etc.
    static const int LEVEL_ADMINS = 3;        // ban, whitelist, etc.
    static const int LEVEL_OWNERS = 4;        // stop, save-all, etc.

    virtual EGameCommand getId() = 0;
    virtual int getPermissionLevel();
    virtual void execute(shared_ptr<CommandSender> source, byteArray commandData) = 0;
    virtual bool canExecute(shared_ptr<CommandSender> source);
};
```

Every command must implement `getId()` (which enum value it corresponds to) and `execute()` (what it actually does). The `getPermissionLevel()` defaults to `LEVEL_ALL` but most commands override it.

## Existing Commands

The command enum lives in `CommandsEnum.h`:

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

That's a pretty small list compared to Java Edition. The console version doesn't have text-based command parsing at all, so there's no `/gamerule` command, no `/fill`, no `/execute`, etc. Everything is driven through the UI menus.

## Example: The Time Command

Let's look at how `TimeCommand` works since it's a good simple example:

```cpp
// TimeCommand.h
class TimeCommand : public Command
{
public:
    virtual EGameCommand getId();
    virtual int getPermissionLevel();
    virtual void execute(shared_ptr<CommandSender> source, byteArray commandData);

protected:
    void doSetTime(shared_ptr<CommandSender> source, int value);
    void doAddTime(shared_ptr<CommandSender> source, int value);

public:
    static shared_ptr<GameCommandPacket> preparePacket(bool night);
};
```

The `execute()` method reads a boolean from the packet data and sets the time:

```cpp
// TimeCommand.cpp
EGameCommand TimeCommand::getId()
{
    return eGameCommand_Time;
}

int TimeCommand::getPermissionLevel()
{
    return LEVEL_GAMEMASTERS;
}

void TimeCommand::execute(shared_ptr<CommandSender> source, byteArray commandData)
{
    ByteArrayInputStream bais(commandData);
    DataInputStream dis(&bais);

    bool night = dis.readBoolean();
    bais.reset();

    int amount = 0;
    if (night) amount = 12500;
    doSetTime(source, amount);
    logAdminAction(source, ChatPacket::e_ChatCustom, L"commands.time.set");
}

void TimeCommand::doSetTime(shared_ptr<CommandSender> source, int value)
{
    for (int i = 0; i < MinecraftServer::getInstance()->levels.length; i++)
    {
        MinecraftServer::getInstance()->levels[i]->setDayTime(value);
    }
}
```

Notice the `preparePacket()` static method. This is called from the UI side to build the packet that gets sent to the server:

```cpp
shared_ptr<GameCommandPacket> TimeCommand::preparePacket(bool night)
{
    ByteArrayOutputStream baos;
    DataOutputStream dos(&baos);

    dos.writeBoolean(night);

    return std::make_shared<GameCommandPacket>(eGameCommand_Time, baos.toByteArray());
}
```

This is the pattern every command follows: a static `preparePacket()` on the client side, and `execute()` on the server side.

## Adding a New Command

Here's the full process. Let's say you want to add a `/heal` command that restores a player's health.

### Step 1: Add the Enum Value

In `CommandsEnum.h`, add your command before `eGameCommand_COUNT`:

```cpp
enum EGameCommand
{
    // ... existing commands ...
    eGameCommand_Teleport,
    eGameCommand_Heal,       // new
    eGameCommand_COUNT
};
```

### Step 2: Create the Command Class

Create `HealCommand.h`:

```cpp
#pragma once
#include "Command.h"

class HealCommand : public Command
{
public:
    virtual EGameCommand getId();
    virtual int getPermissionLevel();
    virtual void execute(shared_ptr<CommandSender> source, byteArray commandData);

    static shared_ptr<GameCommandPacket> preparePacket(PlayerUID targetPlayer);
};
```

Create `HealCommand.cpp`:

```cpp
#include "stdafx.h"
#include "net.minecraft.commands.h"
#include "HealCommand.h"
#include "../Minecraft.Client/MinecraftServer.h"
#include "../Minecraft.Client/PlayerList.h"
#include "../Minecraft.Client/ServerPlayer.h"

EGameCommand HealCommand::getId()
{
    return eGameCommand_Heal;
}

int HealCommand::getPermissionLevel()
{
    return LEVEL_GAMEMASTERS;
}

void HealCommand::execute(shared_ptr<CommandSender> source, byteArray commandData)
{
    ByteArrayInputStream bais(commandData);
    DataInputStream dis(&bais);

    PlayerUID targetId = dis.readLong();
    bais.reset();

    shared_ptr<ServerPlayer> target =
        MinecraftServer::getInstance()->getPlayerList()->getPlayer(targetId);

    if (target != nullptr)
    {
        target->setHealth(target->getMaxHealth());
        logAdminAction(source, ChatPacket::e_ChatCustom, L"commands.heal.success");
    }
}

shared_ptr<GameCommandPacket> HealCommand::preparePacket(PlayerUID targetPlayer)
{
    ByteArrayOutputStream baos;
    DataOutputStream dos(&baos);

    dos.writeLong(targetPlayer);

    return std::make_shared<GameCommandPacket>(eGameCommand_Heal, baos.toByteArray());
}
```

### Step 3: Register the Command

Commands are registered with the `CommandDispatcher`. Look for where the existing commands are added (usually in the server initialization code) and add yours:

```cpp
dispatcher->addCommand(new HealCommand());
```

### Step 4: Add to Build System

Add your new `.h` and `.cpp` files to `cmake/Sources.cmake` (or the relevant `.vcxproj` if you're using Visual Studio directly).

### Step 5: Trigger from UI

To actually call your command, you need UI code that builds and sends the packet. From a UI scene:

```cpp
// When the player clicks the "Heal" button
shared_ptr<GameCommandPacket> packet = HealCommand::preparePacket(targetPlayerId);
connection->send(packet);
```

## The CommandDispatcher

The dispatcher is straightforward. It maps enum IDs to `Command` pointers:

```cpp
// CommandDispatcher.h
class CommandDispatcher
{
private:
    unordered_map<EGameCommand, Command *> commandsById;
    unordered_set<Command *> commands;

public:
    int performCommand(shared_ptr<CommandSender> sender, EGameCommand command,
                       byteArray commandData);
    Command *addCommand(Command *command);
};
```

When a `GameCommandPacket` arrives, the server calls `performCommand()`, which checks permissions and calls `execute()` on the matching command.

## The Java Ghost

You might notice `GameRuleCommand.h` in the source tree. It's entirely commented out Java code from the original Mojang codebase, showing what the text-based `/gamerule` command looked like before 4J replaced it with the UI-driven host options system. It's kept around for reference but none of it compiles.

## Key Files

| File | What it does |
|---|---|
| `Command.h` | Base class with permission levels |
| `CommandsEnum.h` | `EGameCommand` enum |
| `CommandDispatcher.h` | Routes packets to command handlers |
| `TimeCommand.h/.cpp` | Good example command to copy from |
| `GiveItemCommand.h` | Another example (with more complex args) |
| `GameCommandPacket` | Network packet carrying command data |
