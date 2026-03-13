---
title: Multiplayer & Packets
description: How to create custom packets for multiplayer mod sync in LCE.
---

LCE uses a packet-based networking system from Minecraft's legacy console networking. The server and each client talk over TCP sockets by sending `Packet` objects that get serialized with `DataOutputStream` and deserialized with `DataInputStream`. This guide covers how the system works and how to add your own custom packets.

## Architecture overview

```
Client                          Server
  |                               |
  |   Connection (TCP socket)     |
  |<----------------------------->|
  |                               |
  ClientConnection               PlayerConnection
  (PacketListener)               (PacketListener)
  |                               |
  handles incoming               handles incoming
  server packets                 client packets
```

| Class | File | Role |
|---|---|---|
| `Packet` | `Minecraft.World/Packet.h` | Abstract base for all packets |
| `PacketListener` | `Minecraft.World/PacketListener.h` | Abstract handler interface |
| `Connection` | `Minecraft.World/Connection.h` | TCP socket wrapper with read/write threads |
| `ClientConnection` | `Minecraft.Client/ClientConnection.h` | Client-side packet handler |
| `PlayerConnection` | `Minecraft.Client/PlayerConnection.h` | Server-side per-player packet handler |

## The Packet base class

`Packet` (`Minecraft.World/Packet.h`) defines the interface every packet needs to implement:

```cpp
class Packet {
public:
    static void staticCtor();  // registers all packet IDs

    virtual int getId() = 0;
    virtual void read(DataInputStream *dis) = 0;
    virtual void write(DataOutputStream *dos) = 0;
    virtual void handle(PacketListener *listener) = 0;
    virtual int getEstimatedSize() = 0;

    // Optional overrides
    virtual bool canBeInvalidated();
    virtual bool isInvalidatedBy(shared_ptr<Packet> packet);
    virtual bool isAync();

    // Static utilities
    static shared_ptr<Packet> readPacket(DataInputStream *dis, bool isServer);
    static void writePacket(shared_ptr<Packet> packet, DataOutputStream *dos);
    static void writeUtf(const wstring& value, DataOutputStream *dos);
    static wstring readUtf(DataInputStream *dis, int maxLength);
    static shared_ptr<ItemInstance> readItem(DataInputStream *dis);
    static void writeItem(shared_ptr<ItemInstance> item, DataOutputStream *dos);
    static CompoundTag *readNbt(DataInputStream *dis);

protected:
    static void writeNbt(CompoundTag *tag, DataOutputStream *dos);
};
```

### Key methods

| Method | Purpose |
|---|---|
| `getId()` | Returns the packet's unique numeric ID |
| `read()` | Reads the packet from a data stream |
| `write()` | Writes the packet to a data stream |
| `handle()` | Sends it to the right `PacketListener` method |
| `getEstimatedSize()` | Returns approximate byte size for buffer management |

### Static helpers

The `Packet` class provides serialization helpers for common types:

- `writeUtf()` / `readUtf()` for wide strings with length prefix
- `writeItem()` / `readItem()` for `ItemInstance` serialization (ID, count, damage, NBT)
- `writeNbt()` / `readNbt()` for `CompoundTag` (NBT) serialization
- `writeBytes()` / `readBytes()` for raw byte arrays

## Packet registration

All packets are registered in `Packet::staticCtor()` (`Minecraft.World/Packet.cpp`) using the `map()` function:

```cpp
static void map(
    int id,                  // unique packet ID
    bool receiveOnClient,    // can the client receive this?
    bool receiveOnServer,    // can the server receive this?
    bool sendToAnyClient,    // send to all clients or just the source?
    bool renderStats,        // show in debug packet stats?
    const type_info& clazz,  // RTTI type info
    packetCreateFn fn        // factory function: shared_ptr<Packet>(*)()
);
```

Every packet class needs a static `create()` factory function:

