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

Here is the actual `Command.h` from the source:

```cpp
// Command.h
class Command
{
private:
    static AdminLogCommand *logger;

public:
    virtual EGameCommand getId() = 0;
    virtual void execute(shared_ptr<CommandSender> source, byteArray commandData) = 0;
    virtual bool canExecute(shared_ptr<CommandSender> source);

    static void logAdminAction(shared_ptr<CommandSender> source,
        ChatPacket::EChatPacketMessage messageType,
        const wstring& message = L"", int customData = -1,
        const wstring& additionalMessage = L"");
    static void setLogger(AdminLogCommand *logger);

protected:
    shared_ptr<ServerPlayer> getPlayer(PlayerUID playerId);
};
```

Every command must implement `getId()` (which enum value it corresponds to) and `execute()` (what it actually does).

:::note
The existing docs for LCE sometimes mention permission level constants like `LEVEL_ALL`, `LEVEL_GAMEMASTERS`, etc. These do not exist in the actual `Command.h`. The base class has no permission level constants at all. The `canExecute()` method delegates to `source->hasPermission(getId())` to check whether the sender is allowed to run the command. Individual commands can override `getPermissionLevel()` when they need custom restriction. For example, `EnchantItemCommand::getPermissionLevel()` returns `0` (everyone can use it).
:::

## The Command Enum

The command enum lives in `CommandsEnum.h`. Here are all 9 commands:

