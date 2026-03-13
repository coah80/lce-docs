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

## The full client-server lifecycle

Here is what happens from the moment a player clicks "join" to when they are playing and eventually disconnect.

### Phase 1: Socket creation

1. The platform network layer detects a new incoming player
2. `CGameNetworkManager` calls `CreateSocket()` which makes a `Socket` object wrapping the platform's `INetworkPlayer`
3. The socket goes to `ServerConnection::NewIncomingSocket()`
4. The server wraps it in a `PendingConnection` with a 30-second login timeout

### Phase 2: PreLogin handshake

1. Client sends `PreLoginPacket` (ID 2) with version number, XUIDs, UGC flags
2. Server checks `m_netcodeVersion` against `MINECRAFT_NET_VERSION`
3. If versions don't match, server disconnects with `eDisconnect_OutdatedServer` or `eDisconnect_OutdatedClient`
4. Server checks ban list, friends-only restrictions, and UGC privileges
5. On success, server sends back its own `PreLoginPacket` with UGC info

### Phase 3: Login exchange

1. Client sends `LoginPacket` (ID 1) with username, XUIDs, skin/cape IDs, guest status
2. Server calls `PlayerList::getPlayerForLogin()` which checks if the server is full
3. Server assigns a player index from the `MINECRAFT_NET_MAX_PLAYERS` slots
4. Server creates a `ServerPlayer` and a `PlayerConnection`
5. Server sends back `LoginPacket` with world seed, dimension, game type, map height, max players, world size, hell scale, privileges

### Phase 4: World data transfer

1. Server sends `ChunkVisibilityAreaPacket` (ID 155) with the min/max chunk coordinates
2. Server sends `BlockRegionUpdatePacket` (ID 51) for each visible chunk
3. Server sends entity spawn packets for nearby entities
4. Server sends inventory, abilities, and player state packets
5. If the player has a custom skin, server requests it via `TextureAndGeometryPacket` (ID 160)

### Phase 5: Play state

1. `Connection::tick()` runs each server tick, processing up to 1000 incoming packets
2. Each packet's `handle()` method dispatches to the right `PacketListener` handler
3. The `EntityTracker` sends position updates, metadata changes, and spawn/despawn packets
4. Block changes go through `TileUpdatePacket` / `ChunkTilesUpdatePacket` / `BlockRegionUpdatePacket`
5. A `KeepAlivePacket` is sent every 20 ticks from both sides

### Phase 6: Disconnection

1. A disconnect can happen for many reasons (timeout, overflow, kick, quit, version mismatch, etc.)
2. `Connection::close()` sets `running = false`, closes the input stream, waits for read/write threads to finish
3. `packetListener->onDisconnect()` is called with the reason
4. On the server, `PlayerList::remove()` cleans up the player and notifies other players

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

- `writeUtf()` / `readUtf()`: Wide strings with a short length prefix. Each character is 2 bytes (UTF-16). `readUtf()` takes a `maxLength` parameter and returns an empty string if the length is negative or exceeds the max.
- `writeItem()` / `readItem()`: `ItemInstance` serialization. Format: short item ID (-1 for null), byte count, short damage, then NBT tag data. LCE always reads/writes the NBT tag, even for items that can't be depleted. This is a 4J change from Java's conditional write.
- `writeNbt()` / `readNbt()`: `CompoundTag` serialization. Writes a short size prefix then raw NBT bytes via `NbtIo::compress()`. Max NBT size is 32767 bytes. Returns null for size <= 0.
- `writeBytes()` / `readBytes()`: Raw byte arrays with a short length prefix. Validates that the length is non-negative.

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

### Understanding the registration flags

| Flag | `true` | `false` |
|---|---|---|
| `receiveOnClient` | Client processes this packet. Added to `clientReceivedPackets` set. | Client ignores it. `readPacket()` returns null. |
| `receiveOnServer` | Server processes this packet. Added to `serverReceivedPackets` set. | Server ignores it. `readPacket()` returns null. |
| `sendToAnyClient` | Broadcast to all clients normally. | Splitscreen optimization: only send to one player per dimension per machine. |
| `renderStats` | Creates a `PacketStatistics` entry for the debug overlay (only when `PACKET_ENABLE_STAT_TRACKING` is 1). | Hidden from stats. |

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
| 150-167 | 4J custom | CraftItem, TradeItem, DebugOptions, Textures, Progress, GameRules |
| 200-205 | Stats/info | AwardStat, PlayerInfo, PlayerAbilities, ClientCommand |
| 250 | Plugin | CustomPayloadPacket |
| 254-255 | System | GetInfo, Disconnect |

IDs 150+ are custom additions by 4J Studios for the console edition. Use IDs in an unused range for your mod packets. Good choices are IDs in the 168-199 range or 206+ (up to 255).

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