```cpp
static shared_ptr<Packet> create() { return shared_ptr<Packet>(new MyPacket()); }
```

### Existing packet ID ranges

| Range | Category | Examples |
|---|---|---|
| 0-9 | Core | KeepAlive, Login, PreLogin, Chat, SetTime, SetHealth, Respawn |
| 10-19 | Player movement | MovePlayer, PlayerAction, UseItem, SetCarriedItem |
| 20-29 | Entity spawning | AddPlayer, AddEntity, AddMob, AddPainting, RemoveEntities |
| 30-35 | Entity movement | MoveEntity, TeleportEntity, RotateHead |
| 38-43 | Entity state | EntityEvent, SetRiding, SetEntityData, MobEffects, XP |
| 50-55 | Chunk/tile | ChunkVisibility, BlockRegion, ChunkTiles, TileUpdate, TileEvent |
| 60-71 | World events | Explode, LevelEvent, LevelSound, GameEvent, AddGlobalEntity |
| 100-108 | Containers | ContainerOpen/Close/Click/SetSlot/SetContent/SetData |
| 130-132 | Signs/maps | SignUpdate, ComplexItemData, TileEntityData |
| 150-165 | 4J custom | CraftItem, TradeItem, DebugOptions, Textures, Progress, GameRules |

IDs 150+ are custom additions by 4J Studios for the console edition. Use IDs in an unused range (like 200+) for your mod packets.

## Concrete example: ChatPacket

`ChatPacket` is a good reference for building a custom packet. Here's its complete structure:

### Header (`ChatPacket.h`)

```cpp
class ChatPacket : public Packet, public enable_shared_from_this<ChatPacket> {
public:
    enum EChatPacketMessage {
        e_ChatCustom = 0,
        e_ChatBedOccupied,
        e_ChatPlayerJoinedGame,
        // ... more message types
    };

    vector<wstring> m_stringArgs;
    vector<int> m_intArgs;
    EChatPacketMessage m_messageType;

    ChatPacket();
    ChatPacket(const wstring& message, EChatPacketMessage type = e_ChatCustom,
               int customData = -1, const wstring& additionalMessage = L"");

    virtual void read(DataInputStream *dis);
    virtual void write(DataOutputStream *dos);
    virtual void handle(PacketListener *listener);
    virtual int getEstimatedSize();

    static shared_ptr<Packet> create() { return shared_ptr<Packet>(new ChatPacket()); }
    virtual int getId() { return 3; }
};
```

### Serialization (`ChatPacket.cpp`)

```cpp
void ChatPacket::write(DataOutputStream *dos) {
    dos->writeShort(m_messageType);

    // Pack string count and int count into a single short
    short packedCounts = 0;
    packedCounts |= (m_stringArgs.size() & 0xF) << 4;
    packedCounts |= (m_intArgs.size() & 0xF) << 0;
    dos->writeShort(packedCounts);

    for (int i = 0; i < m_stringArgs.size(); i++) {
        writeUtf(m_stringArgs[i], dos);
    }
    for (int i = 0; i < m_intArgs.size(); i++) {
        dos->writeInt(m_intArgs[i]);
    }
}

void ChatPacket::read(DataInputStream *dis) {
    m_messageType = (EChatPacketMessage) dis->readShort();

    short packedCounts = dis->readShort();
    int stringCount = (packedCounts >> 4) & 0xF;
    int intCount = (packedCounts >> 0) & 0xF;

    for (int i = 0; i < stringCount; i++) {
        m_stringArgs.push_back(readUtf(dis, MAX_LENGTH));
    }
    for (int i = 0; i < intCount; i++) {
        m_intArgs.push_back(dis->readInt());
    }
}
```

### Dispatching

```cpp
void ChatPacket::handle(PacketListener *listener) {
    listener->handleChat(shared_from_this());
}
```

The `handle()` method calls the matching virtual method on `PacketListener`. `ClientConnection` and `PlayerConnection` each override `handleChat()` to process the message on their side.