```cpp
enum EGameCommand
{
    eGameCommand_DefaultGameMode,
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

That is a pretty small list compared to Java Edition. The console version doesn't have text-based command parsing at all, so there is no `/gamerule` command, no `/fill`, no `/execute`, etc. Everything is driven through the UI menus.

:::caution
Some older documentation lists an `eGameCommand_Effect` entry in this enum. That does not exist in the actual source code. There are exactly 9 commands plus the `COUNT` sentinel.
:::

## All Existing Commands

Here is every command in the codebase, what it does, and whether it actually works:

### Working Commands

These commands have real implementations that do something when called.

#### TimeCommand

Sets the world time to day or night. The simplest command in the codebase.

**Packet format:** 1 boolean (`night`). If true, sets time to 12500 (night). If false, sets time to 0 (day).

**Server behavior:** Loops over all levels (Overworld, Nether, End) and calls `setTimeAndAdjustTileTicks()` on each one.

```cpp
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
```

The source file has commented-out Java code showing the original text-based version that supported `set day`, `set night`, `set <number>`, and `add <number>`. The console version only kept the day/night toggle.

**Client side:**
```cpp
shared_ptr<GameCommandPacket> TimeCommand::preparePacket(bool night)
{
    ByteArrayOutputStream baos;
    DataOutputStream dos(&baos);
    dos.writeBoolean(night);
    return shared_ptr<GameCommandPacket>(
        new GameCommandPacket(eGameCommand_Time, baos.toByteArray()));
}
```

#### GiveItemCommand

Drops an item to a specific player.

**Packet format:** PlayerUID + int (item ID) + int (amount) + int (aux/data value) + UTF string (NBT tag string).

**Server behavior:** Looks up the player by UID, creates an `ItemInstance`, and calls `player->drop()` to spawn the item at the player's feet.

```cpp
void GiveItemCommand::execute(shared_ptr<CommandSender> source, byteArray commandData)
{
    ByteArrayInputStream bais(commandData);
    DataInputStream dis(&bais);

    PlayerUID uid = dis.readPlayerUID();
    int item = dis.readInt();
    int amount = dis.readInt();
    int aux = dis.readInt();
    wstring tag = dis.readUTF();
    bais.reset();

    shared_ptr<ServerPlayer> player = getPlayer(uid);
    if (player != NULL && item > 0 && Item::items[item] != NULL)
    {
        shared_ptr<ItemInstance> itemInstance =
            shared_ptr<ItemInstance>(new ItemInstance(item, amount, aux));
        player->drop(itemInstance);
        logAdminAction(source, ChatPacket::e_ChatCustom,
            L"commands.give.success", item, player->getAName());
    }
}
```

#### KillCommand

Kills the player who sent the command. Unlike Java Edition, this does not take a target argument. It just kills you.

**Packet format:** None. No data needed.

**Server behavior:** Gets the calling player from the source and deals 1000 `outOfWorld` damage. Sends a message: "Ouch. That look like it hurt." (yes, the typo is real).

```cpp
void KillCommand::execute(shared_ptr<CommandSender> source, byteArray commandData)
{
    shared_ptr<Player> player = dynamic_pointer_cast<Player>(source);
    player->hurt(DamageSource::outOfWorld, 1000);
    source->sendMessage(L"Ouch. That look like it hurt.");
}
```

#### EnchantItemCommand

Adds an enchantment to a player's held item.

**Packet format:** PlayerUID + int (enchantment ID) + int (enchantment level).

**Server behavior:** Gets the player's currently selected item, validates the enchantment (checks if it can apply to that item type, clamps level to valid range, checks compatibility with existing enchantments), then applies it.

```cpp
void EnchantItemCommand::execute(shared_ptr<CommandSender> source, byteArray commandData)
{
    ByteArrayInputStream bais(commandData);
    DataInputStream dis(&bais);

    PlayerUID uid = dis.readPlayerUID();
    int enchantmentId = dis.readInt();
    int enchantmentLevel = dis.readInt();
    bais.reset();

    shared_ptr<ServerPlayer> player = getPlayer(uid);
    if (player == NULL) return;

    shared_ptr<ItemInstance> selectedItem = player->getSelectedItem();
    if (selectedItem == NULL) return;

    Enchantment *e = Enchantment::enchantments[enchantmentId];
    if (e == NULL) return;
    if (!e->canEnchant(selectedItem)) return;

    // Clamp level to valid range
    if (enchantmentLevel < e->getMinLevel()) enchantmentLevel = e->getMinLevel();
    if (enchantmentLevel > e->getMaxLevel()) enchantmentLevel = e->getMaxLevel();

    // Check compatibility with existing enchantments
    if (selectedItem->hasTag())
    {
        ListTag<CompoundTag> *enchantmentTags = selectedItem->getEnchantmentTags();
        if (enchantmentTags != NULL)
        {
            for (int i = 0; i < enchantmentTags->size(); i++)
            {
                int type = enchantmentTags->get(i)->getShort(
                    (wchar_t *)ItemInstance::TAG_ENCH_ID);
                if (Enchantment::enchantments[type] != NULL)
                {
                    Enchantment *other = Enchantment::enchantments[type];
                    if (!other->isCompatibleWith(e)) return;
                }
            }
        }
    }

    selectedItem->enchant(e, enchantmentLevel);
    logAdminAction(source, ChatPacket::e_ChatCustom, L"commands.enchant.success");
}
```

The `getPermissionLevel()` for this command returns `0` (everyone), not the higher permission you might expect. The comment in source says `//aLEVEL_GAMEMASTERS`.

#### ToggleDownfallCommand

Toggles rain on/off and enables thunder.

**Packet format:** None. Empty byte array.

**Server behavior:** Calls `toggleDownfall()` on the overworld level, then forces `setThundering(true)`.

```cpp
void ToggleDownfallCommand::execute(shared_ptr<CommandSender> source,
                                     byteArray commandData)
{
    doToggleDownfall();
    logAdminAction(source, ChatPacket::e_ChatCustom, L"commands.downfall.success");
}

void ToggleDownfallCommand::doToggleDownfall()
{
    MinecraftServer::getInstance()->levels[0]->toggleDownfall();
    MinecraftServer::getInstance()->levels[0]->getLevelData()->setThundering(true);
}
```

Note that it always sets thundering to true. If it starts raining, it will also be thundering.

#### TeleportCommand

Teleports one player to another player's location.

**Packet format:** PlayerUID (subject) + PlayerUID (destination).

**Server behavior:** Looks up both players, checks they are in the same dimension and the subject is alive, dismounts the subject from any vehicle, then teleports them. Sends chat messages to both players about what happened.

