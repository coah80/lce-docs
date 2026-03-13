---
title: Networking & Packets
description: How LCE handles multiplayer networking and packet communication.
---

LCE's networking layer is a console-adapted version of the original Minecraft Java Edition protocol, heavily modified by 4J Studios to work over platform-specific network APIs (QNET on Xbox, SQR on PlayStation, ad-hoc on PS Vita). The system follows a client-server model where the host machine runs an integrated server and all players (including the host's local players) communicate through packet-based connections.

## Architecture Overview

The networking code is split across two layers:

**Platform-independent layer** (`Minecraft.World` and `Minecraft.Client`):
- `Packet`: base class for all packet types, with a static registry mapping IDs to factory functions
- `Connection`: manages a bidirectional socket with dedicated read/write threads
- `PacketListener`: abstract interface with virtual handlers for every packet type
- `ServerConnection`: server-side manager that tracks pending and active player connections
- `ClientConnection`: client-side `PacketListener` implementation that handles incoming server packets
- `PlayerConnection`: server-side `PacketListener` implementation that handles incoming client packets
- `PendingConnection`: temporary server-side handler for connections still in the login handshake

**Platform-specific layer** (`Minecraft.Client/Common/Network` and platform subdirectories):
- `CGameNetworkManager`: platform-independent game-side networking coordinator (global instance `g_NetworkManager`)
- `CPlatformNetworkManager`: abstract interface with one implementation per platform
- `INetworkPlayer`: abstract player interface with methods for sending data, checking RTT, and managing socket state
- Platform implementations: `CPlatformNetworkManagerXbox`, `CPlatformNetworkManagerDurango`, `CPlatformNetworkManagerSony`, `CPlatformNetworkManagerStub`

The relationship between these layers is documented in `/Users/cole/Documents/LCEMP/Minecraft.Client/Network Implementation Notes.txt`:

```
Game --> GameNetworkManager <--> NetworkPlayerInterface    (platform independent)
              |                          |
              v                          v
     PlatformNetworkManager <--> NetworkPlayerImplementation  (platform specific)
              |                          |
              v                          v
     Platform network code       Platform player code
```

## The Socket Abstraction

The `Socket` class (`Minecraft.World/Socket.h`) provides a unified interface over two different transport methods:

- **Local sockets**: For connections between the host player and the integrated server on the same machine. Data passes through in-memory queues (`s_hostQueue`) protected by critical sections, so no actual network traffic happens.
- **Network sockets**: For connections to remote players. Data goes through `INetworkPlayer::SendData()` which passes it to the platform's network layer (QNET on Xbox, SQR on PlayStation).

Each socket has two "ends" (`SOCKET_CLIENT_END` and `SOCKET_SERVER_END`) with independent input and output streams. The `isLocal()` method tells local and networked connections apart, and the system skips outgoing packet stats recording for local connections.

## The Connection Class

`Connection` (`Minecraft.World/Connection.h`) wraps a `Socket` with:

- **Dedicated read and write threads** running on `CPU_CORE_CONNECTIONS`, using event-based wake signals with a 100ms timeout fallback
- **Three packet queues** protected by critical sections:
  - `incoming`: packets read from the network, waiting to be dispatched to the `PacketListener`
  - `outgoing`: normal-priority packets queued for sending
  - `outgoing_slow`: low-priority packets (e.g., chunk data marked with `shouldDelay`), sent with `QNET_SENDDATA_LOW_PRIORITY | QNET_SENDDATA_SECONDARY` flags
- **KeepAlive heartbeat**: sends a `KeepAlivePacket` every 20 ticks
- **Timeout detection**: disconnects after `MAX_TICKS_WITHOUT_INPUT` (1200 ticks / 60 seconds) of silence
- **Overflow protection**: disconnects if the estimated outgoing buffer goes over 1 MB
- **Buffered output**: uses a 5 KB send buffer (`SEND_BUFFER_SIZE = 1024 * 5`)

The `tick()` method processes up to 1000 incoming packets per call, dispatching each to its `PacketListener` through the packet's `handle()` method.

## The Packet Base Class

All packets inherit from `Packet` (`Minecraft.World/Packet.h`). Each packet must implement:

| Method | Purpose |
|--------|---------|
| `getId()` | Returns the packet's numeric ID (0-255) |
| `read(DataInputStream*)` | Reads the packet from the stream |
| `write(DataOutputStream*)` | Writes the packet to the stream |
| `handle(PacketListener*)` | Dispatches to the right handler on the listener |
| `getEstimatedSize()` | Returns estimated byte size for buffer management |

Optional overrides include `canBeInvalidated()` and `isInvalidatedBy()` for packet deduplication, and `isAync()` for async-safe packets (only `KeepAlivePacket` uses this).

### Packet Wire Format

Packets are written as a single ID byte followed by packet-specific data:

```
[1 byte: packet ID] [N bytes: packet payload]
```

The `Packet::readPacket()` static method reads the ID byte, validates it against the allowed set for the connection side (client or server), creates the packet through its registered factory function, and calls `read()` to parse the payload.

### Packet Registration

`Packet::staticCtor()` registers all packets through the `Packet::map()` function:

```cpp
map(id, receiveOnClient, receiveOnServer, sendToAnyClient, renderStats, typeid(Class), Class::create);
```

Parameters:
- **`id`**: numeric packet ID (0-255)
- **`receiveOnClient`**: whether the client processes this packet
- **`receiveOnServer`**: whether the server processes this packet
- **`sendToAnyClient`**: if `true`, sent to all clients; if `false`, sent to only one player per dimension per machine (a 4J splitscreen optimization)
- **`renderStats`**: whether to include in debug statistics rendering
- **Factory function**: creates a new packet instance as `shared_ptr<Packet>`

Three sets track directionality: `clientReceivedPackets`, `serverReceivedPackets`, and `sendToAnyClientPackets`.

### Utility Methods

`Packet` provides shared serialization helpers:
- `readUtf()` / `writeUtf()`: length-prefixed UTF-16 strings
- `readItem()` / `writeItem()`: `ItemInstance` with NBT data
- `readNbt()` / `writeNbt()`: compressed NBT compound tags
- `readBytes()` / `writeBytes()`: length-prefixed byte arrays

## Complete Packet Registry

All packet IDs as registered in `Packet::staticCtor()`:

### Connection & Lifecycle (IDs 0-2, 254-255)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 0 | `KeepAlivePacket` | recv | recv | Connection heartbeat, sent every 20 ticks |
| 1 | `LoginPacket` | recv | recv | Login exchange (bidirectional with different payloads) |
| 2 | `PreLoginPacket` | recv | recv | Pre-login handshake with version check and UGC privileges |
| 254 | `GetInfoPacket` | -- | recv | Server info query |
| 255 | `DisconnectPacket` | recv | recv | Disconnect with reason enum |

### Chat & Commands (IDs 3, 205, 167)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 3 | `ChatPacket` | recv | recv | Chat messages |
| 205 | `ClientCommandPacket` | -- | recv | Client-issued commands (e.g., respawn request) |
| 167 | `GameCommandPacket` | -- | recv | Game commands from client |

### Player Movement (IDs 10-13)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 10 | `MovePlayerPacket` | recv | recv | Base player movement (ground/flying status) |
| 11 | `MovePlayerPacket::Pos` | recv | recv | Player position update |
| 12 | `MovePlayerPacket::Rot` | recv | recv | Player rotation update |
| 13 | `MovePlayerPacket::PosRot` | recv | recv | Player position + rotation update |

### Player Actions & State (IDs 4-9, 14-19, 200-202)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 4 | `SetTimePacket` | recv | -- | World time synchronization |
| 5 | `SetEquippedItemPacket` | recv | -- | Entity equipped item display |
| 6 | `SetSpawnPositionPacket` | recv | -- | Player spawn point |
| 7 | `InteractPacket` | -- | recv | Entity interaction (attack/use) |
| 8 | `SetHealthPacket` | recv | -- | Player health update |
| 9 | `RespawnPacket` | recv | recv | Respawn / dimension change |
| 14 | `PlayerActionPacket` | -- | recv | Block digging actions |
| 15 | `UseItemPacket` | -- | recv | Item use / block placement |
| 16 | `SetCarriedItemPacket` | -- | recv | Hotbar slot change |
| 17 | `EntityActionAtPositionPacket` | recv | -- | Entity action at position (e.g., sleep in bed) |
| 18 | `AnimatePacket` | recv | recv | Player arm swing / damage animation |
| 19 | `PlayerCommandPacket` | -- | recv | Player actions (sneak, sprint, etc.) |
| 200 | `AwardStatPacket` | recv | -- | Statistics update |
| 201 | `PlayerInfoPacket` | recv | recv | Player list updates (repurposed by 4J) |
| 202 | `PlayerAbilitiesPacket` | recv | recv | Player abilities (flying, creative, etc.) |