The `isServerPacketListener()` return value matters because it controls which stream the `Connection` reads from (the server end or client end of the socket) and which packet set is valid.

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

- **Separate read/write threads**: `Connection` spawns dedicated threads for reading and writing packets, using critical sections for thread safety. Both run on `CPU_CORE_CONNECTIONS`.
- **Two outgoing queues**: `outgoing` for normal priority, `outgoing_slow` for bulk data (chunks). Packets with `shouldDelay = true` get routed to the slow queue.
- **Timeout**: connections time out after `MAX_TICKS_WITHOUT_INPUT` (1200 ticks / 60 seconds)
- **Overflow**: if `estimatedRemaining` exceeds 1 MB, the connection is closed
- **Send buffer**: 5 KB buffered output stream
- **Packet statistics**: optional per-packet-type tracking enabled by `PACKET_ENABLE_STAT_TRACKING`

### LAN architecture

LCE uses a **listen server** model for multiplayer. One console is both the server and a client:

1. The host runs `MinecraftServer` which listens on a socket
2. Remote players connect through `ClientConnection` over the LAN
3. Local players on the host share the same process, so their packets skip the network (local sockets use in-memory queues)
4. Each remote player gets a `PlayerConnection` on the server side
5. The `sendToAnyClient` flag on packet registration controls whether a packet goes to all connected clients or just one per machine per dimension

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

    virtual int getId() { return 170; }  // use an unused ID (168-199 range is safe)
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

:::caution
The `read()` and `write()` methods must serialize fields in exactly the same order. A mismatch will corrupt the data stream and likely crash the connection.
:::

### Step 3: Register the packet

Add to `Packet::staticCtor()` in `Packet.cpp`:

```cpp
// Custom mod packet: received on both client and server, sent to all clients
map(170, true, true, true, false, typeid(MyModPacket), MyModPacket::create);
```

Here's what the registration flags mean in this case:

| Flag | Value | Meaning |
|---|---|---|
| `receiveOnClient` | `true` | Client can receive this packet from the server |
| `receiveOnServer` | `true` | Server can receive this packet from clients |
| `sendToAnyClient` | `true` | Broadcast to all clients (no splitscreen dedup) |
| `renderStats` | `false` | Don't show in debug stats overlay |

If your packet is server-to-client only (like a custom HUD update), set `receiveOnServer` to `false`. If it is client-to-server only (like a custom input), set `receiveOnClient` to `false`.

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
    // This runs on the main game thread during Connection::tick()
}
```

In `PlayerConnection` (server-side handling):

```cpp
void PlayerConnection::handleMyModPacket(shared_ptr<MyModPacket> packet) {
    // Handle on server -- validate, update game state, broadcast
    // This runs on the main game thread during Connection::tick()
}
```

### Step 6: Send the packet

From client to server:

```cpp
// Via the client's Connection
clientConnection->send(make_shared<MyModPacket>(1, L"hello"));
```

From server to a specific player:

```cpp
// Via the player's PlayerConnection
playerConnection->send(make_shared<MyModPacket>(2, L"response"));
```

From server to all players:

```cpp
// Via PlayerList::broadcastAll()
server->getPlayers()->broadcastAll(make_shared<MyModPacket>(3, L"everyone"));
```

From server to all players in a dimension:

```cpp
// Via PlayerList::broadcastAll() with dimension
server->getPlayers()->broadcastAll(make_shared<MyModPacket>(3, L"nether only"), -1);
```

From server to players near a position:

```cpp
// Via PlayerList::broadcast() with position and range
server->getPlayers()->broadcast(x, y, z, 64.0, dimension, make_shared<MyModPacket>(4, L"nearby"));
```

## Syncing custom data

### Pattern: Server-authoritative state

The safest way to sync custom data is to make the server the single source of truth:

1. Client sends a request packet (e.g., "player wants to activate X")
2. Server validates the request (player has the right items, is in the right place, etc.)
3. Server updates its own state
4. Server broadcasts the result to all clients

```cpp
// Client side
void ClientConnection::handleMyModPacket(shared_ptr<MyModPacket> packet) {
    if (packet->action == ACTION_RESULT) {
        // Update local display based on server response
        myModState = packet->data;
    }
}

// Server side
void PlayerConnection::handleMyModPacket(shared_ptr<MyModPacket> packet) {
    if (packet->action == ACTION_REQUEST) {
        // Validate the request
        if (isValidRequest(player, packet->data)) {
            // Update server state
            applyChange(player, packet->data);
            // Broadcast result to all clients
            server->getPlayers()->broadcastAll(
                make_shared<MyModPacket>(ACTION_RESULT, packet->data)
            );
        }
    }
}
```

### Pattern: Entity metadata sync

If your custom data is tied to an entity, you can hook into the `SynchedEntityData` system instead of making a custom packet. When entity data is marked dirty, `TrackedEntity::tick()` automatically sends a `SetEntityDataPacket` to all players in range.

The downside is that entity data has a fixed set of fields. If you need something totally custom, use your own packet.

### Pattern: Sending NBT over a packet

For complex structured data, you can send a `CompoundTag` inside your packet:

```cpp
void MyModPacket::write(DataOutputStream *dos) {
    dos->writeInt(action);
    writeNbt(tag, dos);  // inherited from Packet
}