```cpp
void TeleportCommand::execute(shared_ptr<CommandSender> source, byteArray commandData)
{
    ByteArrayInputStream bais(commandData);
    DataInputStream dis(&bais);

    PlayerUID subjectID = dis.readPlayerUID();
    PlayerUID destinationID = dis.readPlayerUID();
    bais.reset();

    PlayerList *players = MinecraftServer::getInstance()->getPlayerList();
    shared_ptr<ServerPlayer> subject = players->getPlayer(subjectID);
    shared_ptr<ServerPlayer> destination = players->getPlayer(destinationID);

    if (subject != NULL && destination != NULL
        && subject->level->dimension->id == destination->level->dimension->id
        && subject->isAlive())
    {
        subject->ride(nullptr);  // dismount from any vehicle
        subject->connection->teleport(
            destination->x, destination->y, destination->z,
            destination->yRot, destination->xRot);
        logAdminAction(source, ChatPacket::e_ChatCommandTeleportSuccess,
            subject->getName(), eTYPE_SERVERPLAYER, destination->getName());

        if (subject == source)
            destination->sendMessage(subject->getName(),
                ChatPacket::e_ChatCommandTeleportToMe);
        else
            subject->sendMessage(destination->getName(),
                ChatPacket::e_ChatCommandTeleportMe);
    }
}
```

Unlike Java Edition, you cannot teleport to coordinates. Only player-to-player teleportation is supported. Cross-dimension teleportation is also blocked (both players must be in the same dimension).

:::note
This command lives in `Minecraft.Client/TeleportCommand.cpp`, not in `Minecraft.World/` like most other commands. It needs access to `PlayerList`, `ServerPlayer`, and `PlayerConnection` which live on the client/server side.
:::

### Stubbed Commands

These commands exist in the enum and have class files, but their `execute()` methods are empty. All the logic is commented out as old Java code.

#### ExperienceCommand

**Status:** Completely stubbed out. The `execute()` method is empty. The `getPlayer()` helper returns `nullptr`.

The commented-out Java code shows it was supposed to read a player UID and an XP amount, then call `player.increaseXp(amount)`. This never got implemented for console because XP is managed through the game UI instead.

#### DefaultGameModeCommand

**Status:** Completely stubbed out. The `execute()` method is empty. The `doSetGameType()` helper has its body commented out.

The Java version would have called `MinecraftServer::getInstance()->setDefaultGameMode(newGameType)`. On console, the default game mode is set through the host options menu instead.

#### GameModeCommand

**Status:** Completely stubbed out. The `execute()` method is empty. The `getModeForString()` helper returns `NULL`.

Same story as DefaultGameModeCommand. Game mode changes happen through the host options UI, not commands.

### Command Summary Table

| Command | Enum ID | Packet Data | Status | What It Does |
|---|---|---|---|---|
| TimeCommand | `eGameCommand_Time` | bool (night) | Working | Sets time to 0 (day) or 12500 (night) |
| GiveItemCommand | `eGameCommand_Give` | PlayerUID, int item, int amount, int aux, string tag | Working | Drops an item at a player's feet |
| KillCommand | `eGameCommand_Kill` | (none) | Working | Kills the calling player with 1000 damage |
| EnchantItemCommand | `eGameCommand_EnchantItem` | PlayerUID, int enchantId, int level | Working | Enchants the target player's held item |
| ToggleDownfallCommand | `eGameCommand_ToggleDownfall` | (none) | Working | Toggles rain and enables thunder |
| TeleportCommand | `eGameCommand_Teleport` | PlayerUID subject, PlayerUID destination | Working | Teleports one player to another |
| ExperienceCommand | `eGameCommand_Experience` | (none used) | Stubbed | Empty implementation |
| DefaultGameModeCommand | `eGameCommand_DefaultGameMode` | (none used) | Stubbed | Empty implementation |
| GameModeCommand | `eGameCommand_GameMode` | (none used) | Stubbed | Empty implementation |

## The CommandDispatcher

The dispatcher is simple. It maps enum IDs to `Command` pointers:

```cpp
void CommandDispatcher::performCommand(shared_ptr<CommandSender> sender,
                                        EGameCommand command,
                                        byteArray commandData)
{
    AUTO_VAR(it, commandsById.find(command));
    if (it != commandsById.end())
    {
        Command *command = it->second;
        if (command->canExecute(sender))
        {
            command->execute(sender, commandData);
        }
        else
        {
            sender->sendMessage(
                L"\u00A7cYou do not have permission to use this command.");
        }
    }
    else
    {
        app.DebugPrintf("Command %d not found!\n", command);
    }
}

Command *CommandDispatcher::addCommand(Command *command)
{
    commandsById[command->getId()] = command;
    commands.insert(command);
    return command;
}
```