### Entity Spawning (IDs 20-26, 71)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 20 | `AddPlayerPacket` | recv | -- | Spawn a remote player |
| 22 | `TakeItemEntityPacket` | recv | -- | Item pickup animation |
| 23 | `AddEntityPacket` | recv | -- | Spawn a non-mob entity (minecart, arrow, etc.) |
| 24 | `AddMobPacket` | recv | -- | Spawn a mob entity |
| 25 | `AddPaintingPacket` | recv | -- | Spawn a painting |
| 26 | `AddExperienceOrbPacket` | recv | -- | Spawn an experience orb |
| 71 | `AddGlobalEntityPacket` | recv | -- | Spawn a global entity (lightning bolt) |

### Entity Sync (IDs 28-35, 38-43, 162-165)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 28 | `SetEntityMotionPacket` | recv | -- | Entity velocity |
| 29 | `RemoveEntitiesPacket` | recv | -- | Despawn entities |
| 30 | `MoveEntityPacket` | recv | -- | Entity movement base (no data) |
| 31 | `MoveEntityPacket::Pos` | recv | -- | Entity relative position delta |
| 32 | `MoveEntityPacket::Rot` | recv | -- | Entity rotation delta |
| 33 | `MoveEntityPacket::PosRot` | recv | -- | Entity position + rotation delta |
| 34 | `TeleportEntityPacket` | recv | -- | Entity absolute position |
| 35 | `RotateHeadPacket` | recv | -- | Entity head rotation |
| 38 | `EntityEventPacket` | recv | -- | Entity status changes (damage, death, etc.) |
| 39 | `SetRidingPacket` | recv | -- | Mount/dismount |
| 40 | `SetEntityDataPacket` | recv | -- | Entity metadata sync |
| 41 | `UpdateMobEffectPacket` | recv | -- | Apply potion effect |
| 42 | `RemoveMobEffectPacket` | recv | -- | Remove potion effect |
| 43 | `SetExperiencePacket` | recv | -- | Experience bar update |
| 162 | `MoveEntityPacketSmall` | recv | -- | Small entity movement base (4J addition) |
| 163 | `MoveEntityPacketSmall::Pos` | recv | -- | Small entity position delta |
| 164 | `MoveEntityPacketSmall::Rot` | recv | -- | Small entity rotation delta |
| 165 | `MoveEntityPacketSmall::PosRot` | recv | -- | Small entity position + rotation delta |