void MyModPacket::read(DataInputStream *dis) {
    action = dis->readInt();
    tag = readNbt(dis);  // returns CompoundTag*, max 32767 bytes
}
```

Keep in mind the 32767 byte limit on NBT payloads sent this way. For larger data, split it across multiple packets.

### Pattern: Chunk-scoped data via CustomPayloadPacket

`CustomPayloadPacket` (ID 250) supports named channels with arbitrary byte payloads. You can use this instead of making a whole new packet class:

```cpp
// Sending
ByteArrayOutputStream baos;
DataOutputStream dos(&baos);
dos.writeInt(myCustomField1);
dos.writeFloat(myCustomField2);
auto packet = make_shared<CustomPayloadPacket>(L"mymod:data", baos.buf);
connection->send(packet);
```

This is simpler but less type-safe than a dedicated packet class.

## Serialization reference

The `DataOutputStream` / `DataInputStream` classes support these types:

| Write method | Read method | Size | Notes |
|---|---|---|---|
| `writeByte(int)` | `readByte()` | 1 byte | Signed |
| `writeShort(int)` | `readShort()` | 2 bytes | Signed, big-endian |
| `writeInt(int)` | `readInt()` | 4 bytes | Signed, big-endian |
| `writeLong(__int64)` | `readLong()` | 8 bytes | Signed, big-endian |
| `writeFloat(float)` | `readFloat()` | 4 bytes | IEEE 754 |
| `writeDouble(double)` | `readDouble()` | 8 bytes | IEEE 754 |
| `writeBoolean(bool)` | `readBoolean()` | 1 byte | 0 or 1 |
| `writeChar(wchar_t)` | `readChar()` | 2 bytes | UTF-16 character |
| `writeChars(wstring)` | -- | N*2 bytes | Writes each char, no length prefix |
| `write(byteArray)` | `read(byteArray)` | N bytes | Raw bytes |
| `write(int)` | `read()` | 1 byte | Single byte (used for packet ID) |

For complex types, use `Packet`'s static helpers:

| Helper | Use case | Wire format |
|---|---|---|
| `writeUtf()` / `readUtf()` | Wide strings | short length + N*2 bytes of UTF-16 chars |
| `writeItem()` / `readItem()` | ItemInstance (id, count, damage, NBT) | short id + byte count + short damage + NBT |
| `writeNbt()` / `readNbt()` | CompoundTag trees | short length + raw NBT bytes (max 32767) |
| `writeBytes()` / `readBytes()` | Raw byte arrays | short length + N bytes |

## Thread safety

Networking in LCE runs on separate threads. Keep these rules in mind:

- Packet `read()` and `write()` run on the Connection's read/write threads
- Packet `handle()` runs on the main game thread during `Connection::tick()`
- The `incoming` queue (protected by the `incoming_cs` critical section) handles thread-safe packet delivery
- **Never touch game state directly in `read()` or `write()`**. Only do that in `handle()`.
- The `outgoing` queue is protected by `writeLock` critical section. `send()` is safe to call from any thread.
- Up to 1000 packets are processed per tick. If your mod sends a lot of packets, they will queue up.

### Common pitfall: handler deadlocks

The packet processing loop in `Connection::tick()` used to hold the `incoming_cs` lock while calling `handle()`. This caused deadlocks when `handle()` tried to close the connection (which needs to signal the read/write threads, which try to lock `incoming_cs`). The fix was to copy packets out of the queue first, release the lock, then handle them. If you add code that closes a connection from inside a handler, it should work fine because of this fix.

## Key source files

- `Minecraft.World/Packet.h` / `Packet.cpp` for the base class and packet registration
- `Minecraft.World/PacketListener.h` for the handler interface with all virtual methods
- `Minecraft.World/Connection.h` / `Connection.cpp` for TCP transport with read/write threads
- `Minecraft.World/ChatPacket.h` / `ChatPacket.cpp` for a complete example packet
- `Minecraft.Client/ClientConnection.h` / `ClientConnection.cpp` for the client-side packet handler
- `Minecraft.Client/PlayerConnection.h` / `PlayerConnection.cpp` for the server-side packet handler
- `Minecraft.Client/PlayerList.h` / `PlayerList.cpp` for broadcast and player management
- `Minecraft.World/DataInputStream.h` / `DataOutputStream.h` for serialization streams
- `Minecraft.World/DisconnectPacket.h` for all disconnect reason codes