When a `GameCommandPacket` arrives, the server calls `performCommand()`, which checks permissions via `canExecute()` and calls `execute()` on the matching command. If the command is not found or the player lacks permission, it sends an error message.

The permission error message uses the section sign (`\u00A7c`) to color it red in the chat. This is compiled out in content packages (`#ifndef _CONTENT_PACKAGE`).

## The Packet Pattern

Every working command follows the same two-part pattern:

1. **Client side:** A static `preparePacket()` method that writes arguments into a `ByteArrayOutputStream` and wraps them in a `GameCommandPacket`.
2. **Server side:** An `execute()` method that reads those arguments back from a `ByteArrayInputStream`.

The `GameCommandPacket` is just a wrapper around the enum ID and a byte array:

```cpp
// Client builds it
shared_ptr<GameCommandPacket> packet = TimeCommand::preparePacket(true);

// Network carries it to the server

// Server unpacks and routes it
dispatcher->performCommand(sender, packet->getCommand(), packet->getData());
```

There is no text parsing, no argument validation beyond what each command does manually, and no tab completion. The UI is responsible for making sure the data is valid before sending.

## Adding a New Command

Here is the full process. Let's say you want to add a `/heal` command that restores a player's health.

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
    virtual void execute(shared_ptr<CommandSender> source, byteArray commandData);

    static shared_ptr<GameCommandPacket> preparePacket(PlayerUID targetPlayer);
};
```

Create `HealCommand.cpp`:

```cpp
#include "stdafx.h"
#include "net.minecraft.commands.h"
#include "net.minecraft.network.packet.h"
#include "../Minecraft.Client/MinecraftServer.h"
#include "../Minecraft.Client/PlayerList.h"
#include "../Minecraft.Client/ServerPlayer.h"
#include "HealCommand.h"

EGameCommand HealCommand::getId()
{
    return eGameCommand_Heal;
}

void HealCommand::execute(shared_ptr<CommandSender> source, byteArray commandData)
{
    ByteArrayInputStream bais(commandData);
    DataInputStream dis(&bais);

    PlayerUID targetId = dis.readPlayerUID();
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

    dos.writePlayerUID(targetPlayer);

    return shared_ptr<GameCommandPacket>(
        new GameCommandPacket(eGameCommand_Heal, baos.toByteArray()));
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

## The Java Ghost

You might notice commented-out Java code inside `ExperienceCommand`, `DefaultGameModeCommand`, and `GameModeCommand`. These are snapshots of the Java originals that never got ported to the packet-based system. They show what the text-based commands looked like before 4J replaced them with the UI-driven host options system.

## Key Files

| File | What it does |
|---|---|
| `Minecraft.World/Command.h` | Base class with `getId()`, `execute()`, `canExecute()`, `logAdminAction()` |
| `Minecraft.World/CommandsEnum.h` | `EGameCommand` enum (9 commands + COUNT) |
| `Minecraft.World/CommandDispatcher.cpp` | Routes packets to command handlers, checks permissions |
| `Minecraft.World/TimeCommand.cpp` | Day/night toggle (good simple example) |
| `Minecraft.World/GiveItemCommand.cpp` | Give items to players (complex packet example) |
| `Minecraft.World/KillCommand.cpp` | Self-kill (no-packet example) |
| `Minecraft.World/EnchantItemCommand.cpp` | Apply enchantments with validation |
| `Minecraft.World/ToggleDownfallCommand.cpp` | Toggle rain/thunder |
| `Minecraft.Client/TeleportCommand.cpp` | Player-to-player teleportation |
| `Minecraft.World/ExperienceCommand.cpp` | Stubbed out, commented Java code |
| `Minecraft.World/DefaultGameModeCommand.cpp` | Stubbed out, commented Java code |
| `Minecraft.World/GameModeCommand.cpp` | Stubbed out, commented Java code |
| `Minecraft.World/GameCommandPacket.h` | Network packet carrying command data |