## PacketListener

`PacketListener` (`Minecraft.World/PacketListener.h`) declares virtual handler methods for every packet type:

```cpp
class PacketListener {
public:
    virtual bool isServerPacketListener() = 0;
    virtual void handleChat(shared_ptr<ChatPacket> packet);
    virtual void handleLogin(shared_ptr<LoginPacket> packet);
    virtual void handleMovePlayer(shared_ptr<MovePlayerPacket> packet);
    // ... one handler per packet type
    virtual void onDisconnect(DisconnectPacket::eDisconnectReason reason, void *reasonObjects);
};
```

There are two implementations:

- **`ClientConnection`** (`Minecraft.Client/ClientConnection.h`) is the client side, returns `false` from `isServerPacketListener()`
- **`PlayerConnection`** (`Minecraft.Client/PlayerConnection.h`) is the server side, returns `true` from `isServerPacketListener()`

## Connection (transport layer)

`Connection` (`Minecraft.World/Connection.h`) manages the TCP socket and packet queues:

```cpp
class Connection {
    Socket *socket;
    DataInputStream *dis;
    DataOutputStream *bufferedDos;

    queue<shared_ptr<Packet>> incoming;
    queue<shared_ptr<Packet>> outgoing;
    queue<shared_ptr<Packet>> outgoing_slow;

    PacketListener *packetListener;

public:
    Connection(Socket *socket, const wstring& id, PacketListener *packetListener);

    void send(shared_ptr<Packet> packet);
    void queueSend(shared_ptr<Packet> packet);
    void tick();
    void flush();
    void close(DisconnectPacket::eDisconnectReason reason, ...);
};
```

Key design points:

- **Separate read/write threads**: `Connection` spawns dedicated threads for reading and writing packets, using critical sections for thread safety
- **Two outgoing queues**: `outgoing` for normal priority, `outgoing_slow` for bulk data
- **Timeout**: connections time out after `MAX_TICKS_WITHOUT_INPUT` (1200 ticks / 60 seconds)
- **Packet statistics**: optional per-packet-type tracking for debugging

### LAN architecture

LCE uses a **listen server** model for multiplayer. One console is both the server and a client:

1. The host runs `MinecraftServer` which listens on a socket
2. Remote players connect through `ClientConnection` over the LAN
3. Local players on the host share the same process, so their packets skip the network
4. Each remote player gets a `PlayerConnection` on the server side
5. The `sendToAnyClient` flag on packet registration controls whether a packet goes to all connected clients or just the one who sent it

## Creating a custom packet

### Step 1: Define the packet class

```cpp
// MyModPacket.h
#pragma once
#include "Packet.h"

class MyModPacket : public Packet, public enable_shared_from_this<MyModPacket> {
public:
    int action;
    wstring data;

    MyModPacket();
    MyModPacket(int action, const wstring& data);

    virtual int getId() { return 200; }  // use an unused ID
    virtual void read(DataInputStream *dis);
    virtual void write(DataOutputStream *dos);
    virtual void handle(PacketListener *listener);
    virtual int getEstimatedSize();

    static shared_ptr<Packet> create() {
        return shared_ptr<Packet>(new MyModPacket());
    }
};
```

### Step 2: Implement serialization

```cpp
// MyModPacket.cpp
#include "stdafx.h"
#include "MyModPacket.h"
#include "PacketListener.h"

MyModPacket::MyModPacket() : action(0) {}

MyModPacket::MyModPacket(int action, const wstring& data)
    : action(action), data(data) {}

void MyModPacket::write(DataOutputStream *dos) {
    dos->writeInt(action);
    writeUtf(data, dos);
}

void MyModPacket::read(DataInputStream *dis) {
    action = dis->readInt();
    data = readUtf(dis, 256);
}

void MyModPacket::handle(PacketListener *listener) {
    listener->handleMyModPacket(shared_from_this());
}

int MyModPacket::getEstimatedSize() {
    return sizeof(int) + (data.length() * sizeof(wchar_t));
}
```