### World / Chunk Data (IDs 50-55, 60-62, 70, 155)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 50 | `ChunkVisibilityPacket` | recv | -- | Show/hide a single chunk column |
| 51 | `BlockRegionUpdatePacket` | recv | -- | Bulk block data for a region (replaces Java's LevelChunkPacket) |
| 52 | `ChunkTilesUpdatePacket` | recv | -- | Multiple block changes within a chunk |
| 53 | `TileUpdatePacket` | recv | -- | Single block change |
| 54 | `TileEventPacket` | recv | -- | Block event (piston, chest, noteblock) |
| 55 | `TileDestructionPacket` | recv | -- | Block break progress |
| 60 | `ExplodePacket` | recv | -- | Explosion with affected blocks |
| 61 | `LevelEventPacket` | recv | -- | World effects (particles, sounds) |
| 62 | `LevelSoundPacket` | recv | -- | Named sound events |
| 70 | `GameEventPacket` | recv | -- | Game state changes (rain, credits, etc.) |
| 155 | `ChunkVisibilityAreaPacket` | recv | -- | Batch chunk visibility for initial join (4J addition) |

### Container / Inventory (IDs 100-108, 130-132)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 100 | `ContainerOpenPacket` | recv | -- | Open a container GUI |
| 101 | `ContainerClosePacket` | recv | recv | Close a container |
| 102 | `ContainerClickPacket` | -- | recv | Inventory click action |
| 103 | `ContainerSetSlotPacket` | recv | recv | Set a single inventory slot |
| 104 | `ContainerSetContentPacket` | recv | -- | Set entire container contents |
| 105 | `ContainerSetDataPacket` | recv | -- | Container property update (furnace progress, etc.) |
| 106 | `ContainerAckPacket` | recv | recv | Transaction confirmation |
| 107 | `SetCreativeModeSlotPacket` | recv | recv | Creative mode inventory action |
| 108 | `ContainerButtonClickPacket` | -- | recv | Container button click (enchanting) |
| 130 | `SignUpdatePacket` | recv | recv | Sign text update |
| 131 | `ComplexItemDataPacket` | recv | -- | Map item data |
| 132 | `TileEntityDataPacket` | recv | -- | Tile entity NBT sync |

### 4J Custom Packets (IDs 150-161, 166)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 150 | `CraftItemPacket` | -- | recv | Crafting request from client |
| 151 | `TradeItemPacket` | -- | recv | Villager trading |
| 152 | `DebugOptionsPacket` | -- | recv | Debug mode toggles |
| 153 | `ServerSettingsChangedPacket` | recv | recv | Server settings synchronization |
| 154 | `TexturePacket` | recv | recv | Texture pack data |
| 156 | `UpdateProgressPacket` | recv | -- | Loading progress bar |
| 157 | `TextureChangePacket` | recv | recv | Texture pack change notification |
| 158 | `UpdateGameRuleProgressPacket` | recv | -- | Game rule change progress |
| 159 | `KickPlayerPacket` | -- | recv | Kick a player from the game |
| 160 | `TextureAndGeometryPacket` | recv | recv | Texture + geometry (skin) data |
| 161 | `TextureAndGeometryChangePacket` | recv | recv | Texture + geometry change notification |
| 166 | `XZPacket` | recv | recv | XZ coordinate packet |

### Plugin Channel (ID 250)

| ID | Packet | Client | Server | Description |
|----|--------|--------|--------|-------------|
| 250 | `CustomPayloadPacket` | recv | recv | Named channel data (plugin messages) |

## Connection Lifecycle

### 1. Socket Creation

When a new player joins, `CGameNetworkManager::CreateSocket()` creates a `Socket` object. For the host player, this is a local socket backed by in-memory queues. For remote players, the socket wraps the platform's `INetworkPlayer` network layer. The socket then goes to `ServerConnection::NewIncomingSocket()`.

### 2. Pending Connection (PreLogin)

The server wraps the new socket in a `PendingConnection`, which creates a `Connection` with read/write threads. The connection has 30 seconds (`MAX_TICKS_BEFORE_LOGIN = 600 ticks`) to finish the login process.

The client sends a `PreLoginPacket` (ID 2) containing:
- Player XUIDs (offline and online) for all local players
- UGC (user-generated content) privilege flags
- Friends-only bits
- The unique save name (for ban list checking)
- Server settings bitfield
- Host player index
- Texture pack ID
- **Network version number** (`m_netcodeVersion`, checked against `MINECRAFT_NET_VERSION`)

If the version doesn't match, the server disconnects with `eDisconnect_OutdatedServer` or `eDisconnect_OutdatedClient`. On success, the server sends back a `PreLoginPacket` response with its own UGC privilege information.

### 3. Login Exchange

After the PreLogin succeeds, the client sends a `LoginPacket` (ID 1) with:
- Username and client version
- Offline/online XUIDs
- UGC privileges and skin/cape IDs
- Guest status flag

The server responds with a `LoginPacket` containing world information:
- Seed, dimension, difficulty
- Game type, map height, max players
- Level type, XZ world size, hell scale
- Player privileges and spawn data

### 4. World Data Transfer

Once login completes, the `PendingConnection` gets promoted: its `Connection` is transferred to a new `PlayerConnection` and linked to a `ServerPlayer`. The server then sends:

- `ChunkVisibilityAreaPacket` (ID 155), a 4J addition that batches the initial visible chunk area instead of sending individual `ChunkVisibilityPacket` messages per chunk
- `BlockRegionUpdatePacket` (ID 51) with bulk chunk data for each visible chunk
- Entity spawn packets for nearby entities
- Inventory and player state packets

The `ClientConnection` tracks its state through an enum: `eCCPreLoginSent` -> `eCCPreLoginReceived` -> `eCCLoginSent` -> `eCCLoginReceived` -> `eCCConnected`.

### 5. Play State

During gameplay, `Connection::tick()` processes incoming packets and the `PacketListener` implementation (either `PlayerConnection` on the server or `ClientConnection` on the client) handles each one through its virtual `handle*` methods.

### 6. Disconnection

Disconnection can happen for many reasons, tracked by `DisconnectPacket::eDisconnectReason`:

| Reason | Trigger |
|--------|---------|
| `eDisconnect_Quitting` | Player chose to leave |
| `eDisconnect_TimeOut` | No input for 60 seconds |
| `eDisconnect_Overflow` | Outgoing buffer went over 1 MB |
| `eDisconnect_Kicked` | Kicked by host |
| `eDisconnect_ServerFull` | No slots available |
| `eDisconnect_OutdatedServer/Client` | Version mismatch |
| `eDisconnect_NoMultiplayerPrivilegesHost/Join` | Platform privilege failure |
| `eDisconnect_NoUGC_*` | UGC content restrictions |
| `eDisconnect_Banned` | Player is banned |
| `eDisconnect_NotFriendsWithHost` | Friends-only session restriction |

The `Connection::close()` method stops the read/write threads, closes streams, and notifies the `PacketListener` through `onDisconnect()`.

## Entity Synchronization

Entity movement uses a tiered packet system optimized for bandwidth:

**Standard entities** use `MoveEntityPacket` (IDs 30-33):
- `MoveEntityPacket` (ID 30): base with no movement data (heartbeat-like)
- `MoveEntityPacket::Pos` (ID 31): relative position deltas as signed bytes
- `MoveEntityPacket::Rot` (ID 32): rotation as compressed bytes
- `MoveEntityPacket::PosRot` (ID 33): both position and rotation deltas

**Small entities** (a 4J optimization) use `MoveEntityPacketSmall` (IDs 162-165) with the same sub-packet pattern but for entities that need less precision.

**Absolute positioning** uses `TeleportEntityPacket` (ID 34) for when deltas aren't enough (large movements or corrections).

Entity metadata (health, custom name, status flags, etc.) syncs through `SetEntityDataPacket` (ID 40). The `sendToAnyClient` flag on entity packets controls splitscreen behavior: motion packets (ID 28) go to all clients because knockback effects need to be visible to everyone, while some entity metadata is scoped per-dimension per-machine.

## Block Change Propagation

Block changes flow through several packets depending on scope:

- **Single block**: `TileUpdatePacket` (ID 53) sends the block position, block ID, data value, and level index.
- **Multi-block in a chunk**: `ChunkTilesUpdatePacket` (ID 52) batches multiple block changes within a single chunk section.
- **Region update**: `BlockRegionUpdatePacket` (ID 51) sends a rectangular volume of block data as a compressed byte buffer. The `bIsFullChunk` flag says whether this is a complete chunk.
- **Chunk visibility**: `ChunkVisibilityPacket` (ID 50) toggles whether a chunk column is visible (loaded) on the client.
- **Block events**: `TileEventPacket` (ID 54) handles interactive block state (pistons, chests, note blocks).
- **Block destruction**: `TileDestructionPacket` (ID 55) shows block break progress.
- **Explosions**: `ExplodePacket` (ID 60) sends the explosion center and list of affected block positions.

## LAN / Splitscreen Multiplayer

LAN multiplayer is the core feature of LCE. The architecture supports multiple local players on a single console (splitscreen) alongside remote players over the network.

### Local vs. Remote Connections

The `Socket` class tells connections apart through the `m_hostLocal` flag:
- **Host's local connection**: Uses static in-memory queues (`s_hostQueue`) shared between client and server ends. No serialization to the network happens. Data is passed directly through `SocketInputStreamLocal` / `SocketOutputStreamLocal`.
- **Remote connections**: Use `SocketInputStreamNetwork` / `SocketOutputStreamNetwork`, which push data through `INetworkPlayer::SendData()` to the platform networking layer.

### The `sendToAnyClient` System

A key 4J addition is the `sendToAnyClient` parameter on packet registration. When set to `false`, the server sends the packet to only one player per dimension per machine instead of broadcasting to everyone. This is a splitscreen optimization: since multiple local players share the same screen/system, sending duplicate world data to each one would be wasteful. The `Packet::canSendToAnyClient()` check handles this at send time.

Packets like chunk data (`ChunkVisibilityPacket`, `BlockRegionUpdatePacket`, `TileUpdatePacket`) are marked `sendToAnyClient = true` because all players need world state. Packets like `SetTimePacket` (ID 4) or `AddMobPacket` (ID 24) are `sendToAnyClient = false` since they only need to reach each machine once.

### Session Management

`CGameNetworkManager` coordinates session lifecycle:
- `HostGame()` creates a session with configurable public/private slots (up to `MINECRAFT_NET_MAX_PLAYERS`)
- `JoinGame()` connects to a discovered session
- `SetLocalGame()` / `SetPrivateGame()` control session visibility
- `IsLocalGame()` tells LAN-only from online sessions apart
- Player change callbacks notify the game when players join or leave

### Platform Network Backends

Each console platform has its own `CPlatformNetworkManager` and `INetworkPlayer` implementations:

| Platform | Network Manager | Transport |
|----------|----------------|-----------|
| Xbox 360 | `CPlatformNetworkManagerXbox` | QNET |
| Xbox One (Durango) | `CPlatformNetworkManagerDurango` | QNET / DQR |
| PS3 | `CPlatformNetworkManagerSony` | SQR |
| PS Vita | `CPlatformNetworkManagerSony` | SQR (+ ad-hoc mode) |
| PS4 (Orbis) | `CPlatformNetworkManagerSony` | SQR |
| Stub (PC/debug) | `CPlatformNetworkManagerStub` | Stub/QNET stub |

The PS Vita also supports **ad-hoc mode** for direct wireless connections between consoles without network infrastructure, exposed through `CGameNetworkManager::usingAdhocMode()` and `setAdhocMode()`.

## Key Source Files

| File | Location |
|------|----------|
| `Packet.h` / `Packet.cpp` | `Minecraft.World/` |
| `PacketListener.h` / `PacketListener.cpp` | `Minecraft.World/` |
| `Connection.h` / `Connection.cpp` | `Minecraft.World/` |
| `Socket.h` | `Minecraft.World/` |
| `ClientConnection.h` / `ClientConnection.cpp` | `Minecraft.Client/` |
| `PlayerConnection.h` / `PlayerConnection.cpp` | `Minecraft.Client/` |
| `PendingConnection.h` / `PendingConnection.cpp` | `Minecraft.Client/` |
| `ServerConnection.h` / `ServerConnection.cpp` | `Minecraft.Client/` |
| `GameNetworkManager.h` / `GameNetworkManager.cpp` | `Minecraft.Client/Common/Network/` |
| `PlatformNetworkManagerInterface.h` | `Minecraft.Client/Common/Network/` |
| `NetworkPlayerInterface.h` | `Minecraft.Client/Common/Network/` |
| `Network Implementation Notes.txt` | `Minecraft.Client/` |

## MinecraftConsoles Differences

MC registers **104 packets** compared to LCE's **98**. The core networking architecture (Socket, Connection, PacketListener, client/server split) is the same. Here are the new packets:

### New packets in MC

| ID | Packet | Direction | Purpose |
|----|--------|-----------|---------|
| 39 | `SetEntityLinkPacket` | S->C | Leash connections between entities (leads attached to fence posts) |
| 44 | `UpdateAttributesPacket` | S->C | Syncs entity attribute values (health, speed, etc.) to the client |
| 63 | `LevelParticlesPacket` | S->C | Spawns particle effects at a position with configurable parameters |
| 133 | `TileEditorOpenPacket` | S->C | Opens the command block editing UI on the client |
| 206 | `SetObjectivePacket` | S->C | Creates/updates/removes a scoreboard objective |
| 207 | `SetScorePacket` | S->C | Updates a score value on the scoreboard |
| 208 | `SetDisplayObjectivePacket` | S->C | Sets which objective appears in a display slot |
| 209 | `SetPlayerTeamPacket` | S->C | Creates/updates/removes a player team |

### Changes to existing packets

- **`AddMobPacket` (ID 24)**: In MC, this packet can also carry initial attribute data for the spawned mob, since the attribute system needs to sync on spawn.
- **`SetEntityDataPacket` (ID 40)**: Same structure, but MC mobs can have more synched data fields (like horse type, wither invulnerability timer, etc.)
- **Packet IDs 39 and 44**: In LCE these IDs are unused. MC assigns them to `SetEntityLinkPacket` and `UpdateAttributesPacket`.

### Platform backends

The platform networking layer is the same in both codebases. Both support Xbox 360/One, PS3/PS4/Vita, and the stub backend. The `sendToAnyClient` optimization, local socket system, and splitscreen handling are identical.