### Step 3: Register the packet

Add to `Packet::staticCtor()` in `Packet.cpp`:

```cpp
// Custom mod packet: received on both client and server, sent to all clients
map(200, true, true, true, false, typeid(MyModPacket), MyModPacket::create);
```

Here's what the registration flags mean:

| Flag | `true` | `false` |
|---|---|---|
| `receiveOnClient` | Client can receive this packet | Client ignores it |
| `receiveOnServer` | Server can receive this packet | Server ignores it |
| `sendToAnyClient` | Broadcast to all clients | Only send to specific player |
| `renderStats` | Show in debug stats overlay | Hidden from stats |

### Step 4: Add the handler to PacketListener

In `PacketListener.h`, add the virtual handler:

```cpp
virtual void handleMyModPacket(shared_ptr<MyModPacket> packet);
```

### Step 5: Implement handlers

In `ClientConnection` (client-side handling):

```cpp
void ClientConnection::handleMyModPacket(shared_ptr<MyModPacket> packet) {
    // Handle on client -- update UI, play effects, etc.
}
```

In `PlayerConnection` (server-side handling):

```cpp
void PlayerConnection::handleMyModPacket(shared_ptr<MyModPacket> packet) {
    // Handle on server -- validate, update game state, broadcast
}
```

### Step 6: Send the packet

From client to server:

```cpp
// Via ClientConnection
clientConnection->send(make_shared<MyModPacket>(1, L"hello"));
```

From server to a specific player:

```cpp
// Via PlayerConnection
playerConnection->send(make_shared<MyModPacket>(2, L"response"));
```

## Serialization reference

The `DataOutputStream` / `DataInputStream` classes support these types:

| Write method | Read method | Size |
|---|---|---|
| `writeByte(int)` | `readByte()` | 1 byte |
| `writeShort(int)` | `readShort()` | 2 bytes |
| `writeInt(int)` | `readInt()` | 4 bytes |
| `writeLong(__int64)` | `readLong()` | 8 bytes |
| `writeFloat(float)` | `readFloat()` | 4 bytes |
| `writeDouble(double)` | `readDouble()` | 8 bytes |
| `writeBoolean(bool)` | `readBoolean()` | 1 byte |

For complex types, use `Packet`'s static helpers:

| Helper | Use case |
|---|---|
| `writeUtf()` / `readUtf()` | Wide strings |
| `writeItem()` / `readItem()` | ItemInstance (id, count, damage, NBT) |
| `writeNbt()` / `readNbt()` | CompoundTag trees |
| `writeBytes()` / `readBytes()` | Raw byte arrays |

:::caution
The `read()` and `write()` methods must serialize fields in exactly the same order. A mismatch will corrupt the data stream and likely crash the connection.
:::

## Thread safety

Networking in LCE runs on separate threads. Keep these rules in mind:

- Packet `read()` and `write()` run on the Connection's read/write threads
- Packet `handle()` runs on the main game thread during `Connection::tick()`
- The `incoming` queue (protected by the `incoming_cs` critical section) handles thread-safe packet delivery
- Never touch game state directly in `read()` or `write()`. Only do that in `handle()`

## Key source files

- `Minecraft.World/Packet.h` / `Packet.cpp` for the base class and packet registration
- `Minecraft.World/PacketListener.h` for the handler interface with all virtual methods
- `Minecraft.World/Connection.h` for TCP transport with read/write threads
- `Minecraft.World/ChatPacket.h` / `ChatPacket.cpp` for a complete example packet
- `Minecraft.Client/ClientConnection.h` for the client-side packet handler
- `Minecraft.Client/PlayerConnection.h` for the server-side packet handler
- `Minecraft.World/DataInputStream.h` / `DataOutputStream.h` for serialization streams
